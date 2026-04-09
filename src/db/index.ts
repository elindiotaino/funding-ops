import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as schema from "@/db/schema";

function getCandidateDatabasePaths() {
  const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
  const candidates = [
    configuredDatabaseUrl ? path.resolve(process.cwd(), configuredDatabaseUrl) : null,
    path.join(os.tmpdir(), "funding-ops.db"),
    path.resolve(process.cwd(), "./data/funding-ops.db"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return Array.from(new Set(candidates));
}

function openSqliteDatabase() {
  for (const candidatePath of getCandidateDatabasePaths()) {
    try {
      fs.mkdirSync(path.dirname(candidatePath), { recursive: true });
      return new Database(candidatePath);
    } catch (error) {
      console.warn(`Could not open database at ${candidatePath}. Trying next fallback.`, error);
    }
  }

  console.warn("Falling back to in-memory Funding Ops database.");
  return new Database(":memory:");
}

const sqlite = openSqliteDatabase();

try {
  sqlite.pragma("journal_mode = WAL");
} catch (error) {
  console.warn("Could not enable WAL journal mode for Funding Ops database.", error);
}

try {
  sqlite.pragma("foreign_keys = ON");
} catch (error) {
  console.warn("Could not enable foreign key support for Funding Ops database.", error);
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
