# Bid Rush

Mobile-first auction party game. Bid on a live 3×3 shop, collect money engines, sabotage rivals, and be the last (or richest) standing.

## Run (local solo)

```bash
npm install
npm run dev
```

Open the local URL (default `http://localhost:5173`) on a phone or narrow browser window.

## Multiplayer (Colyseus)

Friends play uses a Colyseus server that runs the same `src/game/` engine authoritatively.

**Requires Node.js 22+** for the server.

```bash
# terminal 1 — game server (ws://localhost:2567)
npm run dev:server

# terminal 2 — Vite client
npm run dev
```

In the lobby, use **Create Duel / Create Blitz** or enter a room code under **Play with friends**. Share the code; empty seats fill with bots when the host starts.

Optional: set `VITE_COLYSEUS_URL` if the server is not on `http://localhost:2567`.

## Deploy (Vercel)

The Vite client builds cleanly for Vercel (`npm run build` → `dist/`).

1. Import the GitHub repo in Vercel (framework: Vite, output: `dist`).
2. Optional env: `VITE_COLYSEUS_URL` = your hosted Colyseus WebSocket URL (e.g. `https://your-game.fly.dev`).
3. The Colyseus server in `server/` is **not** hosted by Vercel — deploy it separately (Fly, Railway, Render, etc.) for online rooms. Ranked / Casual work without it.

## Stack

- Vite + React + TypeScript
- Zustand store with a single ~100ms master game loop (local)
- Pure game logic in `src/game/` (engine, items, bots) — no React
- Colyseus 0.17 in `server/` for online rooms (lobby schema + game snapshot messages)
- 8-bit sprites: emoji-style sheets in `docs/sprites/*-raw.png`, slice with `npm run sprites:slice`
