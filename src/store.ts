import { create } from 'zustand';
import { decideBotAction, nextBotCooldown } from './game/bots';
import { CONFIG, type GameMode } from './game/constants';
import {
  bid,
  createInitialState,
  createRng,
  sellItem,
  tick,
  applyUseItem,
  reorderHand,
} from './game/engine';
import { getItem, canInstantUse, pickMatchPool } from './game/items';
import {
  bidOnNameTag,
  createNameAuction,
  resolveNameAuction,
  tickNameAuction,
} from './game/naming';
import { formatCoinDelta } from './game/formatCoins';
import type {
  DeathReport,
  DifficultyMode,
  FxKind,
  GameEvent,
  GameState,
  ItemId,
  LobbyConfig,
  NameAuctionState,
  Phase,
  TargetingMode,
} from './game/types';
import type { OnlineSeatView } from './net/protocol';
import { sendOnline } from './net/roomRef';
import { leaveOnlineRoom } from './net/onlineSession';
import {
  applyRankedMatchResult,
  getRankDef,
  loadRankProgress,
  rankedPoolForRank,
  rankedEventPoolForRank,
  recordRankedHistory,
  rollRankedBotDifficulty,
} from './game/ranked';
import { RANDOM_WORLD_EVENT_IDS } from './game/worldEvents';
export type FloatText = {
  id: number;
  playerId: string;
  text: string;
  createdAt: number;
};

export type FxInstance = {
  id: number;
  kind: FxKind;
  playerId?: string;
  targetPlayerId?: string;
  tileIndex?: number;
  tileIndexB?: number;
  label?: string;
  instanceId?: string;
  createdAt: number;
};

const FX_TTL_MS = 800;

type Store = {
  phase: Phase;
  lobby: LobbyConfig;
  naming: NameAuctionState | null;
  codexOpen: boolean;
  countdown: number;
  game: GameState | null;
  targeting: TargetingMode | null;
  handFocus: string | null;
  floats: FloatText[];
  activeFx: FxInstance[];
  lastEvents: GameEvent[];
  /** Human died mid-match; show play again / spectate / menu */
  knockoutOffer: boolean;
  knockoutReason: 'unpaid' | 'bomb' | 'bracket' | 'roi' | 'leech' | null;
  /** Autopsy of what drained / killed the human */
  knockoutReport: DeathReport | null;
  /** Watching remaining players' hands after knockout */
  spectating: boolean;
  /** Match item pool (picked at Tag Sale start) */
  matchPool: ItemId[] | null;
  /** Pool reveal visible (early peek or mandatory countdown) */
  poolRevealOpen: boolean;
  /** Wall-clock ms when pool reveal must end / match starts */
  poolRevealEndsAt: number | null;
  /** Opened pool during Tag Sale — skip re-entrance on countdown */
  poolRevealPeeked: boolean;

  /** Connected to a Colyseus room */
  online: boolean;
  roomCode: string | null;
  sessionId: string | null;
  myPlayerId: string | null;
  myBidderId: string | null;
  onlineHost: boolean;
  onlineSeats: OnlineSeatView[];
  onlineError: string | null;
  /** Local queue: ranked saves coins to the leaderboard */
  matchKind: 'ranked' | 'casual' | null;
  /** Rank index (0–4) locked in when a ranked match starts */
  rankedRankIndex: number | null;

  setMode: (mode: GameMode) => void;
  setDifficulty: (d: DifficultyMode) => void;
  setCodexOpen: (open: boolean) => void;

  startNaming: (mode: GameMode, seed?: number) => void;
  bidNameTag: (tagId: string) => void;
  finishNaming: () => void;
  openPoolReveal: () => void;
  closePoolReveal: () => void;

  beginPlaying: () => void;
  returnToLobby: () => void;
  enterSpectate: () => void;
  replayMatch: () => void;

  bidTile: (tileIndex: number) => void;
  sellFocused: () => void;
  useFocused: () => void;
  selectHandItem: (instanceId: string) => void;
  cancelTargeting: () => void;
  selectTargetTile: (tileIndex: number) => void;
  selectTargetPlayer: (playerId: string) => void;
  reorderHandSlots: (fromIndex: number, toIndex: number) => void;

  masterTick: (dtMs?: number) => void;

  enterOnlineSession: (info: { roomCode: string; sessionId: string }) => void;
  applyOnlineYou: (msg: {
    sessionId: string;
    playerId: string;
    bidderId: string;
  }) => void;
  applyOnlineNaming: (naming: NameAuctionState) => void;
  applyOnlineGame: (game: GameState) => void;
  applyOnlineMatchEnded: (winnerId: string | null) => void;
};

