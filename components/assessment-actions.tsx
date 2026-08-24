"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REMEDIATION_BY_RULE, type RuleCode } from "@/lib/rules-engine";
import type { AIExplanation } from "@/lib/ai/mistral";

type Output =
  | { kind: "message"; text: string }
  | { kind: "ai"; briefing: AIExplanation; source: "mistral" | "deterministic_fallback" }
  | null;

export function AssessmentActions({
  contactId,
  contactName,
  assessmentId,
  failedRules,
}: {
  contactId: string;
  contactName: string;
  assessmentId: string;
  failedRules: RuleCode[];
}) {
  const [selected, setSelected] = useState<RuleCode[]>(failedRules);
  const [busy, setBusy] = useState<"" | "ai" | "fix">("");
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
        ? { kind: "ai", briefing: body.explanation, source: body.source }
        : { kind: "message", text: body.error },
    );
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
        ? selected.includes("DPDP-001")
          ? `Consent email queued for the data principal and ${body.requests.length} remediation request${body.requests.length === 1 ? "" : "s"} submitted. No consent is recorded until their external response is independently verified and synced.`
          : `${body.requests.length} remediation request${body.requests.length === 1 ? "" : "s"} submitted for independent DPO approval.`
        : body.error,
    });
    if (response.ok) router.refresh();
  }

  return (
    <section className="card stack decision-lab">
      <div className="section-row compact">
        <div>
          <span className="eyebrow">Corrective action</span>
          <h2>Resolve failed controls</h2>
        </div>
        <span className="safety-chip">Human approval required</span>
      </div>
      <div className="remediation-select">
        {failedRules.map((code) => (
          <label key={code}>
            <input
              type="checkbox"
              checked={selected.includes(code)}
              onChange={(event) => setSelected(
                event.target.checked ? [...selected, code] : selected.filter((item) => item !== code),
              )}
            />
            <span><strong>{code}</strong><small>{REMEDIATION_BY_RULE[code].label}</small></span>
          </label>
        ))}
      </div>
      {failedRules.includes("DPDP-001") && (
        <aside className="consent-handoff">
          <div>
            <span className="eyebrow">Consent handoff · demo connector</span>
            <strong>The operator never grants consent for {contactName}; only the data principal can make that choice.</strong>
          </div>
          <ol>
            <li><b>1</b><span>Send notice and consent link</span></li>
            <li><b>2</b><span>Data principal chooses externally</span></li>
            <li><b>3</b><span>DPO verifies the response</span></li>
            <li><b>4</b><span>Sync evidence and reassess</span></li>
          </ol>
          <p>Production connects to the customer&apos;s email and consent-management system; this demo represents that handoff without sending a real email.</p>
        </aside>
      )}
      <div className="action-strip">
        <button className="btn" onClick={explain} disabled={Boolean(busy)}>
          {busy === "ai" ? "Building insight brief…" : "Ask AI to explain"}
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
        <div className="notice compact-notice" aria-live="polite">{output.text}</div>
      )}
      {output?.kind === "ai" && (
        <article className="ai-brief" aria-live="polite">
          <header className="ai-brief-head">
            <div>
              <span className="eyebrow">Evidence-grounded insight brief</span>
              <h3>{output.briefing.headline}</h3>
              <p>{output.briefing.executiveSummary}</p>
            </div>
            <span className="ai-source">{output.source === "mistral" ? "AI synthesis" : "Verified fallback"}</span>
          </header>

          <div className={`ai-risk-signal ${output.briefing.riskSignal.level}`}>
            <span>{output.briefing.riskSignal.level}</span>
            <strong>{output.briefing.riskSignal.label}</strong>
            <p>{output.briefing.riskSignal.rationale}</p>
          </div>

          <section>
            <strong className="ai-section-title">Derived insights</strong>
            <div className="ai-insight-grid">
              {output.briefing.insights.map((insight) => (
                <article className="ai-insight" key={`${insight.category}-${insight.title}`}>
                  <div><span>{insight.category.replaceAll("_", " ")}</span><b>{insight.confidence} confidence</b></div>
                  <h4>{insight.title}</h4>
                  <p>{insight.insight}</p>
                  <footer>{insight.evidence.join(" · ")}</footer>
                </article>
              ))}
            </div>
          </section>

          <section>
            <strong className="ai-section-title">Governed next actions</strong>
            <ol className="ai-action-list">
              {output.briefing.actions.sort((left, right) => left.priority - right.priority).map((action) => (
                <li key={`${action.priority}-${action.owner}`}>
                  <b>{String(action.priority).padStart(2, "0")}</b>
                  <span><strong>{action.owner}</strong><p>{action.action}</p><small>Success signal · {action.successSignal}</small></span>
                </li>
              ))}
            </ol>
          </section>
          <footer>ⓘ {output.briefing.legalNote}</footer>
        </article>
      )}
    </section>
  );
}
