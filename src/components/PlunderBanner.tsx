import { getItem } from '../game/items';
import type { PendingPlunder, Player } from '../game/types';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  pending: PendingPlunder;
  caster: Player | undefined;
};

export function PlunderBanner({ pending, caster }: Props) {
  const def = getItem(pending.itemId);
  const sec = Math.max(0, Math.ceil(pending.msLeft / 1000));
  const casterName = caster?.name ?? 'Rival';

  return (
    <div className="plunder-banner" role="status" aria-live="polite">
      <SpriteIcon
        id={pending.itemId}
        className="plunder-banner-item"
        golden={pending.golden}
        aria-hidden
      />
      <div className="plunder-banner-copy">
        <span className="plunder-banner-kicker">Plunder</span>
        <span className="plunder-banner-line">
          {casterName} is stealing{' '}
          <strong>
            {pending.golden ? 'Golden ' : ''}
            {def.name}
          </strong>
        </span>
      </div>
      <span className="plunder-banner-timer">{sec}s</span>
    </div>
  );
}
