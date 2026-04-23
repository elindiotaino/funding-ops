import { sqlite } from "@/db";
import {
  isOpportunityEvaluated,
  isOpportunityUnevaluated,
  listUserOpportunityStates,
  type OpportunityStateValue,
  type UserOpportunityStateRecord,
} from "@/lib/opportunity-state";
import {
  findCompatibleNaicsCodes,
  formatNaicsLabel,
  getNaicsKeywords,
  hasCompatibleNaicsCodes,
  inferNaicsCodesFromText,
} from "@/lib/naics";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServiceRoleEnv } from "@/lib/supabase/env";

type SourceSeed = {
  key: string;
  name: string;
  url: string;
  jurisdiction: string;
  interfaceType: string;
  programTypes: string[];
  updateCadence: string;
  summary: string;
};

type FeedItemSeed = {
  key: string;
  sourceKey: string;
  title: string;
  category: string;
  jurisdiction: string;
  audience: string;
  summary: string;
  eligibility: string;
  amount: string | null;
  deadline: string | null;
  geography: string;
  status: string;
  url: string;
  keywords: string[];
  tags: string[];
};

export type CompanyProfileInput = {
  companyName: string;
  companySummary: string;
  geography: string;
  naicsCodes: string[];
  sectors: string[];
  assistanceTypes: string[];
  keywords: string[];
  notificationMode: string;
  notificationEmail: string;
  dailySummaryEnabled: boolean;
  emailCategories: string[];
  emailJurisdictions: string[];
  emailTags: string[];
};

export type RawCompanyProfile = CompanyProfileInput & {
  id: number;
  updatedAt: string;
  lastDailySummaryAt: string | null;
};

export type RawFeedItem = {
  id: number | string;
  itemKey: string;
  sourceKey: string;
  title: string;
  category: string;
  jurisdiction: string;
  audience: string;
  summary: string;
  eligibility: string;
  amount: string | null;
  deadline: string | null;
  geography: string;
  status: string;
  url: string;
  keywords: string[];
  tags: string[];
  naicsCodes: string[];
  updatedAt: string;
  createdAt: string;
};

type RawSource = {
  id: number | string;
  sourceKey: string;
  name: string;
  url: string;
  jurisdiction: string;
  interfaceType: string;
  programTypes: string[];
  updateCadence: string;
  summary: string;
  lastSyncedAt: string | null;
};

type RawNotification = {
  id: number | string;
  itemKey: string;
  title: string;
  message: string;
  relevanceScore: number;
  reasons: string[];
  createdAt: string;
  readAt: string | null;
};

type RawIngestionRun = {
  id: number | string;
  status: string;
  triggeredBy: string;
  notes: string | null;
  sourcesUpserted: number;
  itemsUpserted: number;
  createdAt: string;
};

export type ScoredItem = RawFeedItem & {
  relevanceScore: number;
  reasons: string[];
  opportunityState: {
    state: OpportunityStateValue;
    decisionReason: string | null;
    decisionNote: string | null;
    appliedAt: string | null;
    followUpAt: string | null;
    archivedAt: string | null;
    updatedAt: string | null;
  } | null;
};

export type FundingWorkspaceData = {
  sources: RawSource[];
  items: ScoredItem[];
  notifications: RawNotification[];
  profile: RawCompanyProfile;
  refreshScope: {
    naicsCodes: string[];
  };
  filters: {
    categories: string[];
    jurisdictions: string[];
    tags: string[];
    naicsCodes: string[];
  };
  history: {
    availableSnapshotDates: string[];
    selectedSnapshotDate: string | null;
    selectedSourceKeys: string[];
  };
  metrics: {
    totalSources: number;
    totalItems: number;
    unevaluatedItems: number;
    evaluatedItems: number;
    appliedItems: number;
    reviewReasons: Array<{
      reason: string;
      count: number;
    }>;
    totalNotifications: number;
    highlyRelevantItems: number;
    sourcesDueForRefresh: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  lastIngestionRun: RawIngestionRun | null;
};

type FundingWorkspaceOptions = {
  page?: number;
  pageSize?: number;
  snapshotDate?: string;
  sourceKeys?: string[];
  viewerProfileId?: string;
};

type OpportunityFeedbackProfile = {
  currentStateByItemId: Map<string, UserOpportunityStateRecord>;
  positiveTokenWeights: Map<string, number>;
  negativeTokenWeights: Map<string, number>;
  positiveCategories: Set<string>;
  negativeCategories: Set<string>;
  positiveJurisdictions: Set<string>;
  negativeJurisdictions: Set<string>;
  positiveSourceKeys: Set<string>;
  negativeSourceKeys: Set<string>;
  positiveNaicsCodes: Set<string>;
  negativeNaicsCodes: Set<string>;
};

export const defaultProfile: CompanyProfileInput = {
  companyName: "Puerto Rico Opportunity Desk",
  companySummary:
    "Small organization seeking grants, assistance programs, jobs, incentives, and recovery opportunities relevant to Puerto Rico operations.",
  geography: "Puerto Rico",
  naicsCodes: [],
  sectors: ["Small business", "Community programs", "Disability entrepreneurship"],
  assistanceTypes: ["Grants", "Technical assistance", "Jobs", "Recovery funding"],
  keywords: ["Puerto Rico", "small business", "entrepreneurship", "resilience", "grants"],
  notificationMode: "digest",
  notificationEmail: "",
  dailySummaryEnabled: false,
  emailCategories: [],
  emailJurisdictions: [],
  emailTags: [],
};

function nowIso() {
  return new Date().toISOString();
}

function parseArray(value: unknown) {
  if (!value) {
    return [] as string[];
  }

  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
    );
  }

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function isMissingColumnError(error: { message?: string } | null | undefined, columnName: string) {
  return Boolean(error?.message?.toLowerCase().includes(columnName.toLowerCase()));
}

function stringifyArray(values: string[]) {
  return JSON.stringify(values.map((value) => value.trim()).filter(Boolean));
}

function normalizeTokens(values: string[]) {
  return values
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/i))
    .map((value) => value.trim())
    .filter((value) => value.length >= 3);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ignoredFeedbackTokens = new Set([
  "grant",
  "grants",
  "funding",
  "program",
  "programs",
  "opportunity",
  "opportunities",
  "application",
  "apply",
  "applied",
  "review",
  "state",
  "item",
  "items",
  "good",
  "great",
  "strong",
  "match",
  "fits",
  "does",
  "doesn",
  "work",
  "need",
  "needs",
  "account",
  "business",
]);

function filterFeedbackTokens(tokens: string[]) {
  return tokens.filter((token) => token.length >= 4 && !ignoredFeedbackTokens.has(token));
}

