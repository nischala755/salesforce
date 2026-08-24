import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { requireDpoRole } from "@/lib/auth/authorization";
import { reviewRemediation } from "@/lib/remediation/transition";

const schema = z.object({ reason: z.string().trim().min(1).max(500) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const session = await requireSession(); requireDpoRole(session); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 }); return NextResponse.json(await reviewRemediation((await context.params).id, session.sub, "rejected", parsed.data.reason)); }
  catch (error) { if (error instanceof Error && error.message === "SELF_REVIEW_NOT_ALLOWED") return NextResponse.json({ error: "A request must be reviewed by a different DPO user." }, { status: 409 }); if (error instanceof Error && error.message === "INVALID_REMEDIATION_TRANSITION") return NextResponse.json({ error: "Only pending requests can be rejected." }, { status: 409 }); return apiError(error); }
}
