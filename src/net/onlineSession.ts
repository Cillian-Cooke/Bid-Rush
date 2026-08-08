import { Client, type Room } from '@colyseus/sdk';
import type { GameState, NameAuctionState, Phase } from '../game/types';
import { useGameStore } from '../store';
import {
  ROOM_NAME,
  type ClientMessages,
  type CreateOptions,
  type OnlineSeatView,
  type ServerMessages,
} from './protocol';
import { getOnlineRoom, setOnlineRoom } from './roomRef';

function serverUrl(): string {
  return import.meta.env.VITE_COLYSEUS_URL ?? 'http://localhost:2567';
}

function getClient(): Client {
  return new Client(serverUrl());
}

export type { OnlineSeatView };

function seatsFromState(state: {
  seats: Map<string, {
    sessionId: string;
    displayName: string;
    ready: boolean;
    color: string;
    connected: boolean;
    seatIndex: number;
  }> | { forEach: (cb: (seat: OnlineSeatView, key: string) => void) => void };
}): OnlineSeatView[] {
  const out: OnlineSeatView[] = [];
  state.seats.forEach((seat) => {
    out.push({
      sessionId: seat.sessionId,
      displayName: seat.displayName,
      ready: seat.ready,
      color: seat.color,
      connected: seat.connected,
      seatIndex: seat.seatIndex,
    });
  });
  return out.sort((a, b) => a.seatIndex - b.seatIndex);
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

function wireRoom(room: Room) {
  setOnlineRoom(room);

  room.onMessage('you', (msg: ServerMessages['you']) => {
    useGameStore.getState().applyOnlineYou(msg);
  });

  room.onMessage('naming', (naming: ServerMessages['naming']) => {
    const { myBidderId } = useGameStore.getState();
    useGameStore.getState().applyOnlineNaming(remapNaming(naming, myBidderId));
  });

  room.onMessage('game', (game: ServerMessages['game']) => {
    const { myPlayerId } = useGameStore.getState();
    useGameStore.getState().applyOnlineGame(remapGame(game, myPlayerId));
  });

  room.onMessage('match_ended', (msg: ServerMessages['match_ended']) => {
    useGameStore.getState().applyOnlineMatchEnded(msg.winnerId);
  });

  room.onMessage('error', (msg: ServerMessages['error']) => {
    useGameStore.setState({ onlineError: msg.message });
  });

  room.onStateChange((state) => {
    const phase = state.phase as Phase;
    const seats = seatsFromState(state);
    const sessionId = room.sessionId;
    const prev = useGameStore.getState();
    useGameStore.setState({
      online: true,
      roomCode: state.roomCode || room.roomId,
      sessionId,
      onlineHost: state.hostSessionId === sessionId,
      onlineSeats: seats,
      countdown: state.countdown ?? prev.countdown,
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
        mode: (state.mode as 'duel' | 'blitz') || prev.lobby.mode,
        difficulty:
          (state.difficulty as typeof prev.lobby.difficulty) ||
          prev.lobby.difficulty,
      },
    });
  });

  room.onError((_code, message) => {
    useGameStore.setState({
      onlineError: message || 'Connection error',
    });
  });

  room.onLeave(() => {
    setOnlineRoom(null);
    const { phase } = useGameStore.getState();
    if (phase !== 'lobby') {
      useGameStore.getState().returnToLobby();
    } else {
      useGameStore.setState({
        online: false,
        roomCode: null,
        sessionId: null,
        myPlayerId: null,
        myBidderId: null,
        onlineHost: false,
        onlineSeats: [],
      });
    }
  });
}

export async function createOnlineRoom(
  options: CreateOptions = {},
): Promise<string> {
  await leaveOnlineRoom(false);
  const room = await getClient().create(ROOM_NAME, options);
  useGameStore.getState().enterOnlineSession({
    roomCode: room.roomId,
    sessionId: room.sessionId,
  });
  wireRoom(room);
  return room.roomId;
}

export async function joinOnlineRoom(
  roomCode: string,
  options: Omit<CreateOptions, 'mode' | 'difficulty'> = {},
): Promise<void> {
  const code = roomCode.trim();
  if (!code) throw new Error('Enter a room code');
  await leaveOnlineRoom(false);
  const room = await getClient().joinById(code, options);
  useGameStore.getState().enterOnlineSession({
    roomCode: room.roomId,
    sessionId: room.sessionId,
  });
  wireRoom(room);
}

export async function leaveOnlineRoom(resetStore = true): Promise<void> {
  const room = getOnlineRoom();
  setOnlineRoom(null);
  if (room) {
    try {
      await room.leave();
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
  getOnlineRoom()?.send('start', {});
}

export function setOnlineReady(ready: boolean): void {
  getOnlineRoom()?.send('set_ready', { ready });
}

export function setOnlineOptions(
  opts: ClientMessages['set_options'],
): void {
  getOnlineRoom()?.send('set_options', opts);
}