const sourceSeeds: SourceSeed[] = [
  {
    key: "grants-gov",
    name: "Grants.gov",
    url: "https://www.grants.gov/",
    jurisdiction: "U.S. Federal",
    interfaceType: "API + RSS + daily XML export",
    programTypes: ["Grants"],
    updateCadence: "Daily baseline plus incremental opportunity updates",
    summary: "Primary federal grants portal with public search endpoints, feeds, and daily XML extracts.",
  },
  {
    key: "simpler-grants",
    name: "Simpler.Grants.gov",
    url: "https://simpler.grants.gov/developers",
    jurisdiction: "U.S. Federal",
    interfaceType: "API",
    programTypes: ["Grants"],
    updateCadence: "Near-real-time opportunity API within published rate limits",
    summary: "Modern grants API gateway intended for programmatic opportunity search and detail retrieval.",
  },
  {
    key: "sam-assistance",
    name: "SAM.gov Assistance Listings",
    url: "https://sam.gov/assistance-listings",
    jurisdiction: "U.S. Federal",
    interfaceType: "API + UI",
    programTypes: ["Grants", "Aid"],
    updateCadence: "Slow-changing catalog, best synced daily as deltas",
    summary: "Structured assistance program catalog covering grants, loans, scholarships, insurance, and other aid.",
  },
  {
    key: "usajobs",
    name: "USAJOBS",
    url: "https://developer.usajobs.gov/",
    jurisdiction: "U.S. Federal",
    interfaceType: "API",
    programTypes: ["Jobs"],
    updateCadence: "High-churn jobs feed, suited for multiple daily checks",
    summary: "Federal jobs platform with programmatic search for active announcements and hiring metadata.",
  },
  {
    key: "usaspending",
    name: "USAspending.gov",
    url: "https://api.usaspending.gov/",
    jurisdiction: "U.S. Federal",
    interfaceType: "API + bulk download",
    programTypes: ["Award intelligence", "Aid"],
    updateCadence: "Daily or weekly award intelligence sync",
    summary: "Downstream transparency data for where financial assistance and awards actually flow.",
  },
  {
    key: "openfema",
    name: "OpenFEMA",
    url: "https://gis.fema.gov/arcgis/rest/services/FEMA/IPAWS_Archive/MapServer/info/iteminfo?f=pjson",
    jurisdiction: "U.S. Federal",
    interfaceType: "API",
    programTypes: ["Aid", "Disaster data"],
    updateCadence: "Daily dataset polling with conservative host throttling",
    summary: "Open disaster and assistance datasets relevant to Puerto Rico emergency and recovery workflows.",
  },
  {
    key: "empleos-pr",
    name: "Empleos.pr.gov",
    url: "https://www.empleos.pr.gov/",
    jurisdiction: "Puerto Rico",
    interfaceType: "Structured HTML",
    programTypes: ["Jobs"],
    updateCadence: "Every few hours for new postings and closing dates",
    summary: "Central government job portal with stable, labeled detail pages for public employment opportunities.",
  },
  {
    key: "adsef",
    name: "ADSEF Servicios en Linea",
    url: "https://serviciosenlinea.adsef.pr.gov/",
    jurisdiction: "Puerto Rico",
    interfaceType: "Structured HTML + linked documents",
    programTypes: ["Aid"],
    updateCadence: "Daily document and notice monitoring",
    summary: "Puerto Rico assistance portal covering PAN, TANF, LIHEAP-linked support, and related resident programs.",
  },
  {
    key: "cdbg-recuperacion",
    name: "Recuperacion CDBG-DR/MIT",
    url: "https://recuperacion.pr.gov/programas/",
    jurisdiction: "Puerto Rico",
    interfaceType: "Structured HTML + document CDN",
    programTypes: ["Aid", "Recovery funding"],
    updateCadence: "Daily NOFA, subasta, and document monitoring",
    summary: "Recovery funding and program pages for CDBG-DR and CDBG-MIT initiatives in Puerto Rico.",
  },
  {
    key: "afv",
    name: "AFV / Puerto Rico Housing Finance Authority",
    url: "https://www.afv.pr.gov/home/",
    jurisdiction: "Puerto Rico",
    interfaceType: "Structured HTML + public notices",
    programTypes: ["Aid", "Housing programs"],
    updateCadence: "Daily notice and action-plan checks",
    summary: "Housing finance authority notices, action plans, and public funding program materials.",
  },
  {
    key: "ddec",
    name: "DDEC Program Pages",
    url: "https://incentives.ddec.pr.gov/",
    jurisdiction: "Puerto Rico",
    interfaceType: "HTML + authenticated portal",
    programTypes: ["Incentives", "Aid"],
    updateCadence: "Daily monitoring of public-facing program information",
    summary: "Economic development and incentive program entrypoint for Puerto Rico business support and submissions.",
  },
];

