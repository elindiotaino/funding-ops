"use client";

import { useMemo } from "react";

import type { FundingWorkspaceData } from "@/lib/feed";
import { formatNaicsLabel } from "@/lib/naics";

export type FilterState = {
  query: string;
  categories: string[];
  jurisdictions: string[];
  tags: string[];
  naicsCodes: string[];
  onlyRecommended: boolean;
};

export type ProfileDraft = {
  companyName: string;
  companySummary: string;
  geography: string;
  naicsCodes: string[];
  sectors: string;
  assistanceTypes: string;
  keywords: string;
  notificationMode: string;
  notificationEmail: string;
  dailySummaryEnabled: boolean;
  emailCategories: string[];
  emailJurisdictions: string[];
  emailTags: string[];
};

export const initialFilters: FilterState = {
  query: "",
  categories: [],
  jurisdictions: [],
  tags: [],
  naicsCodes: [],
  onlyRecommended: false,
};

export function toCommaList(values: string[]) {
  return values.join(", ");
}

export function toArray(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function toggleSelection(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

export function formatDateLabel(value: string | null) {
  if (!value) {
    return "No fixed deadline";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMatchScore(score: number) {
  return `${(score / 10).toFixed(1)}/10`;
}

export function prettifyLabel(value: string) {
  return value
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function SelectionGroup({
  label,
  options,
  selected,
  onToggle,
  emptyCopy,
  formatOptionLabel,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyCopy?: string;
  formatOptionLabel?: (value: string) => string;
}) {
  return (
    <div className="selection-group">
      <div className="selection-group__header">
        <span>{label}</span>
        <strong>{selected.length === 0 ? "All" : `${selected.length} selected`}</strong>
      </div>
      {options.length === 0 ? (
        <p className="selection-group__empty">{emptyCopy ?? "No options yet."}</p>
      ) : (
        <div className="chip-grid">
          {options.map((option) => {
            const active = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={`filter-chip ${active ? "filter-chip--active" : ""}`}
                onClick={() => onToggle(option)}
              >
                {formatOptionLabel ? formatOptionLabel(option) : prettifyLabel(option)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WorkspaceNotices({
  message,
  error,
  workspace,
}: {
  message: string | null;
  error: string | null;
  workspace: FundingWorkspaceData;
}) {
  return (
    <>
      {workspace.lastIngestionRun ? (
        <p className="notice info">
          Last refresh: {formatDateLabel(workspace.lastIngestionRun.createdAt)} by{" "}
          {workspace.lastIngestionRun.triggeredBy}. Imported{" "}
          {workspace.lastIngestionRun.itemsUpserted} feed records across{" "}
          {workspace.lastIngestionRun.sourcesUpserted} official sources.
          {workspace.refreshScope.naicsCodes.length > 0
            ? ` Active account NAICS scope: ${workspace.refreshScope.naicsCodes
                .slice(0, 6)
                .map((code) => formatNaicsLabel(code))
                .join(", ")}${workspace.refreshScope.naicsCodes.length > 6 ? ", ..." : ""}.`
            : " Refresh scope is broad because no account NAICS codes are selected."}
        </p>
      ) : null}
      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
    </>
  );
}

export function useWorkspaceFilters(workspace: FundingWorkspaceData, filters: FilterState) {
  return useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return workspace.items.filter((item) => {
      const matchesQuery =
        !query ||
        [
          item.title,
          item.summary,
          item.eligibility,
          item.category,
          item.jurisdiction,
          item.audience,
          item.geography,
          ...item.naicsCodes,
          ...item.tags,
          ...item.keywords,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesCategory =
        filters.categories.length === 0 || filters.categories.includes(item.category);
      const matchesJurisdiction =
        filters.jurisdictions.length === 0 ||
        filters.jurisdictions.includes(item.jurisdiction);
      const matchesTag =
        filters.tags.length === 0 || item.tags.some((tag) => filters.tags.includes(tag));
      const matchesNaics =
        filters.naicsCodes.length === 0 ||
        item.naicsCodes.some((code) => filters.naicsCodes.includes(code));
      const matchesRecommendation = !filters.onlyRecommended || item.relevanceScore >= 45;

      return (
        matchesQuery &&
        matchesCategory &&
        matchesJurisdiction &&
        matchesTag &&
        matchesNaics &&
        matchesRecommendation
      );
    });
  }, [filters, workspace.items]);
}
