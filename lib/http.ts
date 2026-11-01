import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { SESSION_COOKIE, verifySessionToken, type Session } from './auth/session';
import { HttpError } from './errors';
import { logger } from './logger';

export { HttpError };

/**
 * Wraps a route handler so every route reports errors the same way:
 * HttpError -> its status, ZodError -> 400 with field errors, anything else -> logged 500.
 */
export function route<Ctx>(handler: (req: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status, headers: err.headers });
      }
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: err.issues[0]?.message ?? 'Invalid request', fields: z.flattenError(err).fieldErrors },
          { status: 400 },
        );
      }
      logger.error({ err, method: req.method, path: req.nextUrl.pathname }, 'unhandled route error');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

export async function requireSession(req: NextRequest): Promise<Session> {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) throw new HttpError(401, 'You need to sign in first');
  return session;
}

export async function parseBody<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
  return schema.parse(body);
}

/** Set by server.ts from the real socket address (or a trusted proxy), never by the client. */
export function clientIp(req: NextRequest): string {
  return req.headers.get('x-cfz-client-ip') ?? 'unknown';
}