const feedSeeds: FeedItemSeed[] = [
  {
    key: "federal-grants-opportunity-feed",
    sourceKey: "grants-gov",
    title: "Federal Grants Opportunity Feed",
    category: "grants",
    jurisdiction: "U.S. Federal",
    audience: "Organizations, nonprofits, municipalities, and operators",
    summary: "Baseline opportunity stream for competitive federal grants with daily XML and incremental updates.",
    eligibility: "Best for organizations applying for open federal opportunities rather than individual benefits.",
    amount: "Varies by opportunity",
    deadline: null,
    geography: "National + Puerto Rico relevant opportunities",
    status: "active",
    url: "https://www.grants.gov/xml-extract",
    keywords: ["grants", "federal", "opportunities", "Puerto Rico", "organizations"],
    tags: ["federal", "grants", "daily-sync", "official-api"],
  },
  {
    key: "simpler-grants-api-stream",
    sourceKey: "simpler-grants",
    title: "Simpler.Grants.gov Opportunity API Stream",
    category: "grants",
    jurisdiction: "U.S. Federal",
    audience: "Developers, grant analysts, funding operators",
    summary: "API-native search stream for opportunity detail retrieval and app-level filtering.",
    eligibility: "Requires API onboarding for production traffic and higher throughput.",
    amount: null,
    deadline: null,
    geography: "National + Puerto Rico relevant opportunities",
    status: "active",
    url: "https://wiki.simpler.grants.gov/product/api",
    keywords: ["grants", "api", "search", "federal", "developer"],
    tags: ["federal", "grants", "api", "search"],
  },
  {
    key: "sam-assistance-program-catalog",
    sourceKey: "sam-assistance",
    title: "SAM Assistance Program Catalog",
    category: "aid",
    jurisdiction: "U.S. Federal",
    audience: "Residents, businesses, nonprofits, and local governments",
    summary: "Structured assistance listing catalog for grants, loans, scholarships, insurance, and other support programs.",
    eligibility: "Eligibility varies per listing and should be filtered by sector, geography, and assistance type.",
    amount: "Program specific",
    deadline: null,
    geography: "National including Puerto Rico",
    status: "active",
    url: "https://open.gsa.gov/api/assistance-listings-api/",
    keywords: ["assistance", "catalog", "loans", "scholarships", "insurance", "Puerto Rico"],
    tags: ["federal", "aid", "catalog", "assistance"],
  },
  {
    key: "federal-jobs-puerto-rico-remote",
    sourceKey: "usajobs",
    title: "Federal Jobs for Puerto Rico and Remote Workers",
    category: "jobs",
    jurisdiction: "U.S. Federal",
    audience: "Job seekers in Puerto Rico and remote candidates",
    summary: "Track high-churn federal jobs, hiring paths, and announcements relevant to Puerto Rico and remote work.",
    eligibility: "Depends on each job announcement and hiring path.",
    amount: "Salary varies",
    deadline: null,
    geography: "Puerto Rico + remote eligible",
    status: "active",
    url: "https://data.usajobs.gov/api/Search?Page=1&ResultsPerPage=250",
    keywords: ["jobs", "federal", "Puerto Rico", "remote", "hiring"],
    tags: ["jobs", "federal", "Puerto Rico", "remote"],
  },
  {
    key: "award-intelligence-puerto-rico",
    sourceKey: "usaspending",
    title: "Puerto Rico Award Intelligence Feed",
    category: "award-intelligence",
    jurisdiction: "U.S. Federal",
    audience: "Business development, grant analysts, policy operators",
    summary: "Use USAspending to understand where assistance dollars are flowing in Puerto Rico and which recipients are winning awards.",
    eligibility: "Best for market intelligence and targeting, not direct application intake.",
    amount: "Award-specific",
    deadline: null,
    geography: "Puerto Rico",
    status: "active",
    url: "https://api.usaspending.gov/docs/endpoints",
    keywords: ["awards", "recipients", "Puerto Rico", "intelligence", "federal spending"],
    tags: ["awards", "analytics", "Puerto Rico", "federal"],
  },
  {
    key: "disaster-assistance-signals",
    sourceKey: "openfema",
    title: "Disaster Assistance and Recovery Signals",
    category: "aid",
    jurisdiction: "U.S. Federal",
    audience: "Municipal teams, resilience operators, emergency support programs",
    summary: "Monitor disaster declarations, archived alerts, and assistance datasets relevant to Puerto Rico recovery and resilience work.",
    eligibility: "Relevant when recovery, resilience, or disaster support is part of the target profile.",
    amount: null,
    deadline: null,
    geography: "Puerto Rico",
    status: "active",
    url: "https://gis.fema.gov/arcgis/rest/services/FEMA/IPAWS_Archive/MapServer/info/iteminfo?f=pjson",
    keywords: ["disaster", "recovery", "resilience", "FEMA", "Puerto Rico"],
    tags: ["aid", "recovery", "resilience", "Puerto Rico"],
  },
  {
    key: "pr-government-jobs-convocatorias",
    sourceKey: "empleos-pr",
    title: "Puerto Rico Government Job Convocatorias",
    category: "jobs",
    jurisdiction: "Puerto Rico",
    audience: "Residents and public-sector applicants",
    summary: "Government convocatorias with labeled details, closing dates, and downloadable posting materials.",
    eligibility: "Job specific and often split between internal and external postings.",
    amount: "Salary varies by convocatoria",
    deadline: null,
    geography: "Puerto Rico",
    status: "active",
    url: "https://www.empleos.pr.gov/",
    keywords: ["jobs", "convocatorias", "government", "Puerto Rico", "employment"],
    tags: ["jobs", "Puerto Rico", "government", "convocatorias"],
  },
  {
    key: "adsef-family-assistance-programs",
    sourceKey: "adsef",
    title: "ADSEF Family Assistance Program Updates",
    category: "aid",
    jurisdiction: "Puerto Rico",
    audience: "Residents, families, and community support providers",
    summary: "Program monitoring for PAN, TANF, LIHEAP-linked energy support, and related resident assistance pages and documents.",
    eligibility: "Program specific, primarily resident and household assistance.",
    amount: "Program specific",
    deadline: null,
    geography: "Puerto Rico",
    status: "active",
    url: "https://serviciosenlinea.adsef.pr.gov/",
    keywords: ["ADSEF", "PAN", "TANF", "LIHEAP", "family assistance"],
    tags: ["aid", "Puerto Rico", "family", "energy", "resident"],
  },
  {
    key: "cdbg-recovery-nofas",
    sourceKey: "cdbg-recuperacion",
    title: "CDBG-DR / MIT Recovery NOFAs and Program Notices",
    category: "recovery-funding",
    jurisdiction: "Puerto Rico",
    audience: "Municipalities, businesses, residents, contractors, and subrecipients",
    summary: "Recovery portal monitoring for NOFAs, procurement notices, plans, and mitigation or disaster-recovery programs.",
    eligibility: "Varies by recovery program, subrecipient role, and NOFA terms.",
    amount: "Program specific",
    deadline: null,
    geography: "Puerto Rico",
    status: "active",
    url: "https://recuperacion.pr.gov/programas/",
    keywords: ["CDBG", "recovery", "mitigation", "NOFA", "Puerto Rico"],
    tags: ["recovery", "housing", "Puerto Rico", "NOFA", "mitigation"],
  },
  {
    key: "housing-finance-notices",
    sourceKey: "afv",
    title: "AFV Housing Finance Notices and Action Plans",
    category: "housing-aid",
    jurisdiction: "Puerto Rico",
    audience: "Residents, housing operators, developers, and support organizations",
    summary: "Housing authority notices, action plans, and buyer or development support materials.",
    eligibility: "Housing-specific and income or project specific.",
    amount: "Program specific",
    deadline: null,
    geography: "Puerto Rico",
    status: "active",
    url: "https://www.afv.pr.gov/home/",
    keywords: ["housing", "action plan", "home", "Puerto Rico", "finance authority"],
    tags: ["housing", "Puerto Rico", "aid", "notices"],
  },
  {
    key: "ddec-business-incentives",
    sourceKey: "ddec",
    title: "DDEC Business Incentives and Capital Programs",
    category: "incentives",
    jurisdiction: "Puerto Rico",
    audience: "Small businesses, founders, and growth-stage operators",
    summary: "Track public DDEC program pages and incentives that may matter to Puerto Rico businesses and entrepreneurs.",
    eligibility: "Business specific, often tied to incentive rules or sector-specific qualification.",
    amount: "Varies",
    deadline: null,
    geography: "Puerto Rico",
    status: "active",
    url: "https://incentives.ddec.pr.gov/",
    keywords: ["DDEC", "incentives", "business", "capital semilla", "Puerto Rico"],
    tags: ["business", "Puerto Rico", "incentives", "entrepreneurship"],
  },
];

function buildSearchableText(item: RawFeedItem) {
  return normalizeText(
    [
      item.title,
      item.summary,
      item.eligibility,
      item.category,
      item.jurisdiction,
      item.audience,
      item.geography,
      item.status,
      ...item.naicsCodes,
      ...item.tags,
      ...item.keywords,
    ].join(" "),
  );
}

function buildReviewReasonCounts(items: ScoredItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const reason = item.opportunityState?.decisionReason?.trim();
    if (!reason) {
      continue;
    }

    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, 5);
}

async function loadSupabaseFeedItemsByIds(feedItemIds: string[]) {
  if (!hasSupabaseServiceRoleEnv() || feedItemIds.length === 0) {
    return [] as RawFeedItem[];
  }

  const supabase = getSupabaseAdminClient();
  const { data: sourceRows, error: sourceError } = await supabase
    .from("official_sources")
    .select("id, source_key");

  if (sourceError) {
    throw sourceError;
  }

  const sourceIdToKey = new Map(
    (((sourceRows ?? []) as Array<{ id: string; source_key: string }>)).map((row) => [row.id, row.source_key]),
  );

  const rows: Array<Record<string, unknown>> = [];
  const chunkSize = 500;
  for (let index = 0; index < feedItemIds.length; index += chunkSize) {
    const chunk = feedItemIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("feed_items")
      .select(
        "id, source_id, canonical_key, title, category, jurisdiction, audience, summary, eligibility, amount, deadline, geography, status, source_url, keywords, tags, naics_codes, updated_at, created_at",
      )
      .in("id", chunk);

    if (error) {
      throw error;
    }

    rows.push(...(((data ?? []) as unknown) as Array<Record<string, unknown>>));
  }

  return rows.map((item) => ({
    id: item.id as number | string,
    itemKey: String(item.canonical_key),
    sourceKey: sourceIdToKey.get(String(item.source_id)) ?? "unknown-source",
    title: String(item.title),
    category: String(item.category),
    jurisdiction: String(item.jurisdiction),
    audience: String(item.audience ?? ""),
    summary: String(item.summary ?? ""),
    eligibility: String(item.eligibility ?? ""),
    amount: item.amount ? String(item.amount) : null,
    deadline: item.deadline ? String(item.deadline) : null,
    geography: String(item.geography ?? ""),
    status: String(item.status),
    url: String(item.source_url),
    keywords: parseArray(item.keywords),
    tags: parseArray(item.tags),
    naicsCodes: parseArray(item.naics_codes),
    updatedAt: String(item.updated_at ?? nowIso()),
    createdAt: String(item.created_at ?? nowIso()),
  })) satisfies RawFeedItem[];
}

