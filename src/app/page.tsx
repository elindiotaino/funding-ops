import { redirect } from "next/navigation";

import { FundingOpsDashboard } from "@/components/FundingOpsDashboard";
import { canCurrentUserAccessFundingOps } from "@/lib/auth/access";
import { bootstrapDatabase } from "@/db/bootstrap";
import { getDashboardData } from "@/lib/queries";
import { seedCoreData } from "@/lib/seed";
import { hasSupabaseAuthEnv } from "@/lib/supabase/env";

export default async function HomePage() {
  const hubUrl = process.env.NEXT_PUBLIC_HUB_URL ?? "https://hub.joche.dev";
  const loginUrl = new URL("/login", hubUrl);
  loginUrl.searchParams.set("next", "/funding-ops");

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
  seedCoreData();

  return (
    <FundingOpsDashboard
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://funding-ops.joche.dev"}
      basePath={process.env.NEXT_PUBLIC_BASE_PATH ?? ""}
      hubUrl={process.env.NEXT_PUBLIC_HUB_URL ?? "https://hub.joche.dev"}
      initialData={getDashboardData()}
    />
  );
}
