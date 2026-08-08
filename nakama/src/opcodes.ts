/**
 * Shared op-codes for Bid Rush Nakama matches (client ↔ server).
 * Keep in sync with src/net/opcodes.ts
 */
export const Op = {
  Lobby: 1,
  You: 2,
  Naming: 3,
  Game: 4,
  MatchEnded: 5,
  Error: 6,
  /** Client → server envelope: { type: ClientMsg, ... } */
  Action: 20,
} as const;

export type ClientActionType =
  | 'set_options'
  | 'set_ready'
  | 'start'
  | 'bid_name'
  | 'bid'
  | 'sell'
  | 'use'
  | 'reorder_hand';
