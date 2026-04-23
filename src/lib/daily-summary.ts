import { sendDailySummaryEmail } from "@/lib/email";
import {
  defaultProfile,
  matchesEmailPreferencesForProfile,
  scoreItemForProfile,
  type RawCompanyProfile,
  type RawFeedItem,
} from "@/lib/feed";
import { formatNaicsLabel } from "@/lib/naics";
import { markFundingProfileDailySummarySent } from "@/lib/funding-profile";
import { isOpportunityEvaluated, isOpportunityUnevaluated, listUserOpportunityStates } from "@/lib/opportunity-state";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServiceRoleEnv } from "@/lib/supabase/env";

type FundingProfileRow = {
  profile_id: string;
  company_name: string;
  company_summary: string;
  geography: string;
  naics_codes: unknown;
  sectors: unknown;
  assistance_types: unknown;
  keywords: unknown;
  notification_mode: string;
  notification_email: string;
  daily_summary_enabled: boolean;
  email_categories: unknown;
  email_jurisdictions: unknown;
  email_tags: unknown;
  last_daily_summary_at: string | null;
};

type OfficialSourceRow = {
  id: string;
  source_key: string;
};

type FeedItemRow = {
  id: string;
  source_id: string;
  canonical_key: string;
  title: string;
  category: string;
  jurisdiction: string;
  audience: string | null;
  summary: string | null;
  eligibility: string | null;
  amount: string | null;
  deadline: string | null;
  geography: string | null;
  status: string;
  source_url: string;
  keywords: unknown;
  tags: unknown;
  naics_codes: unknown;
  updated_at: string;
  created_at: string;
};

type AuthUserSummary = {
  id: string;
  email: string | null;
};

type EligibleRecipient = {
  profileId: string;
  email: string;
  profile: RawCompanyProfile;
};

type DailySummarySweepResult = {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  snapshotDate: string | null;
  results: Array<{
    profileId: string;
    email: string;
    status: "sent" | "skipped" | "failed";
    reason?: string;
    totalAvailable?: number;
    unevaluatedItems?: number;
    evaluatedItems?: number;
    appliedItems?: number;
    newItems?: number;
    recommendedItems?: number;
  }>;
};

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? null;
}

function isAdminEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  return (
    normalized === normalizeEmail(process.env.ADMIN_EMAIL) ||
    normalized === "josecancel2@gmail.com"
  );
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function mapProfileRowToProfile(row: FundingProfileRow): RawCompanyProfile {
  return {
    id: 1,
    companyName: row.company_name?.trim() || defaultProfile.companyName,
    companySummary: row.company_summary?.trim() || defaultProfile.companySummary,
    geography: row.geography?.trim() || defaultProfile.geography,
    naicsCodes: asStringArray(row.naics_codes),
    sectors: asStringArray(row.sectors),
    assistanceTypes: asStringArray(row.assistance_types),
    keywords: asStringArray(row.keywords),
    notificationMode: row.notification_mode || defaultProfile.notificationMode,
    notificationEmail: row.notification_email?.trim() || "",
    dailySummaryEnabled: Boolean(row.daily_summary_enabled),
    emailCategories: asStringArray(row.email_categories),
    emailJurisdictions: asStringArray(row.email_jurisdictions),
    emailTags: asStringArray(row.email_tags),
    lastDailySummaryAt: row.last_daily_summary_at,
    updatedAt: new Date().toISOString(),
  };
}

