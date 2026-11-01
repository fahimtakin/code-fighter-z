import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createSessionToken, readCookie, verifySessionToken } from '@/lib/auth/session';
import { passwordSchema, signupSchema, usernameSchema } from '@/lib/validation';

describe('session tokens', () => {
  const session = { userId: '0b5c6c1e-2f0a-4c55-9d0e-5b1a2d3c4e5f', username: 'alice' };

  it('round-trips a valid session', async () => {
    const token = await createSessionToken(session);
    expect(await verifySessionToken(token)).toEqual(session);
  });

  it('rejects a tampered payload', async () => {
    const [header, , signature] = (await createSessionToken(session)).split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: session.userId, username: 'admin' })).toString('base64url');
    expect(await verifySessionToken(`${header}.${forgedPayload}.${signature}`)).toBeNull();
  });

  it('rejects tokens signed with a different secret', async () => {
    const forged = await new SignJWT({ username: 'alice' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(session.userId)
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('fallback-secret-change-me-but-attacker-knows-it'));
    expect(await verifySessionToken(forged)).toBeNull();
  });

  it('rejects unsigned "alg: none" tokens', async () => {
    const encode = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: session.userId, username: 'alice' })}.`;
    expect(await verifySessionToken(unsigned)).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const expired = await new SignJWT({ username: 'alice' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(session.userId)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    expect(await verifySessionToken(expired)).toBeNull();
  });

  it('handles missing or garbage tokens', async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken('not.a.jwt')).toBeNull();
  });
});

describe('readCookie', () => {
  it('finds a cookie among several', () => {
    expect(readCookie('a=1; cfz_session=abc.def; b=2', 'cfz_session')).toBe('abc.def');
    expect(readCookie('a=1', 'cfz_session')).toBeUndefined();
    expect(readCookie(undefined, 'cfz_session')).toBeUndefined();
  });
});

describe('validation', () => {
  it('accepts sensible usernames, including underscores', () => {
    expect(usernameSchema.parse('  john_doe-99 ')).toBe('john_doe-99');
  });

  it.each(['ab', 'a'.repeat(21), 'has space', 'semi;colon', 'émoji', 'user:name'])('rejects username %j', (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(false);
  });

  it('enforces password length, counting bytes for the bcrypt limit', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(73)).success).toBe(false);
    // 24 emoji = 96 bytes, even though it's only 48 UTF-16 code units.
    expect(passwordSchema.safeParse('😀'.repeat(24)).success).toBe(false);
  });

  it('reports field errors for signup', () => {
    const result = signupSchema.safeParse({ username: 'x', password: '1' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0]).sort()).toEqual(['password', 'username']);
  });
});
