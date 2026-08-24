import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function reviewRemediation(id: string, reviewerId: string, decision: "approved" | "rejected", rejectionReason?: string) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.remediationRequest.updateMany({
      where: { id, status: "pending_approval", createdById: { not: reviewerId } },
      data: decision === "approved" ? { status: "approved", reviewerId, approvedAt: new Date() } : { status: "rejected", reviewerId, rejectedAt: new Date(), rejectionReason },
    });
    if (changed.count !== 1) {
      const item = await tx.remediationRequest.findUnique({ where: { id }, select: { createdById: true, status: true } });
      if (item?.status === "pending_approval" && item.createdById === reviewerId) throw new Error("SELF_REVIEW_NOT_ALLOWED");
      throw new Error("INVALID_REMEDIATION_TRANSITION");
    }
    const item = await tx.remediationRequest.findUniqueOrThrow({ where: { id }, include: { targets: true } });
    await writeAudit(tx, { actorId: reviewerId, action: `remediation.${decision}`, entityType: "RemediationRequest", entityId: id, metadata: { rejectionReason: rejectionReason ?? null } });
    return item;
  });
}
