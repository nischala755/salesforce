import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { ApplyRemediation, RemediationReview, SdfToggle } from "@/components/dpo-actions";
import { AuditProofGraph } from "@/components/audit-proof-graph";
import { requirePageSession } from "@/lib/auth/session";

export default async function DpoPage() {
  const session = await requirePageSession();
  const [contacts, rights, settings, remediations] = await Promise.all([
    prisma.contact.findMany({
      include: { assessments: { orderBy: { assessedAt: "desc" }, take: 1 } },
    }),
    prisma.rightsRequest.findMany({
      where: { status: "open" },
      include: { contact: { select: { name: true } } },
      orderBy: { dueAt: "asc" },
      take: 10,
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
  const expiring = contacts.filter(
    (contact) =>
      contact.retentionEndsAt &&
      contact.retentionEndsAt >= new Date() &&
      contact.retentionEndsAt <= cutoff,
  );

  return (
    <main className="main">
      <p className="eyebrow">Executive operations</p>
      <h1>DPO operations overview</h1>
      <p className="lede">The independent control room for the DPO or Privacy Operations Lead—not a second CRM dashboard.</p>
      <section className="context-grid" aria-label="Why DPO oversight is part of ComplyLens">
        <article><span className="eyebrow">Primary persona</span><h2>DPO / Privacy Operations Lead</h2><p>Reviews exceptions across teams, challenges proposed fixes and owns the evidence presented to leadership or auditors.</p></article>
        <article><span className="eyebrow">Why it is essential</span><h2>Assessment needs accountable action</h2><p>A score alone does not close a gap. This view enforces four-eyes approval, tracks rights and retention pressure, and verifies the audit trail.</p></article>
        <article><span className="eyebrow">Existing-customer impact</span><h2>Governance above current workflows</h2><p>CRM stewards keep investigating in their existing systems. The DPO receives one review queue and exportable evidence without taking over operational ownership.</p></article>
      </section>
      <div className="grid metrics">
        <div className="card">
          <span className="metric-label">Organization compliance</span>
          <strong className="metric-value">
            {latest.length ? Math.round((compliant / latest.length) * 100) : 0}%
          </strong>
        </div>
        <div className="card">
          <span className="metric-label">Retention due ≤90 days</span>
          <strong className="metric-value">{expiring.length}</strong>
        </div>
        <div className="card">
          <span className="metric-label">Open rights requests</span>
          <strong className="metric-value">{rights.length}</strong>
        </div>
        <div className="card">
          <span className="metric-label">Awaiting human action</span>
          <strong className="metric-value">{remediations.length}</strong>
        </div>
      </div>
      <div className="action-strip">
        <a className="btn" href="/api/reports/csv">Download board CSV</a>
        <SdfToggle enabled={settings?.sdfMode ?? false} />
        <span className="legal-chip" title="SDF classification depends on government notification.">
          ⓘ Operational flag only
        </span>
      </div>

      <AuditProofGraph />

      <div className="section-row">
        <div><h2>Independent remediation review</h2><p className="muted">CRM and data stewards initiate corrections; a different DPO user approves and syncs verified evidence.</p></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contacts</th>
              <th>Type</th>
              <th>Status</th>
              <th>Requested by</th>
              <th>Human action</th>
            </tr>
          </thead>
          <tbody>
            {remediations.length ? (
              remediations.map((remediation) => (
                <tr key={remediation.id}>
                  <td>{remediation.targets.map((target) => target.contact.name).join(", ")}</td>
                  <td>{remediation.type.replaceAll("_", " ")}<br/><span className="small muted">{remediation.draftMessage}</span></td>
                  <td>
                    <StatusBadge status={remediation.status === "approved" ? "compliant" : "at_risk"} />
                    <br />
                    <span className="small muted">{remediation.status.replaceAll("_", " ")}</span>
                  </td>
                  <td>{remediation.createdBy.name}</td>
                  <td>
                    {session.role !== "dpo" ? (
                      <span className="small muted">DPO reviewer login required</span>
                    ) : remediation.status === "pending_approval" && remediation.createdBy.id === session.sub ? (
                      <span className="small muted">A different DPO must review this request</span>
                    ) : remediation.status === "pending_approval" ? (
                      <RemediationReview id={remediation.id} consent={remediation.type === "consent_renewal"} />
                    ) : (
                      <ApplyRemediation id={remediation.id} consent={remediation.type === "consent_renewal"} />
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="muted">No remediation requests are awaiting review.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
