"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { FundingDashboardData } from "@/lib/queries";
import { prettifyLabel } from "@/components/FundingOpsShared";
import { formatDateLabel } from "@/components/FundingOpsShared";

type ProgramsViewProps = {
  basePath: string;
  initialDashboard: FundingDashboardData;
  initialStatusFilter?: string;
};

type ProgramStatus = "researching" | "active" | "submitted" | "awarded" | "archived";

type ProgramDraft = {
  name: string;
  sponsor: string;
  maxFunding: string;
  eligibility: string;
  deadline: string;
  sourceUrl: string;
  status: ProgramStatus;
  notes: string;
};

const programStatuses: ProgramStatus[] = [
  "researching",
  "active",
  "submitted",
  "awarded",
  "archived",
];

const emptyDraft: ProgramDraft = {
  name: "",
  sponsor: "",
  maxFunding: "",
  eligibility: "",
  deadline: "",
  sourceUrl: "",
  status: "researching",
  notes: "",
};

export function FundingOpsProgramsView({
  basePath,
  initialDashboard,
  initialStatusFilter,
}: ProgramsViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [programs, setPrograms] = useState(initialDashboard.programs);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<ProgramDraft>(emptyDraft);
  const [pendingStatusById, setPendingStatusById] = useState<Record<number, ProgramStatus>>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const activeStatusFilter = programStatuses.includes(initialStatusFilter as ProgramStatus)
    ? (initialStatusFilter as ProgramStatus)
    : "all";

  const filteredPrograms = useMemo(
    () =>
      activeStatusFilter === "all"
        ? programs
        : programs.filter((program) => program.status === activeStatusFilter),
    [activeStatusFilter, programs],
  );

  const groupedPrograms = useMemo(
    () =>
      programStatuses.map((status) => ({
        status,
        items: filteredPrograms.filter((program) => program.status === status),
      })),
    [filteredPrograms],
  );

  function setStatusFilter(status: ProgramStatus | "all") {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    const query = params.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route);
  }

  async function handleCreateProgram(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${basePath}/api/funding-programs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          sponsor: draft.sponsor || null,
          maxFunding: draft.maxFunding || null,
          eligibility: draft.eligibility || null,
          deadline: draft.deadline || null,
          sourceUrl: draft.sourceUrl || null,
          status: draft.status,
          notes: draft.notes || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create funding program.");
      }

      setPrograms((current) => [payload.program, ...current]);
      setDraft(emptyDraft);
      setMessage("Funding program created.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create program.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateStatus(programId: number) {
    const nextStatus = pendingStatusById[programId];
    if (!nextStatus) {
      return;
    }

    setUpdatingId(programId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${basePath}/api/funding-programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update funding program.");
      }

      setPrograms((current) =>
        current.map((program) => (program.id === programId ? payload.program : program)),
      );
      setMessage("Program status updated.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update program.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <>
      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <section className="content-grid content-grid--wide">
        <section className="panel">
          <p className="eyebrow">Add Program</p>
          <h2>Capture opportunities that moved from research into active pipeline work.</h2>
          <form className="form-grid" onSubmit={handleCreateProgram}>
            <label>
              <span>Program name</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Sponsor</span>
              <input
                value={draft.sponsor}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, sponsor: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Max funding</span>
              <input
                value={draft.maxFunding}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, maxFunding: event.target.value }))
                }
                placeholder="$50,000"
              />
            </label>
            <label>
              <span>Deadline</span>
              <input
                value={draft.deadline}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, deadline: event.target.value }))
                }
                placeholder="2026-05-15"
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as ProgramStatus,
                  }))
                }
              >
                {programStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Source URL</span>
              <input
                value={draft.sourceUrl}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, sourceUrl: event.target.value }))
                }
                placeholder="https://..."
              />
            </label>
            <label className="full">
              <span>Eligibility</span>
              <textarea
                rows={3}
                value={draft.eligibility}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, eligibility: event.target.value }))
                }
              />
            </label>
            <label className="full">
              <span>Notes</span>
              <textarea
                rows={4}
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </label>
            <button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Program"}
            </button>
          </form>
        </section>

        <section className="panel">
          <p className="eyebrow">Pipeline</p>
          <h2>Review the tracked program set by status.</h2>
          <div className="chip-grid">
            <button
              type="button"
              className={`filter-chip ${activeStatusFilter === "all" ? "filter-chip--active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All
            </button>
            {programStatuses.map((status) => (
              <button
                key={status}
                type="button"
                className={`filter-chip ${activeStatusFilter === status ? "filter-chip--active" : ""}`}
                onClick={() => setStatusFilter(status)}
              >
                {prettifyLabel(status)}
              </button>
            ))}
          </div>
          <div className="kanban-grid">
            {groupedPrograms.map((group) => (
              <section className="kanban-column" key={group.status}>
                <div className="kanban-column__header">
                  <strong>{prettifyLabel(group.status)}</strong>
                  <span className="pill">{group.items.length}</span>
                </div>
                <div className="list">
                  {group.items.length === 0 ? (
                    <div className="empty">No programs in this lane.</div>
                  ) : (
                    group.items.map((program) => (
                      <article className="list-item" key={program.id}>
                        <div className="list-header">
                          <strong>{program.name}</strong>
                          <span className="pill">{program.status}</span>
                        </div>
                        <p>{program.sponsor || "Sponsor not set yet."}</p>
                        <p>Funding: {program.maxFunding || "Not recorded"}</p>
                        <p>Deadline: {formatDateLabel(program.deadline)}</p>
                        {program.notes ? <p>{program.notes}</p> : null}
                        <div className="inline-actions">
                          <select
                            value={pendingStatusById[program.id] ?? program.status}
                            onChange={(event) =>
                              setPendingStatusById((current) => ({
                                ...current,
                                [program.id]: event.target.value as ProgramStatus,
                              }))
                            }
                          >
                            {programStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void handleUpdateStatus(program.id)}
                            disabled={updatingId === program.id}
                          >
                            {updatingId === program.id ? "Saving..." : "Update Status"}
                          </button>
                        </div>
                        {program.sourceUrl ? (
                          <p>
                            <a href={program.sourceUrl} target="_blank" rel="noreferrer">
                              Open source
                            </a>
                          </p>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
