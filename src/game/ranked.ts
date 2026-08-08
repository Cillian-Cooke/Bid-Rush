import type { BotArchetype, DifficultyMode, ItemId, WorldEventId } from './types';
import { ITEM_LIST } from './items';

const PROGRESS_KEY = 'bid-rush-ranked-progress-v2';
const HISTORY_KEY = 'bid-rush-ranked-history-v2';
const MAX_HISTORY = 20;
const RP_PER_RANK = 100;

/** Stable unlock order: first 16 = rank 1 pool, then +4 per rank. */
export const RANKED_ITEM_ORDER: ItemId[] = (() => {
  const spawnable = ITEM_LIST.filter((i) => i.spawnWeight > 0).map((i) => i.id);
  // Prefer a readable fixed order: money engines first, then utility, then chaos
  const preferred: ItemId[] = [
    'coin_mine',
    'money_printer',
    'golden_goose',
    'bank_note',
    'piggy_bank',
    'stock_market',
    'interest',
    'tip_jar',
    'broker',
    'ipo',
    'chrysalis',
    'mystery_box',
    'price_doubler',
    'gilder',
    'mirror',
    'haste_gear',
    // +4 rank 2
    'shop_refresh',
    'fast_forward',
    'time_freeze',
    'bargain',
    // +4 rank 3
    'inflation',
    'magnet',
    'kickback',
    'quick_swap',
    // +4 rank 4
    'swap_portal',
    'handcuffs',
    'mute',
    'bid_lock',
    // +4 rank 5
    'pickpocket',
    'heist_kit',
    'chaos_die',
    'roi',
    // remainder if any
    'coin_leech',
    'curse_idol',
    'bomb',
    'dynamite',
  ];
  const seen = new Set<ItemId>();
  const ordered: ItemId[] = [];
  for (const id of preferred) {
    if (spawnable.includes(id) && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  for (const id of spawnable) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
})();

/** Floor-event unlock order (excludes golden_chaos — Chaos Die only). */
export const RANKED_EVENT_ORDER: WorldEventId[] = [
  'money_money_money',
  'coin_shower',
  'fire_sale',
  'deep_freeze',
  'turbo_market',
  'tax_collector',
  'shuffle_storm',
  'inflation_wave',
  'bomb_bazaar',
  'mystery_mall',
];

export type RankId = 1 | 2 | 3 | 4 | 5;

export type RankDef = {
  id: RankId;
  name: string;
  blurb: string;
  /** Unlock catalog size (match still picks 16 from this set) */
  poolSize: number;
  /** World-event unlock catalog size (scheduled events pick from this set) */
  eventPoolSize: number;
  /** RP gained on win */
  winRp: number;
  /** RP lost on defeat (positive number) */
  lossRp: number;
  /** Bot archetype encounter weights (sum ≈ 1) */
  botWeights: Record<BotArchetype, number>;
};

/** Five ranks — higher tiers: smaller wins, harsher losses, tougher bots, bigger pools. */
export const RANKED_RANKS: readonly RankDef[] = [
  {
    id: 1,
    name: 'Bronze',
    blurb: '16 items · 4 events',
    poolSize: 16,
    eventPoolSize: 4,
    winRp: 28,
    lossRp: 8,
    botWeights: { chill: 0.7, balanced: 0.25, ruthless: 0.05 },
  },
  {
    id: 2,
    name: 'Silver',
    blurb: '20 items · 6 events',
    poolSize: 20,
    eventPoolSize: 6,
    winRp: 22,
    lossRp: 12,
    botWeights: { chill: 0.45, balanced: 0.4, ruthless: 0.15 },
  },
  {
    id: 3,
    name: 'Gold',
    blurb: '24 items · 8 events',
    poolSize: 24,
    eventPoolSize: 8,
    winRp: 16,
    lossRp: 18,
    botWeights: { chill: 0.25, balanced: 0.45, ruthless: 0.3 },
  },
  {
    id: 4,
    name: 'Platinum',
    blurb: '28 items · 9 events',
    poolSize: 28,
    eventPoolSize: 9,
    winRp: 12,
    lossRp: 22,
    botWeights: { chill: 0.1, balanced: 0.4, ruthless: 0.5 },
  },
  {
    id: 5,
    name: 'Diamond',
    blurb: '32 items · 10 events',
    poolSize: 32,
    eventPoolSize: 10,
    winRp: 8,
    lossRp: 28,
    botWeights: { chill: 0.05, balanced: 0.25, ruthless: 0.7 },
  },
] as const;

export type RankProgress = {
  /** 0 = Bronze … 4 = Diamond */
  rankIndex: number;
  /** 0–100 within the current rank */
  rp: number;
};

export type RankedHistoryEntry = {
  id: string;
  name: string;
  avatar: string;
  coins: number;
  won: boolean;
  rankId: RankId;
  at: number;
};

export function getRankDef(rankIndex: number): RankDef {
  return RANKED_RANKS[Math.max(0, Math.min(RANKED_RANKS.length - 1, rankIndex))]!;
}

export function loadRankProgress(): RankProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { rankIndex: 0, rp: 0 };
    const parsed = JSON.parse(raw) as Partial<RankProgress>;
    const rankIndex = Math.max(
      0,
      Math.min(RANKED_RANKS.length - 1, Math.floor(Number(parsed.rankIndex) || 0)),
    );
    const rp = Math.max(0, Math.min(RP_PER_RANK, Math.floor(Number(parsed.rp) || 0)));
    return { rankIndex, rp };
  } catch {
    return { rankIndex: 0, rp: 0 };
  }
}