export async function buildOpportunityFeedbackProfile(
  profileId: string | undefined,
  availableItems: RawFeedItem[],
) {
  if (!profileId || !hasSupabaseServiceRoleEnv()) {
    return null;
  }

  const stateRows = await listUserOpportunityStates(profileId);
  if (stateRows.length === 0) {
    return null;
  }

  const itemById = new Map(availableItems.map((item) => [String(item.id), item] satisfies [string, RawFeedItem]));
  const missingIds = stateRows
    .map((row) => row.feedItemId)
    .filter((feedItemId) => !itemById.has(feedItemId));

  if (missingIds.length > 0) {
    const missingItems = await loadSupabaseFeedItemsByIds(Array.from(new Set(missingIds)));
    for (const item of missingItems) {
      itemById.set(String(item.id), item);
    }
  }

  const positiveTokenWeights = new Map<string, number>();
  const negativeTokenWeights = new Map<string, number>();
  const positiveCategories = new Set<string>();
  const negativeCategories = new Set<string>();
  const positiveJurisdictions = new Set<string>();
  const negativeJurisdictions = new Set<string>();
  const positiveSourceKeys = new Set<string>();
  const negativeSourceKeys = new Set<string>();
  const positiveNaicsCodes = new Set<string>();
  const negativeNaicsCodes = new Set<string>();
  const currentStateByItemId = new Map(
    stateRows.map((row) => [row.feedItemId, row] satisfies [string, UserOpportunityStateRecord]),
  );

  function addWeight(map: Map<string, number>, values: string[], amount: number) {
    for (const value of values) {
      map.set(value, (map.get(value) ?? 0) + amount);
    }
  }

  function addSetValues(set: Set<string>, values: string[]) {
    for (const value of values) {
      if (value.trim()) {
        set.add(value);
      }
    }
  }

  const positiveStates = new Set<OpportunityStateValue>(["interested", "applied", "waiting", "won"]);
  const negativeStates = new Set<OpportunityStateValue>(["not-a-fit", "archived"]);

  for (const row of stateRows) {
    const item = itemById.get(row.feedItemId);
    if (!item) {
      continue;
    }

    const weight =
      row.state === "applied" || row.state === "won"
        ? 3
        : row.state === "interested" || row.state === "waiting"
          ? 2
          : row.state === "not-a-fit"
            ? 3
            : row.state === "archived"
              ? 2
              : 0;

    if (weight === 0) {
      continue;
    }

    const feedbackTokens = filterFeedbackTokens(
      normalizeTokens([
        row.decisionReason ?? "",
        row.decisionNote ?? "",
        ...item.tags,
        ...item.keywords,
        item.category,
        item.title,
      ]),
    );

    if (positiveStates.has(row.state)) {
      addWeight(positiveTokenWeights, feedbackTokens, weight);
      addSetValues(positiveCategories, [item.category]);
      addSetValues(positiveJurisdictions, [item.jurisdiction]);
      addSetValues(positiveSourceKeys, [item.sourceKey]);
      addSetValues(positiveNaicsCodes, item.naicsCodes);
      continue;
    }

    if (negativeStates.has(row.state)) {
      addWeight(negativeTokenWeights, feedbackTokens, weight);
      addSetValues(negativeCategories, [item.category]);
      addSetValues(negativeJurisdictions, [item.jurisdiction]);
      addSetValues(negativeSourceKeys, [item.sourceKey]);
      addSetValues(negativeNaicsCodes, item.naicsCodes);
    }
  }

  return {
    currentStateByItemId,
    positiveTokenWeights,
    negativeTokenWeights,
    positiveCategories,
    negativeCategories,
    positiveJurisdictions,
    negativeJurisdictions,
    positiveSourceKeys,
    negativeSourceKeys,
    positiveNaicsCodes,
    negativeNaicsCodes,
  } satisfies OpportunityFeedbackProfile;
}

function getProfile() {
  let row: Record<string, unknown> | undefined;

  try {
    row = sqlite
      .prepare(`
        SELECT
          id,
          company_name as companyName,
          company_summary as companySummary,
          geography,
          naics_codes as naicsCodes,
          sectors,
          assistance_types as assistanceTypes,
          keywords,
          notification_mode as notificationMode,
          notification_email as notificationEmail,
          daily_summary_enabled as dailySummaryEnabled,
          email_categories as emailCategories,
          email_jurisdictions as emailJurisdictions,
          email_tags as emailTags,
          last_daily_summary_at as lastDailySummaryAt,
          updated_at as updatedAt
        FROM company_profile
        WHERE id = 1
      `)
      .get() as Record<string, unknown> | undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("naics_codes")) {
      throw error;
    }

    console.warn("Company profile is missing naics_codes column. Falling back to legacy profile schema.");
    row = sqlite
      .prepare(`
        SELECT
          id,
          company_name as companyName,
          company_summary as companySummary,
          geography,
          sectors,
          assistance_types as assistanceTypes,
          keywords,
          notification_mode as notificationMode,
          notification_email as notificationEmail,
          daily_summary_enabled as dailySummaryEnabled,
          email_categories as emailCategories,
          email_jurisdictions as emailJurisdictions,
          email_tags as emailTags,
          last_daily_summary_at as lastDailySummaryAt,
          updated_at as updatedAt
        FROM company_profile
        WHERE id = 1
      `)
      .get() as Record<string, unknown> | undefined;
  }

  if (!row) {
    return {
      id: 1,
      ...defaultProfile,
      updatedAt: nowIso(),
      lastDailySummaryAt: null,
    } satisfies RawCompanyProfile;
  }

  return {
    id: Number(row.id),
    companyName: String(row.companyName ?? ""),
    companySummary: String(row.companySummary ?? ""),
    geography: String(row.geography ?? ""),
    naicsCodes: parseArray(String(row.naicsCodes ?? "[]")),
    sectors: parseArray(String(row.sectors ?? "[]")),
    assistanceTypes: parseArray(String(row.assistanceTypes ?? "[]")),
    keywords: parseArray(String(row.keywords ?? "[]")),
    notificationMode: String(row.notificationMode ?? "digest"),
    notificationEmail: String(row.notificationEmail ?? ""),
    dailySummaryEnabled: Boolean(Number(row.dailySummaryEnabled ?? 0)),
    emailCategories: parseArray(String(row.emailCategories ?? "[]")),
    emailJurisdictions: parseArray(String(row.emailJurisdictions ?? "[]")),
    emailTags: parseArray(String(row.emailTags ?? "[]")),
    lastDailySummaryAt: row.lastDailySummaryAt ? String(row.lastDailySummaryAt) : null,
    updatedAt: String(row.updatedAt ?? nowIso()),
  } satisfies RawCompanyProfile;
}

function getSources() {
  const rows = sqlite
    .prepare(`
      SELECT
        id,
        source_key as sourceKey,
        name,
        url,
        jurisdiction,
        interface_type as interfaceType,
        program_types as programTypes,
        update_cadence as updateCadence,
        summary,
        last_synced_at as lastSyncedAt
      FROM official_sources
      ORDER BY name ASC
    `)
    .all() as Record<string, unknown>[];

  return rows.map((row) => ({
    id: Number(row.id),
    sourceKey: String(row.sourceKey),
    name: String(row.name),
    url: String(row.url),
    jurisdiction: String(row.jurisdiction),
    interfaceType: String(row.interfaceType),
    programTypes: parseArray(String(row.programTypes ?? "[]")),
    updateCadence: String(row.updateCadence),
    summary: String(row.summary),
    lastSyncedAt: row.lastSyncedAt ? String(row.lastSyncedAt) : null,
  })) satisfies RawSource[];
}

