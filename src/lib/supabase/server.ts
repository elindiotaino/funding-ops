import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseCookieOptions } from "@/lib/supabase/cookies";
import { getSupabaseAuthEnv } from "@/lib/supabase/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseAuthEnv();

  return createServerClient(url, publishableKey, {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components may be read-only for cookies.
        }
      },
    },
  });
}
