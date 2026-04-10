import { FundingOpsTasksView } from "@/components/FundingOpsViews";
import { PageHeader } from "@/components/PageHeader";
import { getFundingAppPageData } from "@/lib/funding-app";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const data = await getFundingAppPageData();

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="Manage execution work without mixing it into the discovery flow."
        description="Tasks now have a dedicated page for capture, status changes, and due-date visibility."
        status={`${data.dashboard.metrics.pendingTasks} open tasks in the current database`}
      />
      <FundingOpsTasksView basePath={data.basePath} initialDashboard={data.dashboard} />
    </>
  );
}
