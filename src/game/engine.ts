import { AVATAR_EMOJIS, CONFIG, MODE_SETUP, PLAYER_COLORS } from './constants';
import { getItem, pickMatchPool, startPriceOf, bombDefuseCost, weightedRandomItem, coinMineIntervalMs } from './items';
import { matchPaceMult } from './pace';
import { createRng } from './rng';
import type {
  BotArchetype,
  DifficultyMode,
  FxKind,
  GameState,
  HandItem,
  ItemId,
  LobbyConfig,
  Player,
  PlayerIdentity,
  RankingEntry,
  Tile,
  UseTargets,
} from './types';
import {
  createWorldEventState,
  forceTriggerWorldEvent,
  tickWorldEvent,
  worldEventTimerScale,
} from './worldEvents';

export { createRng, bombDefuseCost };

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
    worldEvent: { ...state.worldEvent },
    suddenDeath: { ...state.suddenDeath },
    itemPool: [...state.itemPool],
  };
}

function makeTile(index: number, itemId: ItemId): Tile {
  return {
    index,
    itemId,
    price: startPriceOf(itemId),
    timerMs: CONFIG.TILE_TIMER_MS,
    highBidderId: null,
    freezeMs: 0,
    bidLocked: false,
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
    golden: false,
    passiveAccMs: 0,
    dividendGrowAccMs: 0,
    currentSellValue: itemId === 'stock_market' ? 1 : def.sellValue,
    stored: 0,
    bombFuseMs: withBombFuse || itemId === 'bomb' ? CONFIG.BOMB_FUSE_MS : null,
    gilderAccMs: 0,
  };
}

function sellValueOf(item: HandItem, itemsSold = 0): number {
  if (item.itemId === 'bomb') return item.golden ? 100 : 0;
  if (item.itemId === 'dynamite') return 0;
  if (item.itemId === 'bank_note') {
    return itemsSold * (item.golden ? 2 : 1);
  }
  if (item.itemId === 'mystery_box') return item.currentSellValue;
  if (item.itemId === 'piggy_bank') return 2 + item.stored;
  return item.currentSellValue;
}

function syncBankNotes(player: Player): void {
  for (const h of player.hand) {
    if (h.itemId === 'bank_note') {
      h.currentSellValue = sellValueOf(h, player.itemsSold);
    }
  }
}

function recordItemsSold(player: Player, count: number): void {
  if (count <= 0) return;
  player.itemsSold += count;
  syncBankNotes(player);
}

function brokerBonus(player: Player): number {
  let bonus = 0;
  for (const h of player.hand) {
    if (h.itemId === 'broker') bonus += h.golden ? 6 : 3;
  }
  return bonus;
}

function hasCurseIdol(player: Player): boolean {
  return player.hand.some((h) => h.itemId === 'curse_idol');
}

function passivesBlocked(state: GameState, player: Player): boolean {
  return state.coldMarketMs > 0 || player.muteMs > 0;
}

function randomOpponent(
  state: GameState,
  selfId: string,
  rng: () => number,
): Player | null {
  const others = livingPlayers(state).filter((p) => p.id !== selfId);
  if (others.length === 0) return null;
  return others[Math.floor(rng() * others.length)]!;
}

function adjacencyMult(hand: HandItem[], index: number): number {
  let m = 1;
  const left = hand[index - 1];
  const right = hand[index + 1];
  // Echo to the left doubles this item (its right neighbor)
  if (left?.itemId === 'mirror') m *= 2;
  // Golden mirror to the right also doubles this item (its left neighbor)
  if (right?.itemId === 'mirror' && right.golden) m *= 2;
  return m;
}

/** Tip Jar aura: +1 (golden +2) to every passive coin output. */
function tipBonus(player: Player): number {
  let bonus = 0;
  for (const h of player.hand) {
    if (h.itemId === 'tip_jar') bonus += h.golden ? 2 : 1;
  }
  return bonus;
}

/** Haste Gear aura: speeds up ticking passives (stacks multiplicatively). */
function hasteFactor(player: Player): number {
  let factor = 1;
  for (const h of player.hand) {
    if (h.itemId === 'haste_gear') factor *= h.golden ? 2 : 1.5;
  }
  return factor;
}

function grantCoins(
  state: GameState,
  player: Player,
  amount: number,
  emoji: string,
  opts: { skipMagnet?: boolean } = {},
): void {
  if (amount <= 0) return;
  if (passivesBlocked(state, player) || hasCurseIdol(player)) return;
  const pay = amount + tipBonus(player);
  player.coins += pay;
  state.events.push({
    type: 'income',
    playerId: player.id,
    amount: pay,
    emoji,
  });
  if (opts.skipMagnet) return;
  for (const other of state.players) {
    if (!other.isAlive || other.id === player.id) continue;
    if (passivesBlocked(state, other) || hasCurseIdol(other)) continue;
    let mag = 0;
    for (const h of other.hand) {
      if (h.itemId === 'magnet') mag += h.golden ? 2 : 1;
    }
    if (mag > 0) {
      other.coins += mag;
      state.events.push({
        type: 'income',
        playerId: other.id,
        amount: mag,
        emoji: '🧲',
      });
      emitFx(state, 'magnet', { playerId: other.id });
    }
  }
}

