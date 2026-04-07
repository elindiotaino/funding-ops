import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireFundingOpsApiAccess } from "@/lib/auth/access";
import { db } from "@/db";
import { fundingTasks } from "@/db/schema";

const updateTaskSchema = z.object({
  status: z.enum(["pending", "in-progress", "complete"]),
});

function parseTaskId(value: string) {
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
  const taskId = parseTaskId(id);

  if (!taskId) {
    return NextResponse.json({ error: "Invalid funding task id." }, { status: 400 });
  }

  const parsed = updateTaskSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid task update payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existingTask = db.select().from(fundingTasks).where(eq(fundingTasks.id, taskId)).get();
  if (!existingTask) {
    return NextResponse.json({ error: "Funding task not found." }, { status: 404 });
  }

  db.update(fundingTasks).set({ status: parsed.data.status }).where(eq(fundingTasks.id, taskId)).run();

  const task = db.select().from(fundingTasks).where(eq(fundingTasks.id, taskId)).get();
  return NextResponse.json({ task });
}
