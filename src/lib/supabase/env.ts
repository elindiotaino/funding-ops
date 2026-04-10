const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_SERVICE_ROLE_ENV = "SUPABASE_SERVICE_ROLE_KEY";

export function hasSupabaseAuthEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseAuthEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      `Missing ${SUPABASE_URL_ENV} or ${SUPABASE_KEY_ENV} environment variables.`,
    );
  }

  return { url, publishableKey };
}

export function getSupabaseServiceRoleEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      `Missing NEXT_PUBLIC_SUPABASE_URL or ${SUPABASE_SERVICE_ROLE_ENV} environment variables.`,
    );
  }

  return { url, serviceRoleKey };
}

export function hasSupabaseServiceRoleEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}
