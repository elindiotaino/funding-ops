import { AppShellLayout } from "@/components/AppShellLayout";

export default function FundingOpsAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShellLayout>{children}</AppShellLayout>;
}
