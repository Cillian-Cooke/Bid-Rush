#!/usr/bin/env node
/**
 * Record a Bid Rush YouTube Short (1080×1920, ≤60s).
 *
 * Runs the real game in realtime (same UI players see, scaled to 9:16)
 * and captures with Playwright's video recorder — no PNG frame dumps.
 *
 * Usage:
 *   node scripts/shorts/record.mjs --mode duel|blitz [--seed N] [--out path] [--max-seconds 60] [--pick-seed]
 */
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import {
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const out = {
    mode: 'blitz',
    seed: null,
    out: null,
    maxSeconds: 60,
    pickSeed: false,
    attempts: 12,
    skipBuild: false,
    port: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--mode') out.mode = next();
    else if (a === '--seed') out.seed = Number(next());
    else if (a === '--out') out.out = next();
    else if (a === '--max-seconds') out.maxSeconds = Number(next());
    else if (a === '--pick-seed') out.pickSeed = true;
    else if (a === '--attempts') out.attempts = Number(next());
    else if (a === '--skip-build') out.skipBuild = true;
    else if (a === '--port') out.port = Number(next());
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/shorts/record.mjs [options]
  --mode duel|blitz     Match mode (default blitz)
  --seed N              Fixed seed (skips pick unless --pick-seed)
  --pick-seed           Score N sims and record the best
  --attempts N          Seed search attempts (default 12)
  --out path.mp4        Output file
  --max-seconds N       Hard cap (default 60)
  --skip-build          Reuse existing dist/
  --port N              Preview port (default: free port)`);
      process.exit(0);
    }
  }
  if (out.mode !== 'duel' && out.mode !== 'blitz') {
    console.error(`Invalid --mode ${out.mode}`);
    process.exit(1);
  }
  return out;
}

function which(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function resolveFfmpeg() {
  if (which('ffmpeg')) return 'ffmpeg';
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && existsSync(staticPath)) return staticPath;
  } catch {
    /* optional */
  }
  return null;
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      s.close(() => resolvePort(port));
    });
    s.on('error', reject);
  });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: opts.stdio ?? 'inherit',
      env: { ...process.env, ...opts.env },
      shell: false,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
    if (opts.ref) opts.ref.current = child;
  });
}

function pickSeed(mode, attempts, baseSeed) {
  const tsx = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const picker = join(ROOT, 'scripts', 'shorts', 'pick-seed.ts');
  const args = [tsx, picker, '--mode', mode, '--attempts', String(attempts)];
  if (baseSeed != null && Number.isFinite(baseSeed)) {
    args.push('--base', String(baseSeed >>> 0));
  }
  const out = execFileSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  const line = out.trim().split('\n').filter(Boolean).at(-1);
  return JSON.parse(line);
}

async function waitForUrl(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Preview not ready: ${url}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const ffmpegBin = resolveFfmpeg();
  if (!ffmpegBin) {
    console.error(
      'ffmpeg not found. Install system ffmpeg or ensure ffmpeg-static is present — see docs/SHORTS.md',
    );
    process.exit(1);
  }

  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    console.error(
      'playwright not installed. Run: npm i && npx playwright install chromium',
    );
    process.exit(1);
  }

  let seed = args.seed;
  if (args.pickSeed || seed == null) {
    console.log(
      `Picking exciting ${args.mode} seed (${args.attempts} attempts)…`,
    );
    const best = pickSeed(args.mode, args.attempts, seed ?? undefined);
    console.log(
      `Best seed ${best.seed} score=${best.score.toFixed(1)} elim=${best.eliminations} events=${best.events} sd=${best.suddenDeath}`,
    );
    seed = best.seed;
  }

  if (!args.skipBuild || !existsSync(join(ROOT, 'dist', 'index.html'))) {
    console.log('Building…');
    await run('npm', ['run', 'build']);
  }

  const port = args.port ?? (await freePort());
  const previewRef = { current: null };
  console.log(`Starting vite preview on :${port}…`);
  const previewPromise = run(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port)],
    { ref: previewRef, stdio: 'pipe' },
  );
  previewPromise.catch(() => {});

  const base = `http://127.0.0.1:${port}`;
  await waitForUrl(base);

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  const outDir = join(ROOT, 'output', 'shorts');
  mkdirSync(outDir, { recursive: true });
  const outPath =
    args.out ?? join(outDir, `bid-rush-${args.mode}-${stamp}.mp4`);
  const videoDir = join(outDir, `.pw-video-${stamp}`);
  mkdirSync(videoDir, { recursive: true });

  // Realtime game — no step=1 (that path looked unlike live play)
  const qs = new URLSearchParams({
    shorts: '1',
    mode: args.mode,
    seed: String(seed >>> 0),
  });
  const url = `${base}/?${qs.toString()}`;
  console.log(`Realtime recording ${url}`);
  console.log(`Using ffmpeg: ${ffmpegBin}`);

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: videoDir,
      size: { width: 1080, height: 1920 },
    },
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

  await page.waitForFunction(
    () => {
      const b = window.__BID_RUSH__;
      return b && b.phase !== 'lobby';
    },
    { timeout: 15_000 },
  );

  const hardCapMs = Math.max(5, args.maxSeconds) * 1000;
  const resultsHoldMs = 2000;
  let resultsSince = null;
  const t0 = Date.now();

  while (Date.now() - t0 < hardCapMs) {
    const bridge = await page.evaluate(() => window.__BID_RUSH__ ?? null);
    if (bridge?.phase === 'results' || bridge?.ended) {
      if (resultsSince == null) resultsSince = Date.now();
      else if (Date.now() - resultsSince >= resultsHoldMs) break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Captured ${elapsedSec}s of realtime gameplay`);

  await page.close();
  await context.close();
  await browser.close();

  if (previewRef.current) {
    previewRef.current.kill('SIGTERM');
  }

  const videos = readdirSync(videoDir).filter((f) =>
    /\.(webm|mp4)$/i.test(f),
  );
  if (videos.length === 0) {
    console.error('No Playwright video file produced');
    process.exit(1);
  }
  const rawVideo = join(videoDir, videos[0]);

  // Match source cadence (Playwright ~25fps) — avoid forced 30fps frame-dupe lag
  console.log(`Encoding → ${outPath}`);
  execFileSync(
    ffmpegBin,
    [
      '-y',
      '-i',
      rawVideo,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-vf',
      'scale=1080:1920:flags=lanczos:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
      '-t',
      String(args.maxSeconds),
      '-movflags',
      '+faststart',
      '-an',
      outPath,
    ],
    { stdio: 'inherit' },
  );

  rmSync(videoDir, { recursive: true, force: true });
  writeFileSync(
    join(outDir, `bid-rush-${args.mode}-${stamp}.json`),
    JSON.stringify(
      {
        mode: args.mode,
        seed: seed >>> 0,
        out: outPath,
        elapsedSec: Number(elapsedSec),
        maxSeconds: args.maxSeconds,
        capture: 'realtime-playwright-video',
        aspect: '9:16',
        resolution: '1080x1920',
      },
      null,
      2,
    ),
  );

  console.log(`Done: ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
