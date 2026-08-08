import { decideBotAction, nextBotCooldown } from '../../../src/game/bots';
import {
  CONFIG,
  HANDLE_POOL,
  MODE_SETUP,
  PLAYER_COLORS,
} from '../../../src/game/constants';
import {
  CUSTOM_DEFAULTS,
  resolveCustomPool,
  type CustomMatchSettings,
} from '../../../src/game/customSettings';
import {
  applyUseItem,
  bid,
  createInitialState,
  createRng,
  reorderHand,
  sellItem,
  tick,
} from '../../../src/game/engine';
import { pickMatchPool } from '../../../src/game/items';
import { bidOnNameTag, tickNameAuction } from '../../../src/game/naming';
import { rankedPoolForRank } from '../../../src/game/ranked';
import type {
  BotArchetype,
  DifficultyMode,
  GameMode,
  GameState,
  ItemId,
  NameAuctionState,
  NameTag,
  PlayerIdentity,
  UseTargets,
} from '../../../src/game/types';
import { Op } from '../opcodes';
import {
  LEADERBOARD_ID,
  STORAGE_COLLECTION,
  STORAGE_KEY_PROGRESS,
  applyRankedResult,
  clampProgress,
  type RankProgress,
} from '../rankedMath';

const TICK_RATE = 10; // 10 Hz → ~100ms, matches CONFIG.TICK_MS
const MAX_EMPTY_SEC = 120;

type Seat = {
  userId: string;
  username: string;
  displayName: string;
  ready: boolean;
  color: string;
  connected: boolean;
  seatIndex: number;
  bidderId: string;
  playerId: string;
  presence: nkruntime.Presence | null;
};

type MatchLabel = {
  open: number;
  mode: string;
  queue: string;
  code: string;
};

export type BidRushState = {
  label: MatchLabel;
  mode: GameMode;
  difficulty: DifficultyMode;
  queue: string;
  code: string;
  autoStart: boolean;
  hostUserId: string;
  seats: { [userId: string]: Seat };
  phase: 'lobby' | 'naming' | 'countdown' | 'playing' | 'results';
  countdown: number;
  custom: CustomMatchSettings;
  rankIndex: number;
  rng: () => number;
  seed: number;
  naming: NameAuctionState | null;
  game: GameState | null;
  matchPool: ItemId[] | null;
  botArchetypes: BotArchetype[];
  poolRevealEndsAt: number | null;
  goAt: number | null;
  emptyTicks: number;
  autoStartAt: number | null;
  rankedApplied: boolean;
};

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function assignArchetypes(
  botCount: number,
  difficulty: DifficultyMode,
  rng: () => number,
): BotArchetype[] {
  if (difficulty !== 'mixed') {
    return Array.from({ length: botCount }, () => difficulty);
  }
  const pool: BotArchetype[] = ['chill', 'balanced', 'ruthless'];
  return Array.from(
    { length: botCount },
    () => pool[Math.floor(rng() * pool.length)]!,
  );
}

function parseCustom(raw: string | undefined): CustomMatchSettings {
  const base: CustomMatchSettings = {
    ...CUSTOM_DEFAULTS,
    itemIds: [...CUSTOM_DEFAULTS.itemIds],
  };
  if (!raw) return base;
  try {
    const partial = JSON.parse(raw) as Partial<CustomMatchSettings>;
    return {
      itemIds:
        Array.isArray(partial.itemIds) && partial.itemIds.length > 0
          ? (partial.itemIds as ItemId[])
          : base.itemIds,
      gameLengthMs:
        typeof partial.gameLengthMs === 'number'
          ? partial.gameLengthMs
          : base.gameLengthMs,
      speedMult:
        typeof partial.speedMult === 'number'
          ? partial.speedMult
          : base.speedMult,
      startCoins:
        typeof partial.startCoins === 'number'
          ? partial.startCoins
          : base.startCoins,
      tileTimerMs:
        typeof partial.tileTimerMs === 'number'
          ? partial.tileTimerMs
          : base.tileTimerMs,
    };
  } catch {
    return base;
  }
}

