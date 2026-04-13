import { postJson } from "../http.js";
import type { SourceDefinition } from "../source-registry.js";
import type { AdapterRunResult, IngestedOpportunity } from "../types.js";
import { classifyNaicsCodes } from "./naics-classification.js";

type SimplerSearchResponse = {
  data?: Array<{
    opportunity_id?: string;
    opportunity_number?: string;
    opportunity_title?: string;
    agency_name?: string;
    agency_code?: string;
    summary_description?: string;
    applicant_types?: string[];
    funding_instrument?: string[];
    close_date?: string | null;
    post_date?: string | null;
    opportunity_status?: string | null;
  }>;
};

function getSimplerApiKey() {
  return process.env.SIMPLER_GRANTS_API_KEY?.trim() || "";
}

export async function runSimplerGrantsAdapter(source: SourceDefinition): Promise<AdapterRunResult> {
  const apiKey = getSimplerApiKey();
  if (!apiKey) {
    return {
      status: "skipped",
      reason: "SIMPLER_GRANTS_API_KEY is not configured.",
    };
  }

  const response = await postJson<SimplerSearchResponse>(
    "https://api.simpler.grants.gov/v1/opportunities/search",
    {
      filters: {
        opportunity_status: { one_of: ["posted", "forecasted"] },
      },
      pagination: {
        page_offset: 1,
        page_size: 50,
        sort_order: [
          {
            order_by: "post_date",
            sort_direction: "descending",
          },
        ],
      },
    },
    {
      headers: {
        "X-API-Key": apiKey,
      },
    },
  );

  const items = ((response.data ?? [])
    .map((item) => {
      const sourceItemId = item.opportunity_id?.trim();
      const title = item.opportunity_title?.trim();

      if (!sourceItemId || !title) {
        return null;
      }

      const naicsCodes = classifyNaicsCodes({
        text: [
          title,
          item.summary_description,
          item.agency_name,
          ...(item.applicant_types ?? []),
          ...(item.funding_instrument ?? []),
        ],
        hints: item.funding_instrument?.some((value) => value.toLowerCase().includes("grant"))
          ? ["54", "61", "62"]
          : undefined,
      });

      return {
        sourceItemId,
        canonicalKey: `${source.key}:${sourceItemId}`,
        title,
        category: "grants",
        jurisdiction: source.jurisdiction,
        audience: item.applicant_types?.join(", ") || "Organizations and applicants supported by the opportunity",
        summary: item.summary_description?.trim() || null,
        eligibility: item.applicant_types?.join(", ") || null,
        amount: null,
        deadline: item.close_date ?? null,
        geography: "United States",
        status: item.opportunity_status?.toLowerCase() || "posted",
        sourceUrl: item.opportunity_number
          ? `https://simpler.grants.gov/opportunity/${encodeURIComponent(item.opportunity_number)}`
          : source.url,
        sourceDetailUrl: `https://api.simpler.grants.gov/v1/opportunities/${encodeURIComponent(sourceItemId)}`,
        publishedAt: item.post_date ?? null,
        keywords: [
          item.agency_name,
          item.agency_code,
          item.opportunity_number,
          ...(item.funding_instrument ?? []),
          "simpler grants",
        ].filter((value): value is string => Boolean(value && value.trim())),
        tags: ["federal", "grants", "api", item.opportunity_status?.toLowerCase() || "unknown"].filter(Boolean),
        naicsCodes,
        detailPayload: {
          opportunityNumber: item.opportunity_number ?? null,
          agencyName: item.agency_name ?? null,
          agencyCode: item.agency_code ?? null,
          fundingInstrument: item.funding_instrument ?? [],
          applicantTypes: item.applicant_types ?? [],
          postDate: item.post_date ?? null,
          closeDate: item.close_date ?? null,
        },
      } satisfies IngestedOpportunity;
    }) as Array<IngestedOpportunity | null>)
    .filter((item): item is IngestedOpportunity => item !== null);

  return {
    status: "success",
    items,
  };
}
