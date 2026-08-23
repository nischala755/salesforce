import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { writeAudit } from "@/lib/audit";
import { runAssessments } from "@/lib/assessments";
import {
  RULE_BY_REMEDIATION_TYPE,
  type RemediationType,
} from "@/lib/rules-engine";

const remediationTypes = new Set<RemediationType>([
  "consent_renewal",
  "purpose_registration",
  "retention_review",
  "notice_delivery",
  "data_minimization_review",
]);

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const contactIds = await prisma.$transaction(async (tx) => {
      const item = await tx.remediationRequest.findUniqueOrThrow({
        where: { id },
        include: { targets: true },
      });
      if (item.status !== "approved") throw new Error("INVALID_REMEDIATION_TRANSITION");
      if (!remediationTypes.has(item.type as RemediationType)) {
        throw new Error("INVALID_REMEDIATION_TYPE");
      }

      const type = item.type as RemediationType;
      const ids = item.targets.map((target) => target.contactId);
      const now = new Date();

      switch (type) {
        case "consent_renewal":
          await tx.consentRecord.updateMany({
            where: { contactId: { in: ids }, active: true },
            data: { active: false },
          });
          await tx.consentRecord.createMany({
            data: ids.map((contactId) => ({
              contactId,
              purpose: "Customer relationship management",
              active: true,
              grantedAt: now,
              expiresAt: new Date(now.getTime() + 365 * 86_400_000),
              source: `Approved remediation ${id}`,
            })),
          });
          break;
        case "purpose_registration":
          await tx.processingPurpose.createMany({
            data: ids.map((contactId) => ({
              contactId,
              name: "Customer relationship management",
              lawfulBasis: "Recorded after DPO-approved purpose review",
              active: true,
              recordedAt: now,
            })),
          });
          break;
        case "retention_review":
          await tx.contact.updateMany({
            where: { id: { in: ids } },
            data: { retentionEndsAt: new Date(now.getTime() + 365 * 86_400_000) },
          });
          break;
        case "notice_delivery":
          await tx.contact.updateMany({
            where: { id: { in: ids } },
            data: { noticeDeliveredAt: now },
          });
          break;
        case "data_minimization_review":
          await tx.contact.updateMany({
            where: { id: { in: ids } },
            data: { minimizationCompliant: true },
          });
          break;
      }

      const changed = await tx.remediationRequest.updateMany({
        where: { id, status: "approved" },
        data: { status: "applied", appliedAt: now },
      });
      if (changed.count !== 1) throw new Error("INVALID_REMEDIATION_TRANSITION");

      await writeAudit(tx, {
        actorId: session.sub,
        action: "remediation.applied",
        entityType: "RemediationRequest",
        entityId: id,
        origin: "deterministic",
        metadata: { contactIds: ids, ruleCode: RULE_BY_REMEDIATION_TYPE[type], type },
      });
      return ids;
    });

    const assessments = await runAssessments(contactIds, session.sub);
    return NextResponse.json({ id, status: "applied", assessments });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_REMEDIATION_TRANSITION") {
      return NextResponse.json(
        { error: "Only approved requests can be applied." },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "INVALID_REMEDIATION_TYPE") {
      return NextResponse.json({ error: "Unsupported remediation type." }, { status: 400 });
    }
    return apiError(error);
  }
}
