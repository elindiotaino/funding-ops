import { fetchJson } from "../http.js";
import type { SourceDefinition } from "../source-registry.js";
import type { AdapterRunResult, IngestedOpportunity } from "../types.js";
import { classifyNaicsCodes } from "./naics-classification.js";

type SamAssistanceResponse = {
  assistanceListingsData?: Array<{
    assistanceListingId?: string;
    title?: string;
    status?: string;
    publishedDate?: string;
    popularLongName?: string | null;
    popularShortName?: string | null;
    programWebPage?: string | null;
    overview?: {
      objective?: string | null;
      assistanceListingDescription?: string | null;
      examplesOfFundedProjects?: string | null;
      applicantEligibility?: string | null;
      beneficiaryEligibility?: string | null;
    };
    federalOrganization?: {
      department?: string | null;
      agency?: string | null;
      office?: string | null;
    };
    applicantTypes?: Array<{
      code?: string;
      name?: string;
    }>;
    beneficiaryTypes?: Array<{
      code?: string;
      name?: string;
    }>;
    assistanceTypes?: Array<{
      code?: string;
      name?: string;
    }>;
  }>;
};

function getSamApiKey() {
  return process.env.SAM_API_KEY?.trim() || "";
}

export async function runSamAssistanceAdapter(source: SourceDefinition): Promise<AdapterRunResult> {
  const apiKey = getSamApiKey();
  if (!apiKey) {
    return {
      status: "skipped",
      reason: "SAM_API_KEY is not configured.",
    };
  }

  const url = new URL("https://api.sam.gov/assistance-listings/v1/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("status", "Active");
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("pageNumber", "1");
  url.searchParams.set("publishedDateFrom", "2025-01-01");
  url.searchParams.set("publishedDateTo", new Date().toISOString().slice(0, 10));

  const response = await fetchJson<SamAssistanceResponse>(url.toString());

  const items = ((response.assistanceListingsData ?? [])
    .map((item) => {
      const sourceItemId = item.assistanceListingId?.trim();
      const title = item.title?.trim();

      if (!sourceItemId || !title) {
        return null;
      }

      const applicantTypes = (item.applicantTypes ?? [])
        .map((entry) => entry.name?.trim())
        .filter((entry): entry is string => Boolean(entry));

      const beneficiaryTypes = (item.beneficiaryTypes ?? [])
        .map((entry) => entry.name?.trim())
        .filter((entry): entry is string => Boolean(entry));

      const assistanceTypes = (item.assistanceTypes ?? [])
        .map((entry) => entry.name?.trim())
        .filter((entry): entry is string => Boolean(entry));

      const organization = [
        item.federalOrganization?.department,
        item.federalOrganization?.agency,
        item.federalOrganization?.office,
      ]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(" / ");

      const summary =
        item.overview?.assistanceListingDescription?.trim() ||
        item.overview?.objective?.trim() ||
        item.popularLongName?.trim() ||
        item.popularShortName?.trim() ||
        null;
      const naicsCodes = classifyNaicsCodes({
        text: [
          title,
          summary,
          item.overview?.applicantEligibility,
          item.overview?.beneficiaryEligibility,
          item.overview?.examplesOfFundedProjects,
          organization,
          ...applicantTypes,
          ...beneficiaryTypes,
          ...assistanceTypes,
        ],
        hints: assistanceTypes.some((value) => value.toLowerCase().includes("grant"))
          ? ["54", "61", "62"]
          : undefined,
      });

      return {
        sourceItemId,
        canonicalKey: `${source.key}:${sourceItemId}`,
        title,
        category: "aid",
        jurisdiction: source.jurisdiction,
        audience: applicantTypes.join(", ") || beneficiaryTypes.join(", ") || null,
        summary,
        eligibility:
          item.overview?.applicantEligibility?.trim() ||
          item.overview?.beneficiaryEligibility?.trim() ||
          null,
        amount: null,
        deadline: null,
        geography: "United States including Puerto Rico",
        status: item.status?.toLowerCase() || "active",
        sourceUrl: item.programWebPage?.trim() || `https://sam.gov/assistance-listings/${encodeURIComponent(sourceItemId)}`,
        sourceDetailUrl: item.programWebPage?.trim() || null,
        publishedAt: item.publishedDate ?? null,
        keywords: [
          sourceItemId,
          ...applicantTypes,
          ...beneficiaryTypes,
          ...assistanceTypes,
          organization,
          "sam.gov assistance listings",
        ].filter((value): value is string => Boolean(value && value.trim())),
        tags: ["federal", "aid", "sam-assistance", ...assistanceTypes.map((value) => value.toLowerCase())],
        naicsCodes,
        detailPayload: {
          organization,
          applicantTypes,
          beneficiaryTypes,
          assistanceTypes,
          objective: item.overview?.objective ?? null,
          examplesOfFundedProjects: item.overview?.examplesOfFundedProjects ?? null,
          programWebPage: item.programWebPage ?? null,
        },
      } satisfies IngestedOpportunity;
    }) as Array<IngestedOpportunity | null>)
    .filter((item): item is IngestedOpportunity => item !== null);

  return {
    status: "success",
    items,
  };
}
