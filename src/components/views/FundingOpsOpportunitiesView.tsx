"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { FundingWorkspaceData } from "@/lib/feed";
import { formatNaicsLabel } from "@/lib/naics";
import {
  FilterState,
  formatDateLabel,
  formatMatchScore,
  initialFilters,
  prettifyLabel,
  SelectionGroup,
  toggleSelection,
  useWorkspaceFilters,
  WorkspaceNotices,
} from "@/components/FundingOpsShared";
import { startTransition, useEffect, useMemo, useState } from "react";

type OpportunitiesViewProps = {
  appUrl: string;
  basePath: string;
  hubUrl: string;
  initialWorkspace: FundingWorkspaceData;
};

export function FundingOpsOpportunitiesView({
  appUrl,
  basePath,
  hubUrl,
  initialWorkspace,
}: OpportunitiesViewProps) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBrowsingHistory, setIsBrowsingHistory] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const filteredItems = useWorkspaceFilters(workspace, filters);
  const currentPage = workspace.pagination.page;
  const totalPages = workspace.pagination.totalPages;
  const totalItems = workspace.pagination.totalItems;
  const sourceOptions = useMemo(
    () => workspace.sources.map((source) => source.sourceKey),
    [workspace.sources],
  );
  const sourceLabelMap = useMemo(
    () => new Map(workspace.sources.map((source) => [source.sourceKey, source.name])),
    [workspace.sources],
  );

  useEffect(() => {
    setIsBrowsingHistory(false);
  }, [workspace.history.selectedSnapshotDate, workspace.history.selectedSourceKeys, workspace.pagination.page]);

  function updateHistoryRoute(next: { snapshotDate?: string | null; sourceKeys?: string[]; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    const snapshotDate =
      next.snapshotDate === undefined ? workspace.history.selectedSnapshotDate : next.snapshotDate;
    const sourceKeys =
      next.sourceKeys === undefined ? workspace.history.selectedSourceKeys : next.sourceKeys;
    const page = next.page ?? 1;

    if (snapshotDate) {
      params.set("date", snapshotDate);
    } else {
      params.delete("date");
    }

    if (sourceKeys.length > 0) {
      params.set("sources", sourceKeys.join(","));
    } else {
      params.delete("sources");
    }

    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }

    setIsBrowsingHistory(true);
    startTransition(() => {
      const query = params.toString();
      router.push((query ? `/opportunities?${query}` : "/opportunities") as Route);
    });
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${basePath}/api/feed-refresh`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not refresh the official feed.");
      }

      setWorkspace(payload.workspace);
      setMessage("Official-source feed refreshed.");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh feed.");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <>
      <section className="panel utility-bar">
        <div className="utility-bar__links">
          <a className="secondary-link" href={hubUrl}>
            Back to Hub
          </a>
          <a className="secondary-link" href={appUrl}>
            App Domain
          </a>
        </div>
        <button type="button" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? "Refreshing..." : "Update Feed"}
        </button>
      </section>

      <WorkspaceNotices error={error} message={message} workspace={workspace} />

      <section className="panel search-panel">
        <div className="search-panel__header">
          <div>
            <p className="eyebrow">Search And Filters</p>
            <h2>Filter by keyword, type, region, NAICS, and tags without digging through every source.</h2>
            <p className="ranked-item__summary">
              Daily history is loaded from stored snapshots. Source and day filters apply before pagination.
            </p>
          </div>
          <button
            type="button"
            className="secondary-link"
            onClick={() => {
              setFilters(initialFilters);
              updateHistoryRoute({ snapshotDate: null, sourceKeys: [], page: 1 });
            }}
          >
            Clear Filters
          </button>
        </div>

        <div className="search-toolbar">
          <label className="search-input">
            <span>Keyword search</span>
            <input
              value={filters.query}
              onChange={(event) =>
                setFilters((current) => ({ ...current, query: event.target.value }))
              }
              placeholder="Search grants, jobs, housing, resilience, Puerto Rico, incentives"
            />
          </label>
          <label className="checkbox-row compact">
            <input
              type="checkbox"
              checked={filters.onlyRecommended}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  onlyRecommended: event.target.checked,
                }))
              }
            />
            <span>Only show recommended matches</span>
          </label>
        </div>

        <div className="filter-groups">
          <SelectionGroup
            label="Snapshot days"
            options={workspace.history.availableSnapshotDates}
            selected={workspace.history.selectedSnapshotDate ? [workspace.history.selectedSnapshotDate] : []}
            onToggle={(value) =>
              updateHistoryRoute({
                snapshotDate:
                  workspace.history.selectedSnapshotDate === value ? null : value,
                page: 1,
              })
            }
            emptyCopy="No stored daily snapshots yet."
          />
          <SelectionGroup
            label="Official sources"
            options={sourceOptions}
            selected={workspace.history.selectedSourceKeys}
            onToggle={(value) =>
              updateHistoryRoute({
                sourceKeys: toggleSelection(workspace.history.selectedSourceKeys, value),
                page: 1,
              })
            }
            formatOptionLabel={(value) => sourceLabelMap.get(value) ?? value}
          />
          {workspace.profile.naicsCodes.length > 0 ? (
            <div className="selection-group">
              <div className="selection-group__header">
                <span>Profile NAICS scope</span>
                <strong>{workspace.profile.naicsCodes.length} active</strong>
              </div>
              <div className="chip-grid">
                {workspace.profile.naicsCodes.map((code) => (
                  <span className="filter-chip filter-chip--static" key={`profile-naics-${code}`}>
                    {formatNaicsLabel(code)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <SelectionGroup
            label="Opportunity types"
            options={workspace.filters.categories}
            selected={filters.categories}
            onToggle={(value) =>
              setFilters((current) => ({
                ...current,
                categories: toggleSelection(current.categories, value),
              }))
            }
          />
          <SelectionGroup
            label="Jurisdictions"
            options={workspace.filters.jurisdictions}
            selected={filters.jurisdictions}
            onToggle={(value) =>
              setFilters((current) => ({
                ...current,
                jurisdictions: toggleSelection(current.jurisdictions, value),
              }))
            }
          />
          <SelectionGroup
            label="NAICS sectors"
            options={workspace.filters.naicsCodes}
            selected={filters.naicsCodes}
            onToggle={(value) =>
              setFilters((current) => ({
                ...current,
                naicsCodes: toggleSelection(current.naicsCodes, value),
              }))
            }
            emptyCopy="No NAICS codes are attached to the current result set yet."
            formatOptionLabel={formatNaicsLabel}
          />
          <SelectionGroup
            label="Tags"
            options={workspace.filters.tags}
            selected={filters.tags}
            onToggle={(value) =>
              setFilters((current) => ({
                ...current,
                tags: toggleSelection(current.tags, value),
              }))
            }
          />
        </div>
      </section>

      <section className="panel">
        <div className="search-panel__header">
          <div>
            <p className="eyebrow">Ranked Feed</p>
            <h2>Minimal ranked matches from best to weakest fit for the current page.</h2>
          </div>
          <div className="result-summary">
            <span>{filteredItems.length} shown on this page</span>
            <span>{totalItems} total in database</span>
            <span>
              {workspace.history.selectedSnapshotDate
                ? `Snapshot ${workspace.history.selectedSnapshotDate}`
                : "Latest snapshot"}
            </span>
            <span>
              {workspace.history.selectedSourceKeys.length > 0
                ? `${workspace.history.selectedSourceKeys.length} source filters active`
                : "All sources"}
            </span>
            <span>
              {workspace.profile.naicsCodes.length > 0
                ? `${workspace.profile.naicsCodes.length} profile NAICS active`
                : "No profile NAICS restriction"}
            </span>
            <span>{isBrowsingHistory ? "Loading history..." : "History ready"}</span>
            <span>{filters.onlyRecommended ? "Recommended only" : "All relevance levels"}</span>
          </div>
        </div>
        <div className="ranked-list">
          {filteredItems.length === 0 ? (
            <div className="empty">No feed items match the current filters.</div>
          ) : (
            filteredItems.map((item, index) => (
              <article className="ranked-item" key={item.id}>
                <div className="ranked-item__order">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="ranked-item__body">
                  <div className="ranked-item__header">
                    <div>
                      <strong>{item.title}</strong>
                      <p className="ranked-item__summary">{item.summary}</p>
                    </div>
                    <div className="ranked-item__score">
                      <span>Match</span>
                      <strong>{formatMatchScore(item.relevanceScore)}</strong>
                    </div>
                  </div>
                  <div className="ranked-item__meta">
                    <span>{prettifyLabel(item.category)}</span>
                    <span>{item.jurisdiction}</span>
                    <span>{formatDateLabel(item.deadline)}</span>
                  </div>
                  <p className="ranked-item__reasons">
                    {item.reasons.length > 0
                      ? item.reasons.join(" | ")
                      : "No strong profile signals yet."}
                  </p>
                  <div className="tag-row">
                    {item.naicsCodes.slice(0, 3).map((code) => (
                      <span className="filter-chip filter-chip--static" key={`${item.id}-naics-${code}`}>
                        {formatNaicsLabel(code)}
                      </span>
                    ))}
                    {item.tags.slice(0, 5).map((tag) => (
                      <span className="filter-chip filter-chip--static" key={`${item.id}-${tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      Open item source
                    </a>
                  </p>
                </div>
              </article>
            ))
          )}
        </div>
        <div className="pagination-bar">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="pagination-bar__actions">
            {currentPage > 1 ? (
              <Link
                className="secondary-link"
                href={`/opportunities?${(() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("page", String(currentPage - 1));
                  return params.toString();
                })()}` as Route}
              >
                Previous Page
              </Link>
            ) : (
              <span className="pagination-bar__spacer" />
            )}
            {currentPage < totalPages ? (
              <Link
                className="secondary-link"
                href={`/opportunities?${(() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("page", String(currentPage + 1));
                  return params.toString();
                })()}` as Route}
              >
                Next Page
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
