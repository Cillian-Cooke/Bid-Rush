import { CONFIG } from './constants';
import { weightedRandomItem } from './items';
import type {
  FxKind,
  GameState,
  ItemId,
  LiveWorldEvent,
  WorldEventDef,
  WorldEventId,
} from './types';

/** Max concurrent floor events (scheduled + Chaos Die stacks). */
const MAX_LIVE_EVENTS = 4;

let liveKeySeq = 0;

const MONEY_IDS: ItemId[] = [
  'coin_mine',
  'money_printer',
  'golden_goose',
  'stock_market',
  'piggy_bank',
  'coin_leech',
];

function inPool(state: GameState, id: ItemId): boolean {
  return state.itemPool.includes(id);
}

function pickFromPool(
  state: GameState,
  preferred: ItemId | ItemId[],
  rng: () => number,
): ItemId {
  if (Array.isArray(preferred)) {
    const avail = preferred.filter((id) => inPool(state, id));
    if (avail.length > 0) {
      return avail[Math.floor(rng() * avail.length)]!;
    }
  } else if (inPool(state, preferred)) {
    return preferred;
  }
  return weightedRandomItem(rng, state.itemPool);
}

export const WORLD_EVENTS: Record<WorldEventId, WorldEventDef> = {
  money_money_money: {
    id: 'money_money_money',
    name: 'Money Money',
    emoji: '💰',
    blurb: 'The whole floor turns into cash machines',
    warnLine: 'Cash takeover incoming',
    activeLine: 'Everything is money!',
    accent: '#f59e0b',
    fxKind: 'event_money',
  },
  tax_collector: {
    id: 'tax_collector',
    name: 'Tax Collector',
    emoji: '🧾',
    blurb: 'Everyone loses 10 coins every 5 seconds',
    warnLine: 'The collector is coming',
    activeLine: 'Pay up: 10🪙 / 5s',
    accent: '#ef4444',
    fxKind: 'event_tax',
  },
  fire_sale: {
    id: 'fire_sale',
    name: 'Fire Sale',
    emoji: '🔥',
    blurb: 'Every tag slams down to 1 coin',
    warnLine: 'Prices about to crash',
    activeLine: 'Everything is 1🪙!',
    accent: '#f97316',
    fxKind: 'discount',
  },
  deep_freeze: {
    id: 'deep_freeze',
    name: 'Deep Freeze',
    emoji: '❄️',
    blurb: 'Shop timers pause for the whole event',
    warnLine: 'Frost creeping in',
    activeLine: 'Timers frozen solid',
    accent: '#38bdf8',
    fxKind: 'freeze',
  },
  turbo_market: {
    id: 'turbo_market',
    name: 'Turbo Market',
    emoji: '⚡',
    blurb: 'Tile timers burn at double speed',
    warnLine: 'Market speeding up',
    activeLine: 'Timers at 2×!',
    accent: '#eab308',
    fxKind: 'fastforward',
  },
  bomb_bazaar: {
    id: 'bomb_bazaar',
    name: 'Bomb Bazaar',
    emoji: '💣',
    blurb: 'The shop fills with ticking bombs',
    warnLine: 'Something explosive…',
    activeLine: 'Bombs on every shelf!',
    accent: '#dc2626',
    fxKind: 'bomb_fuse',
  },
  coin_shower: {
    id: 'coin_shower',
    name: 'Coin Shower',
    emoji: '🪙',
    blurb: 'Everyone gains 5 coins every 5 seconds',
    warnLine: 'Coins gathering overhead',
    activeLine: 'Free coins raining!',
    accent: '#fbbf24',
    fxKind: 'event_shower',
  },
  shuffle_storm: {
    id: 'shuffle_storm',
    name: 'Shuffle Storm',
    emoji: '🌪️',
    blurb: 'The board reshuffles every 5 seconds',
    warnLine: 'Winds picking up',
    activeLine: 'Board in freefall!',
    accent: '#a855f7',
    fxKind: 'shuffle',
  },
  inflation_wave: {
    id: 'inflation_wave',
    name: 'Inflation Wave',
    emoji: '📈',
    blurb: 'Every price jumps +2 every 5 seconds',
    warnLine: 'Prices heating up',
    activeLine: '+2 on every tag!',
    accent: '#f43f5e',
    fxKind: 'inflate',
  },
  mystery_mall: {
    id: 'mystery_mall',
    name: 'Mystery Mall',
    emoji: '🎁',
    blurb: 'Every tile becomes a Mystery Box',
    warnLine: 'Wrapped gifts inbound',
    activeLine: 'Mystery boxes only!',
    accent: '#c084fc',
    fxKind: 'mystery_sell',
  },
  golden_chaos: {
    id: 'golden_chaos',
    name: 'Golden Chaos',
    emoji: '🌟',
    blurb: 'Gilded mayhem: gold rain, wild shelves, and wild prices',
    warnLine: 'Something gilded stirs…',
    activeLine: 'Golden Chaos reigns!',
    accent: '#fbbf24',
    fxKind: 'event_money',
  },
};