let loopId: ReturnType<typeof setInterval> | null = null;
let countdownId: ReturnType<typeof setInterval> | null = null;
let namingLoopId: ReturnType<typeof setInterval> | null = null;
let floatSeq = 0;
let fxSeq = 0;
let rng = createRng(Date.now());

function stopLoop() {
  if (loopId !== null) {
    clearInterval(loopId);
    loopId = null;
  }
}

function stopCountdown() {
  if (countdownId !== null) {
    clearInterval(countdownId);
    countdownId = null;
  }
}

function stopNamingLoop() {
  if (namingLoopId !== null) {
    clearInterval(namingLoopId);
    namingLoopId = null;
  }
}

function startLoop(get: () => Store) {
  stopLoop();
  loopId = setInterval(() => {
    get().masterTick();
  }, CONFIG.TICK_MS);
}

function pushFloats(events: GameEvent[], floats: FloatText[]): FloatText[] {
  const next = [...floats];
  const now = Date.now();
  for (const e of events) {
    if (e.type === 'income') {
      next.push({
        id: ++floatSeq,
        playerId: e.playerId,
        text: formatCoinDelta(e.amount),
        createdAt: now,
      });
    } else if (e.type === 'overflow_sell') {
      next.push({
        id: ++floatSeq,
        playerId: e.playerId,
        text: `${e.emoji} SOLD +${e.amount}`,
        createdAt: now,
      });
    } else if (e.type === 'eliminate') {
      next.push({
        id: ++floatSeq,
        playerId: e.playerId,
        text:
          e.reason === 'bomb'
            ? '💥 OUT'
            : e.reason === 'bracket'
              ? '💀 OUT'
              : e.reason === 'roi'
                ? '📉 OUT'
                : e.reason === 'leech'
                  ? '🧛 OUT'
                  : '💸 OUT',
        createdAt: now,
      });
    } else if (e.type === 'loss') {
      next.push({
        id: ++floatSeq,
        playerId: e.playerId,
        text: formatCoinDelta(-e.amount),
        createdAt: now,
      });
    }
  }
  return next.filter((f) => now - f.createdAt < 1200);
}

function pushFx(events: GameEvent[], activeFx: FxInstance[]): FxInstance[] {
  const next = [...activeFx];
  const now = Date.now();
  for (const e of events) {
    if (e.type !== 'fx') continue;
    next.push({
      id: ++fxSeq,
      kind: e.kind,
      playerId: e.playerId,
      targetPlayerId: e.targetPlayerId,
      tileIndex: e.tileIndex,
      tileIndexB: e.tileIndexB,
      label: e.label,
      instanceId: e.instanceId,
      createdAt: now,
    });
  }
  return next.filter((f) => now - f.createdAt < FX_TTL_MS);
}

/** Ingest engine events into UI floats/fx and clear them from game state. */
function ingest(game: GameState, floats: FloatText[], activeFx: FxInstance[]) {
  const nextFloats = pushFloats(game.events, floats);
  const nextFx = pushFx(game.events, activeFx);
  const cleaned: GameState = { ...game, events: [] };
  return { game: cleaned, floats: nextFloats, activeFx: nextFx, lastEvents: game.events };
}

