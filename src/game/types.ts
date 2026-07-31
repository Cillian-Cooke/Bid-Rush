export type ItemKind = 'passive' | 'active';

export type ItemTarget =
  | 'none'
  | 'item'
  | 'two-items'
  | 'player'
  | 'all-items'
  | 'special'
  | 'hand-then-item';

export type BotArchetype = 'chill' | 'balanced' | 'ruthless';

export type DifficultyMode = 'mixed' | 'chill' | 'balanced' | 'ruthless';

export type Phase = 'lobby' | 'naming' | 'countdown' | 'playing' | 'results';

export type GameMode = 'duel' | 'blitz';

export type PlayerIdentity = {
  name: string;
  avatar: string;
  color: string;
  isHuman: boolean;
  archetype: BotArchetype | null;
};

export type NameTag = {
  id: string;
  name: string;
  avatar: string;
  price: number;
  highBidderId: string | null;
};

export type NameAuctionParticipant = {
  id: string;
  isHuman: boolean;
  color: string;
  /** Bot bid cooldown */
  cooldownMs: number;
};

export type NameAuctionState = {
  mode: GameMode;
  difficulty: DifficultyMode;
  tags: NameTag[];
  participants: NameAuctionParticipant[];
  humanId: string;
  msLeft: number;
  seed: number;
};

export type ItemId =
  | 'coin_mine'
  | 'money_printer'
  | 'golden_goose'
  | 'dividend_stock'
  | 'piggy_bank'
  | 'mystery_box'
  | 'price_doubler'
  | 'discount_tag'
  | 'reset_hammer'
  | 'inflation'
  | 'time_freeze'
  | 'fast_forward'
  | 'overtime'
  | 'swap_portal'
  | 'shop_refresh'
  | 'shuffle'
  | 'handcuffs'
  | 'pickpocket'
  | 'coin_leech'
  | 'bomb'
  | 'bid_lock'
  | 'blank_slate'
  | 'echo_lens'
  | 'gilder'
  | 'tip_jar'
  | 'haste_gear';

export type ItemDef = {
  id: ItemId;
  name: string;
  emoji: string;
  kind: ItemKind;
  target: ItemTarget;
  sellValue: number;
  spawnWeight: number;
  /** Passive income interval in ms (if applicable) */
  passiveIntervalMs?: number;
  /** Coins gained per passive tick */
  passiveAmount?: number;
};

export type HandItem = {
  instanceId: string;
  itemId: ItemId;
  /** Three-of-a-kind merge — doubles effects, sells for combined value */
  golden: boolean;
  /** Accumulator for passive tick timing */
  passiveAccMs: number;
  /** Dividend sell-value growth accumulator */
  dividendGrowAccMs: number;
  /** Current sell value (Dividend / Piggy / golden merge override) */
  currentSellValue: number;
  /** Piggy bank stored coins */
  stored: number;
  /** Bomb fuse remaining ms */
  bombFuseMs: number | null;
  /** Gilder: ms toward making a neighbor golden */
  gilderAccMs: number;
};

export type Tile = {
  index: number;
  itemId: ItemId;
  price: number;
  timerMs: number;
  highBidderId: string | null;
  /** Remaining freeze ms; timer doesn't tick while > 0 */
  freezeMs: number;
  /** Nobody can outbid this tile until it resolves */
  bidLocked: boolean;
  /** Visual flash: 'resolve' | 'double' | 'bid' | null */
  flash: string | null;
  flashMs: number;
};

export type Player = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  coins: number;
  hand: HandItem[];
  isHuman: boolean;
  isAlive: boolean;
  archetype: BotArchetype | null;
  /** Remaining handcuff ms */
  handcuffMs: number;
  /** Bot decision cooldown remaining */
  botCooldownMs: number;
  /** Placement when eliminated (1 = winner later) */
  eliminatedAt: number | null;
  /** Accumulator for underdog catch-up income */
  comebackAccMs: number;
};

