import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ contactId: z.cuid(), type: z.enum(["access", "correction", "erasure", "grievance"]), details: z.string().trim().max(2_000).optional() });
export async function GET() {
  try { await requireSession(); return NextResponse.json(await prisma.rightsRequest.findMany({ include: { contact: { select: { id: true, name: true, email: true } } }, orderBy: [{ status: "asc" }, { dueAt: "asc" }] })); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const session = await requireSession(); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "A valid contact and request type are required." }, { status: 400 });
    const settings = await prisma.organizationSettings.findUnique({ where: { id: "default" } });
    const hours = settings?.[`${parsed.data.type}SlaHours` as "accessSlaHours" | "correctionSlaHours" | "erasureSlaHours" | "grievanceSlaHours"] ?? (parsed.data.type === "grievance" ? 168 : 720);
    const dueAt = new Date(Date.now() + hours * 3_600_000);
    const item = await prisma.$transaction(async (tx) => { const created = await tx.rightsRequest.create({ data: { ...parsed.data, dueAt } }); await writeAudit(tx, { actorId: session.sub, action: "rights_request.created", entityType: "RightsRequest", entityId: created.id, metadata: { type: created.type, dueAt: dueAt.toISOString() } }); return created; });
    return NextResponse.json(item, { status: 201 });
  } catch (error) { return apiError(error); }
}
