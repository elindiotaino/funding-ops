import type { User, UserIdentity } from "@supabase/supabase-js";

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function getNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getUserIdentities(
  user: User | null,
  identities: unknown = user?.identities ?? [],
) {
  if (!Array.isArray(identities)) {
    return [] as UserIdentity[];
  }

  return identities.filter(
    (identity): identity is UserIdentity =>
      Boolean(identity) && typeof identity === "object",
  );
}

function collectEmailCandidate(
  candidates: string[],
  seen: Set<string>,
  value: unknown,
) {
  const normalizedValue = getNonEmptyString(value);

  if (!normalizedValue) {
    return;
  }

  const normalized = normalizedValue.toLowerCase();

  if (seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  candidates.push(normalizedValue);
}

export function getResolvedUserEmail(
  user: User | null,
  identities: unknown = user?.identities ?? [],
) {
  if (!user) {
    return null;
  }

  const metadata = asRecord(user.user_metadata);
  const appMetadata = asRecord(user.app_metadata);
  const candidates: string[] = [];
  const seen = new Set<string>();

  collectEmailCandidate(candidates, seen, user.email);
  collectEmailCandidate(candidates, seen, metadata.email);
  collectEmailCandidate(candidates, seen, appMetadata.email);

  getUserIdentities(user, identities).forEach((identity) => {
    const identityData = asRecord(identity.identity_data);
    collectEmailCandidate(candidates, seen, identityData.email);
  });

  return candidates[0] ?? null;
}
