import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';
import { clientIp, HttpError, parseBody, route } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { verifyCredentials } from '@/lib/users';
import { loginSchema } from '@/lib/validation';

export const POST = route(async (req) => {
  const { username, password } = await parseBody(req, loginSchema);
  // Two limits: one per IP (spraying many accounts) and one per account (guessing one password).
  await rateLimit(`login:ip:${clientIp(req)}`, 20, 60, 'login attempts');
  await rateLimit(`login:user:${username.toLowerCase()}`, 10, 5 * 60, 'login attempts for this account');

  const user = await verifyCredentials(username, password);
  // Same message for "no such user" and "wrong password", so usernames can't be probed.
  if (!user) throw new HttpError(401, 'Wrong username or password');

  const token = await createSessionToken({ userId: user.id, username: user.username });
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
