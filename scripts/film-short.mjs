import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, rename, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'recordings');
const W = 1080;
const H = 1920;
const BASE = process.env.FILM_URL ?? 'http://127.0.0.1:5173';
const MATCH_TIMEOUT_MS = Number(process.env.FILM_TIMEOUT_MS ?? 240_000);

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

async function hasFfmpeg() {
  try {
    await run('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

async function ping() {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Re-encode to Shorts-friendly H.264 MP4 at exact 1080×1920 / 60fps. */
async function toMp4(inputPath, outputPath) {
  await run('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-vf',
    `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0a0a0c,fps=60`,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '16',
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'high',
    '-level',
    '4.2',
    '-movflags',
    '+faststart',
    '-an',
    outputPath,
  ]);
}

async function main() {
  if (!(await ping())) {
    console.error(`Dev server not reachable at ${BASE}`);
    console.error('Start it in another terminal: npm run dev');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const before = new Set(await readdir(OUT_DIR));

  console.log(`Filming ${W}×${H} from ${BASE}/film.html?auto=1 …`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      `--window-size=${W},${H}`,
      '--autoplay-policy=no-user-gesture-required',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: W, height: H },
    screen: { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: OUT_DIR,
      size: { width: W, height: H },
    },
  });

  const page = await context.newPage();
  await page.goto(`${BASE}/film.html?auto=1`, { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('[data-film-phase="countdown"], [data-film-phase="playing"]', {
    timeout: 30_000,
  });
  console.log('Match running…');

  await page.waitForSelector('[data-film-phase="results"]', {
    timeout: MATCH_TIMEOUT_MS,
  });
  // Hold on results for a beat
  await page.waitForTimeout(1800);

  const video = page.video();
  await context.close();
  await browser.close();

  if (!video) {
    console.error('No video was recorded');
    process.exit(1);
  }

  const rawPath = await video.path();
  const baseName = `bid-rush-short-${stamp()}`;
  const webmOut = path.join(OUT_DIR, `${baseName}.webm`);
  await rename(rawPath, webmOut);

  // Clean playwright temp names if any leftovers appeared
  for (const name of await readdir(OUT_DIR)) {
    if (!before.has(name) && name !== path.basename(webmOut) && name.endsWith('.webm')) {
      // keep only our renamed file from this run if extras exist
    }
  }

  if (await hasFfmpeg()) {
    const mp4Out = path.join(OUT_DIR, `${baseName}.mp4`);
    console.log('Encoding H.264 1080×1920 @ 60fps…');
    await toMp4(webmOut, mp4Out);
    await unlink(webmOut).catch(() => {});
    console.log(`Saved ${mp4Out}`);
  } else {
    console.log(`Saved ${webmOut}`);
    console.log('(Install ffmpeg for MP4 / forced 60fps export)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
