import { postJson } from "../http.js";
import type { SourceDefinition } from "../source-registry.js";
import type { AdapterRunResult, IngestedOpportunity, RefreshScope } from "../types.js";
import { classifyNaicsCodes } from "./naics-classification.js";

type GrantsGovSearchResponse = {
  data?: {
    oppHits?: GrantsGovOpportunity[];
  };
  msg?: string;
  errorcode?: number;
};

type GrantsGovOpportunity = {
      id?: string;
      number?: string;
      title?: string;
      agencyCode?: string;
      agencyName?: string;
      openDate?: string;
      closeDate?: string;
      oppStatus?: string;
      docType?: string;
      alnist?: string[];
};

function normalizeDate(value?: string) {
  if (!value) {
    return null;
  }

  const iso = new Date(value);
  if (Number.isNaN(iso.getTime())) {
    return value;
  }

  return iso.toISOString();
}

function toOpportunity(source: SourceDefinition, item: GrantsGovOpportunity): IngestedOpportunity | null {
  const sourceItemId = item.id?.trim() || item.number?.trim();
  if (!sourceItemId || !item.title?.trim()) {
    return null;
  }

  const agency = item.agencyName?.trim() || item.agencyCode?.trim() || "Unknown agency";
  const summary = `Opportunity published by ${agency}${item.docType ? ` as ${item.docType}` : ""}.`;
  const tags = ["federal", "grants", item.oppStatus?.toLowerCase() || "unknown"].filter(Boolean);
  const keywords = [
    agency,
    item.agencyCode,
    ...(item.alnist ?? []),
    "grants.gov",
    item.oppStatus,
  ].filter((value): value is string => Boolean(value && value.trim()));
  const naicsCodes = classifyNaicsCodes({
    text: [item.title, summary, agency, ...(item.alnist ?? [])],
    hints: item.docType?.toLowerCase().includes("grant") ? ["54", "61", "62"] : undefined,
  });

  return {
    sourceItemId,
    canonicalKey: `${source.key}:${sourceItemId}`,
    title: item.title.trim(),
    category: "grants",
    jurisdiction: source.jurisdiction,
    audience: "Organizations, nonprofits, municipalities, and operators",
    summary,
    eligibility: null,
    amount: null,
    deadline: item.closeDate?.trim() || null,
    geography: "United States",
    status: item.oppStatus?.toLowerCase() || "posted",
    sourceUrl: item.number
      ? `https://www.grants.gov/search-results-detail/${encodeURIComponent(item.number)}`
      : source.url,
    sourceDetailUrl: item.number
      ? `https://www.grants.gov/search-results-detail/${encodeURIComponent(item.number)}`
      : source.url,
    publishedAt: normalizeDate(item.openDate),
    keywords,
    tags,
    naicsCodes,
    detailPayload: {
      agencyName: item.agencyName ?? null,
      agencyCode: item.agencyCode ?? null,
      opportunityNumber: item.number ?? null,
      alnList: item.alnist ?? [],
      openDate: item.openDate ?? null,
      closeDate: item.closeDate ?? null,
      opportunityStatus: item.oppStatus ?? null,
      documentType: item.docType ?? null,
    },
  };
}

export async function runGrantsGovAdapter(
  source: SourceDefinition,
  scope?: RefreshScope,
): Promise<AdapterRunResult> {
  const keyword = scope?.keywords.slice(0, 4).join(" ") ?? "";
  const payload = {
    rows: 50,
    startRecordNum: 0,
    oppStatuses: "forecasted|posted",
    agencies: "",
    fundingCategories: "",
    eligibilities: "",
    keyword,
    aln: "",
  };

  const response = await postJson<GrantsGovSearchResponse>("https://api.grants.gov/v1/api/search2", payload);
  const hits = response.data?.oppHits ?? [];

  const items = hits
    .map((item) => toOpportunity(source, item))
    .filter((item): item is IngestedOpportunity => item !== null);

  return {
    status: "success",
    items,
  };
}
