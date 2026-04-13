"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import type { FundingWorkspaceData } from "@/lib/feed";
import {
  ProfileDraft,
  SelectionGroup,
  toArray,
  toCommaList,
  toggleSelection,
  WorkspaceNotices,
  prettifyLabel,
} from "@/components/FundingOpsShared";
import { formatNaicsLabel } from "@/lib/naics";

type NaicsSearchResult = {
  code: string;
  label: string;
};

type SettingsViewProps = {
  basePath: string;
  initialWorkspace: FundingWorkspaceData;
};

export function FundingOpsSettingsView({
  basePath,
  initialWorkspace,
}: SettingsViewProps) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [naicsQuery, setNaicsQuery] = useState("");
  const [naicsResults, setNaicsResults] = useState<NaicsSearchResult[]>([]);
  const [naicsLookup, setNaicsLookup] = useState<Record<string, string>>({});
  const [naicsSearchError, setNaicsSearchError] = useState<string | null>(null);
  const [isSearchingNaics, setIsSearchingNaics] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    companyName: initialWorkspace.profile.companyName,
    companySummary: initialWorkspace.profile.companySummary,
    geography: initialWorkspace.profile.geography,
    naicsCodes: initialWorkspace.profile.naicsCodes,
    sectors: toCommaList(initialWorkspace.profile.sectors),
    assistanceTypes: toCommaList(initialWorkspace.profile.assistanceTypes),
    keywords: toCommaList(initialWorkspace.profile.keywords),
    notificationMode: initialWorkspace.profile.notificationMode,
    notificationEmail: initialWorkspace.profile.notificationEmail,
    dailySummaryEnabled: initialWorkspace.profile.dailySummaryEnabled,
    emailCategories: initialWorkspace.profile.emailCategories,
    emailJurisdictions: initialWorkspace.profile.emailJurisdictions,
    emailTags: initialWorkspace.profile.emailTags,
  });

  useEffect(() => {
    const codes = profileDraft.naicsCodes;
    if (codes.length === 0) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `${basePath}/api/naics-search?codes=${encodeURIComponent(codes.join(","))}`,
          { cache: "no-store" },
        );
        const payload = await response.json();
        if (!response.ok || cancelled) {
          return;
        }

        const nextLookup = Object.fromEntries(
          ((payload.results ?? []) as NaicsSearchResult[]).map((result) => [result.code, result.label]),
        );
        setNaicsLookup((current) => ({ ...current, ...nextLookup }));
      } catch {
        // Keep existing selections usable even if lookup refresh fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [basePath, profileDraft.naicsCodes]);

  useEffect(() => {
    const query = naicsQuery.trim();
    if (query.length < 2) {
      setNaicsResults([]);
      setNaicsSearchError(null);
      setIsSearchingNaics(false);
      return;
    }

    let cancelled = false;
    setIsSearchingNaics(true);
    setNaicsSearchError(null);

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `${basePath}/api/naics-search?q=${encodeURIComponent(query)}`,
            { cache: "no-store" },
          );
          const payload = await response.json();
          if (cancelled) {
            return;
          }

          if (!response.ok) {
            throw new Error(payload.error ?? "Could not search NAICS.");
          }

          const results = (payload.results ?? []) as NaicsSearchResult[];
          setNaicsResults(results);
          setNaicsLookup((current) => ({
            ...current,
            ...Object.fromEntries(results.map((result) => [result.code, result.label])),
          }));
        } catch (searchError) {
          if (!cancelled) {
            setNaicsResults([]);
            setNaicsSearchError(
              searchError instanceof Error ? searchError.message : "Could not search NAICS codes.",
            );
          }
        } finally {
          if (!cancelled) {
            setIsSearchingNaics(false);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [basePath, naicsQuery]);

  const emailPreferenceSummary = useMemo(() => {
    const parts = [];

    if (workspace.profile.emailCategories.length > 0) {
      parts.push(`types: ${workspace.profile.emailCategories.map(prettifyLabel).join(", ")}`);
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
          naicsCodes: profileDraft.naicsCodes,
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
        naicsCodes: payload.workspace.profile.naicsCodes,
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
      <WorkspaceNotices error={error} message={message} workspace={workspace} />

      <section className="content-grid">
        <section className="panel panel--full">
          <p className="eyebrow">Company Profile</p>
          <h2>Describe the organization so ranking and notifications stay relevant.</h2>
          <form className="form-grid" onSubmit={handleProfileSave}>
            <label>
              <span>Company name</span>
              <input
                value={profileDraft.companyName}
                onChange={(event) =>
                  setProfileDraft((current) => ({ ...current, companyName: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Geography</span>
              <input
                value={profileDraft.geography}
                onChange={(event) =>
                  setProfileDraft((current) => ({ ...current, geography: event.target.value }))
                }
              />
            </label>
            <label className="full">
              <span>What the company does</span>
              <textarea
                rows={4}
                value={profileDraft.companySummary}
                onChange={(event) =>
                  setProfileDraft((current) => ({
                    ...current,
                    companySummary: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Sectors</span>
              <input
                value={profileDraft.sectors}
                onChange={(event) =>
                  setProfileDraft((current) => ({ ...current, sectors: event.target.value }))
                }
                placeholder="small business, housing, resilience"
              />
            </label>
            <label>
              <span>Assistance types</span>
              <input
                value={profileDraft.assistanceTypes}
                onChange={(event) =>
                  setProfileDraft((current) => ({
                    ...current,
                    assistanceTypes: event.target.value,
                  }))
                }
                placeholder="grants, jobs, incentives"
              />
            </label>
            <label className="full">
              <span>Tracked keywords</span>
              <input
                value={profileDraft.keywords}
                onChange={(event) =>
                  setProfileDraft((current) => ({ ...current, keywords: event.target.value }))
                }
                placeholder="Puerto Rico, entrepreneurship, recovery"
              />
            </label>

            <div className="full">
              <div className="selection-group">
                <div className="selection-group__header">
                  <span>Primary NAICS filter</span>
                  <strong>
                    {profileDraft.naicsCodes.length === 0
                      ? "No codes selected"
                      : `${profileDraft.naicsCodes.length} selected`}
                  </strong>
                </div>
                <p className="selection-group__empty">
                  Search the official NAICS catalog by code or keyword and attach the codes relevant
                  to this account.
                </p>
                <label className="naics-search">
                  <span>Search NAICS codes</span>
                  <input
                    value={naicsQuery}
                    onChange={(event) => setNaicsQuery(event.target.value)}
                    placeholder="Search 541511, software, trucking, home health, consulting"
                  />
                </label>
                {naicsSearchError ? <p className="notice error">{naicsSearchError}</p> : null}
                <div className="chip-grid">
                  {profileDraft.naicsCodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className="filter-chip filter-chip--active"
                      onClick={() =>
                        setProfileDraft((current) => ({
                          ...current,
                          naicsCodes: current.naicsCodes.filter((entry) => entry !== code),
                        }))
                      }
                    >
                      {naicsLookup[code] ? `${code} ${naicsLookup[code]}` : formatNaicsLabel(code)}
                    </button>
                  ))}
                </div>
                <div className="naics-search-results">
                  {naicsQuery.trim().length < 2 ? (
                    <p className="selection-group__empty">Type at least 2 characters to search.</p>
                  ) : isSearchingNaics ? (
                    <p className="selection-group__empty">Searching official NAICS options...</p>
                  ) : naicsResults.length === 0 ? (
                    <p className="selection-group__empty">No NAICS matches found for this query.</p>
                  ) : (
                    naicsResults.map((result) => {
                      const selected = profileDraft.naicsCodes.includes(result.code);
                      return (
                        <button
                          key={`${result.code}-${result.label}`}
                          type="button"
                          className={`naics-result ${selected ? "naics-result--selected" : ""}`}
                          onClick={() =>
                            setProfileDraft((current) => ({
                              ...current,
                              naicsCodes: selected
                                ? current.naicsCodes.filter((entry) => entry !== result.code)
                                : [...current.naicsCodes, result.code],
                            }))
                          }
                        >
                          <strong>{result.code}</strong>
                          <span>{result.label}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="preference-card full">
              <div className="preference-card__header">
                <div>
                  <span>Email updates</span>
                  <p>Choose exactly which result types should be included in the daily email summary.</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  <span>Notification mode</span>
                  <select
                    value={profileDraft.notificationMode}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        notificationMode: event.target.value,
                      }))
                    }
                  >
                    <option value="digest">digest</option>
                    <option value="instant">instant</option>
                    <option value="muted">muted</option>
                  </select>
                </label>
                <label>
                  <span>Daily summary email</span>
                  <input
                    type="email"
                    value={profileDraft.notificationEmail}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        notificationEmail: event.target.value,
                      }))
                    }
                    placeholder="alerts@example.com"
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={profileDraft.dailySummaryEnabled}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        dailySummaryEnabled: event.target.checked,
                      }))
                    }
                  />
                  <span>Send daily summary email</span>
                </label>
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

            <div className="form-actions full">
              <button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <p className="eyebrow">Digest Preview</p>
          <h2>Make email scope explicit before users depend on it.</h2>
          <p className="lede">
            Daily summary email is {workspace.profile.dailySummaryEnabled ? "enabled" : "disabled"}.
            {workspace.profile.notificationEmail
              ? ` Destination: ${workspace.profile.notificationEmail}. Email filters: ${emailPreferenceSummary}.`
              : " Add an email address to receive summaries."}
          </p>
          <div className="list">
            {workspace.notifications.filter((notification) => notification.relevanceScore >= 45)
              .slice(0, 5)
              .map((notification) => (
                <article className="list-item" key={notification.id}>
                  <div className="list-header">
                    <strong>{notification.title}</strong>
                    <span className="pill score-pill">{notification.relevanceScore}</span>
                  </div>
                  <p>{notification.message}</p>
                  <p>{notification.reasons.join(" | ")}</p>
                </article>
              ))}
          </div>
        </section>
      </section>
    </>
  );
}