function mergeCustom(
  current: CustomMatchSettings,
  partial?: Partial<CustomMatchSettings>,
): CustomMatchSettings {
  if (!partial) return current;
  return {
    itemIds:
      Array.isArray(partial.itemIds) && partial.itemIds.length > 0
        ? partial.itemIds
        : current.itemIds,
    gameLengthMs:
      typeof partial.gameLengthMs === 'number'
        ? partial.gameLengthMs
        : current.gameLengthMs,
    speedMult:
      typeof partial.speedMult === 'number'
        ? partial.speedMult
        : current.speedMult,
    startCoins:
      typeof partial.startCoins === 'number'
        ? partial.startCoins
        : current.startCoins,
    tileTimerMs:
      typeof partial.tileTimerMs === 'number'
        ? partial.tileTimerMs
        : current.tileTimerMs,
  };
}

function seatList(state: BidRushState): Seat[] {
  return Object.keys(state.seats)
    .map((id) => state.seats[id]!)
    .sort((a, b) => a.seatIndex - b.seatIndex);
}

function lobbyPayload(state: BidRushState) {
  return JSON.stringify({
    phase: state.phase,
    mode: state.mode,
    difficulty: state.difficulty,
    queue: state.queue,
    code: state.code,
    hostUserId: state.hostUserId,
    countdown: state.countdown,
    seats: seatList(state).map((s) => ({
      sessionId: s.userId,
      displayName: s.displayName,
      ready: s.ready,
      color: s.color,
      connected: s.connected,
      seatIndex: s.seatIndex,
    })),
  });
}

function broadcastLobby(
  dispatcher: nkruntime.MatchDispatcher,
  state: BidRushState,
) {
  dispatcher.broadcastMessage(Op.Lobby, lobbyPayload(state));
}

function sendYou(
  dispatcher: nkruntime.MatchDispatcher,
  seat: Seat,
) {
  if (!seat.presence) return;
  dispatcher.broadcastMessage(
    Op.You,
    JSON.stringify({
      sessionId: seat.userId,
      playerId: seat.playerId,
      bidderId: seat.bidderId,
    }),
    [seat.presence],
  );
}

function broadcastNaming(
  dispatcher: nkruntime.MatchDispatcher,
  state: BidRushState,
) {
  if (!state.naming) return;
  dispatcher.broadcastMessage(Op.Naming, JSON.stringify(state.naming));
}

function broadcastGame(
  dispatcher: nkruntime.MatchDispatcher,
  state: BidRushState,
) {
  if (!state.game) return;
  const snap: GameState = {
    ...state.game,
    events: [...state.game.events],
  };
  dispatcher.broadcastMessage(Op.Game, JSON.stringify(snap));
  state.game = { ...state.game, events: [] };
}

function maxPlayers(mode: GameMode): number {
  return MODE_SETUP[mode].players;
}

function nextSeatIndex(state: BidRushState): number {
  const used = new Set(seatList(state).map((s) => s.seatIndex));
  let i = 0;
  while (used.has(i)) i += 1;
  return i;
}

function readRank(
  nk: nkruntime.Nakama,
  userId: string,
): RankProgress {
  try {
    const objects = nk.storageRead([
      {
        collection: STORAGE_COLLECTION,
        key: STORAGE_KEY_PROGRESS,
        userId,
      },
    ]);
    if (!objects || objects.length === 0 || !objects[0].value) {
      return { rankIndex: 0, rp: 0 };
    }
    const v = objects[0].value as RankProgress;
    return clampProgress({
      rankIndex: Number(v.rankIndex) || 0,
      rp: Number(v.rp) || 0,
    });
  } catch {
    return { rankIndex: 0, rp: 0 };
  }
}

