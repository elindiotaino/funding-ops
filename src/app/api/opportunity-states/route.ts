import { NextResponse } from "next/server";
import { z } from "zod";

import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import {
  listUserOpportunityStates,
  opportunityStates,
  upsertUserOpportunityStates,
} from "@/lib/opportunity-state";

const stateSchema = z.object({
  feedItemIds: z.array(z.string().uuid()).min(1).max(100),
  state: z.enum(opportunityStates),
  decisionReason: z.string().trim().max(240).nullable().optional(),
  decisionNote: z.string().trim().max(4000).nullable().optional(),
  appliedAt: z.string().trim().nullable().optional(),
  followUpAt: z.string().trim().nullable().optional(),
  archivedAt: z.string().trim().nullable().optional(),
});

export async function GET(request: Request) {
  const access = await requireFundingOpsApiAccess();
  if (!access.ok) {
    return access.response;
  }

  const { searchParams } = new URL(request.url);
  const itemIds = searchParams.getAll("itemId").map((value) => value.trim()).filter(Boolean);
  const states = await listUserOpportunityStates(access.user.id, itemIds.length > 0 ? itemIds : undefined);

  return NextResponse.json({ states });
}

export async function POST(request: Request) {
  const access = await requireFundingOpsApiAccess();
  if (!access.ok) {
    return access.response;
  }

  const parsed = stateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid opportunity state payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const states = await upsertUserOpportunityStates(access.user.id, parsed.data);
  return NextResponse.json({ states });
}
