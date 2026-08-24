"use client";

import { useEffect, useMemo, useState } from "react";
import {
  assessContact,
  type ComplianceRuleVersion,
  type ContactEvidence,
} from "@/lib/rules-engine";

type EvidenceSwitches = {
  consent: boolean;
  purpose: boolean;
  retention: boolean;
  notice: boolean;
  minimization: boolean;
};

const evaluatedAt = new Date("2026-08-24T00:00:00.000Z");
const presets: Record<string, EvidenceSwitches> = {
  "Aditi: expired consent": { consent: false, purpose: true, retention: true, notice: true, minimization: true },
  "Retention gap": { consent: true, purpose: true, retention: false, notice: true, minimization: true },
  "Multiple gaps": { consent: false, purpose: false, retention: false, notice: false, minimization: true },
  "Fully compliant": { consent: true, purpose: true, retention: true, notice: true, minimization: true },
};

const evidenceLabels: Array<{ key: keyof EvidenceSwitches; label: string; source: string }> = [
  { key: "consent", label: "Active consent", source: "Consent manager" },
  { key: "purpose", label: "Lawful purpose", source: "Processing register" },
  { key: "retention", label: "Current retention date", source: "CRM metadata" },
  { key: "notice", label: "Notice delivery recorded", source: "Communication log" },
  { key: "minimization", label: "Minimization reviewed", source: "Data inventory" },
];

function toEvidence(value: EvidenceSwitches): ContactEvidence {
  return {
    evaluatedAt,
    consents: value.consent
      ? [{ active: true, expiresAt: new Date("2027-08-24T00:00:00.000Z"), withdrawnAt: null }]
      : [{ active: true, expiresAt: new Date("2026-01-01T00:00:00.000Z"), withdrawnAt: null }],
    purposes: [{ active: true, lawfulBasis: value.purpose ? "consent" : null }],
    retentionEndsAt: value.retention ? new Date("2027-08-24T00:00:00.000Z") : null,
    noticeDeliveredAt: value.notice ? new Date("2026-02-10T00:00:00.000Z") : null,
    minimizationCompliant: value.minimization,
  };
}

function sameEvidence(left: EvidenceSwitches, right: EvidenceSwitches): boolean {
  return evidenceLabels.every(({ key }) => left[key] === right[key]);
}

