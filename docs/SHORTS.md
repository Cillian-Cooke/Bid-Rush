# YouTube Shorts / Reels Generator

One click (or one CLI command) → upload-ready vertical MP4 with a brand hook, highlight gameplay clips, and a CTA end card.

## Output

| Spec | Value |
|------|--------|
| Resolution | **1080×1920** |
| Frame rate | **30 fps CFR** |
| Length | **~20–35 s** highlight reel (not a full-match dump) |
| Encode | H.264 `veryfast`, **CRF 18**, `yuv420p`, `+faststart` |
| Path | `output/shorts/bid-rush-{mode}-{timestamp}.mp4` |

Modes: **duel** (1v1) or **blitz** (4 players). All seats are bot-driven; the camera is the human seat (hand dock + board).

## Prerequisites

1. **Node.js** 20+
2. **ffmpeg** — system install *or* the `ffmpeg-static` npm package (installed with `npm i`)
   - Debian/Ubuntu: `sudo apt install ffmpeg`
   - macOS: `brew install ffmpeg`
3. Project deps + Playwright Chromium:

```bash
npm install
npx playwright install chromium
```

The recorder prefers `ffmpeg` on your `PATH`, then falls back to `node_modules/ffmpeg-static`.

## Generate from the lobby

1. Run the app with Vite (`npm run dev` or `npm run build && npm run preview`).
2. In **dev**, a **Generate Short** panel appears on the lobby. In production preview, open with `?shortsTools=1`.
3. Pick **Blitz** or **Duel**, click **Generate Short**.
4. Progress updates live; when done, the MP4 path is shown under `output/shorts/`.

The lobby button hits:

- `POST /__shorts/generate` — starts `scripts/shorts/record.mjs`
- `GET /__shorts/status` — polls progress JSON

## CLI

```bash
# Blitz Short (picks an exciting seed, captures peaks, stitches cards)
npm run shorts:blitz

# Duel Short
npm run shorts:duel

# Custom
npm run shorts -- --mode blitz --seed 12345
npm run shorts -- --mode duel --pick-seed --attempts 20 --out ./my-short.mp4
npm run shorts -- --mode blitz --skip-build   # reuse existing dist/
```

Flags:

| Flag | Meaning |
|------|---------|
| `--mode duel\|blitz` | Match mode (default `blitz`) |
| `--seed N` | Fixed seed (still builds highlight windows) |
| `--pick-seed` | Score several headless sims and record the best |
| `--attempts N` | Seed search count (default 12) |
| `--out path.mp4` | Output file |
| `--max-seconds N` | Per-clip wait safety (default 60) |
| `--skip-build` | Skip `npm run build` if `dist/` exists |
| `--port N` | Vite preview port |
| `--progress path.json` | Write generation progress for the lobby UI |

If `--seed` is omitted, the CLI runs seed picking automatically.

## How it works

1. **Moment search** (`src/game/shortsSim.ts`) scores seeds for highlight density: world events, bomb KOs, sudden death, Quick Swap resolves, photo finishes. Returns peak windows `{ startMs, endMs, reason }` plus a punchy `hook` line.
2. Applies the **Shorts timing profile** when the app loads with `?shorts=1` (see below).
3. Builds the app (unless `--skip-build`), starts `vite preview`, opens Playwright at **1080×1920** (9:16) with `deviceScaleFactor: 2` for sharp UI.
4. For each peak: boot `?shorts=1&step=1`, **fast-forward** via `__BID_RUSH__.fastForwardTo`, switch to **realtime**, capture only that window.
5. **Compose** (`scripts/shorts/compose.mjs`): brand hook card → clips → “Play Bid Rush” CTA, forced **30fps CFR**, CRF 18.

App URL hooks:

- `shorts=1` — compressed timings, scale UI to fill width, auto-start ruthless match, expose `window.__BID_RUSH__`.
- `step=1` — recorder drives the clock for fast-forward between peaks.
- `mode=duel|blitz`
- `seed=<number>`
- `shortsTools=1` — show Generate Short in non-dev builds served by Vite.

Bridge helpers: `step`, `setClock('step'|'realtime')`, `fastForwardTo(elapsedMs)`, `elapsedMs`.

### Shorts timing profile

| Setting | Live | Shorts |
|---------|------|--------|
| Match length | 180 s | **50 s** |
| Event duration | 30 s | **10 s** |
| Event warn / start | 150 s / 120 s left | **~20 s / 15 s** left |
| Sudden-death phase | 30 s | **8 s** |
| Name auction / pool / countdown | 5 s / 5 s / 3 s | **2 s / 2 s / 1 s** |
| Tile timer | 10 s | **4 s** |
| Pace banners | 2.8 s | **1.2 s** |

Defined in `src/game/shortsProfile.ts` and applied via mutable `CONFIG` in `src/game/constants.ts`.

### UI scale

`.shorts-mode` scales the normal **480px** column by **2.25×** so tiles fill a 1080-wide Short.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ffmpeg not found` | Install system ffmpeg, or keep `ffmpeg-static` from `npm i` |
| `playwright not installed` | `npm i && npx playwright install chromium` |
| Black / empty video | Rebuild without `--skip-build`; open the preview URL in a browser |
| Generate button missing | Use `npm run dev`, or add `?shortsTools=1` on preview |
| Generate stuck / 409 | Wait for the running job; check `output/shorts/.generate-progress.json` |
| Build errors | Run `npm run build` alone and fix TypeScript issues first |
| Preview port in use | Pass `--port 4174` (or another free port) |

## Out of scope (this pass)

- Auto-upload to TikTok / YouTube / Reels
- Voiceover / music bed (optional `--music` later)
- Full-match 60s dumps as the default output