function makeGoldenFrom(
  state: GameState,
  player: Player,
  itemId: ItemId,
  parts: HandItem[],
): HandItem {
  const golden = makeHandItem(state, itemId);
  golden.golden = true;
  golden.currentSellValue = parts.reduce(
    (s, h) => s + sellValueOf(h, player.itemsSold),
    0,
  );
  golden.stored = parts.reduce((s, h) => s + h.stored, 0);
  if (itemId === 'piggy_bank') {
    golden.currentSellValue = 2 + golden.stored;
  }
  if (itemId === 'bomb') {
    golden.bombFuseMs = parts.reduce((s, h) => s + (h.bombFuseMs ?? 0), 0);
    golden.currentSellValue = 100;
  }
  if (itemId === 'bank_note') {
    golden.currentSellValue = player.itemsSold * 2;
  }
  return golden;
}

/** Merge every set of 3 non-golden copies of the same item into one golden. */
function tryAutoMerge(state: GameState, player: Player): void {
  let merged = true;
  while (merged) {
    merged = false;
    const groups = new Map<ItemId, number[]>();
    for (let i = 0; i < player.hand.length; i++) {
      const h = player.hand[i]!;
      if (h.golden) continue;
      const list = groups.get(h.itemId) ?? [];
      list.push(i);
      groups.set(h.itemId, list);
    }
    for (const [itemId, idxs] of groups) {
      if (idxs.length < 3) continue;
      const take = idxs.slice(0, 3);
      const parts = take.map((i) => player.hand[i]!);
      const golden = makeGoldenFrom(state, player, itemId, parts);
      // Remove highest indices first
      for (const i of [...take].sort((a, b) => b - a)) {
        player.hand.splice(i, 1);
      }
      player.hand.push(golden);
      emitFx(state, 'gold_spark', {
        playerId: player.id,
        instanceId: golden.instanceId,
        label: 'GOLD',
      });
      merged = true;
      break;
    }
  }
}

/**
 * When receiving an item: if 2 matches already held, merge with the new one
 * even when the hand is full (no free slot needed for the third).
 */
function tryMergeIncoming(
  state: GameState,
  player: Player,
  itemId: ItemId,
): boolean {
  const matches = player.hand
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.itemId === itemId && !h.golden);
  if (matches.length < 2) return false;

  const take = matches.slice(0, 2);
  const incoming = makeHandItem(state, itemId, itemId === 'bomb');
  const parts = [...take.map((t) => t.h), incoming];
  const golden = makeGoldenFrom(state, player, itemId, parts);
  for (const t of [...take].sort((a, b) => b.i - a.i)) {
    player.hand.splice(t.i, 1);
  }
  player.hand.push(golden);
  emitFx(state, 'gold_spark', {
    playerId: player.id,
    instanceId: golden.instanceId,
    label: 'GOLD',
  });
  return true;
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

