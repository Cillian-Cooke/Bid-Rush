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
  reset_hammer: {
    id: 'reset_hammer',
    name: 'Reset Hammer',
    emoji: '🔨',
    kind: 'active',
    target: 'item',
    sellValue: 2,
    startPrice: 1,
    spawnWeight: 4,
  },
  inflation: {
    id: 'inflation',
    name: 'Inflation',
    emoji: '🦗',
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
    name: 'Time Freeze',
    emoji: '❄️',
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
    emoji: '🆕',
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
  cold_market: {
    id: 'cold_market',
    name: 'Cold Market',
    emoji: '🧊',
    kind: 'active',
    target: 'none',
    sellValue: 5,
    startPrice: 4,
    spawnWeight: 2,
  },
  roi: {
    id: 'roi',
    name: 'ROI',
    emoji: '📉',
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
};

export const ITEM_LIST: ItemDef[] = Object.values(ITEMS);

/** How many item types appear in a single match */
export const MATCH_POOL_SIZE = 16;

export function getItem(id: ItemId): ItemDef {
  return ITEMS[id];
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

/** Mine tick interval from how many mines are in hand. */
export function coinMineIntervalMs(mineCount: number): number {
  const n = Math.max(1, mineCount);
  return CONFIG.MINE_BASE_MS / n;
}

/** Progress 0–1 for ticking passives; null if no bar. */
export function passiveChargeProgress(
  item: HandItem,
  hand?: readonly HandItem[],
): number | null {
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

/** Pick a unique random subset of item types for this match. */
export function pickMatchPool(rng: () => number): ItemId[] {
  const ids = ITEM_LIST.filter((i) => i.spawnWeight > 0).map((i) => i.id);
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