function mapFeedItemRowToRawItem(row: FeedItemRow, sourceKeyMap: Map<string, string>): RawFeedItem {
  return {
    id: row.id,
    itemKey: row.canonical_key,
    sourceKey: sourceKeyMap.get(row.source_id) ?? "unknown",
    title: row.title,
    category: row.category,
    jurisdiction: row.jurisdiction,
    audience: row.audience ?? "",
    summary: row.summary ?? "",
    eligibility: row.eligibility ?? "",
    amount: row.amount,
    deadline: row.deadline,
    geography: row.geography ?? "",
    status: row.status,
    url: row.source_url,
    keywords: asStringArray(row.keywords),
    tags: asStringArray(row.tags),
    naicsCodes: asStringArray(row.naics_codes),
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function startOfUtcDay(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`).getTime();
}

function isSentToday(lastSentAt: string | null) {
  return Boolean(lastSentAt && startOfUtcDay(lastSentAt) === startOfUtcDay(new Date().toISOString()));
}

function stripNaicsReason(reasons: string[]) {
  return reasons.filter((reason) => !reason.startsWith("NAICS match:"));
}

async function listAuthUsers() {
  const admin = getSupabaseAdminClient();
  const users: AuthUserSummary[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const batch = data.users.map((user) => ({
      id: user.id,
      email: normalizeEmail(user.email),
    }));
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

async function listEligibleRecipients(): Promise<EligibleRecipient[]> {
  const admin = getSupabaseAdminClient();
  const [
    profilesResult,
    authUsers,
    directAccessResult,
    membershipResult,
    orgGrantResult,
  ] = await Promise.all([
    admin
      .from("funding_ops_user_profiles")
      .select(`
        profile_id,
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
        email_tags,
        last_daily_summary_at
      `)
      .eq("daily_summary_enabled", true)
      .neq("notification_email", "")
      .neq("notification_mode", "muted"),
    listAuthUsers(),
    admin.from("hub_user_tool_access").select("profile_id, tool_key").eq("tool_key", "funding-ops"),
    admin.from("hub_organization_members").select("profile_id, organization_id"),
    admin.from("hub_organization_tool_access").select("organization_id, tool_key").eq("tool_key", "funding-ops"),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }
  if (directAccessResult.error) {
    throw directAccessResult.error;
  }
  if (membershipResult.error) {
    throw membershipResult.error;
  }
  if (orgGrantResult.error) {
    throw orgGrantResult.error;
  }

  const authUserById = new Map(authUsers.map((user) => [user.id, user]));
  const directAccessIds = new Set((directAccessResult.data ?? []).map((row) => row.profile_id));
  const organizationGrantIds = new Set((orgGrantResult.data ?? []).map((row) => row.organization_id));
  const memberOrgIdsByProfile = new Map<string, Set<string>>();
  for (const membership of membershipResult.data ?? []) {
    const set = memberOrgIdsByProfile.get(membership.profile_id) ?? new Set<string>();
    set.add(membership.organization_id);
    memberOrgIdsByProfile.set(membership.profile_id, set);
  }

  return ((profilesResult.data ?? []) as FundingProfileRow[])
    .map((row) => {
      const authUser = authUserById.get(row.profile_id);
      const email = normalizeEmail(authUser?.email ?? row.notification_email);
      if (!email) {
        return null;
      }

      const orgIds = memberOrgIdsByProfile.get(row.profile_id) ?? new Set<string>();
      const hasOrgAccess = Array.from(orgIds).some((organizationId) =>
        organizationGrantIds.has(organizationId),
      );
      const allowed = directAccessIds.has(row.profile_id) || hasOrgAccess || isAdminEmail(email);

      if (!allowed) {
        return null;
      }

      return {
        profileId: row.profile_id,
        email,
        profile: mapProfileRowToProfile(row),
      } satisfies EligibleRecipient;
    })
    .filter((recipient): recipient is EligibleRecipient => Boolean(recipient));
}

async function fetchAllCurrentFeedItems() {
  const admin = getSupabaseAdminClient();
  const { data: sourceRows, error: sourceError } = await admin
    .from("official_sources")
    .select("id, source_key");

  if (sourceError) {
    throw sourceError;
  }

  const sourceKeyMap = new Map(
    ((sourceRows ?? []) as OfficialSourceRow[]).map((row) => [row.id, row.source_key]),
  );

  const items: RawFeedItem[] = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from("feed_items")
      .select(`
        id,
        source_id,
        canonical_key,
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
        source_url,
        keywords,
        tags,
        naics_codes,
        updated_at,
        created_at
      `)
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as FeedItemRow[];
    items.push(...rows.map((row) => mapFeedItemRowToRawItem(row, sourceKeyMap)));

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return items;
}

async function fetchLatestSnapshotDate() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("feed_item_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.snapshot_date ?? null;
}

export async function runDailySummarySweep(): Promise<DailySummarySweepResult> {
  if (!hasSupabaseServiceRoleEnv()) {
    return {
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      snapshotDate: null,
      results: [],
    };
  }

  const [recipients, feedItems, snapshotDate] = await Promise.all([
    listEligibleRecipients(),
    fetchAllCurrentFeedItems(),
    fetchLatestSnapshotDate(),
  ]);

  const results: DailySummarySweepResult["results"] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const { profile, profileId, email } = recipient;

    if (isSentToday(profile.lastDailySummaryAt)) {
      skipped += 1;
      results.push({
        profileId,
        email,
        status: "skipped",
        reason: "Daily summary already sent today.",
      });
      continue;
    }

    const stateRows = await listUserOpportunityStates(profileId);
    const stateByItemId = new Map(stateRows.map((row) => [row.feedItemId, row]));
    const scopedItems = feedItems
      .map((item) => {
        const scored = scoreItemForProfile(item, profile);
        const opportunityState = stateByItemId.get(String(item.id)) ?? null;
        return {
          ...item,
          relevanceScore: scored.score,
          reasons: scored.reasons,
          opportunityState,
        };
      })
      .filter((item) => item.relevanceScore > 0)
      .filter((item) => matchesEmailPreferencesForProfile(item, profile))
      .sort((a, b) => b.relevanceScore - a.relevanceScore || a.title.localeCompare(b.title));

    const totalAvailable = scopedItems.length;
    const unevaluatedItems = scopedItems.filter((item) =>
      isOpportunityUnevaluated(item.opportunityState?.state),
    );
    const evaluatedItems = scopedItems.filter((item) =>
      isOpportunityEvaluated(item.opportunityState?.state),
    );
    const appliedItems = scopedItems.filter((item) => item.opportunityState?.state === "applied").length;
    const recommendedItems = unevaluatedItems.filter((item) => item.relevanceScore >= 55).length;
    const newItems = unevaluatedItems.filter((item) => {
      if (!profile.lastDailySummaryAt) {
        return true;
      }

      return new Date(item.createdAt).getTime() > new Date(profile.lastDailySummaryAt).getTime();
    }).length;

    if (totalAvailable === 0) {
      skipped += 1;
      results.push({
        profileId,
        email,
        status: "skipped",
        reason: "No matching items are currently available.",
        totalAvailable,
        unevaluatedItems: unevaluatedItems.length,
        evaluatedItems: evaluatedItems.length,
        appliedItems,
        newItems,
        recommendedItems,
      });
      continue;
    }

    const emailResult = await sendDailySummaryEmail({
      companyName: profile.companyName,
      email,
      snapshotDate: snapshotDate ?? new Date().toISOString().slice(0, 10),
      profileNaicsLabels: profile.naicsCodes.map((code) => formatNaicsLabel(code)),
      appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://hub.joche.dev/funding-ops",
      opportunitiesUrl: `${process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://hub.joche.dev/funding-ops"}/opportunities`,
      totalAvailable,
      unevaluatedItems: unevaluatedItems.length,
      evaluatedItems: evaluatedItems.length,
      appliedItems,
      newItems,
      recommendedItems,
      items: unevaluatedItems.slice(0, 5).map((item) => ({
        title: item.title,
        url: item.url,
        relevanceScore: item.relevanceScore,
        reasons: stripNaicsReason(item.reasons),
        category: item.category,
        jurisdiction: item.jurisdiction,
        deadline: item.deadline,
      })),
    });

    if (emailResult.sent) {
      await markFundingProfileDailySummarySent(profileId);
      sent += 1;
      results.push({
        profileId,
        email,
        status: "sent",
        totalAvailable,
        unevaluatedItems: unevaluatedItems.length,
        evaluatedItems: evaluatedItems.length,
        appliedItems,
        newItems,
        recommendedItems,
      });
      continue;
    }

    if (emailResult.skipped) {
      skipped += 1;
      results.push({
        profileId,
        email,
        status: "skipped",
        reason: emailResult.reason,
        totalAvailable,
        unevaluatedItems: unevaluatedItems.length,
        evaluatedItems: evaluatedItems.length,
        appliedItems,
        newItems,
        recommendedItems,
      });
      continue;
    }

    failed += 1;
    results.push({
      profileId,
      email,
      status: "failed",
      reason: "SMTP delivery failed.",
      totalAvailable,
      unevaluatedItems: unevaluatedItems.length,
      evaluatedItems: evaluatedItems.length,
      appliedItems,
      newItems,
      recommendedItems,
    });
  }

  return {
    attempted: recipients.length,
    sent,
    skipped,
    failed,
    snapshotDate,
    results,
  };
}
