import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the current environment.",
  );
}

const client = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const requiredTables = [
  { table: "official_sources", select: "id,source_key" },
  { table: "ingestion_runs", select: "id,status" },
  { table: "ingestion_run_sources", select: "id,status" },
  { table: "feed_items", select: "id,canonical_key" },
  { table: "feed_item_snapshots", select: "id,snapshot_date" },
  { table: "feed_item_details", select: "id,detail_status" },
];

const results = [];

for (const entry of requiredTables) {
  const { error } = await client.from(entry.table).select(entry.select).limit(1);
  results.push({
    table: entry.table,
    ok: !error,
    error: error?.message ?? null,
    code: error?.code ?? null,
  });
}

console.log(JSON.stringify(results, null, 2));

if (results.some((entry) => !entry.ok)) {
  process.exitCode = 1;
}
