import { AVATAR_EMOJIS, CONFIG, PLAYER_COLORS } from './constants';
import { getItem, weightedRandomItem } from './items';
import type {
  BotArchetype,
  DifficultyMode,
  FxKind,
  GameState,
  HandItem,
  ItemId,
  LobbyConfig,
  Player,
  RankingEntry,
  Tile,
  UseTargets,
} from './types';

function emitFx(
  state: GameState,
  kind: FxKind,
  opts: {
    playerId?: string;
    targetPlayerId?: string;
    tileIndex?: number;
    tileIndexB?: number;
    label?: string;
    instanceId?: string;
  } = {},
): void {
  state.events.push({ type: 'fx', kind, ...opts });
}

/** Mulberry32 seeded RNG */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uid(prefix: string, n: number): string {
  return `${prefix}_${n}`;
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: p.hand.map((h) => ({ ...h })),
    })),
    tiles: state.tiles.map((t) => ({ ...t })),
    events: [...state.events],
  };
}

function makeTile(index: number, itemId: ItemId): Tile {
  return {
    index,
    itemId,
    price: CONFIG.START_PRICE,
    timerMs: CONFIG.TILE_TIMER_MS,
    highBidderId: null,
    freezeMs: 0,
    flash: null,
    flashMs: 0,
  };
}

function makeHandItem(
  state: GameState,
  itemId: ItemId,
  withBombFuse = false,
): HandItem {
  const def = getItem(itemId);
  const instanceId = uid('item', state.nextInstance);
  state.nextInstance += 1;
  return {
    instanceId,
    itemId,
    passiveAccMs: 0,
    dividendGrowAccMs: 0,
    currentSellValue: def.sellValue,
    stored: 0,
    bombFuseMs: withBombFuse || itemId === 'bomb' ? CONFIG.BOMB_FUSE_MS : null,
  };
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
  return Array.from({ length: botCount }, () => {
    const i = Math.floor(rng() * pool.length);
    return pool[i]!;
  });
}

function botName(archetype: BotArchetype, index: number): string {
  const prefixes: Record<BotArchetype, string[]> = {
    chill: ['Chill', 'Easy', 'Mellow', 'Zen'],
    balanced: ['Balanced', 'Steady', 'Fair', 'Even'],
    ruthless: ['Ruthless', 'Fierce', 'Sharp', 'Brutal'],
  };
  const list = prefixes[archetype];
  return `${list[index % list.length]} Bot ${index + 1}`;
}

export function createInitialState(config: LobbyConfig, seed?: number): GameState {
  const actualSeed = seed ?? (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  const rng = createRng(actualSeed);
  const archetypes = assignArchetypes(config.botCount, config.difficulty, rng);

  const players: Player[] = [];
  const humanId = 'player_0';
  players.push({
    id: humanId,
    name: config.humanName.trim() || 'You',
    avatar: config.humanAvatar || AVATAR_EMOJIS[Math.floor(rng() * AVATAR_EMOJIS.length)]!,
    color: PLAYER_COLORS[0]!,
    coins: CONFIG.START_COINS,
    hand: [],
    isHuman: true,
    isAlive: true,
    archetype: null,
    handcuffMs: 0,
    botCooldownMs: 0,
    eliminatedAt: null,
    comebackAccMs: 0,
  });

  for (let i = 0; i < config.botCount; i++) {
    const arch = archetypes[i]!;
    const colorIdx = (i + 1) % PLAYER_COLORS.length;
    players.push({
      id: `player_${i + 1}`,
      name: botName(arch, i),
      avatar: AVATAR_EMOJIS[Math.floor(rng() * AVATAR_EMOJIS.length)]!,
      color: PLAYER_COLORS[colorIdx]!,
      coins: CONFIG.START_COINS,
      hand: [],
      isHuman: false,
      isAlive: true,
      archetype: arch,
      handcuffMs: 0,
      botCooldownMs: 200 + Math.floor(rng() * 600),
      eliminatedAt: null,
      comebackAccMs: 0,
    });
  }

  const tiles: Tile[] = [];
  for (let i = 0; i < CONFIG.GRID_SIZE; i++) {
    tiles.push(makeTile(i, weightedRandomItem(rng)));
  }

  return {
    players,
    tiles,
    roundMs: CONFIG.GAME_LENGTH_MS,
    humanId,
    seed: actualSeed,
    events: [],
    nextInstance: 1,
    ended: false,
    winnerId: null,
    leaderTaxAccMs: 0,
  };
}

function getPlayer(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id);
}

function livingPlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.isAlive);
}

function richestOpponent(state: GameState, selfId: string): Player | null {
  const others = livingPlayers(state).filter((p) => p.id !== selfId);
  if (others.length === 0) return null;
  return others.reduce((a, b) => (b.coins > a.coins ? b : a));
}

function restockTile(state: GameState, tileIndex: number, rng: () => number): void {
  const tile = state.tiles[tileIndex];
  if (!tile) return;
  Object.assign(tile, makeTile(tileIndex, weightedRandomItem(rng)));
}

function eliminate(
  state: GameState,
  playerId: string,
  reason: 'unpaid' | 'bomb',
): void {
  const player = getPlayer(state, playerId);
  if (!player || !player.isAlive) return;
  player.isAlive = false;
  player.eliminatedAt = Date.now();
  player.hand = [];
  // Clear their high bids
  for (const tile of state.tiles) {
    if (tile.highBidderId === playerId) {
      tile.highBidderId = null;
    }
  }
  state.events.push({ type: 'eliminate', playerId, reason });
  if (reason === 'bomb') {
    state.events.push({ type: 'explosion', playerId });
  }
}

function giveItem(state: GameState, player: Player, itemId: ItemId): void {
  if (itemId === 'bomb') {
    // Bomb always attaches, even beyond hand slots
    player.hand.push(makeHandItem(state, itemId, true));
    return;
  }

  const nonBombCount = player.hand.filter((h) => h.itemId !== 'bomb').length;
  if (nonBombCount >= CONFIG.HAND_SLOTS) {
    const def = getItem(itemId);
    let sell = def.sellValue;
    if (itemId === 'mystery_box') {
      sell = 1 + ((state.nextInstance * 17 + state.seed) % 20);
    }
    player.coins += sell;
    state.events.push({
      type: 'income',
      playerId: player.id,
      amount: sell,
      emoji: def.emoji,
    });
    return;
  }

  player.hand.push(makeHandItem(state, itemId));
}

export function computeSellValue(item: HandItem, rng: () => number): number {
  if (item.itemId === 'bomb') return 0;
  if (item.itemId === 'mystery_box') return 1 + Math.floor(rng() * 20);
  if (item.itemId === 'piggy_bank') return 2 + item.stored;
  if (item.itemId === 'dividend_stock') return item.currentSellValue;
  return item.currentSellValue;
}

export function bid(
  state: GameState,
  playerId: string,
  tileIndex: number,
): GameState {
  const next = cloneState(state);
  if (next.ended) return next;

  const player = getPlayer(next, playerId);
  const tile = next.tiles[tileIndex];
  if (!player || !tile || !player.isAlive) return next;
  if (player.handcuffMs > 0) return next;
  if (tile.highBidderId === playerId) return next;

  const activeBids = next.tiles.filter((t) => t.highBidderId === playerId).length;
  if (activeBids >= CONFIG.MAX_ACTIVE_BIDS) return next;

  tile.price += CONFIG.BID_INCREMENT;
  tile.highBidderId = playerId;
  tile.timerMs = CONFIG.TILE_TIMER_MS;
  tile.flash = 'bid';
  tile.flashMs = 200;

  return next;
}

