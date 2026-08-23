import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { reviewRemediation } from "@/lib/remediation/transition";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const session = await requireSession(); return NextResponse.json(await reviewRemediation((await context.params).id, session.sub, "approved")); }
  catch (error) { if (error instanceof Error && error.message === "INVALID_REMEDIATION_TRANSITION") return NextResponse.json({ error: "Only pending requests can be approved." }, { status: 409 }); return apiError(error); }
}
