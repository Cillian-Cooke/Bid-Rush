export const CONFIG = {
  MAX_PLAYERS: 8,
  START_COINS: 10,
  GRID_SIZE: 9,
  TILE_TIMER_MS: 10_000,
  START_PRICE: 1,
  BID_INCREMENT: 1,
  HAND_SLOTS: 5,
  GAME_LENGTH_MS: 180_000,
  BOMB_FUSE_MS: 12_000,
  TICK_MS: 100,
  HANDCUFF_MS: 6_000,
  TIME_FREEZE_MS: 6_000,
  OVERTIME_MS: 6_000,
  COUNTDOWN_MS: 3_000,
  /** Gap vs richest before underdog income kicks in */
  COMEBACK_GAP: 6,
  COMEBACK_INTERVAL_MS: 5_000,
  /** Extra underdog income when this far behind */
  COMEBACK_BIG_GAP: 14,
  /** Gap vs 2nd place before leader pays crown tax */
  LEADER_TAX_GAP: 8,
  LEADER_TAX_INTERVAL_MS: 7_000,
  /** Max tiles a player can be high-bidder on at once */
  MAX_ACTIVE_BIDS: 3,
} as const;

export const PLAYER_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
] as const;

export const AVATAR_EMOJIS = [
  '😎',
  '🤠',
  '🦊',
  '🐱',
  '🐸',
  '🦁',
  '🐼',
  '🐯',
  '🦄',
  '🐲',
  '👾',
  '🤖',
] as const;
