# Shared Account Model

This document implements the design intent tracked in issue `#10`.

It defines how `funding-ops` should behave across:

- `joche.dev`
- `hub.joche.dev`
- `funding-ops.joche.dev`
- `jochenoyoshi.com`

## Goal

`funding-ops` must trust one canonical account system for:

- signed-in identity
- tool access grants
- organization membership
- per-user Funding Ops profile settings
- linked login providers

Without this contract, feed access and user profile persistence become ambiguous.

## Canonical source of truth

The `joche.dev` Supabase project is the authoritative identity and access store.

That project owns:

- the auth users used by `hub.joche.dev`
- the user `profile_id` consumed by `funding-ops`
- tool grants such as `funding-ops`
- organization memberships
- organization-level tool grants
- future shared per-user Funding Ops settings

`funding-ops` should not treat local SQLite, parallel Supabase projects, or
domain-specific auth state as authoritative for account identity.

## Product model

The intended product model is:

1. A person has one canonical website account in the authoritative Supabase project.
2. That account may have multiple linked login providers.
3. `hub.joche.dev` acts as the entry surface for access checks and tool discovery.
4. `funding-ops.joche.dev` trusts the same authenticated session family and the same `profile_id`.
5. A user can access `funding-ops` directly or through `hub`, but the account behind both must resolve to the same canonical identity.

## What `funding-ops` trusts

`funding-ops` should trust these values from the authoritative Supabase project:

- `auth.users.id` or the resolved Supabase user id as the canonical `profile_id`
- direct tool grants from `hub_user_tool_access`
- organization membership from `hub_organization_members`
- organization-scoped grants from `hub_organization_tool_access`
- the resolved user email only as a secondary identity attribute, not the primary key

Email should never be the durable ownership key for Funding Ops profile data.
The durable key is `profile_id`.

## Session and cookie model

The intended behavior is one shared session family across the relevant
`*.joche.dev` properties.

That means:

- signing in through `hub.joche.dev` should give the user access to `funding-ops.joche.dev`
- signing out should invalidate access consistently across those related properties
- `funding-ops` should not create an independent local auth silo

If `jochenoyoshi.com` stays on a separate Supabase project, it must be treated as
a separate product surface until an explicit migration or sync strategy exists.
Compatibility or overlap in current behavior is not enough to treat it as
authoritative.

## Provider linking rules

Provider linking is allowed, but the website account remains singular.

Rules:

- one canonical account maps to one canonical `profile_id`
- multiple providers may link to that single account
- linking a second Google account is allowed only if it attaches to the same canonical user
- provider linking must not silently create a second Funding Ops account for the same person
- the UI should present one account with multiple linked sign-in methods, not multiple separate website identities

## Multi-Google-account behavior

The expected behavior for multiple Google accounts is:

1. The user signs into the canonical account.
2. The user explicitly links another Google identity.
3. The linked identity becomes another way to authenticate into the same website account.
4. Funding Ops settings, grants, and org access remain attached to the same `profile_id`.

If a second Google sign-in would create a new Supabase user instead of linking to
the existing one, that flow must be blocked or redirected into an account-linking
step. Silent account splitting is not acceptable.

## Organization and tool access model

Tool access is granted through either:

- direct user grant
- organization membership plus organization tool grant

This matches the current runtime assumption in
[`access.ts`](/D:/Projects/funding-ops/src/lib/auth/access.ts).

`funding-ops` should continue to use this precedence:

1. authenticated user exists
2. user has direct `funding-ops` grant, or
3. user belongs to an organization with the `funding-ops` grant

Admin-email bypasses should be treated as temporary bootstrap behavior, not the
long-term authorization model.

## Funding Ops profile ownership

Future Funding Ops profile data must be keyed to the canonical `profile_id`.

That profile should include:

- `naics_codes`
- company name
- company summary
- geography
- assistance preferences
- notification preferences

Default ownership model:

- one Funding Ops profile per authenticated user

Future extension:

- optional organization-scoped Funding Ops profile for shared team use

The user-scoped model is the default until a separate org-profile feature is implemented.

## Migration guidance

The current repo still mixes two worlds:

- canonical auth and access from Supabase
- local SQLite profile storage and seed-based app reads

The next implementation steps should remove that mismatch in this order:

1. persist Funding Ops user profile settings in Supabase keyed by `profile_id`
2. add canonical `naics_codes` support to the ingest contract and shared feed schema
3. make web refresh delegate to Docker ingest
4. move web feed reads from local SQLite to Supabase

## Non-goals

This document does not define:

- cross-project account synchronization between unrelated Supabase projects
- CRM/customer-account models outside Funding Ops
- a full UI for managing provider links

Those can be added later, but they should not block the canonical identity choice above.

## Implementation consequences

From this point forward:

- issue `#12` should use `profile_id` in shared Supabase storage
- issue `#8` should treat Supabase as the canonical read path
- issue `#14` should keep auth in the web app and ingestion in Docker
- local SQLite should be treated as a legacy/dev fallback, not the authority for authenticated production users
