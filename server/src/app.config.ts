import { defineServer, defineRoom } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BidRushRoom } from './rooms/BidRushRoom.ts';

export const server = defineServer({
  transport: new WebSocketTransport({
    pingInterval: 10_000,
  }),
  rooms: {
    bid_rush: defineRoom(BidRushRoom),
  },
  express: (app) => {
    app.get('/', (_req, res) => {
      res.send('Bid Rush Colyseus server');
    });
    app.get('/health', (_req, res) => {
      res.json({ ok: true });
    });
  },
});
