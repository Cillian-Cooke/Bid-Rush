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

export const COIN_COLORS = {
  critical: [255, 77, 61] as RGB,
  low: [255, 122, 69] as RGB,
  warm: [232, 184, 74] as RGB,
  green: [30, 207, 108] as RGB,
  blue: [47, 127, 255] as RGB,
  violet: [168, 85, 247] as RGB,
  amber: [255, 138, 40] as RGB,
  hot: [255, 96, 40] as RGB,
  whitehot: [255, 236, 200] as RGB,
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
 * Continuous heat curve. Values interpolate smoothly between these beats
 * so climbing never snaps — it drifts into each new era.
 */
const HEAT_KEYS: HeatKey[] = [
  { at: 0, rgb: COIN_COLORS.critical, glow: 0, rainbow: 0, speed: 1, shake: 0.22, stage: 'broke' },
  { at: 3, rgb: COIN_COLORS.critical, glow: 0, rainbow: 0, speed: 1, shake: 0.18, stage: 'broke' },
  { at: 8, rgb: COIN_COLORS.low, glow: 0, rainbow: 0, speed: 1, shake: 0, stage: 'scraping' },
  { at: 50, rgb: COIN_COLORS.warm, glow: 0.05, rainbow: 0, speed: 1, shake: 0, stage: 'warming' },
  { at: 100, rgb: COIN_COLORS.green, glow: 0.85, rainbow: 0, speed: 1, shake: 0, stage: 'mint' },
  { at: 200, rgb: COIN_COLORS.blue, glow: 0.9, rainbow: 0, speed: 1.05, shake: 0, stage: 'azure' },
  { at: 300, rgb: COIN_COLORS.violet, glow: 0.9, rainbow: 0, speed: 1.1, shake: 0, stage: 'violet' },
  { at: 400, rgb: COIN_COLORS.amber, glow: 0.95, rainbow: 0, speed: 1.15, shake: 0.04, stage: 'amber' },
  { at: 500, rgb: COIN_COLORS.amber, glow: 1, rainbow: 0.35, speed: 1.25, shake: 0.1, stage: 'prism dawn' },
  { at: 750, rgb: COIN_COLORS.amber, glow: 1, rainbow: 1, speed: 1.55, shake: 0.18, stage: 'prism' },
  { at: 1000, rgb: COIN_COLORS.hot, glow: 1, rainbow: 1, speed: 1.85, shake: 0.32, stage: 'thousand' },
  { at: 1750, rgb: COIN_COLORS.hot, glow: 1, rainbow: 1, speed: 2.2, shake: 0.45, stage: 'trembling' },
  { at: 2500, rgb: COIN_COLORS.hot, glow: 1, rainbow: 1, speed: 2.65, shake: 0.58, stage: 'blaze' },
  { at: 3750, rgb: COIN_COLORS.hot, glow: 1, rainbow: 1, speed: 3.05, shake: 0.68, stage: 'inferno' },
  { at: 5000, rgb: COIN_COLORS.hot, glow: 1, rainbow: 1, speed: 3.5, shake: 0.78, stage: 'magma' },
  { at: 7500, rgb: COIN_COLORS.hot, glow: 1, rainbow: 1, speed: 4.1, shake: 0.86, stage: 'volcanic' },
  { at: 10000, rgb: COIN_COLORS.whitehot, glow: 1, rainbow: 1, speed: 4.7, shake: 0.92, stage: 'legendary' },
  { at: 12500, rgb: COIN_COLORS.whitehot, glow: 1, rainbow: 1, speed: 5.3, shake: 0.95, stage: 'mythic' },
  { at: 15000, rgb: COIN_COLORS.whitehot, glow: 1, rainbow: 1, speed: 5.9, shake: 0.97, stage: 'apocalypse' },
  { at: 17500, rgb: COIN_COLORS.whitehot, glow: 1, rainbow: 1, speed: 6.8, shake: 0.99, stage: 'ascension' },
  { at: 20000, rgb: COIN_COLORS.whitehot, glow: 1, rainbow: 1, speed: 8, shake: 1, stage: 'godhood' },
];

/** Soft milestones that briefly pulse when crossed / held. */
const AWARD_ATS = [100, 200, 300, 400, 500, 1000, 2500, 5000, 10000, 15000, 20000];

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
 * Purse heat from broke → godhood at 20,000.
 * Every property drifts continuously along the heat curve.
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
  if (tint.shake > 0.08 && tint.shake < 0.2 && tint.rainbowMix < 0.1) {
    parts.push('heat-critical');
  }
  return parts.join(' ');
}
