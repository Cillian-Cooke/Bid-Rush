import { CONFIG, type RuntimeConfig } from './constants';

/** Timing overrides for YouTube Shorts recordings (full match ≤ ~55s). */
export const SHORTS_OVERRIDES: Partial<RuntimeConfig> = {
  GAME_LENGTH_MS: 50_000,
  EVENT_DURATION_MS: 10_000,
  /** Warn when ~20s remain on a 50s clock */
  EVENT_WARN_AT_MS: 20_000,
  /** Live when ~15s remain */
  EVENT_START_AT_MS: 15_000,
  EVENT_PULSE_MS: 2_500,
  SUDDEN_DEATH_PHASE_MS: 8_000,
  SUDDEN_DEATH_START_BRACKET: 40,
  NAME_AUCTION_MS: 2_000,
  POOL_REVEAL_MS: 2_000,
  COUNTDOWN_MS: 1_000,
  TILE_TIMER_MS: 4_000,
  PACE_BANNER_MS: 1_200,
  GILDER_MS: 12_000,
  CHRYSALIS_MS: 10_000,
  PRINTER_NOTE_MS: 10_000,
  STOCK_MARKET_MS: 10_000,
  ROI_MS: 12_000,
  BOMB_FUSE_MS: 3_000,
  HANDCUFF_MS: 4_000,
  QUICK_SWAP_MS: 5_000,
  MUTE_MS: 5_000,
  COLD_MARKET_MS: 6_000,
  TIME_FREEZE_MS: 3_500,
  MEGA_FREEZE_MS: 2_500,
};

let shortsActive = false;
/** Recorder drives the clock (no wall-clock intervals) for smooth frames. */
let stepRecordActive = false;

export function isShortsMode(): boolean {
  return shortsActive;
}

export function isStepRecordMode(): boolean {
  return stepRecordActive;
}

/** Toggle step vs wall-clock drive without resetting shorts CONFIG. */
export function setStepRecordMode(on: boolean): void {
  stepRecordActive = on;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('shorts-step', on);
  }
}

/** Apply compressed timings. Safe to call once at boot before any match. */
export function applyShortsProfile(opts?: { stepRecord?: boolean }): void {
  shortsActive = true;
  stepRecordActive = opts?.stepRecord === true;
  Object.assign(CONFIG, SHORTS_OVERRIDES);
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('shorts-step', stepRecordActive);
  }
}

export function readShortsQuery(
  search = typeof window !== 'undefined' ? window.location.search : '',
): {
  enabled: boolean;
  mode: 'duel' | 'blitz';
  seed: number | null;
  stepRecord: boolean;
} {
  const params = new URLSearchParams(search);
  const enabled =
    params.get('shorts') === '1' || params.get('shorts') === 'true';
  const modeParam = params.get('mode');
  const mode = modeParam === 'duel' ? 'duel' : 'blitz';
  const seedRaw = params.get('seed');
  const seed =
    seedRaw != null && seedRaw !== '' && Number.isFinite(Number(seedRaw))
      ? Number(seedRaw) >>> 0
      : null;
  const stepRecord =
    params.get('step') === '1' ||
    params.get('step') === 'true' ||
    params.get('record') === 'step';
  return { enabled, mode, seed, stepRecord };
}
