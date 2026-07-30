import type { ItemDef, ItemId } from './types';

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
};

export const ITEM_LIST: ItemDef[] = Object.values(ITEMS);

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

export function weightedRandomItem(rng: () => number): ItemId {
  const total = ITEM_LIST.reduce((s, i) => s + i.spawnWeight, 0);
  let roll = rng() * total;
  for (const item of ITEM_LIST) {
    roll -= item.spawnWeight;
    if (roll <= 0) return item.id;
  }
  return ITEM_LIST[ITEM_LIST.length - 1]!.id;
}
