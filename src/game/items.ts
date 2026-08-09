import { CONFIG } from './constants';
import type { HandItem, ItemDef, ItemId } from './types';

/**
 * startPrice: shop listing floor (defaults to max(1, sellValue - 2)).
 * Hazardous / high-impact items use elevated start prices so they don’t
 * snowball eliminations in the opening minute.
 */
export const ITEMS: Record<ItemId, ItemDef> = {
  coin_mine: {
    id: 'coin_mine',
    name: 'Coin Mine',
    emoji: '⛏️',
    kind: 'passive',
    target: 'none',
    sellValue: 4,
    startPrice: 2,
    spawnWeight: 7,
    passiveIntervalMs: 4_800,
    passiveAmount: 1,
  },
  money_printer: {
    id: 'money_printer',
    name: 'Money Printer',
    emoji: '🖨️',
    kind: 'passive',
    target: 'none',
    sellValue: 6,
    startPrice: 4,
    spawnWeight: 5,
    passiveIntervalMs: 20_000,
  },
  golden_goose: {
    id: 'golden_goose',
    name: 'Golden Goose',
    emoji: '🪿',
    kind: 'passive',
    target: 'none',
    sellValue: 8,
    startPrice: 6,
    spawnWeight: 4,
    passiveIntervalMs: 2_000,
    passiveAmount: 1,
  },
  bank_note: {
    id: 'bank_note',
    name: 'Bank Note',
    emoji: '💵',
    kind: 'passive',
    target: 'special',
    sellValue: 0,
    startPrice: 1,
    spawnWeight: 4,
  },
  stock_market: {
    id: 'stock_market',
    name: 'Stock Market',
    emoji: '📈',
    kind: 'passive',
    target: 'none',
    sellValue: 1,
    startPrice: 1,
    spawnWeight: 5,
    passiveIntervalMs: 20_000,
  },
  chaos_die: {
    id: 'chaos_die',
    name: 'Chaos Die',
    emoji: '🎲',
    kind: 'active',
    target: 'none',
    sellValue: 5,
    startPrice: 3,
    spawnWeight: 3,
  },
  chrysalis: {
    id: 'chrysalis',
    name: 'Chrysalis',
    emoji: '🦋',
    kind: 'passive',
    target: 'none',
    sellValue: 3,
    startPrice: 1,
    spawnWeight: 3,
  },
  ipo: {
    id: 'ipo',
    name: 'IPO',
    emoji: '📢',
    kind: 'active',
    target: 'hand',
    sellValue: 4,
    startPrice: 2,
    spawnWeight: 3,
  },
  broker: {
    id: 'broker',
    name: 'Broker',
    emoji: '🤝',
    kind: 'passive',
    target: 'none',
    sellValue: 4,
    startPrice: 2,
    spawnWeight: 3,
  },
  piggy_bank: {
    id: 'piggy_bank',
    name: 'Piggy Bank',
    emoji: '🐖',
    kind: 'passive',
    target: 'none',
    sellValue: 2,
    startPrice: 1,
    spawnWeight: 5,
    passiveIntervalMs: 1_000,
    passiveAmount: 0,
  },
  mystery_box: {
    id: 'mystery_box',
    name: 'Mystery Box',
    emoji: '🎁',
    kind: 'passive',
    target: 'special',
    sellValue: 0,
    startPrice: 2,
    spawnWeight: 3,
  },
  price_doubler: {
    id: 'price_doubler',
    name: 'Price Doubler',
    emoji: '💥',
    kind: 'active',
    target: 'item',
    sellValue: 3,
    startPrice: 1,
    spawnWeight: 4,
  },
  bargain: {
    id: 'bargain',
    name: 'Bargain',
    emoji: '🏷️',
    kind: 'passive',
    target: 'none',
    sellValue: 4,
    startPrice: 2,
    spawnWeight: 4,
  },
  inflation: {
    id: 'inflation',
    name: 'Inflation',
    emoji: '🎈',
    kind: 'active',
    target: 'all-items',
    sellValue: 3,
    startPrice: 1,
    spawnWeight: 3,
  },
  interest: {
    id: 'interest',
    name: 'Interest',
    emoji: '📊',
    kind: 'passive',
    target: 'none',
    sellValue: 4,
    startPrice: 2,
    spawnWeight: 4,
    passiveIntervalMs: 5_000,
  },
  time_freeze: {
    id: 'time_freeze',
    name: 'Freeze',
    emoji: '🧊',
    kind: 'active',
    target: 'item',
    sellValue: 3,
    startPrice: 1,
    spawnWeight: 4,
  },
  fast_forward: {
    id: 'fast_forward',
    name: 'Fast-Forward',
    emoji: '⏩',
    kind: 'active',
    target: 'item',
    sellValue: 4,
    startPrice: 2,
    spawnWeight: 4,
  },
  swap_portal: {
    id: 'swap_portal',
    name: 'Swap Portal',
    emoji: '🌀',
    kind: 'active',
    target: 'two-items',
    sellValue: 3,
    startPrice: 1,
    spawnWeight: 3,
  },
  shop_refresh: {
    id: 'shop_refresh',
    name: 'Shop Refresh',
    emoji: '🔄',
    kind: 'active',
    target: 'none',
    sellValue: 3,
    startPrice: 1,
    spawnWeight: 3,
  },
  handcuffs: {
    id: 'handcuffs',
    name: 'Handcuffs',
    emoji: '🔒',
    kind: 'active',
    target: 'player',
    sellValue: 3,
    startPrice: 2,
    spawnWeight: 4,
  },
  pickpocket: {
    id: 'pickpocket',
    name: 'Pickpocket',
    emoji: '🧤',
    kind: 'active',
    target: 'player',
    sellValue: 3,
    startPrice: 2,
    spawnWeight: 4,
  },
  heist_kit: {
    id: 'heist_kit',
    name: 'Heist Kit',
    emoji: '🥷',
    kind: 'active',
    target: 'player',
    sellValue: 5,
    startPrice: 4,
    spawnWeight: 3,
  },
  mute: {
    id: 'mute',
    name: 'Mute',
    emoji: '🔇',
    kind: 'active',
    target: 'player',
    sellValue: 4,
    startPrice: 3,
    spawnWeight: 3,
  },
  roi: {
    id: 'roi',
    name: 'ROI',
    emoji: '📈',
    kind: 'active',
    target: 'none',
    sellValue: 3,
    startPrice: 3,
    spawnWeight: 2,
  },
  coin_leech: {
    id: 'coin_leech',
    name: 'Coin Leech',
    emoji: '🧛',
    kind: 'passive',
    target: 'none',
    sellValue: 7,
    startPrice: 5,
    spawnWeight: 3,
    passiveIntervalMs: 3_400,
    passiveAmount: 1,
  },
  magnet: {
    id: 'magnet',
    name: 'Magnet',
    emoji: '🧲',
    kind: 'passive',
    target: 'none',
    sellValue: 5,
    startPrice: 4,
    spawnWeight: 3,
  },
  kickback: {
    id: 'kickback',
    name: 'Kickback',
    emoji: '🤝',
    kind: 'passive',
    target: 'none',
    sellValue: 5,
    startPrice: 3,
    spawnWeight: 3,
  },
  curse_idol: {
    id: 'curse_idol',
    name: 'Curse Idol',
    emoji: '🧿',
    kind: 'passive',
    target: 'none',
    sellValue: 6,
    startPrice: 5,
    spawnWeight: 2,
  },
  bomb: {
    id: 'bomb',
    name: 'Bomb',
    emoji: '💣',
    kind: 'active',
    target: 'special',
    sellValue: 0,
    startPrice: 5,
    spawnWeight: 2,
  },
  dynamite: {
    id: 'dynamite',
    name: 'Dynamite',
    emoji: '🧨',
    kind: 'passive',
    target: 'none',
    sellValue: 0,
    startPrice: 5,
    spawnWeight: 2,
  },
  bid_lock: {
    id: 'bid_lock',
    name: 'Bid Lock',
    emoji: '🔐',
    kind: 'active',
    target: 'item',
    sellValue: 3,
    startPrice: 2,
    spawnWeight: 3,
  },
  mirror: {
    id: 'mirror',
    name: 'Mirror',
    emoji: '🪞',
    kind: 'passive',
    target: 'none',
    sellValue: 4,
    startPrice: 2,
    spawnWeight: 3,
  },
  gilder: {
    id: 'gilder',
    name: 'Gilder',
    emoji: '✨',
    kind: 'passive',
    target: 'none',
    sellValue: 5,
    startPrice: 3,
    spawnWeight: 2,
  },
  tip_jar: {
    id: 'tip_jar',
    name: 'Tip Jar',
    emoji: '🫙',
    kind: 'passive',
    target: 'none',
    sellValue: 3,
    startPrice: 1,
    spawnWeight: 3,
  },
  haste_gear: {
    id: 'haste_gear',
    name: 'Haste Gear',
    emoji: '⚙️',
    kind: 'passive',
    target: 'none',
    sellValue: 4,
    startPrice: 2,
    spawnWeight: 3,
  },
  quick_swap: {
    id: 'quick_swap',
    name: 'Quick Swap',
    emoji: '🔀',
    kind: 'active',
    target: 'player',
    sellValue: 4,
    startPrice: 3,
    spawnWeight: 3,
  },
};

