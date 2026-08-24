"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type IncidentStatus = "open" | "contained" | "closed";
type Incident = {
  id: string;
  occurredAt: string;
  description: string;
  affectedContactCount: number;
  status: IncidentStatus;
  boardNotifiedAt: string | null;
  affectedPersonsNotifiedAt: string | null;
};

function remaining(deadline: number, now: number): string {
  const milliseconds = deadline - now;
  if (milliseconds <= 0) return "Overdue";
  const hours = Math.ceil(milliseconds / 3_600_000);
  return `${Math.floor(hours / 24)}d ${hours % 24}h remaining`;
}

function deadlineLabel(deadline: number): string {
  return new Date(deadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function BreachTracker({ incidents }: { incidents: Incident[] }) {
  const router = useRouter();
  const [clock, setClock] = useState(Date.now());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const summary = useMemo(() => {
    const active = incidents.filter((incident) => incident.status !== "closed");
    const affected = active.reduce((total, incident) => total + incident.affectedContactCount, 0);
    const outstanding = active.flatMap((incident) => {
      const occurred = new Date(incident.occurredAt).getTime();
      return [
        ...(!incident.boardNotifiedAt ? [{ deadline: occurred + 72 * 3_600_000 }] : []),
        ...(!incident.affectedPersonsNotifiedAt ? [{ deadline: occurred + 144 * 3_600_000 }] : []),
      ];
    });
    const overdue = outstanding.filter((milestone) => milestone.deadline < clock).length;
    const next = outstanding.sort((left, right) => left.deadline - right.deadline)[0];
    return { active: active.length, affected, overdue, next };
  }, [clock, incidents]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy("create");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        occurredAt: new Date(String(form.get("occurredAt"))).toISOString(),
        description: form.get("description"),
        affectedContactCount: Number(form.get("count")),
      }),
    });
    const body = await response.json();
    setBusy("");
    if (!response.ok) { setError(body.error); return; }
    formElement.reset();
    router.refresh();
  }

  async function update(id: string, action: string, payload: Record<string, boolean | string>) {
    setError("");
    setBusy(`${id}:${action}`);
    const response = await fetch(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setBusy("");
    if (!response.ok) { setError(body.error); return; }
    router.refresh();
  }

  return (
    <div className="incident-cockpit">
      <section className="incident-summary" aria-label="Incident response summary">
        <article><span>Active incidents</span><strong>{summary.active}</strong><small>Open or contained</small></article>
        <article><span>Affected contacts</span><strong>{summary.affected}</strong><small>Across active incidents</small></article>
        <article className={summary.overdue ? "summary-alert" : ""}><span>Overdue milestones</span><strong>{summary.overdue}</strong><small>Action required</small></article>
        <article><span>Next deadline</span><strong className="next-deadline">{summary.next ? remaining(summary.next.deadline, clock) : "Clear"}</strong><small>{summary.next ? deadlineLabel(summary.next.deadline) : "No outstanding milestones"}</small></article>
      </section>

      <details className="incident-create">
        <summary><span><strong>Log a new incident</strong><small>Create the privacy-operations record</small></span><b>New incident</b></summary>
        <form className="stack" onSubmit={create}>
          <div className="form-grid">
            <div className="field"><label>Occurred at</label><input name="occurredAt" type="datetime-local" required/></div>
            <div className="field"><label>Affected-contact count</label><input name="count" type="number" min="0" required/></div>
          </div>
          <div className="field"><label>Description</label><textarea name="description" rows={2} maxLength={2000} required/></div>
          <button className="btn" disabled={Boolean(busy)}>{busy === "create" ? "Creating…" : "Create incident"}</button>
        </form>
      </details>

      {error && <p className="error" aria-live="polite">{error}</p>}

      <section className="incident-list">
        {incidents.length === 0 && <div className="card empty-incident"><strong>No incidents recorded</strong><span>New incident milestones will appear here.</span></div>}
        {incidents.map((incident) => {
          const occurred = new Date(incident.occurredAt).getTime();
          const boardDeadline = occurred + 72 * 3_600_000;
          const peopleDeadline = occurred + 144 * 3_600_000;
          const boardOverdue = incident.status !== "closed" && !incident.boardNotifiedAt && clock > boardDeadline;
          const peopleOverdue = incident.status !== "closed" && !incident.affectedPersonsNotifiedAt && clock > peopleDeadline;
          const notificationsComplete = Boolean(incident.boardNotifiedAt && incident.affectedPersonsNotifiedAt);
          const statusLabel = incident.status === "open" ? "Active" : incident.status === "contained" ? "Contained" : "Closed";

          return (
            <article className={`incident-card ${incident.status}`} key={incident.id}>
              <header className="incident-head">
                <div>
                  <div className="incident-kicker"><span className={`incident-status ${incident.status}`}>{statusLabel}</span><code>{incident.id.slice(-8)}</code></div>
                  <h2>{incident.description}</h2>
                  <p>Occurred {new Date(incident.occurredAt).toLocaleString("en-IN")} · {incident.affectedContactCount} affected contacts</p>
                </div>
                {(boardOverdue || peopleOverdue) && <span className="deadline-alert">Deadline overdue</span>}
              </header>

              <ol className="incident-lifecycle" aria-label={`Lifecycle for ${incident.description}`}>
                <li className="done"><span>1</span><strong>Detected</strong><small>Incident recorded</small></li>
                <li className={incident.status !== "open" ? "done" : "current"}><span>2</span><strong>Contained</strong><small>{incident.status === "open" ? "Awaiting action" : "Scope controlled"}</small></li>
                <li className={incident.status === "closed" ? "done" : ""}><span>3</span><strong>Closed</strong><small>{incident.status === "closed" ? "Record complete" : "Pending evidence"}</small></li>
              </ol>

              <div className="milestone-grid">
                <section className={boardOverdue ? "milestone overdue" : "milestone"}>
                  <div><span>01</span><div><strong>Board notification</strong><small>72-hour statutory deadline</small></div></div>
                  <p>{incident.boardNotifiedAt ? `Logged ${new Date(incident.boardNotifiedAt).toLocaleString("en-IN")}` : remaining(boardDeadline, clock)}</p>
                  <small>Due {deadlineLabel(boardDeadline)}</small>
                  {!incident.boardNotifiedAt && incident.status !== "closed" && <button className="btn secondary" disabled={Boolean(busy)} onClick={() => update(incident.id, "board", { boardNotified: true })}>Log Board notification</button>}
                </section>
                <section className={peopleOverdue ? "milestone overdue" : "milestone"}>
                  <div><span>02</span><div><strong>Affected-person notification</strong><small>Internal 144-hour escalation target</small></div></div>
                  <p>{incident.affectedPersonsNotifiedAt ? `Logged ${new Date(incident.affectedPersonsNotifiedAt).toLocaleString("en-IN")}` : remaining(peopleDeadline, clock)}</p>
                  <small>Due {deadlineLabel(peopleDeadline)} · Act states without delay</small>
                  {!incident.affectedPersonsNotifiedAt && incident.status !== "closed" && <button className="btn secondary" disabled={Boolean(busy)} onClick={() => update(incident.id, "people", { affectedPersonsNotified: true })}>Log affected-person notification</button>}
                </section>
              </div>

              <footer className="incident-actions">
                <span>{notificationsComplete ? "Notification evidence complete" : "Complete notification evidence before closure"}</span>
                {incident.status === "open" && <button className="btn secondary" disabled={Boolean(busy)} onClick={() => update(incident.id, "contain", { status: "contained" })}>Mark contained</button>}
                {incident.status === "contained" && <button className="btn" disabled={Boolean(busy) || !notificationsComplete} title={!notificationsComplete ? "Both notification milestones must be logged before closure." : undefined} onClick={() => update(incident.id, "close", { status: "closed" })}>Close incident</button>}
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );
}
