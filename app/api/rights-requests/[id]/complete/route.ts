import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { writeAudit } from "@/lib/audit";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const session = await requireSession(); const { id } = await context.params; const item = await prisma.$transaction(async (tx) => { const changed = await tx.rightsRequest.updateMany({ where: { id, status: "open" }, data: { status: "completed", completedAt: new Date() } }); if (changed.count !== 1) throw new Error("INVALID_RIGHTS_TRANSITION"); const updated = await tx.rightsRequest.findUniqueOrThrow({ where: { id } }); await writeAudit(tx, { actorId: session.sub, action: "rights_request.completed", entityType: "RightsRequest", entityId: id }); return updated; }); return NextResponse.json(item); }
  catch (error) { if (error instanceof Error && error.message === "INVALID_RIGHTS_TRANSITION") return NextResponse.json({ error: "Only open requests can be completed." }, { status: 409 }); return apiError(error); }
}
