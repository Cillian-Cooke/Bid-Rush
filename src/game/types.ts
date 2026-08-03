export type ItemKind = 'passive' | 'active';

export type ItemTarget =
  | 'none'
  | 'item'
  | 'two-items'
  | 'player'
  | 'all-items'
  | 'special'
  | 'hand'
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
  | 'bank_note'
  | 'stock_market'
  | 'piggy_bank'
  | 'chaos_die'
  | 'chrysalis'
  | 'ipo'
  | 'broker'
  | 'mystery_box'
  | 'price_doubler'
  | 'reset_hammer'
  | 'inflation'
  | 'interest'
  | 'time_freeze'
  | 'fast_forward'
  | 'swap_portal'
  | 'shop_refresh'
  | 'handcuffs'
  | 'pickpocket'
  | 'heist_kit'
  | 'mute'
  | 'cold_market'
  | 'roi'
  | 'coin_leech'
  | 'magnet'
  | 'kickback'
  | 'curse_idol'
  | 'bomb'
  | 'dynamite'
  | 'bid_lock'
  | 'mirror'
  | 'gilder'
  | 'tip_jar'
  | 'haste_gear'
  | 'quick_swap';

export type ItemDef = {
  id: ItemId;
  name: string;
  emoji: string;
  kind: ItemKind;
  target: ItemTarget;
  sellValue: number;
  /** Shop listing price when freshly stocked */
  startPrice?: number;
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
  /** Dividend / Interest sell-value growth accumulator */
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
  /** Passives paused (Mute) */
  muteMs: number;
  /** ROI challenge: ms left to hit roiTargetCoins */
  roiMs: number;
  /** Must reach this coin total before roiMs hits 0 */
  roiTargetCoins: number;
  /** Bot decision cooldown remaining */
  botCooldownMs: number;
  /** Placement when eliminated (1 = winner later) */
  eliminatedAt: number | null;
  /** Accumulator for underdog catch-up income */
  comebackAccMs: number;
  /** Items this player has sold this match (Bank Note value) */
  itemsSold: number;
  /** Recent score swings (purchases, drains, taxes) for death autopsy */
  coinTrail: CoinSwing[];
  /** Filled when eliminated — why they died */
  deathReport: DeathReport | null;
};

/** One labeled coin change for the death autopsy trail. */
export type CoinSwing = {
  emoji: string;
  label: string;
  /** Negative = coins lost / spent */
  delta: number;
};

export type DeathReport = {
  reason: 'unpaid' | 'bomb' | 'bracket' | 'roi' | 'leech';
  headline: string;
  /** Bomb stands alone; otherwise up to 3 recent hits that led here */
  swings: CoinSwing[];
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
  | 'quick_swap'
  | 'refresh'
  | 'shuffle'
  | 'cuffs'
  | 'pickpocket'
  | 'heist'
  | 'mute'
  | 'cold_market'
  | 'roi'
  | 'magnet'
  | 'kickback'
  | 'curse'
  | 'dynamite'
  | 'interest'
  | 'bomb_fuse'
  | 'tile_label'
  | 'active_cast'
  | 'event_money'
  | 'event_tax'
  | 'event_shower'
  | 'mirror_echo';

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
  | 'mystery_mall'
  /** Only triggered by golden Chaos Die — not in the random pool */
  | 'golden_chaos';

export type WorldEventPhase = 'pending' | 'warning' | 'active' | 'done';

/** One live floor event (scheduled beat or Chaos Die). */
export type LiveWorldEvent = {
  key: string;
  id: WorldEventId;
  activeMs: number;
  pulseAccMs: number;
  fxAccMs: number;
};

export type WorldEventState = {
  /** Scheduled / warning pick (also mirrored into `live` while active) */
  id: WorldEventId | null;
  phase: WorldEventPhase;
  /** @deprecated prefer live[0] — kept in sync with primary scheduled live event */
  activeMs: number;
  pulseAccMs: number;
  fxAccMs: number;
  /** All concurrent live events (scheduled + item-triggered) */
  live: LiveWorldEvent[];
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
  | {
      type: 'income';
      playerId: string;
      amount: number;
      emoji: string;
      label?: string;
    }
  | {
      type: 'loss';
      playerId: string;
      amount: number;
      emoji: string;
      label?: string;
    }
  | {
      type: 'overflow_sell';
      playerId: string;
      amount: number;
      emoji: string;
    }
  | {
      type: 'eliminate';
      playerId: string;
      reason: 'unpaid' | 'bomb' | 'bracket' | 'roi' | 'leech';
      report?: DeathReport;
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
  /**
   * Multiplier applied when raising the bracket after a cull.
   * Starts at 2 (×2 each step). Once match pace hits 4×, escalates
   * after each raise: 2 → 4 → 8 → 16 …
   */
  bracketMult: number;
};

/** Armed Quick Swap — resolves after msLeft against current hand edges / full hands. */
export type PendingQuickSwap = {
  casterId: string;
  targetId: string;
  msLeft: number;
  golden: boolean;
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
  /** All passives paused board-wide */
  coldMarketMs: number;
  /** Item types available in this match */
  itemPool: ItemId[];
  /** Delayed Quick Swap countdowns */
  pendingQuickSwaps: PendingQuickSwap[];
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
