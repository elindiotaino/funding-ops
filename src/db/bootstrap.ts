import { sqlite } from "@/db";

function ensureCompanyProfileColumn(columnName: string, definition: string) {
  const columns = sqlite.prepare("PRAGMA table_info(company_profile)").all() as Array<{
    name: string;
  }>;

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  sqlite.exec(`ALTER TABLE company_profile ADD COLUMN ${columnName} ${definition};`);
}

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

    CREATE TABLE IF NOT EXISTS official_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      interface_type TEXT NOT NULL,
      program_types TEXT NOT NULL DEFAULT '[]',
      update_cadence TEXT NOT NULL,
      summary TEXT NOT NULL,
      last_synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS feed_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_key TEXT NOT NULL UNIQUE,
      source_key TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      audience TEXT NOT NULL,
      summary TEXT NOT NULL,
      eligibility TEXT NOT NULL,
      amount TEXT,
      deadline TEXT,
      geography TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      url TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS company_profile (
      id INTEGER PRIMARY KEY,
      company_name TEXT NOT NULL,
      company_summary TEXT NOT NULL,
      geography TEXT NOT NULL,
      naics_codes TEXT NOT NULL DEFAULT '[]',
      sectors TEXT NOT NULL DEFAULT '[]',
      assistance_types TEXT NOT NULL DEFAULT '[]',
      keywords TEXT NOT NULL DEFAULT '[]',
      notification_mode TEXT NOT NULL DEFAULT 'digest',
      notification_email TEXT,
      daily_summary_enabled INTEGER NOT NULL DEFAULT 0,
      email_categories TEXT NOT NULL DEFAULT '[]',
      email_jurisdictions TEXT NOT NULL DEFAULT '[]',
      email_tags TEXT NOT NULL DEFAULT '[]',
      last_daily_summary_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ingestion_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      triggered_by TEXT NOT NULL,
      notes TEXT,
      sources_upserted INTEGER NOT NULL DEFAULT 0,
      items_upserted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      relevance_score INTEGER NOT NULL DEFAULT 0,
      reasons TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_feed_items_category ON feed_items(category);
    CREATE INDEX IF NOT EXISTS idx_feed_items_jurisdiction ON feed_items(jurisdiction);
    CREATE INDEX IF NOT EXISTS idx_feed_items_source_key ON feed_items(source_key);
    CREATE INDEX IF NOT EXISTS idx_notifications_score ON notifications(relevance_score DESC);
  `);

  ensureCompanyProfileColumn("email_categories", "TEXT NOT NULL DEFAULT '[]'");
  ensureCompanyProfileColumn("email_jurisdictions", "TEXT NOT NULL DEFAULT '[]'");
  ensureCompanyProfileColumn("email_tags", "TEXT NOT NULL DEFAULT '[]'");
  ensureCompanyProfileColumn("naics_codes", "TEXT NOT NULL DEFAULT '[]'");
}
