import { NextResponse } from "next/server";
import { z } from "zod";

import { bootstrapDatabase } from "@/db/bootstrap";
import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { initializeFundingFeed, saveCompanyProfile } from "@/lib/feed";

const profileSchema = z.object({
  companyName: z.string().trim().min(1),
  companySummary: z.string().trim().min(1),
  geography: z.string().trim().min(1),
  sectors: z.array(z.string().trim().min(1)).max(12),
  assistanceTypes: z.array(z.string().trim().min(1)).max(12),
  keywords: z.array(z.string().trim().min(1)).max(20),
  notificationMode: z.enum(["digest", "instant", "muted"]),
});

export async function POST(request: Request) {
  bootstrapDatabase();
  initializeFundingFeed();

  const access = await requireFundingOpsApiAccess();
  if (!access.ok) {
    return access.response;
  }

  const payload = profileSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid profile payload.", issues: payload.error.flatten() },
      { status: 400 },
    );
  }

  const workspace = saveCompanyProfile(payload.data);
  return NextResponse.json({ workspace });
}
