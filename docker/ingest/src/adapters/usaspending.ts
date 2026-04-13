import { postJson } from "../http.js";
import type { SourceDefinition } from "../source-registry.js";
import type { AdapterRunResult, IngestedOpportunity } from "../types.js";
import { classifyNaicsCodes } from "./naics-classification.js";

type UsaSpendingResponse = {
  results?: Array<{
    "Award ID"?: string;
    "Recipient Name"?: string;
    "Start Date"?: string;
    "End Date"?: string;
    "Award Amount"?: number | string;
    "Awarding Agency"?: string;
    "Awarding Sub Agency"?: string;
    "Award Type"?: string;
    "Funding Agency"?: string;
    "Funding Sub Agency"?: string;
    generated_internal_id?: string;
  }>;
  page_metadata?: {
    page?: number;
    limit?: number;
    hasNext?: boolean;
  };
};

function formatAmount(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return `$${numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }

  return String(value);
}

export async function runUsaSpendingAdapter(source: SourceDefinition): Promise<AdapterRunResult> {
  const response = await postJson<UsaSpendingResponse>("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    filters: {
      award_type_codes: ["02", "03"],
      recipient_scope: "domestic",
      place_of_performance_scope: "domestic",
      place_of_performance_locations: [
        {
          country: "USA",
          state: "PR",
        },
      ],
      time_period: [
        {
          start_date: "2025-01-01",
          end_date: new Date().toISOString().slice(0, 10),
        },
      ],
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Start Date",
      "End Date",
      "Award Amount",
      "Awarding Agency",
      "Awarding Sub Agency",
      "Award Type",
      "Funding Agency",
      "Funding Sub Agency",
    ],
    sort: "Award Amount",
    order: "desc",
    page: 1,
    limit: 25,
  });

  const items = ((response.results ?? [])
    .map((item) => {
      const sourceItemId = item.generated_internal_id?.trim() || item["Award ID"]?.trim();
      const title =
        item["Recipient Name"]?.trim() && item["Award Type"]?.trim()
          ? `${item["Recipient Name"]!.trim()} ${item["Award Type"]!.trim()} Award`
          : item["Award ID"]?.trim() || null;

      if (!sourceItemId || !title) {
        return null;
      }

      const naicsCodes = classifyNaicsCodes({
        text: [
          title,
          item["Recipient Name"],
          item["Awarding Agency"],
          item["Awarding Sub Agency"],
          item["Funding Agency"],
          item["Funding Sub Agency"],
          item["Award Type"],
        ],
        hints: ["54", "52"],
      });

      return {
        sourceItemId,
        canonicalKey: `${source.key}:${sourceItemId}`,
        title,
        category: "award-intelligence",
        jurisdiction: source.jurisdiction,
        audience: "Business development, grant analysts, policy operators",
        summary: `USAspending award intelligence for Puerto Rico recipients or place of performance. Awarding agency: ${item["Awarding Agency"] ?? "Unknown"}.`,
        eligibility: null,
        amount: formatAmount(item["Award Amount"]),
        deadline: item["End Date"] ?? null,
        geography: "Puerto Rico",
        status: "awarded",
        sourceUrl: item["Award ID"]
          ? `https://www.usaspending.gov/award/${encodeURIComponent(item["Award ID"])}`
          : source.url,
        sourceDetailUrl: item["Award ID"]
          ? `https://www.usaspending.gov/award/${encodeURIComponent(item["Award ID"])}`
          : source.url,
        publishedAt: item["Start Date"] ?? null,
        keywords: [
          item["Award ID"],
          item["Recipient Name"],
          item["Awarding Agency"],
          item["Awarding Sub Agency"],
          item["Funding Agency"],
          item["Funding Sub Agency"],
          item["Award Type"],
          "puerto rico",
          "usaspending",
        ].filter((value): value is string => Boolean(value && value.trim())),
        tags: ["awards", "analytics", "puerto-rico", "federal"],
        naicsCodes,
        detailPayload: {
          awardId: item["Award ID"] ?? null,
          recipientName: item["Recipient Name"] ?? null,
          awardAmount: item["Award Amount"] ?? null,
          awardingAgency: item["Awarding Agency"] ?? null,
          awardingSubAgency: item["Awarding Sub Agency"] ?? null,
          fundingAgency: item["Funding Agency"] ?? null,
          fundingSubAgency: item["Funding Sub Agency"] ?? null,
          startDate: item["Start Date"] ?? null,
          endDate: item["End Date"] ?? null,
          awardType: item["Award Type"] ?? null,
        },
      } satisfies IngestedOpportunity;
    }) as Array<IngestedOpportunity | null>)
    .filter((item): item is IngestedOpportunity => item !== null);

  return {
    status: "success",
    items,
  };
}
