import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleEnv } from "@/lib/supabase/env";

export function getSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseServiceRoleEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
