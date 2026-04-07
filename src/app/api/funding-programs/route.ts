import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { db } from "@/db";
import { fundingPrograms } from "@/db/schema";

const programSchema = z.object({
  name: z.string().trim().min(1),
  sponsor: z.string().trim().nullable().optional(),
  maxFunding: z.string().trim().nullable().optional(),
  eligibility: z.string().trim().nullable().optional(),
  deadline: z.string().trim().nullable().optional(),
  sourceUrl: z.string().trim().nullable().optional(),
  status: z.enum(["researching", "active", "submitted", "awarded", "archived"]),
  notes: z.string().trim().nullable().optional(),
});

export async function GET() {
  const access = await requireFundingOpsApiAccess();
  if (!access.ok) {
    return access.response;
  }

  const programs = db.select().from(fundingPrograms).orderBy(desc(fundingPrograms.id)).all();
  return NextResponse.json({ programs });
}

export async function POST(request: Request) {
  const access = await requireFundingOpsApiAccess();
  if (!access.ok) {
    return access.response;
  }

  const json = await request.json();
  const parsed = programSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid funding program payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    db.insert(fundingPrograms)
      .values({
        name: parsed.data.name,
        sponsor: parsed.data.sponsor ?? null,
        maxFunding: parsed.data.maxFunding ?? null,
        eligibility: parsed.data.eligibility ?? null,
        deadline: parsed.data.deadline ?? null,
        sourceUrl: parsed.data.sourceUrl ?? null,
        status: parsed.data.status,
        notes: parsed.data.notes ?? null,
      })
      .run();
  } catch {
    return NextResponse.json(
      { error: "Could not insert funding program. Name must be unique." },
      { status: 409 },
    );
  }

  const program = db.select().from(fundingPrograms).where(eq(fundingPrograms.name, parsed.data.name)).get();
  return NextResponse.json({ program }, { status: 201 });
}
