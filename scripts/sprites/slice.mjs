#!/usr/bin/env node
/** Slice emoji-faithful raw sheets in docs/sprites/ → public/sprites/ */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const py = path.join(dir, 'slice.py');
const r = spawnSync('python3', [py], { stdio: 'inherit' });
process.exit(r.status ?? 1);