export function createInitialState(
  config: LobbyConfig,
  seed?: number,
  presetPool?: ItemId[],
): GameState {
  const actualSeed = seed ?? (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  const rng = createRng(actualSeed);
  const setup = MODE_SETUP[config.mode];
  const archetypes = assignArchetypes(setup.botCount, config.difficulty, rng);

  const identities: PlayerIdentity[] =
    config.identities ??
    (() => {
      const list: PlayerIdentity[] = [
        {
          name: 'You',
          avatar: AVATAR_EMOJIS[Math.floor(rng() * AVATAR_EMOJIS.length)]!,
          color: PLAYER_COLORS[0]!,
          isHuman: true,
          archetype: null,
        },
      ];
      for (let i = 0; i < setup.botCount; i++) {
        list.push({
          name: botName(archetypes[i]!, i),
          avatar: AVATAR_EMOJIS[Math.floor(rng() * AVATAR_EMOJIS.length)]!,
          color: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length]!,
          isHuman: false,
          archetype: archetypes[i]!,
        });
      }
      return list;
    })();

  const humanId = 'player_0';
  const players: Player[] = identities.map((id, i) => ({
    id: `player_${i}`,
    name: id.name,
    avatar: id.avatar,
    color: id.color,
    coins: CONFIG.START_COINS,
    hand: [],
    isHuman: id.isHuman,
    isAlive: true,
    archetype: id.archetype,
    handcuffMs: 0,
    muteMs: 0,
    roiMs: 0,
    roiTargetCoins: 0,
    botCooldownMs: id.isHuman ? 0 : 200 + Math.floor(rng() * 600),
    eliminatedAt: null,
    comebackAccMs: 0,
    itemsSold: 0,
  }));

  // Ensure human id is player_0
  const human = players.find((p) => p.isHuman);
  if (human) {
    // already mapped by identity order with human first from resolveNameAuction
  }

  const tiles: Tile[] = [];
  const itemPool =
    presetPool && presetPool.length > 0 ? [...presetPool] : pickMatchPool(rng);
  for (let i = 0; i < setup.gridSize; i++) {
    tiles.push(makeTile(i, weightedRandomItem(rng, itemPool)));
  }

  return {
    mode: config.mode,
    gridCols: setup.gridCols,
    players,
    tiles,
    roundMs: CONFIG.GAME_LENGTH_MS,
    elapsedMs: 0,
    paceBannerMs: 0,
    humanId: human?.id ?? humanId,
    seed: actualSeed,
    events: [],
    nextInstance: 1,
    ended: false,
    winnerId: null,
    leaderTaxAccMs: 0,
    worldEvent: createWorldEventState(),
    suddenDeath: {
      active: false,
      bracket: CONFIG.SUDDEN_DEATH_START_BRACKET,
      phaseMs: CONFIG.SUDDEN_DEATH_PHASE_MS,
    },
    coldMarketMs: 0,
    itemPool,
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
  Object.assign(tile, makeTile(tileIndex, weightedRandomItem(rng, state.itemPool)));
}

function eliminate(
  state: GameState,
  playerId: string,
  reason: 'unpaid' | 'bomb' | 'bracket' | 'roi' | 'leech',
): void {
  const player = getPlayer(state, playerId);
  if (!player || !player.isAlive) return;
  player.isAlive = false;
  player.eliminatedAt = Date.now();
  player.hand = [];
  player.roiMs = 0;
  player.roiTargetCoins = 0;
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
  // 2 held + incoming → golden immediately (even with a full hand / for bombs)
  if (tryMergeIncoming(state, player, itemId)) {
    tryAutoMerge(state, player);
    return;
  }

  if (itemId === 'bomb') {
    // Bomb always attaches, even beyond hand slots
    player.hand.push(makeHandItem(state, itemId, true));
    tryAutoMerge(state, player);
    return;
  }

  const nonBombCount = player.hand.filter((h) => h.itemId !== 'bomb').length;
  if (nonBombCount >= CONFIG.HAND_SLOTS) {
    const def = getItem(itemId);
    let sell = def.sellValue;
    if (itemId === 'mystery_box') {
      sell = 1 + ((state.nextInstance * 17 + state.seed) % 20);
    }
    if (itemId === 'bank_note') {
      sell = player.itemsSold;
    }
    player.coins += sell;
    state.events.push({
      type: 'overflow_sell',
      playerId: player.id,
      amount: sell,
      emoji: def.emoji,
    });
    recordItemsSold(player, 1);
    const tip = brokerBonus(player);
    if (tip > 0) {
      player.coins += tip;
      state.events.push({
        type: 'income',
        playerId: player.id,
        amount: tip,
        emoji: '🤝',
      });
    }
    return;
  }

  player.hand.push(makeHandItem(state, itemId));
  if (itemId === 'bank_note') syncBankNotes(player);
  tryAutoMerge(state, player);
}

export function reorderHand(
  state: GameState,
  playerId: string,
  fromIndex: number,
  toIndex: number,
): GameState {
  const next = cloneState(state);
  if (next.ended) return next;
  const player = getPlayer(next, playerId);
  if (!player || !player.isAlive) return next;
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= player.hand.length ||
    fromIndex === toIndex
  ) {
    return next;
  }
  const to = Math.min(toIndex, player.hand.length - 1);
  if (to === fromIndex) return next;
  const [moved] = player.hand.splice(fromIndex, 1);
  if (!moved) return next;
  player.hand.splice(to, 0, moved);
  return next;
}

export function computeSellValue(
  item: HandItem,
  rng: () => number,
  itemsSold = 0,
): number {
  if (item.itemId === 'bomb') return item.golden ? 100 : 0;
  if (item.itemId === 'dynamite') return 0;
  if (item.itemId === 'bank_note') {
    return itemsSold * (item.golden ? 2 : 1);
  }
  if (item.itemId === 'mystery_box') {
    const roll = () => 1 + Math.floor(rng() * 20);
    return item.golden ? roll() + roll() : roll();
  }
  if (item.itemId === 'piggy_bank') return 2 + item.stored;
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
  if (tile.bidLocked) return next;
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

  // Regular bomb: pay to defuse. Golden: +100 bonus.
  if (item.itemId === 'bomb') {
    if (item.golden) {
      player.coins += 100;
      next.events.push({
        type: 'income',
        playerId,
        amount: 100,
        emoji: '💣',
      });
    } else {
      const cost = bombDefuseCost(player.coins);
      if (player.coins < cost) return next;
      player.coins -= cost;
      next.events.push({
        type: 'loss',
        playerId,
        amount: cost,
        emoji: '💣',
      });
    }
    player.hand.splice(idx, 1);
    return next;
  }

  const value = computeSellValue(item, rng, player.itemsSold);
  player.hand.splice(idx, 1);
  let payout = value;
  const tip = brokerBonus(player);
  payout += tip;
  player.coins += payout;

  if (value > 0 || tip > 0) {
    next.events.push({
      type: 'income',
      playerId,
      amount: payout,
      emoji: tip > 0 ? '🤝' : getItem(item.itemId).emoji,
    });
  }
  if (item.itemId === 'mystery_box') {
    emitFx(next, 'mystery_sell', { playerId });
  }
  recordItemsSold(player, 1);

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
        // Kickback: +3 (golden +6) per held card on every purchase
        let kick = 0;
        for (const h of winner.hand) {
          if (h.itemId === 'kickback') kick += h.golden ? 6 : CONFIG.KICKBACK_COINS;
        }
        if (kick > 0 && !passivesBlocked(state, winner) && !hasCurseIdol(winner)) {
          winner.coins += kick;
          state.events.push({
            type: 'income',
            playerId: winner.id,
            amount: kick,
            emoji: '🤝',
          });
          emitFx(state, 'kickback', { playerId: winner.id });
        }
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

  // Bomb / mystery are only sellable, not "used"
  if (
    item.itemId === 'bomb' ||
    item.itemId === 'dynamite' ||
    item.itemId === 'mystery_box'
  ) {
    return next;
  }

  if (def.kind !== 'active') return next;

  // Apply effect then consume (remove first so golden-swap hand indices stay valid)
  emitFx(next, 'active_cast', {
    playerId: player.id,
    label: item.golden ? `🌟${def.emoji}` : def.emoji,
  });
  player.hand.splice(idx, 1);
  applyActiveEffect(next, player, item, targets, rng);

  return next;
}

