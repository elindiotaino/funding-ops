import { sqlite } from "@/db";

export function bootstrapDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS funding_programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sponsor TEXT,
      max_funding TEXT,
      eligibility TEXT,
      deadline TEXT,
      source_url TEXT,
      status TEXT NOT NULL DEFAULT 'researching',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS funding_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      due_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (program_id) REFERENCES funding_programs(id) ON DELETE SET NULL
    );
  `);
}
