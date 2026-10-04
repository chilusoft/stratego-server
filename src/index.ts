import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { RoomManager } from './rooms/manager.js';
import { MatchmakingQueue } from './matchmaking/queue.js';
import { LeaderboardStore } from './leaderboard/store.js';
import { NameRegistry } from './rooms/name-registry.js';
import { GoogleVerifier, DEFAULT_GOOGLE_CLIENT_IDS } from './auth/google.js';

async function main() {
  const app = Fastify({ logger: true });
  await app.register(websocket);
  const rooms = new RoomManager();
  const matchmaking = new MatchmakingQueue();
  const playerSockets = new Map<string, (obj: unknown) => void>();
  const playerRooms = new Map<string, string>();
  const leaderboard = new LeaderboardStore();
  const names = new NameRegistry();
  const nameOfPlayer = new Map<string, string>();
  const authedPlayer = new Map<string, { name: string; email?: string; lat?: number; lon?: number }>();
  const googleVerifier = new GoogleVerifier(
    (process.env.GOOGLE_CLIENT_IDS ?? DEFAULT_GOOGLE_CLIENT_IDS.join(',')).split(',').map((s) => s.trim()),
  );
  const recorded = new Set<string>();

  const trackRoom = (room: ReturnType<RoomManager['create']>, game: string) => {
    room.addListener((snap) => {
      if (snap.status !== 'finished' || recorded.has(room.id)) return;
      recorded.add(room.id);
      const [a, b] = snap.players;
      const winnerColor = snap.winner;
      const winner = winnerColor === 'draw' || winnerColor === null
        ? null
        : snap.players.find((p) => p.color === winnerColor);
      if (a && b) leaderboard.recordMatch(game, a.name, b.name, winner?.name ?? null, snap.reason ?? 'completed');
    });
  };

  matchmaking.onMatch = ({ mode, a, b }) => {
    if (mode !== 'reversi') {
      playerSockets.get(a.playerId)?.({ type: 'error', error: `${mode} not available yet` });
      playerSockets.get(b.playerId)?.({ type: 'error', error: `${mode} not available yet` });
      return;
    }
    const room = rooms.create();
    trackRoom(room, mode);
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
  app.get('/leaderboard', async (req: any) => {
    const game = req.query?.game ?? 'reversi';
    return { game, entries: leaderboard.top(game) };
  });
  app.get('/history/:name', async (req: any) => ({ history: leaderboard.historyFor(req.params.name) }));
  app.get('/rooms', async () => ({ open: rooms.openRooms() }));

  app.register(async (f) => {
    f.get('/ws', { websocket: true }, (socket, req) => {
      const playerId = `p-${Math.random().toString(36).slice(2, 10)}`;
      const send = (obj: unknown) => socket.send(JSON.stringify(obj));
      playerSockets.set(playerId, send);
      socket.on('close', () => {
        playerSockets.delete(playerId);
        matchmaking.leave(playerId);
        const n = nameOfPlayer.get(playerId);
        if (n) names.release(n, playerId);
        nameOfPlayer.delete(playerId);
        authedPlayer.delete(playerId);
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
          if (msg.type === 'auth') {
            if (typeof msg.token !== 'string') return send({ type: 'error', error: 'missing token' });
            googleVerifier.verify(msg.token).then((profile) => {
              const displayName = profile.name ?? profile.email ?? `player-${playerId.slice(-4)}`;
              if (!names.claim(displayName, playerId)) {
                return send({ type: 'error', error: 'account name already in use' });
              }
              const entry: { name: string; email?: string; lat?: number; lon?: number } = { name: displayName, email: profile.email };
              if (typeof msg.lat === 'number' && typeof msg.lon === 'number') { entry.lat = msg.lat; entry.lon = msg.lon; }
              authedPlayer.set(playerId, entry);
              nameOfPlayer.set(playerId, names.displayName(displayName));
              send({ type: 'authed', name: displayName });
            }).catch(() => send({ type: 'error', error: 'invalid Google token' }));
            return;
          }

          if (!authedPlayer.has(playerId)) {
            return send({ type: 'error', error: 'auth required' });
          }

          switch (msg.type) {
            case 'create_room': {
              const room = rooms.create(msg.timeMs);
              trackRoom(room, 'reversi');
              room.addPlayer(playerId, authedPlayer.get(playerId)!.name);
              playerRooms.set(playerId, room.id);
              send({ type: 'room_created', roomId: room.id, playerId });
              attach(room.id);
              break;
            }
            case 'join_room': {
              const room = rooms.get(msg.roomId);
              if (!room) return send({ type: 'error', error: 'room not found' });
              room.addPlayer(playerId, authedPlayer.get(playerId)!.name);
              playerRooms.set(playerId, room.id);
              send({ type: 'joined', roomId: room.id, playerId });
              attach(room.id);
              break;
            }
            case 'queue_join': {
              matchmaking.join({ playerId, name: authedPlayer.get(playerId)!.name, mode: msg.mode ?? 'reversi', rating: msg.rating, joinedAt: Date.now() });
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
