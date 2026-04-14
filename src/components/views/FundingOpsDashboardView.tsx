"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";

import type { FundingWorkspaceData } from "@/lib/feed";
import type { FundingDashboardData } from "@/lib/queries";
import {
  formatDateLabel,
  formatMatchScore,
  prettifyLabel,
  WorkspaceNotices,
} from "@/components/FundingOpsShared";

type DashboardViewProps = {
  appUrl: string;
  basePath: string;
  hubUrl: string;
  initialDashboard: FundingDashboardData;
  initialWorkspace: FundingWorkspaceData;
};

export function FundingOpsDashboardView({
  appUrl,
  basePath,
  hubUrl,
  initialDashboard,
  initialWorkspace,
}: DashboardViewProps) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const topNotifications = useMemo(
    () => workspace.notifications.filter((notification) => notification.relevanceScore >= 45),
    [workspace.notifications],
  );
  const topOpportunities = useMemo(() => workspace.items.slice(0, 6), [workspace.items]);
  const staleSources = useMemo(
    () => workspace.sources.filter((source) => !source.lastSyncedAt).length,
    [workspace.sources],
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
        setMessage(
          typeof payload.notice === "string" && payload.notice.trim().length > 0
            ? payload.notice
            : "Official-source feed refreshed.",
        );
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

      <section className="stats-grid">
        <div className="stat-card">
          <span>Sources</span>
          <strong>{workspace.metrics.totalSources}</strong>
        </div>
        <div className="stat-card">
          <span>Feed Items</span>
          <strong>{workspace.metrics.totalItems}</strong>
        </div>
        <div className="stat-card">
          <span>High Relevance</span>
          <strong>{workspace.metrics.highlyRelevantItems}</strong>
        </div>
        <div className="stat-card">
          <span>Programs</span>
          <strong>{initialDashboard.metrics.totalPrograms}</strong>
        </div>
        <div className="stat-card">
          <span>Open Tasks</span>
          <strong>{initialDashboard.metrics.pendingTasks}</strong>
        </div>
        <div className="stat-card">
          <span>Refresh Scope</span>
          <strong>{workspace.refreshScope.naicsCodes.length > 0 ? workspace.refreshScope.naicsCodes.length : "All"}</strong>
        </div>
      </section>

      <WorkspaceNotices error={error} message={message} workspace={workspace} />

      <section className="dashboard-grid dashboard-grid--top">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Notifications</p>
              <h2>What looks worth reviewing before the next digest goes out.</h2>
            </div>
            <Link className="secondary-link" href="/settings">
              Notification Settings
            </Link>
          </div>
          <div className="list">
            {topNotifications.length === 0 ? (
              <div className="empty">No notifications yet. Save a profile or refresh the feed.</div>
            ) : (
              topNotifications.slice(0, 4).map((notification) => (
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

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Source Health</p>
              <h2>Keep the feed trustworthy without making source inventory its own page.</h2>
            </div>
            <span className="pill">{staleSources} stale</span>
          </div>
          <div className="list">
            {workspace.sources.slice(0, 5).map((source) => (
              <article className="list-item" key={source.id}>
                <div className="list-header">
                  <strong>{source.name}</strong>
                  <span className="pill">{source.jurisdiction}</span>
                </div>
                <p>{source.summary}</p>
                <p>
                  Last sync: {source.lastSyncedAt ? formatDateLabel(source.lastSyncedAt) : "Not yet synced"}
                </p>
                <p>Cadence: {source.updateCadence}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Top Opportunities</p>
              <h2>Most relevant opportunities from the current feed.</h2>
            </div>
            <Link className="secondary-link" href="/opportunities">
              Open Opportunities
            </Link>
          </div>
          <div className="ranked-list">
            {topOpportunities.map((item, index) => (
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
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Program Pipeline</p>
              <h2>Tracked application work now has its own page, with dashboard links into key lanes.</h2>
            </div>
            <Link className="secondary-link" href={"/programs" as Route}>
              Programs
            </Link>
          </div>
          <div className="mini-stat-grid">
            <Link className="stat-card stat-card--compact stat-card--link" href={"/programs?status=active" as Route}>
              <span>Active</span>
              <strong>{initialDashboard.metrics.activePrograms}</strong>
            </Link>
            <Link className="stat-card stat-card--compact stat-card--link" href={"/programs?status=submitted" as Route}>
              <span>Submitted</span>
              <strong>{initialDashboard.metrics.submittedPrograms}</strong>
            </Link>
            <Link className="stat-card stat-card--compact stat-card--link" href={"/programs?status=awarded" as Route}>
              <span>Awarded</span>
              <strong>{initialDashboard.metrics.awardedPrograms}</strong>
            </Link>
          </div>
          <div className="list">
            {initialDashboard.urgentDeadlines.length === 0 ? (
              <div className="empty">No tracked program deadlines yet.</div>
            ) : (
              initialDashboard.urgentDeadlines.map((program) => (
                <article className="list-item" key={program.id}>
                  <div className="list-header">
                    <strong>{program.name}</strong>
                    <span className="pill">{program.status}</span>
                  </div>
                  <p>{program.sponsor || "Sponsor not set yet."}</p>
                  <p>Deadline: {formatDateLabel(program.deadline)}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Tasks</p>
              <h2>Execution work opens into filtered task views from the dashboard.</h2>
            </div>
            <Link className="secondary-link" href={"/tasks" as Route}>
              Tasks
            </Link>
          </div>
          <div className="list">
            {initialDashboard.tasks.length === 0 ? (
              <div className="empty">No tasks yet.</div>
            ) : (
              initialDashboard.tasks.slice(0, 5).map((task) => (
                <article className="list-item" key={task.id}>
                  <div className="list-header">
                    <strong>{task.title}</strong>
                    <span className="pill">{task.status}</span>
                  </div>
                  <p>{task.programName}</p>
                  <p>Due: {formatDateLabel(task.dueDate)}</p>
                </article>
              ))
            )}
          </div>
          <div className="mini-stat-grid">
            <Link className="stat-card stat-card--compact stat-card--link" href={"/tasks?status=pending" as Route}>
              <span>Pending</span>
              <strong>{initialDashboard.tasks.filter((task) => task.status === "pending").length}</strong>
            </Link>
            <Link className="stat-card stat-card--compact stat-card--link" href={"/tasks?status=in-progress" as Route}>
              <span>In Progress</span>
              <strong>{initialDashboard.tasks.filter((task) => task.status === "in-progress").length}</strong>
            </Link>
            <Link className="stat-card stat-card--compact stat-card--link" href={"/tasks?due=soon" as Route}>
              <span>Due Soon</span>
              <strong>
                {
                  initialDashboard.tasks.filter((task) => {
                    if (!task.dueDate || task.status === "complete") {
                      return false;
                    }

                    const now = new Date();
                    const dueDate = new Date(task.dueDate);
                    const diff = dueDate.getTime() - now.getTime();
                    const days = diff / (1000 * 60 * 60 * 24);
                    return days >= 0 && days <= 7;
                  }).length
                }
              </strong>
            </Link>
          </div>
        </section>
      </section>
    </>
  );
}
