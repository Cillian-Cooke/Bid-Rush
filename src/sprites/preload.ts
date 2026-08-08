import { ATLAS, spriteUrl } from './atlas';

/** Warm the image cache so Tag Sale avatars (and late item icons) aren’t cold. */
export function preloadSprites(): void {
  for (const id of Object.keys(ATLAS.frames)) {
    const url = spriteUrl(id);
    if (!url) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }
}
