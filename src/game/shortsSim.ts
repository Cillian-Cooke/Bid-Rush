import { CONFIG } from './constants';
import { createInitialState, createRng, tick } from './engine';
import { decideBotAction, nextBotCooldown } from './bots';
import { bid, sellItem, applyUseItem, reorderHand } from './engine';
import { applyShortsProfile } from './shortsProfile';
import type { GameMode, GameState, WorldEventId } from './types';

export type ClipReason =
  | WorldEventId
  | 'bomb_ko'
  | 'sudden_death'
  | 'elimination'
  | 'quick_swap'
  | 'photo_finish'
  | 'chaos';

export type HighlightClip = {
  startMs: number;
  endMs: number;
  reason: ClipReason;
  weight: number;
};

export type SimScore = {
  seed: number;
  score: number;
  ended: boolean;
  suddenDeath: boolean;
  eliminations: number;
  events: number;
  bids: number;
  durationMs: number;
  /** Peak windows in match elapsedMs (playing phase). */
  clips: HighlightClip[];
  /** Punchy hook line from the strongest clip. */
  hook: string;
};

const PAD_BEFORE_MS = 1_400;
const PAD_AFTER_MS = 2_600;
const CLIP_MIN_MS = 4_000;
const CLIP_MAX_MS = 8_000;
const MAX_CLIPS = 5;
const MAX_CAPTURE_MS = 28_000;

const EVENT_WEIGHT: Partial<Record<WorldEventId, number>> = {
  bomb_bazaar: 34,
  golden_chaos: 36,
  shuffle_storm: 28,
  fire_sale: 26,
  turbo_market: 22,
  mystery_mall: 20,
  inflation_wave: 18,
  deep_freeze: 16,
  coin_shower: 15,
  money_money_money: 15,
  tax_collector: 14,
};

export function hookLineForReason(reason: ClipReason): string {
  switch (reason) {
    case 'bomb_bazaar':
      return 'BOMB BAZAAR';
    case 'golden_chaos':
      return 'GOLDEN CHAOS';
    case 'shuffle_storm':
      return 'SHUFFLE STORM';
    case 'fire_sale':
      return 'FIRE SALE';
    case 'turbo_market':
      return 'TURBO MARKET';
    case 'sudden_death':
      return 'SUDDEN DEATH';
    case 'bomb_ko':
      return 'BOOM';
    case 'quick_swap':
      return 'QUICK SWAP';
    case 'photo_finish':
      return 'PHOTO FINISH';
    case 'elimination':
      return 'KNOCKOUT';
    case 'mystery_mall':
      return 'MYSTERY MALL';
    case 'inflation_wave':
      return 'INFLATION';
    case 'deep_freeze':
      return 'DEEP FREEZE';
    case 'coin_shower':
      return 'COIN SHOWER';
    case 'money_money_money':
      return 'MONEY MONEY MONEY';
    case 'tax_collector':
      return 'TAX COLLECTOR';
    default:
      return 'BID RUSH';
  }
}

function applyBots(state: GameState, rng: () => number): GameState {
  let next = state;
  for (const player of next.players) {
    if (!player.isAlive) continue;
    const p = next.players.find((x) => x.id === player.id)!;
    if (p.botCooldownMs > 0) continue;
    if (p.handcuffMs > 0) {
      const arch = p.archetype ?? 'ruthless';
      next = {
        ...next,
        players: next.players.map((x) =>
          x.id === p.id
            ? { ...x, botCooldownMs: nextBotCooldown(arch, rng) }
            : x,
        ),
      };
      continue;
    }
    const intent = decideBotAction(next, p.id, rng);
    const arch = p.archetype ?? 'ruthless';
    const cooldown = nextBotCooldown(arch, rng);
    if (intent?.kind === 'bid') {
      next = bid(next, p.id, intent.tileIndex);
    } else if (intent?.kind === 'sell') {
      next = sellItem(next, p.id, intent.instanceId, rng);
    } else if (intent?.kind === 'use') {
      next = applyUseItem(next, p.id, intent.instanceId, intent.targets, rng);
    } else if (intent?.kind === 'reorder') {
      next = reorderHand(next, p.id, intent.fromIndex, intent.toIndex);
    }
    next = {
      ...next,
      players: next.players.map((x) =>
        x.id === p.id ? { ...x, botCooldownMs: cooldown } : x,
      ),
    };
  }
  return next;
}

