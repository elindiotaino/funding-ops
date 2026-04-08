import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as schema from "@/db/schema";

function getCandidateDatabasePaths() {
  const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();

  if (configuredDatabaseUrl) {
    return [path.resolve(process.cwd(), configuredDatabaseUrl)];
  }

  return [
    path.resolve(process.cwd(), "./data/funding-ops.db"),
    path.join(os.tmpdir(), "funding-ops.db"),
  ];
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
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