function applyRankedForHumans(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  state: BidRushState,
) {
  if (state.queue !== 'ranked' || !state.game || state.rankedApplied) return;
  state.rankedApplied = true;
  for (const seat of seatList(state)) {
    if (!seat.playerId || !seat.connected) continue;
    const player = state.game.players.find((p) => p.id === seat.playerId);
    if (!player || !player.isHuman) continue;
    const won = state.game.winnerId === player.id;
    try {
      const prev = readRank(nk, seat.userId);
      const result = applyRankedResult(prev, won);
      nk.storageWrite([
        {
          collection: STORAGE_COLLECTION,
          key: STORAGE_KEY_PROGRESS,
          userId: seat.userId,
          value: result.progress,
          permissionRead: 1,
          permissionWrite: 0,
        },
      ]);
      nk.leaderboardRecordWrite(
        LEADERBOARD_ID,
        seat.userId,
        player.name.slice(0, 24),
        result.score,
        player.coins,
        {
          name: player.name.slice(0, 24),
          avatar: String(player.avatar || '').slice(0, 8),
          won,
        },
        undefined,
      );
    } catch (e) {
      logger.warn('ranked apply failed for %s: %s', seat.userId, e);
    }
  }
}

function beginNaming(
  state: BidRushState,
  dispatcher: nkruntime.MatchDispatcher,
) {
  const setup = MODE_SETUP[state.mode];
  state.seed = (Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0;
  state.rng = createRng(state.seed);

  const poolRng = createRng(state.seed ^ 0x51ceed);
  if (state.queue === 'ranked') {
    state.matchPool = pickMatchPool(
      poolRng,
      rankedPoolForRank(state.rankIndex),
    );
  } else if (state.queue === 'casual') {
    state.matchPool = pickMatchPool(poolRng);
  } else {
    const customPool = resolveCustomPool(state.custom);
    state.matchPool =
      customPool.length > 0 ? customPool : pickMatchPool(poolRng);
  }

  const tags: NameTag[] = shuffle(HANDLE_POOL, state.rng)
    .slice(0, setup.gridSize)
    .map((h, i) => ({
      id: `tag_${i}`,
      name: h.name,
      avatar: h.avatar,
      price: 0,
      highBidderId: null,
    }));

  const humans = seatList(state);
  const botCount = Math.max(0, setup.players - humans.length);
  state.botArchetypes = assignArchetypes(
    botCount,
    state.difficulty,
    state.rng,
  );

  humans.forEach((seat, i) => {
    seat.seatIndex = i;
    seat.bidderId = `bidder_${i}`;
    seat.playerId = `player_${i}`;
    seat.ready = true;
  });

  const participants = Array.from({ length: setup.players }, (_, i) => {
    const human = humans[i];
    return {
      id: `bidder_${i}`,
      isHuman: !!human,
      color: human?.color ?? PLAYER_COLORS[i % PLAYER_COLORS.length]!,
      cooldownMs: human ? 0 : 150 + Math.floor(state.rng() * 400),
    };
  });

  state.naming = {
    mode: state.mode,
    difficulty: state.difficulty,
    tags,
    participants,
    humanId: humans[0]?.bidderId ?? 'bidder_0',
    msLeft: CONFIG.NAME_AUCTION_MS,
    seed: state.seed,
  };
  state.phase = 'naming';
  state.label.open = 0;
  dispatcher.matchLabelUpdate(JSON.stringify(state.label));
  broadcastLobby(dispatcher, state);
  for (const seat of humans) sendYou(dispatcher, seat);
  broadcastNaming(dispatcher, state);
}

function resolveIdentities(state: BidRushState): PlayerIdentity[] {
  const naming = state.naming!;
  const setup = MODE_SETUP[naming.mode];
  const archetypes =
    state.botArchetypes.length > 0
      ? state.botArchetypes
      : assignArchetypes(setup.botCount, naming.difficulty, state.rng);

  const claimed = new Map<string, NameTag>();
  const takenTagIds = new Set<string>();
  for (const tag of naming.tags) {
    if (tag.highBidderId && !claimed.has(tag.highBidderId)) {
      claimed.set(tag.highBidderId, tag);
      takenTagIds.add(tag.id);
    }
  }
  const leftovers = shuffle(
    naming.tags.filter((t) => !takenTagIds.has(t.id)),
    state.rng,
  );

  const identities: PlayerIdentity[] = [];
  let botArchIdx = 0;
  for (const p of naming.participants) {
    let tag = claimed.get(p.id);
    if (!tag) tag = leftovers.shift();
    if (!tag) {
      tag = {
        id: 'fallback',
        name: p.isHuman ? 'You' : `Bidder ${p.id}`,
        avatar: '❓',
        price: 0,
        highBidderId: null,
      };
    }
    identities.push({
      name: tag.name,
      avatar: tag.avatar,
      color: p.color,
      isHuman: p.isHuman,
      archetype: p.isHuman ? null : archetypes[botArchIdx++] ?? 'balanced',
    });
  }
  return identities;
}

function finishNaming(
  state: BidRushState,
  dispatcher: nkruntime.MatchDispatcher,
) {
  if (!state.naming) return;
  const identities = resolveIdentities(state);
  state.game = createInitialState(
    {
      mode: state.naming.mode,
      difficulty: state.naming.difficulty,
      identities,
      rules: {
        gameLengthMs: state.custom.gameLengthMs,
        speedMult: state.custom.speedMult,
        startCoins: state.custom.startCoins,
        tileTimerMs: state.custom.tileTimerMs,
      },
    },
    state.naming.seed,
    state.matchPool ?? undefined,
  );
  state.naming = null;
  state.phase = 'countdown';
  state.poolRevealEndsAt = Date.now() + CONFIG.POOL_REVEAL_MS;
  state.goAt = null;
  state.countdown = Math.ceil(CONFIG.POOL_REVEAL_MS / 1000);
  broadcastLobby(dispatcher, state);
  broadcastGame(dispatcher, state);
}

function beginPlaying(
  state: BidRushState,
  dispatcher: nkruntime.MatchDispatcher,
) {
  state.phase = 'playing';
  state.countdown = 0;
  state.poolRevealEndsAt = null;
  state.goAt = null;
  broadcastLobby(dispatcher, state);
  broadcastGame(dispatcher, state);
}

function takeOverAsBot(state: BidRushState, seat: Seat) {
  if (!state.game || !seat.playerId) return;
  const arch: BotArchetype =
    state.difficulty === 'mixed'
      ? 'balanced'
      : ((state.difficulty as BotArchetype) ?? 'balanced');
  state.game = {
    ...state.game,
    players: state.game.players.map((p) =>
      p.id === seat.playerId
        ? {
            ...p,
            isHuman: false,
            archetype: arch,
            botCooldownMs: 200 + Math.floor(state.rng() * 400),
          }
        : p,
    ),
  };
}

function applyBotIntents(state: BidRushState, game: GameState): GameState {
  let next = game;
  for (const player of next.players) {
    if (!player.isAlive || player.isHuman) continue;
    if (player.botCooldownMs > 0) continue;
    if (player.handcuffMs > 0) {
      const arch = player.archetype ?? 'balanced';
      next = {
        ...next,
        players: next.players.map((p) =>
          p.id === player.id
            ? { ...p, botCooldownMs: nextBotCooldown(arch, state.rng) }
            : p,
        ),
      };
      continue;
    }

    const intent = decideBotAction(next, player.id, state.rng);
    const arch = player.archetype ?? 'balanced';
    const cooldown = nextBotCooldown(arch, state.rng);

    if (!intent) {
      next = {
        ...next,
        players: next.players.map((p) =>
          p.id === player.id ? { ...p, botCooldownMs: cooldown } : p,
        ),
      };
      continue;
    }

    if (intent.kind === 'bid') {
      next = bid(next, player.id, intent.tileIndex);
    } else if (intent.kind === 'sell') {
      next = sellItem(next, player.id, intent.instanceId, state.rng);
    } else if (intent.kind === 'use') {
      next = applyUseItem(
        next,
        player.id,
        intent.instanceId,
        intent.targets,
        state.rng,
      );
    } else if (intent.kind === 'reorder') {
      next = reorderHand(
        next,
        player.id,
        intent.fromIndex,
        intent.toIndex,
      );
    }

    next = {
      ...next,
      players: next.players.map((p) =>
        p.id === player.id ? { ...p, botCooldownMs: cooldown } : p,
      ),
    };
  }
  return next;
}

function handleAction(
  state: BidRushState,
  dispatcher: nkruntime.MatchDispatcher,
  sender: nkruntime.Presence,
  raw: string,
) {
  let msg: {
    type?: string;
    mode?: string;
    difficulty?: string;
    custom?: Partial<CustomMatchSettings>;
    ready?: boolean;
    tagId?: string;
    tileIndex?: number;
    instanceId?: string;
    targets?: UseTargets;
    fromIndex?: number;
    toIndex?: number;
  };
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  const seat = state.seats[sender.userId];
  if (!seat) return;
  const type = msg.type;

  if (type === 'set_options') {
    if (sender.userId !== state.hostUserId || state.phase !== 'lobby') return;
    if (msg.mode === 'duel' || msg.mode === 'blitz') {
      state.mode = msg.mode;
      state.label.mode = msg.mode;
      dispatcher.matchLabelUpdate(JSON.stringify(state.label));
      // Kick seats beyond new max
      const max = maxPlayers(state.mode);
      for (const s of seatList(state)) {
        if (s.seatIndex < max) continue;
        delete state.seats[s.userId];
        if (s.presence) {
          // presence will leave on reject next — just drop seat
        }
      }
    }
    if (
      msg.difficulty === 'chill' ||
      msg.difficulty === 'balanced' ||
      msg.difficulty === 'ruthless' ||
      msg.difficulty === 'mixed'
    ) {
      state.difficulty = msg.difficulty;
    }
    if (msg.custom) state.custom = mergeCustom(state.custom, msg.custom);
    broadcastLobby(dispatcher, state);
    return;
  }

  if (type === 'set_ready') {
    if (state.phase !== 'lobby') return;
    seat.ready = !!msg.ready;
    broadcastLobby(dispatcher, state);
    return;
  }

  if (type === 'start') {
    if (sender.userId !== state.hostUserId || state.phase !== 'lobby') return;
    beginNaming(state, dispatcher);
    return;
  }

  if (type === 'bid_name') {
    if (!state.naming || state.phase !== 'naming' || !seat.bidderId) return;
    if (!msg.tagId) return;
    state.naming = bidOnNameTag(state.naming, seat.bidderId, msg.tagId);
    broadcastNaming(dispatcher, state);
    return;
  }

  if (type === 'bid') {
    if (!state.game || state.phase !== 'playing' || !seat.playerId) return;
    if (typeof msg.tileIndex !== 'number') return;
    const player = state.game.players.find((p) => p.id === seat.playerId);
    if (!player?.isAlive) return;
    state.game = bid(state.game, seat.playerId, msg.tileIndex);
    broadcastGame(dispatcher, state);
    return;
  }

  if (type === 'sell') {
    if (!state.game || state.phase !== 'playing' || !seat.playerId) return;
    if (!msg.instanceId) return;
    const player = state.game.players.find((p) => p.id === seat.playerId);
    if (!player?.isAlive) return;
    state.game = sellItem(
      state.game,
      seat.playerId,
      msg.instanceId,
      state.rng,
    );
    broadcastGame(dispatcher, state);
    return;
  }

  if (type === 'use') {
    if (!state.game || state.phase !== 'playing' || !seat.playerId) return;
    if (!msg.instanceId) return;
    const player = state.game.players.find((p) => p.id === seat.playerId);
    if (!player?.isAlive) return;
    state.game = applyUseItem(
      state.game,
      seat.playerId,
      msg.instanceId,
      msg.targets ?? {},
      state.rng,
    );
    broadcastGame(dispatcher, state);
    return;
  }

  if (type === 'reorder_hand') {
    if (!state.game || state.phase !== 'playing' || !seat.playerId) return;
    if (
      typeof msg.fromIndex !== 'number' ||
      typeof msg.toIndex !== 'number'
    ) {
      return;
    }
    state.game = reorderHand(
      state.game,
      seat.playerId,
      msg.fromIndex,
      msg.toIndex,
    );
    broadcastGame(dispatcher, state);
  }
}

function msgDataString(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data == null) return '';
  try {
    // Uint8Array / ArrayBuffer from some runtimes
    if (
      typeof data === 'object' &&
      data !== null &&
      'length' in (data as object)
    ) {
      const arr = data as ArrayLike<number>;
      let s = '';
      for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]!);
      return s;
    }
  } catch {
    /* fall through */
  }
  return String(data);
}

