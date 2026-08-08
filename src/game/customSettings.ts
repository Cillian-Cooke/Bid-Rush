import { fullMatchPool } from './items';
import type { ItemId } from './types';

const STORAGE_KEY = 'bid-rush-custom-settings-v1';

export type CustomMatchSettings = {
  /** Enabled item ids (min 1). Empty → treat as full pool. */
  itemIds: ItemId[];
  /** Match clock length */
  gameLengthMs: number;
  /** Multiplies simulation dt (1 = normal) */
  speedMult: number;
  startCoins: number;
  tileTimerMs: number;
};

export const CUSTOM_DEFAULTS: CustomMatchSettings = {
  itemIds: fullMatchPool(),
  gameLengthMs: 180_000,
  speedMult: 1,
  startCoins: 10,
  tileTimerMs: 10_000,
};

export const CUSTOM_PRESETS = {
  gameLengthMs: [
    { label: '1 min', value: 60_000 },
    { label: '2 min', value: 120_000 },
    { label: '3 min', value: 180_000 },
    { label: '5 min', value: 300_000 },
  ],
  speedMult: [
    { label: '0.75×', value: 0.75 },
    { label: '1×', value: 1 },
    { label: '1.5×', value: 1.5 },
    { label: '2×', value: 2 },
  ],
  startCoins: [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '15', value: 15 },
    { label: '25', value: 25 },
  ],
  tileTimerMs: [
    { label: '6s', value: 6_000 },
    { label: '10s', value: 10_000 },
    { label: '14s', value: 14_000 },
  ],
} as const;

export function loadCustomSettings(): CustomMatchSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...CUSTOM_DEFAULTS, itemIds: [...CUSTOM_DEFAULTS.itemIds] };
    const parsed = JSON.parse(raw) as Partial<CustomMatchSettings>;
    const all = fullMatchPool();
    const ids = Array.isArray(parsed.itemIds)
      ? parsed.itemIds.filter((id): id is ItemId => all.includes(id as ItemId))
      : all;
    return {
      itemIds: ids.length > 0 ? ids : all,
      gameLengthMs: clampNum(
        parsed.gameLengthMs,
        60_000,
        300_000,
        CUSTOM_DEFAULTS.gameLengthMs,
      ),
      speedMult: clampNum(parsed.speedMult, 0.5, 3, CUSTOM_DEFAULTS.speedMult),
      startCoins: clampNum(parsed.startCoins, 1, 50, CUSTOM_DEFAULTS.startCoins),
      tileTimerMs: clampNum(
        parsed.tileTimerMs,
        4_000,
        20_000,
        CUSTOM_DEFAULTS.tileTimerMs,
      ),
    };
  } catch {
    return { ...CUSTOM_DEFAULTS, itemIds: [...CUSTOM_DEFAULTS.itemIds] };
  }
}

export function saveCustomSettings(settings: CustomMatchSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

function clampNum(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function resolveCustomPool(settings: CustomMatchSettings): ItemId[] {
  const all = fullMatchPool();
  const picked = settings.itemIds.filter((id) => all.includes(id));
  return (picked.length > 0 ? picked : all).sort((a, b) => a.localeCompare(b));
}
