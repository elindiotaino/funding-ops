import { FundingOpsSettingsView } from "@/components/FundingOpsViews";
import { PageHeader } from "@/components/PageHeader";
import { getFundingAppPageData } from "@/lib/funding-app";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const data = await getFundingAppPageData();

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Keep profile and notification rules separate from the opportunity workflow."
        description="Company context, ranking inputs, and digest preferences live here so the operational screens can stay focused."
        status={`Notification mode: ${data.workspace.profile.notificationMode}`}
      />
      <FundingOpsSettingsView basePath={data.basePath} initialWorkspace={data.workspace} />
    </>
  );
}
