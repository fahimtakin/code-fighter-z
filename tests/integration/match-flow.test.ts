/**
 * End-to-end test against a running server (`npm run dev`, or `npm start` in CI):
 *   RUN_INTEGRATION=1 npm run test:integration
 * Two real users sign up, get matched, play over HTTP + WebSockets, and the
 * security holes from the original audit are probed along the way.
 */
import Redis from 'ioredis';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MatchView, QueueStatus, SubmitResponse } from '@/lib/shared/types';
import { referenceSolutions } from '../fixtures/solutions';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const suffix = Math.random().toString(36).slice(2, 8);

interface Client {
  name: string;
  cookie: string;
  socket?: Socket;
}

async function call<T = unknown>(client: Client | null, path: string, init: { method?: string; json?: unknown } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(client ? { cookie: client.cookie } : {}),
      ...(init.json !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as T, headers: res.headers };
}

async function signup(name: string): Promise<Client> {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: name, password: 'correct-horse-battery' }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  // The token must only travel in the httpOnly cookie, never in the JSON body.
  expect(JSON.stringify(body)).not.toMatch(/eyJ/);
  const setCookie = res.headers.get('set-cookie') ?? '';
  expect(setCookie).toMatch(/HttpOnly/i);
  return { name, cookie: setCookie.split(';')[0] };
}

function connect(client: Client, headers: Record<string, string> = {}): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { transports: ['websocket'], extraHeaders: { cookie: client.cookie, ...headers }, reconnection: false });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });
}

