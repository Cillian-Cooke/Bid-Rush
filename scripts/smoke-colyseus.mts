/**
 * Smoke test: create room, second client joins by id, host starts, both get naming.
 * Run: npx tsx scripts/smoke-colyseus.mts  (with server already on :2567)
 */
import { Client } from '@colyseus/sdk';

const URL = process.env.COLYSEUS_URL ?? 'http://127.0.0.1:2567';

async function main() {
  const a = new Client(URL);
  const b = new Client(URL);

  const roomA = await a.create('bid_rush', { mode: 'duel', difficulty: 'mixed' });
  console.log('created', roomA.roomId);

  const roomB = await b.joinById(roomA.roomId, {});
  console.log('joined', roomB.roomId, 'as', roomB.sessionId);

  const namingPromise = new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for naming')), 8000);
    roomA.onMessage('naming', () => {
      clearTimeout(t);
      resolve();
    });
  });

  roomA.send('start', {});
  await namingPromise;
  console.log('naming started — ok');

  await roomA.leave();
  await roomB.leave();
  console.log('smoke ok');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