export type FxKind =
  | 'gold_spark'
  | 'print'
  | 'goose'
  | 'dividend'
  | 'piggy'
  | 'mystery_sell'
  | 'leech'
  | 'double'
  | 'discount'
  | 'hammer'
  | 'inflate'
  | 'freeze'
  | 'fastforward'
  | 'overtime'
  | 'swap'
  | 'refresh'
  | 'shuffle'
  | 'cuffs'
  | 'pickpocket'
  | 'bomb_fuse'
  | 'tile_label'
  | 'active_cast'
  | 'event_money'
  | 'event_tax'
  | 'event_shower';

export type WorldEventId =
  | 'money_money_money'
  | 'tax_collector'
  | 'fire_sale'
  | 'deep_freeze'
  | 'turbo_market'
  | 'bomb_bazaar'
  | 'coin_shower'
  | 'shuffle_storm'
  | 'inflation_wave'
  | 'mystery_mall';

export type WorldEventPhase = 'pending' | 'warning' | 'active' | 'done';

export type WorldEventState = {
  id: WorldEventId | null;
  phase: WorldEventPhase;
  /** Remaining duration while phase === 'active' */
  activeMs: number;
  pulseAccMs: number;
  fxAccMs: number;
};

export type WorldEventDef = {
  id: WorldEventId;
  name: string;
  emoji: string;
  blurb: string;
  warnLine: string;
  activeLine: string;
  accent: string;
  fxKind: FxKind;
};

export type GameEvent =
  | { type: 'income'; playerId: string; amount: number; emoji: string }
  | { type: 'loss'; playerId: string; amount: number; emoji: string }
  | {
      type: 'overflow_sell';
      playerId: string;
      amount: number;
      emoji: string;
    }
  | {
      type: 'eliminate';
      playerId: string;
      reason: 'unpaid' | 'bomb' | 'bracket';
    }
  | { type: 'resolve'; tileIndex: number; winnerId: string | null }
  | { type: 'explosion'; playerId: string }
  | {
      type: 'fx';
      kind: FxKind;
      playerId?: string;
      /** Secondary player (e.g. leech victim, pickpocket target) */
      targetPlayerId?: string;
      tileIndex?: number;
      tileIndexB?: number;
      /** Optional short label e.g. "+6s" */
      label?: string;
      /** Hand item instance for hand-slot pulses */
      instanceId?: string;
    };

export type SuddenDeathState = {
  active: boolean;
  /** Current coin threshold players must meet */
  bracket: number;
  /** Ms left in this bracket phase before cull */
  phaseMs: number;
};

export type GameState = {
  mode: GameMode;
  gridCols: number;
  players: Player[];
  tiles: Tile[];
  roundMs: number;
  /** Wall-clock match time — keeps rising through sudden death */
  elapsedMs: number;
  /** Ms left showing the pace-up banner (0 = hidden) */
  paceBannerMs: number;
  humanId: string;
  seed: number;
  events: GameEvent[];
  /** Instance counter for unique hand item ids */
  nextInstance: number;
  ended: boolean;
  winnerId: string | null;
  /** Accumulator for richest-player crown tax */
  leaderTaxAccMs: number;
  /** Mid-match floor event (warn @ 2:30, live @ 2:00 for 30s) */
  worldEvent: WorldEventState;
  suddenDeath: SuddenDeathState;
  /** 16 item types available in this match */
  itemPool: ItemId[];
};

export type LobbyConfig = {
  mode: GameMode;
  difficulty: DifficultyMode;
  /** Filled after Tag Sale; optional until naming resolves */
  identities?: PlayerIdentity[];
};

export type GameAction =
  | { type: 'bid'; playerId: string; tileIndex: number }
  | { type: 'sell'; playerId: string; instanceId: string }
  | { type: 'use'; playerId: string; instanceId: string; targets: UseTargets }
  | { type: 'tick'; dtMs: number };

export type UseTargets = {
  tileIndex?: number;
  tileIndexB?: number;
  playerId?: string;
  /** Hand item to swap onto the board (golden swap portal) */
  handInstanceId?: string;
};

export type TargetingMode = {
  playerId: string;
  instanceId: string;
  itemId: ItemId;
  target: ItemTarget;
  selectedTile?: number;
  /** Golden swap: hand item chosen to place on the board */
  selectedHandInstanceId?: string;
  /** Runtime golden flag of the casting item */
  golden?: boolean;
};

export type RankingEntry = {
  player: Player;
  place: number;
  isWinner: boolean;
};
