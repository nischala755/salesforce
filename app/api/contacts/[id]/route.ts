import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        consents: { orderBy: { grantedAt: "desc" } }, purposes: { orderBy: { recordedAt: "desc" } },
        assessments: { orderBy: { assessedAt: "desc" }, include: { results: { orderBy: { ruleCode: "asc" } } } },
        recommendations: { where: { status: "open" }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    return NextResponse.json({ ...contact, latestAssessment: contact.assessments[0] ?? null });
  } catch (error) {
    return apiError(error);
  }
}