export const ITEM_LIST: ItemDef[] = Object.values(ITEMS);

/** How many item types appear in every match (always). */
export const MATCH_POOL_SIZE = 16;

export function getItem(id: ItemId): ItemDef {
  return ITEMS[id];
}

/** True if the player holds Bargain (purchases cost half). */
export function hasBargain(player: { hand: HandItem[] }): boolean {
  return player.hand.some((h) => h.itemId === 'bargain');
}

/** Golden Bargain also resolves shop purchases 25% faster. */
export function hasGoldenBargain(player: { hand: HandItem[] }): boolean {
  return player.hand.some((h) => h.itemId === 'bargain' && h.golden);
}

/** Shop price the player actually pays after Bargain (50% off, min 1). */
export function purchasePriceFor(
  player: { hand: HandItem[] },
  listedPrice: number,
): number {
  if (!hasBargain(player)) return listedPrice;
  return Math.max(1, Math.floor(listedPrice * 0.5));
}

/** Active items that fire immediately - no tile/player/hand pick. */
export function canInstantUse(item: {
  itemId: ItemId;
  golden: boolean;
}): boolean {
  const def = getItem(item.itemId);
  if (def.kind !== 'active') return false;
  if (
    item.itemId === 'bomb' ||
    item.itemId === 'dynamite' ||
    item.itemId === 'mystery_box'
  ) {
    return false;
  }
  if (item.itemId === 'time_freeze' && item.golden) return true;
  if (item.itemId === 'bid_lock' && item.golden) return true;
  if (item.itemId === 'ipo' && item.golden) return true;
  // all-items (e.g. Inflation) confirm via a shop-tile tap, same as IPO→hand
  return def.target === 'none';
}

