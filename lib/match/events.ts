import { Emitter } from '@socket.io/redis-emitter';
import { redis } from '../redis';
import type { ServerToClientEvents } from '../shared/types';

/**
 * Lets any code (API routes included) push events to connected sockets.
 * It publishes through Redis, and the Socket.IO Redis adapter on every server
 * instance delivers it to whichever instance holds the target socket.
 */
const globalForEmitter = globalThis as unknown as { __cfzEmitter?: Emitter<ServerToClientEvents> };

export function emitter(): Emitter<ServerToClientEvents> {
  globalForEmitter.__cfzEmitter ??= new Emitter<ServerToClientEvents>(redis());
  return globalForEmitter.__cfzEmitter;
}
