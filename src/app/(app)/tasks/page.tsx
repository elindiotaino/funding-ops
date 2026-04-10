import { PageHeader } from "@/components/PageHeader";
import { getFundingAppPageData } from "@/lib/funding-app";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const data = await getFundingAppPageData();

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="Execution work gets its own operational page instead of living inside the feed."
        description="Phase 1 establishes the route and navigation now so the task workflow can land cleanly in Phase 2."
        status={`${data.dashboard.metrics.pendingTasks} open tasks in the current database`}
      />
      <section className="panel">
        <p className="eyebrow">Phase 2</p>
        <h2>This page is reserved for task execution.</h2>
        <p className="lede">
          The next step here is a grouped task view with due-soon emphasis, inline status
          changes, and direct links back to tracked programs.
        </p>
      </section>
    </>
  );
}
