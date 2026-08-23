import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { explainVerdict } from "@/lib/ai/mistral";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ assessmentId: z.cuid(), question: z.string().trim().max(500).optional() });

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A valid assessmentId is required." }, { status: 400 });
    const assessment = await prisma.complianceAssessment.findUnique({ where: { id: parsed.data.assessmentId }, include: { results: { orderBy: { ruleCode: "asc" } } } });
    if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    // Deliberately exclude Contact and all direct personal fields from the model input.
    const minimized = { score: assessment.score, status: assessment.finalStatus, results: assessment.results.map(({ ruleCode, ruleVersion, passed, reasonCode, evidenceExplanation, legalReference }) => ({ ruleCode, ruleVersion, passed, reasonCode, evidenceExplanation, legalReference })) };
    try {
      const explanation = await explainVerdict(minimized, parsed.data.question);
      await prisma.$transaction((tx) => writeAudit(tx, { actorId: session.sub, action: "ai.explanation.completed", entityType: "ComplianceAssessment", entityId: assessment.id, origin: "ai", metadata: { question: parsed.data.question ?? null, model: "mistral-small-latest" } }));
      return NextResponse.json({ explanation });
    } catch (aiError) {
      await prisma.$transaction((tx) => writeAudit(tx, { actorId: session.sub, action: "ai.explanation.unavailable", entityType: "ComplianceAssessment", entityId: assessment.id, origin: "ai", metadata: { reason: aiError instanceof Error ? aiError.message : "unknown" } }));
      return NextResponse.json({ explanation: null, error: "Explanation unavailable. Deterministic assessment data is unaffected." }, { status: 503 });
    }
  } catch (error) {
    return apiError(error);
  }
}
