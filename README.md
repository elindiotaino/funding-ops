# Funding Ops

`funding-ops` is a standalone extraction of the `Funding Ops` workspace from
`client-acquisition-hub`. It is intended to become one tool in a broader tool
dashboard hosted at `hub.joche.dev`.

## What this repo owns

- funding program tracking
- funding checklist and task tracking
- a standalone app deployment at `funding-ops.joche.dev`
- future white-label or client-specific domains that point at the same Vercel project

## What this repo does not own

- the main cross-tool dashboard shell for `hub.joche.dev`
- CRM, prospecting, or client-delivery workflows from `client-acquisition-hub`

## Current scope

The extracted MVP includes:

- funding programs
- funding tasks
- local SQLite persistence
- lightweight API routes for creating programs, creating tasks, and updating task status

## Hub model

The intended model is:

1. `hub.joche.dev` acts as the dashboard homepage for all tools.
2. Each tool has its own GitHub repo.
3. Each tool has its own Vercel project and a primary `*.joche.dev` subdomain.
4. Additional domains such as `funding.stimulo.ai` can be attached to the same Vercel project so they deploy from the same source repo.

That gives you one codebase per tool and many branded entry points when needed.

## Multi-domain recommendation

Use one Vercel project for `funding-ops` when all domains should receive the same code.

- Primary domain: `funding-ops.joche.dev`
- Hub deep link target: `hub.joche.dev` -> `funding-ops.joche.dev`
- Additional domains: `funding.stimulo.ai`, `ops.clientdomain.com`, and similar aliases

Only split into multiple Vercel projects if one of these becomes true:

- a client needs custom code not shared by everyone
- a client needs separate environment variables or integrations
- a client needs isolated data storage

## Local setup

1. Copy `.env.example` to `.env.local`
2. Install dependencies with `npm.cmd install`
3. Start the app with `npm.cmd run dev`

The database is stored at `data/funding-ops.db`.
