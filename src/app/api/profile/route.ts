import { NextResponse } from "next/server";
import { z } from "zod";

import { bootstrapDatabase } from "@/db/bootstrap";
import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { getFundingWorkspaceData, initializeFundingFeed } from "@/lib/feed";
import { saveFundingProfileForUser } from "@/lib/funding-profile";

const profileSchema = z.object({
  companyName: z.string().trim().min(1),
  companySummary: z.string().trim().min(1),
  geography: z.string().trim().min(1),
  naicsCodes: z.array(z.string().trim().min(1)).max(50),
  sectors: z.array(z.string().trim().min(1)).max(12),
  assistanceTypes: z.array(z.string().trim().min(1)).max(12),
  keywords: z.array(z.string().trim().min(1)).max(20),
  notificationMode: z.enum(["digest", "instant", "muted"]),
  notificationEmail: z.string().trim().email().or(z.literal("")),
  dailySummaryEnabled: z.boolean(),
  emailCategories: z.array(z.string().trim().min(1)).max(20),
  emailJurisdictions: z.array(z.string().trim().min(1)).max(20),
  emailTags: z.array(z.string().trim().min(1)).max(30),
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

  const profile = await saveFundingProfileForUser(access.user.id, payload.data);
  const workspace = await getFundingWorkspaceData({ viewerProfileId: access.user.id }, profile);
  return NextResponse.json({ workspace });
}
