import { prisma } from "@/lib/db";
import { assessContact, RULE_CODES, type ComplianceRuleVersion, type RuleCode } from "@/lib/rules-engine";
import { writeAudit } from "@/lib/audit";

function isRuleCode(value: string): value is RuleCode {
  return RULE_CODES.includes(value as RuleCode);
}

export async function activeRuleVersions(): Promise<ComplianceRuleVersion[]> {
  const rules = await prisma.complianceRule.findMany({
    where: { active: true, code: { in: [...RULE_CODES] } },
    include: { versions: { where: { effectiveTo: null }, orderBy: { version: "desc" }, take: 1 } },
  });
  return rules.map((rule) => {
    if (!isRuleCode(rule.code) || !rule.versions[0]) throw new Error(`Active version missing for ${rule.code}.`);
    return { code: rule.code, version: rule.versions[0].version, severity: rule.severity, deduction: rule.deduction, legalReference: rule.versions[0].legalReference };
  });
}

export async function runAssessments(contactIds: string[], actorId: string) {
  const [contacts, versions] = await Promise.all([
    prisma.contact.findMany({
      where: contactIds.length ? { id: { in: contactIds } } : undefined,
      include: { consents: true, purposes: true },
      orderBy: { id: "asc" },
    }),
    activeRuleVersions(),
  ]);
  if (contactIds.length && contacts.length !== new Set(contactIds).size) throw new Error("One or more contacts were not found.");
  const evaluatedAt = new Date();
  const evaluated = contacts.map((contact) => ({
    contact,
    result: assessContact({
      evaluatedAt,
      consents: contact.consents.map(({ active, expiresAt, withdrawnAt }) => ({ active, expiresAt, withdrawnAt })),
      purposes: contact.purposes.map(({ active, lawfulBasis }) => ({ active, lawfulBasis })),
      retentionEndsAt: contact.retentionEndsAt,
      noticeDeliveredAt: contact.noticeDeliveredAt,
      minimizationCompliant: contact.minimizationCompliant,
    }, versions),
  }));

  return prisma.$transaction(async (tx) => {
    const output = [];
    for (const item of evaluated) {
      // Append-only invariant: this service never updates a ComplianceAssessment or ComplianceResult.
      const assessment = await tx.complianceAssessment.create({
        data: {
          contactId: item.contact.id,
          assessedById: actorId,
          score: item.result.score,
          bandStatus: item.result.bandStatus,
          finalStatus: item.result.finalStatus,
          assessedAt: evaluatedAt,
          results: { create: item.result.results },
        },
      });
      if (item.result.recommendations.length) {
        await tx.complianceRecommendation.createMany({ data: item.result.recommendations.map((recommendation) => ({ contactId: item.contact.id, assessmentId: assessment.id, ...recommendation })) });
      }
      await writeAudit(tx, { actorId, action: "assessment.completed", entityType: "ComplianceAssessment", entityId: assessment.id, origin: "deterministic", metadata: { contactId: item.contact.id, score: item.result.score, status: item.result.finalStatus } });
      output.push({ id: assessment.id, contactId: item.contact.id, ...item.result });
    }
    return output;
  }, { maxWait: 5_000, timeout: 20_000 });
}
