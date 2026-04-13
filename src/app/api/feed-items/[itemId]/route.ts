import { NextResponse } from "next/server";

import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { triggerItemDetailRefresh } from "@/lib/ingest/client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function asStringArray(value: unknown) {
  if (!value) {
    return [] as string[];
  }

  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  }

  return [];
}

async function loadFeedItemDetail(itemId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: item, error: itemError } = await supabase
    .from("feed_items")
    .select(
      "id, title, category, jurisdiction, audience, summary, eligibility, amount, deadline, geography, status, source_url, updated_at, created_at, canonical_key, keywords, tags, naics_codes, official_sources(source_key, name)",
    )
    .eq("id", itemId)
    .single();

  if (itemError) {
    throw itemError;
  }

  const { data: detail, error: detailError } = await supabase
    .from("feed_item_details")
    .select("detail_status, detail_payload, fetched_at, expires_at, source_detail_url, error_message")
    .eq("feed_item_id", itemId)
    .maybeSingle();

  if (detailError) {
    throw detailError;
  }

  const source = Array.isArray(item.official_sources) ? item.official_sources[0] : item.official_sources;

  return {
    item: {
      id: String(item.id),
      itemKey: String(item.canonical_key),
      title: String(item.title),
      category: String(item.category),
      jurisdiction: String(item.jurisdiction),
      audience: item.audience ? String(item.audience) : "",
      summary: item.summary ? String(item.summary) : "",
      eligibility: item.eligibility ? String(item.eligibility) : "",
      amount: item.amount ? String(item.amount) : null,
      deadline: item.deadline ? String(item.deadline) : null,
      geography: item.geography ? String(item.geography) : "",
      status: String(item.status),
      url: String(item.source_url),
      updatedAt: String(item.updated_at),
      createdAt: String(item.created_at),
      keywords: asStringArray(item.keywords),
      tags: asStringArray(item.tags),
      naicsCodes: asStringArray(item.naics_codes),
      sourceKey: source?.source_key ? String(source.source_key) : "unknown-source",
      sourceName: source?.name ? String(source.name) : "Unknown source",
    },
    detail: detail
      ? {
          detailStatus: String(detail.detail_status),
          detailPayload:
            detail.detail_payload && typeof detail.detail_payload === "object" ? detail.detail_payload : {},
          fetchedAt: detail.fetched_at ? String(detail.fetched_at) : null,
          expiresAt: detail.expires_at ? String(detail.expires_at) : null,
          sourceDetailUrl: detail.source_detail_url ? String(detail.source_detail_url) : null,
          errorMessage: detail.error_message ? String(detail.error_message) : null,
        }
      : {
          detailStatus: "missing",
          detailPayload: {},
          fetchedAt: null,
          expiresAt: null,
          sourceDetailUrl: null,
          errorMessage: null,
        },
  };
}

export async function GET(_: Request, context: { params: Promise<{ itemId: string }> }) {
  const access = await requireFundingOpsApiAccess();
  if (!access.ok) {
    return access.response;
  }

  try {
    const { itemId } = await context.params;
    return NextResponse.json(await loadFeedItemDetail(itemId));
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not load feed item detail.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(_: Request, context: { params: Promise<{ itemId: string }> }) {
  const access = await requireFundingOpsApiAccess();
  if (!access.ok) {
    return access.response;
  }

  try {
    const { itemId } = await context.params;
    const refresh = await triggerItemDetailRefresh(itemId);
    return NextResponse.json({
      refresh,
      detail: await loadFeedItemDetail(itemId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not refresh feed item detail.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
