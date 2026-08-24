import { prisma } from "@/lib/db";
import { BreachTracker } from "@/components/breach-tracker";

export default async function BreachPage() {
  const incidents = await prisma.incidentLog.findMany({ orderBy: { occurredAt: "desc" } });
  return (
    <main className="main">
      <p className="eyebrow">Incident response</p>
      <h1>Breach response workspace</h1>
      <p className="lede">A shared evidence and notification workspace for the Incident Response Lead and DPO after a suspected personal-data breach.</p>

      <section className="context-grid" aria-label="Why breach response is part of ComplyLens">
        <article><span className="eyebrow">Primary personas</span><h2>Incident lead + DPO</h2><p>The incident lead records facts and operational updates; the DPO reviews notification obligations and the evidence trail.</p></article>
        <article><span className="eyebrow">Why it is essential</span><h2>Compliance continues after detection</h2><p>Preventive scores cannot coordinate a live incident. Teams need one timeline for occurrence, affected scope, notifications and accountable follow-up.</p></article>
        <article><span className="eyebrow">Existing-customer impact</span><h2>Complements current IR tooling</h2><p>Customers can retain their ticketing and security platforms. ComplyLens stores the minimum privacy-specific milestones required for oversight and audit evidence.</p></article>
      </section>

      <div className="notice danger-note"><strong>₹200 crore is statutory maximum-risk context only.</strong> It is not a predicted penalty for a specific incident.</div>
      <div className="notice integration-note"><strong>Integration boundary:</strong> this demo captures incident milestones directly. A production connector can receive case IDs and status events from the customer’s existing security or ticketing platform.</div>
      <div style={{ marginTop: "1rem" }}>
        <BreachTracker incidents={incidents.map((incident) => ({
          ...incident,
          occurredAt: incident.occurredAt.toISOString(),
          boardNotifiedAt: incident.boardNotifiedAt?.toISOString() ?? null,
          affectedPersonsNotifiedAt: incident.affectedPersonsNotifiedAt?.toISOString() ?? null,
          createdAt: undefined,
          updatedAt: undefined,
        }))} />
      </div>
    </main>
  );
}
