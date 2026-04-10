type IngestConfig = {
  port: number;
  sharedSecret: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  sourceTimeoutMs: number;
  userAgent: string;
};

function readRequired(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readNumber(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }

  return parsed;
}

export function getConfig(): IngestConfig {
  return {
    port: readNumber("INGEST_SERVICE_PORT", 8787),
    sharedSecret: readRequired("INGEST_SHARED_SECRET"),
    supabaseUrl: readRequired("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: readRequired("SUPABASE_SERVICE_ROLE_KEY"),
    sourceTimeoutMs: readNumber("INGEST_SOURCE_TIMEOUT_MS", 20000),
    userAgent: process.env.INGEST_USER_AGENT?.trim() || "FundingOpsIngest/0.1",
  };
}