type RawPeak = {
  atMs: number;
  reason: ClipReason;
  weight: number;
};

function pushPeak(peaks: RawPeak[], atMs: number, reason: ClipReason, weight: number) {
  // Dedupe near-identical peaks
  const near = peaks.find(
    (p) => p.reason === reason && Math.abs(p.atMs - atMs) < 1_200,
  );
  if (near) {
    near.weight = Math.max(near.weight, weight);
    near.atMs = Math.min(near.atMs, atMs);
    return;
  }
  peaks.push({ atMs, reason, weight });
}

function buildClips(peaks: RawPeak[], durationMs: number): HighlightClip[] {
  if (peaks.length === 0) {
    const mid = Math.max(0, durationMs - 6_000);
    return [
      {
        startMs: mid,
        endMs: Math.min(durationMs, mid + 6_000),
        reason: 'chaos',
        weight: 1,
      },
    ];
  }

  const ranked = [...peaks].sort((a, b) => b.weight - a.weight);
  const chosen: HighlightClip[] = [];
  let budget = 0;

  for (const peak of ranked) {
    if (chosen.length >= MAX_CLIPS || budget >= MAX_CAPTURE_MS) break;
    let start = Math.max(0, peak.atMs - PAD_BEFORE_MS);
    let end = Math.min(durationMs, peak.atMs + PAD_AFTER_MS);
    if (end - start < CLIP_MIN_MS) {
      end = Math.min(durationMs, start + CLIP_MIN_MS);
      start = Math.max(0, end - CLIP_MIN_MS);
    }
    if (end - start > CLIP_MAX_MS) {
      end = start + CLIP_MAX_MS;
    }

    // Merge if overlaps an existing clip heavily
    const overlap = chosen.find(
      (c) => !(end < c.startMs - 400 || start > c.endMs + 400),
    );
    if (overlap) {
      overlap.startMs = Math.min(overlap.startMs, start);
      overlap.endMs = Math.min(durationMs, Math.max(overlap.endMs, end));
      if (peak.weight > overlap.weight) {
        overlap.reason = peak.reason;
        overlap.weight = peak.weight;
      }
      continue;
    }

    const len = end - start;
    if (budget + len > MAX_CAPTURE_MS && chosen.length > 0) continue;
    chosen.push({ startMs: start, endMs: end, reason: peak.reason, weight: peak.weight });
    budget += len;
  }

  return chosen.sort((a, b) => a.startMs - b.startMs);
}

function highlightDensityScore(clips: HighlightClip[], peaks: RawPeak[]): number {
  const peakScore = peaks.reduce((s, p) => s + p.weight, 0);
  const spreadBonus =
    clips.length >= 2
      ? Math.min(
          24,
          clips.slice(1).reduce((s, c, i) => {
            const prev = clips[i]!;
            return s + Math.min(12, (c.startMs - prev.endMs) / 800);
          }, 0),
        )
      : 0;
  return peakScore * 0.45 + clips.length * 10 + spreadBonus;
}

/**
 * Headless shorts-profile match. Human seat keeps isHuman for UI, but is
 * assigned a ruthless archetype and driven by bot AI.
 */