function applyBotIntents(game: GameState): GameState {
  let state = game;
  for (const player of state.players) {
    if (!player.isAlive) continue;
    if (player.isHuman) continue;
    if (player.botCooldownMs > 0) continue;
    if (player.handcuffMs > 0) {
      const arch = player.archetype ?? 'balanced';
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === player.id
            ? { ...p, botCooldownMs: nextBotCooldown(arch, rng) }
            : p,
        ),
      };
      continue;
    }

    const intent = decideBotAction(state, player.id, rng);
    const arch = player.archetype ?? 'balanced';
    const cooldown = nextBotCooldown(arch, rng);

    if (!intent) {
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === player.id ? { ...p, botCooldownMs: cooldown } : p,
        ),
      };
      continue;
    }

    if (intent.kind === 'bid') {
      state = bid(state, player.id, intent.tileIndex);
    } else if (intent.kind === 'sell') {
      state = sellItem(state, player.id, intent.instanceId, rng);
    } else if (intent.kind === 'use') {
      state = applyUseItem(state, player.id, intent.instanceId, intent.targets, rng);
    } else if (intent.kind === 'reorder') {
      state = reorderHand(state, player.id, intent.fromIndex, intent.toIndex);
    }

    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === player.id ? { ...p, botCooldownMs: cooldown } : p,
      ),
    };
  }
  return state;
}

const defaultLobby = (): LobbyConfig => ({
  mode: 'blitz',
  difficulty: 'mixed',
});

function commitGame(
  set: (partial: Partial<Store>) => void,
  get: () => Store,
  game: GameState,
  extra: Partial<Store> = {},
) {
  const { floats, activeFx } = get();
  const ingested = ingest(game, floats, activeFx);
  set({
    game: ingested.game,
    floats: ingested.floats,
    activeFx: ingested.activeFx,
    lastEvents: ingested.lastEvents,
    ...extra,
  });
}

function maybeRecordRanked(get: () => Store, game: GameState) {
  if (get().matchKind !== 'ranked') return;
  const human = game.players.find((p) => p.id === game.humanId);
  if (!human) return;
  const won = game.winnerId === human.id;
  const before = loadRankProgress();
  const rankId = getRankDef(before.rankIndex).id;
  const historyInput = {
    name: human.name,
    avatar: human.avatar,
    coins: human.coins,
    won,
    rankId,
  };

  // Online ranked: Nakama match handler already wrote RP — refresh + history only.
  if (get().online) {
    recordRankedHistory(historyInput);
    void import('./net/nakama')
      .then(({ refreshNakamaProfile }) => refreshNakamaProfile())
      .catch(() => {});
    return;
  }

  // Prefer Nakama authoritative RP when the account session is up (local bots).
  void import('./net/nakama')
    .then(async ({ applyRankedOnServer }) => {
      const server = await applyRankedOnServer({
        won,
        coins: human.coins,
        name: human.name,
        avatar: human.avatar,
      });
      if (server) {
        recordRankedHistory(historyInput);
        return;
      }
      applyRankedMatchResult(won);
      recordRankedHistory(historyInput);
    })
    .catch(() => {
      applyRankedMatchResult(won);
      recordRankedHistory(historyInput);
    });
}

/** Apply item use locally or send to Colyseus when online. */
function commitUse(
  set: (partial: Partial<Store>) => void,
  get: () => Store,
  instanceId: string,
  targets: import('./game/types').UseTargets,
) {
  const { game, online } = get();
  if (!game) return;
  if (online) {
    sendOnline('use', { instanceId, targets });
    set({ targeting: null, handFocus: null });
    return;
  }
  commitGame(
    set,
    get,
    applyUseItem(game, game.humanId, instanceId, targets, rng),
    { targeting: null, handFocus: null },
  );
}

function startCountdownFromGame(get: () => Store, set: (p: Partial<Store>) => void, game: GameState) {
  stopCountdown();
  stopNamingLoop();
  rng = createRng(game.seed);

  const existingEnds = get().poolRevealEndsAt;
  const endsAt =
    existingEnds != null && existingEnds > Date.now()
      ? existingEnds
      : Date.now() + CONFIG.POOL_REVEAL_MS;
  const secsLeft = Math.max(1, Math.ceil((endsAt - Date.now()) / 1000));

  set({
    phase: 'countdown',
    countdown: secsLeft,
    game,
    naming: null,
    targeting: null,
    handFocus: null,
    floats: [],
    activeFx: [],
    knockoutOffer: false,
    knockoutReason: null,
    knockoutReport: null,
    spectating: false,
    poolRevealOpen: true,
    poolRevealEndsAt: endsAt,
    matchPool: game.itemPool,
  });

  countdownId = setInterval(() => {
    const ends = get().poolRevealEndsAt;
    if (!ends) {
      stopCountdown();
      get().beginPlaying();
      return;
    }
    const remain = ends - Date.now();
    if (remain <= 0) {
      stopCountdown();
      set({ countdown: 0 });
      // Brief GO beat then play
      window.setTimeout(() => get().beginPlaying(), 450);
      return;
    }
    set({ countdown: Math.max(1, Math.ceil(remain / 1000)) });
  }, CONFIG.TICK_MS);
}

