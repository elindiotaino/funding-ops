"use client";

import type { FundingWorkspaceData } from "@/lib/feed";
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
import { useState } from "react";

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
  const filteredItems = useWorkspaceFilters(workspace, filters);

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
            <h2>Filter by keyword, type, region, and tags without digging through every source.</h2>
          </div>
          <button
            type="button"
            className="secondary-link"
            onClick={() => setFilters(initialFilters)}
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
            <h2>Minimal ranked matches from best to weakest fit for the active criteria.</h2>
          </div>
          <div className="result-summary">
            <span>{filteredItems.length} results</span>
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
      </section>
    </>
  );
}
