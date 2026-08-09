import { X } from 'lucide-react';
import { getItem } from '../game/items';
import type { TargetingMode, Tile } from '../game/types';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  targeting: TargetingMode;
  tiles?: Tile[];
  onCancel: () => void;
};

export function TargetingOverlay({ targeting, tiles = [], onCancel }: Props) {
  const def = getItem(targeting.itemId);
  const selectedTile =
    targeting.selectedTile !== undefined
      ? tiles.find((t) => t.index === targeting.selectedTile)
      : undefined;

  let hint = 'Tap a target';
  let step: string | null = null;
  if (targeting.target === 'item') hint = 'Tap a shop tile';
  if (targeting.target === 'hand') hint = 'Tap a hand item';
  if (targeting.target === 'two-items') {
    if (targeting.selectedTile === undefined) {
      hint = 'Pick tile 1';
      step = '1/2';
    } else {
      hint = 'Pick tile 2';
      step = '2/2';
    }
  }
  if (targeting.target === 'player') hint = 'Tap a rival';
  if (targeting.target === 'hand-then-item') {
    hint = targeting.selectedHandInstanceId
      ? 'Tap a shop tile'
      : 'Tap a hand item';
  }

  return (
    <div className="targeting-banner" role="status">
      <SpriteIcon id={def.id} className="targeting-emoji" aria-hidden />
      {step && <span className="targeting-step">{step}</span>}
      {selectedTile && (
        <span className="targeting-picked" aria-hidden>
          <SpriteIcon
            id={selectedTile.itemId}
            className="targeting-picked-icon"
            golden={selectedTile.golden}
          />
          <span className="targeting-picked-mark">1</span>
        </span>
      )}
      <span className="targeting-hint">{hint}</span>
      <button
        type="button"
        className="targeting-cancel"
        onClick={onCancel}
        aria-label="Cancel"
      >
        <X size={16} />
      </button>
    </div>
  );
}
