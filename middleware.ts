import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth/session";

function isPublic(pathname: string) {
  return pathname === "/login" || pathname === "/api/auth/login";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let authenticated = false;
  if (token && process.env.JWT_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET), { algorithms: ["HS256"] });
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }
  if (authenticated) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/dashboard/:path*", "/contacts/:path*", "/breach/:path*", "/rights-requests/:path*", "/dpo/:path*", "/timeline/:path*", "/api/:path*"] };
