import { redirect } from "next/navigation";

import { canCurrentUserAccessFundingOps } from "@/lib/auth/access";
import { getFundingWorkspaceData, initializeFundingFeed } from "@/lib/feed";
import { getFundingProfileForUser } from "@/lib/funding-profile";
import { getDashboardData } from "@/lib/queries";
import { hasSupabaseAuthEnv } from "@/lib/supabase/env";
import { bootstrapDatabase } from "@/db/bootstrap";

export async function getFundingAppPageData(options?: { page?: number; pageSize?: number }) {
  const hubUrl = process.env.NEXT_PUBLIC_HUB_URL ?? "https://hub.joche.dev";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/funding-ops";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://funding-ops.joche.dev";
  const loginUrl = new URL("/login", hubUrl);
  loginUrl.searchParams.set("next", basePath);

  if (!hasSupabaseAuthEnv()) {
    redirect(loginUrl.toString() as never);
  }

  const access = await canCurrentUserAccessFundingOps();

  if (!access.user) {
    redirect(loginUrl.toString() as never);
  }

  if (!access.allowed) {
    const deniedUrl = new URL("/", hubUrl);
    deniedUrl.searchParams.set("error", "tool-access");
    redirect(deniedUrl.toString() as never);
  }

  bootstrapDatabase();
  initializeFundingFeed();
  const profile = await getFundingProfileForUser(access.user.id);

  return {
    appUrl,
    basePath,
    hubUrl,
    workspace: await getFundingWorkspaceData(options, profile),
    dashboard: getDashboardData(),
  };
}
