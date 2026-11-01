import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

/**
 * Fast redirect layer in front of the pages. It's a convenience, not the
 * security boundary: every API route and page checks the session again itself.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session && (pathname.startsWith('/dashboard') || pathname.startsWith('/match'))) {
    const res = NextResponse.redirect(new URL('/auth', req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (session && pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/match/:path*', '/auth/:path*'],
};