/** Active that needs the player to tap a tile, rival, or hand item. */
export function needsTargetPick(item: {
  itemId: ItemId;
  golden: boolean;
}): boolean {
  const def = getItem(item.itemId);
  if (def.kind !== 'active') return false;
  return !canInstantUse(item);
}

/** Every spawnable item - Casual can draw its match-16 from this set. */
export function fullMatchPool(): ItemId[] {
  return ITEM_LIST.filter((i) => i.spawnWeight > 0)
    .map((i) => i.id)
    .sort((a, b) => a.localeCompare(b));
}

/** Shop listing floor for a freshly stocked tile. */
export function startPriceOf(id: ItemId): number {
  const def = getItem(id);
  if (def.startPrice != null) return def.startPrice;
  if (def.sellValue <= 0) return 3;
  return Math.max(1, def.sellValue - 2);
}

/** Coins required to defuse a regular bomb. */
export function bombDefuseCost(coins: number): number {
  return Math.max(
    CONFIG.BOMB_SELL_MIN,
    Math.ceil(coins * CONFIG.BOMB_SELL_PCT),
  );
}

export function isMoneyEngine(id: ItemId): boolean {
  return (
    id === 'coin_mine' ||
    id === 'money_printer' ||
    id === 'golden_goose' ||
    id === 'stock_market' ||
    id === 'piggy_bank' ||
    id === 'coin_leech'
  );
}

export function isHazardItem(id: ItemId): boolean {
  return id === 'bomb' || id === 'dynamite';
}

/** Instance ids currently marked by pending Quick Swaps for a player. */
export function quickSwapMarkedIds(
  pending: readonly {
    casterId: string;
    targetId: string;
    msLeft: number;
    golden: boolean;
  }[],
  hand: readonly HandItem[],
  playerId: string,
): { ids: Set<string>; msLeft: number | null } {
  const ids = new Set<string>();
  let msLeft: number | null = null;
  for (const p of pending) {
    if (p.casterId !== playerId && p.targetId !== playerId) continue;
    msLeft = msLeft == null ? p.msLeft : Math.min(msLeft, p.msLeft);
    if (hand.length === 0) continue;
    if (p.golden) {
      for (const h of hand) ids.add(h.instanceId);
    } else if (p.casterId === playerId) {
      ids.add(hand[0]!.instanceId);
    } else {
      ids.add(hand[hand.length - 1]!.instanceId);
    }
  }
  return { ids, msLeft };
}

export type HandLinkSide = 'left' | 'right';

/** Visual adjacency links for hand slots (gilder / dynamite). */
export type HandLinkHints = {
  gildTarget: boolean;
  gildFrom: HandLinkSide[];
  gildProgress: number;
  dynamiteThreat: boolean;
};

/** Item a mirror is currently copying (right first; golden also uses left if no right). */
export function mirrorFocusTarget(
  hand: readonly HandItem[],
  index: number,
  mirror: HandItem,
): HandItem | null {
  const right = hand[index + 1] ?? null;
  if (right) return right;
  if (mirror.golden) return hand[index - 1] ?? null;
  return null;
}