export const WORLD_EVENT_IDS = Object.keys(WORLD_EVENTS) as WorldEventId[];

/** Random pool - excludes Chaos Die’s unique golden event */
export const RANDOM_WORLD_EVENT_IDS = WORLD_EVENT_IDS.filter(
  (id) => id !== 'golden_chaos',
);

export function getWorldEvent(id: WorldEventId): WorldEventDef {
  return WORLD_EVENTS[id];
}

export function createWorldEventState() {
  return {
    id: null as WorldEventId | null,
    phase: 'pending' as const,
    activeMs: 0,
    pulseAccMs: 0,
    fxAccMs: 0,
    live: [] as LiveWorldEvent[],
  };
}

function makeLiveEvent(id: WorldEventId, activeMs = CONFIG.EVENT_DURATION_MS): LiveWorldEvent {
  liveKeySeq += 1;
  return {
    key: `we_${liveKeySeq}`,
    id,
    activeMs,
    pulseAccMs: 0,
    fxAccMs: 0,
  };
}

/** All currently running floor events. */
export function liveWorldEvents(state: GameState): LiveWorldEvent[] {
  return state.worldEvent.live;
}

function syncPrimaryFromLive(we: GameState['worldEvent']): void {
  const primary = we.live[0];
  if (!primary) {
    if (we.phase === 'active') {
      we.phase = 'done';
      we.id = null;
      we.activeMs = 0;
      we.pulseAccMs = 0;
      we.fxAccMs = 0;
    }
    return;
  }
  // Keep timers mirrored for older readers; don't hijack pending/warning phase
  we.activeMs = primary.activeMs;
  we.pulseAccMs = primary.pulseAccMs;
  we.fxAccMs = primary.fxAccMs;
  if (we.phase === 'active') {
    we.id = primary.id;
  }
}

function emitFx(
  state: GameState,
  kind: FxKind,
  opts: {
    playerId?: string;
    tileIndex?: number;
    label?: string;
  } = {},
): void {
  state.events.push({ type: 'fx', kind, ...opts });
}

function pickEvent(state: GameState, rng: () => number): WorldEventId {
  const pool =
    state.eventPool.length > 0 ? state.eventPool : RANDOM_WORLD_EVENT_IDS;
  const i = Math.floor(rng() * pool.length);
  return pool[i]!;
}

function living(state: GameState) {
  return state.players.filter((p) => p.isAlive);
}

function forceShopItems(state: GameState, itemId: ItemId | ItemId[], rng: () => number, fx: FxKind): void {
  for (const tile of state.tiles) {
    tile.itemId = pickFromPool(state, itemId, rng);
    tile.flash = 'bid';
    tile.flashMs = 400;
    emitFx(state, fx, { tileIndex: tile.index });
  }
}

function shuffleBoard(state: GameState, rng: () => number): void {
  const payloads = state.tiles.map((t) => ({
    itemId: t.itemId,
    price: t.price,
    timerMs: t.timerMs,
    highBidderId: t.highBidderId,
    freezeMs: t.freezeMs,
    golden: t.golden,
  }));
  for (let i = payloads.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = payloads[i]!;
    payloads[i] = payloads[j]!;
    payloads[j] = tmp;
  }
  for (let i = 0; i < state.tiles.length; i++) {
    const t = state.tiles[i]!;
    const p = payloads[i]!;
    t.itemId = p.itemId;
    t.price = p.price;
    t.timerMs = p.timerMs;
    t.highBidderId = p.highBidderId;
    t.freezeMs = p.freezeMs;
    t.golden = p.golden;
    t.flash = 'bid';
    t.flashMs = 300;
    emitFx(state, 'shuffle', { tileIndex: i });
  }
}
function startEvent(state: GameState, rng: () => number, id: WorldEventId): void {
  const def = getWorldEvent(id);

  switch (id) {
    case 'money_money_money':
      forceShopItems(state, MONEY_IDS, rng, 'event_money');
      break;
    case 'fire_sale':
      for (const tile of state.tiles) {
        tile.price = CONFIG.START_PRICE;
        tile.flash = 'steal';
        tile.flashMs = 400;
        emitFx(state, 'discount', { tileIndex: tile.index, label: '1🪙' });
      }
      break;
    case 'deep_freeze':
      for (const tile of state.tiles) {
        tile.freezeMs = Math.max(tile.freezeMs, CONFIG.EVENT_DURATION_MS);
        emitFx(state, 'freeze', { tileIndex: tile.index });
      }
      break;
    case 'turbo_market':
      for (const tile of state.tiles) {
        emitFx(state, 'fastforward', { tileIndex: tile.index, label: '2×' });
      }
      break;
    case 'bomb_bazaar':
      forceShopItems(state, 'bomb', rng, 'bomb_fuse');
      break;
    case 'mystery_mall':
      forceShopItems(state, 'mystery_box', rng, 'mystery_sell');
      break;
    case 'tax_collector':
    case 'coin_shower':
      for (const p of living(state)) {
        emitFx(state, def.fxKind, { playerId: p.id });
      }
      break;
    case 'shuffle_storm':
      shuffleBoard(state, rng);
      break;
    case 'inflation_wave':
      for (const tile of state.tiles) {
        tile.price += 2;
        emitFx(state, 'inflate', { tileIndex: tile.index, label: '+2' });
      }
      break;
    case 'golden_chaos':
      for (const p of living(state)) {
        p.coins += 12;
        state.events.push({
          type: 'income',
          playerId: p.id,
          amount: 12,
          emoji: '🌟',
        });
        emitFx(state, 'event_money', { playerId: p.id, label: '+12' });
      }
      forceShopItems(state, MONEY_IDS, rng, 'event_money');
      for (const tile of state.tiles) {
        tile.price = Math.max(1, tile.price + 3);
        emitFx(state, 'inflate', { tileIndex: tile.index, label: '+3' });
      }
      break;
  }
}

