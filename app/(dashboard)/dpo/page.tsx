import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { ApplyRemediation, RemediationReview, SdfToggle } from "@/components/dpo-actions";
import { AuditProofGraph } from "@/components/audit-proof-graph";

export default async function DpoPage() {
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
        createdBy: { select: { name: true } },
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
        <h2>Remediation approvals</h2>
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
                  <td>{remediation.type.replaceAll("_", " ")}</td>
                  <td>
                    <StatusBadge status={remediation.status === "approved" ? "compliant" : "at_risk"} />
                    <br />
                    <span className="small muted">{remediation.status.replaceAll("_", " ")}</span>
                  </td>
                  <td>{remediation.createdBy.name}</td>
                  <td>
                    {remediation.status === "pending_approval" ? (
                      <RemediationReview id={remediation.id} />
                    ) : (
                      <ApplyRemediation id={remediation.id} />
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
