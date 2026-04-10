import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { db } from "@/db";
import { fundingPrograms } from "@/db/schema";

const updateProgramSchema = z.object({
  name: z.string().trim().min(1).optional(),
  sponsor: z.string().trim().nullable().optional(),
  maxFunding: z.string().trim().nullable().optional(),
  eligibility: z.string().trim().nullable().optional(),
  deadline: z.string().trim().nullable().optional(),
  sourceUrl: z.string().trim().nullable().optional(),
  status: z.enum(["researching", "active", "submitted", "awarded", "archived"]).optional(),
  notes: z.string().trim().nullable().optional(),
});

function parseProgramId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireFundingOpsApiAccess();
  if (!access.ok) {
    return access.response;
  }

  const { id } = await params;
  const programId = parseProgramId(id);

  if (!programId) {
    return NextResponse.json({ error: "Invalid funding program id." }, { status: 400 });
  }

  const parsed = updateProgramSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid program update payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existingProgram = db
    .select()
    .from(fundingPrograms)
    .where(eq(fundingPrograms.id, programId))
    .get();

  if (!existingProgram) {
    return NextResponse.json({ error: "Funding program not found." }, { status: 404 });
  }

  try {
    db.update(fundingPrograms)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.sponsor !== undefined ? { sponsor: parsed.data.sponsor ?? null } : {}),
        ...(parsed.data.maxFunding !== undefined
          ? { maxFunding: parsed.data.maxFunding ?? null }
          : {}),
        ...(parsed.data.eligibility !== undefined
          ? { eligibility: parsed.data.eligibility ?? null }
          : {}),
        ...(parsed.data.deadline !== undefined ? { deadline: parsed.data.deadline ?? null } : {}),
        ...(parsed.data.sourceUrl !== undefined
          ? { sourceUrl: parsed.data.sourceUrl ?? null }
          : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes ?? null } : {}),
      })
      .where(eq(fundingPrograms.id, programId))
      .run();
  } catch {
    return NextResponse.json(
      { error: "Could not update funding program. Name must be unique." },
      { status: 409 },
    );
  }

  const program = db
    .select()
    .from(fundingPrograms)
    .where(eq(fundingPrograms.id, programId))
    .get();

  return NextResponse.json({ program });
}
