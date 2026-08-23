import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ sdfMode: z.boolean().optional(), accessSlaHours: z.number().int().min(1).max(8760).optional(), correctionSlaHours: z.number().int().min(1).max(8760).optional(), erasureSlaHours: z.number().int().min(1).max(8760).optional(), grievanceSlaHours: z.number().int().min(1).max(8760).optional() }).refine((value) => Object.keys(value).length > 0);
export async function GET() { try { await requireSession(); return NextResponse.json(await prisma.organizationSettings.findUnique({ where: { id: "default" } })); } catch (error) { return apiError(error); } }
export async function PATCH(request: Request) {
  try { const session = await requireSession(); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid organization setting." }, { status: 400 }); const settings = await prisma.$transaction(async (tx) => { const updated = await tx.organizationSettings.update({ where: { id: "default" }, data: parsed.data }); await writeAudit(tx, { actorId: session.sub, action: "settings.updated", entityType: "OrganizationSettings", entityId: "default", metadata: parsed.data }); return updated; }); return NextResponse.json(settings); }
  catch (error) { return apiError(error); }
}
