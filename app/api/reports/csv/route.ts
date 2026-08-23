import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { prisma } from "@/lib/db";

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  try {
    await requireSession();
    const contacts = await prisma.contact.findMany({ select: { name: true, email: true, department: true, assessments: { orderBy: { assessedAt: "desc" }, take: 1, select: { score: true, finalStatus: true, assessedAt: true, _count: { select: { results: { where: { passed: false } } } } } } }, orderBy: { id: "asc" } });
    const encoder = new TextEncoder(); let index = -1;
    const stream = new ReadableStream({ pull(controller) { if (index === -1) { controller.enqueue(encoder.encode("contact name,email,department,latest score,latest status,violation count,assessment timestamp\r\n")); index = 0; return; } if (index >= contacts.length) { controller.close(); return; } const contact = contacts[index++]; const latest = contact.assessments[0]; controller.enqueue(encoder.encode([contact.name, contact.email, contact.department, latest?.score ?? "", latest?.finalStatus ?? "unassessed", latest?._count.results ?? 0, latest?.assessedAt.toISOString() ?? ""].map(csvCell).join(",") + "\r\n")); } });
    return new Response(stream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="complylens-board-report-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
