import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server, Socket } from 'socket.io';
import { createClient } from 'redis';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  const redisClient = createClient({ url: REDIS_URL });
  await redisClient.connect().catch(console.error);

  // Tracks active allocations (Socket Id -> Room Metadata Map)
  const userRooms = new Map<string, { username: string; roomId: string }>();
  // Manages active match configurations tracking connected player statuses
  const matchPlayers = new Map<string, Set<string>>();
  // Retains timeouts for disconnected users who may reconnect
  const disconnectTimeouts = new Map<string, NodeJS.Timeout>();

  io.on('connection', (socket: Socket) => {
    const username = socket.handshake.query.username as string | undefined;
    if (!username) return socket.disconnect(true);

    socket.data.username = username;
    socket.join(username);

    socket.on('join_match_room', (roomId: string) => {
      socket.join(roomId);
      userRooms.set(socket.id, { username, roomId });

      if (!matchPlayers.has(roomId)) {
        matchPlayers.set(roomId, new Set());
      }
      matchPlayers.get(roomId)!.add(username);

      // Cancel a pending disconnect countdown if the user reconnected inside the window
      const timeoutKey = `${roomId}:${username}`;
      if (disconnectTimeouts.has(timeoutKey)) {
        clearTimeout(disconnectTimeouts.get(timeoutKey)!);
        disconnectTimeouts.delete(timeoutKey);
        io.to(roomId).emit('player_reconnected', { username });
      }
    });

    socket.on('disconnect', async () => {
      const roomData = userRooms.get(socket.id);
      if (!roomData) return;

      const { username: userLeaver, roomId } = roomData;
      userRooms.delete(socket.id);

      const activeSet = matchPlayers.get(roomId);
      if (activeSet) {
        activeSet.delete(userLeaver);
        io.to(roomId).emit('player_disconnected', { username: userLeaver });

        // Trigger a 10-second grace window before allocating a forfeit loss
        const timeoutKey = `${roomId}:${userLeaver}`;
        const timeout = setTimeout(async () => {
          disconnectTimeouts.delete(timeoutKey);
          
          // Verify if a winner was already determined
          const currentWinner = await redisClient.get(`winner:${roomId}`);
          if (!currentWinner) {
            // Locate the player remaining inside the arena match structure
            const currentPlayers = roomId.split('_').slice(2); // Extracts p1 and p2 from signature
            const userWinner = currentPlayers.find(p => p !== userLeaver) || 'Remaining Warrior';

            // Atomically declare the winner in Redis
            const claimed = await redisClient.set(`winner:${roomId}`, userWinner, { NX: true, EX: 3600 });
            if (claimed) {
              const multi = redisClient.multi();
              multi.hIncrBy(`user:${userWinner}`, 'wins', 1);
              multi.zIncrBy('leaderboard', 1, userWinner);
              multi.hIncrBy(`user:${userLeaver}`, 'losses', 1);
              await multi.exec();

              // Broadcast the forfeit event update out to the client applications
              io.to(roomId).emit('match_terminated_by_forfeit', { winner: userWinner, reason: `${userLeaver} abandoned the match.` });
            }
          }
          
          matchPlayers.delete(roomId);
        }, 10000);

        disconnectTimeouts.set(timeoutKey, timeout);
      }
    });
  });

  server.listen(3000, () => {
    console.log('> Server layer running safely on port 3000');
  });
});
