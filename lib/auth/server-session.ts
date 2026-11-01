import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken, type Session } from './session';

/** Reads the session inside Server Components and Server Actions. */
export async function getServerSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
