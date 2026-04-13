# NAICS Source Capability Model

This document captures the first-wave NAICS strategy used by the live Funding Ops
adapters.

It supports issues `#13` and `#15`.

## Canonical rule

The canonical feed stores `feed_items.naics_codes` as a JSON array of NAICS
codes. Values may come from:

- source-provided classification
- adapter-level source-aware classification
- fallback text inference in the ingest runtime

The preferred order is:

1. source-provided codes
2. adapter-level classification from structured source fields
3. generic text inference fallback

## First-wave source capability model

### `grants-gov`

- Direct source filter support: not currently used for NAICS
- Structured signals used:
  - agency name
  - agency code
  - assistance listing numbers
  - document type
  - title and normalized summary
- Current strategy:
  - adapter-level classification from title, agency metadata, and assistance-listing context
  - generic fallback still available in ingest

### `simpler-grants`

- Direct source filter support: not currently used for NAICS
- Structured signals used:
  - applicant types
  - funding instrument
  - agency metadata
  - summary description
- Current strategy:
  - adapter-level classification from opportunity summary, applicant types, and funding instrument
  - grants-oriented hint codes are added when the funding instrument indicates grant-like programs

### `sam-assistance`

- Direct source filter support: not currently used for NAICS
- Structured signals used:
  - assistance types
  - applicant types
  - beneficiary types
  - objective
  - assistance description
  - examples of funded projects
  - federal organization hierarchy
- Current strategy:
  - adapter-level classification from program description and structured applicant/beneficiary metadata

### `usajobs`

- Direct source filter support: source is filtered by Puerto Rico/public postings, not NAICS
- Structured signals used:
  - position title
  - job summary
  - qualification summary
  - organization name
  - department name
- Current strategy:
  - adapter-level classification from job content plus a default public-administration hint

### `usaspending`

- Direct source filter support: source is narrowed by award type and Puerto Rico performance, not NAICS
- Structured signals used:
  - recipient name
  - awarding and funding agency names
  - award type
- Current strategy:
  - adapter-level classification from award metadata with finance/professional-services hints where appropriate

### `openfema`

- Direct source filter support: source is narrowed by Puerto Rico declarations, not NAICS
- Structured signals used:
  - declaration type
  - disaster type
  - incident type
  - declared programs
  - designated area
- Current strategy:
  - adapter-level classification from emergency-management and assistance program language with public-administration and social-assistance hints

## Current limitation

The first-wave adapters still rely on heuristic mapping. They do not yet
distinguish, in stored metadata, whether each `naics_code` is:

- source-provided
- adapter-classified
- fallback-inferred

That distinction should be added in a later refinement if ranking confidence or
auditing requires it.

## Backfill rule

Older rows that predate canonical `naics_codes` should be reclassified by rerunning
the Docker ingest service or through a dedicated backfill job that recomputes the
adapter/runtime classification output and upserts the canonical field.
