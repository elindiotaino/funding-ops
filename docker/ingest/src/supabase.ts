import { createClient } from "@supabase/supabase-js";

import { getConfig } from "./config.js";

export function getSupabaseAdminClient() {
  const config = getConfig();

  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