function applyActiveEffect(
  state: GameState,
  player: Player,
  item: HandItem,
  targets: UseTargets,
  rng: () => number,
): void {
  const itemId = item.itemId;
  const mult = item.golden ? 2 : 1;

  switch (itemId) {
    case 'price_doubler': {
      const tile = state.tiles[targets.tileIndex ?? -1];
      if (!tile) return;
      for (let i = 0; i < mult; i++) {
        tile.price = Math.max(1, tile.price * 2);
      }
      tile.flash = 'double';
      tile.flashMs = 500;
      emitFx(state, 'double', { tileIndex: tile.index });
      break;
    }
    case 'reset_hammer': {
      const tile = state.tiles[targets.tileIndex ?? -1];
      if (!tile) return;
      tile.price = startPriceOf(tile.itemId);
      tile.highBidderId = null;
      tile.bidLocked = false;
      emitFx(state, 'hammer', { tileIndex: tile.index });
      if (item.golden) {
        const others = state.tiles.filter((t) => t.index !== tile.index);
        if (others.length > 0) {
          const pick = others[Math.floor(rng() * others.length)]!;
          pick.price = startPriceOf(pick.itemId);
          pick.highBidderId = null;
          pick.bidLocked = false;
          emitFx(state, 'hammer', { tileIndex: pick.index });
        }
      }
      break;
    }
    case 'inflation': {
      for (const tile of state.tiles) {
        tile.price += 3 * mult;
        emitFx(state, 'inflate', {
          tileIndex: tile.index,
          label: `+${3 * mult}`,
        });
      }
      break;
    }
    case 'ipo': {
      if (item.golden) {
        let total = 0;
        for (const h of player.hand) {
          if (h.itemId === 'bomb' || h.itemId === 'dynamite') continue;
          total += sellValueOf(h, player.itemsSold);
        }
        if (total > 0) {
          player.coins += total;
          state.events.push({
            type: 'income',
            playerId: player.id,
            amount: total,
            emoji: '📢',
          });
        }
        emitFx(state, 'gold_spark', {
          playerId: player.id,
          label: `IPO +${total}`,
        });
      } else {
        const handId = targets.handInstanceId;
        if (!handId) return;
        const target = player.hand.find((h) => h.instanceId === handId);
        if (!target || target.itemId === 'bomb' || target.itemId === 'dynamite') {
          return;
        }
        const payout = sellValueOf(target, player.itemsSold);
        if (payout > 0) {
          player.coins += payout;
          state.events.push({
            type: 'income',
            playerId: player.id,
            amount: payout,
            emoji: '📢',
          });
        }
        emitFx(state, 'gold_spark', {
          playerId: player.id,
          instanceId: target.instanceId,
          label: `IPO +${payout}`,
        });
      }
      break;
    }
    case 'time_freeze': {
      if (item.golden) {
        for (const tile of state.tiles) {
          tile.freezeMs = Math.max(tile.freezeMs, CONFIG.MEGA_FREEZE_MS);
          emitFx(state, 'freeze', { tileIndex: tile.index, label: 'MEGA' });
        }
      } else {
        const tile = state.tiles[targets.tileIndex ?? -1];
        if (!tile) return;
        tile.freezeMs = CONFIG.TIME_FREEZE_MS;
        emitFx(state, 'freeze', { tileIndex: tile.index });
      }
      break;
    }
    case 'fast_forward': {
      const ti = targets.tileIndex;
      if (ti === undefined) return;
      emitFx(state, 'fastforward', { tileIndex: ti });
      resolveTile(state, ti, rng);
      if (item.golden) {
        // Resolve a second random live tile
        const others = state.tiles.filter((t) => t.index !== ti);
        if (others.length > 0) {
          const pick = others[Math.floor(rng() * others.length)]!;
          emitFx(state, 'fastforward', { tileIndex: pick.index });
          resolveTile(state, pick.index, rng);
        }
      }
      break;
    }
    case 'swap_portal': {
      if (item.golden) {
        const handId = targets.handInstanceId;
        const ti = targets.tileIndex;
        if (!handId || ti === undefined) return;
        const handIdx = player.hand.findIndex((h) => h.instanceId === handId);
        const tile = state.tiles[ti];
        if (handIdx < 0 || !tile) return;
        const handItem = player.hand[handIdx]!;
        if (handItem.itemId === 'bomb') return;
        // Swap hand item onto board; board item enters hand
        const boardId = tile.itemId;
        tile.itemId = handItem.itemId;
        player.hand.splice(handIdx, 1);
        const incoming = makeHandItem(state, boardId);
        player.hand.push(incoming);
        tryAutoMerge(state, player);
        tile.flash = 'bid';
        tile.flashMs = 300;
        emitFx(state, 'swap', { tileIndex: ti, playerId: player.id });
        break;
      }
      const a = targets.tileIndex;
      const b = targets.tileIndexB;
      if (a === undefined || b === undefined || a === b) return;
      const tileA = state.tiles[a];
      const tileB = state.tiles[b];
      if (!tileA || !tileB) return;
      const tmpItem = tileA.itemId;
      const tmpPrice = tileA.price;
      tileA.itemId = tileB.itemId;
      tileA.price = tileB.price;
      tileB.itemId = tmpItem;
      tileB.price = tmpPrice;
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
      if (item.golden) {
        for (const tile of state.tiles) {
          tile.price = Math.max(1, tile.price - 1);
          tile.timerMs += 2000;
        }
      }
      break;
    }
    case 'handcuffs': {
      const target = getPlayer(state, targets.playerId ?? '');
      if (!target || !target.isAlive || target.id === player.id) return;
      target.handcuffMs = CONFIG.HANDCUFF_MS * mult;
      emitFx(state, 'cuffs', { playerId: target.id });
      break;
    }
    case 'pickpocket': {
      const target = getPlayer(state, targets.playerId ?? '');
      if (!target || !target.isAlive || target.id === player.id) return;
      const gap = Math.max(0, target.coins - player.coins);
      const want = Math.min(6, 3 + Math.floor(gap / 5)) * mult;
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
    case 'heist_kit': {
      const target = getPlayer(state, targets.playerId ?? '');
      if (!target || !target.isAlive || target.id === player.id) return;
      const lootPool = target.hand.filter(
        (h) => h.itemId !== 'bomb' && h.itemId !== 'dynamite',
      );
      if (lootPool.length === 0) return;
      const times = item.golden ? 2 : 1;
      for (let n = 0; n < times; n++) {
        const pool = target.hand.filter(
          (h) => h.itemId !== 'bomb' && h.itemId !== 'dynamite',
        );
        if (pool.length === 0) break;
        const stolen = pool[Math.floor(rng() * pool.length)]!;
        target.hand = target.hand.filter((h) => h.instanceId !== stolen.instanceId);
        player.hand.push(stolen);
        tryAutoMerge(state, player);
      }
      emitFx(state, 'heist', {
        playerId: player.id,
        targetPlayerId: target.id,
      });
      break;
    }
    case 'mute': {
      const target = getPlayer(state, targets.playerId ?? '');
      if (!target || !target.isAlive || target.id === player.id) return;
      target.muteMs = Math.max(target.muteMs, CONFIG.MUTE_MS * mult);
      emitFx(state, 'mute', { playerId: target.id });
      break;
    }
    case 'cold_market': {
      state.coldMarketMs = Math.max(state.coldMarketMs, CONFIG.COLD_MARKET_MS * mult);
      emitFx(state, 'cold_market', { label: 'COLD' });
      break;
    }
    case 'roi': {
      const baseline = player.coins;
      const boosted = Math.floor(baseline * 1.5);
      const gained = boosted - baseline;
      player.coins = boosted;
      player.roiTargetCoins = baseline * 2;
      player.roiMs = CONFIG.ROI_MS * (item.golden ? 2 : 1);
      if (gained > 0) {
        state.events.push({
          type: 'income',
          playerId: player.id,
          amount: gained,
          emoji: '📉',
        });
      }
      emitFx(state, 'roi', { playerId: player.id, label: '1.5×' });
      break;
    }
    case 'bid_lock': {
      const tile = state.tiles[targets.tileIndex ?? -1];
      if (!tile) return;
      tile.bidLocked = true;
      if (item.golden) {
        tile.freezeMs = Math.max(tile.freezeMs, CONFIG.TIME_FREEZE_MS);
      }
      tile.flash = 'bid';
      tile.flashMs = 400;
      emitFx(state, 'cuffs', { tileIndex: tile.index, label: 'LOCK' });
      break;
    }
    case 'chaos_die': {
      forceTriggerWorldEvent(
        state,
        rng,
        item.golden ? 'golden_chaos' : undefined,
      );
      emitFx(state, 'shuffle', {
        playerId: player.id,
        label: item.golden ? '🌟🎲' : '🎲',
      });
      break;
    }
    default:
      break;
  }
}

function tickPassives(state: GameState, dt: number, rng: () => number = Math.random): void {
  const pace = matchPaceMult(state.elapsedMs);
  // Snapshot player ids — eliminations may occur mid-loop
  for (const player of [...state.players]) {
    if (!player.isAlive) continue;

    const haste = hasteFactor(player);
    const tip = tipBonus(player);
    const blocked = passivesBlocked(state, player);
    const cursed = hasCurseIdol(player);

    for (let i = 0; i < player.hand.length; i++) {
      const item = player.hand[i]!;
      const def = getItem(item.itemId);
      if (
        def.kind !== 'passive' &&
        item.itemId !== 'bomb' &&
        item.itemId !== 'dynamite'
      ) {
        continue;
      }

      const selfMult = (item.golden ? 2 : 1) * adjacencyMult(player.hand, i);
      const tick = dt * haste * pace;

      // Bomb fuse (real-time, not hasted)
      if (item.itemId === 'bomb' && item.bombFuseMs !== null) {
        item.bombFuseMs -= dt;
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

      // Dynamite — chew left (or whole hand if golden) every 2s
      if (item.itemId === 'dynamite') {
        item.passiveAccMs += dt;
        while (item.passiveAccMs >= CONFIG.DYNAMITE_TICK_MS) {
          item.passiveAccMs -= CONFIG.DYNAMITE_TICK_MS;
          if (item.golden) {
            const kept = player.hand.filter((h) => h.instanceId === item.instanceId);
            player.hand = kept;
            i = 0;
            emitFx(state, 'dynamite', { playerId: player.id, label: 'BOOM' });
          } else {
            const leftIdx = player.hand.findIndex((h) => h.instanceId === item.instanceId) - 1;
            if (leftIdx >= 0) {
              player.hand.splice(leftIdx, 1);
              i = Math.max(0, i - 1);
              emitFx(state, 'dynamite', { playerId: player.id });
            }
          }
        }
        continue;
      }

      // Aura / non-ticking passives
      if (
        item.itemId === 'mystery_box' ||
        item.itemId === 'bank_note' ||
        item.itemId === 'mirror' ||
        item.itemId === 'tip_jar' ||
        item.itemId === 'haste_gear' ||
        item.itemId === 'magnet' ||
        item.itemId === 'kickback' ||
        item.itemId === 'broker'
      ) {
        continue;
      }

      // Chrysalis — after 20s become a random golden pool item (golden: replace whole hand)
      if (item.itemId === 'chrysalis') {
        if (blocked) continue;
        item.passiveAccMs += tick;
        if (item.passiveAccMs < CONFIG.CHRYSALIS_MS) continue;
        const pool = state.itemPool.filter((id) => id !== 'chrysalis');
        const pickPool = pool.length > 0 ? pool : state.itemPool;

        const spawnGolden = (): HandItem => {
          const newId = weightedRandomItem(rng, pickPool);
          const spawned = makeHandItem(state, newId, newId === 'bomb');
          spawned.golden = true;
          spawned.currentSellValue = Math.max(
            spawned.currentSellValue * 3,
            getItem(newId).sellValue * 3,
          );
          if (spawned.itemId === 'piggy_bank') {
            spawned.currentSellValue = 2 + spawned.stored;
          }
          if (spawned.itemId === 'bomb') spawned.currentSellValue = 100;
          return spawned;
        };

        if (item.golden) {
          player.hand = [];
          for (let n = 0; n < CONFIG.HAND_SLOTS; n++) {
            const spawned = spawnGolden();
            player.hand.push(spawned);
            emitFx(state, 'gold_spark', {
              playerId: player.id,
              instanceId: spawned.instanceId,
              label: 'GOLD',
            });
          }
          emitFx(state, 'mystery_sell', {
            playerId: player.id,
            label: '🦋✨',
          });
          i = -1;
        } else {
          const spawned = spawnGolden();
          player.hand[i] = spawned;
          emitFx(state, 'gold_spark', {
            playerId: player.id,
            instanceId: spawned.instanceId,
            label: 'GOLD',
          });
        }
        continue;
      }

      // Curse Idol — no personal income; drain rivals every 3s
      if (item.itemId === 'curse_idol') {
        item.passiveAccMs += tick;
        while (item.passiveAccMs >= CONFIG.CURSE_TICK_MS) {
          item.passiveAccMs -= CONFIG.CURSE_TICK_MS;
          const drain = selfMult;
          for (const rival of livingPlayers(state)) {
            if (rival.id === player.id) continue;
            const lost = Math.min(drain, rival.coins);
            if (lost <= 0) continue;
            rival.coins -= lost;
            state.events.push({
              type: 'loss',
              playerId: rival.id,
              amount: lost,
              emoji: '🧿',
            });
            emitFx(state, 'curse', {
              playerId: player.id,
              targetPlayerId: rival.id,
            });
            if (rival.coins <= 0) {
              eliminate(state, rival.id, 'leech');
            }
          }
        }
        continue;
      }

      // Gilder — turn neighbors golden after 30s
      if (item.itemId === 'gilder') {
        if (blocked) continue;
        item.gilderAccMs += tick;
        while (item.gilderAccMs >= CONFIG.GILDER_MS) {
          item.gilderAccMs -= CONFIG.GILDER_MS;
          const targets: HandItem[] = [];
          const right = player.hand[i + 1];
          if (right && !right.golden && right.itemId !== 'bomb') targets.push(right);
          if (item.golden) {
            const left = player.hand[i - 1];
            if (left && !left.golden && left.itemId !== 'bomb') targets.push(left);
          }
          for (const t of targets) {
            t.golden = true;
            t.currentSellValue = Math.max(t.currentSellValue * 3, sellValueOf(t) * 3);
            if (t.itemId === 'piggy_bank') t.currentSellValue = 2 + t.stored;
            if (t.itemId === 'bomb') {
              t.currentSellValue = 100;
            }
            emitFx(state, 'gold_spark', {
              playerId: player.id,
              instanceId: t.instanceId,
              label: 'GOLD',
            });
          }
        }
        continue;
      }

      if (blocked || cursed) continue;

      // Piggy banks into itself
      if (item.itemId === 'piggy_bank') {
        item.passiveAccMs += tick;
        while (item.passiveAccMs >= 1000) {
          item.passiveAccMs -= 1000;
          item.stored += selfMult + tip;
          item.currentSellValue = 2 + item.stored;
          emitFx(state, 'piggy', {
            playerId: player.id,
            instanceId: item.instanceId,
          });
        }
        continue;
      }

      // Interest — every 5s add sell value to every hand item (no coins)
      if (item.itemId === 'interest') {
        item.passiveAccMs += tick;
        while (item.passiveAccMs >= CONFIG.INTEREST_TICK_MS) {
          item.passiveAccMs -= CONFIG.INTEREST_TICK_MS;
          const bump = selfMult;
          for (const h of player.hand) {
            if (h.itemId === 'bomb' || h.itemId === 'dynamite') continue;
            if (h.itemId === 'piggy_bank') {
              h.stored += bump;
            } else {
              h.currentSellValue += bump;
            }
          }
          emitFx(state, 'interest', {
            playerId: player.id,
            instanceId: item.instanceId,
            label: `+${bump}💰`,
          });
        }
        continue;
      }

      // Stock Market — sell value ×2 every 20s (golden ×3), starts at 1
      if (item.itemId === 'stock_market') {
        item.passiveAccMs += tick;
        while (item.passiveAccMs >= CONFIG.STOCK_MARKET_MS) {
          item.passiveAccMs -= CONFIG.STOCK_MARKET_MS;
          const factor = item.golden ? 3 : 2;
          item.currentSellValue = Math.max(1, item.currentSellValue * factor);
          emitFx(state, 'dividend', {
            playerId: player.id,
            instanceId: item.instanceId,
            label: `×${factor}`,
          });
        }
        continue;
      }

      // Money Printer — every 10s print a Bank Note into hand
      if (item.itemId === 'money_printer') {
        item.passiveAccMs += tick;
        while (item.passiveAccMs >= CONFIG.PRINTER_NOTE_MS) {
          item.passiveAccMs -= CONFIG.PRINTER_NOTE_MS;
          const copies = item.golden ? 2 : 1;
          for (let n = 0; n < copies; n++) {
            giveItem(state, player, 'bank_note');
          }
          emitFx(state, 'print', {
            playerId: player.id,
            instanceId: item.instanceId,
            label: item.golden ? '💵💵' : '💵',
          });
        }
        continue;
      }

      // Coin Mine — stacks speed up (1 slow, 2 = old pace, 3+ faster)
      if (item.itemId === 'coin_mine') {
        item.passiveAccMs += tick;
        const mines = player.hand.filter((h) => h.itemId === 'coin_mine').length;
        const interval = coinMineIntervalMs(mines);
        while (item.passiveAccMs >= interval) {
          item.passiveAccMs -= interval;
          grantCoins(state, player, selfMult, def.emoji);
          emitFx(state, 'gold_spark', {
            playerId: player.id,
            instanceId: item.instanceId,
          });
        }
        continue;
      }

      // Golden Goose — steady fast drip; golden doubles coins only
      if (item.itemId === 'golden_goose') {
        item.passiveAccMs += tick;
        while (item.passiveAccMs >= CONFIG.GOOSE_MS) {
          item.passiveAccMs -= CONFIG.GOOSE_MS;
          grantCoins(state, player, selfMult, def.emoji);
          emitFx(state, 'goose', {
            playerId: player.id,
            instanceId: item.instanceId,
          });
        }
        continue;
      }

      // Coin leech — blitz: random victim; can eliminate at 0
      if (item.itemId === 'coin_leech') {
        item.passiveAccMs += tick;
        while (item.passiveAccMs >= (def.passiveIntervalMs ?? 4000)) {
          item.passiveAccMs -= def.passiveIntervalMs ?? 4000;
          const victim =
            state.mode === 'blitz'
              ? randomOpponent(state, player.id, rng)
              : richestOpponent(state, player.id);
          if (victim && victim.coins > 0) {
            const gap = victim.coins - player.coins;
            const want = (gap >= CONFIG.COMEBACK_BIG_GAP ? 2 : 1) * selfMult + tip;
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
            if (victim.coins <= 0) {
              eliminate(state, victim.id, 'leech');
            }
          }
        }
        continue;
      }

      // Standard money engines
      if (def.passiveIntervalMs && def.passiveAmount) {
        item.passiveAccMs += tick;
        while (item.passiveAccMs >= def.passiveIntervalMs) {
          item.passiveAccMs -= def.passiveIntervalMs;
          grantCoins(state, player, def.passiveAmount * selfMult, def.emoji);
          emitFx(state, 'gold_spark', {
            playerId: player.id,
            instanceId: item.instanceId,
          });
        }
      }
    }
  }
}

function checkWinConditions(state: GameState): void {
  const alive = livingPlayers(state);
  if (alive.length <= 1) {
    state.ended = true;
    state.winnerId = alive[0]?.id ?? null;
    return;
  }

  // Clock expired → enter sudden death (do not crown richest yet)
  if (!state.suddenDeath.active && state.roundMs <= 0) {
    state.roundMs = 0;
    state.suddenDeath = {
      active: true,
      bracket: CONFIG.SUDDEN_DEATH_START_BRACKET,
      phaseMs: CONFIG.SUDDEN_DEATH_PHASE_MS,
    };
    emitFx(state, 'bomb_fuse', { label: '💀 SD' });
  }
}

function applySuddenDeathCull(state: GameState): void {
  const sd = state.suddenDeath;
  const alive = livingPlayers(state);
  const under = alive.filter((p) => p.coins < sd.bracket);
  const safe = alive.filter((p) => p.coins >= sd.bracket);

  if (under.length === 0) {
    sd.bracket *= 2;
    sd.phaseMs = CONFIG.SUDDEN_DEATH_PHASE_MS;
    emitFx(state, 'inflate', { label: `≥${sd.bracket}` });
    return;
  }

  if (safe.length === 0) {
    // Nobody meets the bar — keep the richest, cull the rest
    const sorted = [...alive].sort((a, b) => b.coins - a.coins);
    const keeper = sorted[0]!;
    for (const p of alive) {
      if (p.id !== keeper.id) eliminate(state, p.id, 'bracket');
    }
  } else {
    for (const p of under) {
      eliminate(state, p.id, 'bracket');
    }
  }

  const still = livingPlayers(state);
  if (still.length <= 1) {
    state.ended = true;
    state.winnerId = still[0]?.id ?? null;
    return;
  }

  sd.bracket *= 2;
  sd.phaseMs = CONFIG.SUDDEN_DEATH_PHASE_MS;
  emitFx(state, 'inflate', { label: `≥${sd.bracket}` });
}

function tickSuddenDeath(state: GameState, dtMs: number): void {
  const sd = state.suddenDeath;
  if (!sd.active || state.ended) return;

  sd.phaseMs -= dtMs;
  while (sd.phaseMs <= 0 && !state.ended && sd.active) {
    applySuddenDeathCull(state);
    if (state.ended) break;
  }
}

export function tick(state: GameState, dtMs: number, rng: () => number = Math.random): GameState {
  const next = cloneState(state);
  if (next.ended) return next;

  // Clear old events each tick (UI consumes via store)
  next.events = [];

  if (!next.suddenDeath.active) {
    next.roundMs = Math.max(0, next.roundMs - dtMs);
  }

  const prevPace = matchPaceMult(next.elapsedMs);
  next.elapsedMs += dtMs;
  const pace = matchPaceMult(next.elapsedMs);
  if (pace > prevPace) {
    next.paceBannerMs = CONFIG.PACE_BANNER_MS;
  } else if (next.paceBannerMs > 0) {
    next.paceBannerMs = Math.max(0, next.paceBannerMs - dtMs);
  }

  tickWorldEvent(next, dtMs, rng);

  if (next.coldMarketMs > 0) {
    next.coldMarketMs = Math.max(0, next.coldMarketMs - dtMs);
  }

  // Status timers
  for (const player of next.players) {
    if (!player.isAlive) continue;
    if (player.handcuffMs > 0) {
      player.handcuffMs = Math.max(0, player.handcuffMs - dtMs);
    }
    if (player.muteMs > 0) {
      player.muteMs = Math.max(0, player.muteMs - dtMs);
    }
    if (player.roiMs > 0) {
      player.roiMs = Math.max(0, player.roiMs - dtMs);
      if (player.coins >= player.roiTargetCoins) {
        player.roiMs = 0;
        player.roiTargetCoins = 0;
        emitFx(next, 'roi', { playerId: player.id, label: 'SAFE' });
      } else if (player.roiMs <= 0) {
        eliminate(next, player.id, 'roi');
      }
    }
    if (!player.isHuman) {
      player.botCooldownMs = Math.max(0, player.botCooldownMs - dtMs);
    }
  }

  const timerScale =
    worldEventTimerScale(next) *
    (next.suddenDeath.active ? 1.25 : 1) *
    pace;

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
    if (timerScale === 0) continue;
    tile.timerMs -= dtMs * timerScale;
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

  tickPassives(next, dtMs, rng);
  tickRubberBand(next, dtMs);
  checkWinConditions(next);
  tickSuddenDeath(next, dtMs);
  // Re-check after cull
  if (!next.ended) checkWinConditions(next);

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

  // Underdog income — light drip only when well behind
  for (const player of alive) {
    const gap = richest.coins - player.coins;
    if (gap < CONFIG.COMEBACK_GAP) {
      player.comebackAccMs = 0;
      continue;
    }
    player.comebackAccMs += dt;
    // Cap at +1 even on big gaps — catch-up should not snowball
    const amount = 1;
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
