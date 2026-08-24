import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { ApplyRemediation, RemediationReview, SdfToggle } from "@/components/dpo-actions";
import { AuditProofGraph } from "@/components/audit-proof-graph";
import { requirePageSession } from "@/lib/auth/session";

export default async function DpoPage() {
  const session = await requirePageSession();
  const [contacts, settings, remediations] = await Promise.all([
    prisma.contact.findMany({
      include: { assessments: { orderBy: { assessedAt: "desc" }, take: 1 } },
    }),
    prisma.organizationSettings.findUnique({ where: { id: "default" } }),
    prisma.remediationRequest.findMany({
      where: { status: { in: ["pending_approval", "approved"] } },
      include: {
        createdBy: { select: { id: true, name: true } },
        targets: { include: { contact: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const latest = contacts.flatMap((contact) => contact.assessments[0] ? [contact.assessments[0]] : []);
  const compliant = latest.filter((assessment) => assessment.finalStatus === "compliant").length;
  const cutoff = new Date(Date.now() + 90 * 86_400_000);
  const expiring = contacts.filter((contact) =>
    contact.retentionEndsAt &&
    contact.retentionEndsAt >= new Date() &&
    contact.retentionEndsAt <= cutoff,
  );

  return (
    <main className="main">
      <p className="eyebrow">Governance</p>
      <h1>Review, approve, verify.</h1>

      <section className="grid metrics focused-metrics" aria-label="Governance summary">
        <div className="card">
          <span className="metric-label">Compliant contacts</span>
          <strong className="metric-value">{latest.length ? Math.round((compliant / latest.length) * 100) : 0}%</strong>
        </div>
        <div className="card">
          <span className="metric-label">Retention due within 90 days</span>
          <strong className="metric-value">{expiring.length}</strong>
        </div>
        <div className="card">
          <span className="metric-label">Awaiting human action</span>
          <strong className="metric-value">{remediations.length}</strong>
        </div>
      </section>

      <div className="action-strip governance-actions">
        <a className="btn" href="/api/reports/csv">Download board CSV</a>
        <Link className="btn secondary" href="/timeline">View readiness timeline</Link>
        <SdfToggle enabled={settings?.sdfMode ?? false} />
      </div>

      <div className="section-row">
        <div>
          <p className="eyebrow">Four-eyes control</p>
          <h2>Independent remediation review</h2>
          <p className="muted">A steward proposes the correction; a different DPO reviewer decides and applies it.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Contacts</th><th>Finding</th><th>Status</th><th>Requested by</th><th>Decision</th></tr></thead>
          <tbody>
            {remediations.length ? remediations.map((remediation) => (
              <tr key={remediation.id}>
                <td>{remediation.targets.map((target) => target.contact.name).join(", ")}</td>
                <td>{remediation.type.replaceAll("_", " ")}<br/><span className="small muted">{remediation.draftMessage}</span></td>
                <td><StatusBadge status={remediation.status === "approved" ? "compliant" : "at_risk"}/><br/><span className="small muted">{remediation.status.replaceAll("_", " ")}</span></td>
                <td>{remediation.createdBy.name}</td>
                <td>
                  {session.role !== "dpo" ? (
                    <span className="small muted">DPO reviewer login required</span>
                  ) : remediation.status === "pending_approval" && remediation.createdBy.id === session.sub ? (
                    <span className="small muted">A different DPO must review this request</span>
                  ) : remediation.status === "pending_approval" ? (
                    <RemediationReview id={remediation.id} consent={remediation.type === "consent_renewal"}/>
                  ) : (
                    <ApplyRemediation id={remediation.id} consent={remediation.type === "consent_renewal"}/>
                  )}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="muted">No remediation requests are awaiting review.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="focus-disclosure governance-proof">
        <summary>
          <span><strong>Audit integrity and Merkle proof</strong><small>Verify the history or export evidence when required</small></span>
          <b>Open verification workspace</b>
        </summary>
        <AuditProofGraph />
      </details>
    </main>
  );
}
