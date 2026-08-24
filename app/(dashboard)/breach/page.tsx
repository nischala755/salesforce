import { prisma } from "@/lib/db";
import { BreachTracker } from "@/components/breach-tracker";

export default async function BreachPage() {
  const incidents = await prisma.incidentLog.findMany({ orderBy: { occurredAt: "desc" } });
  return (
    <main className="main">
      <p className="eyebrow">Incident response</p>
      <h1>Coordinate privacy milestones.</h1>
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
