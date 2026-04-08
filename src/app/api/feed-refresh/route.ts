import { NextResponse } from "next/server";

import { bootstrapDatabase } from "@/db/bootstrap";
import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { initializeFundingFeed, refreshFundingFeed } from "@/lib/feed";

function isCronAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${configuredSecret}`;
}

export async function GET(request: Request) {
  bootstrapDatabase();
  initializeFundingFeed();

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const workspace = refreshFundingFeed("cron");
  return NextResponse.json({ workspace });
}

export async function POST() {
  bootstrapDatabase();
  initializeFundingFeed();

  const access = await requireFundingOpsApiAccess();
  if (!access.ok) {
    return access.response;
  }

  const workspace = refreshFundingFeed("manual");
  return NextResponse.json({ workspace });
}
