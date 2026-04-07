import { FundingOpsDashboard } from "@/components/FundingOpsDashboard";
import { bootstrapDatabase } from "@/db/bootstrap";
import { getDashboardData } from "@/lib/queries";
import { seedCoreData } from "@/lib/seed";

export default function HomePage() {
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
