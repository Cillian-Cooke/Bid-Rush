import type { GameEvent, GameState, ItemId, WorldEventState } from '../game/types';
import { playSfx, type SfxId } from './sfx';

const HOSTILE_ITEMS = new Set<ItemId>([
  'handcuffs',
  'pickpocket',
  'heist_kit',
  'mute',
  'roi',
  'curse_idol',
  'quick_swap',
  'siphon',
  'plunder',
]);

const BOARD_ITEMS = new Set<ItemId>([
  'price_doubler',
  'bargain',
  'inflation',
  'time_freeze',
  'fast_forward',
  'swap_portal',
  'shop_refresh',
  'chaos_die',
  'bid_lock',
  'magnet',
  'kickback',
  'gilder',
  'haste_gear',
  'xray_goggles',
]);

function liveKeys(we: WorldEventState | undefined): Set<string> {
  if (!we) return new Set();
  return new Set(we.live.map((l) => l.key));
}

function castSfxForItem(itemId: string | undefined): SfxId {
  if (itemId && HOSTILE_ITEMS.has(itemId as ItemId)) return 'active_cast_hostile';
  if (itemId && BOARD_ITEMS.has(itemId as ItemId)) return 'active_cast_board';
  return 'active_cast';
}

/**
 * Play impactful one-shots from ingested engine events + world-event edges.
 * Skips frequent money ticks (income/loss/dividends) by design.
 */
export function reactGameSfx(opts: {
  prev: GameState | null | undefined;
  next: GameState;
  events: GameEvent[];
  humanId: string;
}): void {
  const { prev, next, events, humanId } = opts;

  for (const e of events) {
    if (e.type === 'resolve' && e.winnerId) {
      playSfx(e.winnerId === humanId ? 'bid_win_self' : 'bid_win_rival');
      continue;
    }
    if (e.type === 'fx' && e.kind === 'active_cast') {
      playSfx(castSfxForItem(e.label));
      continue;
    }
    if (e.type === 'explosion') {
      playSfx('explosion');
      continue;
    }
    if (e.type === 'fx' && e.kind === 'magnet') {
      playSfx('magnet_tick');
      continue;
    }
    if (e.type === 'income' && e.emoji === '🧲') {
      playSfx('magnet_tick');
    }
  }

  const prevWe = prev?.worldEvent;
  const nextWe = next.worldEvent;
  if (!nextWe) return;

  if (prevWe?.phase !== 'warning' && nextWe.phase === 'warning') {
    playSfx('event_warn');
  }

  const before = liveKeys(prevWe);
  for (const key of liveKeys(nextWe)) {
    if (!before.has(key)) {
      playSfx('event_start');
      break;
    }
  }
}
