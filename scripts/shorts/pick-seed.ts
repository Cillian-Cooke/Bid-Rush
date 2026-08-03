/**
 * CLI: pick an exciting Shorts seed (JSON on stdout).
 *   npx tsx scripts/shorts/pick-seed.ts --mode blitz --attempts 12 [--base N]
 */
import { pickExcitingSeed } from '../../src/game/shortsSim.ts';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const mode = (arg('--mode', 'blitz') === 'duel' ? 'duel' : 'blitz') as
  | 'duel'
  | 'blitz';
const attempts = Number(arg('--attempts', '12') ?? 12);
const baseRaw = arg('--base');
const base =
  baseRaw != null && Number.isFinite(Number(baseRaw))
    ? Number(baseRaw) >>> 0
    : undefined;

const best = pickExcitingSeed(mode, attempts, base);
process.stdout.write(`${JSON.stringify(best)}\n`);
