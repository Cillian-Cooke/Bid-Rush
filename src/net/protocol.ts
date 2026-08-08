import type {
  DifficultyMode,
  GameMode,
  GameState,
  ItemId,
  NameAuctionState,
  UseTargets,
} from '../game/types';
import type { CustomMatchSettings } from '../game/customSettings';

/** Colyseus room name (legacy - online play uses Nakama matches) */
export const ROOM_NAME = 'bid_rush' as const;

export type OnlineSeatView = {
  sessionId: string;
  displayName: string;
  ready: boolean;
  color: string;
  connected: boolean;
  seatIndex: number;
};

export type RoomPhase =
  | 'lobby'
  | 'naming'
  | 'countdown'
  | 'playing'
  | 'results';

export type CreateOptions = {
  mode?: GameMode;
  difficulty?: DifficultyMode;
  displayName?: string;
  custom?: Partial<CustomMatchSettings> & { itemIds?: ItemId[] };
};

export type JoinOptions = {
  roomCode?: string;
  displayName?: string;
};

/** Client → server */
export type ClientMessages = {
  set_options: {
    mode?: GameMode;
    difficulty?: DifficultyMode;
    custom?: Partial<CustomMatchSettings> & { itemIds?: ItemId[] };
  };
  set_ready: { ready: boolean };
  start: Record<string, never>;
  bid_name: { tagId: string };
  bid: { tileIndex: number };
  sell: { instanceId: string };
  use: { instanceId: string; targets: UseTargets };
  reorder_hand: { fromIndex: number; toIndex: number };
  leave_to_lobby: Record<string, never>;
};

/** Server → client */
export type ServerMessages = {
  naming: NameAuctionState;
  game: GameState;
  match_ended: { winnerId: string | null };
  error: { message: string };
  /** Maps this client's sessionId → engine player id (player_N) */
  you: { sessionId: string; playerId: string; bidderId: string };
};
