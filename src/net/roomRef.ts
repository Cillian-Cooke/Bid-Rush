import type { Room } from '@colyseus/sdk';
import type { ClientMessages } from './protocol';

let room: Room | null = null;

export function setOnlineRoom(next: Room | null) {
  room = next;
}

export function getOnlineRoom(): Room | null {
  return room;
}

export function sendOnline<K extends keyof ClientMessages>(
  type: K,
  payload: ClientMessages[K],
): boolean {
  if (!room) return false;
  room.send(type, payload);
  return true;
}
