import type { GameMode } from './types';

export type { GameMode };

export const CONFIG = {
  MAX_PLAYERS: 8,
  START_COINS: 10,
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
  COMEBACK_GAP: 6,
  COMEBACK_INTERVAL_MS: 5_000,
  COMEBACK_BIG_GAP: 14,
  LEADER_TAX_GAP: 8,
  LEADER_TAX_INTERVAL_MS: 7_000,
  MAX_ACTIVE_BIDS: 3,
  /** Pre-match handle auction length */
  NAME_AUCTION_MS: 5_000,
  /** World event: banner warning when clock hits 2:30 */
  EVENT_WARN_AT_MS: 150_000,
  /** World event: starts when clock hits 2:00 */
  EVENT_START_AT_MS: 120_000,
  /** World event live duration */
  EVENT_DURATION_MS: 30_000,
  /** Periodic world-event pulse (tax, shower, shuffle, inflate) */
  EVENT_PULSE_MS: 5_000,
} as const;

export const MODE_SETUP = {
  duel: {
    id: 'duel' as const,
    label: 'Duel',
    blurb: '1v1 on a tight 3×3 floor',
    players: 2,
    botCount: 1,
    gridSize: 9,
    gridCols: 3,
  },
  blitz: {
    id: 'blitz' as const,
    label: 'Blitz',
    blurb: '8 players, chaotic 4×4 floor',
    players: 8,
    botCount: 7,
    gridSize: 16,
    gridCols: 4,
  },
} as const;

export const PLAYER_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
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

/** Quirky handles for the pre-match Tag Sale */
export const HANDLE_POOL: { name: string; avatar: string }[] = [
  { name: 'Coin Goblin', avatar: '👺' },
  { name: 'Bid Witch', avatar: '🧙' },
  { name: 'Purse Wolf', avatar: '🐺' },
  { name: 'Tap Typhoon', avatar: '🌪️' },
  { name: 'Ledger Fox', avatar: '🦊' },
  { name: 'Vault Moth', avatar: '🦋' },
  { name: 'Snatch Cat', avatar: '🐱' },
  { name: 'Penny Drake', avatar: '🐉' },
  { name: 'Hammer Head', avatar: '🦈' },
  { name: 'Ice Broker', avatar: '🐧' },
  { name: 'Lucky Gator', avatar: '🐊' },
  { name: 'Boom Badger', avatar: '🦡' },
  { name: 'Mint Raven', avatar: '🐦‍⬛' },
  { name: 'Greed Owl', avatar: '🦉' },
  { name: 'Cash Cobra', avatar: '🐍' },
  { name: 'Blink Bat', avatar: '🦇' },
];
