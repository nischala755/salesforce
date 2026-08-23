import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

const loginSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid email and password are required." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  const valid = user?.active && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!user || !valid) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  const token = await createSessionToken({ sub: user.id, email: user.email, name: user.name, role: user.role });
  const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
