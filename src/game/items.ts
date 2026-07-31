import { CONFIG } from './constants';
import type { HandItem, ItemDef, ItemId } from './types';

export const ITEMS: Record<ItemId, ItemDef> = {
  coin_mine: {
    id: 'coin_mine',
    name: 'Coin Mine',
    emoji: '⛏️',
    kind: 'passive',
    target: 'none',
    sellValue: 4,
    spawnWeight: 8,
    passiveIntervalMs: 2_500,
    passiveAmount: 1,
  },
  money_printer: {
    id: 'money_printer',
    name: 'Money Printer',
    emoji: '🖨️',
    kind: 'passive',
    target: 'none',
    sellValue: 6,
    spawnWeight: 6,
    passiveIntervalMs: 4_200,
    passiveAmount: 2,
  },
  golden_goose: {
    id: 'golden_goose',
    name: 'Golden Goose',
    emoji: '🪿',
    kind: 'passive',
    target: 'none',
    sellValue: 8,
    spawnWeight: 5,
    passiveIntervalMs: 1_700,
    passiveAmount: 1,
  },
  dividend_stock: {
    id: 'dividend_stock',
    name: 'Dividend Stock',
    emoji: '📈',
    kind: 'passive',
    target: 'none',
    sellValue: 3,
    spawnWeight: 5,
    passiveIntervalMs: 3_400,
    passiveAmount: 1,
  },
  piggy_bank: {
    id: 'piggy_bank',
    name: 'Piggy Bank',
    emoji: '🐖',
    kind: 'passive',
    target: 'none',
    sellValue: 2,
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
    spawnWeight: 3,
  },
  price_doubler: {
    id: 'price_doubler',
    name: 'Price Doubler',
    emoji: '💥',
    kind: 'active',
    target: 'item',
    sellValue: 3,
    spawnWeight: 4,
  },
  discount_tag: {
    id: 'discount_tag',
    name: 'Discount Tag',
    emoji: '🏷️',
    kind: 'active',
    target: 'item',
    sellValue: 2,
    spawnWeight: 5,
  },
  reset_hammer: {
    id: 'reset_hammer',
    name: 'Reset Hammer',
    emoji: '🔨',
    kind: 'active',
    target: 'item',
    sellValue: 2,
    spawnWeight: 4,
  },
  inflation: {
    id: 'inflation',
    name: 'Inflation',
    emoji: '🦗',
    kind: 'active',
    target: 'all-items',
    sellValue: 3,
    spawnWeight: 3,
  },
  time_freeze: {
    id: 'time_freeze',
    name: 'Time Freeze',
    emoji: '❄️',
    kind: 'active',
    target: 'item',
    sellValue: 3,
    spawnWeight: 4,
  },
  fast_forward: {
    id: 'fast_forward',
    name: 'Fast-Forward',
    emoji: '⏩',
    kind: 'active',
    target: 'item',
    sellValue: 4,
    spawnWeight: 4,
  },
  overtime: {
    id: 'overtime',
    name: 'Overtime',
    emoji: '⏳',
    kind: 'active',
    target: 'item',
    sellValue: 2,
    spawnWeight: 4,
  },
  swap_portal: {
    id: 'swap_portal',
    name: 'Swap Portal',
    emoji: '🌀',
    kind: 'active',
    target: 'two-items',
    sellValue: 3,
    spawnWeight: 3,
  },
  shop_refresh: {
    id: 'shop_refresh',
    name: 'Shop Refresh',
    emoji: '🆕',
    kind: 'active',
    target: 'none',
    sellValue: 3,
    spawnWeight: 3,
  },
  shuffle: {
    id: 'shuffle',
    name: 'Shuffle',
    emoji: '🎲',
    kind: 'active',
    target: 'none',
    sellValue: 2,
    spawnWeight: 3,
  },
  handcuffs: {
    id: 'handcuffs',
    name: 'Handcuffs',
    emoji: '🔒',
    kind: 'active',
    target: 'player',
    sellValue: 3,
    spawnWeight: 4,
  },
  pickpocket: {
    id: 'pickpocket',
    name: 'Pickpocket',
    emoji: '🧤',
    kind: 'active',
    target: 'player',
    sellValue: 3,
    spawnWeight: 4,
  },
  coin_leech: {
    id: 'coin_leech',
    name: 'Coin Leech',
    emoji: '🧛',
    kind: 'passive',
    target: 'none',
    sellValue: 5,
    spawnWeight: 3,
    passiveIntervalMs: 3_400,
    passiveAmount: 1,
  },
  bomb: {
    id: 'bomb',
    name: 'Bomb',
    emoji: '💣',
    kind: 'active',
    target: 'special',
    sellValue: 0,
    spawnWeight: 2,
  },
  bid_lock: {
    id: 'bid_lock',
    name: 'Bid Lock',
    emoji: '🔐',
    kind: 'active',
    target: 'item',
    sellValue: 3,
    spawnWeight: 3,
  },
  blank_slate: {
    id: 'blank_slate',
    name: 'Blank Slate',
    emoji: '⬜',
    kind: 'active',
    target: 'none',
    sellValue: 2,
    spawnWeight: 2,
  },
  echo_lens: {
    id: 'echo_lens',
    name: 'Echo Lens',
    emoji: '🪞',
    kind: 'passive',
    target: 'none',
    sellValue: 4,
    spawnWeight: 3,
  },
  gilder: {
    id: 'gilder',
    name: 'Gilder',
    emoji: '✨',
    kind: 'passive',
    target: 'none',
    sellValue: 5,
    spawnWeight: 2,
  },
  tip_jar: {
    id: 'tip_jar',
    name: 'Tip Jar',
    emoji: '🫙',
    kind: 'passive',
    target: 'none',
    sellValue: 3,
    spawnWeight: 3,
  },
  haste_gear: {
    id: 'haste_gear',
    name: 'Haste Gear',
    emoji: '⚙️',
    kind: 'passive',
    target: 'none',
    sellValue: 4,
    spawnWeight: 3,
  },
};

export const ITEM_LIST: ItemDef[] = Object.values(ITEMS);

/** How many item types appear in a single match */
export const MATCH_POOL_SIZE = 16;

export function getItem(id: ItemId): ItemDef {
  return ITEMS[id];
}

export function isMoneyEngine(id: ItemId): boolean {
  return (
    id === 'coin_mine' ||
    id === 'money_printer' ||
    id === 'golden_goose' ||
    id === 'dividend_stock' ||
    id === 'piggy_bank' ||
    id === 'coin_leech'
  );
}

/** Progress 0–1 for ticking passives; null if no bar. */
export function passiveChargeProgress(item: HandItem): number | null {
  const def = getItem(item.itemId);
  if (item.itemId === 'gilder') {
    return Math.min(1, item.gilderAccMs / CONFIG.GILDER_MS);
  }
  if (item.itemId === 'piggy_bank') {
    return Math.min(1, item.passiveAccMs / 1000);
  }
  if (item.itemId === 'dividend_stock' || item.itemId === 'coin_leech') {
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
  const ids = ITEM_LIST.map((i) => i.id);
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
      : ITEM_LIST;
  const total = list.reduce((s, i) => s + i.spawnWeight, 0);
  let roll = rng() * total;
  for (const item of list) {
    roll -= item.spawnWeight;
    if (roll <= 0) return item.id;
  }
  return list[list.length - 1]!.id;
}