export function handLinkHints(
  hand: readonly HandItem[],
  index: number,
): HandLinkHints {
  const item = hand[index] ?? null;
  const left = hand[index - 1];
  const right = hand[index + 1];

  const gildFrom: HandLinkSide[] = [];
  let gildProgress = 0;
  if (left?.itemId === 'gilder') {
    gildFrom.push('left');
    gildProgress = Math.max(gildProgress, left.gilderAccMs / CONFIG.GILDER_MS);
  }
  if (right?.itemId === 'gilder' && right.golden) {
    gildFrom.push('right');
    gildProgress = Math.max(gildProgress, right.gilderAccMs / CONFIG.GILDER_MS);
  }
  const canGild =
    !!item && !item.golden && item.itemId !== 'bomb' && gildFrom.length > 0;

  const dynamiteThreat = !!right && right.itemId === 'dynamite' && !right.golden && !!item;

  return {
    gildTarget: canGild,
    gildFrom: canGild ? gildFrom : [],
    gildProgress: canGild ? Math.min(1, gildProgress) : 0,
    dynamiteThreat,
  };
}

/** Mine tick interval from how many mines are in hand. */
export function coinMineIntervalMs(mineCount: number): number {
  const n = Math.max(1, mineCount);
  return CONFIG.MINE_BASE_MS / n;
}

/** Progress 0–1 for ticking passives; null if no bar. */
export function passiveChargeProgress(
  item: HandItem,
  hand?: readonly HandItem[],
  index?: number,
): number | null {
  if (item.itemId === 'mirror' && hand && index != null) {
    const focus = mirrorFocusTarget(hand, index, item);
    if (!focus || focus.itemId === 'mirror') return null;
    return passiveChargeProgress(
      focus,
      hand,
      hand.findIndex((h) => h.instanceId === focus.instanceId),
    );
  }
  const def = getItem(item.itemId);
  if (item.itemId === 'gilder') {
    return Math.min(1, item.gilderAccMs / CONFIG.GILDER_MS);
  }
  if (item.itemId === 'chrysalis') {
    return Math.min(1, item.passiveAccMs / CONFIG.CHRYSALIS_MS);
  }
  if (item.itemId === 'stock_market') {
    return Math.min(1, item.passiveAccMs / CONFIG.STOCK_MARKET_MS);
  }
  if (item.itemId === 'dynamite') {
    return Math.min(1, item.passiveAccMs / CONFIG.DYNAMITE_TICK_MS);
  }
  if (item.itemId === 'piggy_bank') {
    return Math.min(1, item.passiveAccMs / 1000);
  }
  if (item.itemId === 'interest') {
    return Math.min(1, item.passiveAccMs / CONFIG.INTEREST_TICK_MS);
  }
  if (item.itemId === 'money_printer') {
    return Math.min(1, item.passiveAccMs / CONFIG.PRINTER_NOTE_MS);
  }
  if (item.itemId === 'coin_mine') {
    const count = hand
      ? hand.filter((h) => h.itemId === 'coin_mine').length
      : 1;
    return Math.min(1, item.passiveAccMs / coinMineIntervalMs(count));
  }
  if (item.itemId === 'golden_goose') {
    return Math.min(1, item.passiveAccMs / CONFIG.GOOSE_MS);
  }
  if (item.itemId === 'coin_leech' || item.itemId === 'curse_idol') {
    const interval = def.passiveIntervalMs ?? 4000;
    return Math.min(1, item.passiveAccMs / interval);
  }
  if (def.kind === 'passive' && def.passiveIntervalMs && def.passiveAmount) {
    return Math.min(1, item.passiveAccMs / def.passiveIntervalMs);
  }
  return null;
}

/**
 * Pick exactly MATCH_POOL_SIZE unique item types for this match.
 * `from` = candidates (Casual: all spawnable; Ranked: unlock catalog).
 */
export function pickMatchPool(
  rng: () => number,
  from?: readonly ItemId[],
): ItemId[] {
  const ids = (
    from && from.length > 0
      ? [...from]
      : ITEM_LIST.filter((i) => i.spawnWeight > 0).map((i) => i.id)
  ).filter((id) => ITEMS[id]?.spawnWeight > 0);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = ids[i]!;
    ids[i] = ids[j]!;
    ids[j] = tmp;
  }
  const size = Math.min(MATCH_POOL_SIZE, ids.length);
  return ids.slice(0, size).sort((a, b) => a.localeCompare(b));
}

export function weightedRandomItem(
  rng: () => number,
  pool?: readonly ItemId[],
): ItemId {
  const list =
    pool && pool.length > 0
      ? pool.map((id) => ITEMS[id]).filter(Boolean)
      : ITEM_LIST.filter((i) => i.spawnWeight > 0);
  const total = list.reduce((s, i) => s + i.spawnWeight, 0);
  let roll = rng() * total;
  for (const item of list) {
    roll -= item.spawnWeight;
    if (roll <= 0) return item.id;
  }
  return list[list.length - 1]!.id;
}
