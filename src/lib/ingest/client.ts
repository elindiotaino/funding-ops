type DailyRefreshResponse = {
  runId: string;
  status: "success" | "partial" | "failed";
  results: Array<{
    sourceKey: string;
    status: "success" | "failed" | "skipped";
    itemsSeen: number;
    itemsInserted: number;
    itemsUpdated: number;
    itemsUnchanged: number;
    errorMessage: string | null;
  }>;
};

type ItemDetailRefreshResponse = {
  feedItemId: string;
  refreshedAt: string;
};

function getIngestConfig() {
  const baseUrl = process.env.INGEST_SERVICE_BASE_URL?.trim();
  const sharedSecret = process.env.INGEST_SHARED_SECRET?.trim();

  if (!baseUrl || !sharedSecret) {
    throw new Error(
      "Missing INGEST_SERVICE_BASE_URL or INGEST_SHARED_SECRET environment variables.",
    );
  }

  return { baseUrl, sharedSecret };
}

export async function triggerDailyRefresh(triggeredBy: string) {
  const { baseUrl, sharedSecret } = getIngestConfig();
  const response = await fetch(new URL("/jobs/daily-refresh", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ingest-secret": sharedSecret,
    },
    body: JSON.stringify({ triggeredBy }),
    cache: "no-store",
  });

  const payload = (await response.json()) as DailyRefreshResponse | { error?: string; detail?: string };
  if (!response.ok) {
    const message =
      "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Ingest refresh request failed.";
    const detail =
      "detail" in payload && typeof payload.detail === "string" ? payload.detail : null;
    throw new Error(detail ? `${message} ${detail}` : message);
  }

  return payload as DailyRefreshResponse;
}

export async function triggerItemDetailRefresh(feedItemId: string) {
  const { baseUrl, sharedSecret } = getIngestConfig();
  const response = await fetch(new URL(`/jobs/item/${feedItemId}/detail-refresh`, baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ingest-secret": sharedSecret,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as ItemDetailRefreshResponse | { error?: string; detail?: string };
  if (!response.ok) {
    const message =
      "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Ingest detail refresh request failed.";
    const detail =
      "detail" in payload && typeof payload.detail === "string" ? payload.detail : null;
    throw new Error(detail ? `${message} ${detail}` : message);
  }

  return payload as ItemDetailRefreshResponse;
}
