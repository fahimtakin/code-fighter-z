import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "fallback-secret-change-me";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect target paths from unauthorized visitors
  const protectedPaths = ["/dashboard", "/match"];
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  // Access the cookie string
  const token = req.cookies.get("auth-token")?.value;

  if (isProtected) {
    if (!token) {
      const loginUrl = new URL("/auth", req.url);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // Safely verify using standard jsonwebtoken since the runtime supports Node.js
      jwt.verify(token, SECRET);
      return NextResponse.next();
    } catch (err) {
      const loginUrl = new URL("/auth", req.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("auth-token");
      return response;
    }
  }

  // Prevent logged-in users from accessing the auth route
  if (pathname.startsWith("/auth") && token) {
    try {
      jwt.verify(token, SECRET);
      const dashboardUrl = new URL("/dashboard", req.url);
      return NextResponse.redirect(dashboardUrl);
    } catch (err) {
      // Invalid token, allow access to /auth normally
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/match/:path*",
    "/auth/:path*"
  ]
};
