import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  status: z.enum(["open", "contained", "closed"]).optional(),
  boardNotified: z.boolean().optional(),
  affectedPersonsNotified: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "No valid incident update was supplied." }, { status: 400 });
    const now = new Date();
    const incident = await prisma.$transaction(async (tx) => {
      const current = await tx.incidentLog.findUnique({ where: { id } });
      if (!current) throw new Error("INCIDENT_NOT_FOUND");
      if (parsed.data.status === "contained" && current.status !== "open") throw new Error("INVALID_INCIDENT_TRANSITION");
      if (parsed.data.status === "closed") {
        const boardLogged = Boolean(current.boardNotifiedAt || parsed.data.boardNotified);
        const peopleLogged = Boolean(current.affectedPersonsNotifiedAt || parsed.data.affectedPersonsNotified);
        if (current.status !== "contained" || !boardLogged || !peopleLogged) throw new Error("INCIDENT_NOT_READY_TO_CLOSE");
      }
      if (parsed.data.status === "open" || current.status === "closed") throw new Error("INVALID_INCIDENT_TRANSITION");

      const updated = await tx.incidentLog.update({
        where: { id },
        data: {
          status: parsed.data.status,
          boardNotifiedAt: parsed.data.boardNotified && !current.boardNotifiedAt ? now : undefined,
          affectedPersonsNotifiedAt: parsed.data.affectedPersonsNotified && !current.affectedPersonsNotifiedAt ? now : undefined,
        },
      });
      await writeAudit(tx, {
        actorId: session.sub,
        action: parsed.data.status ? `incident.${parsed.data.status}` : "incident.milestone_recorded",
        entityType: "IncidentLog",
        entityId: id,
        metadata: parsed.data,
      });
      return updated;
    });
    return NextResponse.json(incident);
  } catch (error) {
    if (error instanceof Error && error.message === "INCIDENT_NOT_FOUND") return NextResponse.json({ error: "Incident not found." }, { status: 404 });
    if (error instanceof Error && error.message === "INVALID_INCIDENT_TRANSITION") return NextResponse.json({ error: "Incident status can only move from open to contained to closed." }, { status: 409 });
    if (error instanceof Error && error.message === "INCIDENT_NOT_READY_TO_CLOSE") return NextResponse.json({ error: "Contain the incident and log both notification milestones before closure." }, { status: 409 });
    return apiError(error);
  }
}