export function sellItem(
  state: GameState,
  playerId: string,
  instanceId: string,
  rng: () => number = Math.random,
): GameState {
  const next = cloneState(state);
  if (next.ended) return next;

  const player = getPlayer(next, playerId);
  if (!player || !player.isAlive) return next;

  const idx = player.hand.findIndex((h) => h.instanceId === instanceId);
  if (idx < 0) return next;

  const item = player.hand[idx]!;
  const value = computeSellValue(item, rng);
  player.coins += value;
  player.hand.splice(idx, 1);

  if (value > 0) {
    next.events.push({
      type: 'income',
      playerId,
      amount: value,
      emoji: getItem(item.itemId).emoji,
    });
  }
  if (item.itemId === 'mystery_box') {
    emitFx(next, 'mystery_sell', { playerId });
  }

  return next;
}

function resolveTile(
  state: GameState,
  tileIndex: number,
  rng: () => number,
): void {
  const tile = state.tiles[tileIndex];
  if (!tile) return;

  const winnerId = tile.highBidderId;
  tile.flash = 'resolve';
  tile.flashMs = 400;

  if (winnerId) {
    const winner = getPlayer(state, winnerId);
    if (winner && winner.isAlive) {
      if (winner.coins >= tile.price) {
        winner.coins -= tile.price;
        giveItem(state, winner, tile.itemId);
      } else {
        eliminate(state, winnerId, 'unpaid');
      }
    }
  }

  state.events.push({ type: 'resolve', tileIndex, winnerId });
  restockTile(state, tileIndex, rng);
}

export function applyUseItem(
  state: GameState,
  playerId: string,
  instanceId: string,
  targets: UseTargets,
  rng: () => number = Math.random,
): GameState {
  const next = cloneState(state);
  if (next.ended) return next;

  const player = getPlayer(next, playerId);
  if (!player || !player.isAlive) return next;

  const idx = player.hand.findIndex((h) => h.instanceId === instanceId);
  if (idx < 0) return next;

  const item = player.hand[idx]!;
  const def = getItem(item.itemId);

  // Bomb is only sellable (defuse), not "used" as active with special target
  if (item.itemId === 'bomb' || item.itemId === 'mystery_box') {
    return next;
  }

  if (def.kind !== 'active') return next;

  // Apply effect then consume
  emitFx(next, 'active_cast', {
    playerId: player.id,
    label: def.emoji,
  });
  applyActiveEffect(next, player, item.itemId, targets, rng);
  player.hand.splice(idx, 1);

  return next;
}

