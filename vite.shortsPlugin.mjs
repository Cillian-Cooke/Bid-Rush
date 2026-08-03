import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROGRESS = join(ROOT, 'output', 'shorts', '.generate-progress.json');
const OUT_DIR = join(ROOT, 'output', 'shorts');

/** @type {import('node:child_process').ChildProcess | null} */
let child = null;

function readJson(path, fallback = null) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function attachShortsApi(middlewares) {
  middlewares.use(async (req, res, next) => {
    const url = req.url?.split('?')[0] ?? '';

    if (url === '/__shorts/status' && req.method === 'GET') {
      const progress = readJson(PROGRESS, {
        status: 'idle',
        message: 'Idle',
        pct: 0,
      });
      const running = child != null && child.exitCode == null;
      return sendJson(res, 200, { ...progress, running });
    }

    if (url === '/__shorts/generate' && req.method === 'POST') {
      if (child != null && child.exitCode == null) {
        return sendJson(res, 409, {
          ok: false,
          message: 'Generation already running',
        });
      }
      let body = {};
      try {
        body = await readBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, message: 'Invalid JSON' });
      }
      const mode = body.mode === 'duel' ? 'duel' : 'blitz';
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(
        PROGRESS,
        JSON.stringify(
          {
            status: 'starting',
            message: 'Starting generator…',
            pct: 1,
            mode,
            updatedAt: Date.now(),
          },
          null,
          2,
        ),
      );

      const args = [
        join(ROOT, 'scripts', 'shorts', 'record.mjs'),
        '--mode',
        mode,
        '--pick-seed',
        '--attempts',
        String(body.attempts ?? 10),
        '--progress',
        PROGRESS,
      ];
      if (body.skipBuild !== false) args.push('--skip-build');
      if (body.seed != null && Number.isFinite(Number(body.seed))) {
        args.push('--seed', String(Number(body.seed) >>> 0));
      }

      child = spawn(process.execPath, args, {
        cwd: ROOT,
        stdio: 'inherit',
        env: process.env,
      });
      child.on('exit', (code) => {
        if (code !== 0) {
          const cur = readJson(PROGRESS, {});
          if (cur?.status !== 'done') {
            writeFileSync(
              PROGRESS,
              JSON.stringify(
                {
                  ...(cur ?? {}),
                  status: 'error',
                  message: cur?.message || `Generator exited ${code}`,
                  pct: cur?.pct ?? 0,
                  updatedAt: Date.now(),
                },
                null,
                2,
              ),
            );
          }
        }
        child = null;
      });

      return sendJson(res, 202, { ok: true, mode, progress: PROGRESS });
    }

    return next();
  });
}

/** Dev + preview middleware: POST /__shorts/generate, GET /__shorts/status */
export function shortsGeneratePlugin() {
  return {
    name: 'bid-rush-shorts-generate',
    configureServer(server) {
      attachShortsApi(server.middlewares);
    },
    configurePreviewServer(server) {
      attachShortsApi(server.middlewares);
    },
  };
}
