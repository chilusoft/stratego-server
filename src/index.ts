import Fastify from 'fastify';
import websocket from '@fastify/websocket';

async function main() {
  const app = Fastify({ logger: true });
  await app.register(websocket);

  app.get('/health', async () => ({ status: 'ok' }));

  // Stub: leaderboard (Phase 4)
  app.get('/leaderboard', async () => ({ games: ['reversi', 'chess', 'checkers'], entries: [] }));

  // Stub: matchmaking/discovery will attach to rooms/ later
  app.register(async (f) => {
    f.get('/ws', { websocket: true }, (socket) => {
      socket.on('message', (msg) => socket.send(msg)); // echo stub
    });
  });

  const port = Number(process.env.PORT ?? 8080);
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
