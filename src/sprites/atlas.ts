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

/** Legacy Tag Sale emojis → closest sprite (old matches / history). */
const HANDLE_AVATAR_FALLBACK: Record<string, AvatarSpriteId> = {
  '👺': 'alien',
  '🧙': 'cool',
  '🐺': 'fox',
  '🌪️': 'dragon',
  '🦋': 'unicorn',
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
  '❄️': 'ice_status',
  '🔒': 'lock_status',
  '🧊': 'ice_status',
  '🔇': 'mute_status',
  '📉': 'roi_status',
  '📚': 'book',
  '📖': 'book',
  '🏆': 'trophy',
  '⚙️': 'settings',
};

/** World-event Unicode → event sprite frame (banner / FX fallbacks). */
const EMOJI_TO_EVENT_SPRITE: Record<string, WorldEventId> = {
  '💰': 'money_money_money',
  '🧾': 'tax_collector',
  '🔥': 'fire_sale',
  '❄️': 'deep_freeze',
  '⚡': 'turbo_market',
  '💣': 'bomb_bazaar',
  '🪙': 'coin_shower',
  '🌪️': 'shuffle_storm',
  '📈': 'inflation_wave',
  '🎁': 'mystery_mall',
  '🌟': 'golden_chaos',
};

/** Misc effect Unicode → item / UI frame when not covered above. */
const EMOJI_TO_EFFECT_SPRITE: Record<string, string> = {
  '💥': 'dynamite',
  '🧨': 'dynamite',
  '💸': 'bank_note',
  '🧛': 'coin_leech',
  '👑': 'trophy',
  '💵': 'bank_note',
  '🤝': 'kickback',
  '🧲': 'magnet',
  '📢': 'ipo',
  '🧤': 'pickpocket',
  '🦋': 'chrysalis',
  '🧿': 'curse_idol',
  '🎲': 'chaos_die',
  '🪞': 'mirror',
  '✨': 'gilder',
  '🏷️': 'bargain',
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
  const eventId = EMOJI_TO_EVENT_SPRITE[idOrEmoji];
  if (eventId && hasSprite(eventId)) return { kind: 'sprite', id: eventId };
  const glyph = EMOJI_TO_UI_GLYPH[idOrEmoji];
  if (glyph && hasSprite(glyph)) return { kind: 'sprite', id: glyph };
  const effect = EMOJI_TO_EFFECT_SPRITE[idOrEmoji];
  if (effect && hasSprite(effect)) return { kind: 'sprite', id: effect };
  const itemId = emojiToItemId.get(idOrEmoji);
  if (itemId) {
    const spriteId = itemSpriteId(itemId);
    if (hasSprite(spriteId)) return { kind: 'sprite', id: spriteId };
  }
  // Compound labels like "🌟⛏️" — prefer the item half
  if ([...idOrEmoji].length > 1) {
    const withoutStar = idOrEmoji.replaceAll('🌟', '');
    if (withoutStar && withoutStar !== idOrEmoji) {
      return resolveSpriteId(withoutStar);
    }
    for (const part of idOrEmoji) {
      const nested = resolveSpriteId(part);
      if (nested.kind === 'sprite') return nested;
    }
  }
  return { kind: 'emoji', emoji: idOrEmoji };
}
