import { NextResponse } from "next/server";

import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { getFundingProfileForUser } from "@/lib/funding-profile";
import { triggerDailyRefresh } from "@/lib/ingest/client";

const MISSING_INGEST_CONFIG_MESSAGE =
  "Missing INGEST_SERVICE_BASE_URL or INGEST_SHARED_SECRET environment variables.";

function isCronAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${configuredSecret}`;
}

function isMissingIngestConfigError(error: unknown) {
  return error instanceof Error && error.message.includes(MISSING_INGEST_CONFIG_MESSAGE);
}

export async function GET(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
    }

    const refresh = await triggerDailyRefresh("cron");

    return NextResponse.json({
      refresh,
      dailySummary: {
        sent: false,
        skipped: true,
        reason:
          "Daily summary email is skipped in cron until per-user shared profile delivery is implemented.",
      },
    });
  } catch (error) {
    if (isMissingIngestConfigError(error)) {
      return NextResponse.json({
        refresh: {
          runId: "cron-ingest-not-configured",
          status: "partial",
          results: [],
        },
        notice:
          "The live ingest service is not configured for this deployment yet. Cron is skipping refresh instead of failing.",
        dailySummary: {
          sent: false,
          skipped: true,
          reason:
            "Daily summary email is skipped in cron until per-user shared profile delivery is implemented.",
        },
      });
    }

    console.error("Funding Ops cron refresh failed:", error);
    return NextResponse.json(
      {
        error: "Funding Ops cron refresh failed.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const access = await requireFundingOpsApiAccess();
    if (!access.ok) {
      return access.response;
    }

    const profile = await getFundingProfileForUser(access.user.id);
    const { getFundingWorkspaceData } = await import("@/lib/feed");

    try {
      const refresh = await triggerDailyRefresh(`manual:${access.user.id}`, {
        naicsCodes: profile.naicsCodes,
      });

      return NextResponse.json({
        refresh,
        workspace: await getFundingWorkspaceData(undefined, profile),
      });
    } catch (error) {
      if (isMissingIngestConfigError(error)) {
        return NextResponse.json({
          refresh: {
            runId: "manual-ingest-not-configured",
            status: "partial",
            results: [],
          },
          notice:
            "Live source refresh is not configured for this deployment yet. Showing the latest stored workspace data instead.",
          workspace: await getFundingWorkspaceData(undefined, profile),
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("Funding Ops manual refresh failed:", error);
    return NextResponse.json(
      {
        error: "Funding Ops manual refresh failed.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