async function getSupabaseWorkspaceData(
  profile: RawCompanyProfile,
  options?: FundingWorkspaceOptions,
) {
  if (!hasSupabaseServiceRoleEnv()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const baseSelect =
    "id, source_id, canonical_key, title, category, jurisdiction, audience, summary, eligibility, amount, deadline, geography, status, source_url, keywords, tags, updated_at, created_at";
  const naicsSelect = `${baseSelect}, naics_codes`;

  const [sourcesResult, ingestionRunsResult, snapshotDatesResult] = await Promise.all([
    supabase.from("official_sources").select(
      "id, source_key, name, base_url, jurisdiction, interface_type, default_cadence, last_synced_at, last_success_at",
    ),
    supabase
      .from("ingestion_runs")
      .select(
        "id, status, triggered_by, notes, sources_attempted, sources_succeeded, items_upserted, started_at, completed_at",
        )
      .order("started_at", { ascending: false })
      .limit(1),
    supabase
      .from("feed_item_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(90),
  ]);

  if (sourcesResult.error || ingestionRunsResult.error || snapshotDatesResult.error) {
    throw new Error(
      [
        "Supabase feed read failed.",
        sourcesResult.error ? `official_sources: ${sourcesResult.error.message}` : null,
        ingestionRunsResult.error ? `ingestion_runs: ${ingestionRunsResult.error.message}` : null,
        snapshotDatesResult.error ? `feed_item_snapshots: ${snapshotDatesResult.error.message}` : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const remoteSources = ((sourcesResult.data ?? []) as unknown) as Array<Record<string, unknown>>;
  const sourceSeedMap = new Map(sourceSeeds.map((source) => [source.key, source]));
  const sourceIdToKey = new Map(remoteSources.map((source) => [source.id, source.source_key as string]));
  const sourceKeyToId = new Map(remoteSources.map((source) => [String(source.source_key), String(source.id)]));
  const availableSnapshotDates = Array.from(
    new Set(
      ((snapshotDatesResult.data ?? []) as Array<{ snapshot_date?: string | null }>)
        .map((row) => row.snapshot_date)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => b.localeCompare(a));
  const selectedSnapshotDate =
    options?.snapshotDate && availableSnapshotDates.includes(options.snapshotDate)
      ? options.snapshotDate
      : availableSnapshotDates[0] ?? null;
  const selectedSourceKeys = Array.from(
    new Set((options?.sourceKeys ?? []).map((value) => value.trim()).filter(Boolean)),
  ).filter((sourceKey) => sourceKeyToId.has(sourceKey));

  const sources = remoteSources.map((source) => {
    const seed = sourceSeedMap.get(String(source.source_key));

    return {
      id: source.id as number | string,
      sourceKey: String(source.source_key),
      name: String(source.name),
      url: String(source.base_url),
      jurisdiction: String(source.jurisdiction),
      interfaceType: String(source.interface_type),
      programTypes: seed?.programTypes ?? [],
      updateCadence: seed?.updateCadence ?? String(source.default_cadence ?? ""),
      summary: seed?.summary ?? `${String(source.name)} official source.`,
      lastSyncedAt:
        source.last_success_at || source.last_synced_at
          ? String(source.last_success_at ?? source.last_synced_at)
          : null,
      } satisfies RawSource;
  });

  let snapshotFeedItemIds: string[] | null = null;
  if (selectedSnapshotDate) {
    const { data: snapshotRows, error: snapshotRowsError } = await supabase
      .from("feed_item_snapshots")
      .select("feed_item_id")
      .eq("snapshot_date", selectedSnapshotDate);

    if (snapshotRowsError) {
      throw new Error(`Supabase snapshot lookup failed. feed_item_snapshots: ${snapshotRowsError.message}`);
    }

    snapshotFeedItemIds = Array.from(
      new Set(
        ((snapshotRows ?? []) as Array<{ feed_item_id?: string | null }>)
          .map((row) => row.feed_item_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }

  async function loadFeedItemsByIds(includeNaicsColumn: boolean, feedItemIds: string[]) {
    const chunkSize = 500;
    const rows: Array<Record<string, unknown>> = [];

    for (let index = 0; index < feedItemIds.length; index += chunkSize) {
      const chunk = feedItemIds.slice(index, index + chunkSize);
      const { data, error } = await supabase
        .from("feed_items")
        .select(includeNaicsColumn ? naicsSelect : baseSelect)
        .in("id", chunk);

      if (error) {
        return { data: null, error };
      }

      rows.push(...(((data ?? []) as unknown) as Array<Record<string, unknown>>));
    }

    return { data: rows, error: null };
  }

  let canReadRemoteNaicsColumn = true;
  let remoteItemsResult =
    snapshotFeedItemIds && snapshotFeedItemIds.length > 0
      ? await loadFeedItemsByIds(true, snapshotFeedItemIds)
      : { data: [] as Array<Record<string, unknown>>, error: null as { message?: string } | null };

  if (isMissingColumnError(remoteItemsResult.error, "naics_codes")) {
    console.warn("Supabase feed_items is missing naics_codes. Falling back to inferred NAICS matching.");
    canReadRemoteNaicsColumn = false;
    remoteItemsResult =
      snapshotFeedItemIds && snapshotFeedItemIds.length > 0
        ? await loadFeedItemsByIds(false, snapshotFeedItemIds)
        : { data: [] as Array<Record<string, unknown>>, error: null as { message?: string } | null };
  }

  if (remoteItemsResult.error) {
    throw new Error(`Supabase feed read failed. feed_items: ${remoteItemsResult.error.message}`);
  }

  const remoteItems = (((remoteItemsResult.data ?? []) as unknown) as Array<Record<string, unknown>>)
    .filter((item) => {
      if (selectedSourceKeys.length === 0) {
        return true;
      }

      const sourceKey = sourceIdToKey.get(item.source_id);
      return sourceKey ? selectedSourceKeys.includes(sourceKey) : false;
    })
    .sort((a, b) => {
      const updatedAtDiff =
        new Date(String(b.updated_at ?? nowIso())).getTime() -
        new Date(String(a.updated_at ?? nowIso())).getTime();
      if (updatedAtDiff !== 0) {
        return updatedAtDiff;
      }

      return String(a.title ?? "").localeCompare(String(b.title ?? ""));
    });

  const items = remoteItems.map((item) => {
    const inferredNaicsCodes = inferNaicsCodesFromText(
      [
        String(item.title ?? ""),
        String(item.summary ?? ""),
        String(item.eligibility ?? ""),
        String(item.audience ?? ""),
        String(item.geography ?? ""),
      ].join(" "),
    );
    const remoteNaicsCodes =
      canReadRemoteNaicsColumn && "naics_codes" in item ? parseArray(item.naics_codes) : [];

    return {
      id: item.id as number | string,
      itemKey: String(item.canonical_key),
      sourceKey: sourceIdToKey.get(item.source_id) ?? "unknown-source",
      title: String(item.title),
      category: String(item.category),
      jurisdiction: String(item.jurisdiction),
      audience: String(item.audience ?? ""),
      summary: String(item.summary ?? ""),
      eligibility: String(item.eligibility ?? ""),
      amount: item.amount ? String(item.amount) : null,
      deadline: item.deadline ? String(item.deadline) : null,
      geography: String(item.geography ?? ""),
      status: String(item.status),
      url: String(item.source_url),
      keywords: parseArray(item.keywords),
      tags: parseArray(item.tags),
      naicsCodes: remoteNaicsCodes.length > 0 ? remoteNaicsCodes : inferredNaicsCodes,
      updatedAt: String(item.updated_at ?? nowIso()),
      createdAt: String(item.created_at ?? nowIso()),
    };
  }) satisfies RawFeedItem[];

  const latestRun = ingestionRunsResult.data?.[0];
  const lastIngestionRun = latestRun
    ? ({
        id: latestRun.id,
        status: latestRun.status,
        triggeredBy: latestRun.triggered_by,
        notes: latestRun.notes ?? null,
        sourcesUpserted: latestRun.sources_succeeded ?? latestRun.sources_attempted ?? 0,
        itemsUpserted: latestRun.items_upserted ?? 0,
        createdAt: latestRun.completed_at ?? latestRun.started_at ?? nowIso(),
      } satisfies RawIngestionRun)
    : null;

  return {
    availableSnapshotDates,
    items,
    lastIngestionRun,
    selectedSnapshotDate,
    selectedSourceKeys,
    sources,
    totalItems: items.length,
  };
}

function getFeedItems(options?: FundingWorkspaceOptions) {
  const pageSize = Math.max(1, options?.pageSize ?? 20);
  const page = Math.max(1, options?.page ?? 1);
  const offset = (page - 1) * pageSize;
  const rows = sqlite
    .prepare(`
      SELECT
        id,
        item_key as itemKey,
        source_key as sourceKey,
        title,
        category,
        jurisdiction,
        audience,
        summary,
        eligibility,
        amount,
        deadline,
        geography,
        status,
        url,
        keywords,
        tags,
        '[]' as naicsCodes,
        updated_at as updatedAt,
        created_at as createdAt
      FROM feed_items
      ORDER BY updated_at DESC, title ASC
      LIMIT ? OFFSET ?
    `)
    .all(pageSize, offset) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: Number(row.id),
    itemKey: String(row.itemKey),
    sourceKey: String(row.sourceKey),
    title: String(row.title),
    category: String(row.category),
    jurisdiction: String(row.jurisdiction),
    audience: String(row.audience),
    summary: String(row.summary),
    eligibility: String(row.eligibility),
    amount: row.amount ? String(row.amount) : null,
    deadline: row.deadline ? String(row.deadline) : null,
    geography: String(row.geography),
    status: String(row.status),
    url: String(row.url),
    keywords: parseArray(String(row.keywords ?? "[]")),
    tags: parseArray(String(row.tags ?? "[]")),
    naicsCodes: inferNaicsCodesFromText(
      [
        String(row.title),
        String(row.summary),
        String(row.eligibility),
        String(row.audience),
        String(row.geography),
      ].join(" "),
    ),
    updatedAt: String(row.updatedAt ?? nowIso()),
    createdAt: String(row.createdAt ?? nowIso()),
  })) satisfies RawFeedItem[];
}

function getFeedItemsCount() {
  const row = sqlite.prepare("SELECT COUNT(*) as count FROM feed_items").get() as { count: number };
  return row.count;
}

function getNotifications() {
  const rows = sqlite
    .prepare(`
      SELECT
        id,
        item_key as itemKey,
        title,
        message,
        relevance_score as relevanceScore,
        reasons,
        created_at as createdAt,
        read_at as readAt
      FROM notifications
      ORDER BY relevance_score DESC, created_at DESC
      LIMIT 12
    `)
    .all() as Record<string, unknown>[];

  return rows.map((row) => ({
    id: Number(row.id),
    itemKey: String(row.itemKey),
    title: String(row.title),
    message: String(row.message),
    relevanceScore: Number(row.relevanceScore ?? 0),
    reasons: parseArray(String(row.reasons ?? "[]")),
    createdAt: String(row.createdAt ?? nowIso()),
    readAt: row.readAt ? String(row.readAt) : null,
  })) satisfies RawNotification[];
}

function buildNotificationsForProfile(items: ScoredItem[], profile: RawCompanyProfile) {
  return items
    .filter((item) => item.relevanceScore >= 45)
    .slice(0, 12)
    .map((item, index) => ({
      id: index + 1,
      itemKey: item.itemKey,
      title: item.title,
      message: `${item.title} aligns with ${profile.companyName || "your tracked profile"} and is worth reviewing in the feed.`,
      relevanceScore: item.relevanceScore,
      reasons: item.reasons,
      createdAt: item.updatedAt,
      readAt: null,
    })) satisfies RawNotification[];
}

function getLastIngestionRun() {
  const row = sqlite
    .prepare(`
      SELECT
        id,
        status,
        triggered_by as triggeredBy,
        notes,
        sources_upserted as sourcesUpserted,
        items_upserted as itemsUpserted,
        created_at as createdAt
      FROM ingestion_runs
      ORDER BY id DESC
      LIMIT 1
    `)
    .get() as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    status: String(row.status),
    triggeredBy: String(row.triggeredBy),
    notes: row.notes ? String(row.notes) : null,
    sourcesUpserted: Number(row.sourcesUpserted ?? 0),
    itemsUpserted: Number(row.itemsUpserted ?? 0),
    createdAt: String(row.createdAt ?? nowIso()),
  } satisfies RawIngestionRun;
}

function buildNotifications(items: ScoredItem[], profile: RawCompanyProfile) {
  return items
    .filter((item) => item.relevanceScore >= 45)
    .slice(0, 12)
    .map((item, index) => ({
      id: item.itemKey || `${index + 1}`,
      itemKey: item.itemKey,
      title: item.title,
      message: `${item.title} aligns with ${profile.companyName || "your tracked profile"} and is worth reviewing in the feed.`,
      relevanceScore: item.relevanceScore,
      reasons: item.reasons,
      createdAt: item.updatedAt,
      readAt: null,
    })) satisfies RawNotification[];
}

export function scoreItemForProfile(
  item: RawFeedItem,
  profile: RawCompanyProfile,
  feedbackProfile?: OpportunityFeedbackProfile | null,
) {
  const searchable = buildSearchableText(item);
  const reasons: string[] = [];
  let score = 0;
  const naicsMatches = findCompatibleNaicsCodes(profile.naicsCodes, item.naicsCodes);

  const keywordMatches = normalizeTokens(profile.keywords).filter((token) =>
    searchable.includes(token),
  );
  const sectorMatches = normalizeTokens(profile.sectors).filter((token) =>
    searchable.includes(token),
  );
  const assistanceMatches = normalizeTokens(profile.assistanceTypes).filter((token) =>
    searchable.includes(token),
  );

  if (profile.geography && searchable.includes(normalizeText(profile.geography))) {
    score += 18;
    reasons.push(`Matches geography: ${profile.geography}`);
  }

  if (profile.naicsCodes.length > 0 && naicsMatches.length === 0) {
    return {
      score: 0,
      reasons: ["No NAICS compatibility match."],
    };
  }

  if (naicsMatches.length > 0) {
    score += 30;
    reasons.push(
      `NAICS match: ${naicsMatches
        .slice(0, 2)
        .map((code) => formatNaicsLabel(code))
        .join(", ")}`,
    );
  }

  if (keywordMatches.length > 0) {
    score += Math.min(36, keywordMatches.length * 9);
    reasons.push(`Keyword match: ${keywordMatches.slice(0, 3).join(", ")}`);
  }

  if (sectorMatches.length > 0) {
    score += Math.min(24, sectorMatches.length * 8);
    reasons.push(`Sector match: ${sectorMatches.slice(0, 3).join(", ")}`);
  }

  if (assistanceMatches.length > 0) {
    score += Math.min(24, assistanceMatches.length * 8);
    reasons.push(`Assistance type match: ${assistanceMatches.slice(0, 3).join(", ")}`);
  }

  if (item.tags.some((tag) => normalizeTokens(profile.keywords).includes(tag.toLowerCase()))) {
    score += 10;
    reasons.push("Tag overlap with tracked keywords");
  }

  if (/puerto rico/i.test(item.geography) || /puerto rico/i.test(item.jurisdiction)) {
    score += 8;
    reasons.push("Puerto Rico relevance");
  }

  if (feedbackProfile) {
    const currentState = feedbackProfile.currentStateByItemId.get(String(item.id))?.state ?? null;
    const itemTokens = new Set(
      filterFeedbackTokens(
        normalizeTokens([
          item.title,
          item.summary,
          item.eligibility,
          item.category,
          ...item.tags,
          ...item.keywords,
        ]),
      ),
    );

    const positiveTokenOverlap = Array.from(itemTokens).filter(
      (token) => (feedbackProfile.positiveTokenWeights.get(token) ?? 0) >= 2,
    );
    const negativeTokenOverlap = Array.from(itemTokens).filter(
      (token) => (feedbackProfile.negativeTokenWeights.get(token) ?? 0) >= 2,
    );

    if (positiveTokenOverlap.length > 0) {
      score += Math.min(
        16,
        positiveTokenOverlap.reduce(
          (total, token) => total + Math.min(4, feedbackProfile.positiveTokenWeights.get(token) ?? 0),
          0,
        ),
      );
      reasons.push(`Aligns with prior positive feedback: ${positiveTokenOverlap.slice(0, 3).join(", ")}`);
    }

    if (negativeTokenOverlap.length > 0) {
      score -= Math.min(
        20,
        negativeTokenOverlap.reduce(
          (total, token) => total + Math.min(5, feedbackProfile.negativeTokenWeights.get(token) ?? 0),
          0,
        ),
      );
      reasons.push(`Similar to previous not-a-fit feedback: ${negativeTokenOverlap.slice(0, 3).join(", ")}`);
    }

    if (feedbackProfile.positiveCategories.has(item.category)) {
      score += 6;
      reasons.push(`Matches a preferred category from prior reviews: ${item.category}`);
    }

    if (feedbackProfile.negativeCategories.has(item.category)) {
      score -= 10;
      reasons.push(`Category resembles previous not-a-fit decisions: ${item.category}`);
    }

    if (feedbackProfile.positiveJurisdictions.has(item.jurisdiction)) {
      score += 4;
    }

    if (feedbackProfile.negativeJurisdictions.has(item.jurisdiction)) {
      score -= 6;
    }

    if (feedbackProfile.positiveSourceKeys.has(item.sourceKey)) {
      score += 4;
      reasons.push("Source resembles previously useful opportunities");
    }

    if (feedbackProfile.negativeSourceKeys.has(item.sourceKey)) {
      score -= 6;
    }

    if (item.naicsCodes.some((code) => feedbackProfile.positiveNaicsCodes.has(code))) {
      score += 5;
    }

    if (item.naicsCodes.some((code) => feedbackProfile.negativeNaicsCodes.has(code))) {
      score -= 6;
    }

    if (currentState === "interested") {
      score -= 8;
      reasons.push("Already marked interested");
    } else if (currentState === "applied") {
      score -= 18;
      reasons.push("Already applied");
    } else if (currentState === "waiting") {
      score -= 14;
      reasons.push("Already waiting on a response");
    } else if (currentState === "won") {
      score -= 20;
      reasons.push("Already marked won");
    } else if (currentState === "not-a-fit") {
      score -= 26;
      reasons.push("Already marked not a fit");
    } else if (currentState === "archived") {
      score -= 18;
      reasons.push("Already archived");
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons: reasons.slice(0, 4),
  };
}

export function matchesEmailPreferencesForProfile(
  item: RawFeedItem | ScoredItem,
  profile: RawCompanyProfile,
) {
  const matchesNaics = hasCompatibleNaicsCodes(profile.naicsCodes, item.naicsCodes);
  const matchesCategories =
    profile.emailCategories.length === 0 || profile.emailCategories.includes(item.category);
  const matchesJurisdictions =
    profile.emailJurisdictions.length === 0 ||
    profile.emailJurisdictions.includes(item.jurisdiction);
  const matchesTags =
    profile.emailTags.length === 0 || item.tags.some((tag) => profile.emailTags.includes(tag));

  return matchesNaics && matchesCategories && matchesJurisdictions && matchesTags;
}

function syncSeedData(triggeredBy: string, notes?: string) {
  const currentTimestamp = nowIso();
  const upsertSource = sqlite.prepare(`
    INSERT INTO official_sources (
      source_key,
      name,
      url,
      jurisdiction,
      interface_type,
      program_types,
      update_cadence,
      summary,
      last_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET
      name = excluded.name,
      url = excluded.url,
      jurisdiction = excluded.jurisdiction,
      interface_type = excluded.interface_type,
      program_types = excluded.program_types,
      update_cadence = excluded.update_cadence,
      summary = excluded.summary,
      last_synced_at = excluded.last_synced_at
  `);
  const upsertItem = sqlite.prepare(`
    INSERT INTO feed_items (
      item_key,
      source_key,
      title,
      category,
      jurisdiction,
      audience,
      summary,
      eligibility,
      amount,
      deadline,
      geography,
      status,
      url,
      keywords,
      tags,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(item_key) DO UPDATE SET
      source_key = excluded.source_key,
      title = excluded.title,
      category = excluded.category,
      jurisdiction = excluded.jurisdiction,
      audience = excluded.audience,
      summary = excluded.summary,
      eligibility = excluded.eligibility,
      amount = excluded.amount,
      deadline = excluded.deadline,
      geography = excluded.geography,
      status = excluded.status,
      url = excluded.url,
      keywords = excluded.keywords,
      tags = excluded.tags,
      updated_at = excluded.updated_at
  `);

  const transaction = sqlite.transaction(() => {
    for (const source of sourceSeeds) {
      upsertSource.run(
        source.key,
        source.name,
        source.url,
        source.jurisdiction,
        source.interfaceType,
        stringifyArray(source.programTypes),
        source.updateCadence,
        source.summary,
        currentTimestamp,
      );
    }

    for (const item of feedSeeds) {
      upsertItem.run(
        item.key,
        item.sourceKey,
        item.title,
        item.category,
        item.jurisdiction,
        item.audience,
        item.summary,
        item.eligibility,
        item.amount,
        item.deadline,
        item.geography,
        item.status,
        item.url,
        stringifyArray(item.keywords),
        stringifyArray(item.tags),
        currentTimestamp,
      );
    }

    sqlite
      .prepare(`
        INSERT INTO ingestion_runs (
          status,
          triggered_by,
          notes,
          sources_upserted,
          items_upserted
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .run("success", triggeredBy, notes ?? null, sourceSeeds.length, feedSeeds.length);
  });

  transaction();
}

function syncNotificationsForProfile(profile: RawCompanyProfile) {
  const items = getFeedItems();
  const upsertNotification = sqlite.prepare(`
    INSERT INTO notifications (
      item_key,
      title,
      message,
      relevance_score,
      reasons
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(item_key) DO UPDATE SET
      title = excluded.title,
      message = excluded.message,
      relevance_score = excluded.relevance_score,
      reasons = excluded.reasons
  `);

  const transaction = sqlite.transaction(() => {
    for (const item of items) {
      const scored = scoreItemForProfile(item, profile);
      if (scored.score < 45) {
        continue;
      }

      const message = `${item.title} aligns with ${profile.companyName || "your tracked profile"} and is worth reviewing in the feed.`;
      upsertNotification.run(
        item.itemKey,
        item.title,
        message,
        scored.score,
        stringifyArray(scored.reasons),
      );
    }
  });

  transaction();
}

export function initializeFundingFeed() {
  const sourceCount = sqlite
    .prepare("SELECT COUNT(*) as count FROM official_sources")
    .get() as { count: number };
  const profileCount = sqlite
    .prepare("SELECT COUNT(*) as count FROM company_profile")
    .get() as { count: number };

  if (profileCount.count === 0) {
    sqlite
      .prepare(`
        INSERT INTO company_profile (
          id,
          company_name,
          company_summary,
          geography,
          naics_codes,
          sectors,
          assistance_types,
        keywords,
        notification_mode,
        notification_email,
        daily_summary_enabled,
        email_categories,
        email_jurisdictions,
        email_tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        1,
        defaultProfile.companyName,
        defaultProfile.companySummary,
        defaultProfile.geography,
        stringifyArray(defaultProfile.naicsCodes),
        stringifyArray(defaultProfile.sectors),
        stringifyArray(defaultProfile.assistanceTypes),
        stringifyArray(defaultProfile.keywords),
        defaultProfile.notificationMode,
        defaultProfile.notificationEmail,
        defaultProfile.dailySummaryEnabled ? 1 : 0,
        stringifyArray(defaultProfile.emailCategories),
        stringifyArray(defaultProfile.emailJurisdictions),
        stringifyArray(defaultProfile.emailTags),
      );
  }

  if (sourceCount.count === 0) {
    syncSeedData("bootstrap", "Initial official-source feed import");
    syncNotificationsForProfile(getProfile());
  }
}

export async function saveCompanyProfile(input: CompanyProfileInput) {
  sqlite
    .prepare(`
      UPDATE company_profile
      SET
        company_name = ?,
        company_summary = ?,
        geography = ?,
        naics_codes = ?,
        sectors = ?,
        assistance_types = ?,
        keywords = ?,
        notification_mode = ?,
        notification_email = ?,
        daily_summary_enabled = ?,
        email_categories = ?,
        email_jurisdictions = ?,
        email_tags = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `)
    .run(
      input.companyName,
      input.companySummary,
      input.geography,
      stringifyArray(input.naicsCodes),
      stringifyArray(input.sectors),
      stringifyArray(input.assistanceTypes),
      stringifyArray(input.keywords),
      input.notificationMode,
      input.notificationEmail,
      input.dailySummaryEnabled ? 1 : 0,
      stringifyArray(input.emailCategories),
      stringifyArray(input.emailJurisdictions),
      stringifyArray(input.emailTags),
    );

  syncNotificationsForProfile(getProfile());
  return getFundingWorkspaceData();
}

export async function refreshFundingFeed(triggeredBy: string) {
  syncSeedData(triggeredBy, "Manual or scheduled official-source refresh");
  syncNotificationsForProfile(getProfile());
  return getFundingWorkspaceData();
}

function startOfUtcDay(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`).getTime();
}

export async function getDailySummaryEmailPayload(profileOverride?: RawCompanyProfile) {
  const profile = profileOverride ?? getProfile();
  const workspace = await getFundingWorkspaceData(undefined, profile);
  const matchingItems = workspace.items.filter((item) => matchesEmailPreferencesForProfile(item, profile));
  const unevaluatedItems = matchingItems.filter((item) =>
    isOpportunityUnevaluated(item.opportunityState?.state),
  );
  const recommendedItems = unevaluatedItems.filter((item) => item.relevanceScore >= 55);

  if (!profile.dailySummaryEnabled) {
    return { shouldSend: false as const, reason: "Daily summary is disabled." };
  }

  if (!profile.notificationEmail) {
    return { shouldSend: false as const, reason: "Notification email is missing." };
  }

  if (profile.notificationMode === "muted") {
    return { shouldSend: false as const, reason: "Notifications are muted." };
  }

  if (matchingItems.length === 0) {
    return { shouldSend: false as const, reason: "No relevant items match the email update filters." };
  }

  if (
    profile.lastDailySummaryAt &&
    startOfUtcDay(profile.lastDailySummaryAt) === startOfUtcDay(nowIso())
  ) {
    return { shouldSend: false as const, reason: "Daily summary already sent today." };
  }

  return {
    shouldSend: true as const,
    payload: {
      companyName: profile.companyName,
      email: profile.notificationEmail,
      snapshotDate: new Date().toISOString().slice(0, 10),
      profileNaicsLabels: profile.naicsCodes.map((code) => formatNaicsLabel(code)),
      appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://hub.joche.dev/funding-ops",
      opportunitiesUrl: `${process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://hub.joche.dev/funding-ops"}/opportunities`,
      totalAvailable: matchingItems.length,
      unevaluatedItems: unevaluatedItems.length,
      evaluatedItems: matchingItems.length - unevaluatedItems.length,
      appliedItems: matchingItems.filter((item) => item.opportunityState?.state === "applied").length,
      topReviewReasons: buildReviewReasonCounts(matchingItems),
      newItems: recommendedItems.length,
      recommendedItems: recommendedItems.length,
      items: recommendedItems.slice(0, 5).map((item) => ({
        title: item.title,
        url: item.url,
        relevanceScore: item.relevanceScore,
        reasons: item.reasons,
        category: item.category,
        jurisdiction: item.jurisdiction,
        deadline: item.deadline,
      })),
    },
  };
}

export function markDailySummarySent() {
  sqlite
    .prepare(`
      UPDATE company_profile
      SET
        last_daily_summary_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `)
    .run();
}

export async function getFundingWorkspaceData(
  options?: FundingWorkspaceOptions,
  profileOverride?: RawCompanyProfile,
) {
  const profile = profileOverride ?? getProfile();
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.max(1, options?.pageSize ?? 20);
  const remoteWorkspace = await getSupabaseWorkspaceData(profile, { page, pageSize });
  const sqliteTotalItems = remoteWorkspace ? 0 : getFeedItemsCount();
  const sources = remoteWorkspace?.sources ?? getSources();
  const baseItems =
    remoteWorkspace?.items ??
    getFeedItems({ page: 1, pageSize: Math.max(pageSize, sqliteTotalItems || pageSize) });
  const feedbackProfile = await buildOpportunityFeedbackProfile(options?.viewerProfileId, baseItems);
  const opportunityStates =
    options?.viewerProfileId && hasSupabaseServiceRoleEnv()
      ? await listUserOpportunityStates(
          options.viewerProfileId,
          (remoteWorkspace?.items ?? baseItems).map((item) => String(item.id)),
        )
      : [];
  const opportunityStateByItemId = new Map(
    opportunityStates.map((state) => [state.feedItemId, state] satisfies [string, UserOpportunityStateRecord]),
  );
  const scopedItems = (remoteWorkspace?.items ?? baseItems)
    .map((item) => {
      const scored = scoreItemForProfile(item, profile, feedbackProfile);
      const savedState = opportunityStateByItemId.get(String(item.id));
      return {
        ...item,
        relevanceScore: scored.score,
        reasons: scored.reasons,
        opportunityState: savedState
          ? {
              state: savedState.state,
              decisionReason: savedState.decisionReason,
              decisionNote: savedState.decisionNote,
              appliedAt: savedState.appliedAt,
              followUpAt: savedState.followUpAt,
              archivedAt: savedState.archivedAt,
              updatedAt: savedState.updatedAt,
            }
          : null,
      };
    })
      .filter(
        (item) =>
          hasCompatibleNaicsCodes(profile.naicsCodes, item.naicsCodes),
      )
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.title.localeCompare(b.title));
  const totalItems = scopedItems.length;
  const unevaluatedItems = scopedItems.filter((item) =>
    isOpportunityUnevaluated(item.opportunityState?.state),
  ).length;
  const evaluatedItems = scopedItems.filter((item) =>
    isOpportunityEvaluated(item.opportunityState?.state),
  ).length;
  const appliedItems = scopedItems.filter((item) => item.opportunityState?.state === "applied").length;
  const reviewReasons = buildReviewReasonCounts(scopedItems);
  const paginatedItems = scopedItems.slice((page - 1) * pageSize, page * pageSize);
  const notifications = buildNotifications(paginatedItems, profile);

  const allTags = Array.from(new Set(scopedItems.flatMap((item) => item.tags))).sort((a, b) =>
    a.localeCompare(b),
  );
  const categories = Array.from(new Set(scopedItems.map((item) => item.category))).sort((a, b) =>
    a.localeCompare(b),
  );
  const jurisdictions = Array.from(new Set(scopedItems.map((item) => item.jurisdiction))).sort(
    (a, b) => a.localeCompare(b),
  );
  const naicsCodes = Array.from(new Set(scopedItems.flatMap((item) => item.naicsCodes))).sort((a, b) =>
    a.localeCompare(b),
  );
  const lastIngestionRun = remoteWorkspace?.lastIngestionRun ?? getLastIngestionRun();

  return {
    sources,
    items: paginatedItems,
    notifications,
    profile,
    refreshScope: {
      naicsCodes: profile.naicsCodes,
    },
    filters: {
      categories,
      jurisdictions,
      tags: allTags,
      naicsCodes,
    },
    history: {
      availableSnapshotDates: remoteWorkspace?.availableSnapshotDates ?? [],
      selectedSnapshotDate: remoteWorkspace?.selectedSnapshotDate ?? null,
      selectedSourceKeys: remoteWorkspace?.selectedSourceKeys ?? [],
    },
    metrics: {
      totalSources: sources.length,
      totalItems,
      unevaluatedItems,
      evaluatedItems,
      appliedItems,
      reviewReasons,
      totalNotifications: notifications.length,
      highlyRelevantItems: scopedItems.filter((item) => item.relevanceScore >= 55).length,
      sourcesDueForRefresh: sources.filter((source) => !source.lastSyncedAt).length,
    },
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    },
    lastIngestionRun,
  } satisfies FundingWorkspaceData;
}
