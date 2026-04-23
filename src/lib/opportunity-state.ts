import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const opportunityStates = [
  "new",
  "to-evaluate",
  "interested",
  "applied",
  "waiting",
  "not-a-fit",
  "archived",
  "won",
] as const;

export type OpportunityStateValue = (typeof opportunityStates)[number];

export type UserOpportunityStateRecord = {
  id: string;
  profileId: string;
  feedItemId: string;
  state: OpportunityStateValue;
  decisionReason: string | null;
  decisionNote: string | null;
  appliedAt: string | null;
  followUpAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserOpportunityStateRow = {
  id: string;
  profile_id: string;
  feed_item_id: string;
  state: OpportunityStateValue;
  decision_reason: string | null;
  decision_note: string | null;
  applied_at: string | null;
  follow_up_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertOpportunityStateInput = {
  feedItemIds: string[];
  state: OpportunityStateValue;
  decisionReason?: string | null;
  decisionNote?: string | null;
  appliedAt?: string | null;
  followUpAt?: string | null;
  archivedAt?: string | null;
};

function mapRow(row: UserOpportunityStateRow): UserOpportunityStateRecord {
  return {
    id: row.id,
    profileId: row.profile_id,
    feedItemId: row.feed_item_id,
    state: row.state,
    decisionReason: row.decision_reason,
    decisionNote: row.decision_note,
    appliedAt: row.applied_at,
    followUpAt: row.follow_up_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listUserOpportunityStates(profileId: string, feedItemIds?: string[]) {
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("user_opportunity_states")
    .select(`
      id,
      profile_id,
      feed_item_id,
      state,
      decision_reason,
      decision_note,
      applied_at,
      follow_up_at,
      archived_at,
      created_at,
      updated_at
    `)
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });

  if (feedItemIds && feedItemIds.length > 0) {
    query = query.in("feed_item_id", feedItemIds);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return ((data ?? []) as UserOpportunityStateRow[]).map(mapRow);
}

export async function upsertUserOpportunityStates(
  profileId: string,
  input: UpsertOpportunityStateInput,
) {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const payload = input.feedItemIds.map((feedItemId) => ({
    profile_id: profileId,
    feed_item_id: feedItemId,
    state: input.state,
    decision_reason: input.decisionReason?.trim() || null,
    decision_note: input.decisionNote?.trim() || null,
    applied_at: input.appliedAt ?? null,
    follow_up_at: input.followUpAt ?? null,
    archived_at:
      input.archivedAt !== undefined
        ? input.archivedAt
        : input.state === "archived"
          ? now
          : null,
    updated_at: now,
  }));

  const { error } = await admin
    .from("user_opportunity_states")
    .upsert(payload, { onConflict: "profile_id,feed_item_id" });

  if (error) {
    throw error;
  }

  return listUserOpportunityStates(profileId, input.feedItemIds);
}