export const useGameStore = create<Store>((set, get) => ({
  phase: 'lobby',
  lobby: defaultLobby(),
  naming: null,
  codexOpen: false,
  countdown: 3,
  game: null,
  targeting: null,
  handFocus: null,
  floats: [],
  activeFx: [],
  lastEvents: [],
  knockoutOffer: false,
  knockoutReason: null,
  knockoutReport: null,
  spectating: false,
  matchPool: null,
  poolRevealOpen: false,
  poolRevealEndsAt: null,
  poolRevealPeeked: false,

  online: false,
  roomCode: null,
  sessionId: null,
  myPlayerId: null,
  myBidderId: null,
  onlineHost: false,
  onlineSeats: [],
  onlineError: null,
  matchKind: null,
  rankedRankIndex: null,

  setMode: (mode) => set((s) => ({ lobby: { ...s.lobby, mode } })),
  setDifficulty: (d) => set((s) => ({ lobby: { ...s.lobby, difficulty: d } })),
  setCodexOpen: (open) => set({ codexOpen: open }),

  enterOnlineSession: ({ roomCode, sessionId }) => {
    stopLoop();
    stopCountdown();
    stopNamingLoop();
    set({
      online: true,
      roomCode,
      sessionId,
      myPlayerId: null,
      myBidderId: null,
      onlineHost: false,
      onlineSeats: [],
      onlineError: null,
      phase: 'lobby',
      game: null,
      naming: null,
      targeting: null,
      handFocus: null,
      floats: [],
      activeFx: [],
      knockoutOffer: false,
      knockoutReason: null,
      knockoutReport: null,
      spectating: false,
      matchPool: null,
      poolRevealOpen: false,
      poolRevealEndsAt: null,
      poolRevealPeeked: false,
      // Keep matchKind if matchmaking already set ranked/casual for RP.
    });
  },

  applyOnlineYou: (msg) => {
    set({
      sessionId: msg.sessionId,
      myPlayerId: msg.playerId || null,
      myBidderId: msg.bidderId || null,
    });
  },

  applyOnlineNaming: (naming) => {
    stopLoop();
    stopCountdown();
    stopNamingLoop();
    const poolRng = createRng(naming.seed ^ 0x51ceed);
    set({
      phase: 'naming',
      naming,
      game: null,
      floats: [],
      activeFx: [],
      targeting: null,
      handFocus: null,
      knockoutOffer: false,
      knockoutReason: null,
      knockoutReport: null,
      spectating: false,
      matchPool: pickMatchPool(poolRng),
      poolRevealOpen: false,
      poolRevealEndsAt: null,
      poolRevealPeeked: false,
      lobby: {
        ...get().lobby,
        mode: naming.mode,
        difficulty: naming.difficulty,
      },
    });
  },

  applyOnlineGame: (game) => {
    const prev = get();
    const humanId = prev.myPlayerId ?? game.humanId;
    const wasAlive =
      prev.game?.players.find((p) => p.id === humanId)?.isAlive ?? true;

    const ingested = ingest(game, prev.floats, prev.activeFx);
    let focus = prev.handFocus;
    if (focus) {
      const human = ingested.game.players.find(
        (p) => p.id === ingested.game.humanId,
      );
      if (!human?.hand.some((h) => h.instanceId === focus)) {
        focus = null;
      }
    }

    const humanNow = ingested.game.players.find(
      (p) => p.id === ingested.game.humanId,
    );
    const justDied = wasAlive && humanNow && !humanNow.isAlive;

    let offer = prev.knockoutOffer;
    let reason = prev.knockoutReason;
    let report = prev.knockoutReport;
    if (justDied && !prev.spectating) {
      focus = null;
      const elim = ingested.lastEvents.find(
        (e) => e.type === 'eliminate' && e.playerId === ingested.game.humanId,
      );
      reason =
        elim && elim.type === 'eliminate' ? elim.reason : (reason ?? 'unpaid');
      report =
        elim && elim.type === 'eliminate' && elim.report
          ? elim.report
          : (humanNow?.deathReport ?? report);
      offer = true;
    }

    const patch: Partial<Store> = {
      game: ingested.game,
      floats: ingested.floats,
      activeFx: ingested.activeFx,
      lastEvents: ingested.lastEvents,
      handFocus: focus,
      naming: null,
      matchPool: ingested.game.itemPool,
      knockoutOffer: ingested.game.ended ? false : offer,
      knockoutReason: reason,
      knockoutReport: report,
      ...(justDied ? { targeting: null } : {}),
    };

    if (ingested.game.ended) {
      patch.phase = 'results';
    } else if (prev.phase === 'lobby' || prev.phase === 'naming') {
      patch.phase = 'countdown';
      patch.poolRevealOpen = true;
    }

    set(patch);
  },

  applyOnlineMatchEnded: (winnerId) => {
    stopLoop();
    const game = get().game;
    const ended = game
      ? { ...game, ended: true, winnerId: winnerId ?? game.winnerId }
      : game;
    set({
      phase: 'results',
      knockoutOffer: false,
      targeting: null,
      handFocus: null,
      game: ended,
    });
    if (ended) maybeRecordRanked(get, ended);
  },

  startNaming: (mode, seed) => {
    stopLoop();
    stopCountdown();
    stopNamingLoop();
    const ranked = get().matchKind === 'ranked';
    const progress = ranked ? loadRankProgress() : null;
    const difficulty =
      ranked && progress
        ? rollRankedBotDifficulty(progress.rankIndex)
        : get().lobby.difficulty;
    const naming = createNameAuction(mode, difficulty, seed);
    const poolRng = createRng(naming.seed ^ 0x51ceed);
    // Always exactly 16 types per match. Casual: from all spawnable.
    // Ranked: from the rank's unlock catalog (grows with rank).
    const matchPool =
      ranked && progress
        ? pickMatchPool(poolRng, rankedPoolForRank(progress.rankIndex))
        : pickMatchPool(poolRng);
    set({
      phase: 'naming',
      lobby: { ...get().lobby, mode, difficulty },
      naming,
      game: null,
      codexOpen: false,
      floats: [],
      activeFx: [],
      knockoutOffer: false,
      knockoutReason: null,
      knockoutReport: null,
      spectating: false,
      matchPool,
      poolRevealOpen: false,
      poolRevealEndsAt: null,
      poolRevealPeeked: false,
      rankedRankIndex: ranked && progress ? progress.rankIndex : null,
    });

    namingLoopId = setInterval(() => {
      const cur = get().naming;
      if (!cur || get().phase !== 'naming') return;
      const next = tickNameAuction(cur, CONFIG.TICK_MS, rng);
      if (next.msLeft <= 0) {
        stopNamingLoop();
        set({ naming: next });
        get().finishNaming();
        return;
      }
      set({ naming: next });
    }, CONFIG.TICK_MS);
  },

  bidNameTag: (tagId) => {
    if (get().online) {
      sendOnline('bid_name', { tagId });
      return;
    }
    const { naming, phase } = get();
    if (!naming || phase !== 'naming') return;
    set({ naming: bidOnNameTag(naming, naming.humanId, tagId) });
  },

  openPoolReveal: () => {
    const { phase, naming, matchPool, poolRevealEndsAt } = get();
    if (!matchPool && phase !== 'playing') return;
    if (phase === 'playing') {
      const pool = get().game?.itemPool ?? matchPool;
      if (!pool) return;
      set({ poolRevealOpen: true, handFocus: null, targeting: null });
      return;
    }
    if (!matchPool) return;
    if (phase === 'naming') {
      const endsAt =
        poolRevealEndsAt ??
        Date.now() + (naming?.msLeft ?? 0) + CONFIG.POOL_REVEAL_MS;
      set({
        poolRevealOpen: true,
        poolRevealEndsAt: endsAt,
        poolRevealPeeked: true,
      });
      return;
    }
    if (phase === 'countdown') {
      set({ poolRevealOpen: true });
    }
  },

  closePoolReveal: () => {
    const { phase } = get();
    // Dismissible during Tag Sale peek or mid-match peek
    if (phase !== 'naming' && phase !== 'playing') return;
    set({ poolRevealOpen: false });
  },

  finishNaming: () => {
    stopNamingLoop();
    const { naming, lobby, matchPool, matchKind, rankedRankIndex } = get();
    if (!naming) return;
    const identities = resolveNameAuction(naming);
    const eventPool =
      matchKind === 'ranked' && rankedRankIndex != null
        ? rankedEventPoolForRank(rankedRankIndex)
        : [...RANDOM_WORLD_EVENT_IDS];
    let game = createInitialState(
      {
        mode: naming.mode,
        difficulty: naming.difficulty,
        identities,
      },
      naming.seed,
      matchPool ?? undefined,
      eventPool,
    );
    startCountdownFromGame(get, set, game);
    set({ lobby: { ...lobby, mode: naming.mode, identities } });
  },

  beginPlaying: () => {
    stopCountdown();
    set({
      phase: 'playing',
      countdown: 0,
      poolRevealOpen: false,
      poolRevealEndsAt: null,
      poolRevealPeeked: false,
    });
    if (!get().online) startLoop(get);
  },

  returnToLobby: () => {
    stopLoop();
    stopCountdown();
    stopNamingLoop();
    void leaveOnlineRoom(false);
    set({
      phase: 'lobby',
      game: null,
      naming: null,
      targeting: null,
      handFocus: null,
      floats: [],
      activeFx: [],
      countdown: 0,
      codexOpen: false,
      knockoutOffer: false,
      knockoutReason: null,
      knockoutReport: null,
      spectating: false,
      matchPool: null,
      poolRevealOpen: false,
      poolRevealEndsAt: null,
      poolRevealPeeked: false,
      online: false,
      roomCode: null,
      sessionId: null,
      myPlayerId: null,
      myBidderId: null,
      onlineHost: false,
      onlineSeats: [],
      onlineError: null,
      matchKind: null,
      rankedRankIndex: null,
    });
  },

  enterSpectate: () => {
    set({
      knockoutOffer: false,
      spectating: true,
      targeting: null,
      handFocus: null,
    });
  },

  replayMatch: () => {
    if (get().online) {
      get().returnToLobby();
      return;
    }
    const { lobby } = get();
    stopLoop();
    stopCountdown();
    stopNamingLoop();
    set({
      poolRevealOpen: false,
      poolRevealEndsAt: null,
      poolRevealPeeked: false,
      matchPool: null,
    });
    if (lobby.identities && lobby.identities.length > 0) {
      const { matchKind, rankedRankIndex } = get();
      const eventPool =
        matchKind === 'ranked' && rankedRankIndex != null
          ? rankedEventPoolForRank(rankedRankIndex)
          : [...RANDOM_WORLD_EVENT_IDS];
      const game = createInitialState(
        {
          mode: lobby.mode,
          difficulty: lobby.difficulty,
          identities: lobby.identities,
        },
        Date.now(),
        undefined,
        eventPool,
      );
      startCountdownFromGame(get, set, game);
      return;
    }
    get().startNaming(lobby.mode);
  },

  bidTile: (tileIndex) => {
    const { game, phase, targeting, spectating, knockoutOffer, online } = get();
    if (!game || phase !== 'playing' || targeting || spectating || knockoutOffer)
      return;
    const human = game.players.find((p) => p.id === game.humanId);
    if (!human?.isAlive) return;
    if (online) {
      sendOnline('bid', { tileIndex });
      return;
    }
    commitGame(set, get, bid(game, game.humanId, tileIndex));
  },

  sellFocused: () => {
    const {
      game,
      phase,
      targeting,
      handFocus,
      spectating,
      knockoutOffer,
      online,
    } = get();
    if (!game || phase !== 'playing' || spectating || knockoutOffer) return;
    const human = game.players.find((p) => p.id === game.humanId);
    if (!human?.isAlive) return;
    const instanceId = targeting?.instanceId ?? handFocus;
    if (!instanceId) return;
    if (online) {
      sendOnline('sell', { instanceId });
      set({ targeting: null, handFocus: null });
      return;
    }
    commitGame(set, get, sellItem(game, game.humanId, instanceId, rng), {
      targeting: null,
      handFocus: null,
    });
  },

  useFocused: () => {
    const {
      game,
      phase,
      targeting,
      handFocus,
      spectating,
      knockoutOffer,
      online,
    } = get();
    if (!game || phase !== 'playing' || spectating || knockoutOffer) return;
    if (targeting) return;
    const human = game.players.find((p) => p.id === game.humanId);
    if (!human?.isAlive || !handFocus) return;
    const item = human.hand.find((h) => h.instanceId === handFocus);
    if (!item) return;
    if (!canInstantUse(item)) return;
    if (online) {
      sendOnline('use', { instanceId: handFocus, targets: {} });
      set({ targeting: null, handFocus: null });
      return;
    }
    commitGame(
      set,
      get,
      applyUseItem(game, game.humanId, handFocus, {}, rng),
      { targeting: null, handFocus: null },
    );
  },

  selectHandItem: (instanceId) => {
    const { game, phase, handFocus, targeting, spectating, knockoutOffer } =
      get();
    if (!game || phase !== 'playing' || spectating || knockoutOffer) return;
    const human = game.players.find((p) => p.id === game.humanId);
    if (!human?.isAlive) return;
    const item = human.hand.find((h) => h.instanceId === instanceId);
    if (!item) return;

    if (
      targeting?.target === 'hand-then-item' &&
      targeting.selectedHandInstanceId === undefined &&
      instanceId !== targeting.instanceId
    ) {
      if (item.itemId === 'bomb') return;
      set({
        targeting: { ...targeting, selectedHandInstanceId: instanceId },
      });
      return;
    }

    if (
      targeting?.target === 'hand' &&
      instanceId !== targeting.instanceId
    ) {
      if (item.itemId === 'bomb' || item.itemId === 'dynamite') return;
      commitUse(set, get, targeting.instanceId, {
        handInstanceId: instanceId,
      });
      return;
    }

    if (handFocus === instanceId || targeting?.instanceId === instanceId) {
      set({ handFocus: null, targeting: null });
      return;
    }

    const def = getItem(item.itemId);

    // Passives / bombs / instant actives: select first (Use only if instant)
    if (def.kind !== 'active' || canInstantUse(item) || def.target === 'special') {
      set({ handFocus: instanceId, targeting: null });
      return;
    }

    const target =
      item.itemId === 'swap_portal' && item.golden
        ? ('hand-then-item' as const)
        : def.target;

    set({
      handFocus: instanceId,
      targeting: {
        playerId: game.humanId,
        instanceId,
        itemId: item.itemId,
        target,
        golden: item.golden,
      },
    });
  },

  cancelTargeting: () => set({ targeting: null, handFocus: null }),

  selectTargetTile: (tileIndex) => {
    const { game, targeting } = get();
    if (!game || !targeting) return;

    if (targeting.target === 'hand-then-item') {
      if (!targeting.selectedHandInstanceId) return;
      commitUse(set, get, targeting.instanceId, {
        tileIndex,
        handInstanceId: targeting.selectedHandInstanceId,
      });
      return;
    }

    if (targeting.target === 'item') {
      commitUse(set, get, targeting.instanceId, { tileIndex });
      return;
    }

    if (targeting.target === 'two-items') {
      if (targeting.selectedTile === undefined) {
        set({ targeting: { ...targeting, selectedTile: tileIndex } });
        return;
      }
      if (targeting.selectedTile === tileIndex) return;
      commitUse(set, get, targeting.instanceId, {
        tileIndex: targeting.selectedTile,
        tileIndexB: tileIndex,
      });
    }
  },

  selectTargetPlayer: (playerId) => {
    const { game, targeting } = get();
    if (!game || !targeting || targeting.target !== 'player') return;
    if (playerId === game.humanId) return;
    commitUse(set, get, targeting.instanceId, { playerId });
  },

  reorderHandSlots: (fromIndex, toIndex) => {
    const { game, phase, spectating, knockoutOffer, online } = get();
    if (!game || phase !== 'playing' || spectating || knockoutOffer) return;
    const human = game.players.find((p) => p.id === game.humanId);
    if (!human?.isAlive) return;
    if (online) {
      sendOnline('reorder_hand', { fromIndex, toIndex });
      return;
    }
    commitGame(set, get, reorderHand(game, game.humanId, fromIndex, toIndex));
  },

  masterTick: (dtMs = CONFIG.TICK_MS) => {
    if (get().online) return;
    const { game, phase, handFocus, knockoutOffer, spectating } = get();
    if (!game || phase !== 'playing') return;

    const wasAlive =
      game.players.find((p) => p.id === game.humanId)?.isAlive ?? false;

    let next = tick(game, dtMs, rng);
    if (!next.ended) {
      next = applyBotIntents(next);
    }

    const ingested = ingest(next, get().floats, get().activeFx);

    let focus = handFocus;
    if (focus) {
      const human = ingested.game.players.find(
        (p) => p.id === ingested.game.humanId,
      );
      if (!human?.hand.some((h) => h.instanceId === focus)) {
        focus = null;
      }
    }

    const humanNow = ingested.game.players.find(
      (p) => p.id === ingested.game.humanId,
    );
    const justDied = wasAlive && humanNow && !humanNow.isAlive;

    let offer = knockoutOffer;
    let reason = get().knockoutReason;
    let report = get().knockoutReport;
    let spectate = spectating;
    if (justDied && !spectating) {
      focus = null;
      const elim = ingested.lastEvents.find(
        (e) => e.type === 'eliminate' && e.playerId === ingested.game.humanId,
      );
      reason =
        elim && elim.type === 'eliminate' ? elim.reason : reason ?? 'unpaid';
      report =
        elim && elim.type === 'eliminate' && elim.report
          ? elim.report
          : humanNow?.deathReport ?? report;
      offer = true;
    }

    if (ingested.game.ended) {
      stopLoop();
      maybeRecordRanked(get, ingested.game);
      set({
        game: ingested.game,
        phase: 'results',
        floats: ingested.floats,
        activeFx: ingested.activeFx,
        lastEvents: ingested.lastEvents,
        targeting: null,
        handFocus: null,
        knockoutOffer: false,
        knockoutReport: report ?? humanNow?.deathReport ?? get().knockoutReport,
        ...(spectate ? { spectating: true } : {}),
      });
      return;
    }

    set({
      game: ingested.game,
      floats: ingested.floats,
      activeFx: ingested.activeFx,
      lastEvents: ingested.lastEvents,
      handFocus: focus,
      knockoutOffer: offer,
      knockoutReason: reason,
      knockoutReport: report,
      ...(justDied
        ? { targeting: null, ...(spectate ? { spectating: true } : {}) }
        : {}),
    });
  },
}));

/** Latest fx kind for a tile (if any). */
export function fxForTile(activeFx: FxInstance[], tileIndex: number): FxInstance | null {
  for (let i = activeFx.length - 1; i >= 0; i--) {
    const f = activeFx[i]!;
    if (f.tileIndex === tileIndex || f.tileIndexB === tileIndex) return f;
  }
  return null;
}

export function fxForPlayer(activeFx: FxInstance[], playerId: string): FxInstance | null {
  for (let i = activeFx.length - 1; i >= 0; i--) {
    const f = activeFx[i]!;
    if (f.kind === 'active_cast' && f.playerId === playerId) return f;
  }
  for (let i = activeFx.length - 1; i >= 0; i--) {
    const f = activeFx[i]!;
    if (f.kind === 'active_cast') continue;
    if (f.playerId === playerId || f.targetPlayerId === playerId) return f;
  }
  return null;
}

export function fxForHandItem(activeFx: FxInstance[], instanceId: string): FxInstance | null {
  for (let i = activeFx.length - 1; i >= 0; i--) {
    const f = activeFx[i]!;
    if (f.instanceId === instanceId) return f;
  }
  return null;
}

