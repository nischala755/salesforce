import { NextResponse } from "next/server";

export function apiError(error: unknown): NextResponse {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  console.error(error);
  return NextResponse.json({ error: "The request could not be completed." }, { status: 500 });
}
