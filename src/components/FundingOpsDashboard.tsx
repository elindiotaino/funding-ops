"use client";

import { FormEvent, useMemo, useState } from "react";

type FundingProgram = {
  id: number;
  name: string;
  sponsor: string | null;
  maxFunding: string | null;
  eligibility: string | null;
  deadline: string | null;
  sourceUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
};

type FundingTask = {
  id: number;
  programId: number | null;
  title: string;
  status: string;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  programName: string;
};

type DashboardData = {
  programs: FundingProgram[];
  tasks: FundingTask[];
  urgentDeadlines: FundingProgram[];
  metrics: {
    totalPrograms: number;
    activePrograms: number;
    submittedPrograms: number;
    awardedPrograms: number;
    pendingTasks: number;
  };
};

type FundingOpsDashboardProps = {
  hubUrl: string;
  appUrl: string;
  basePath: string;
  initialData: DashboardData;
};

type ProgramFormState = {
  name: string;
  sponsor: string;
  maxFunding: string;
  eligibility: string;
  deadline: string;
  sourceUrl: string;
  status: string;
  notes: string;
};

type TaskFormState = {
  programId: string;
  title: string;
  status: string;
  dueDate: string;
  notes: string;
};

const initialProgramForm: ProgramFormState = {
  name: "",
  sponsor: "",
  maxFunding: "",
  eligibility: "",
  deadline: "",
  sourceUrl: "",
  status: "researching",
  notes: "",
};

const initialTaskForm: TaskFormState = {
  programId: "",
  title: "",
  status: "pending",
  dueDate: "",
  notes: "",
};

