export function getSupabaseCookieOptions(origin?: string) {
  const siteUrl = origin ?? process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";

  if (!siteUrl) {
    return { path: "/" };
  }

  try {
    const { protocol, hostname } = new URL(siteUrl);
    const isJocheDomain =
      hostname === "joche.dev" || hostname.endsWith(".joche.dev");

    return {
      path: "/",
      domain: isJocheDomain ? ".joche.dev" : undefined,
      secure: protocol === "https:",
      sameSite: "lax" as const,
    };
  } catch {
    return { path: "/" };
  }
}
