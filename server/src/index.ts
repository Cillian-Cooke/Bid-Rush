import { server } from './app.config.ts';

const port = Number(process.env.PORT ?? 2567);

server.listen(port).then(() => {
  console.log(`Bid Rush Colyseus listening on ws://localhost:${port}`);
});