function formatDateLabel(value: string | null) {
  if (!value) {
    return "No date";
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
  const [programs, setPrograms] = useState(initialData.programs);
  const [tasks, setTasks] = useState(initialData.tasks);
  const [programForm, setProgramForm] = useState(initialProgramForm);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSavingProgram, setIsSavingProgram] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);

  const metrics = useMemo(
    () => ({
      totalPrograms: programs.length,
      activePrograms: programs.filter((program) => program.status === "active").length,
      submittedPrograms: programs.filter((program) => program.status === "submitted").length,
      awardedPrograms: programs.filter((program) => program.status === "awarded").length,
      pendingTasks: tasks.filter((task) => task.status !== "complete").length,
    }),
    [programs, tasks],
  );

  const urgentDeadlines = useMemo(
    () =>
      programs
        .filter((program) => program.deadline && !/ongoing|varies|tbd/i.test(program.deadline))
        .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
        .slice(0, 5),
    [programs],
  );

  async function handleProgramSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingProgram(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${basePath}/api/funding-programs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: programForm.name,
          sponsor: programForm.sponsor || null,
          maxFunding: programForm.maxFunding || null,
          eligibility: programForm.eligibility || null,
          deadline: programForm.deadline || null,
          sourceUrl: programForm.sourceUrl || null,
          status: programForm.status,
          notes: programForm.notes || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save funding program.");
      }

      setPrograms((current) => [payload.program, ...current]);
      setProgramForm(initialProgramForm);
      setMessage("Funding program added.");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not save funding program.",
      );
    } finally {
      setIsSavingProgram(false);
    }
  }

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingTask(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${basePath}/api/funding-tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          programId: taskForm.programId ? Number(taskForm.programId) : null,
          title: taskForm.title,
          status: taskForm.status,
          dueDate: taskForm.dueDate || null,
          notes: taskForm.notes || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save funding task.");
      }

      setTasks((current) => [payload.task, ...current]);
      setTaskForm(initialTaskForm);
      setMessage("Funding task added.");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not save funding task.",
      );
    } finally {
      setIsSavingTask(false);
    }
  }

  async function handleTaskStatusUpdate(taskId: number, status: string) {
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${basePath}/api/funding-tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update task.");
      }

      setTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, status: payload.task.status } : task)),
      );
      setMessage("Task updated.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update task.");
    }
  }

  return (
    <main className="shell">
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">Funding Ops</p>
          <h1>Run grant and funding workflows as a standalone tool.</h1>
          <p className="lede">
            This app is extracted from the funding workspace inside{" "}
            <code>client-acquisition-hub</code> and is intended to plug into{" "}
            <a href={hubUrl}>hub.joche.dev</a> as one tool in a larger dashboard.
          </p>
        </div>
        <div className="hero-links">
          <a className="primary-link" href={hubUrl}>Back to Hub</a>
          <a className="secondary-link" href={appUrl}>App Domain</a>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card"><span>Total Programs</span><strong>{metrics.totalPrograms}</strong></div>
        <div className="stat-card"><span>Active</span><strong>{metrics.activePrograms}</strong></div>
        <div className="stat-card"><span>Submitted</span><strong>{metrics.submittedPrograms}</strong></div>
        <div className="stat-card"><span>Awarded</span><strong>{metrics.awardedPrograms}</strong></div>
        <div className="stat-card"><span>Open Tasks</span><strong>{metrics.pendingTasks}</strong></div>
      </section>

      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <section className="content-grid">
        <section className="panel">
          <p className="eyebrow">Programs</p>
          <h2>Track funding opportunities and their current status.</h2>
          <div className="list">
            {programs.map((program) => (
              <article className="list-item" key={program.id}>
                <div className="list-header">
                  <strong>{program.name}</strong>
                  <span className={`pill status-${program.status}`}>{program.status}</span>
                </div>
                <p>{program.sponsor ?? "Sponsor pending"}</p>
                <p>Funding: {program.maxFunding ?? "TBD"}</p>
                <p>Deadline: {formatDateLabel(program.deadline)}</p>
                <p>{program.eligibility ?? "Eligibility notes pending."}</p>
                {program.sourceUrl ? (
                  <p><a href={program.sourceUrl} target="_blank" rel="noreferrer">Source</a></p>
                ) : null}
                <p>{program.notes ?? "No notes yet."}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Add Program</p>
          <h2>Create or import a funding opportunity.</h2>
          <form className="form-grid" onSubmit={handleProgramSubmit}>
            <label><span>Name</span><input required value={programForm.name} onChange={(event) => setProgramForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label><span>Sponsor</span><input value={programForm.sponsor} onChange={(event) => setProgramForm((current) => ({ ...current, sponsor: event.target.value }))} /></label>
            <label><span>Max funding</span><input value={programForm.maxFunding} onChange={(event) => setProgramForm((current) => ({ ...current, maxFunding: event.target.value }))} /></label>
            <label><span>Deadline</span><input value={programForm.deadline} onChange={(event) => setProgramForm((current) => ({ ...current, deadline: event.target.value }))} placeholder="2026-05-01 or Ongoing" /></label>
            <label className="full"><span>Eligibility</span><textarea rows={3} value={programForm.eligibility} onChange={(event) => setProgramForm((current) => ({ ...current, eligibility: event.target.value }))} /></label>
            <label><span>Status</span><select value={programForm.status} onChange={(event) => setProgramForm((current) => ({ ...current, status: event.target.value }))}><option value="researching">researching</option><option value="active">active</option><option value="submitted">submitted</option><option value="awarded">awarded</option><option value="archived">archived</option></select></label>
            <label className="full"><span>Source URL</span><input value={programForm.sourceUrl} onChange={(event) => setProgramForm((current) => ({ ...current, sourceUrl: event.target.value }))} /></label>
            <label className="full"><span>Notes</span><textarea rows={3} value={programForm.notes} onChange={(event) => setProgramForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button type="submit" disabled={isSavingProgram}>{isSavingProgram ? "Saving..." : "Add Program"}</button>
          </form>
        </section>

        <section className="panel">
          <p className="eyebrow">Tasks</p>
          <h2>Manage submission checklists and research actions.</h2>
          <div className="list">
            {tasks.map((task) => (
              <article className="list-item" key={task.id}>
                <div className="list-header">
                  <strong>{task.title}</strong>
                  <select
                    className="inline-select"
                    value={task.status}
                    onChange={(event) => handleTaskStatusUpdate(task.id, event.target.value)}
                  >
                    <option value="pending">pending</option>
                    <option value="in-progress">in-progress</option>
                    <option value="complete">complete</option>
                  </select>
                </div>
                <p>Program: {task.programName}</p>
                <p>Due: {formatDateLabel(task.dueDate)}</p>
                <p>{task.notes ?? "No notes yet."}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Add Task</p>
          <h2>Attach tasks to a specific program or keep them unassigned.</h2>
          <form className="form-grid" onSubmit={handleTaskSubmit}>
            <label><span>Program</span><select value={taskForm.programId} onChange={(event) => setTaskForm((current) => ({ ...current, programId: event.target.value }))}><option value="">Unassigned</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
            <label><span>Status</span><select value={taskForm.status} onChange={(event) => setTaskForm((current) => ({ ...current, status: event.target.value }))}><option value="pending">pending</option><option value="in-progress">in-progress</option><option value="complete">complete</option></select></label>
            <label className="full"><span>Title</span><input required value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label><span>Due date</span><input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} /></label>
            <label className="full"><span>Notes</span><textarea rows={3} value={taskForm.notes} onChange={(event) => setTaskForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button type="submit" disabled={isSavingTask}>{isSavingTask ? "Saving..." : "Add Task"}</button>
          </form>
        </section>

        <section className="panel">
          <p className="eyebrow">Deadlines</p>
          <h2>Surface the next application deadlines.</h2>
          <div className="list">
            {urgentDeadlines.length === 0 ? (
              <div className="empty">No fixed deadlines recorded yet.</div>
            ) : (
              urgentDeadlines.map((program) => (
                <article className="list-item" key={program.id}>
                  <strong>{program.name}</strong>
                  <p>{formatDateLabel(program.deadline)}</p>
                  <p>{program.sponsor ?? "Sponsor pending"}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Deployment Model</p>
          <h2>One repo, many domains.</h2>
          <div className="list">
            <article className="list-item">
              <strong>Primary repo</strong>
              <p><code>funding-ops</code> should own the source code and deployment config.</p>
            </article>
            <article className="list-item">
              <strong>Hub shell</strong>
              <p><code>hub.joche.dev</code> should list tools and deep-link into this app.</p>
            </article>
            <article className="list-item">
              <strong>Additional domains</strong>
              <p>Point <code>funding-ops.joche.dev</code> and future domains like <code>funding.stimulo.ai</code> at the same Vercel project unless they need tenant-specific data isolation.</p>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
