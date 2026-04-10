import { FundingOpsProgramsView } from "@/components/FundingOpsViews";
import { PageHeader } from "@/components/PageHeader";
import { getFundingAppPageData } from "@/lib/funding-app";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const data = await getFundingAppPageData();

  return (
    <>
      <PageHeader
        eyebrow="Programs"
        title="Track the application pipeline separately from feed browsing."
        description="Programs become the working set for opportunities the team is actively qualifying, submitting, or closing out."
        status={`${data.dashboard.metrics.totalPrograms} tracked programs in the current database`}
      />
      <FundingOpsProgramsView basePath={data.basePath} initialDashboard={data.dashboard} />
    </>
  );
}
