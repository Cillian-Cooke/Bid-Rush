#!/usr/bin/env node
/**
 * Record a Bid Rush highlight Short (1080×1920 @ 30fps CFR).
 *
 * 1) Pick an exciting seed with peak windows (headless)
 * 2) For each peak: fast-forward in step mode, then capture realtime
 * 3) Stitch hook + clips + CTA → upload-ready MP4
 *
 * Usage:
 *   node scripts/shorts/record.mjs --mode duel|blitz [--seed N] [--out path] [--pick-seed]
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
import {
  resolveFfmpeg,
  encodeCfrClip,
  composeShort,
} from './compose.mjs';

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
    progress: null,
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
    else if (a === '--progress') out.progress = next();
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/shorts/record.mjs [options]
  --mode duel|blitz     Match mode (default blitz)
  --seed N              Fixed seed (still scores clips unless --pick-seed)
  --pick-seed           Score N sims and record the best
  --attempts N          Seed search attempts (default 12)
  --out path.mp4        Output file
  --max-seconds N       Hard wall-clock cap per clip wait (default 60)
  --skip-build          Reuse existing dist/
  --port N              Preview port (default: free port)
  --progress path.json  Write generation progress for UI`);
      process.exit(0);
    }
  }
  if (out.mode !== 'duel' && out.mode !== 'blitz') {
    console.error(`Invalid --mode ${out.mode}`);
    process.exit(1);
  }
  return out;
}

function writeProgress(path, data) {
  if (!path) return;
  try {
    writeFileSync(
      path,
      JSON.stringify({ ...data, updatedAt: Date.now() }, null, 2),
    );
  } catch {
    /* ignore */
  }
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

