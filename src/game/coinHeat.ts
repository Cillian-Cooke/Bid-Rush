export type RGB = readonly [number, number, number];

export type CoinTint = {
  mode: 'solid' | 'blend' | 'rainbow';
  rgb: RGB;
  glow: number;
  /** 0 = calm, 1 = godhood shake */
  shake: number;
  /** Exact milestone proximity 0–1 for a brief award pulse */
  award: number;
  /** Rainbow scroll speed multiplier (1 = base) */
  rainbowSpeed: number;
  /** 0 = solid color, 1 = full rainbow text */
  rainbowMix: number;
  /** Optional stage label for a11y / debug */
  stage: string;
};

/** Rank-aligned purse colors (+ danger red for broke). */
export const COIN_COLORS = {
  critical: [214, 69, 58] as RGB,
  low: [232, 120, 72] as RGB,
  bronze: [183, 115, 58] as RGB,
  bronzeBright: [212, 148, 72] as RGB,
  gold: [240, 192, 64] as RGB,
  goldBright: [255, 220, 110] as RGB,
} as const;

type HeatKey = {
  at: number;
  rgb: RGB;
  glow: number;
  /** 0 solid → 1 full rainbow */
  rainbow: number;
  speed: number;
  /** 0 calm → 1 max chaos */
  shake: number;
  stage: string;
};

/**
 * Rank-flavored heat:
 *   red (broke) → bronze (&lt;1k) → gold (1k–1M) → rainbow (1M+)
 */
const HEAT_KEYS: HeatKey[] = [
  { at: 0, rgb: COIN_COLORS.critical, glow: 0, rainbow: 0, speed: 1, shake: 0.2, stage: 'broke' },
  { at: 5, rgb: COIN_COLORS.critical, glow: 0, rainbow: 0, speed: 1, shake: 0.12, stage: 'broke' },
  { at: 12, rgb: COIN_COLORS.low, glow: 0, rainbow: 0, speed: 1, shake: 0, stage: 'scraping' },
  { at: 25, rgb: COIN_COLORS.bronze, glow: 0.08, rainbow: 0, speed: 1, shake: 0, stage: 'bronze' },
  { at: 200, rgb: COIN_COLORS.bronzeBright, glow: 0.2, rainbow: 0, speed: 1, shake: 0, stage: 'bronze' },
  { at: 999, rgb: COIN_COLORS.bronzeBright, glow: 0.35, rainbow: 0, speed: 1, shake: 0, stage: 'bronze' },
  { at: 1_000, rgb: COIN_COLORS.gold, glow: 0.55, rainbow: 0, speed: 1, shake: 0, stage: 'gold' },
  { at: 50_000, rgb: COIN_COLORS.goldBright, glow: 0.75, rainbow: 0, speed: 1.05, shake: 0.02, stage: 'gold' },
  { at: 500_000, rgb: COIN_COLORS.goldBright, glow: 0.9, rainbow: 0.08, speed: 1.1, shake: 0.04, stage: 'gold' },
  { at: 999_999, rgb: COIN_COLORS.goldBright, glow: 0.95, rainbow: 0.2, speed: 1.2, shake: 0.06, stage: 'gold peak' },
  { at: 1_000_000, rgb: COIN_COLORS.goldBright, glow: 1, rainbow: 1, speed: 1.6, shake: 0.12, stage: 'rainbow' },
  { at: 10_000_000, rgb: COIN_COLORS.goldBright, glow: 1, rainbow: 1, speed: 2.1, shake: 0.22, stage: 'rainbow' },
  { at: 100_000_000, rgb: COIN_COLORS.goldBright, glow: 1, rainbow: 1, speed: 2.8, shake: 0.35, stage: 'mythic' },
  { at: 1_000_000_000, rgb: COIN_COLORS.goldBright, glow: 1, rainbow: 1, speed: 3.4, shake: 0.48, stage: 'godhood' },
];

/** Soft milestones that briefly pulse when crossed / held. */
const AWARD_ATS = [100, 500, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  const u = Math.max(0, Math.min(1, t));
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
}

/** Smoothstep — ease both ends so bands melt into each other. */
function smoothstep(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

function awardProximity(n: number): number {
  let best = 0;
  for (const at of AWARD_ATS) {
    const window = Math.max(8, at * 0.02);
    const d = Math.abs(n - at);
    if (d <= window) {
      best = Math.max(best, 1 - d / window);
    }
  }
  return best * best;
}

function sampleHeat(n: number): HeatKey & { t: number } {
  const keys = HEAT_KEYS;
  if (n <= keys[0]!.at) return { ...keys[0]!, t: 0 };
  const last = keys[keys.length - 1]!;
  if (n >= last.at) return { ...last, t: 1 };

  let i = 0;
  while (i < keys.length - 1 && keys[i + 1]!.at < n) i += 1;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const t = smoothstep((n - a.at) / (b.at - a.at));
  return {
    at: n,
    rgb: lerpRgb(a.rgb, b.rgb, t),
    glow: lerp(a.glow, b.glow, t),
    rainbow: lerp(a.rainbow, b.rainbow, t),
    speed: lerp(a.speed, b.speed, t),
    shake: lerp(a.shake, b.shake, t),
    stage: t < 0.5 ? a.stage : b.stage,
    t,
  };
}

/**
 * Purse heat: red → bronze (&lt;1k) → gold (1k–1M) → rainbow (1M+).
 */
export function coinTint(coins: number): CoinTint {
  const n = Math.max(0, coins);
  const s = sampleHeat(n);
  const rainbowMix = s.rainbow;
  const mode: CoinTint['mode'] =
    rainbowMix <= 0.04 ? 'solid' : rainbowMix >= 0.96 ? 'rainbow' : 'blend';

  return {
    mode,
    rgb: s.rgb,
    glow: s.glow,
    shake: s.shake,
    award: awardProximity(n),
    rainbowSpeed: s.speed,
    rainbowMix,
    stage: s.stage,
  };
}

export function heatClassName(tint: CoinTint): string {
  const parts: string[] = ['heat-live'];
  if (tint.rainbowMix > 0.04) parts.push('heat-rainbow');
  if (tint.award > 0.55) parts.push('heat-award');
  if (tint.shake > 0.05) parts.push('heat-shaking');
  if (tint.shake > 0.08 && tint.shake < 0.25 && tint.rainbowMix < 0.1) {
    parts.push('heat-critical');
  }
  return parts.join(' ');
}
