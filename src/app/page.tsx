import { redirect } from "next/navigation";

import { FundingOpsDashboard } from "@/components/FundingOpsDashboard";
import { canCurrentUserAccessFundingOps } from "@/lib/auth/access";
import { bootstrapDatabase } from "@/db/bootstrap";
import { getFundingWorkspaceData, initializeFundingFeed } from "@/lib/feed";
import { hasSupabaseAuthEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

function isNextControlFlowError(error: unknown) {
  if (error instanceof Error && error.message === "NEXT_REDIRECT") {
    return true;
  }

  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const digest = typeof error.digest === "string" ? error.digest : "";
  return digest.startsWith("NEXT_REDIRECT") || digest === "DYNAMIC_SERVER_USAGE";
}

export default async function HomePage() {
  const hubUrl = process.env.NEXT_PUBLIC_HUB_URL ?? "https://hub.joche.dev";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/funding-ops";
  const loginUrl = new URL("/login", hubUrl);
  loginUrl.searchParams.set("next", "/funding-ops");

  try {
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

    return (
      <FundingOpsDashboard
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://funding-ops.joche.dev"}
        basePath={basePath}
        hubUrl={process.env.NEXT_PUBLIC_HUB_URL ?? "https://hub.joche.dev"}
        initialData={getFundingWorkspaceData()}
      />
    );
  } catch (error) {
    if (isNextControlFlowError(error)) {
      throw error;
    }

    console.error("Critical error in funding-ops HomePage:", error);
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>500 - Internal Server Error</h1>
        <p>A critical error occurred while initializing the database or fetching data.</p>
        <pre style={{ background: "#f5f5f5", padding: "1rem", overflow: "auto" }}>
          {error instanceof Error ? error.message : String(error)}
        </pre>
      </div>
    );
  }
}
