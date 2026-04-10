import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple JWT-based middleware that doesn't import Prisma (Edge-compatible)
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes that don't need auth
  const publicRoutes = ["/login", "/api/auth"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for session token (NextAuth stores it as a cookie)
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next/static|_next/image|favicon.ico|izam.webp|.*\\.svg$).*)",
  ],
};
