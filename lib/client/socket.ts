'use client';

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/types';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | undefined;

/**
 * One shared connection per tab. It connects to the same origin that served the
 * page (no hardcoded localhost), and the browser attaches the httpOnly session
 * cookie to the handshake automatically.
 */
export function getSocket(): GameSocket {
  socket ??= io({ autoConnect: false, withCredentials: true });
  if (!socket.connected) socket.connect();
  return socket;
}
