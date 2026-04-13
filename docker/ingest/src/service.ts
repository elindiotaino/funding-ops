import { createHash } from "node:crypto";

import { runSourceAdapter } from "./adapters/index.js";
import { getNaicsKeywords, inferNaicsCodesFromText } from "./naics.js";
import { getSupabaseAdminClient } from "./supabase.js";
import { sourceRegistry, type SourceDefinition } from "./source-registry.js";
import type { IngestedOpportunity, RefreshScope } from "./types.js";

type RunStatus = "running" | "success" | "partial" | "failed";

type SourceRunResult = {
  sourceKey: string;
  status: "success" | "failed" | "skipped";
  itemsSeen: number;
  itemsInserted: number;
  itemsUpdated: number;
  itemsUnchanged: number;
  errorMessage: string | null;
};

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function ensureSources() {
  const supabase = getSupabaseAdminClient();
  const rows = sourceRegistry.map((source) => ({
    source_key: source.key,
    name: source.name,
    base_url: source.url,
    jurisdiction: source.jurisdiction,
    interface_type: source.interfaceType,
    default_cadence: source.cadence,
    active: true
  }));

  const { error } = await supabase.from("official_sources").upsert(rows, {
    onConflict: "source_key"
  });

  if (error) {
    throw error;
  }
}

