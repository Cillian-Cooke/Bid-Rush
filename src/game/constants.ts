import type { GameMode } from './types';

export type { GameMode };

const LIVE_CONFIG = {
  MAX_PLAYERS: 8,
  START_COINS: 10,
  TILE_TIMER_MS: 10_000,
  START_PRICE: 1,
  BID_INCREMENT: 1,
  HAND_SLOTS: 7,
  /** Coin Mine base interval (1 mine). Stacks divide this (2 → half, 3 → third, …) */
  MINE_BASE_MS: 4_800,
  /** Golden Goose tick */
  GOOSE_MS: 2_000,
  /** Money Printer: spawn a Bank Note */
  PRINTER_NOTE_MS: 20_000,
  GAME_LENGTH_MS: 180_000,
  BOMB_FUSE_MS: 5_000,
  /** Minimum coins to defuse a regular bomb */
  BOMB_SELL_MIN: 30,
  /** Or this fraction of current wallet — whichever is higher */
  BOMB_SELL_PCT: 0.1,
  DYNAMITE_TICK_MS: 2_000,
  MUTE_MS: 8_000,
  COLD_MARKET_MS: 10_000,
  ROI_MS: 30_000,
  CURSE_TICK_MS: 3_000,
  KICKBACK_COINS: 3,
  TICK_MS: 100,
  HANDCUFF_MS: 6_000,
  /** Quick Swap: delay before leftmost ↔ rightmost (or full hands) */
  QUICK_SWAP_MS: 10_000,
  TIME_FREEZE_MS: 6_000,
  MEGA_FREEZE_MS: 4_000,
  GILDER_MS: 30_000,
  /** Chrysalis → random golden pool item */
  CHRYSALIS_MS: 20_000,
  /** Interest: +sell value to whole hand */
  INTEREST_TICK_MS: 5_000,
  /** Stock Market: multiply sell value */
  STOCK_MARKET_MS: 20_000,
  COUNTDOWN_MS: 3_000,
  COMEBACK_GAP: 12,
  COMEBACK_INTERVAL_MS: 9_000,
  COMEBACK_BIG_GAP: 28,
  LEADER_TAX_GAP: 16,
  LEADER_TAX_INTERVAL_MS: 12_000,
  MAX_ACTIVE_BIDS: 3,
  /** Pre-match handle auction length */
  NAME_AUCTION_MS: 5_000,
  /** Match item pool stays on screen this long (from scheduled start) */
  POOL_REVEAL_MS: 5_000,
  /** Mid-match floor event (warn @ 2:30, live @ 2:00 for 30s) */
  EVENT_WARN_AT_MS: 150_000,
  /** World event: starts when clock hits 2:00 */
  EVENT_START_AT_MS: 120_000,
  /** World event live duration */
  EVENT_DURATION_MS: 30_000,
  /** Periodic world-event pulse (tax, shower, shuffle, inflate) */
  EVENT_PULSE_MS: 5_000,
  /** Sudden death: time per coin bracket before cull */
  SUDDEN_DEATH_PHASE_MS: 30_000,
  /** Sudden death: first coin threshold */
  SUDDEN_DEATH_START_BRACKET: 100,
  /** How long the pace-change banner stays up */
  PACE_BANNER_MS: 2_800,
} as const;

export type RuntimeConfig = {
  -readonly [K in keyof typeof LIVE_CONFIG]: (typeof LIVE_CONFIG)[K] extends number
    ? number
    : (typeof LIVE_CONFIG)[K];
};

/** Mutable runtime config (shorts profile may patch values at boot). */
export const CONFIG: RuntimeConfig = { ...LIVE_CONFIG };

export const MODE_SETUP = {
  duel: {
    id: 'duel' as const,
    label: 'Duel',
    blurb: '1v1 on a tight 3×3 floor',
    players: 2,
    botCount: 1,
    gridSize: 9,
    gridCols: 3,
    /** Max weighted copies of one item type in play (shop + hands; golden = 3) */
    maxInPlay: 10,
  },
  blitz: {
    id: 'blitz' as const,
    label: 'Blitz',
    blurb: '4 players, chaotic 4×4 floor',
    players: 4,
    botCount: 3,
    gridSize: 16,
    gridCols: 4,
    /** Max weighted copies of one item type in play (shop + hands; golden = 3) */
    maxInPlay: 16,
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
