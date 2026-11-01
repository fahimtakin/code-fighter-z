import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';
import { clientIp, parseBody, route } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { createUser } from '@/lib/users';
import { signupSchema } from '@/lib/validation';

export const POST = route(async (req) => {
  await rateLimit(`signup:${clientIp(req)}`, 5, 60 * 60);
  const { username, password } = await parseBody(req, signupSchema);

  const user = await createUser(username, password);
  const token = await createSessionToken({ userId: user.id, username: user.username });

  // The token only goes into an httpOnly cookie; it's never in the response body.
  const res = NextResponse.json({ user: { id: user.id, username: user.username } }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
