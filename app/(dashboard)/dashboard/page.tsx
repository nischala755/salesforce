import Link from "next/link";
import { prisma } from "@/lib/db";
import { AssessButton } from "@/components/assess-button";
import { StatusBadge } from "@/components/status-badge";
import { RecoveryRadar } from "@/components/recovery-radar";
import { RuleEngineExplainer } from "@/components/rule-engine-explainer";
import { RuleTraceStudio } from "@/components/rule-trace-studio";
import { RULE_CODES, type RuleCode, type RuleResult } from "@/lib/rules-engine";
import { simulatePersistedResults } from "@/lib/simulation";

const ruleNames: Record<string, string> = {
  "DPDP-001": "Consent",
  "DPDP-002": "Purpose",
  "DPDP-003": "Retention",
  "DPDP-004": "Notice",
  "DPDP-005": "Minimization",
};

export default async function DashboardPage() {
  const [contacts, rules, awaitingHumanAction] = await Promise.all([
    prisma.contact.findMany({
      include: {
        assessments: {
          orderBy: { assessedAt: "desc" },
          take: 1,
          include: { results: true },
        },
      },
    }),
    prisma.complianceRule.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      include: {
        versions: {
          where: { effectiveTo: null },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    }),
    prisma.remediationRequest.count({
      where: { status: { in: ["pending_approval", "approved"] } },
    }),
  ]);

  const assessed = contacts.flatMap((contact) =>
    contact.assessments[0] ? [{ contact, assessment: contact.assessments[0] }] : [],
  );
  const counts = { compliant: 0, at_risk: 0, non_compliant: 0 };
  assessed.forEach(({ assessment }) => { counts[assessment.finalStatus] += 1; });
  const percent = assessed.length ? Math.round((counts.compliant / assessed.length) * 100) : 0;
  const openFindings = assessed.reduce(
    (total, { assessment }) => total + assessment.results.filter((result) => !result.passed).length,
    0,
  );
  const recovery = RULE_CODES.map((code) => {
    const impacted = assessed.filter(({ assessment }) =>
      assessment.results.some((result) => result.ruleCode === code && !result.passed),
    );
    const sample = impacted[0]?.assessment.results.find((result) => result.ruleCode === code);
    const statusImprovements = impacted.filter(({ assessment }) =>
      simulatePersistedResults(
        assessment.results as unknown as RuleResult[],
        [code],
        new Date(),
      ).finalStatus !== assessment.finalStatus,
    ).length;
    return {
      code,
      label: ruleNames[code],
      deduction: sample?.deduction ?? 0,
      failedCount: impacted.length,
      recoverablePoints: impacted.length * (sample?.deduction ?? 0),
      statusImprovements,
      contacts: impacted.map(({ contact }) => ({ id: contact.id, name: contact.name })),
    };
  }).sort((a, b) => b.recoverablePoints - a.recoverablePoints);
  const activeRules = rules.flatMap((rule) => rule.versions[0] ? [{
    code: rule.code as RuleCode,
    control: rule.control,
    severity: rule.severity,
    deduction: rule.deduction,
    version: rule.versions[0].version,
    legalReference: rule.versions[0].legalReference,
  }] : []);
  const recent = assessed
    .sort((left, right) => right.assessment.assessedAt.getTime() - left.assessment.assessedAt.getTime())
    .slice(0, 6);

  return (
    <main className="main">
      <section className="focus-hero">
        <div>
          <p className="eyebrow">Compliance control room</p>
          <h1>Evidence to accountable action.</h1>
        </div>
        <div className="focus-principle">
          <span>Operating principle</span>
          <strong>Rules decide.</strong>
          <strong>AI explains.</strong>
          <strong>Humans approve.</strong>
        </div>
      </section>

      <div className="workflow-label">
        <span className="eyebrow">One record, end to end</span>
        <strong>Aditi&apos;s compliance path</strong>
      </div>
      <ol className="workflow-strip" aria-label="Aditi Kapoor compliance decision path">
        <li>
          <span>01</span><em>Rule engine</em><strong>Evidence</strong>
          <small>Consent expired</small>
        </li>
        <li>
          <span>02</span><em>Rule engine</em><strong>Verdict</strong>
          <small>DPDP-001 fails · 70/100</small>
        </li>
        <li className="workflow-human">
          <span>03</span><em>Human control</em><strong>Remediation</strong>
          <small>Preview 100 · request DPO review</small>
        </li>
        <li className="workflow-human">
          <span>04</span><em>Human control</em><strong>Verified outcome</strong>
          <small>Approve · append new 100/100 verdict</small>
        </li>
      </ol>

      <section className="grid metrics focused-metrics" aria-label="Current compliance posture">
        <div className="card">
          <span className="metric-label">Compliant contacts</span>
          <strong className="metric-value">{percent}%</strong>
          <span className="metric-foot">{assessed.length} of {contacts.length} contacts assessed</span>
        </div>
        <div className="card">
          <span className="metric-label">Open findings</span>
          <strong className="metric-value">{openFindings}</strong>
          <span className="metric-foot">Across the latest persisted verdicts</span>
        </div>
        <div className="card">
          <span className="metric-label">Awaiting human action</span>
          <strong className="metric-value">{awaitingHumanAction}</strong>
          <span className="metric-foot">Pending approval or verified application</span>
        </div>
      </section>

      <div className="section-row compact">
        <div><p className="eyebrow">Decision workspace</p><h2>Test the rule engine</h2></div>
        <span className="safety-chip">No customer records changed</span>
      </div>
      <RuleTraceStudio rules={activeRules} />

      <details className="focus-disclosure">
        <summary>
          <span><strong>How the scoring engine works</strong><small>Architecture, active controls and extension contract</small></span>
          <b>View technical detail</b>
        </summary>
        <RuleEngineExplainer rules={activeRules} />
      </details>

      <div className="section-row">
        <div><p className="eyebrow">Action priority</p><h2>Where remediation creates the most impact</h2></div>
      </div>
      <RecoveryRadar items={recovery} />

      <div className="section-row">
        <div><h2>Latest verdicts</h2><p className="muted">Open a contact to inspect evidence and request remediation.</p></div>
        <div className="action-strip"><AssessButton /><Link className="btn secondary" href="/contacts">Investigate contacts</Link></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Contact</th><th>Score</th><th>Status</th><th>Assessed</th></tr></thead>
          <tbody>{recent.map(({ contact, assessment }) => (
            <tr key={assessment.id}>
              <td><Link href={`/contacts/${contact.id}`}><strong>{contact.name}</strong></Link><br/><span className="muted small">{contact.department}</span></td>
              <td>{assessment.score}</td>
              <td><StatusBadge status={assessment.finalStatus}/></td>
              <td>{assessment.assessedAt.toLocaleString("en-IN")}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </main>
  );
}
