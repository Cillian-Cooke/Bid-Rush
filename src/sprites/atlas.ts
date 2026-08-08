import atlasJson from './atlas.json';
import type { ItemId, WorldEventId } from '../game/types';
import { AVATAR_EMOJIS } from '../game/constants';
import { ITEMS } from '../game/items';

export type AtlasFrame = {
  sheet: string;
  x: number;
  y: number;
  w: number;
  h: number;
  folder: string;
  file: string;
};

export type SpriteId = string;

export const ATLAS = atlasJson as {
  cell: number;
  gutter: number;
  palette: string[];
  frames: Record<string, AtlasFrame>;
};

/** Avatar emoji → sprite frame id (matches AVATAR_EMOJIS order). */
export const AVATAR_SPRITE_IDS = [
  'cool',
  'cowboy',
  'fox',
  'cat',
  'frog',
  'lion',
  'panda',
  'tiger',
  'unicorn',
  'dragon',
  'alien',
  'robot',
] as const;

export type AvatarSpriteId = (typeof AVATAR_SPRITE_IDS)[number];

const avatarByEmoji = new Map<string, AvatarSpriteId>();
for (let i = 0; i < AVATAR_EMOJIS.length; i++) {
  const emoji = AVATAR_EMOJIS[i];
  const id = AVATAR_SPRITE_IDS[i];
  if (emoji && id) avatarByEmoji.set(emoji, id);
}

/** Loose map for Tag Sale / handle-pool animals → closest avatar sprite. */
const HANDLE_AVATAR_FALLBACK: Record<string, AvatarSpriteId> = {
  '👺': 'alien',
  '🧙': 'cool',
  '🐺': 'fox',
  '🌪️': 'dragon',
  '🦊': 'fox',
  '🦋': 'unicorn',
  '🐱': 'cat',
  '🐉': 'dragon',
  '🦈': 'tiger',
  '🐧': 'robot',
  '🐊': 'frog',
  '🦡': 'panda',
  '🐦‍⬛': 'cool',
  '🦉': 'cool',
  '🐍': 'dragon',
  '🦇': 'alien',
};

export type UiGlyphId =
  | 'skull'
  | 'runner'
  | 'scales'
  | 'fire'
  | 'coin'
  | 'money_bag'
  | 'receipt'
  | 'bolt'
  | 'tornado'
  | 'star'
  | 'balance'
  | 'lock_status'
  | 'ice_status'
  | 'mute_status'
  | 'roi_status'
  | 'book'
  | 'trophy'
  | 'settings';

/** Common Unicode → UI glyph for status / FX strings. */
export const EMOJI_TO_UI_GLYPH: Record<string, UiGlyphId> = {
  '💀': 'skull',
  '🏃': 'runner',
  '⚖️': 'scales',
  '🔥': 'fire',
  '🪙': 'coin',
  '💰': 'money_bag',
  '🧾': 'receipt',
  '⚡': 'bolt',
  '🌪️': 'tornado',
  '🌟': 'star',
  '🔒': 'lock_status',
  '🧊': 'ice_status',
  '🔇': 'mute_status',
  '📉': 'roi_status',
  '📚': 'book',
  '📖': 'book',
  '🏆': 'trophy',
  '⚙️': 'settings',
};

const emojiToItemId = new Map<string, ItemId>();
for (const def of Object.values(ITEMS)) {
  if (!emojiToItemId.has(def.emoji)) emojiToItemId.set(def.emoji, def.id);
}

export function hasSprite(id: string): boolean {
  return id in ATLAS.frames;
}

export function spriteUrl(id: string): string | null {
  const remapped = id === 'time_freeze' ? 'cold_market' : id;
  const frame = ATLAS.frames[remapped] ?? ATLAS.frames[id];
  if (!frame) return null;
  return `/sprites/${frame.file}`;
}

export function itemSpriteId(id: ItemId): string {
  // Freeze reuses Cold Market’s ice cube art.
  if (id === 'time_freeze') return 'cold_market';
  return id;
}

export function eventSpriteId(id: WorldEventId): string {
  return id;
}

export function avatarSpriteId(emoji: string): AvatarSpriteId | null {
  return avatarByEmoji.get(emoji) ?? HANDLE_AVATAR_FALLBACK[emoji] ?? null;
}

export function resolveSpriteId(
  idOrEmoji: string,
): { kind: 'sprite'; id: string } | { kind: 'emoji'; emoji: string } {
  // Remaps must win even when the original frame still exists in the atlas
  // (Freeze still has time_freeze.png; we show Cold Market's ice cube instead).
  if (idOrEmoji === 'time_freeze' && hasSprite('cold_market')) {
    return { kind: 'sprite', id: 'cold_market' };
  }
  if (hasSprite(idOrEmoji)) return { kind: 'sprite', id: idOrEmoji };
  const avatar = avatarSpriteId(idOrEmoji);
  if (avatar) return { kind: 'sprite', id: avatar };
  const glyph = EMOJI_TO_UI_GLYPH[idOrEmoji];
  if (glyph && hasSprite(glyph)) return { kind: 'sprite', id: glyph };
  const itemId = emojiToItemId.get(idOrEmoji);
  if (itemId) {
    const spriteId = itemSpriteId(itemId);
    if (hasSprite(spriteId)) return { kind: 'sprite', id: spriteId };
  }
  return { kind: 'emoji', emoji: idOrEmoji };
}