export function RuleTraceStudio({ rules }: { rules: ComplianceRuleVersion[] }) {
  const initial = presets["Aditi: expired consent"];
  const [draft, setDraft] = useState<EvidenceSwitches>(initial);
  const [executed, setExecuted] = useState<EvidenceSwitches>(initial);
  const [runNumber, setRunNumber] = useState(1);
  const [replayVerified, setReplayVerified] = useState(false);
  const [fingerprint, setFingerprint] = useState("calculating…");
  const [showExtension, setShowExtension] = useState(false);

  const result = useMemo(() => assessContact(toEvidence(executed), rules), [executed, rules]);
  const failedDeduction = result.results.reduce(
    (total, item) => total + (item.passed ? 0 : item.deduction),
    0,
  );
  const hasPendingChanges = !sameEvidence(draft, executed);

  useEffect(() => {
    let current = true;
    const canonical = JSON.stringify({
      evidence: executed,
      rules: rules.map(({ code, version, severity, deduction, legalReference }) => ({ code, version, severity, deduction, legalReference })),
      verdict: {
        score: result.score,
        status: result.finalStatus,
        results: result.results.map(({ ruleCode, ruleVersion, passed, reasonCode, deduction }) => ({ ruleCode, ruleVersion, passed, reasonCode, deduction })),
      },
    });
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)).then((buffer) => {
      if (!current) return;
      const hex = Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
      setFingerprint(`${hex.slice(0, 16)}…${hex.slice(-8)}`);
    });
    return () => { current = false; };
  }, [executed, result, rules]);

  function executeTrace() {
    setReplayVerified(sameEvidence(draft, executed));
    setExecuted({ ...draft });
    setRunNumber((value) => value + 1);
  }

  return (
    <section className="rule-studio" aria-label="Interactive deterministic rule-engine demonstration">
      <header className="studio-head">
        <div>
          <span className="eyebrow">Interactive demo workflow</span>
          <h2>Rule Trace Studio</h2>
          <p>Change the evidence, execute the real scoring function and inspect the complete decision trace.</p>
        </div>
        <div className="studio-safety"><strong>No writes</strong><span>Browser-only scenario</span></div>
      </header>

      <div className="studio-presets" aria-label="Demo scenarios">
        {Object.entries(presets).map(([name, value]) => (
          <button type="button" key={name} onClick={() => { setDraft(value); setReplayVerified(false); }}>
            {name}
          </button>
        ))}
      </div>

      <div className="studio-grid">
        <div className="evidence-console">
          <div className="console-title"><span>01</span><div><strong>Evidence snapshot</strong><small>Toggle normalized inputs from customer systems.</small></div></div>
          <div className="evidence-switches">
            {evidenceLabels.map(({ key, label, source }) => (
              <label key={key} className={draft[key] ? "evidence-on" : "evidence-off"}>
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, [key]: event.target.checked }));
                    setReplayVerified(false);
                  }}
                />
                <span><strong>{label}</strong><small>{source}</small></span>
                <b>{draft[key] ? "PRESENT" : "MISSING"}</b>
              </label>
            ))}
          </div>
          <button type="button" className="studio-run" onClick={executeTrace}>
            <span>▶</span> {hasPendingChanges ? "Execute changed evidence" : "Replay identical evidence"}
          </button>
          <p className="studio-caption">Simulation calls the same typed evaluator used by assessments. It does not persist or alter customer records.</p>
        </div>

        <div className="trace-console">
          <div className="console-title"><span>02</span><div><strong>Deterministic execution trace</strong><small>Run #{runNumber} · five active controls</small></div></div>
          <div className="trace-summary">
            <div className={`score-orb ${result.finalStatus}`}><strong>{result.score}</strong><span>/100</span></div>
            <div><span className={`badge ${result.finalStatus}`}>{result.finalStatus.replaceAll("_", " ")}</span><p>100 − {failedDeduction} failed-control points = {result.score}</p><small>{result.severityGated ? "Severity gate changed the score-band status." : "Severity gate checked; no status override required."}</small></div>
          </div>
          <div className="trace-list">
            {result.results.map((item) => (
              <div key={item.ruleCode} className={item.passed ? "trace-pass" : "trace-fail"}>
                <span>{item.passed ? "✓" : "×"}</span>
                <code>{item.ruleCode} · v{item.ruleVersion}</code>
                <strong>{item.reasonCode.replaceAll("_", " ")}</strong>
                <b>{item.passed ? "0" : `−${item.deduction}`}</b>
              </div>
            ))}
          </div>
          <div className="fingerprint-band">
            <span>Scenario fingerprint · SHA-256</span>
            <code>{fingerprint}</code>
            <strong>{replayVerified ? "✓ IDENTICAL REPLAY CONFIRMED" : hasPendingChanges ? "CHANGES NOT EXECUTED" : "VERDICT REPRODUCIBLE"}</strong>
          </div>
        </div>
      </div>

      <div className="studio-extension">
        <div><span className="eyebrow">Extensibility demo</span><strong>Show how a future control enters the engine without changing historical verdicts.</strong></div>
        <button type="button" className="btn secondary" onClick={() => setShowExtension((value) => !value)}>{showExtension ? "Hide extension preview" : "Preview a future rule"}</button>
      </div>
      {showExtension && (
        <div className="extension-preview">
          <div><code>DPDP-006</code><strong>Illustrative data-accuracy control</strong><span>INACTIVE · ZERO SCORE IMPACT</span></div>
          <ol>
            <li><b>Evidence adapter</b><span>Map an approved accuracy-review signal.</span></li>
            <li><b>Typed evaluator</b><span>Return pass/fail, reason code and evidence explanation.</span></li>
            <li><b>Version registry</b><span>Add weight and legal mapping only after policy/counsel approval.</span></li>
            <li><b>Boundary tests</b><span>Activate for future runs; retain all earlier v1 verdicts.</span></li>
          </ol>
          <p>This is an architecture preview, not an active DPDP interpretation or legal conclusion.</p>
        </div>
      )}
    </section>
  );
}
