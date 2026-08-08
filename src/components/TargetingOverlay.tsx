import { X } from 'lucide-react';
import { getItem } from '../game/items';
import type { TargetingMode } from '../game/types';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  targeting: TargetingMode;
  onCancel: () => void;
};

export function TargetingOverlay({ targeting, onCancel }: Props) {
  const def = getItem(targeting.itemId);
  let hint = 'Tap a target';
  if (targeting.target === 'item') hint = 'Tap a shop tile';
  if (targeting.target === 'hand') hint = 'Tap a hand item to cash out';
  if (targeting.target === 'two-items') {
    hint = targeting.selectedTile === undefined
      ? 'Tap first tile'
      : 'Tap second tile';
  }
  if (targeting.target === 'player') hint = 'Tap a player';
  if (targeting.target === 'hand-then-item') {
    hint = targeting.selectedHandInstanceId
      ? 'Tap a shop tile to place it'
      : 'Tap a hand item to swap onto the board';
  }

  return (
    <div className="targeting-banner">
      <SpriteIcon id={def.id} className="targeting-emoji" aria-hidden />
      <span className="targeting-hint">{hint}</span>
      <button type="button" className="targeting-cancel" onClick={onCancel}>
        <X size={20} />
        Cancel
      </button>
    </div>
  );
}
