import { desc } from "drizzle-orm";

import { db } from "@/db";
import { fundingPrograms, fundingTasks } from "@/db/schema";

function normalizeDeadline(deadline: string | null) {
  if (!deadline) {
    return null;
  }

  if (/ongoing/i.test(deadline) || /varies/i.test(deadline) || /tbd/i.test(deadline)) {
    return null;
  }

  return deadline;
}

export function getDashboardData() {
  const programs = db.select().from(fundingPrograms).orderBy(desc(fundingPrograms.id)).all();
  const tasks = db.select().from(fundingTasks).orderBy(desc(fundingTasks.id)).all();

  const tasksWithPrograms = tasks.map((task) => ({
    ...task,
    programName:
      task.programId !== null
        ? programs.find((program) => program.id === task.programId)?.name ?? "Unknown program"
        : "Unassigned",
  }));

  const urgentDeadlines = programs
    .map((program) => ({
      ...program,
      normalizedDeadline: normalizeDeadline(program.deadline),
    }))
    .filter((program) => program.normalizedDeadline)
    .sort((a, b) => a.normalizedDeadline!.localeCompare(b.normalizedDeadline!))
    .slice(0, 5)
    .map(({ normalizedDeadline: _normalizedDeadline, ...program }) => program);

  return {
    programs,
    tasks: tasksWithPrograms,
    metrics: {
      totalPrograms: programs.length,
      activePrograms: programs.filter((program) => program.status === "active").length,
      submittedPrograms: programs.filter((program) => program.status === "submitted").length,
      awardedPrograms: programs.filter((program) => program.status === "awarded").length,
      pendingTasks: tasks.filter((task) => task.status !== "complete").length,
    },
    urgentDeadlines,
  };
}

export type FundingDashboardData = ReturnType<typeof getDashboardData>;