export const matchInit: nkruntime.MatchInitFunction<BidRushState> = function (
  _ctx,
  logger,
  _nk,
  params,
) {
  const mode: GameMode = params['mode'] === 'duel' ? 'duel' : 'blitz';
  const difficulty: DifficultyMode =
    params['difficulty'] === 'chill' ||
    params['difficulty'] === 'balanced' ||
    params['difficulty'] === 'ruthless' ||
    params['difficulty'] === 'mixed'
      ? params['difficulty']
      : 'mixed';
  const queue = params['queue'] || 'custom';
  const code = (params['code'] || '').toUpperCase() || 'XXXXXX';
  const autoStart = params['autoStart'] === '1' || queue !== 'custom';
  const rankIndex = Math.max(0, Math.min(4, Number(params['rankIndex']) || 0));

  const label: MatchLabel = {
    open: 1,
    mode,
    queue,
    code,
  };

  const state: BidRushState = {
    label,
    mode,
    difficulty,
    queue,
    code,
    autoStart,
    hostUserId: '',
    seats: {},
    phase: 'lobby',
    countdown: 0,
    custom: parseCustom(params['custom']),
    rankIndex,
    rng: Math.random,
    seed: 0,
    naming: null,
    game: null,
    matchPool: null,
    botArchetypes: [],
    poolRevealEndsAt: null,
    goAt: null,
    emptyTicks: 0,
    autoStartAt: null,
    rankedApplied: false,
  };

  logger.info(
    'bid_rush init code=%s mode=%s queue=%s autoStart=%s',
    code,
    mode,
    queue,
    autoStart,
  );

  return {
    state,
    tickRate: TICK_RATE,
    label: JSON.stringify(label),
  };
};

