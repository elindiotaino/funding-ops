import { PageHeader } from "@/components/PageHeader";
import { getFundingAppPageData } from "@/lib/funding-app";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const data = await getFundingAppPageData();

  return (
    <>
      <PageHeader
        eyebrow="Programs"
        title="Tracked funding programs will move into a dedicated pipeline view next."
        description="Phase 1 establishes the route and shell so the application model is already multi-page before the program workflow is built."
        status={`${data.dashboard.metrics.totalPrograms} tracked programs in the current database`}
      />
      <section className="panel">
        <p className="eyebrow">Phase 2</p>
        <h2>This page is reserved for the program pipeline.</h2>
        <p className="lede">
          The next step here is a proper status-based workspace for researching, active,
          submitted, awarded, and archived programs.
        </p>
      </section>
    </>
  );
}
