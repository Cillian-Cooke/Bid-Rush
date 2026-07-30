# Bid Rush

Mobile-first auction party game. Bid on a live 3×3 shop, collect money engines, sabotage rivals, and be the last (or richest) standing.

## Run

```bash
npm install
npm run dev
```

Open the local URL (default `http://localhost:5173`) on a phone or narrow browser window.

## Stack

- Vite + React + TypeScript
- Zustand store with a single ~100ms master game loop
- Pure game logic in `src/game/` (engine, items, bots) — no React, network-ready action API
