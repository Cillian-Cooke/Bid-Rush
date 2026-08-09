import type { GameState, NameAuctionState, Phase } from '../game/types';
import { useGameStore } from '../store';
import {
  displayNameForOnline,
  ensureNakamaSession,
  getNakamaSession,
  getNakamaSocket,
  rpcJson,
} from './nakama';
import { Op } from './opcodes';
import type {
  ClientMessages,
  CreateOptions,
  OnlineSeatView,
  ServerMessages,
} from './protocol';
import { setOnlineMatch } from './roomRef';

export type { OnlineSeatView };

type LobbyStateMsg = {
  phase: Phase | string;
  mode: 'duel' | 'blitz';
  difficulty: string;
  queue: string;
  code: string;
  hostUserId: string;
  countdown: number;
  seats: OnlineSeatView[];
};

let activeMatchId: string | null = null;
let leaveHandler: (() => void) | null = null;

function decodeData(data: string | Uint8Array): string {
  if (typeof data === 'string') return data;
  return new TextDecoder().decode(data);
}

function remapNaming(
  naming: NameAuctionState,
  bidderId: string | null,
): NameAuctionState {
  if (!bidderId) return naming;
  return { ...naming, humanId: bidderId };
}

function remapGame(game: GameState, playerId: string | null): GameState {
  if (!playerId) return game;
  return { ...game, humanId: playerId };
}

function applyLobby(lobby: LobbyStateMsg, userId: string) {
  const prev = useGameStore.getState();
  const phase = lobby.phase as Phase;
  useGameStore.setState({
    online: true,
    roomCode: lobby.code || activeMatchId,
    sessionId: userId,
    onlineHost: lobby.hostUserId === userId,
    onlineSeats: [...(lobby.seats || [])].sort(
      (a, b) => a.seatIndex - b.seatIndex,
    ),
    countdown: lobby.countdown ?? prev.countdown,
    phase:
      phase === 'lobby' ||
      phase === 'naming' ||
      phase === 'countdown' ||
      phase === 'playing' ||
      phase === 'results'
        ? phase
        : prev.phase,
    poolRevealOpen:
      phase === 'countdown' ? true : phase === 'playing' ? false : false,
    lobby: {
      ...prev.lobby,
      mode: lobby.mode === 'duel' || lobby.mode === 'blitz' ? lobby.mode : prev.lobby.mode,
      difficulty:
        (lobby.difficulty as typeof prev.lobby.difficulty) ||
        prev.lobby.difficulty,
    },
  });
}

function wireMatch(matchId: string, code: string) {
  const socket = getNakamaSocket();
  const session = getNakamaSession();
  if (!socket || !session?.user_id) {
    throw new Error('Nakama socket unavailable');
  }
  const userId = session.user_id;
  activeMatchId = matchId;

  setOnlineMatch(
    { matchId, code },
    (opCode, data) => socket.sendMatchState(matchId, opCode, data),
  );

  const onData = (msg: {
    match_id: string;
    op_code: number;
    data: string | Uint8Array;
  }) => {
    if (msg.match_id !== matchId) return;
    const text = decodeData(msg.data);
    try {
      if (msg.op_code === Op.Lobby) {
        applyLobby(JSON.parse(text) as LobbyStateMsg, userId);
        return;
      }
      if (msg.op_code === Op.You) {
        useGameStore.getState().applyOnlineYou(
          JSON.parse(text) as ServerMessages['you'],
        );
        return;
      }
      if (msg.op_code === Op.Naming) {
        const naming = JSON.parse(text) as NameAuctionState;
        const { myBidderId } = useGameStore.getState();
        useGameStore
          .getState()
          .applyOnlineNaming(remapNaming(naming, myBidderId));
        return;
      }
      if (msg.op_code === Op.Game) {
        const game = JSON.parse(text) as GameState;
        const { myPlayerId } = useGameStore.getState();
        useGameStore.getState().applyOnlineGame(remapGame(game, myPlayerId));
        return;
      }
      if (msg.op_code === Op.MatchEnded) {
        const { winnerId } = JSON.parse(text) as ServerMessages['match_ended'];
        useGameStore.getState().applyOnlineMatchEnded(winnerId);
        return;
      }
      if (msg.op_code === Op.Error) {
        const { message } = JSON.parse(text) as ServerMessages['error'];
        useGameStore.setState({ onlineError: message });
      }
    } catch {
      /* ignore bad payloads */
    }
  };

  const prevData = socket.onmatchdata;
  socket.onmatchdata = (msg) => {
    onData(msg);
    if (prevData && prevData !== onData) {
      try {
        prevData(msg);
      } catch {
        /* ignore */
      }
    }
  };

  leaveHandler = () => {
    socket.onmatchdata = prevData;
  };

  useGameStore.getState().enterOnlineSession({
    roomCode: code || matchId,
    sessionId: userId,
  });
}

