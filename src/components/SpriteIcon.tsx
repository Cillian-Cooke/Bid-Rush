import type { CSSProperties } from 'react';
import { resolveSpriteId, spriteUrl } from '../sprites/atlas';

type Props = {
  /** Atlas frame id, ItemId, WorldEventId, avatar emoji, or UI emoji */
  id: string;
  className?: string;
  /** CSS size (default inherits from parent font-size via 1em) */
  size?: number | string;
  golden?: boolean;
  alt?: string;
  title?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
};

/**
 * Pixel icon from the Bid Rush sprite atlas.
 * Falls back to Unicode when no frame exists.
 */
export function SpriteIcon({
  id,
  className,
  size,
  golden,
  alt = '',
  title,
  'aria-hidden': ariaHidden,
}: Props) {
  const resolved = resolveSpriteId(id);
  const style: CSSProperties = {
    ...(size != null
      ? {
          width: typeof size === 'number' ? `${size}px` : size,
          height: typeof size === 'number' ? `${size}px` : size,
        }
      : null),
  };

  if (resolved.kind === 'emoji') {
    return (
      <span
        className={['sprite-icon', 'sprite-icon--emoji', className]
          .filter(Boolean)
          .join(' ')}
        style={style}
        title={title}
        aria-hidden={ariaHidden}
      >
        {resolved.emoji}
      </span>
    );
  }

  const src = spriteUrl(resolved.id);
  if (!src) {
    return (
      <span
        className={['sprite-icon', 'sprite-icon--emoji', className]
          .filter(Boolean)
          .join(' ')}
        style={style}
        title={title}
        aria-hidden={ariaHidden}
      >
        ?
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      title={title}
      draggable={false}
      className={[
        'sprite-icon',
        golden ? 'sprite-icon--golden' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-hidden={ariaHidden}
      width={32}
      height={32}
    />
  );
}
