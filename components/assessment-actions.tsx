"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REMEDIATION_BY_RULE, type RuleCode } from "@/lib/rules-engine";

interface AiBriefing {
  headline: string;
  summary: string;
  keyFindings: Array<{ ruleCode: string; status: "pass" | "fail"; meaning: string }>;
  nextSteps: string[];
  legalNote: string;
}

type Output =
  | { kind: "message"; text: string }
  | { kind: "ai"; briefing: AiBriefing }
  | null;

export function AssessmentActions({
  contactId,
  assessmentId,
  failedRules,
}: {
  contactId: string;
  assessmentId: string;
  failedRules: RuleCode[];
}) {
  const [selected, setSelected] = useState<RuleCode[]>(failedRules);
  const [busy, setBusy] = useState<"" | "sim" | "ai" | "fix">("");
  const [output, setOutput] = useState<Output>(null);
  const router = useRouter();

  async function explain() {
    setBusy("ai");
    setOutput(null);
    const response = await fetch("/api/ai/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId }),
    });
    const body = await response.json();
    setBusy("");
    setOutput(
      response.ok
        ? { kind: "ai", briefing: body.explanation }
        : { kind: "message", text: body.error },
    );
  }

  async function simulate() {
    setBusy("sim");
    setOutput(null);
    const response = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, rulesToFix: selected }),
    });
    const body = await response.json();
    setBusy("");
    setOutput({
      kind: "message",
      text: response.ok
        ? `Projected: ${body.projected.score}/100 · ${String(body.projected.status).replaceAll("_", " ")}`
        : body.error,
    });
  }

  async function requestRemediation() {
    setBusy("fix");
    setOutput(null);
    const response = await fetch("/api/remediation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: [contactId], ruleCodes: selected }),
    });
    const body = await response.json();
    setBusy("");
    setOutput({
      kind: "message",
      text: response.ok
        ? `${body.requests.length} remediation request${body.requests.length === 1 ? "" : "s"} submitted for human approval.`
        : body.error,
    });
    if (response.ok) router.refresh();
  }

  return (
    <section className="card stack decision-lab">
      <div className="section-row compact">
        <div>
          <span className="eyebrow">Remediation scenario analysis</span>
          <h2>Evaluate corrective actions</h2>
        </div>
        <span className="safety-chip">Simulation only</span>
      </div>
      <div className="stack">
        {failedRules.map((code) => (
          <label key={code} className="small">
            <input
              type="checkbox"
              checked={selected.includes(code)}
              onChange={(event) =>
                setSelected(
                  event.target.checked ? [...selected, code] : selected.filter((item) => item !== code),
                )
              }
            />{" "}
            {code} · {REMEDIATION_BY_RULE[code].label}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={simulate} disabled={Boolean(busy) || !selected.length}>
          {busy === "sim" ? "Simulating…" : "Simulate selected"}
        </button>
        <button className="btn secondary" onClick={explain} disabled={Boolean(busy)}>
          {busy === "ai" ? "Building briefing…" : "Ask AI to explain"}
        </button>
        <button
          className="btn secondary"
          onClick={requestRemediation}
          disabled={Boolean(busy) || !selected.length}
        >
          {busy === "fix" ? "Submitting…" : "Request remediation"}
        </button>
      </div>
      {output?.kind === "message" && (
        <div className="notice compact-notice" aria-live="polite">
          {output.text}
        </div>
      )}
      {output?.kind === "ai" && (
        <article className="ai-brief" aria-live="polite">
          <header>
            <span className="eyebrow">AI briefing · persisted verdict</span>
            <h3>{output.briefing.headline}</h3>
            <p>{output.briefing.summary}</p>
          </header>
          <div className="ai-findings">
            {output.briefing.keyFindings.map((finding) => (
              <div className="ai-finding" key={finding.ruleCode}>
                <span className={`badge ${finding.status}`}>
                  {finding.status === "pass" ? "✓" : "✕"} {finding.ruleCode}
                </span>
                <p>{finding.meaning}</p>
              </div>
            ))}
          </div>
          {output.briefing.nextSteps.length > 0 && (
            <div>
              <strong>Human next steps</strong>
              <ol>
                {output.briefing.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          )}
          <footer>ⓘ {output.briefing.legalNote}</footer>
        </article>
      )}
    </section>
  );
}
