import { FundingOpsOpportunitiesView } from "@/components/FundingOpsViews";
import { PageHeader } from "@/components/PageHeader";
import { getFundingAppPageData } from "@/lib/funding-app";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; date?: string; sources?: string }>;
}) {
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10);
  const sourceKeys = (params.sources ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const data = await getFundingAppPageData({
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: 20,
    snapshotDate: params.date?.trim() || undefined,
    sourceKeys,
  });

  return (
    <>
      <PageHeader
        eyebrow="Opportunities"
        title="Search, narrow, and compare the ranked feed without mixing in configuration."
        description="This workspace is dedicated to finding the strongest matches and inspecting why they fit."
        status={`${data.workspace.metrics.totalItems} feed items across ${data.workspace.metrics.totalSources} official sources`}
      />
      <FundingOpsOpportunitiesView
        appUrl={data.appUrl}
        basePath={data.basePath}
        hubUrl={data.hubUrl}
        initialWorkspace={data.workspace}
      />
    </>
  );
}
