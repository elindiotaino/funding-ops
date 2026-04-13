import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { defaultProfile, type CompanyProfileInput, type RawCompanyProfile } from "@/lib/feed";

type FundingProfileRow = {
  profile_id: string;
  company_name: string | null;
  company_summary: string | null;
  geography: string | null;
  naics_codes: unknown;
  sectors: unknown;
  assistance_types: unknown;
  keywords: unknown;
  notification_mode: string | null;
  notification_email: string | null;
  daily_summary_enabled: boolean | null;
  email_categories: unknown;
  email_jurisdictions: unknown;
  email_tags: unknown;
  last_daily_summary_at: string | null;
  updated_at: string | null;
};

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function trimOrFallback(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function normalizeNotificationMode(value: string | null | undefined) {
  return value === "digest" || value === "instant" || value === "muted"
    ? value
    : defaultProfile.notificationMode;
}

function mapRowToProfile(row: FundingProfileRow): RawCompanyProfile {
  return {
    id: 1,
    companyName: trimOrFallback(row.company_name, defaultProfile.companyName),
    companySummary: trimOrFallback(row.company_summary, defaultProfile.companySummary),
    geography: trimOrFallback(row.geography, defaultProfile.geography),
    naicsCodes: asStringArray(row.naics_codes),
    sectors: asStringArray(row.sectors),
    assistanceTypes: asStringArray(row.assistance_types),
    keywords: asStringArray(row.keywords),
    notificationMode: normalizeNotificationMode(row.notification_mode),
    notificationEmail: row.notification_email?.trim() ?? "",
    dailySummaryEnabled: Boolean(row.daily_summary_enabled),
    emailCategories: asStringArray(row.email_categories),
    emailJurisdictions: asStringArray(row.email_jurisdictions),
    emailTags: asStringArray(row.email_tags),
    lastDailySummaryAt: row.last_daily_summary_at,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

function buildDefaultUserProfile(): RawCompanyProfile {
  return {
    id: 1,
    ...defaultProfile,
    lastDailySummaryAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function getFundingProfileForUser(profileId: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("funding_ops_user_profiles")
    .select(
      `
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
        last_daily_summary_at,
        updated_at
      `,
    )
    .eq("profile_id", profileId)
    .maybeSingle<FundingProfileRow>();

  if (error) {
    throw error;
  }

  return data ? mapRowToProfile(data) : buildDefaultUserProfile();
}

export async function saveFundingProfileForUser(
  profileId: string,
  input: CompanyProfileInput,
) {
  const admin = getSupabaseAdminClient();
  const payload = {
    profile_id: profileId,
    company_name: input.companyName.trim(),
    company_summary: input.companySummary.trim(),
    geography: input.geography.trim(),
    naics_codes: input.naicsCodes,
    sectors: input.sectors,
    assistance_types: input.assistanceTypes,
    keywords: input.keywords,
    notification_mode: input.notificationMode,
    notification_email: input.notificationEmail.trim(),
    daily_summary_enabled: input.dailySummaryEnabled,
    email_categories: input.emailCategories,
    email_jurisdictions: input.emailJurisdictions,
    email_tags: input.emailTags,
  };

  const { error } = await admin
    .from("funding_ops_user_profiles")
    .upsert(payload, { onConflict: "profile_id" });

  if (error) {
    throw error;
  }

  return getFundingProfileForUser(profileId);
}

export async function markFundingProfileDailySummarySent(profileId: string) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("funding_ops_user_profiles")
    .update({
      last_daily_summary_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}
