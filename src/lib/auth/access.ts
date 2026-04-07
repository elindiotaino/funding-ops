import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseAuthEnv } from "@/lib/supabase/env";
import { getResolvedUserEmail } from "@/lib/supabase/user";

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? null;
}

function isAdminEmail(email: string | null | undefined) {
  return normalizeEmail(email) === normalizeEmail(process.env.ADMIN_EMAIL) ||
    normalizeEmail(email) === "josecancel2@gmail.com";
}

export async function canCurrentUserAccessFundingOps() {
  if (!hasSupabaseAuthEnv()) {
    return { user: null, allowed: false, configured: false };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, allowed: false, configured: true };
  }

  const email = getResolvedUserEmail(user);
  if (isAdminEmail(email)) {
    return { user, allowed: true, configured: true };
  }

  const admin = getSupabaseAdminClient();
  const [directResult, membershipResult, organizationGrantResult] = await Promise.all([
    admin
      .from("hub_user_tool_access")
      .select("tool_key")
      .eq("profile_id", user.id)
      .eq("tool_key", "funding-ops")
      .maybeSingle(),
    admin
      .from("hub_organization_members")
      .select("organization_id")
      .eq("profile_id", user.id),
    admin
      .from("hub_organization_tool_access")
      .select("organization_id, tool_key")
      .eq("tool_key", "funding-ops"),
  ]);

  const directAccess = Boolean(directResult.data);
  const membershipOrganizationIds = new Set(
    (membershipResult.data ?? []).map((membership) => membership.organization_id),
  );
  const orgAccess = (organizationGrantResult.data ?? []).some((grant) =>
    membershipOrganizationIds.has(grant.organization_id),
  );

  return {
    user,
    allowed: directAccess || orgAccess,
    configured: true,
  };
}

export async function requireFundingOpsApiAccess() {
  const access = await canCurrentUserAccessFundingOps();

  if (!access.configured) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Supabase auth is not configured." },
        { status: 500 },
      ),
    };
  }

  if (!access.user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  if (!access.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { ok: true as const, user: access.user };
}
