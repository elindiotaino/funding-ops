import { NextResponse } from "next/server";

import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { getFundingProfileForUser } from "@/lib/funding-profile";
import { triggerDailyRefresh } from "@/lib/ingest/client";

function isCronAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${configuredSecret}`;
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

    const refresh = await triggerDailyRefresh(`manual:${access.user.id}`);
    const profile = await getFundingProfileForUser(access.user.id);
    const { getFundingWorkspaceData } = await import("@/lib/feed");
    return NextResponse.json({
      refresh,
      workspace: await getFundingWorkspaceData(undefined, profile),
    });
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
