import { fetchJson } from "../http.js";
import type { SourceDefinition } from "../source-registry.js";
import type { AdapterRunResult, IngestedOpportunity } from "../types.js";
import { classifyNaicsCodes } from "./naics-classification.js";

type USAJobsResponse = {
  SearchResult?: {
    SearchResultItems?: Array<{
      MatchedObjectId?: string;
      MatchedObjectDescriptor?: {
        PositionID?: string;
        PositionTitle?: string;
        PositionURI?: string;
        ApplyURI?: string[];
        PositionLocationDisplay?: string;
        OrganizationName?: string;
        DepartmentName?: string;
        QualificationSummary?: string;
        PositionRemuneration?: Array<{
          MinimumRange?: string;
          MaximumRange?: string;
          Description?: string;
        }>;
        PublicationStartDate?: string;
        ApplicationCloseDate?: string;
        UserArea?: {
          Details?: {
            JobSummary?: string;
            WhoMayApply?: {
              Name?: string;
            };
            LowGrade?: string;
            HighGrade?: string;
          };
        };
      };
    }>;
  };
};

function getUsaJobsConfig() {
  return {
    apiKey: process.env.USAJOBS_API_KEY?.trim() || "",
    userAgent: process.env.USAJOBS_API_EMAIL?.trim() || "",
  };
}

export async function runUsaJobsAdapter(source: SourceDefinition): Promise<AdapterRunResult> {
  const config = getUsaJobsConfig();
  if (!config.apiKey || !config.userAgent) {
    return {
      status: "skipped",
      reason: "USAJOBS_API_KEY and USAJOBS_API_EMAIL are required.",
    };
  }

  const url = new URL("https://data.usajobs.gov/api/Search");
  url.searchParams.set("LocationName", "Puerto Rico");
  url.searchParams.set("WhoMayApply", "public");
  url.searchParams.set("ResultsPerPage", "50");
  url.searchParams.set("Page", "1");
  url.searchParams.set("SortField", "openingdate");
  url.searchParams.set("SortDirection", "Desc");
  url.searchParams.set("Fields", "Min");

  const response = await fetchJson<USAJobsResponse>(url.toString(), {
    headers: {
      Host: "data.usajobs.gov",
      "Authorization-Key": config.apiKey,
      "User-Agent": config.userAgent,
    },
  });

  const items = ((response.SearchResult?.SearchResultItems ?? [])
    .map((item) => {
      const descriptor = item.MatchedObjectDescriptor;
      const sourceItemId = item.MatchedObjectId?.trim() || descriptor?.PositionID?.trim();
      const title = descriptor?.PositionTitle?.trim();

      if (!sourceItemId || !title || !descriptor) {
        return null;
      }

      const remuneration = descriptor.PositionRemuneration?.[0];
      const amount =
        remuneration?.MinimumRange && remuneration?.MaximumRange
          ? `${remuneration.MinimumRange}-${remuneration.MaximumRange} ${remuneration.Description ?? ""}`.trim()
          : null;
      const naicsCodes = classifyNaicsCodes({
        text: [
          title,
          descriptor.UserArea?.Details?.JobSummary,
          descriptor.QualificationSummary,
          descriptor.OrganizationName,
          descriptor.DepartmentName,
          descriptor.PositionLocationDisplay,
        ],
        hints: ["92"],
      });

      return {
        sourceItemId,
        canonicalKey: `${source.key}:${sourceItemId}`,
        title,
        category: "jobs",
        jurisdiction: source.jurisdiction,
        audience: descriptor.UserArea?.Details?.WhoMayApply?.Name || "Job seekers",
        summary:
          descriptor.UserArea?.Details?.JobSummary?.trim() ||
          descriptor.QualificationSummary?.trim() ||
          null,
        eligibility: descriptor.UserArea?.Details?.WhoMayApply?.Name || null,
        amount,
        deadline: descriptor.ApplicationCloseDate ?? null,
        geography: descriptor.PositionLocationDisplay?.trim() || "Puerto Rico",
        status: "posted",
        sourceUrl: descriptor.PositionURI?.trim() || source.url,
        sourceDetailUrl: descriptor.ApplyURI?.[0] || descriptor.PositionURI?.trim() || source.url,
        publishedAt: descriptor.PublicationStartDate ?? null,
        keywords: [
          descriptor.OrganizationName,
          descriptor.DepartmentName,
          descriptor.PositionLocationDisplay,
          "usajobs",
          "puerto rico",
        ].filter((value): value is string => Boolean(value && value.trim())),
        tags: ["jobs", "federal", "puerto-rico"],
        naicsCodes,
        detailPayload: {
          positionId: descriptor.PositionID ?? null,
          organizationName: descriptor.OrganizationName ?? null,
          departmentName: descriptor.DepartmentName ?? null,
          positionLocationDisplay: descriptor.PositionLocationDisplay ?? null,
          applicationCloseDate: descriptor.ApplicationCloseDate ?? null,
          publicationStartDate: descriptor.PublicationStartDate ?? null,
          applyUri: descriptor.ApplyURI ?? [],
        },
      } satisfies IngestedOpportunity;
    }) as Array<IngestedOpportunity | null>)
    .filter((item): item is IngestedOpportunity => item !== null);

  return {
    status: "success",
    items,
  };
}
