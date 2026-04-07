import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { fundingPrograms, fundingTasks } from "@/db/schema";

const taskSchema = z.object({
  programId: z.number().int().nullable().optional(),
  title: z.string().trim().min(1),
  status: z.enum(["pending", "in-progress", "complete"]),
  dueDate: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export async function GET() {
  const programs = db.select().from(fundingPrograms).all();
  const tasks = db.select().from(fundingTasks).orderBy(desc(fundingTasks.id)).all();

  return NextResponse.json({
    tasks: tasks.map((task) => ({
      ...task,
      programName:
        task.programId !== null
          ? programs.find((program) => program.id === task.programId)?.name ?? "Unknown program"
          : "Unassigned",
    })),
  });
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = taskSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid funding task payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.programId) {
    const program = db
      .select()
      .from(fundingPrograms)
      .where(eq(fundingPrograms.id, parsed.data.programId))
      .get();

    if (!program) {
      return NextResponse.json({ error: "Funding program not found." }, { status: 404 });
    }
  }

  const result = db
    .insert(fundingTasks)
    .values({
      programId: parsed.data.programId ?? null,
      title: parsed.data.title,
      status: parsed.data.status,
      dueDate: parsed.data.dueDate ?? null,
      notes: parsed.data.notes ?? null,
    })
    .run();

  const task = db
    .select()
    .from(fundingTasks)
    .where(eq(fundingTasks.id, Number(result.lastInsertRowid)))
    .get();

  const programName =
    task?.programId !== null && task?.programId !== undefined
      ? db
          .select()
          .from(fundingPrograms)
          .where(eq(fundingPrograms.id, task.programId))
          .get()?.name ?? "Unknown program"
      : "Unassigned";

  return NextResponse.json({ task: { ...task, programName } }, { status: 201 });
}
