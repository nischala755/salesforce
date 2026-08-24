import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ occurredAt: z.iso.datetime(), description: z.string().trim().min(1).max(2_000), affectedContactCount: z.number().int().min(0).max(10_000_000) });

export async function GET() {
  try { await requireSession(); return NextResponse.json(await prisma.incidentLog.findMany({ orderBy: { occurredAt: "desc" } })); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(); const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Valid occurrence time, description, and affected count are required." }, { status: 400 });
    const occurredAt = new Date(parsed.data.occurredAt);
    if (occurredAt.getTime() > Date.now() + 5 * 60_000) return NextResponse.json({ error: "Occurrence time cannot be in the future." }, { status: 400 });
    const incident = await prisma.$transaction(async (tx) => { const created = await tx.incidentLog.create({ data: { ...parsed.data, occurredAt } }); await writeAudit(tx, { actorId: session.sub, action: "incident.created", entityType: "IncidentLog", entityId: created.id, metadata: { affectedContactCount: created.affectedContactCount } }); return created; });
    return NextResponse.json(incident, { status: 201 });
  } catch (error) { return apiError(error); }
}
