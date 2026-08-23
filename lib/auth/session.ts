import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "complylens_session";
export const SESSION_SECONDS = 8 * 60 * 60;

export interface Session extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(value);
}

export async function createSessionToken(session: { sub: string; email: string; name: string; role: string }, now?: Date): Promise<string> {
  const issuedAt = Math.floor((now?.getTime() ?? Date.now()) / 1000);
  return new SignJWT({ email: session.email, name: session.name, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.sub)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_SECONDS)
    .sign(secret());
}

export async function verifySessionToken(token: string, now?: Date): Promise<Session> {
  const result = await jwtVerify(token, secret(), {
    algorithms: ["HS256"],
    currentDate: now,
  });
  const { payload } = result;
  if (!payload.sub || typeof payload.email !== "string" || typeof payload.name !== "string" || typeof payload.role !== "string") {
    throw new Error("Session token is missing required claims.");
  }
  return payload as Session;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_SECONDS,
};

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requirePageSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
