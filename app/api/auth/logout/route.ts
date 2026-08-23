import { NextResponse } from "next/server";
import { requireSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { apiError } from "@/lib/auth/errors";

export async function POST() {
  try {
    await requireSession();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