function waitFor<T>(socket: Socket, event: string, matches: (payload: T) => boolean = () => true, ms = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), ms);
    const handler = (payload: T) => {
      if (!matches(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

const joinRoom = (socket: Socket, matchId: string) =>
  new Promise<{ ok: boolean; error?: string }>((resolve) => socket.emit('match:join', matchId, resolve));

async function pair(a: Client, b: Client): Promise<string> {
  const found = waitFor<{ matchId: string }>(a.socket!, 'match:found');
  expect((await call<QueueStatus>(a, '/api/queue', { method: 'POST' })).body.status).toBe('waiting');
  const res = await call<QueueStatus>(b, '/api/queue', { method: 'POST' });
  expect(res.body.status).toBe('matched');
  const matchId = (res.body as { matchId: string }).matchId;
  // Player A learns about the match by push, without polling.
  expect((await found).matchId).toBe(matchId);
  return matchId;
}

let alice: Client;
let bob: Client;
let carol: Client;

// Every request in this suite comes from 127.0.0.1, the same IP as your own
// browser. Clearing the counters before and after means a test run never
// leaves you locked out of signing up locally.
async function clearRateLimits() {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380');
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
  await redis.quit();
}

beforeAll(async () => {
  await clearRateLimits();

  // Underscores in names broke the old room-id parsing; they must work now.
  alice = await signup(`t${suffix}_alice`);
  bob = await signup(`t${suffix}_bob`);
  carol = await signup(`t${suffix}_carol`);
  alice.socket = await connect(alice);
  bob.socket = await connect(bob);
  carol.socket = await connect(carol);
});

afterAll(async () => {
  for (const c of [alice, bob, carol]) c?.socket?.close();
  await clearRateLimits();
});

describe('auth', () => {
  it('rejects duplicate usernames regardless of case', async () => {
    const res = await call(null, '/api/auth/signup', {
      method: 'POST',
      json: { username: alice.name.toUpperCase(), password: 'another-password' },
    });
    expect(res.status).toBe(409);
  });

  it('validates input with field-level errors', async () => {
    const res = await call<{ fields: Record<string, string[]> }>(null, '/api/auth/signup', {
      method: 'POST',
      json: { username: 'a b', password: 'x' },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['password', 'username']);
  });

  it('gives the same error for a wrong password and an unknown user', async () => {
    const wrong = await call<{ error: string }>(null, '/api/auth/login', {
      method: 'POST',
      json: { username: alice.name, password: 'nope-nope-nope' },
    });
    const unknown = await call<{ error: string }>(null, '/api/auth/login', {
      method: 'POST',
      json: { username: `ghost${suffix}`, password: 'nope-nope-nope' },
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('requires a session for the API', async () => {
    expect((await call(null, '/api/queue', { method: 'POST' })).status).toBe(401);
  });

  it('refuses sockets without a valid session cookie', async () => {
    await expect(connect({ name: 'anon', cookie: 'cfz_session=forged' })).rejects.toThrow(/unauthorized/);
  });

  it('refuses sockets opened from another site (cross-site WebSocket hijacking)', async () => {
    await expect(connect(alice, { origin: 'https://evil.example' })).rejects.toThrow();
  });
});

describe('a full match', () => {
  let matchId: string;
  let view: MatchView;

  it('pairs two queued players', async () => {
    matchId = await pair(alice, bob);
  });

  it('shows each player their own perspective and never leaks hidden tests', async () => {
    const res = await call<MatchView>(alice, `/api/match/${matchId}`);
    expect(res.status).toBe(200);
    view = res.body;
    expect(view.you.username).toBe(alice.name);
    expect(view.opponent.username).toBe(bob.name);
    expect(view.status).toBe('active');
    expect(view.problem).not.toHaveProperty('hiddenTests');
    expect(view.problem.hiddenTestCount).toBeGreaterThan(0);
    // The editor starts empty: the solution is not shipped with the page.
    expect(view.problem.starterCode).toContain('Your solution here');
  });

  it('keeps outsiders out of the match (view, submit and socket room)', async () => {
    expect((await call(carol, `/api/match/${matchId}`)).status).toBe(403);
    const submit = await call(carol, `/api/match/${matchId}/submit`, {
      method: 'POST',
      json: { code: referenceSolutions[view.problem.id], mode: 'submit' },
    });
    expect(submit.status).toBe(403);
    expect((await joinRoom(carol.socket!, matchId)).ok).toBe(false);
  });

  it('lets both players into the room', async () => {
    expect((await joinRoom(alice.socket!, matchId)).ok).toBe(true);
    expect((await joinRoom(bob.socket!, matchId)).ok).toBe(true);
  });

  it("'run' only checks the examples and doesn't count as an attempt", async () => {
    const res = await call<SubmitResponse>(alice, `/api/match/${matchId}/submit`, {
      method: 'POST',
      json: { code: view.problem.starterCode, mode: 'run' },
    });
    expect(res.status).toBe(200);
    expect(res.body.result.total).toBe(view.problem.examples.length);
    expect(res.body.matchOver).toBe(false);
  });

  it("a failed submit streams progress to the opponent", async () => {
    const progress = waitFor<{ userId: string; passed: number }>(bob.socket!, 'match:progress', (p) => p.userId === view.you.id);
    const res = await call<SubmitResponse>(alice, `/api/match/${matchId}/submit`, {
      method: 'POST',
      json: { code: view.problem.starterCode, mode: 'submit' },
    });
    expect(res.body.result.verdict).not.toBe('accepted');
    expect((await progress).passed).toBe(0);
  });

  it('the first accepted submission wins and both players are told', async () => {
    const aliceHears = waitFor<{ matchId: string; winnerId: string }>(alice.socket!, 'match:over', (p) => p.matchId === matchId);
    const res = await call<SubmitResponse>(bob, `/api/match/${matchId}/submit`, {
      method: 'POST',
      json: { code: referenceSolutions[view.problem.id], mode: 'submit' },
    });
    expect(res.body.result.verdict).toBe('accepted');
    expect(res.body).toMatchObject({ matchOver: true, won: true });
    expect((await aliceHears).winnerId).toBe(view.opponent.id);
  });

  it('applies Elo: equal ratings swing by 16', async () => {
    const after = await call<MatchView>(alice, `/api/match/${matchId}`);
    expect(after.body.status).toBe('finished');
    expect(after.body.result).toMatchObject({ outcome: 'solved', winnerId: view.opponent.id });
    expect(after.body.result!.ratingDeltas[view.you.id]).toBe(-16);
    expect(after.body.result!.ratingDeltas[view.opponent.id]).toBe(16);

    const board = await call<Array<{ username: string; rating: number; wins: number }>>(null, '/api/leaderboard');
    expect(board.body.find((e) => e.username === bob.name)).toMatchObject({ rating: 1216, wins: 1 });
  });

  it('rejects submissions after the match is over', async () => {
    const res = await call(alice, `/api/match/${matchId}/submit`, {
      method: 'POST',
      json: { code: referenceSolutions[view.problem.id], mode: 'submit' },
    });
    expect(res.status).toBe(409);
  });

  it('frees both players to queue again', async () => {
    const res = await call<QueueStatus>(alice, '/api/queue', { method: 'POST' });
    expect(res.body.status).toBe('waiting');
    await call(alice, '/api/queue', { method: 'DELETE' });
  });
});

describe('forfeit', () => {
  it('a player who disconnects and stays away loses after the grace period', async () => {
    const matchId = await pair(alice, bob);
    expect((await joinRoom(alice.socket!, matchId)).ok).toBe(true);
    expect((await joinRoom(bob.socket!, matchId)).ok).toBe(true);

    const presence = waitFor<{ online: boolean; forfeitAt?: number }>(alice.socket!, 'match:presence', (p) => !p.online);
    const over = waitFor<{ matchId: string; outcome: string }>(alice.socket!, 'match:over', (p) => p.matchId === matchId, 45_000);
    bob.socket!.close();

    expect((await presence).forfeitAt).toBeGreaterThan(Date.now());
    const result = await over;
    expect(result.outcome).toBe('forfeit');
    const view = await call<MatchView>(alice, `/api/match/${matchId}`);
    expect(view.body.result?.winnerId).toBe(view.body.you.id);
  }, 60_000);
});

describe('timeout', () => {
  it('when the clock runs out with nothing passed, the sweeper records a draw', async () => {
    bob.socket = await connect(bob);
    const matchId = await pair(alice, bob);
    expect((await joinRoom(alice.socket!, matchId)).ok).toBe(true);
    expect((await joinRoom(bob.socket!, matchId)).ok).toBe(true);

    const over = waitFor<{ matchId: string; outcome: string; winnerId: string | null }>(
      alice.socket!,
      'match:over',
      (p) => p.matchId === matchId,
    );
    // Fast-forward: pretend this match's deadline passed long ago.
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380');
    await redis.zadd('matches:active', 0, matchId);
    await redis.quit();

    const result = await over;
    expect(result).toMatchObject({ outcome: 'draw', winnerId: null });
  });
});

describe('race conditions', () => {
  const racers: Client[] = [];
  let matchOf: Map<Client, string>;

  beforeAll(async () => {
    // Signup is limited per IP; the suite has already used some of the budget.
    await clearRateLimits();
    for (const n of [1, 2, 3, 4]) racers.push(await signup(`t${suffix}_race${n}`));
    for (const c of racers) c.socket = await connect(c);
  });

  afterAll(() => {
    for (const c of racers) c.socket?.close();
  });

  it('nobody gets matched twice when four players queue at the same moment', async () => {
    const replies = await Promise.all(racers.map((c) => call<QueueStatus>(c, '/api/queue', { method: 'POST' })));
    const statuses = replies.map((r) => r.body.status);
    expect(statuses.filter((s) => s === 'matched')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'waiting')).toHaveLength(2);

    // The two who were waiting poll once more and learn which match they're in.
    const final = await Promise.all(
      racers.map(async (c, i) =>
        replies[i].body.status === 'matched' ? replies[i] : call<QueueStatus>(c, '/api/queue', { method: 'POST' }),
      ),
    );
    matchOf = new Map();
    for (const [i, r] of final.entries()) {
      expect(r.body.status).toBe('matched');
      matchOf.set(racers[i], (r.body as { matchId: string }).matchId);
    }

    const byMatch = new Map<string, Client[]>();
    for (const [c, id] of matchOf) byMatch.set(id, [...(byMatch.get(id) ?? []), c]);
    expect(byMatch.size).toBe(2);
    for (const players of byMatch.values()) expect(players).toHaveLength(2);

    for (const [id, [a, b]] of byMatch) {
      const viewA = await call<MatchView>(a, `/api/match/${id}`);
      const viewB = await call<MatchView>(b, `/api/match/${id}`);
      expect(viewA.body).toMatchObject({ you: { username: a.name }, opponent: { username: b.name } });
      expect(viewB.body).toMatchObject({ you: { username: b.name }, opponent: { username: a.name } });
    }
  });

  it('a match ends exactly once when both players solve it at the same moment', async () => {
    const [a] = racers;
    const matchId = matchOf.get(a)!;
    const b = racers.find((c) => c !== a && matchOf.get(c) === matchId)!;
    const view = (await call<MatchView>(a, `/api/match/${matchId}`)).body;
    const code = referenceSolutions[view.problem.id];

    const [resA, resB] = await Promise.all(
      [a, b].map((c) => call<SubmitResponse>(c, `/api/match/${matchId}/submit`, { method: 'POST', json: { code, mode: 'submit' } })),
    );
    const winners = [resA, resB].filter((r) => r.status === 200 && r.body.won === true);
    expect(winners).toHaveLength(1);
    const loserRes = winners[0] === resA ? resB : resA;
    if (loserRes.status === 200) expect(loserRes.body).toMatchObject({ matchOver: true, won: false });
    else expect(loserRes.status).toBe(409);

    const [winner, loser] = winners[0] === resA ? [a, b] : [b, a];
    const after = (await call<MatchView>(winner, `/api/match/${matchId}`)).body;
    expect(after.result).toMatchObject({ outcome: 'solved', winnerId: after.you.id });
    expect(after.result!.ratingDeltas[after.you.id]).toBe(16);
    expect(after.result!.ratingDeltas[after.opponent.id]).toBe(-16);

    // A new match snapshots current ratings: proof the swing was applied once, not twice.
    const rematchId = await pair(winner, loser);
    const rematch = (await call<MatchView>(winner, `/api/match/${rematchId}`)).body;
    expect(rematch.you.rating).toBe(1216);
    expect(rematch.opponent.rating).toBe(1184);
  });
});