async function createRun(triggeredBy: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ingestion_runs")
    .insert({
      triggered_by: triggeredBy,
      status: "running",
      sources_attempted: sourceRegistry.length
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

async function fetchSourceRecord(sourceKey: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("official_sources")
    .select("id")
    .eq("source_key", sourceKey)
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

async function recordSourceRun(runId: string, sourceId: string, result: SourceRunResult) {
  const supabase = getSupabaseAdminClient();
  const finishedAt = new Date().toISOString();

  const { error: runSourceError } = await supabase.from("ingestion_run_sources").insert({
    ingestion_run_id: runId,
    source_id: sourceId,
    status: result.status,
    completed_at: finishedAt,
    items_seen: result.itemsSeen,
    items_inserted: result.itemsInserted,
    items_updated: result.itemsUpdated,
    items_unchanged: result.itemsUnchanged,
    error_message: result.errorMessage
  });

  if (runSourceError) {
    throw runSourceError;
  }

  const { error: sourceError } = await supabase
    .from("official_sources")
    .update(
      result.status === "success"
        ? {
            last_synced_at: finishedAt,
            last_success_at: finishedAt,
            last_error_message: null
          }
        : result.status === "failed"
          ? {
            last_error_at: finishedAt,
            last_error_message: result.errorMessage
            }
          : {
            last_error_message: result.errorMessage
          }
    )
    .eq("id", sourceId);

  if (sourceError) {
    throw sourceError;
  }
}

async function finalizeRun(runId: string, status: RunStatus, results: SourceRunResult[]) {
  const supabase = getSupabaseAdminClient();
  const succeeded = results.filter((result) => result.status === "success").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const itemsUpserted = results.reduce(
    (total, result) => total + result.itemsInserted + result.itemsUpdated,
    0
  );

  const { error } = await supabase
    .from("ingestion_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      sources_succeeded: succeeded,
      sources_failed: failed,
      items_upserted: itemsUpserted
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
}

function buildDetailPayload(item: IngestedOpportunity) {
  return {
    title: item.title,
    summary: item.summary,
    eligibility: item.eligibility,
    amount: item.amount,
    deadline: item.deadline,
    geography: item.geography,
    status: item.status,
    sourceUrl: item.sourceUrl,
    sourceDetailUrl: item.sourceDetailUrl ?? item.sourceUrl,
    ...(item.detailPayload ?? {}),
  };
}

function buildCanonicalNaicsCodes(item: IngestedOpportunity) {
  if (item.naicsCodes && item.naicsCodes.length > 0) {
    return Array.from(new Set(item.naicsCodes.map((code) => code.trim()).filter(Boolean)));
  }

  return inferNaicsCodesFromText(
    [
      item.title,
      item.summary,
      item.eligibility,
      item.audience,
      item.geography,
      ...item.keywords,
      ...item.tags,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(" "),
  );
}

async function upsertItemsForSource(runId: string, sourceId: string, items: IngestedOpportunity[]) {
  const supabase = getSupabaseAdminClient();
  if (items.length === 0) {
    return {
      itemsInserted: 0,
      itemsUpdated: 0,
      itemsUnchanged: 0,
    };
  }

  const sourceItemIds = items.map((item) => item.sourceItemId);
  const { data: existingRows, error: existingError } = await supabase
    .from("feed_items")
    .select("id, source_item_id, content_hash")
    .eq("source_id", sourceId)
    .in("source_item_id", sourceItemIds);

  if (existingError) {
    throw existingError;
  }

  const existingBySourceItemId = new Map(
    (existingRows ?? []).map((row) => [String(row.source_item_id), row]),
  );

  const now = new Date().toISOString();
  const rows = items.map((item) => {
    const naicsCodes = buildCanonicalNaicsCodes(item);
    const contentHash = hashPayload({
      title: item.title,
      category: item.category,
      jurisdiction: item.jurisdiction,
      audience: item.audience,
      summary: item.summary,
      eligibility: item.eligibility,
      amount: item.amount,
      deadline: item.deadline,
      geography: item.geography,
      status: item.status,
      sourceUrl: item.sourceUrl,
      publishedAt: item.publishedAt,
      keywords: item.keywords,
      tags: item.tags,
      naicsCodes,
      detailPayload: item.detailPayload ?? null,
    });

    return {
      source_id: sourceId,
      source_item_id: item.sourceItemId,
      canonical_key: item.canonicalKey,
      title: item.title,
      category: item.category,
      jurisdiction: item.jurisdiction,
      audience: item.audience,
      summary: item.summary,
      eligibility: item.eligibility,
      amount: item.amount,
      deadline: item.deadline,
      geography: item.geography,
      status: item.status,
      source_url: item.sourceUrl,
      published_at: item.publishedAt ?? null,
      last_seen_at: now,
      last_changed_at: now,
      content_hash: contentHash,
      keywords: item.keywords,
      tags: item.tags,
      naics_codes: naicsCodes,
      updated_at: now,
    };
  });

  let itemsInserted = 0;
  let itemsUpdated = 0;
  let itemsUnchanged = 0;

  for (const row of rows) {
    const existing = existingBySourceItemId.get(row.source_item_id);
    if (!existing) {
      itemsInserted += 1;
    } else if (existing.content_hash === row.content_hash) {
      itemsUnchanged += 1;
    } else {
      itemsUpdated += 1;
    }
  }

  const { error: upsertError } = await supabase.from("feed_items").upsert(rows, {
    onConflict: "source_id,source_item_id",
  });

  if (upsertError) {
    throw upsertError;
  }

  const { data: persistedRows, error: persistedError } = await supabase
    .from("feed_items")
    .select("id, source_item_id")
    .eq("source_id", sourceId)
    .in("source_item_id", sourceItemIds);

  if (persistedError) {
    throw persistedError;
  }

  const persistedBySourceItemId = new Map(
    (persistedRows ?? []).map((row) => [String(row.source_item_id), String(row.id)]),
  );

  const snapshotRows = rows
    .map((row) => {
      const feedItemId = persistedBySourceItemId.get(row.source_item_id);
      if (!feedItemId) {
        return null;
      }

      return {
        ingestion_run_id: runId,
        feed_item_id: feedItemId,
        snapshot_date: now.slice(0, 10),
        rank_inputs: {
          naicsCodes: row.naics_codes,
          keywords: row.keywords,
          tags: row.tags,
        },
        snapshot_hash: row.content_hash,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (snapshotRows.length > 0) {
    const { error: snapshotError } = await supabase.from("feed_item_snapshots").upsert(snapshotRows, {
      onConflict: "ingestion_run_id,feed_item_id",
    });

    if (snapshotError) {
      throw snapshotError;
    }
  }

  const detailRows = items
    .map((item) => {
      const feedItemId = persistedBySourceItemId.get(item.sourceItemId);
      if (!feedItemId) {
        return null;
      }

      return {
        feed_item_id: feedItemId,
        detail_status: "fresh",
        detail_payload: buildDetailPayload(item),
        fetched_at: now,
        expires_at: null,
        source_detail_url: item.sourceDetailUrl ?? item.sourceUrl,
        error_message: null,
        updated_at: now,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (detailRows.length > 0) {
    const { error: detailError } = await supabase.from("feed_item_details").upsert(detailRows, {
      onConflict: "feed_item_id",
    });

    if (detailError) {
      throw detailError;
    }
  }

  return {
    itemsInserted,
    itemsUpdated,
    itemsUnchanged,
  };
}

export async function runDailyRefresh(triggeredBy = "manual") {
  await ensureSources();
  const runId = await createRun(triggeredBy);
  const results: SourceRunResult[] = [];
  return runDailyRefreshWithState(runId, results);
}

async function runDailyRefreshWithState(
  runId: string,
  results: SourceRunResult[],
  scope?: RefreshScope,
) {
  for (const source of sourceRegistry) {
    const sourceId = await fetchSourceRecord(source.key);

    try {
      const result = await runSourceAdapter(source, scope);
      if (result.status === "skipped") {
        const sourceResult: SourceRunResult = {
          sourceKey: source.key,
          status: "skipped",
          itemsSeen: 0,
          itemsInserted: 0,
          itemsUpdated: 0,
          itemsUnchanged: 0,
          errorMessage: result.reason,
        };

        await recordSourceRun(runId, sourceId, sourceResult);
        results.push(sourceResult);
        continue;
      }

      const counts = await upsertItemsForSource(runId, sourceId, result.items);
      const sourceResult: SourceRunResult = {
        sourceKey: source.key,
        status: "success",
        itemsSeen: result.items.length,
        itemsInserted: counts.itemsInserted,
        itemsUpdated: counts.itemsUpdated,
        itemsUnchanged: counts.itemsUnchanged,
        errorMessage: null
      };

      await recordSourceRun(runId, sourceId, sourceResult);
      results.push(sourceResult);
    } catch (error) {
      const sourceResult: SourceRunResult = {
        sourceKey: source.key,
        status: "failed",
        itemsSeen: 0,
        itemsInserted: 0,
        itemsUpdated: 0,
        itemsUnchanged: 0,
        errorMessage: error instanceof Error ? error.message : String(error)
      };

      await recordSourceRun(runId, sourceId, sourceResult);
      results.push(sourceResult);
    }
  }

  const hasFailures = results.some((result) => result.status === "failed");
  const hasSuccess = results.some((result) => result.status === "success");
  const status: RunStatus = hasFailures ? (hasSuccess ? "partial" : "failed") : "success";

  await finalizeRun(runId, status, results);

  return {
    runId,
    status,
    results
  };
}

export async function runScopedDailyRefresh(
  triggeredBy = "manual",
  inputScope?: { naicsCodes?: string[] | null },
) {
  const scope: RefreshScope | undefined =
    inputScope?.naicsCodes && inputScope.naicsCodes.length > 0
      ? {
          naicsCodes: Array.from(new Set(inputScope.naicsCodes.map((code) => code.trim()).filter(Boolean))),
          keywords: getNaicsKeywords(inputScope.naicsCodes),
        }
      : undefined;

  await ensureSources();
  const runId = await createRun(
    scope ? `${triggeredBy}:naics:${scope.naicsCodes.join("|")}` : triggeredBy,
  );
  const results: SourceRunResult[] = [];
  return runDailyRefreshWithState(runId, results, scope);
}

export async function runItemDetailRefresh(feedItemId: string) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("feed_item_details").upsert(
    {
      feed_item_id: feedItemId,
      detail_status: "stale",
      detail_payload: {
        message: "Placeholder detail refresh. Replace with source adapter detail fetch."
      },
      fetched_at: now,
      expires_at: now
    },
    {
      onConflict: "feed_item_id"
    }
  );

  if (error) {
    throw error;
  }

  return { feedItemId, refreshedAt: now };
}
