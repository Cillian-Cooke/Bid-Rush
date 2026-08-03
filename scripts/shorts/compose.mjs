#!/usr/bin/env node
/**
 * Compose Bid Rush Shorts: hook card + gameplay clips + CTA end card → 1080×1920@30fps.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const require = createRequire(import.meta.url);

export function resolveFfmpeg() {
  try {
    execFileSync('which', ['ffmpeg'], { stdio: 'pipe' });
    return 'ffmpeg';
  } catch {
    /* fall through */
  }
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && existsSync(staticPath)) return staticPath;
  } catch {
    /* optional */
  }
  return null;
}

function ff(ffmpegBin, args) {
  execFileSync(ffmpegBin, args, { stdio: 'pipe' });
}

/** Encode any input to locked 1080×1920 30fps H.264. */
export function encodeCfrClip(ffmpegBin, inputPath, outputPath, opts = {}) {
  const duration = opts.duration;
  const args = [
    '-y',
    '-i',
    inputPath,
    '-vf',
    'scale=1080:1920:flags=lanczos:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30',
    '-r',
    '30',
    '-vsync',
    'cfr',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
  ];
  if (duration != null) {
    args.push('-t', String(duration));
  }
  args.push(outputPath);
  ff(ffmpegBin, args);
}

function escapeDrawtext(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "")
    .replace(/%/g, '\\%');
}

function findFont() {
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/Library/Fonts/Arial Bold.ttf',
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Brand hook / CTA cards via lavfi + drawtext (no extra browser). */
export function renderCard(ffmpegBin, outPath, { title, subtitle, durationSec }) {
  const font = findFont();
  const t = escapeDrawtext(title);
  const s = escapeDrawtext(subtitle);
  const fontOpt = font ? `:fontfile=${font}` : '';
  const vf = [
    `drawtext=text='${t}'${fontOpt}:fontsize=96:fontcolor=0xf5e6c8:borderw=4:bordercolor=0x1a1612:x=(w-text_w)/2:y=(h/2)-110`,
    `drawtext=text='${s}'${fontOpt}:fontsize=52:fontcolor=0xffc14a:borderw=3:bordercolor=0x1a1612:x=(w-text_w)/2:y=(h/2)+20`,
  ].join(',');

  ff(ffmpegBin, [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=0x3f392f:s=1080x1920:d=${durationSec}:r=30`,
    '-f',
    'lavfi',
    '-i',
    `color=c=0x564e44:s=1080x420:d=${durationSec}:r=30`,
    '-filter_complex',
    `[1]format=rgba,colorchannelmixer=aa=0.55[band];[0][band]overlay=0:(H-h)/2,${vf}`,
    '-r',
    '30',
    '-vsync',
    'cfr',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-an',
    '-t',
    String(durationSec),
    outPath,
  ]);
}

/**
 * Stitch hook + clips + end into final MP4.
 * @param {string[]} clipPaths already CFR-encoded gameplay segments
 */
export function composeShort(ffmpegBin, {
  outPath,
  workDir,
  hook,
  clipPaths,
  winnerLabel,
}) {
  mkdirSync(workDir, { recursive: true });
  const hookPath = join(workDir, 'hook.mp4');
  const endPath = join(workDir, 'end.mp4');
  const listPath = join(workDir, 'concat.txt');

  renderCard(ffmpegBin, hookPath, {
    title: 'BID RUSH',
    subtitle: hook || 'OUTBID. OUTBUILD. OUTLAST.',
    durationSec: 1.1,
  });
  renderCard(ffmpegBin, endPath, {
    title: winnerLabel || 'MATCH OVER',
    subtitle: 'Play Bid Rush',
    durationSec: 2.0,
  });

  const parts = [hookPath, ...clipPaths, endPath];
  const listBody = parts
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join('\n');
  writeFileSync(listPath, listBody);

  ff(ffmpegBin, [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-r',
    '30',
    '-vsync',
    'cfr',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    outPath,
  ]);
}

// CLI: node scripts/shorts/compose.mjs --out final.mp4 --hook "BOOM" --clips a.mp4,b.mp4
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('compose.mjs')) {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  const out = get('--out');
  const hook = get('--hook') ?? 'BID RUSH';
  const clips = (get('--clips') ?? '').split(',').filter(Boolean);
  const winner = get('--winner') ?? 'MATCH OVER';
  if (!out || clips.length === 0) {
    console.error('Usage: compose.mjs --out final.mp4 --clips a.mp4,b.mp4 [--hook TEXT] [--winner TEXT]');
    process.exit(1);
  }
  const ffmpegBin = resolveFfmpeg();
  if (!ffmpegBin) {
    console.error('ffmpeg not found');
    process.exit(1);
  }
  const workDir = join(dirname(out), '.compose-work');
  composeShort(ffmpegBin, {
    outPath: out,
    workDir,
    hook,
    clipPaths: clips,
    winnerLabel: winner,
  });
  console.log(out);
}
