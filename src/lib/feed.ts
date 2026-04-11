import { sqlite } from "@/db";
import { formatNaicsLabel, getNaicsKeywords, inferNaicsCodesFromText } from "@/lib/naics";
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

type CompanyProfileInput = {
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

type RawCompanyProfile = CompanyProfileInput & {
  id: number;
  updatedAt: string;
  lastDailySummaryAt: string | null;
};

type RawFeedItem = {
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

type ScoredItem = RawFeedItem & {
  relevanceScore: number;
  reasons: string[];
};

export type FundingWorkspaceData = {
  sources: RawSource[];
  items: ScoredItem[];
  notifications: RawNotification[];
  profile: RawCompanyProfile;
  filters: {
    categories: string[];
    jurisdictions: string[];
    tags: string[];
  };
  metrics: {
    totalSources: number;
    totalItems: number;
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
};

const defaultProfile: CompanyProfileInput = {
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

function getProfile() {
  const row = sqlite
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

async function getSupabaseWorkspaceData(options?: FundingWorkspaceOptions) {
  if (!hasSupabaseServiceRoleEnv()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const profile = getProfile();

  const pageSize = Math.max(1, options?.pageSize ?? 20);
  const page = Math.max(1, options?.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [sourcesResult, baseItemsResult, ingestionRunsResult] = await Promise.all([
    supabase.from("official_sources").select(
      "id, source_key, name, base_url, jurisdiction, interface_type, default_cadence, last_synced_at, last_success_at",
    ),
    supabase
      .from("feed_items")
      .select(
        "id, source_id, canonical_key, title, category, jurisdiction, audience, summary, eligibility, amount, deadline, geography, status, source_url, keywords, tags, naics_codes, updated_at, created_at",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false })
      .order("title", { ascending: true })
      .range(from, to),
    supabase
      .from("ingestion_runs")
      .select(
        "id, status, triggered_by, notes, sources_attempted, sources_succeeded, items_upserted, started_at, completed_at",
      )
      .order("started_at", { ascending: false })
      .limit(1),
  ]);

  let itemsResult = baseItemsResult;
  const naicsKeywords = getNaicsKeywords(profile.naicsCodes);
  if (naicsKeywords.length > 0) {
    const orClauses = naicsKeywords.flatMap((keyword) => [
      `title.ilike.%${keyword}%`,
      `summary.ilike.%${keyword}%`,
      `eligibility.ilike.%${keyword}%`,
      `audience.ilike.%${keyword}%`,
      `geography.ilike.%${keyword}%`,
    ]);

    itemsResult = await supabase
      .from("feed_items")
      .select(
        "id, source_id, canonical_key, title, category, jurisdiction, audience, summary, eligibility, amount, deadline, geography, status, source_url, keywords, tags, naics_codes, updated_at, created_at",
        { count: "exact" },
      )
      .or(orClauses.join(","))
      .order("updated_at", { ascending: false })
      .order("title", { ascending: true })
      .range(from, to);
  }

  if (sourcesResult.error || itemsResult.error || ingestionRunsResult.error) {
    console.warn("Falling back to SQLite feed data because Supabase feed read failed.", {
      sourcesError: sourcesResult.error?.message,
      itemsError: itemsResult.error?.message,
      ingestionRunsError: ingestionRunsResult.error?.message,
    });
    return null;
  }

  const remoteSources = sourcesResult.data ?? [];
  const remoteItems = itemsResult.data ?? [];
  const totalItems = itemsResult.count ?? remoteItems.length;

  if (remoteItems.length === 0) {
    return null;
  }

  const sourceSeedMap = new Map(sourceSeeds.map((source) => [source.key, source]));
  const sourceIdToKey = new Map(remoteSources.map((source) => [source.id, source.source_key]));

  const sources = remoteSources.map((source) => {
    const seed = sourceSeedMap.get(source.source_key);

    return {
      id: source.id,
      sourceKey: source.source_key,
      name: source.name,
      url: source.base_url,
      jurisdiction: source.jurisdiction,
      interfaceType: source.interface_type,
      programTypes: seed?.programTypes ?? [],
      updateCadence: seed?.updateCadence ?? source.default_cadence,
      summary: seed?.summary ?? `${source.name} official source.`,
      lastSyncedAt: source.last_success_at ?? source.last_synced_at ?? null,
    } satisfies RawSource;
  });

  const items = remoteItems.map((item) => ({
    id: item.id,
    itemKey: item.canonical_key,
    sourceKey: sourceIdToKey.get(item.source_id) ?? "unknown-source",
    title: item.title,
    category: item.category,
    jurisdiction: item.jurisdiction,
    audience: item.audience ?? "",
    summary: item.summary ?? "",
    eligibility: item.eligibility ?? "",
    amount: item.amount ?? null,
    deadline: item.deadline ?? null,
    geography: item.geography ?? "",
    status: item.status,
    url: item.source_url,
    keywords: parseArray(item.keywords),
    tags: parseArray(item.tags),
    naicsCodes:
      parseArray(item.naics_codes).length > 0
        ? parseArray(item.naics_codes)
        : inferNaicsCodesFromText(
            [item.title, item.summary ?? "", item.eligibility ?? "", item.audience ?? "", item.geography ?? ""].join(" "),
          ),
    updatedAt: item.updated_at ?? nowIso(),
    createdAt: item.created_at ?? nowIso(),
  })) satisfies RawFeedItem[];

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

  return { items, lastIngestionRun, sources, totalItems };
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

function scoreItem(item: RawFeedItem, profile: RawCompanyProfile) {
  const searchable = buildSearchableText(item);
  const reasons: string[] = [];
  let score = 0;
  const naicsMatches = profile.naicsCodes.filter((code) => item.naicsCodes.includes(code));

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

  return {
    score: Math.min(100, score),
    reasons: reasons.slice(0, 4),
  };
}

function matchesEmailPreferences(item: RawFeedItem | ScoredItem, profile: RawCompanyProfile) {
  const matchesNaics =
    profile.naicsCodes.length === 0 ||
    item.naicsCodes.some((code) => profile.naicsCodes.includes(code));
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
      const scored = scoreItem(item, profile);
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

export async function getDailySummaryEmailPayload() {
  const profile = getProfile();
  const items = (await getFundingWorkspaceData()).items
    .filter((item) => item.relevanceScore >= 55)
    .filter((item) => matchesEmailPreferences(item, profile))
    .slice(0, 5);

  if (!profile.dailySummaryEnabled) {
    return { shouldSend: false as const, reason: "Daily summary is disabled." };
  }

  if (!profile.notificationEmail) {
    return { shouldSend: false as const, reason: "Notification email is missing." };
  }

  if (profile.notificationMode === "muted") {
    return { shouldSend: false as const, reason: "Notifications are muted." };
  }

  if (items.length === 0) {
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
      items: items.map((item) => ({
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

export async function getFundingWorkspaceData(options?: FundingWorkspaceOptions) {
  const profile = getProfile();
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.max(1, options?.pageSize ?? 20);
  const remoteWorkspace = await getSupabaseWorkspaceData({ page, pageSize });
  const sources = remoteWorkspace?.sources ?? getSources();
  const baseItems = remoteWorkspace?.items ?? getFeedItems({ page, pageSize });
  const totalItems = remoteWorkspace?.totalItems ?? getFeedItemsCount();
  const items = baseItems
    .map((item) => {
      const scored = scoreItem(item, profile);
      return {
        ...item,
        relevanceScore: scored.score,
        reasons: scored.reasons,
      };
    })
    .filter(
      (item) =>
        profile.naicsCodes.length === 0 ||
        item.naicsCodes.some((code) => profile.naicsCodes.includes(code)),
    )
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.title.localeCompare(b.title));
  const notifications = buildNotifications(items, profile);

  const allTags = Array.from(new Set(items.flatMap((item) => item.tags))).sort((a, b) =>
    a.localeCompare(b),
  );
  const categories = Array.from(new Set(items.map((item) => item.category))).sort((a, b) =>
    a.localeCompare(b),
  );
  const jurisdictions = Array.from(new Set(items.map((item) => item.jurisdiction))).sort((a, b) =>
    a.localeCompare(b),
  );
  const lastIngestionRun = remoteWorkspace?.lastIngestionRun ?? getLastIngestionRun();

  return {
    sources,
    items,
    notifications,
    profile,
    filters: {
      categories,
      jurisdictions,
      tags: allTags,
    },
    metrics: {
      totalSources: sources.length,
      totalItems,
      totalNotifications: notifications.length,
      highlyRelevantItems: items.filter((item) => item.relevanceScore >= 55).length,
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
