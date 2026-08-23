import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";
import { runAssessments } from "@/lib/assessments";

const inputSchema = z.object({ contactIds: z.array(z.cuid()).max(500).default([]) });

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "contactIds must be an array of at most 500 valid IDs." }, { status: 400 });
    const assessments = await runAssessments(parsed.data.contactIds, session.sub);
    return NextResponse.json({ assessments }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
