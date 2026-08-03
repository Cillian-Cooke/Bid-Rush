import { CONFIG } from './constants';
import { createInitialState, createRng, tick } from './engine';
import { decideBotAction, nextBotCooldown } from './bots';
import { bid, sellItem, applyUseItem, reorderHand } from './engine';
import { applyShortsProfile } from './shortsProfile';
import type { GameMode, GameState } from './types';

export type SimScore = {
  seed: number;
  score: number;
  ended: boolean;
  suddenDeath: boolean;
  eliminations: number;
  events: number;
  bids: number;
  durationMs: number;
};

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
  let prevLive = state.worldEvent.live.length;
  const maxTicks = Math.ceil((CONFIG.GAME_LENGTH_MS + 90_000) / CONFIG.TICK_MS);

  for (let i = 0; i < maxTicks; i++) {
    state = applyBots(state, rng);
    state = tick(state, CONFIG.TICK_MS, rng);

    const alive = state.players.filter((p) => p.isAlive).length;
    if (alive < prevAlive) eliminations += prevAlive - alive;
    prevAlive = alive;

    if (state.worldEvent.live.length > prevLive) {
      events += state.worldEvent.live.length - prevLive;
    }
    prevLive = state.worldEvent.live.length;

    for (const e of state.events) {
      if (e.type === 'resolve') bids += 1;
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

  // Prefer sudden death / close finishes, knockouts, events, and enough runtime
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
    (durationMs < 20_000 ? -40 : 0);

  return {
    seed,
    score,
    ended: state.ended,
    suddenDeath: state.suddenDeath.active,
    eliminations,
    events,
    bids,
    durationMs,
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