function simulateOne(mode, seed) {
  const tsx = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const picker = join(ROOT, 'scripts', 'shorts', 'pick-seed.ts');
  // Reuse picker with attempts=1 and fixed base
  const out = execFileSync(
    process.execPath,
    [tsx, picker, '--mode', mode, '--attempts', '1', '--base', String(seed >>> 0)],
    { cwd: ROOT, encoding: 'utf8', env: process.env },
  );
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

async function captureClip(playwright, base, seed, mode, clip, workDir, idx, ffmpegBin) {
  const videoDir = join(workDir, `pw-clip-${idx}`);
  mkdirSync(videoDir, { recursive: true });

  const qs = new URLSearchParams({
    shorts: '1',
    step: '1',
    mode,
    seed: String(seed >>> 0),
  });
  const url = `${base}/?${qs.toString()}`;

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 2,
    recordVideo: {
      dir: videoDir,
      size: { width: 1080, height: 1920 },
    },
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

  await page.waitForFunction(
    () => window.__BID_RUSH__ && typeof window.__BID_RUSH__.fastForwardTo === 'function',
    { timeout: 20_000 },
  );

  // Fast-forward through preamble + into the peak window
  await page.evaluate(async (targetMs) => {
    const b = window.__BID_RUSH__;
    b.setClock('step');
    b.fastForwardTo(targetMs);
  }, clip.startMs);

  // Settle a frame, then switch to realtime for natural motion
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    window.__BID_RUSH__.setClock('realtime');
  });

  const captureMs = Math.max(3_000, Math.min(10_000, clip.endMs - clip.startMs));
  const hardCap = Math.min(captureMs + 1_500, 12_000);
  const t0 = Date.now();
  while (Date.now() - t0 < hardCap) {
    const snap = await page.evaluate(() => {
      const b = window.__BID_RUSH__;
      return {
        phase: b?.phase,
        ended: b?.ended,
        elapsedMs: b?.elapsedMs ?? 0,
      };
    });
    if (snap.ended || snap.phase === 'results') {
      await page.waitForTimeout(600);
      break;
    }
    if (snap.elapsedMs >= clip.endMs) break;
    await page.waitForTimeout(50);
  }

  await page.close();
  await context.close();
  await browser.close();

  const videos = readdirSync(videoDir).filter((f) => /\.(webm|mp4)$/i.test(f));
  if (videos.length === 0) {
    throw new Error(`No Playwright video for clip ${idx}`);
  }
  const rawVideo = join(videoDir, videos[0]);
  const cfrPath = join(workDir, `clip-${idx}.mp4`);
  encodeCfrClip(ffmpegBin, rawVideo, cfrPath);
  rmSync(videoDir, { recursive: true, force: true });
  return cfrPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const progressPath = args.progress;

  const ffmpegBin = resolveFfmpeg();
  if (!ffmpegBin) {
    writeProgress(progressPath, {
      status: 'error',
      message: 'ffmpeg not found',
    });
    console.error(
      'ffmpeg not found. Install system ffmpeg or ensure ffmpeg-static is present — see docs/SHORTS.md',
    );
    process.exit(1);
  }

  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    writeProgress(progressPath, {
      status: 'error',
      message: 'playwright not installed',
    });
    console.error(
      'playwright not installed. Run: npm i && npx playwright install chromium',
    );
    process.exit(1);
  }

  writeProgress(progressPath, {
    status: 'searching',
    message: 'Picking highlight seed…',
    pct: 5,
  });

  let best;
  if (args.pickSeed || args.seed == null) {
    console.log(
      `Picking exciting ${args.mode} seed (${args.attempts} attempts)…`,
    );
    best = pickSeed(args.mode, args.attempts, args.seed ?? undefined);
  } else {
    best = simulateOne(args.mode, args.seed);
  }

  const seed = best.seed >>> 0;
  const clips = Array.isArray(best.clips) && best.clips.length > 0
    ? best.clips
    : [{ startMs: 8_000, endMs: 14_000, reason: 'chaos', weight: 1 }];
  const hook = best.hook || 'BID RUSH';

  console.log(
    `Best seed ${seed} score=${Number(best.score).toFixed(1)} clips=${clips.length} hook=${hook}`,
  );
  writeProgress(progressPath, {
    status: 'searching',
    message: `Seed ${seed} · ${clips.length} peaks`,
    pct: 12,
    seed,
    hook,
    clips,
  });

  if (!args.skipBuild || !existsSync(join(ROOT, 'dist', 'index.html'))) {
    writeProgress(progressPath, {
      status: 'building',
      message: 'Building app…',
      pct: 18,
      seed,
    });
    console.log('Building…');
    await run('npm', ['run', 'build']);
  }

  const port = args.port ?? (await freePort());
  const previewRef = { current: null };
  console.log(`Starting vite preview on :${port}…`);
  writeProgress(progressPath, {
    status: 'preview',
    message: 'Starting preview…',
    pct: 22,
    seed,
  });
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
  const workDir = join(outDir, `.work-${stamp}`);
  mkdirSync(workDir, { recursive: true });

  console.log(`Using ffmpeg: ${ffmpegBin}`);
  console.log(`Capturing ${clips.length} highlight clips…`);

  const clipPaths = [];
  let winnerLabel = 'MATCH OVER';
  const tCapture0 = Date.now();

  try {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const pct = 25 + Math.floor((i / Math.max(1, clips.length)) * 50);
      writeProgress(progressPath, {
        status: 'capturing',
        message: `Clip ${i + 1}/${clips.length}: ${clip.reason}`,
        pct,
        seed,
        hook,
        clipIndex: i,
        clipsTotal: clips.length,
      });
      console.log(
        `  [${i + 1}/${clips.length}] ${clip.reason} @ ${clip.startMs}-${clip.endMs}ms`,
      );
      const path = await captureClip(
        playwright,
        base,
        seed,
        args.mode,
        clip,
        workDir,
        i,
        ffmpegBin,
      );
      clipPaths.push(path);
    }

    // Peek final winner from last page state via a quick headless peek
    try {
      const browser = await playwright.chromium.launch({
        headless: true,
        args: ['--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      const qs = new URLSearchParams({
        shorts: '1',
        step: '1',
        mode: args.mode,
        seed: String(seed),
      });
      await page.goto(`${base}/?${qs}`, {
        waitUntil: 'networkidle',
        timeout: 60_000,
      });
      await page.waitForFunction(() => window.__BID_RUSH__?.fastForwardTo, {
        timeout: 15_000,
      });
      await page.evaluate(() => {
        window.__BID_RUSH__.fastForwardTo(1e9);
      });
      const snap = await page.evaluate(() => ({
        ended: window.__BID_RUSH__?.ended,
        winnerId: window.__BID_RUSH__?.winnerId,
      }));
      if (snap.ended) winnerLabel = 'WINNER';
      await browser.close();
    } catch {
      /* keep default CTA */
    }
  } finally {
    if (previewRef.current) {
      previewRef.current.kill('SIGTERM');
    }
  }

  const captureSec = ((Date.now() - tCapture0) / 1000).toFixed(1);
  console.log(`Captured clips in ${captureSec}s wall time`);

  writeProgress(progressPath, {
    status: 'encoding',
    message: 'Stitching hook + clips + CTA…',
    pct: 85,
    seed,
    hook,
  });

  const composeDir = join(workDir, 'compose');
  console.log(`Composing → ${outPath}`);
  composeShort(ffmpegBin, {
    outPath,
    workDir: composeDir,
    hook,
    clipPaths,
    winnerLabel,
  });

  writeFileSync(
    join(outDir, `bid-rush-${args.mode}-${stamp}.json`),
    JSON.stringify(
      {
        mode: args.mode,
        seed,
        out: outPath,
        hook,
        clips,
        captureSec: Number(captureSec),
        capture: 'highlight-clips-playwright',
        aspect: '9:16',
        resolution: '1080x1920',
        fps: 30,
        crf: 18,
      },
      null,
      2,
    ),
  );

  rmSync(workDir, { recursive: true, force: true });

  writeProgress(progressPath, {
    status: 'done',
    message: 'Short ready',
    pct: 100,
    seed,
    hook,
    out: outPath,
  });

  console.log(`Done: ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  const progressArg = process.argv.indexOf('--progress');
  if (progressArg >= 0 && process.argv[progressArg + 1]) {
    writeProgress(process.argv[progressArg + 1], {
      status: 'error',
      message: String(err?.message ?? err),
      pct: 0,
    });
  }
  process.exit(1);
});