export function simulateShortsMatch(
  mode: GameMode,
  seed: number,
): SimScore {
  applyShortsProfile();
  const rng = createRng(seed);
  let state = createInitialState(
    {
      mode,
      difficulty: 'ruthless',
      identities: undefined,
    },
    seed,
  );

  state = {
    ...state,
    players: state.players.map((p) =>
      p.isHuman
        ? {
            ...p,
            archetype: 'ruthless',
            botCooldownMs: 100 + Math.floor(rng() * 200),
          }
        : p,
    ),
  };

  let eliminations = 0;
  let events = 0;
  let bids = 0;
  let prevAlive = state.players.filter((p) => p.isAlive).length;
  let prevLiveIds = new Set(state.worldEvent.live.map((e) => e.id));
  let prevPendingSwaps = state.pendingQuickSwaps.length;
  let sawSuddenDeath = false;
  const peaks: RawPeak[] = [];
  const maxTicks = Math.ceil((CONFIG.GAME_LENGTH_MS + 90_000) / CONFIG.TICK_MS);

  for (let i = 0; i < maxTicks; i++) {
    state = applyBots(state, rng);
    state = tick(state, CONFIG.TICK_MS, rng);
    const t = state.elapsedMs;

    const alive = state.players.filter((p) => p.isAlive).length;
    if (alive < prevAlive) {
      const n = prevAlive - alive;
      eliminations += n;
    }
    prevAlive = alive;

    if (state.suddenDeath.active && !sawSuddenDeath) {
      sawSuddenDeath = true;
      pushPeak(peaks, t, 'sudden_death', 40);
    }

    const liveIds = new Set(state.worldEvent.live.map((e) => e.id));
    for (const id of liveIds) {
      if (!prevLiveIds.has(id)) {
        events += 1;
        pushPeak(peaks, t, id, EVENT_WEIGHT[id] ?? 16);
      }
    }
    prevLiveIds = liveIds;

    if (
      state.pendingQuickSwaps.length < prevPendingSwaps &&
      prevPendingSwaps > 0
    ) {
      pushPeak(peaks, t, 'quick_swap', 30);
    }
    prevPendingSwaps = state.pendingQuickSwaps.length;

    for (const e of state.events) {
      if (e.type === 'resolve') bids += 1;
      if (e.type === 'eliminate') {
        if (e.reason === 'bomb') pushPeak(peaks, t, 'bomb_ko', 38);
        else if (e.reason === 'bracket') pushPeak(peaks, t, 'sudden_death', 36);
        else pushPeak(peaks, t, 'elimination', 24);
      }
      if (e.type === 'explosion') pushPeak(peaks, t, 'bomb_ko', 32);
      if (e.type === 'fx' && e.kind === 'quick_swap' && e.label === 'SWAP') {
        pushPeak(peaks, t, 'quick_swap', 28);
      }
    }
    state = { ...state, events: [] };

    if (state.ended) break;
  }

  const durationMs = Math.max(0, state.elapsedMs);

  const coinSpread = (() => {
    const coins = state.players.filter((p) => p.isAlive).map((p) => p.coins);
    if (coins.length < 2) return 0;
    return Math.max(...coins) - Math.min(...coins);
  })();

  if (coinSpread > 0 && coinSpread < 25 && durationMs > 12_000) {
    pushPeak(peaks, Math.max(0, durationMs - 5_000), 'photo_finish', 22);
  }

  const clips = buildClips(peaks, durationMs);
  const density = highlightDensityScore(clips, peaks);

  // Prefer sudden death / close finishes, knockouts, events, highlight density
  const score =
    (state.suddenDeath.active ||
    state.suddenDeath.bracket < CONFIG.SUDDEN_DEATH_START_BRACKET
      ? 40
      : 0) +
    eliminations * 18 +
    events * 22 +
    Math.min(30, bids * 0.35) +
    (state.ended ? 15 : 0) +
    (coinSpread > 0 && coinSpread < 25 ? 20 : 0) +
    (coinSpread >= 25 && coinSpread < 60 ? 8 : 0) +
    Math.min(35, durationMs / 1500) +
    (durationMs < 20_000 ? -40 : 0) +
    density;

  const top = [...clips].sort((a, b) => b.weight - a.weight)[0];
  const hook = hookLineForReason(top?.reason ?? 'chaos');

  return {
    seed,
    score,
    ended: state.ended,
    suddenDeath: state.suddenDeath.active,
    eliminations,
    events,
    bids,
    durationMs,
    clips,
    hook,
  };
}

export function pickExcitingSeed(
  mode: GameMode,
  attempts = 12,
  baseSeed?: number,
): SimScore {
  applyShortsProfile();
  const start =
    baseSeed != null
      ? baseSeed >>> 0
      : (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  let best: SimScore | null = null;
  for (let i = 0; i < attempts; i++) {
    const seed = (start + i * 9973) >>> 0;
    const result = simulateShortsMatch(mode, seed);
    if (!best || result.score > best.score) best = result;
  }
  return best!;
}
