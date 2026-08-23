import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { writeAudit } from "@/lib/audit";
import { REMEDIATION_BY_RULE, RULE_CODES, type RuleCode } from "@/lib/rules-engine";

const schema = z.object({
  contactIds: z.array(z.cuid()).min(1).max(500),
  ruleCodes: z.array(z.enum(RULE_CODES)).min(1).max(RULE_CODES.length),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Provide valid contact IDs and at least one failed control." },
        { status: 400 },
      );
    }

    const contactIds = [...new Set(parsed.data.contactIds)];
    const ruleCodes = [...new Set(parsed.data.ruleCodes)] as RuleCode[];
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: {
        id: true,
        assessments: {
          orderBy: { assessedAt: "desc" },
          take: 1,
          select: { results: { select: { ruleCode: true, passed: true } } },
        },
      },
    });

    if (contacts.length !== contactIds.length) {
      return NextResponse.json({ error: "One or more contacts were not found." }, { status: 404 });
    }

    const ineligible = contacts.find((contact) => {
      const latest = contact.assessments[0];
      return !latest || ruleCodes.some((code) => !latest.results.some((result) => result.ruleCode === code && !result.passed));
    });
    if (ineligible) {
      return NextResponse.json(
        { error: "A remediation request can only target controls that fail in the latest assessment." },
        { status: 409 },
      );
    }

    const requests = await prisma.$transaction(async (tx) => {
      const createdRequests = [];
      for (const ruleCode of ruleCodes) {
        const definition = REMEDIATION_BY_RULE[ruleCode];
        const existing = await tx.remediationRequest.findFirst({
          where: {
            type: definition.type,
            status: { in: ["pending_approval", "approved"] },
            targets: { some: { contactId: { in: contactIds } } },
          },
          select: { id: true },
        });
        if (existing) throw new Error("ACTIVE_REMEDIATION_EXISTS");

        const created = await tx.remediationRequest.create({
          data: {
            type: definition.type,
            createdById: session.sub,
            draftMessage: definition.draftMessage,
            targets: { create: contactIds.map((contactId) => ({ contactId })) },
          },
          include: { targets: true },
        });
        await writeAudit(tx, {
          actorId: session.sub,
          action: "remediation.requested",
          entityType: "RemediationRequest",
          entityId: created.id,
          origin: "deterministic",
          metadata: { contactIds, ruleCode, type: created.type },
        });
        createdRequests.push(created);
      }
      return createdRequests;
    });

    return NextResponse.json({ requests }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_REMEDIATION_EXISTS") {
      return NextResponse.json(
        { error: "An approval is already pending for one of the selected controls." },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}
