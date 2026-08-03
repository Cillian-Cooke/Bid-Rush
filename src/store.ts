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
import { getItem, pickMatchPool } from './game/items';
import {
  bidOnNameTag,
  createNameAuction,
  resolveNameAuction,
  tickNameAuction,
} from './game/naming';
import { isShortsMode, isStepRecordMode } from './game/shortsProfile';
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
  /** Advance naming / countdown / match by dtMs (step-record mode). */
  stepRecord: (dtMs: number) => void;
};

let loopId: ReturnType<typeof setInterval> | null = null;
let countdownId: ReturnType<typeof setInterval> | null = null;
let namingLoopId: ReturnType<typeof setInterval> | null = null;
let floatSeq = 0;
let fxSeq = 0;
let rng = createRng(Date.now());
/** Step-record: ms left in pool countdown before GO */
let stepCountdownRemainMs = 0;
/** Step-record: brief GO beat before beginPlaying */
let stepGoDelayRemainMs = 0;

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
  if (isStepRecordMode()) return; // recorder drives masterTick via stepRecord
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
        text: `+${e.amount}`,
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
        text: `-${e.amount}`,
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
  const shorts = isShortsMode();
  for (const player of state.players) {
    if (!player.isAlive) continue;
    // Shorts: drive the camera ("human") seat with bot AI too
    if (player.isHuman && !shorts) continue;
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
    const arch = player.archetype ?? (shorts && player.isHuman ? 'ruthless' : 'balanced');
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

function startCountdownFromGame(get: () => Store, set: (p: Partial<Store>) => void, game: GameState) {
  stopCountdown();
  stopNamingLoop();
  rng = createRng(game.seed);

  if (isStepRecordMode()) {
    stepCountdownRemainMs = CONFIG.POOL_REVEAL_MS;
    stepGoDelayRemainMs = 0;
    set({
      phase: 'countdown',
      countdown: Math.max(1, Math.ceil(stepCountdownRemainMs / 1000)),
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
      poolRevealEndsAt: null,
      matchPool: game.itemPool,
    });
    return;
  }

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

  setMode: (mode) => set((s) => ({ lobby: { ...s.lobby, mode } })),
  setDifficulty: (d) => set((s) => ({ lobby: { ...s.lobby, difficulty: d } })),
  setCodexOpen: (open) => set({ codexOpen: open }),

  startNaming: (mode, seed) => {
    stopLoop();
    stopCountdown();
    stopNamingLoop();
    const difficulty = isShortsMode() ? 'ruthless' : get().lobby.difficulty;
    const naming = createNameAuction(mode, difficulty, seed);
    const poolRng = createRng(naming.seed ^ 0x51ceed);
    const matchPool = pickMatchPool(poolRng);
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
    });

    if (isStepRecordMode()) return;

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
    const { naming, lobby, matchPool } = get();
    if (!naming) return;
    const identities = resolveNameAuction(naming);
    let game = createInitialState(
      {
        mode: naming.mode,
        difficulty: naming.difficulty,
        identities,
      },
      naming.seed,
      matchPool ?? undefined,
    );
    // Shorts: bot-drive the camera seat while keeping human UI (hand dock)
    if (isShortsMode()) {
      game = {
        ...game,
        players: game.players.map((p) =>
          p.isHuman
            ? {
                ...p,
                archetype: 'ruthless',
                botCooldownMs: 100 + Math.floor(rng() * 200),
              }
            : p,
        ),
      };
    }
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
    startLoop(get);
  },

  returnToLobby: () => {
    stopLoop();
    stopCountdown();
    stopNamingLoop();
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
      const game = createInitialState(
        {
          mode: lobby.mode,
          difficulty: lobby.difficulty,
          identities: lobby.identities,
        },
        Date.now(),
      );
      startCountdownFromGame(get, set, game);
      return;
    }
    get().startNaming(lobby.mode);
  },

  bidTile: (tileIndex) => {
    const { game, phase, targeting, spectating, knockoutOffer } = get();
    if (!game || phase !== 'playing' || targeting || spectating || knockoutOffer)
      return;
    const human = game.players.find((p) => p.id === game.humanId);
    if (!human?.isAlive) return;
    commitGame(set, get, bid(game, game.humanId, tileIndex));
  },

  sellFocused: () => {
    const { game, phase, targeting, handFocus, spectating, knockoutOffer } =
      get();
    if (!game || phase !== 'playing' || spectating || knockoutOffer) return;
    const human = game.players.find((p) => p.id === game.humanId);
    if (!human?.isAlive) return;
    const instanceId = targeting?.instanceId ?? handFocus;
    if (!instanceId) return;
    commitGame(set, get, sellItem(game, game.humanId, instanceId, rng), {
      targeting: null,
      handFocus: null,
    });
  },

  useFocused: () => {
    const { game, phase, targeting, handFocus, spectating, knockoutOffer } =
      get();
    if (!game || phase !== 'playing' || spectating || knockoutOffer) return;
    if (targeting) return;
    const human = game.players.find((p) => p.id === game.humanId);
    if (!human?.isAlive || !handFocus) return;
    const item = human.hand.find((h) => h.instanceId === handFocus);
    if (!item) return;
    const def = getItem(item.itemId);
    const instant =
      def.kind === 'active' &&
      (def.target === 'none' ||
        def.target === 'all-items' ||
        (item.itemId === 'time_freeze' && item.golden) ||
        (item.itemId === 'ipo' && item.golden));
    if (!instant) return;
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
      commitGame(
        set,
        get,
        applyUseItem(
          game,
          targeting.playerId,
          targeting.instanceId,
          { handInstanceId: instanceId },
          rng,
        ),
        { targeting: null, handFocus: null },
      );
      return;
    }

    if (handFocus === instanceId || targeting?.instanceId === instanceId) {
      set({ handFocus: null, targeting: null });
      return;
    }

    const def = getItem(item.itemId);

    // Passives, bombs, and instant actives: select first (Use / Sell above)
    if (
      def.kind !== 'active' ||
      def.target === 'special' ||
      def.target === 'none' ||
      def.target === 'all-items' ||
      (item.itemId === 'time_freeze' && item.golden) ||
      (item.itemId === 'ipo' && item.golden)
    ) {
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
      commitGame(
        set,
        get,
        applyUseItem(
          game,
          targeting.playerId,
          targeting.instanceId,
          {
            tileIndex,
            handInstanceId: targeting.selectedHandInstanceId,
          },
          rng,
        ),
        { targeting: null, handFocus: null },
      );
      return;
    }

    if (targeting.target === 'item') {
      commitGame(
        set,
        get,
        applyUseItem(
          game,
          targeting.playerId,
          targeting.instanceId,
          { tileIndex },
          rng,
        ),
        { targeting: null, handFocus: null },
      );
      return;
    }

    if (targeting.target === 'two-items') {
      if (targeting.selectedTile === undefined) {
        set({ targeting: { ...targeting, selectedTile: tileIndex } });
        return;
      }
      if (targeting.selectedTile === tileIndex) return;
      commitGame(
        set,
        get,
        applyUseItem(
          game,
          targeting.playerId,
          targeting.instanceId,
          { tileIndex: targeting.selectedTile, tileIndexB: tileIndex },
          rng,
        ),
        { targeting: null, handFocus: null },
      );
    }
  },

  selectTargetPlayer: (playerId) => {
    const { game, targeting } = get();
    if (!game || !targeting || targeting.target !== 'player') return;
    if (playerId === game.humanId) return;
    commitGame(
      set,
      get,
      applyUseItem(
        game,
        targeting.playerId,
        targeting.instanceId,
        { playerId },
        rng,
      ),
      { targeting: null, handFocus: null },
    );
  },

  reorderHandSlots: (fromIndex, toIndex) => {
    const { game, phase, spectating, knockoutOffer } = get();
    if (!game || phase !== 'playing' || spectating || knockoutOffer) return;
    const human = game.players.find((p) => p.id === game.humanId);
    if (!human?.isAlive) return;
    commitGame(set, get, reorderHand(game, game.humanId, fromIndex, toIndex));
  },

  masterTick: (dtMs = CONFIG.TICK_MS) => {
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
      if (isShortsMode()) {
        // Keep recording the board; skip knockout modal
        offer = false;
        spectate = true;
      } else {
        offer = true;
      }
    }

    if (ingested.game.ended) {
      stopLoop();
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

  stepRecord: (dtMs) => {
    if (!isStepRecordMode() || dtMs <= 0) return;
    const { phase } = get();

    if (phase === 'naming') {
      const cur = get().naming;
      if (!cur) return;
      const next = tickNameAuction(cur, dtMs, rng);
      if (next.msLeft <= 0) {
        set({ naming: next });
        get().finishNaming();
      } else {
        set({ naming: next });
      }
      return;
    }

    if (phase === 'countdown') {
      if (stepGoDelayRemainMs > 0) {
        stepGoDelayRemainMs -= dtMs;
        if (stepGoDelayRemainMs <= 0) {
          stepGoDelayRemainMs = 0;
          get().beginPlaying();
        }
        return;
      }
      stepCountdownRemainMs -= dtMs;
      if (stepCountdownRemainMs <= 0) {
        stepCountdownRemainMs = 0;
        set({ countdown: 0 });
        stepGoDelayRemainMs = 450;
      } else {
        set({
          countdown: Math.max(1, Math.ceil(stepCountdownRemainMs / 1000)),
        });
      }
      return;
    }

    if (phase === 'playing') {
      get().masterTick(dtMs);
    }
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

