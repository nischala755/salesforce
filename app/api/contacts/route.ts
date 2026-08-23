import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["compliant", "at_risk", "non_compliant"]).optional(),
  sort: z.enum(["name", "score", "recent"]).default("name"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Invalid contact query." }, { status: 400 });
    const { q, status, sort, page, pageSize } = parsed.data;
    const contacts = await prisma.contact.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { department: { contains: q, mode: "insensitive" } }] } : undefined,
      include: { assessments: { orderBy: { assessedAt: "desc" }, take: 1, include: { _count: { select: { results: { where: { passed: false } } } } } } },
      orderBy: sort === "name" ? { name: "asc" } : { updatedAt: "desc" },
    });
    let filtered = status ? contacts.filter((contact) => contact.assessments[0]?.finalStatus === status) : contacts;
    if (sort === "score") filtered = filtered.sort((a, b) => (a.assessments[0]?.score ?? -1) - (b.assessments[0]?.score ?? -1));
    if (sort === "recent") filtered = filtered.sort((a, b) => (b.assessments[0]?.assessedAt.getTime() ?? 0) - (a.assessments[0]?.assessedAt.getTime() ?? 0));
    const total = filtered.length;
    const items = filtered.slice((page - 1) * pageSize, page * pageSize).map(({ assessments, ...contact }) => ({ ...contact, latestAssessment: assessments[0] ?? null }));
    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}
