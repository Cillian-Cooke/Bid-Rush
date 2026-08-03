import {
  CONFIG,
  HANDLE_POOL,
  MODE_SETUP,
  PLAYER_COLORS,
  type GameMode,
} from './constants';
import { createRng } from './rng';
import { isShortsMode } from './shortsProfile';
import type {
  BotArchetype,
  DifficultyMode,
  NameAuctionState,
  NameTag,
  PlayerIdentity,
} from './types';

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function assignArchetypes(
  botCount: number,
  difficulty: DifficultyMode,
  rng: () => number,
): BotArchetype[] {
  if (difficulty !== 'mixed') {
    return Array.from({ length: botCount }, () => difficulty);
  }
  const pool: BotArchetype[] = ['chill', 'balanced', 'ruthless'];
  return Array.from({ length: botCount }, () => pool[Math.floor(rng() * pool.length)]!);
}

export function createNameAuction(
  mode: GameMode,
  difficulty: DifficultyMode,
  seed?: number,
): NameAuctionState {
  const actualSeed = seed ?? (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  const rng = createRng(actualSeed);
  const setup = MODE_SETUP[mode];
  const tagCount = setup.gridSize;
  const handles = shuffle(HANDLE_POOL, rng).slice(0, tagCount);

  const tags: NameTag[] = handles.map((h, i) => ({
    id: `tag_${i}`,
    name: h.name,
    avatar: h.avatar,
    price: 0,
    highBidderId: null,
  }));

  const humanId = 'bidder_0';
  const participants = Array.from({ length: setup.players }, (_, i) => ({
    id: `bidder_${i}`,
    isHuman: i === 0,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length]!,
    cooldownMs: i === 0 ? 0 : 150 + Math.floor(rng() * 400),
  }));

  return {
    mode,
    difficulty,
    tags,
    participants,
    humanId,
    msLeft: CONFIG.NAME_AUCTION_MS,
    seed: actualSeed,
  };
}

/** Tap a tag to bid. At most MAX_ACTIVE_BIDS concurrent leads (like the shop). */
export function bidOnNameTag(
  state: NameAuctionState,
  bidderId: string,
  tagId: string,
): NameAuctionState {
  const tags = state.tags.map((t) => ({ ...t }));
  const tag = tags.find((t) => t.id === tagId);
  if (!tag) return state;
  if (tag.highBidderId === bidderId) return state;

  const leading = tags.filter((t) => t.highBidderId === bidderId).length;
  if (leading >= CONFIG.MAX_ACTIVE_BIDS) return state;

  tag.price += 1;
  tag.highBidderId = bidderId;
  return { ...state, tags };
}

export function tickNameAuction(
  state: NameAuctionState,
  dtMs: number,
  rng: () => number = Math.random,
): NameAuctionState {
  let next: NameAuctionState = {
    ...state,
    msLeft: Math.max(0, state.msLeft - dtMs),
    participants: state.participants.map((p) => ({
      ...p,
      cooldownMs: Math.max(0, p.cooldownMs - dtMs),
    })),
    tags: state.tags.map((t) => ({ ...t })),
  };

  if (next.msLeft <= 0) return next;

  // Bots scramble for tags (Shorts: human seat bids too)
  const shorts = isShortsMode();
  for (const p of next.participants) {
    if ((p.isHuman && !shorts) || p.cooldownMs > 0) continue;

    const leading = next.tags.filter((t) => t.highBidderId === p.id).length;
    if (leading >= CONFIG.MAX_ACTIVE_BIDS) {
      p.cooldownMs = 400 + rng() * 400;
      continue;
    }

    // Prefer grabbing something if empty-handed
    const open = next.tags.filter((t) => t.highBidderId !== p.id);
    if (open.length === 0) {
      p.cooldownMs = 300 + rng() * 400;
      continue;
    }

    let pick = open[Math.floor(rng() * open.length)]!;
    if (leading === 0) {
      // Grab cheapest unclaimed first
      const unclaimed = open.filter((t) => t.highBidderId === null);
      if (unclaimed.length) {
        pick = unclaimed.sort((a, b) => a.price - b.price)[0]!;
      }
    } else if (rng() > 0.55) {
      // Already have a claim — sometimes fight for a cooler one
      p.cooldownMs = 400 + rng() * 500;
      continue;
    }

    next = bidOnNameTag(next, p.id, pick.id);
    // refresh participant cooldown on the new state
    next = {
      ...next,
      participants: next.participants.map((x) =>
        x.id === p.id ? { ...x, cooldownMs: 280 + rng() * 520 } : x,
      ),
    };
  }

  return next;
}

/** Resolve Tag Sale into ordered identities (human first). */
export function resolveNameAuction(state: NameAuctionState): PlayerIdentity[] {
  const rng = createRng(state.seed ^ 0x9e3779b9);
  const setup = MODE_SETUP[state.mode];
  const archetypes = assignArchetypes(setup.botCount, state.difficulty, rng);

  const claimed = new Map<string, NameTag>();
  const takenTagIds = new Set<string>();

  for (const tag of state.tags) {
    if (tag.highBidderId && !claimed.has(tag.highBidderId)) {
      claimed.set(tag.highBidderId, tag);
      takenTagIds.add(tag.id);
    }
  }

  const leftovers = shuffle(
    state.tags.filter((t) => !takenTagIds.has(t.id)),
    rng,
  );

  const identities: PlayerIdentity[] = [];
  let botArchIdx = 0;

  for (const p of state.participants) {
    let tag = claimed.get(p.id);
    if (!tag) {
      tag = leftovers.shift();
    }
    if (!tag) {
      // Absolute fallback
      tag = {
        id: 'fallback',
        name: p.isHuman ? 'You' : `Bidder ${p.id}`,
        avatar: '❓',
        price: 0,
        highBidderId: null,
      };
    }

    identities.push({
      name: tag.name,
      avatar: tag.avatar,
      color: p.color,
      isHuman: p.isHuman,
      archetype: p.isHuman ? null : archetypes[botArchIdx++] ?? 'balanced',
    });
  }

  // Ensure human is index 0
  const humanIdx = identities.findIndex((i) => i.isHuman);
  if (humanIdx > 0) {
    const [h] = identities.splice(humanIdx, 1);
    identities.unshift(h!);
  }

  return identities;
}
