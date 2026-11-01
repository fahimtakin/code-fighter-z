/**
 * Single entry point for dev and production: one HTTP server that serves the
 * Next.js app and the Socket.IO real-time layer on the same port.
 */
import nextEnv from '@next/env';
import { createServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import next from 'next';
import { Server, type Socket } from 'socket.io';
import { readCookie, SESSION_COOKIE, verifySessionToken, type Session } from './lib/auth/session';
import { pool } from './lib/db';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { rooms } from './lib/match/keys';
import { FORFEIT_GRACE_MS } from './lib/match/rules';
import { forfeitMatch, isPlayerInMatch, sweepExpiredMatches } from './lib/match/service';
import { createRedis, redis } from './lib/redis';
import type { ClientToServerEvents, ServerToClientEvents } from './lib/shared/types';
import { matchIdSchema } from './lib/validation';

interface SocketData {
  user: Session;
  matchIds: string[];
}
type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const dev = process.env.NODE_ENV !== 'production';
nextEnv.loadEnvConfig(process.cwd(), dev);
const config = env();

const app = next({ dev, port: config.PORT });
const handle = app.getRequestHandler();
await app.prepare();

const CLIENT_IP_HEADER = 'x-cfz-client-ip';

const httpServer = createServer((req, res) => {
  // Route handlers can't see the TCP peer address, so we pass it along in a
  // header, overwriting whatever the client may have sent under that name.
  const forwarded = config.TRUST_PROXY ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
  req.headers[CLIENT_IP_HEADER] = forwarded || req.socket.remoteAddress || 'unknown';
  return handle(req, res);
});

// Every server instance subscribes to the same Redis channel, so an event
// emitted on one instance (or by an API route) reaches sockets on all of them.
const pubClient = createRedis();
const subClient = pubClient.duplicate();

const io: IO = new Server(httpServer, {
  adapter: createAdapter(pubClient, subClient),
  serveClient: false,
  // Next.js dev uses its own WebSocket for hot reload; don't kill upgrades we don't own.
  destroyUpgrade: false,
  allowRequest: (req, callback) => callback(null, isAllowedOrigin(req.headers.origin, req.headers.host)),
});

/**
 * Blocks cross-site WebSocket hijacking: a malicious page can't open a socket
 * to us with the victim's cookies, because its Origin won't match our host.
 */
function isAllowedOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true; // Non-browser clients send no Origin and have no victim cookies.
  try {
    return new URL(origin).host === host || config.ALLOWED_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

// Authenticate the handshake with the same signed cookie the HTTP API uses.
// Identity is never taken from anything the client chooses to send.
io.use(async (socket, nextFn) => {
  const session = await verifySessionToken(readCookie(socket.request.headers.cookie, SESSION_COOKIE));
  if (!session) return nextFn(new Error('unauthorized'));
  socket.data.user = session;
  socket.data.matchIds = [];
  nextFn();
});

io.on('connection', (socket: AppSocket) => {
  const { user } = socket.data;
  socket.join(rooms.user(user.userId));

  socket.on('match:join', async (rawMatchId, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const parsed = matchIdSchema.safeParse(rawMatchId);
      if (!parsed.success) return reply({ ok: false, error: 'Invalid match id' });
      const matchId = parsed.data;
      // Only the two players may join a match room: no spectating, no impersonation.
      if (!(await isPlayerInMatch(matchId, user.userId))) return reply({ ok: false, error: 'Not your match' });

      await socket.join(rooms.match(matchId));
      if (!socket.data.matchIds.includes(matchId)) socket.data.matchIds.push(matchId);
      io.to(rooms.match(matchId)).emit('match:presence', { userId: user.userId, online: true });
      reply({ ok: true });
    } catch (err) {
      logger.error({ err }, 'match:join failed');
      reply({ ok: false, error: 'Server error' });
    }
  });

  socket.on('disconnect', () => {
    for (const matchId of socket.data.matchIds) void handleLeave(matchId, user.userId);
  });
});

/** Is any socket of this user (on any server instance) still in the match room? */
async function isInRoom(matchId: string, userId: string): Promise<boolean> {
  const sockets = await io.in(rooms.match(matchId)).fetchSockets();
  return sockets.some((s) => s.data.user?.userId === userId);
}

async function handleLeave(matchId: string, userId: string) {
  try {
    // A second tab or an instant reconnect means they haven't really left.
    if (await isInRoom(matchId, userId)) return;
    const forfeitAt = Date.now() + FORFEIT_GRACE_MS;
    io.to(rooms.match(matchId)).emit('match:presence', { userId, online: false, forfeitAt });

    // Grace period for refreshes and flaky Wi-Fi. If the server restarts in the
    // meantime the timer is lost, and the match simply ends on its clock instead.
    setTimeout(async () => {
      try {
        if (!(await isInRoom(matchId, userId))) await forfeitMatch(matchId, userId);
      } catch (err) {
        logger.error({ err, matchId, userId }, 'forfeit check failed');
      }
    }, FORFEIT_GRACE_MS).unref();
  } catch (err) {
    logger.error({ err, matchId, userId }, 'disconnect handling failed');
  }
}

// Ends matches whose clock ran out. Each tick is cheap (one ZRANGEBYSCORE),
// and running it on every instance is safe because finalizing is idempotent.
let sweeping = false;
const sweeper = setInterval(async () => {
  if (sweeping) return;
  sweeping = true;
  try {
    await sweepExpiredMatches();
  } catch (err) {
    logger.error({ err }, 'match sweeper failed');
  } finally {
    sweeping = false;
  }
}, 1_000);

httpServer.listen(config.PORT, () => {
  logger.info({ port: config.PORT, dev }, `Code Fighter Z ready on http://localhost:${config.PORT}`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  clearInterval(sweeper);
  io.close();
  await Promise.allSettled([pubClient.quit(), subClient.quit(), redis().quit(), pool().end(), app.close()]);
  process.exit(0);
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