function pulseEvent(
  state: GameState,
  rng: () => number,
  id: WorldEventId,
  remainMs: number,
): void {
  const def = getWorldEvent(id);

  switch (id) {
    case 'tax_collector': {
      for (const p of living(state)) {
        const lost = Math.min(10, p.coins);
        if (lost <= 0) continue;
        p.coins -= lost;
        p.coinTrail = [
          ...p.coinTrail,
          { emoji: '🧾', label: 'Tax Collector', delta: -lost },
        ].slice(-12);
        state.events.push({
          type: 'loss',
          playerId: p.id,
          amount: lost,
          emoji: '🧾',
          label: 'Tax Collector',
        });
        emitFx(state, 'event_tax', { playerId: p.id, label: `-${lost}` });
      }
      break;
    }
    case 'coin_shower': {
      for (const p of living(state)) {
        p.coins += 5;
        state.events.push({
          type: 'income',
          playerId: p.id,
          amount: 5,
          emoji: '🪙',
        });
        emitFx(state, 'event_shower', { playerId: p.id, label: '+5' });
      }
      break;
    }
    case 'shuffle_storm':
      shuffleBoard(state, rng);
      break;
    case 'inflation_wave':
      for (const tile of state.tiles) {
        tile.price += 2;
        tile.flash = 'bid';
        tile.flashMs = 300;
        emitFx(state, 'inflate', { tileIndex: tile.index, label: '+2' });
      }
      break;
    case 'deep_freeze':
      for (const tile of state.tiles) {
        tile.freezeMs = Math.max(tile.freezeMs, remainMs);
        emitFx(state, 'freeze', { tileIndex: tile.index });
      }
      break;
    case 'money_money_money':
      for (const tile of state.tiles) {
        if (!MONEY_IDS.includes(tile.itemId) || !inPool(state, tile.itemId)) {
          tile.itemId = pickFromPool(state, MONEY_IDS, rng);
          emitFx(state, 'event_money', { tileIndex: tile.index });
        }
      }
      break;
    case 'bomb_bazaar':
      for (const tile of state.tiles) {
        const next = pickFromPool(state, 'bomb', rng);
        if (tile.itemId !== next) {
          tile.itemId = next;
          emitFx(state, 'bomb_fuse', { tileIndex: tile.index });
        }
      }
      break;
    case 'mystery_mall':
      for (const tile of state.tiles) {
        const next = pickFromPool(state, 'mystery_box', rng);
        if (tile.itemId !== next) {
          tile.itemId = next;
          emitFx(state, 'mystery_sell', { tileIndex: tile.index });
        }
      }
      break;
    case 'fire_sale':
      for (const tile of state.tiles) {
        if (tile.price > CONFIG.START_PRICE) {
          tile.price = CONFIG.START_PRICE;
          emitFx(state, 'discount', { tileIndex: tile.index, label: '1🪙' });
        }
      }
      break;
    case 'turbo_market':
      for (const tile of state.tiles) {
        emitFx(state, def.fxKind, { tileIndex: tile.index });
      }
      break;
    case 'golden_chaos': {
      for (const p of living(state)) {
        p.coins += 4;
        state.events.push({
          type: 'income',
          playerId: p.id,
          amount: 4,
          emoji: '🌟',
        });
        emitFx(state, 'event_money', { playerId: p.id, label: '+4' });
      }
      shuffleBoard(state, rng);
      for (const tile of state.tiles) {
        tile.price += 1;
        emitFx(state, 'inflate', { tileIndex: tile.index, label: '+1' });
      }
      break;
    }
  }
}

