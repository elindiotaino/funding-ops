"use client";

import { FormEvent, useMemo, useState } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import type { FundingWorkspaceData } from "@/lib/feed";

type FundingOpsDashboardProps = {
  hubUrl: string;
  appUrl: string;
  basePath: string;
  initialData: FundingWorkspaceData;
};

type FilterState = {
  query: string;
  categories: string[];
  jurisdictions: string[];
  tags: string[];
  onlyRecommended: boolean;
};

type ProfileDraft = {
  companyName: string;
  companySummary: string;
  geography: string;
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

const initialFilters: FilterState = {
  query: "",
  categories: [],
  jurisdictions: [],
  tags: [],
  onlyRecommended: false,
};

function toCommaList(values: string[]) {
  return values.join(", ");
}

function toArray(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function formatDateLabel(value: string | null) {
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

function formatMatchScore(score: number) {
  return `${(score / 10).toFixed(1)}/10`;
}

function prettifyLabel(value: string) {
  return value
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SelectionGroup({
  label,
  options,
  selected,
  onToggle,
  emptyCopy,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyCopy?: string;
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
                {prettifyLabel(option)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FundingOpsDashboard({
  hubUrl,
  appUrl,
  basePath,
  initialData,
}: FundingOpsDashboardProps) {
  const [workspace, setWorkspace] = useState(initialData);
  const [filters, setFilters] = useState(initialFilters);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    companyName: initialData.profile.companyName,
    companySummary: initialData.profile.companySummary,
    geography: initialData.profile.geography,
    sectors: toCommaList(initialData.profile.sectors),
    assistanceTypes: toCommaList(initialData.profile.assistanceTypes),
    keywords: toCommaList(initialData.profile.keywords),
    notificationMode: initialData.profile.notificationMode,
    notificationEmail: initialData.profile.notificationEmail,
    dailySummaryEnabled: initialData.profile.dailySummaryEnabled,
    emailCategories: initialData.profile.emailCategories,
    emailJurisdictions: initialData.profile.emailJurisdictions,
    emailTags: initialData.profile.emailTags,
  });

  const filteredItems = useMemo(() => {
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
      const matchesRecommendation = !filters.onlyRecommended || item.relevanceScore >= 45;

      return (
        matchesQuery &&
        matchesCategory &&
        matchesJurisdiction &&
        matchesTag &&
        matchesRecommendation
      );
    });
  }, [filters, workspace.items]);

  const topNotifications = useMemo(
    () => workspace.notifications.filter((notification) => notification.relevanceScore >= 45),
    [workspace.notifications],
  );

  const emailPreferenceSummary = useMemo(() => {
    const parts = [];

    if (workspace.profile.emailCategories.length > 0) {
      parts.push(
        `types: ${workspace.profile.emailCategories.map(prettifyLabel).join(", ")}`,
      );
    }

    if (workspace.profile.emailJurisdictions.length > 0) {
      parts.push(`regions: ${workspace.profile.emailJurisdictions.join(", ")}`);
    }

    if (workspace.profile.emailTags.length > 0) {
      parts.push(`tags: ${workspace.profile.emailTags.join(", ")}`);
    }

    return parts.length > 0 ? parts.join(" | ") : "all relevant items that match the profile";
  }, [
    workspace.profile.emailCategories,
    workspace.profile.emailJurisdictions,
    workspace.profile.emailTags,
  ]);

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
      setProfileDraft((current) => ({
        ...current,
        emailCategories: payload.workspace.profile.emailCategories,
        emailJurisdictions: payload.workspace.profile.emailJurisdictions,
        emailTags: payload.workspace.profile.emailTags,
      }));
      setMessage("Official-source feed refreshed.");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh feed.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingProfile(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${basePath}/api/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: profileDraft.companyName,
          companySummary: profileDraft.companySummary,
          geography: profileDraft.geography,
          sectors: toArray(profileDraft.sectors),
          assistanceTypes: toArray(profileDraft.assistanceTypes),
          keywords: toArray(profileDraft.keywords),
          notificationMode: profileDraft.notificationMode,
          notificationEmail: profileDraft.notificationEmail,
          dailySummaryEnabled: profileDraft.dailySummaryEnabled,
          emailCategories: profileDraft.emailCategories,
          emailJurisdictions: profileDraft.emailJurisdictions,
          emailTags: profileDraft.emailTags,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save company profile.");
      }

      setWorkspace(payload.workspace);
      setProfileDraft({
        companyName: payload.workspace.profile.companyName,
        companySummary: payload.workspace.profile.companySummary,
        geography: payload.workspace.profile.geography,
        sectors: toCommaList(payload.workspace.profile.sectors),
        assistanceTypes: toCommaList(payload.workspace.profile.assistanceTypes),
        keywords: toCommaList(payload.workspace.profile.keywords),
        notificationMode: payload.workspace.profile.notificationMode,
        notificationEmail: payload.workspace.profile.notificationEmail,
        dailySummaryEnabled: payload.workspace.profile.dailySummaryEnabled,
        emailCategories: payload.workspace.profile.emailCategories,
        emailJurisdictions: payload.workspace.profile.emailJurisdictions,
        emailTags: payload.workspace.profile.emailTags,
      });
      setMessage("Company profile and email update preferences saved.");
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Could not save profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <>
      <SiteHeader basePath={basePath} />
      <main className="shell">
        <section className="hero panel">
          <div className="hero-copy">
            <p className="eyebrow">Funding Ops Feed</p>
            <h1>Search the funding landscape faster and only email the updates that matter.</h1>
            <p className="lede">
              Funding Ops now gives users a clearer way to search, narrow results, and control
              which opportunity types should appear in their daily email digest.
            </p>
          </div>
          <div className="hero-links">
            <button type="button" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Update Feed"}
            </button>
            <a className="secondary-link" href={hubUrl}>Back to Hub</a>
            <a className="secondary-link" href={appUrl}>App Domain</a>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card"><span>Sources</span><strong>{workspace.metrics.totalSources}</strong></div>
          <div className="stat-card"><span>Feed Items</span><strong>{workspace.metrics.totalItems}</strong></div>
          <div className="stat-card"><span>High Relevance</span><strong>{workspace.metrics.highlyRelevantItems}</strong></div>
          <div className="stat-card"><span>Notifications</span><strong>{workspace.metrics.totalNotifications}</strong></div>
          <div className="stat-card"><span>Visible Results</span><strong>{filteredItems.length}</strong></div>
        </section>

        {workspace.lastIngestionRun ? (
          <p className="notice info">
            Last refresh: {formatDateLabel(workspace.lastIngestionRun.createdAt)} by {workspace.lastIngestionRun.triggeredBy}. Imported {workspace.lastIngestionRun.itemsUpserted} feed records across {workspace.lastIngestionRun.sourcesUpserted} official sources.
          </p>
        ) : null}
        {message ? <p className="notice success">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}

        <section className="panel search-panel" id="filters">
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

        <section className="content-grid">
          <section className="panel" id="profile">
            <p className="eyebrow">Company Profile</p>
            <h2>Describe the organization so ranking and notifications stay relevant.</h2>
            <form className="form-grid" onSubmit={handleProfileSave}>
              <label><span>Company name</span><input value={profileDraft.companyName} onChange={(event) => setProfileDraft((current) => ({ ...current, companyName: event.target.value }))} /></label>
              <label><span>Geography</span><input value={profileDraft.geography} onChange={(event) => setProfileDraft((current) => ({ ...current, geography: event.target.value }))} /></label>
              <label className="full"><span>What the company does</span><textarea rows={4} value={profileDraft.companySummary} onChange={(event) => setProfileDraft((current) => ({ ...current, companySummary: event.target.value }))} /></label>
              <label><span>Sectors</span><input value={profileDraft.sectors} onChange={(event) => setProfileDraft((current) => ({ ...current, sectors: event.target.value }))} placeholder="small business, housing, resilience" /></label>
              <label><span>Assistance types</span><input value={profileDraft.assistanceTypes} onChange={(event) => setProfileDraft((current) => ({ ...current, assistanceTypes: event.target.value }))} placeholder="grants, jobs, incentives" /></label>
              <label className="full"><span>Tracked keywords</span><input value={profileDraft.keywords} onChange={(event) => setProfileDraft((current) => ({ ...current, keywords: event.target.value }))} placeholder="Puerto Rico, entrepreneurship, recovery" /></label>

              <div className="preference-card full">
                <div className="preference-card__header">
                  <div>
                    <span>Email updates</span>
                    <p>Choose exactly which result types should be included in the daily email summary.</p>
                  </div>
                </div>
                <div className="form-grid">
                  <label><span>Notification mode</span><select value={profileDraft.notificationMode} onChange={(event) => setProfileDraft((current) => ({ ...current, notificationMode: event.target.value }))}><option value="digest">digest</option><option value="instant">instant</option><option value="muted">muted</option></select></label>
                  <label><span>Daily summary email</span><input type="email" value={profileDraft.notificationEmail} onChange={(event) => setProfileDraft((current) => ({ ...current, notificationEmail: event.target.value }))} placeholder="alerts@example.com" /></label>
                  <label className="checkbox-row"><input type="checkbox" checked={profileDraft.dailySummaryEnabled} onChange={(event) => setProfileDraft((current) => ({ ...current, dailySummaryEnabled: event.target.checked }))} /><span>Send daily summary email</span></label>
                </div>
                <div className="filter-groups compact-gap">
                  <SelectionGroup
                    label="Email opportunity types"
                    options={workspace.filters.categories}
                    selected={profileDraft.emailCategories}
                    onToggle={(value) =>
                      setProfileDraft((current) => ({
                        ...current,
                        emailCategories: toggleSelection(current.emailCategories, value),
                      }))
                    }
                  />
                  <SelectionGroup
                    label="Email jurisdictions"
                    options={workspace.filters.jurisdictions}
                    selected={profileDraft.emailJurisdictions}
                    onToggle={(value) =>
                      setProfileDraft((current) => ({
                        ...current,
                        emailJurisdictions: toggleSelection(current.emailJurisdictions, value),
                      }))
                    }
                  />
                  <SelectionGroup
                    label="Email tags"
                    options={workspace.filters.tags}
                    selected={profileDraft.emailTags}
                    onToggle={(value) =>
                      setProfileDraft((current) => ({
                        ...current,
                        emailTags: toggleSelection(current.emailTags, value),
                      }))
                    }
                  />
                </div>
              </div>

              <button type="submit" disabled={isSavingProfile}>{isSavingProfile ? "Saving..." : "Save Profile"}</button>
            </form>
          </section>

          <section className="panel" id="notifications">
            <p className="eyebrow">Notifications</p>
            <h2>Users can now see what will be emailed before the digest goes out.</h2>
            <p className="lede">
              Daily summary email is {workspace.profile.dailySummaryEnabled ? "enabled" : "disabled"}.
              {workspace.profile.notificationEmail
                ? ` Destination: ${workspace.profile.notificationEmail}. Email filters: ${emailPreferenceSummary}.`
                : " Add an email address in the profile section to receive summaries."}
            </p>
            <div className="list">
              {topNotifications.length === 0 ? (
                <div className="empty">No notifications yet. Save a profile or refresh the feed.</div>
              ) : (
                topNotifications.map((notification) => (
                  <article className="list-item" key={notification.id}>
                    <div className="list-header">
                      <strong>{notification.title}</strong>
                      <span className="pill score-pill">{notification.relevanceScore}</span>
                    </div>
                    <p>{notification.message}</p>
                    <p>{notification.reasons.join(" | ")}</p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel" id="sources">
            <p className="eyebrow">Source Registry</p>
            <h2>Official source inventory currently feeding the workspace.</h2>
            <div className="list">
              {workspace.sources.map((source) => (
                <article className="list-item" key={source.id}>
                  <div className="list-header">
                    <strong>{source.name}</strong>
                    <span className="pill">{source.jurisdiction}</span>
                  </div>
                  <p>{source.summary}</p>
                  <p>Interface: {source.interfaceType}</p>
                  <p>Programs: {source.programTypes.join(", ")}</p>
                  <p>Cadence: {source.updateCadence}</p>
                  <p><a href={source.url} target="_blank" rel="noreferrer">Open source</a></p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="panel" id="feed">
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
                      {item.reasons.length > 0 ? item.reasons.join(" | ") : "No strong profile signals yet."}
                    </p>
                    <div className="tag-row">
                      {item.tags.slice(0, 5).map((tag) => (
                        <span className="filter-chip filter-chip--static" key={`${item.id}-${tag}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p><a href={item.url} target="_blank" rel="noreferrer">Open item source</a></p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}
