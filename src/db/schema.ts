import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const fundingPrograms = sqliteTable("funding_programs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  sponsor: text("sponsor"),
  maxFunding: text("max_funding"),
  eligibility: text("eligibility"),
  deadline: text("deadline"),
  sourceUrl: text("source_url"),
  status: text("status").notNull().default("researching"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const fundingTasks = sqliteTable("funding_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id").references(() => fundingPrograms.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  status: text("status").notNull().default("pending"),
  dueDate: text("due_date"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