async function joinMatchId(
  matchId: string,
  code: string,
  metadata?: { displayName?: string },
) {
  await leaveOnlineRoom(false);
  await ensureNakamaSession();
  const socket = getNakamaSocket();
  if (!socket) throw new Error('Nakama socket unavailable');
  await socket.joinMatch(matchId, undefined, {
    displayName: metadata?.displayName || displayNameForOnline(),
  });
  wireMatch(matchId, code);
}

export async function createOnlineRoom(
  options: CreateOptions = {},
): Promise<string> {
  await ensureNakamaSession();
  const res = await rpcJson<{ matchId: string; code: string }>(
    'create_custom_match',
    {
      mode: options.mode,
      difficulty: options.difficulty,
      custom: options.custom,
    },
  );
  await joinMatchId(res.matchId, res.code, {
    displayName: options.displayName || displayNameForOnline(),
  });
  return res.code;
}

export async function joinOnlineRoom(
  roomCode: string,
  options: Omit<CreateOptions, 'mode' | 'difficulty'> = {},
): Promise<void> {
  const code = roomCode.trim().toUpperCase();
  if (!code) throw new Error('Enter a room code');
  await ensureNakamaSession();
  const res = await rpcJson<{ matchId: string; code: string }>(
    'join_custom_match',
    { code },
  );
  await joinMatchId(res.matchId, res.code || code, {
    displayName: options.displayName || displayNameForOnline(),
  });
}

/** Join a matchmaker-created Nakama match (already has match id). */
export async function joinMatchedGame(
  matchId: string,
  opts?: { code?: string; displayName?: string },
): Promise<void> {
  await joinMatchId(matchId, opts?.code || matchId.slice(0, 8).toUpperCase(), {
    displayName: opts?.displayName || displayNameForOnline(),
  });
}

export async function leaveOnlineRoom(resetStore = true): Promise<void> {
  const socket = getNakamaSocket();
  const matchId = activeMatchId;
  leaveHandler?.();
  leaveHandler = null;
  setOnlineMatch(null);
  activeMatchId = null;
  if (socket && matchId) {
    try {
      await socket.leaveMatch(matchId);
    } catch {
      /* already gone */
    }
  }
  if (resetStore) {
    useGameStore.setState({
      online: false,
      roomCode: null,
      sessionId: null,
      myPlayerId: null,
      myBidderId: null,
      onlineHost: false,
      onlineSeats: [],
      onlineError: null,
    });
  }
}

export function startOnlineMatch(): void {
  sendAction('start', {});
}

export function setOnlineReady(ready: boolean): void {
  sendAction('set_ready', { ready });
}

export function setOnlineOptions(
  opts: ClientMessages['set_options'],
): void {
  sendAction('set_options', opts);
}

function sendAction<K extends keyof ClientMessages>(
  type: K,
  payload: ClientMessages[K],
) {
  const socket = getNakamaSocket();
  if (!socket || !activeMatchId) {
    useGameStore.setState({
      onlineError: 'Not connected to the match. Try returning to lobby.',
    });
    return;
  }
  void socket.sendMatchState(
    activeMatchId,
    Op.Action,
    JSON.stringify({ type, ...payload }),
  ).catch(() => {
    useGameStore.setState({
      onlineError: 'Could not reach the match server. Reconnecting…',
    });
  });
}
