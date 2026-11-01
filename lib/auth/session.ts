import { SignJWT, jwtVerify } from 'jose';
import { env } from '../env';

/**
 * Sessions are stateless HS256 JWTs stored in an httpOnly cookie.
 * The token is never handed to client-side JavaScript, so XSS can't steal it.
 * This module has no Next.js imports so the Socket.IO server can use it too.
 */
export const SESSION_COOKIE = 'cfz_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface Session {
  userId: string;
  username: string;
}

const secretKey = () => new TextEncoder().encode(env().JWT_SECRET);

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ username: session.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    // Pinning the algorithm blocks "alg: none" and algorithm-confusion attacks.
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.username !== 'string') return null;
    return { userId: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env().NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

/** Minimal cookie-header parser, used where Next's cookies() helper isn't available (WebSockets). */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
