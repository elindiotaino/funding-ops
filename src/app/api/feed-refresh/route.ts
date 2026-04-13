import { NextResponse } from "next/server";

import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { getFundingProfileForUser } from "@/lib/funding-profile";

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

    const { bootstrapDatabase } = await import("@/db/bootstrap");
    const {
      initializeFundingFeed,
      refreshFundingFeed,
    } = await import("@/lib/feed");

    bootstrapDatabase();
    initializeFundingFeed();

    const workspace = await refreshFundingFeed("cron");

    return NextResponse.json({
      workspace,
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
    const { bootstrapDatabase } = await import("@/db/bootstrap");
    const { initializeFundingFeed, refreshFundingFeed } = await import("@/lib/feed");

    bootstrapDatabase();
    initializeFundingFeed();

    const access = await requireFundingOpsApiAccess();
    if (!access.ok) {
      return access.response;
    }

    await refreshFundingFeed("manual");
    const profile = await getFundingProfileForUser(access.user.id);
    const { getFundingWorkspaceData } = await import("@/lib/feed");
    return NextResponse.json({ workspace: await getFundingWorkspaceData(undefined, profile) });
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
