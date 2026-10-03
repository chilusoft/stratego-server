import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { RoomManager } from './rooms/manager.js';
import { MatchmakingQueue } from './matchmaking/queue.js';

async function main() {
  const app = Fastify({ logger: true });
  await app.register(websocket);
  const rooms = new RoomManager();
  const matchmaking = new MatchmakingQueue();
  const playerSockets = new Map<string, (obj: unknown) => void>();
  const playerRooms = new Map<string, string>();

  matchmaking.onMatch = ({ mode, a, b }) => {
    if (mode !== 'reversi') {
      playerSockets.get(a.playerId)?.({ type: 'error', error: `${mode} not available yet` });
      playerSockets.get(b.playerId)?.({ type: 'error', error: `${mode} not available yet` });
      return;
    }
    const room = rooms.create();
    room.addPlayer(a.playerId, a.name);
    room.addPlayer(b.playerId, b.name);
    for (const p of [a, b]) {
      const send = playerSockets.get(p.playerId);
      if (send) {
        playerRooms.set(p.playerId, room.id);
        room.addListener((snap) => send({ type: 'state', room: snap }));
        send({ type: 'matched', roomId: room.id, playerId: p.playerId, mode });
        send({ type: 'state', room: room.snapshot() });
      }
    }
  };

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/leaderboard', async () => ({ games: ['reversi', 'chess', 'checkers'], entries: [] }));
  app.get('/rooms', async () => ({ open: rooms.openRooms() }));

  app.register(async (f) => {
    f.get('/ws', { websocket: true }, (socket, req) => {
      const playerId = `p-${Math.random().toString(36).slice(2, 10)}`;
      const send = (obj: unknown) => socket.send(JSON.stringify(obj));
      playerSockets.set(playerId, send);
      socket.on('close', () => {
        playerSockets.delete(playerId);
        matchmaking.leave(playerId);
      });

      const attach = (roomId: string) => {
        const room = rooms.get(roomId);
        if (!room) return;
        room.addListener((snap) => send({ type: 'state', room: snap }));
        send({ type: 'state', room: room.snapshot() });
      };

      socket.on('message', (raw) => {
        let msg: any;
        try { msg = JSON.parse(raw.toString()); } catch { return send({ type: 'error', error: 'bad json' }); }
        try {
          switch (msg.type) {
            case 'create_room': {
              const room = rooms.create(msg.timeMs);
              room.addPlayer(playerId, msg.name ?? 'player');
              playerRooms.set(playerId, room.id);
              send({ type: 'room_created', roomId: room.id, playerId });
              attach(room.id);
              break;
            }
            case 'join_room': {
              const room = rooms.get(msg.roomId);
              if (!room) return send({ type: 'error', error: 'room not found' });
              room.addPlayer(playerId, msg.name ?? 'player');
              playerRooms.set(playerId, room.id);
              attach(room.id);
              break;
            }
            case 'queue_join': {
              matchmaking.join({ playerId, name: msg.name ?? 'player', mode: msg.mode ?? 'reversi', rating: msg.rating, joinedAt: Date.now() });
              send({ type: 'queued', mode: msg.mode ?? 'reversi' });
              break;
            }
            case 'queue_leave': {
              matchmaking.leave(playerId);
              send({ type: 'dequeued' });
              break;
            }
            case 'move': {
              const room = rooms.get(playerRooms.get(playerId) ?? '');
              if (!room) return send({ type: 'error', error: 'not in a room' });
              room.move(playerId, { row: msg.row, col: msg.col });
              break;
            }
            case 'resign': {
              const room = rooms.get(playerRooms.get(playerId) ?? '');
              room?.resign(playerId);
              break;
            }
            default:
              send({ type: 'error', error: 'unknown message type' });
          }
        } catch (e: any) {
          send({ type: 'error', error: e.message });
        }
      });
    });
  });

  const port = Number(process.env.PORT ?? 8080);
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