function applyActiveEffect(
  state: GameState,
  player: Player,
  itemId: ItemId,
  targets: UseTargets,
  rng: () => number,
): void {
  switch (itemId) {
    case 'price_doubler': {
      const tile = state.tiles[targets.tileIndex ?? -1];
      if (!tile) return;
      tile.price = Math.max(1, tile.price * 2);
      tile.flash = 'double';
      tile.flashMs = 500;
      emitFx(state, 'double', { tileIndex: tile.index });
      break;
    }
    case 'discount_tag': {
      const tile = state.tiles[targets.tileIndex ?? -1];
      if (!tile) return;
      tile.price = Math.max(1, Math.ceil(tile.price / 2));
      emitFx(state, 'discount', { tileIndex: tile.index, label: '½' });
      break;
    }
    case 'reset_hammer': {
      const tile = state.tiles[targets.tileIndex ?? -1];
      if (!tile) return;
      tile.price = CONFIG.START_PRICE;
      tile.highBidderId = null;
      emitFx(state, 'hammer', { tileIndex: tile.index });
      break;
    }
    case 'inflation': {
      for (const tile of state.tiles) {
        tile.price += 2;
        emitFx(state, 'inflate', { tileIndex: tile.index });
      }
      break;
    }
    case 'time_freeze': {
      const tile = state.tiles[targets.tileIndex ?? -1];
      if (!tile) return;
      tile.freezeMs = CONFIG.TIME_FREEZE_MS;
      emitFx(state, 'freeze', { tileIndex: tile.index });
      break;
    }
    case 'fast_forward': {
      const ti = targets.tileIndex;
      if (ti === undefined) return;
      emitFx(state, 'fastforward', { tileIndex: ti });
      resolveTile(state, ti, rng);
      break;
    }
    case 'overtime': {
      const tile = state.tiles[targets.tileIndex ?? -1];
      if (!tile) return;
      tile.timerMs += CONFIG.OVERTIME_MS;
      emitFx(state, 'overtime', { tileIndex: tile.index, label: '+6s' });
      break;
    }
    case 'swap_portal': {
      const a = targets.tileIndex;
      const b = targets.tileIndexB;
      if (a === undefined || b === undefined || a === b) return;
      const tileA = state.tiles[a];
      const tileB = state.tiles[b];
      if (!tileA || !tileB) return;
      const tmp = {
        itemId: tileA.itemId,
        price: tileA.price,
        timerMs: tileA.timerMs,
        highBidderId: tileA.highBidderId,
        freezeMs: tileA.freezeMs,
      };
      tileA.itemId = tileB.itemId;
      tileA.price = tileB.price;
      tileA.timerMs = tileB.timerMs;
      tileA.highBidderId = tileB.highBidderId;
      tileA.freezeMs = tileB.freezeMs;
      tileB.itemId = tmp.itemId;
      tileB.price = tmp.price;
      tileB.timerMs = tmp.timerMs;
      tileB.highBidderId = tmp.highBidderId;
      tileB.freezeMs = tmp.freezeMs;
      tileA.flash = 'bid';
      tileA.flashMs = 300;
      tileB.flash = 'bid';
      tileB.flashMs = 300;
      emitFx(state, 'swap', { tileIndex: a, tileIndexB: b });
      break;
    }
    case 'shop_refresh': {
      for (let i = 0; i < state.tiles.length; i++) {
        restockTile(state, i, rng);
        emitFx(state, 'refresh', { tileIndex: i });
      }
      break;
    }
    case 'shuffle': {
      const payloads = state.tiles.map((t) => ({
        itemId: t.itemId,
        price: t.price,
        timerMs: t.timerMs,
        highBidderId: t.highBidderId,
        freezeMs: t.freezeMs,
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
        t.flash = 'bid';
        t.flashMs = 300;
        emitFx(state, 'shuffle', { tileIndex: i });
      }
      break;
    }
    case 'handcuffs': {
      const target = getPlayer(state, targets.playerId ?? '');
      if (!target || !target.isAlive || target.id === player.id) return;
      target.handcuffMs = CONFIG.HANDCUFF_MS;
      emitFx(state, 'cuffs', { playerId: target.id });
      break;
    }
    case 'pickpocket': {
      const target = getPlayer(state, targets.playerId ?? '');
      if (!target || !target.isAlive || target.id === player.id) return;
      const gap = Math.max(0, target.coins - player.coins);
      const want = Math.min(6, 3 + Math.floor(gap / 5));
      const steal = Math.min(want, target.coins);
      target.coins -= steal;
      player.coins += steal;
      if (steal > 0) {
        state.events.push({
          type: 'income',
          playerId: player.id,
          amount: steal,
          emoji: '🧤',
        });
      }
      emitFx(state, 'pickpocket', {
        playerId: player.id,
        targetPlayerId: target.id,
      });
      break;
    }
    default:
      break;
  }
}

function tickPassives(state: GameState, dt: number): void {
  for (const player of state.players) {
    if (!player.isAlive) continue;

    for (const item of player.hand) {
      const def = getItem(item.itemId);
      if (def.kind !== 'passive' && item.itemId !== 'bomb') continue;

      // Bomb fuse
      if (item.itemId === 'bomb' && item.bombFuseMs !== null) {
        item.bombFuseMs -= dt;
        // Pulse about once per second while armed
        if (Math.floor(item.bombFuseMs / 1000) !== Math.floor((item.bombFuseMs + dt) / 1000)) {
          emitFx(state, 'bomb_fuse', {
            playerId: player.id,
            instanceId: item.instanceId,
          });
        }
        if (item.bombFuseMs <= 0) {
          eliminate(state, player.id, 'bomb');
          break;
        }
        continue;
      }

      if (item.itemId === 'mystery_box') continue;

      // Piggy banks into itself
      if (item.itemId === 'piggy_bank') {
        item.passiveAccMs += dt;
        while (item.passiveAccMs >= 1000) {
          item.passiveAccMs -= 1000;
          item.stored += 1;
          item.currentSellValue = 2 + item.stored;
          emitFx(state, 'piggy', {
            playerId: player.id,
            instanceId: item.instanceId,
          });
        }
        continue;
      }

      // Dividend income + grow sell value
      if (item.itemId === 'dividend_stock') {
        item.passiveAccMs += dt;
        item.dividendGrowAccMs += dt;
        while (item.passiveAccMs >= (def.passiveIntervalMs ?? 4000)) {
          item.passiveAccMs -= def.passiveIntervalMs ?? 4000;
          player.coins += 1;
          state.events.push({
            type: 'income',
            playerId: player.id,
            amount: 1,
            emoji: def.emoji,
          });
          emitFx(state, 'dividend', {
            playerId: player.id,
            instanceId: item.instanceId,
          });
        }
        while (item.dividendGrowAccMs >= 6000) {
          item.dividendGrowAccMs -= 6000;
          item.currentSellValue += 1;
          emitFx(state, 'dividend', {
            playerId: player.id,
            instanceId: item.instanceId,
            label: '↑',
          });
        }
        continue;
      }

      // Coin leech
      if (item.itemId === 'coin_leech') {
        item.passiveAccMs += dt;
        while (item.passiveAccMs >= (def.passiveIntervalMs ?? 4000)) {
          item.passiveAccMs -= def.passiveIntervalMs ?? 4000;
          const victim = richestOpponent(state, player.id);
          if (victim && victim.coins > 0) {
            const gap = victim.coins - player.coins;
            const want = gap >= CONFIG.COMEBACK_BIG_GAP ? 2 : 1;
            const steal = Math.min(want, victim.coins);
            victim.coins -= steal;
            player.coins += steal;
            state.events.push({
              type: 'income',
              playerId: player.id,
              amount: steal,
              emoji: def.emoji,
            });
            emitFx(state, 'leech', {
              playerId: player.id,
              targetPlayerId: victim.id,
              instanceId: item.instanceId,
            });
          }
        }
        continue;
      }

      // Standard money engines
      if (def.passiveIntervalMs && def.passiveAmount) {
        item.passiveAccMs += dt;
        while (item.passiveAccMs >= def.passiveIntervalMs) {
          item.passiveAccMs -= def.passiveIntervalMs;
          player.coins += def.passiveAmount;
          state.events.push({
            type: 'income',
            playerId: player.id,
            amount: def.passiveAmount,
            emoji: def.emoji,
          });
          const kind: FxKind =
            item.itemId === 'money_printer'
              ? 'print'
              : item.itemId === 'golden_goose'
                ? 'goose'
                : 'gold_spark';
          emitFx(state, kind, {
            playerId: player.id,
            instanceId: item.instanceId,
          });
        }
      }
    }
  }
}

function checkWinConditions(state: GameState, rng: () => number): void {
  const alive = livingPlayers(state);
  if (alive.length <= 1) {
    state.ended = true;
    state.winnerId = alive[0]?.id ?? null;
    return;
  }
  if (state.roundMs <= 0) {
    state.roundMs = 0;
    state.ended = true;
    // Richest living; tie-break: most items, then random
    const sorted = [...alive].sort((a, b) => {
      if (b.coins !== a.coins) return b.coins - a.coins;
      if (b.hand.length !== a.hand.length) return b.hand.length - a.hand.length;
      return rng() - 0.5;
    });
    state.winnerId = sorted[0]?.id ?? null;
  }
}

export function tick(state: GameState, dtMs: number, rng: () => number = Math.random): GameState {
  const next = cloneState(state);
  if (next.ended) return next;

  // Clear old events each tick (UI consumes via store)
  next.events = [];

  next.roundMs = Math.max(0, next.roundMs - dtMs);

  // Status timers
  for (const player of next.players) {
    if (player.handcuffMs > 0) {
      player.handcuffMs = Math.max(0, player.handcuffMs - dtMs);
    }
    if (!player.isHuman && player.isAlive) {
      player.botCooldownMs = Math.max(0, player.botCooldownMs - dtMs);
    }
  }

  // Tile timers & flash
  for (const tile of next.tiles) {
    if (tile.flashMs > 0) {
      tile.flashMs = Math.max(0, tile.flashMs - dtMs);
      if (tile.flashMs === 0) tile.flash = null;
    }
    if (tile.freezeMs > 0) {
      tile.freezeMs = Math.max(0, tile.freezeMs - dtMs);
      continue;
    }
    tile.timerMs -= dtMs;
  }

  // Resolve expired tiles (snapshot indices that hit 0)
  const toResolve = next.tiles
    .filter((t) => t.timerMs <= 0)
    .map((t) => t.index);
  for (const idx of toResolve) {
    // Re-check — fast-forward may have already restocked
    const tile = next.tiles[idx];
    if (tile && tile.timerMs <= 0) {
      resolveTile(next, idx, rng);
    }
  }

  tickPassives(next, dtMs);
  tickRubberBand(next, dtMs);
  checkWinConditions(next, rng);

  return next;
}

/** Soft catch-up: underdog drip + crown tax on a runaway leader. */
function tickRubberBand(state: GameState, dt: number): void {
  const alive = livingPlayers(state);
  if (alive.length < 2) return;

  const sorted = [...alive].sort((a, b) => b.coins - a.coins);
  const richest = sorted[0]!;
  const second = sorted[1]!;

  // Crown tax — runaway leader bleeds slowly
  if (richest.coins - second.coins >= CONFIG.LEADER_TAX_GAP) {
    state.leaderTaxAccMs += dt;
    while (state.leaderTaxAccMs >= CONFIG.LEADER_TAX_INTERVAL_MS) {
      state.leaderTaxAccMs -= CONFIG.LEADER_TAX_INTERVAL_MS;
      if (richest.coins <= 0) break;
      richest.coins -= 1;
    }
  } else {
    state.leaderTaxAccMs = 0;
  }

  // Underdog income — scale with how far behind
  for (const player of alive) {
    const gap = richest.coins - player.coins;
    if (gap < CONFIG.COMEBACK_GAP) {
      player.comebackAccMs = 0;
      continue;
    }
    player.comebackAccMs += dt;
    const amount = gap >= CONFIG.COMEBACK_BIG_GAP ? 2 : 1;
    while (player.comebackAccMs >= CONFIG.COMEBACK_INTERVAL_MS) {
      player.comebackAccMs -= CONFIG.COMEBACK_INTERVAL_MS;
      player.coins += amount;
      state.events.push({
        type: 'income',
        playerId: player.id,
        amount,
        emoji: '🏃',
      });
    }
  }
}

export function buildRanking(state: GameState): RankingEntry[] {
  const winnerId = state.winnerId;
  const alive = state.players.filter((p) => p.isAlive);
  const dead = state.players.filter((p) => !p.isAlive);

  const aliveSorted = [...alive].sort((a, b) => {
    if (b.coins !== a.coins) return b.coins - a.coins;
    return b.hand.length - a.hand.length;
  });

  // Dead sorted by elimination time (later = better place)
  const deadSorted = [...dead].sort((a, b) => {
    const ta = a.eliminatedAt ?? 0;
    const tb = b.eliminatedAt ?? 0;
    return tb - ta;
  });

  const ordered = [...aliveSorted, ...deadSorted];
  return ordered.map((player, i) => ({
    player,
    place: i + 1,
    isWinner: player.id === winnerId,
  }));
}

export function estimatedIncomePerSec(player: Player): number {
  let rate = 0;
  for (const item of player.hand) {
    const def = getItem(item.itemId);
    if (item.itemId === 'piggy_bank') continue; // not liquid until sell
    if (def.passiveIntervalMs && def.passiveAmount) {
      rate += def.passiveAmount / (def.passiveIntervalMs / 1000);
    }
    if (item.itemId === 'coin_leech') {
      rate += 1 / 4;
    }
  }
  return rate;
}

export function handNonBombCount(player: Player): number {
  return player.hand.filter((h) => h.itemId !== 'bomb').length;
}
