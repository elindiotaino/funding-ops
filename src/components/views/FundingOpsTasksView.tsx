"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { FundingDashboardData } from "@/lib/queries";
import { formatDateLabel, prettifyLabel } from "@/components/FundingOpsShared";

type TasksViewProps = {
  basePath: string;
  initialDashboard: FundingDashboardData;
  initialDueFilter?: string;
  initialStatusFilter?: string;
};

type TaskStatus = "pending" | "in-progress" | "complete";

type TaskDraft = {
  programId: string;
  title: string;
  status: TaskStatus;
  dueDate: string;
  notes: string;
};

const taskStatuses: TaskStatus[] = ["pending", "in-progress", "complete"];

const emptyDraft: TaskDraft = {
  programId: "",
  title: "",
  status: "pending",
  dueDate: "",
  notes: "",
};

export function FundingOpsTasksView({
  basePath,
  initialDashboard,
  initialDueFilter,
  initialStatusFilter,
}: TasksViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState(initialDashboard.tasks);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [pendingStatusById, setPendingStatusById] = useState<Record<number, TaskStatus>>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const activeStatusFilter = taskStatuses.includes(initialStatusFilter as TaskStatus)
    ? (initialStatusFilter as TaskStatus)
    : "all";
  const activeDueFilter =
    initialDueFilter === "soon" || initialDueFilter === "overdue" ? initialDueFilter : "all";

  const filteredTasks = useMemo(() => {
    const now = new Date();

    return tasks.filter((task) => {
      const statusMatches =
        activeStatusFilter === "all" || task.status === activeStatusFilter;

      if (!statusMatches) {
        return false;
      }

      if (activeDueFilter === "all") {
        return true;
      }

      if (!task.dueDate || task.status === "complete") {
        return false;
      }

      const dueDate = new Date(task.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        return false;
      }

      const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (activeDueFilter === "overdue") {
        return diffDays < 0;
      }

      return diffDays >= 0 && diffDays <= 7;
    });
  }, [activeDueFilter, activeStatusFilter, tasks]);

  const groupedTasks = useMemo(
    () =>
      taskStatuses.map((status) => ({
        status,
        items: filteredTasks.filter((task) => task.status === status),
      })),
    [filteredTasks],
  );

  function setFilters({
    status = activeStatusFilter,
    due = activeDueFilter,
  }: {
    status?: TaskStatus | "all";
    due?: "all" | "soon" | "overdue";
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }

    if (due === "all") {
      params.delete("due");
    } else {
      params.set("due", due);
    }

    const query = params.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route);
  }

  async function handleCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${basePath}/api/funding-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: draft.programId ? Number(draft.programId) : null,
          title: draft.title,
          status: draft.status,
          dueDate: draft.dueDate || null,
          notes: draft.notes || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create funding task.");
      }

      setTasks((current) => [payload.task, ...current]);
      setDraft(emptyDraft);
      setMessage("Task created.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create task.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateStatus(taskId: number) {
    const nextStatus = pendingStatusById[taskId];
    if (!nextStatus) {
      return;
    }

    setUpdatingId(taskId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${basePath}/api/funding-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update task.");
      }

      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, ...payload.task, programName: task.programName } : task,
        ),
      );
      setMessage("Task status updated.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update task.");
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
          <p className="eyebrow">Add Task</p>
          <h2>Capture the next execution step without dropping back into notes outside the app.</h2>
          <form className="form-grid" onSubmit={handleCreateTask}>
            <label>
              <span>Task title</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Linked program</span>
              <select
                value={draft.programId}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, programId: event.target.value }))
                }
              >
                <option value="">Unassigned</option>
                {initialDashboard.programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as TaskStatus,
                  }))
                }
              >
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Due date</span>
              <input
                value={draft.dueDate}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, dueDate: event.target.value }))
                }
                placeholder="2026-05-01"
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
              {isCreating ? "Creating..." : "Create Task"}
            </button>
          </form>
        </section>

        <section className="panel">
          <p className="eyebrow">Execution Board</p>
          <h2>Keep the active work visible by status.</h2>
          <div className="filter-groups compact-gap">
            <div className="chip-grid">
              <button
                type="button"
                className={`filter-chip ${activeStatusFilter === "all" ? "filter-chip--active" : ""}`}
                onClick={() => setFilters({ status: "all" })}
              >
                All Statuses
              </button>
              {taskStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`filter-chip ${activeStatusFilter === status ? "filter-chip--active" : ""}`}
                  onClick={() => setFilters({ status })}
                >
                  {prettifyLabel(status)}
                </button>
              ))}
            </div>
            <div className="chip-grid">
              <button
                type="button"
                className={`filter-chip ${activeDueFilter === "all" ? "filter-chip--active" : ""}`}
                onClick={() => setFilters({ due: "all" })}
              >
                All Due Dates
              </button>
              <button
                type="button"
                className={`filter-chip ${activeDueFilter === "soon" ? "filter-chip--active" : ""}`}
                onClick={() => setFilters({ due: "soon" })}
              >
                Due Soon
              </button>
              <button
                type="button"
                className={`filter-chip ${activeDueFilter === "overdue" ? "filter-chip--active" : ""}`}
                onClick={() => setFilters({ due: "overdue" })}
              >
                Overdue
              </button>
            </div>
          </div>
          <div className="kanban-grid kanban-grid--tasks">
            {groupedTasks.map((group) => (
              <section className="kanban-column" key={group.status}>
                <div className="kanban-column__header">
                  <strong>{prettifyLabel(group.status)}</strong>
                  <span className="pill">{group.items.length}</span>
                </div>
                <div className="list">
                  {group.items.length === 0 ? (
                    <div className="empty">No tasks in this lane.</div>
                  ) : (
                    group.items.map((task) => (
                      <article className="list-item" key={task.id}>
                        <div className="list-header">
                          <strong>{task.title}</strong>
                          <span className="pill">{task.status}</span>
                        </div>
                        <p>{task.programName}</p>
                        <p>Due: {formatDateLabel(task.dueDate)}</p>
                        {task.notes ? <p>{task.notes}</p> : null}
                        <div className="inline-actions">
                          <select
                            value={pendingStatusById[task.id] ?? task.status}
                            onChange={(event) =>
                              setPendingStatusById((current) => ({
                                ...current,
                                [task.id]: event.target.value as TaskStatus,
                              }))
                            }
                          >
                            {taskStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void handleUpdateStatus(task.id)}
                            disabled={updatingId === task.id}
                          >
                            {updatingId === task.id ? "Saving..." : "Update Status"}
                          </button>
                        </div>
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
