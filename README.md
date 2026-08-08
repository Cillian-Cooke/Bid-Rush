# Bid Rush

Mobile-first auction party game. Bid on a live shop, collect money engines, sabotage rivals, and be the last (or richest) standing.

## Run (local)

```bash
npm install

# Nakama — accounts, matchmaking, ranked RP, live matches (Docker)
npm run dev:nakama

# Client
npm run dev
```

Open the local URL (default `http://localhost:5173`).

Optional env (defaults work with local Docker) — see `.env.example`:

```bash
VITE_NAKAMA_HOST=127.0.0.1
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_SERVER_KEY=defaultkey
VITE_NAKAMA_USE_SSL=false
```

| Mode | Behavior |
|------|----------|
| **Ranked** | Matchmake 1v1 · RP on Nakama · bots after 20s if alone |
| **Casual** | Matchmake Duel/Blitz · bots if queue empty |
| **Custom** | Create/join short room codes on Nakama |

Nakama console: http://127.0.0.1:7351

## Deploy (Vercel)

1. Import the GitHub repo (Vite → `dist`).
2. Set `VITE_NAKAMA_*` to your hosted Nakama (Heroic Cloud or Docker on Fly/Railway).
3. Client-only on Vercel — **Nakama is the game server**.

The old Colyseus `server/` folder is unused by the client (kept for reference).

## Stack

- Vite + React + TypeScript + Zustand
- Pure game logic in `src/game/` (shared with Nakama via esbuild)
- Nakama (`nakama/`) — auth, RP, matchmaking, authoritative matches
- 8-bit sprites: `npm run sprites:slice`
