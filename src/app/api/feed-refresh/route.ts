import { NextResponse } from "next/server";

import { bootstrapDatabase } from "@/db/bootstrap";
import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { sendDailySummaryEmail } from "@/lib/email";
import {
  getDailySummaryEmailPayload,
  initializeFundingFeed,
  markDailySummarySent,
  refreshFundingFeed,
} from "@/lib/feed";

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

    bootstrapDatabase();
    initializeFundingFeed();

    const workspace = refreshFundingFeed("cron");
    const summary = getDailySummaryEmailPayload();

    if (!summary.shouldSend) {
      return NextResponse.json({ workspace, dailySummary: summary });
    }

    const emailResult = await sendDailySummaryEmail(summary.payload);
    if (emailResult.sent) {
      markDailySummarySent();
    }

    return NextResponse.json({
      workspace,
      dailySummary: emailResult.sent
        ? { sent: true }
        : { sent: false, skipped: emailResult.skipped, reason: emailResult.reason },
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
    bootstrapDatabase();
    initializeFundingFeed();

    const access = await requireFundingOpsApiAccess();
    if (!access.ok) {
      return access.response;
    }

    const workspace = refreshFundingFeed("manual");
    return NextResponse.json({ workspace });
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