function ambientFx(state: GameState, rng: () => number, id: WorldEventId): void {
  const def = getWorldEvent(id);
  const tiles = state.tiles;
  if (tiles.length === 0) return;
  const tile = tiles[Math.floor(rng() * tiles.length)]!;
  emitFx(state, def.fxKind, { tileIndex: tile.index });

  const alive = living(state);
  if (alive.length > 0 && (id === 'tax_collector' || id === 'coin_shower')) {
    const p = alive[Math.floor(rng() * alive.length)]!;
    emitFx(state, def.fxKind, { playerId: p.id });
  }
}

function endEvent(state: GameState, id: WorldEventId, endingKey?: string): void {
  if (id === 'deep_freeze') {
    const stillFrozen = state.worldEvent.live.some(
      (e) => e.id === 'deep_freeze' && e.key !== endingKey,
    );
    if (!stillFrozen) {
      for (const tile of state.tiles) {
        tile.freezeMs = 0;
      }
    }
  }
  const def = getWorldEvent(id);
  for (const tile of state.tiles) {
    emitFx(state, def.fxKind, { tileIndex: tile.index, label: 'END' });
  }
}

function pushLiveEvent(
  state: GameState,
  rng: () => number,
  id: WorldEventId,
): LiveWorldEvent {
  const we = state.worldEvent;
  while (we.live.length >= MAX_LIVE_EVENTS) {
    const oldest = we.live.shift();
    if (oldest) endEvent(state, oldest.id, oldest.key);
  }
  const entry = makeLiveEvent(id);
  we.live.push(entry);
  const def = getWorldEvent(id);
  for (const tile of state.tiles) {
    emitFx(state, def.fxKind, { tileIndex: tile.index });
  }
  startEvent(state, rng, id);
  syncPrimaryFromLive(we);
  return entry;
}

/** Timer drain multiplier while world events are active. */
export function worldEventTimerScale(state: GameState): number {
  const live = state.worldEvent.live;
  if (live.length === 0) return 1;
  if (live.some((e) => e.id === 'deep_freeze')) return 0;
  let scale = 1;
  for (const e of live) {
    if (e.id === 'turbo_market') scale = Math.max(scale, 2);
    if (e.id === 'golden_chaos') scale = Math.max(scale, 1.5);
  }
  return scale;
}

/**
 * Immediately start a world event (Chaos Die). Stacks with any live event.
 * Pass `golden_chaos` for the unique golden-die event; otherwise picks random.
 */
export function forceTriggerWorldEvent(
  state: GameState,
  rng: () => number,
  id?: WorldEventId,
): void {
  pushLiveEvent(state, rng, id ?? pickEvent(state, rng));
}

function tickLiveEntry(
  state: GameState,
  entry: LiveWorldEvent,
  dtMs: number,
  rng: () => number,
): boolean {
  entry.activeMs = Math.max(0, entry.activeMs - dtMs);
  entry.pulseAccMs += dtMs;
  entry.fxAccMs += dtMs;

  while (entry.pulseAccMs >= CONFIG.EVENT_PULSE_MS) {
    entry.pulseAccMs -= CONFIG.EVENT_PULSE_MS;
    pulseEvent(state, rng, entry.id, entry.activeMs);
  }

  while (entry.fxAccMs >= 700) {
    entry.fxAccMs -= 700;
    ambientFx(state, rng, entry.id);
  }

  if (entry.activeMs <= 0) {
    endEvent(state, entry.id, entry.key);
    return false;
  }
  return true;
}

export function tickWorldEvent(
  state: GameState,
  dtMs: number,
  rng: () => number,
): void {
  const we = state.worldEvent;

  if (we.live.length > 0) {
    we.live = we.live.filter((entry) => tickLiveEntry(state, entry, dtMs, rng));
    syncPrimaryFromLive(we);
  }

  if (we.phase === 'done') return;

  if (we.phase === 'pending' && state.roundMs <= CONFIG.EVENT_WARN_AT_MS) {
    we.phase = 'warning';
    we.id = pickEvent(state, rng);
    const def = getWorldEvent(we.id);
    for (const tile of state.tiles) {
      emitFx(state, def.fxKind, { tileIndex: tile.index });
    }
  }

  if (we.phase === 'warning' && state.roundMs <= CONFIG.EVENT_START_AT_MS) {
    const id = we.id ?? pickEvent(state, rng);
    we.id = id;
    we.phase = 'active';
    pushLiveEvent(state, rng, id);
  }
}