export const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<BidRushState> =
  function (_ctx, _logger, _nk, _dispatcher, _tick, state, presence, _meta) {
    if (state.phase !== 'lobby') {
      return { state, accept: false, rejectMessage: 'Match already started' };
    }
    if (presence.userId in state.seats) {
      return { state, accept: true };
    }
    if (Object.keys(state.seats).length >= maxPlayers(state.mode)) {
      return { state, accept: false, rejectMessage: 'Room is full' };
    }
    return { state, accept: true };
  };

export const matchJoin: nkruntime.MatchJoinFunction<BidRushState> = function (
  _ctx,
  logger,
  nk,
  dispatcher,
  _tick,
  state,
  presences,
) {
  for (const p of presences) {
    let displayName = p.username || 'Player';
    try {
      const account = nk.accountGetId(p.userId);
      if (account.user.displayName) displayName = account.user.displayName;
    } catch (e) {
      logger.debug('accountGetId: %s', e);
    }
    const seatIndex = nextSeatIndex(state);
    state.seats[p.userId] = {
      userId: p.userId,
      username: p.username,
      displayName: displayName.slice(0, 24),
      ready: false,
      color: PLAYER_COLORS[seatIndex % PLAYER_COLORS.length]!,
      connected: true,
      seatIndex,
      bidderId: '',
      playerId: '',
      presence: p,
    };
    if (state.queue === 'ranked') {
      const prog = readRank(nk, p.userId);
      // Use the lowest rank among players for a fairer pool
      state.rankIndex = Math.min(state.rankIndex, prog.rankIndex);
    }
  }

  const ids = Object.keys(state.seats).sort();
  if (!state.hostUserId || !state.seats[state.hostUserId]) {
    state.hostUserId = ids[0] || '';
  }

  state.emptyTicks = 0;

  // Auto-start timer when enough players for matchmade games
  if (state.autoStart && state.phase === 'lobby') {
    const need = Math.min(2, maxPlayers(state.mode));
    if (Object.keys(state.seats).length >= need && state.autoStartAt == null) {
      state.autoStartAt = Date.now() + 1500;
    }
  }

  broadcastLobby(dispatcher, state);
  for (const p of presences) {
    const seat = state.seats[p.userId];
    if (seat) sendYou(dispatcher, seat);
  }
  return { state };
};

