"use client";

import { FormEvent, useMemo, useState } from "react";

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
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    companyName: initialWorkspace.profile.companyName,
    companySummary: initialWorkspace.profile.companySummary,
    geography: initialWorkspace.profile.geography,
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
