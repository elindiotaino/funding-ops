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
  category: string;
  jurisdiction: string;
  tag: string;
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
};

const initialFilters: FilterState = {
  query: "",
  category: "all",
  jurisdiction: "all",
  tag: "all",
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
  });

  const filteredItems = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return workspace.items.filter((item) => {
      const matchesQuery =
        !query ||
        [item.title, item.summary, item.eligibility, item.category, item.jurisdiction, ...item.tags, ...item.keywords]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesCategory = filters.category === "all" || item.category === filters.category;
      const matchesJurisdiction =
        filters.jurisdiction === "all" || item.jurisdiction === filters.jurisdiction;
      const matchesTag = filters.tag === "all" || item.tags.includes(filters.tag);
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
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save company profile.");
      }

      setWorkspace(payload.workspace);
      setMessage("Company profile saved and recommendations updated.");
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
            <h1>Official-source search, filtering, ranking, and notifications for Puerto Rico-focused funding work.</h1>
            <p className="lede">
              This workspace ingests the official source catalog, ranks source items against your company profile, and keeps a refreshable feed for grants, aid, jobs, incentives, and recovery notices.
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
          <div className="stat-card"><span>Filtered Results</span><strong>{filteredItems.length}</strong></div>
        </section>

        {workspace.lastIngestionRun ? (
          <p className="notice info">
            Last refresh: {formatDateLabel(workspace.lastIngestionRun.createdAt)} by {workspace.lastIngestionRun.triggeredBy}. Imported {workspace.lastIngestionRun.itemsUpserted} feed records across {workspace.lastIngestionRun.sourcesUpserted} official sources.
          </p>
        ) : null}
        {message ? <p className="notice success">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}

        <section className="content-grid">
          <section className="panel" id="profile">
            <p className="eyebrow">Company Profile</p>
            <h2>Describe what the organization does so the feed can surface relevant posts first.</h2>
            <form className="form-grid" onSubmit={handleProfileSave}>
              <label><span>Company name</span><input value={profileDraft.companyName} onChange={(event) => setProfileDraft((current) => ({ ...current, companyName: event.target.value }))} /></label>
              <label><span>Geography</span><input value={profileDraft.geography} onChange={(event) => setProfileDraft((current) => ({ ...current, geography: event.target.value }))} /></label>
              <label className="full"><span>What the company does</span><textarea rows={4} value={profileDraft.companySummary} onChange={(event) => setProfileDraft((current) => ({ ...current, companySummary: event.target.value }))} /></label>
              <label><span>Sectors</span><input value={profileDraft.sectors} onChange={(event) => setProfileDraft((current) => ({ ...current, sectors: event.target.value }))} placeholder="small business, housing, resilience" /></label>
              <label><span>Assistance types</span><input value={profileDraft.assistanceTypes} onChange={(event) => setProfileDraft((current) => ({ ...current, assistanceTypes: event.target.value }))} placeholder="grants, jobs, incentives" /></label>
              <label className="full"><span>Tracked keywords</span><input value={profileDraft.keywords} onChange={(event) => setProfileDraft((current) => ({ ...current, keywords: event.target.value }))} placeholder="Puerto Rico, entrepreneurship, recovery" /></label>
              <label><span>Notification mode</span><select value={profileDraft.notificationMode} onChange={(event) => setProfileDraft((current) => ({ ...current, notificationMode: event.target.value }))}><option value="digest">digest</option><option value="instant">instant</option><option value="muted">muted</option></select></label>
              <button type="submit" disabled={isSavingProfile}>{isSavingProfile ? "Saving..." : "Save Profile"}</button>
            </form>
          </section>

          <section className="panel" id="filters">
            <p className="eyebrow">Search And Filters</p>
            <h2>Filter the feed by keyword, type, jurisdiction, and tags.</h2>
            <div className="form-grid">
              <label className="full"><span>Keyword search</span><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="grants, Puerto Rico, housing, jobs" /></label>
              <label><span>Category</span><select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="all">all</option>{workspace.filters.categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label><span>Jurisdiction</span><select value={filters.jurisdiction} onChange={(event) => setFilters((current) => ({ ...current, jurisdiction: event.target.value }))}><option value="all">all</option>{workspace.filters.jurisdictions.map((jurisdiction) => <option key={jurisdiction} value={jurisdiction}>{jurisdiction}</option>)}</select></label>
              <label><span>Tag</span><select value={filters.tag} onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))}><option value="all">all</option>{workspace.filters.tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
              <label className="checkbox-row"><input type="checkbox" checked={filters.onlyRecommended} onChange={(event) => setFilters((current) => ({ ...current, onlyRecommended: event.target.checked }))} /><span>Only show relevance score 45+</span></label>
            </div>
          </section>

          <section className="panel" id="notifications">
            <p className="eyebrow">Notifications</p>
            <h2>Recommended items generated from the current profile.</h2>
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
          <p className="eyebrow">Ranked Feed</p>
          <h2>Relevance-ranked official-source items.</h2>
          <div className="list">
            {filteredItems.length === 0 ? (
              <div className="empty">No feed items match the current filters.</div>
            ) : (
              filteredItems.map((item) => (
                <article className="list-item" key={item.id}>
                  <div className="list-header">
                    <strong>{item.title}</strong>
                    <span className="pill score-pill">{item.relevanceScore}</span>
                  </div>
                  <p>{item.summary}</p>
                  <p>Audience: {item.audience}</p>
                  <p>Eligibility: {item.eligibility}</p>
                  <p>Geography: {item.geography}</p>
                  <p>Deadline: {formatDateLabel(item.deadline)}</p>
                  <p>Tags: {item.tags.join(", ")}</p>
                  <p>Reasons: {item.reasons.length > 0 ? item.reasons.join(" | ") : "No strong profile signals yet."}</p>
                  <p><a href={item.url} target="_blank" rel="noreferrer">Open item source</a></p>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}
