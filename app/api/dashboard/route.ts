import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";

export async function GET() {
  try {
    await requireSession();
    const [contacts, settings, incidents] = await Promise.all([
      prisma.contact.findMany({ include: { assessments: { orderBy: { assessedAt: "desc" }, take: 1, include: { results: true } } } }),
      prisma.organizationSettings.findUnique({ where: { id: "default" } }),
      prisma.incidentLog.findMany({ where: { status: { not: "closed" } }, orderBy: { occurredAt: "desc" }, take: 5 }),
    ]);
    const latest = contacts.flatMap((contact) => contact.assessments[0] ? [{ contact, assessment: contact.assessments[0] }] : []);
    const counts = { compliant: 0, at_risk: 0, non_compliant: 0 };
    for (const item of latest) counts[item.assessment.finalStatus] += 1;
    const compliancePercent = latest.length ? Math.round((counts.compliant / latest.length) * 100) : 0;
    const retentionCutoff = new Date(Date.now() + 90 * 86_400_000);
    const retentionExpiring = contacts.filter((contact) => contact.retentionEndsAt && contact.retentionEndsAt >= new Date() && contact.retentionEndsAt <= retentionCutoff).map(({ id, name, retentionEndsAt }) => ({ id, name, retentionEndsAt }));
    return NextResponse.json({ totalContacts: contacts.length, assessedContacts: latest.length, compliancePercent, counts, sdfMode: settings?.sdfMode ?? false, retentionExpiring, incidents, recentAssessments: latest.sort((a, b) => b.assessment.assessedAt.getTime() - a.assessment.assessedAt.getTime()).slice(0, 8).map(({ contact, assessment }) => ({ contactId: contact.id, contactName: contact.name, id: assessment.id, score: assessment.score, status: assessment.finalStatus, assessedAt: assessment.assessedAt })) });
  } catch (error) { return apiError(error); }
}
