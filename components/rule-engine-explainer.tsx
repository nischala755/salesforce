interface RuleSummary {
  code: string;
  control: string;
  severity: string;
  deduction: number;
  version: number;
  legalReference: string;
}

export function RuleEngineExplainer({ rules }: { rules: RuleSummary[] }) {
  return (
    <section className="card engine-explainer">
      <header className="engine-head">
        <div>
          <span className="eyebrow">Deterministic rule engine</span>
          <h2>How evidence becomes a reproducible verdict</h2>
          <p className="muted">
            The same evidence and rule version always produce the same result. AI is called only
            after the verdict is stored and has no scoring or write path.
          </p>
        </div>
        <span className="safety-chip">Versioned and testable</span>
      </header>

      <ol className="engine-flow" aria-label="Assessment processing stages">
        <li><strong>1</strong><span><b>Normalize evidence</b><small>Consent, purpose, retention, notice and minimization metadata.</small></span></li>
        <li><strong>2</strong><span><b>Evaluate controls</b><small>Each active rule returns pass/fail, reason code and evidence explanation.</small></span></li>
        <li><strong>3</strong><span><b>Calculate posture</b><small>Start at 100, subtract failed-control weights, then apply the severity gate.</small></span></li>
        <li><strong>4</strong><span><b>Persist the verdict</b><small>Append the rule version, legal mapping, score and results to history.</small></span></li>
      </ol>

      <div className="engine-detail">
        <div>
          <h3>Active control registry</h3>
          <div className="rule-registry">
            {rules.map((rule) => (
              <div key={rule.code}>
                <code>{rule.code}</code>
                <span><strong>{rule.control}</strong><small>{rule.legalReference}</small></span>
                <span className="rule-weight">v{rule.version} · −{rule.deduction} · {rule.severity}</span>
              </div>
            ))}
          </div>
        </div>
        <aside className="extension-panel">
          <span className="eyebrow">Extension contract</span>
          <h3>Add policy without rewriting the product</h3>
          <ol>
            <li>Map a new normalized evidence field or connector.</li>
            <li>Add a typed evaluator and remediation definition.</li>
            <li>Publish a new database-backed rule version and legal reference.</li>
            <li>Add boundary tests, then activate it for future assessments.</li>
          </ol>
          <p>
            Historical verdicts keep their original rule version. New connectors and rules extend
            the registry without changing AI, dashboards or the append-only assessment model.
          </p>
        </aside>
      </div>
    </section>
  );
}
