import type { ClientMessages } from './protocol';
import { Op } from './opcodes';

export type NakamaMatchHandle = {
  matchId: string;
  /** Short lobby code shown to players */
  code: string;
};

let handle: NakamaMatchHandle | null = null;
let sendFn:
  | ((opCode: number, data: string) => void | Promise<void>)
  | null = null;

export function setOnlineMatch(
  next: NakamaMatchHandle | null,
  sender?: (opCode: number, data: string) => void | Promise<void>,
) {
  handle = next;
  sendFn = sender ?? null;
}

export function getOnlineMatch(): NakamaMatchHandle | null {
  return handle;
}

export function sendOnline<K extends keyof ClientMessages>(
  type: K,
  payload: ClientMessages[K],
): boolean {
  if (!handle || !sendFn) return false;
  try {
    const result = sendFn(Op.Action, JSON.stringify({ type, ...payload }));
    if (result && typeof (result as Promise<void>).then === 'function') {
      void (result as Promise<void>).catch(() => {
        /* caller may surface via onlineError elsewhere */
      });
    }
    return true;
  } catch {
    return false;
  }
}
