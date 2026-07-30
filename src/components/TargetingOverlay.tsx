import { X } from 'lucide-react';
import { getItem } from '../game/items';
import type { TargetingMode } from '../game/types';

type Props = {
  targeting: TargetingMode;
  onCancel: () => void;
};

export function TargetingOverlay({ targeting, onCancel }: Props) {
  const def = getItem(targeting.itemId);
  let hint = 'Tap a target';
  if (targeting.target === 'item') hint = 'Tap a shop tile';
  if (targeting.target === 'two-items') {
    hint = targeting.selectedTile === undefined
      ? 'Tap first tile'
      : 'Tap second tile';
  }
  if (targeting.target === 'player') hint = 'Tap a player';

  return (
    <div className="targeting-banner">
      <span className="targeting-emoji">{def.emoji}</span>
      <span className="targeting-hint">{hint}</span>
      <button type="button" className="targeting-cancel" onClick={onCancel}>
        <X size={20} />
        Cancel
      </button>
    </div>
  );
}
