import { getItem } from '../game/items';
import type { FxKind, HandItem } from '../game/types';

type Props = {
  item: HandItem | null;
  selected: boolean;
  fxKind?: FxKind | null;
  onSelect: () => void;
};

export function HandSlot({ item, selected, fxKind, onSelect }: Props) {
  if (!item) {
    return <div className="hand-slot empty" aria-label="Empty slot" />;
  }

  const def = getItem(item.itemId);
  const isBomb = item.itemId === 'bomb';
  const sellLabel =
    item.itemId === 'piggy_bank'
      ? 2 + item.stored
      : item.itemId === 'mystery_box'
        ? '??'
        : item.itemId === 'bomb'
          ? 0
          : item.currentSellValue;

  return (
    <div
      className={[
        'hand-slot',
        'filled',
        isBomb ? 'bomb-slot' : '',
        selected ? 'selected' : '',
        fxKind ? `fx-hand fx-${fxKind}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="hand-slot-btn"
        onClick={onSelect}
        aria-label={`${def.name}${selected ? ', selected' : ''}`}
        aria-pressed={selected}
      >
        <span className="hand-emoji">{def.emoji}</span>
        <span className="hand-sell">🪙{sellLabel}</span>
        {isBomb && item.bombFuseMs != null && (
          <span className="hand-fuse">{Math.ceil(item.bombFuseMs / 1000)}s</span>
        )}
      </button>
    </div>
  );
}
