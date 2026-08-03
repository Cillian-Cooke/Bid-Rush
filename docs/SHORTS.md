# YouTube Shorts Match Recorder

Record a full Bid Rush match as a phone-shaped MP4 for YouTube Shorts.

## Output

| Spec | Value |
|------|--------|
| Resolution | **1080×1920** |
| Frame rate | **30 fps** |
| Max duration | **60 s** (match profile aims ~55 s) |
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
## Commands

```bash
# Blitz Short (picks an exciting seed, then records)
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
| `--seed N` | Fixed seed |
| `--pick-seed` | Score several headless sims and record the best |
| `--attempts N` | Seed search count (default 12) |
| `--out path.mp4` | Output file |
| `--max-seconds N` | Hard stop (default 60) |
| `--skip-build` | Skip `npm run build` if `dist/` exists |
| `--port N` | Vite preview port |

If `--seed` is omitted, the CLI runs seed picking automatically.

## How it works

1. Applies the **Shorts timing profile** when the app loads with `?shorts=1` (see below).
2. Optionally runs a fast headless sim (`scripts/shorts/pick-seed.ts`) to prefer knockouts, world events, sudden death, and close coin races.
3. Builds the app, starts `vite preview`, opens Playwright at **1080×1920** (9:16).
4. Runs the **real game in realtime** (same UI as play, scaled into the Short frame) and records Playwright video — no PNG frame dumps.
5. Transcodes WebM → H.264 MP4 via ffmpeg (keeps source frame timing; no fake 30fps dup).

App URL hooks:

- `shorts=1` — compressed timings, scale UI to fill width, auto-start ruthless match, expose `window.__BID_RUSH__` (`phase`, `ended`, `winnerId`, `seed`, `mode`).
- `mode=duel|blitz`
- `seed=<number>`

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
| Match never ends / hits 60 s | Sudden death can run long; try `--pick-seed` or another `--seed` |
| Build errors | Run `npm run build` alone and fix TypeScript issues first |
| Preview port in use | Pass `--port 4174` (or another free port) |

## Out of scope

- YouTube upload
- Voiceover / music
- Multi-clip editing