export const matchLeave: nkruntime.MatchLeaveFunction<BidRushState> = function (
  _ctx,
  _logger,
  _nk,
  dispatcher,
  _tick,
  state,
  presences,
) {
  for (const p of presences) {
    const seat = state.seats[p.userId];
    if (!seat) continue;
    if (state.phase === 'lobby') {
      delete state.seats[p.userId];
    } else {
      seat.connected = false;
      seat.presence = null;
      takeOverAsBot(state, seat);
      if (state.game) broadcastGame(dispatcher, state);
    }
  }
  const ids = Object.keys(state.seats).sort();
  if (!state.seats[state.hostUserId]) {
    state.hostUserId = ids[0] || '';
  }
  broadcastLobby(dispatcher, state);
  return { state };
};

export const matchLoop: nkruntime.MatchLoopFunction<BidRushState> = function (
  _ctx,
  logger,
  nk,
  dispatcher,
  _tick,
  state,
  messages,
) {
  if (Object.keys(state.seats).length === 0 && state.phase === 'lobby') {
    state.emptyTicks += 1;
    if (state.emptyTicks >= MAX_EMPTY_SEC * TICK_RATE) return null;
  } else {
    state.emptyTicks = 0;
  }

  for (const msg of messages) {
    if (msg.opCode === Op.Action) {
      handleAction(state, dispatcher, msg.sender, msgDataString(msg.data));
    }
  }

  const dt = CONFIG.TICK_MS;

  if (
    state.phase === 'lobby' &&
    state.autoStartAt != null &&
    Date.now() >= state.autoStartAt
  ) {
    state.autoStartAt = null;
    beginNaming(state, dispatcher);
  }

  if (state.phase === 'naming' && state.naming) {
    state.naming = tickNameAuction(state.naming, dt, state.rng);
    if (state.naming.msLeft <= 0) {
      finishNaming(state, dispatcher);
    } else {
      broadcastNaming(dispatcher, state);
    }
    return { state };
  }

  if (state.phase === 'countdown') {
    const now = Date.now();
    if (state.goAt != null) {
      if (now >= state.goAt) beginPlaying(state, dispatcher);
      return { state };
    }
    if (state.poolRevealEndsAt == null) {
      beginPlaying(state, dispatcher);
      return { state };
    }
    const remain = state.poolRevealEndsAt - now;
    if (remain <= 0) {
      state.countdown = 0;
      state.goAt = now + 450;
      broadcastLobby(dispatcher, state);
      return { state };
    }
    state.countdown = Math.max(1, Math.ceil(remain / 1000));
    broadcastLobby(dispatcher, state);
    return { state };
  }

  if (state.phase === 'playing' && state.game) {
    let next = applyBotIntents(state, state.game);
    next = tick(next, dt, state.rng);
    state.game = next;
    broadcastGame(dispatcher, state);
    if (next.ended) {
      state.phase = 'results';
      applyRankedForHumans(nk, logger, state);
      dispatcher.broadcastMessage(
        Op.MatchEnded,
        JSON.stringify({ winnerId: next.winnerId }),
      );
      broadcastLobby(dispatcher, state);
    }
  }

  return { state };
};

export const matchTerminate: nkruntime.MatchTerminateFunction<BidRushState> =
  function (_ctx, _logger, _nk, _dispatcher, _tick, state) {
    return { state };
  };

export const matchSignal: nkruntime.MatchSignalFunction<BidRushState> =
  function (_ctx, _logger, _nk, _dispatcher, _tick, state) {
    return { state };
  };
