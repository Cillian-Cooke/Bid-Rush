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
} from './game/engine';
import { getItem } from './game/items';
import {
  bidOnNameTag,
  createNameAuction,
  resolveNameAuction,
  tickNameAuction,
} from './game/naming';
import type {
  DifficultyMode,
  FxKind,
  GameEvent,
  GameState,
  LobbyConfig,
  NameAuctionState,
  Phase,
  TargetingMode,
  UseTargets,
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

  setMode: (mode: GameMode) => void;
  setDifficulty: (d: DifficultyMode) => void;
  setCodexOpen: (open: boolean) => void;

  startNaming: (mode: GameMode) => void;
  bidNameTag: (tagId: string) => void;
  finishNaming: () => void;

  beginPlaying: () => void;
  returnToLobby: () => void;

  bidTile: (tileIndex: number) => void;
  sellFocused: () => void;
  selectHandItem: (instanceId: string) => void;
  cancelTargeting: () => void;
  selectTargetTile: (tileIndex: number) => void;
  selectTargetPlayer: (playerId: string) => void;

  masterTick: () => void;
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
        text: `+${e.amount} 🪙`,
        createdAt: now,
      });
    } else if (e.type === 'loss') {
      next.push({
        id: ++floatSeq,
        playerId: e.playerId,
        text: `-${e.amount} 🪙`,
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
    if (!player.isAlive || player.isHuman) continue;
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
  set({
    phase: 'countdown',
    countdown: 3,
    game,
    naming: null,
    targeting: null,
    handFocus: null,
    floats: [],
    activeFx: [],
  });

  countdownId = setInterval(() => {
    const c = get().countdown;
    if (c <= 0) {
      stopCountdown();
      get().beginPlaying();
    } else {
      set({ countdown: c - 1 });
    }
  }, 1000);
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

  setMode: (mode) => set((s) => ({ lobby: { ...s.lobby, mode } })),
  setDifficulty: (d) => set((s) => ({ lobby: { ...s.lobby, difficulty: d } })),
  setCodexOpen: (open) => set({ codexOpen: open }),

  startNaming: (mode) => {
    stopLoop();
    stopCountdown();
    stopNamingLoop();
    const difficulty = get().lobby.difficulty;
    const naming = createNameAuction(mode, difficulty);
    set({
      phase: 'naming',
      lobby: { ...get().lobby, mode },
      naming,
      game: null,
      codexOpen: false,
      floats: [],
      activeFx: [],
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
    const { naming, phase } = get();
    if (!naming || phase !== 'naming') return;
    set({ naming: bidOnNameTag(naming, naming.humanId, tagId) });
  },

  finishNaming: () => {
    stopNamingLoop();
    const { naming, lobby } = get();
    if (!naming) return;
    const identities = resolveNameAuction(naming);
    const game = createInitialState({
      mode: naming.mode,
      difficulty: naming.difficulty,
      identities,
    }, naming.seed);
    startCountdownFromGame(get, set, game);
    set({ lobby: { ...lobby, mode: naming.mode, identities } });
  },

  beginPlaying: () => {
    stopCountdown();
    set({ phase: 'playing', countdown: 0 });
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
      countdown: 3,
      codexOpen: false,
    });
  },

  bidTile: (tileIndex) => {
    const { game, phase, targeting } = get();
    if (!game || phase !== 'playing' || targeting) return;
    commitGame(set, get, bid(game, game.humanId, tileIndex));
  },

  sellFocused: () => {
    const { game, phase, targeting, handFocus } = get();
    if (!game || phase !== 'playing') return;
    const instanceId = targeting?.instanceId ?? handFocus;
    if (!instanceId) return;
    commitGame(set, get, sellItem(game, game.humanId, instanceId, rng), {
      targeting: null,
      handFocus: null,
    });
  },

  selectHandItem: (instanceId) => {
    const { game, phase, handFocus, targeting } = get();
    if (!game || phase !== 'playing') return;
    const human = game.players.find((p) => p.id === game.humanId);
    const item = human?.hand.find((h) => h.instanceId === instanceId);
    if (!item) return;

    if (handFocus === instanceId || targeting?.instanceId === instanceId) {
      set({ handFocus: null, targeting: null });
      return;
    }

    const def = getItem(item.itemId);

    if (def.kind !== 'active' || def.target === 'special') {
      set({ handFocus: instanceId, targeting: null });
      return;
    }

    if (def.target === 'none' || def.target === 'all-items') {
      commitGame(set, get, applyUseItem(game, game.humanId, instanceId, {}, rng), {
        targeting: null,
        handFocus: null,
      });
      return;
    }

    set({
      handFocus: instanceId,
      targeting: {
        playerId: game.humanId,
        instanceId,
        itemId: item.itemId,
        target: def.target,
      },
    });
  },

  cancelTargeting: () => set({ targeting: null, handFocus: null }),

  selectTargetTile: (tileIndex) => {
    const { game, targeting } = get();
    if (!game || !targeting) return;

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
        { playerId } satisfies UseTargets,
        rng,
      ),
      { targeting: null, handFocus: null },
    );
  },

  masterTick: () => {
    const { game, phase, handFocus } = get();
    if (!game || phase !== 'playing') return;

    let next = tick(game, CONFIG.TICK_MS, rng);
    if (!next.ended) {
      next = applyBotIntents(next);
    }

    const ingested = ingest(next, get().floats, get().activeFx);

    let focus = handFocus;
    if (focus) {
      const human = ingested.game.players.find((p) => p.id === ingested.game.humanId);
      if (!human?.hand.some((h) => h.instanceId === focus)) {
        focus = null;
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
      });
      return;
    }

    set({
      game: ingested.game,
      floats: ingested.floats,
      activeFx: ingested.activeFx,
      lastEvents: ingested.lastEvents,
      handFocus: focus,
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

