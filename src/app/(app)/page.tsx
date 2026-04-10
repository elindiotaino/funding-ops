import { FundingOpsDashboardView } from "@/components/FundingOpsViews";
import { PageHeader } from "@/components/PageHeader";
import { getFundingAppPageData } from "@/lib/funding-app";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getFundingAppPageData();

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Keep the daily funding picture visible without burying the next action."
        description="This page stays focused on what changed, what is relevant, and what operational work needs attention next."
        status={
          data.workspace.lastIngestionRun
            ? `Last refresh ${data.workspace.lastIngestionRun.createdAt.slice(0, 10)} by ${data.workspace.lastIngestionRun.triggeredBy}`
            : "Feed has not been refreshed yet."
        }
      />
      <FundingOpsDashboardView
        appUrl={data.appUrl}
        basePath={data.basePath}
        hubUrl={data.hubUrl}
        initialDashboard={data.dashboard}
        initialWorkspace={data.workspace}
      />
    </>
  );
}