export function saveRankProgress(progress: RankProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export type RankMatchResult = {
  progress: RankProgress;
  delta: number;
  promoted: boolean;
  demoted: boolean;
  prevRankIndex: number;
};

/** Apply win/loss. Higher ranks: gain less, lose more. */
export function applyRankedMatchResult(won: boolean): RankMatchResult {
  const prev = loadRankProgress();
  const prevRankIndex = prev.rankIndex;
  const def = getRankDef(prev.rankIndex);
  let rankIndex = prev.rankIndex;
  let rp = prev.rp + (won ? def.winRp : -def.lossRp);
  let promoted = false;
  let demoted = false;

  while (rp >= RP_PER_RANK && rankIndex < RANKED_RANKS.length - 1) {
    rankIndex += 1;
    rp -= RP_PER_RANK;
    promoted = true;
  }
  while (rp < 0 && rankIndex > 0) {
    rankIndex -= 1;
    rp += RP_PER_RANK;
    demoted = true;
  }
  if (rankIndex === 0) rp = Math.max(0, rp);
  if (rankIndex === RANKED_RANKS.length - 1) {
    rp = Math.max(0, Math.min(RP_PER_RANK, rp));
  }

  const progress: RankProgress = { rankIndex, rp };
  saveRankProgress(progress);
  const delta = won ? def.winRp : -def.lossRp;
  return { progress, delta, promoted, demoted, prevRankIndex };
}

/** Unlock catalog at this rank (cumulative). Match pools sample 16 from this. */
export function rankedPoolForRank(rankIndex: number): ItemId[] {
  const size = getRankDef(rankIndex).poolSize;
  return RANKED_ITEM_ORDER.slice(0, Math.min(size, RANKED_ITEM_ORDER.length));
}

/** Rank id (1–5) that first unlocks this item, or null if not in ranked order. */
export function rankedUnlockRank(itemId: ItemId): RankId | null {
  const idx = RANKED_ITEM_ORDER.indexOf(itemId);
  if (idx < 0) return null;
  for (let r = 0; r < RANKED_RANKS.length; r++) {
    if (idx < RANKED_RANKS[r]!.poolSize) return RANKED_RANKS[r]!.id;
  }
  return RANKED_RANKS[RANKED_RANKS.length - 1]!.id;
}

/** Items newly added when reaching this rank (not in the previous pool). */
export function rankedNewItemsAtRank(rankIndex: number): ItemId[] {
  const cur = rankedPoolForRank(rankIndex);
  if (rankIndex <= 0) return cur;
  const prev = new Set(rankedPoolForRank(rankIndex - 1));
  return cur.filter((id) => !prev.has(id));
}

/** Event unlock catalog at this rank (cumulative). */
export function rankedEventPoolForRank(rankIndex: number): WorldEventId[] {
  const size = getRankDef(rankIndex).eventPoolSize;
  return RANKED_EVENT_ORDER.slice(0, Math.min(size, RANKED_EVENT_ORDER.length));
}

/** Rank id that first unlocks this event, or null if not ranked. */
export function rankedEventUnlockRank(eventId: WorldEventId): RankId | null {
  if (eventId === 'golden_chaos') return 5;
  const idx = RANKED_EVENT_ORDER.indexOf(eventId);
  if (idx < 0) return null;
  for (let r = 0; r < RANKED_RANKS.length; r++) {
    if (idx < RANKED_RANKS[r]!.eventPoolSize) return RANKED_RANKS[r]!.id;
  }
  return RANKED_RANKS[RANKED_RANKS.length - 1]!.id;
}

export function rankedNewEventsAtRank(rankIndex: number): WorldEventId[] {
  const cur = rankedEventPoolForRank(rankIndex);
  if (rankIndex <= 0) return cur;
  const prev = new Set(rankedEventPoolForRank(rankIndex - 1));
  return cur.filter((id) => !prev.has(id));
}

export function rollRankedBotDifficulty(
  rankIndex: number,
  rng: () => number = Math.random,
): DifficultyMode {
  const w = getRankDef(rankIndex).botWeights;
  const roll = rng();
  if (roll < w.chill) return 'chill';
  if (roll < w.chill + w.balanced) return 'balanced';
  return 'ruthless';
}

export function botWeightPercents(rankIndex: number): Record<BotArchetype, number> {
  const w = getRankDef(rankIndex).botWeights;
  return {
    chill: Math.round(w.chill * 100),
    balanced: Math.round(w.balanced * 100),
    ruthless: Math.round(w.ruthless * 100),
  };
}

export function loadRankedHistory(): RankedHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e === 'object' && typeof (e as RankedHistoryEntry).coins === 'number')
      .map((e) => e as RankedHistoryEntry)
      .sort((a, b) => b.coins - a.coins)
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export function recordRankedHistory(input: {
  name: string;
  avatar: string;
  coins: number;
  won: boolean;
  rankId: RankId;
}): RankedHistoryEntry[] {
  const entry: RankedHistoryEntry = {
    id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.slice(0, 24) || 'You',
    avatar: input.avatar || '😎',
    coins: Math.max(0, Math.floor(input.coins)),
    won: input.won,
    rankId: input.rankId,
    at: Date.now(),
  };
  const next = [entry, ...loadRankedHistory()]
    .sort((a, b) => {
      if (b.coins !== a.coins) return b.coins - a.coins;
      return b.at - a.at;
    })
    .slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
