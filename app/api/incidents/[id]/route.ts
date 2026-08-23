import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ status: z.enum(["open", "contained", "closed"]).optional(), boardNotified: z.boolean().optional(), affectedPersonsNotified: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(); const { id } = await context.params; const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "No valid incident update was supplied." }, { status: 400 });
    const now = new Date();
    const incident = await prisma.$transaction(async (tx) => { const updated = await tx.incidentLog.update({ where: { id }, data: { status: parsed.data.status, boardNotifiedAt: parsed.data.boardNotified ? now : undefined, affectedPersonsNotifiedAt: parsed.data.affectedPersonsNotified ? now : undefined } }); await writeAudit(tx, { actorId: session.sub, action: "incident.updated", entityType: "IncidentLog", entityId: id, metadata: parsed.data }); return updated; });
    return NextResponse.json(incident);
  } catch (error) { return apiError(error); }
}
