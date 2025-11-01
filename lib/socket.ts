import { Server, Socket } from 'socket.io';
import { createClient } from 'redis';
import { MatchEvent, MatchUpdate } from '@/types/socket';

type ClientToServerEvents = Record<string, unknown>;

interface ServerToClientEvents {
  match_found: (data: MatchEvent) => void;
  match_update: (data: MatchUpdate) => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  username: string;
}

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>();
const redis = createClient({ url: 'redis://localhost:6379' });
redis.connect();

const sub = redis.duplicate();
sub.connect();
sub.subscribe('matches', (message) => {
  const data: MatchEvent | MatchUpdate = JSON.parse(message);
  if ('player1' in data) {
    io.to(data.player1).emit('match_found', data);
    io.to(data.player2).emit('match_found', data);
  } else {
    io.to(data.matchId).emit('match_update', data);
  }
});

io.on('connection', (socket: Socket) => {
  const username = socket.handshake.query.username as string;
  socket.data.username = username;
  socket.join(username);
});

export { io };