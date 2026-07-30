export type ItemKind = 'passive' | 'active';

export type ItemTarget =
  | 'none'
  | 'item'
  | 'two-items'
  | 'player'
  | 'all-items'
  | 'special';

export type BotArchetype = 'chill' | 'balanced' | 'ruthless';

export type DifficultyMode = 'mixed' | 'chill' | 'balanced' | 'ruthless';

export type Phase = 'lobby' | 'countdown' | 'playing' | 'results';

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
  | 'bomb';

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
  /** Accumulator for passive tick timing */
  passiveAccMs: number;
  /** Dividend sell-value growth accumulator */
  dividendGrowAccMs: number;
  /** Current sell value (Dividend / Piggy override base) */
  currentSellValue: number;
  /** Piggy bank stored coins */
  stored: number;
  /** Bomb fuse remaining ms */
  bombFuseMs: number | null;
};

export type Tile = {
  index: number;
  itemId: ItemId;
  price: number;
  timerMs: number;
  highBidderId: string | null;
  /** Remaining freeze ms; timer doesn't tick while > 0 */
  freezeMs: number;
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
  | 'active_cast';

export type GameEvent =
  | { type: 'income'; playerId: string; amount: number; emoji: string }
  | { type: 'eliminate'; playerId: string; reason: 'unpaid' | 'bomb' }
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

export type GameState = {
  players: Player[];
  tiles: Tile[];
  roundMs: number;
  humanId: string;
  seed: number;
  events: GameEvent[];
  /** Instance counter for unique hand item ids */
  nextInstance: number;
  ended: boolean;
  winnerId: string | null;
  /** Accumulator for richest-player crown tax */
  leaderTaxAccMs: number;
};

export type LobbyConfig = {
  botCount: number;
  difficulty: DifficultyMode;
  humanName: string;
  humanAvatar: string;
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
};

export type TargetingMode = {
  playerId: string;
  instanceId: string;
  itemId: ItemId;
  target: ItemTarget;
  selectedTile?: number;
};

export type RankingEntry = {
  player: Player;
  place: number;
  isWinner: boolean;
};
