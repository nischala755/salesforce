import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { RULE_CODES, type RuleCode, type RuleResult } from "@/lib/rules-engine";
import { simulatePersistedResults } from "@/lib/simulation";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ contactId: z.cuid(), rulesToFix: z.array(z.enum(RULE_CODES)).max(5) });

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A valid contactId and rulesToFix are required." }, { status: 400 });
    const latest = await prisma.complianceAssessment.findFirst({ where: { contactId: parsed.data.contactId }, orderBy: { assessedAt: "desc" }, include: { results: true } });
    if (!latest) return NextResponse.json({ error: "Run an assessment before simulating fixes." }, { status: 404 });
    const projected = simulatePersistedResults(latest.results as unknown as RuleResult[], parsed.data.rulesToFix as RuleCode[], new Date());
    await prisma.$transaction((tx) => writeAudit(tx, { actorId: session.sub, action: "assessment.simulated", entityType: "Contact", entityId: parsed.data.contactId, origin: "deterministic", metadata: { sourceAssessmentId: latest.id, rulesToFix: parsed.data.rulesToFix, projectedScore: projected.score, projectedStatus: projected.finalStatus } }));
    return NextResponse.json({ sourceAssessmentId: latest.id, current: { score: latest.score, status: latest.finalStatus }, projected: { score: projected.score, status: projected.finalStatus, results: projected.results } });
  } catch (error) {
    return apiError(error);
  }
}
