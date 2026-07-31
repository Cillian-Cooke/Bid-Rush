import { useRef } from 'react';
import { getItem, passiveChargeProgress } from '../game/items';
import type { FxKind, HandItem } from '../game/types';

type Props = {
  item: HandItem | null;
  index: number;
  selected: boolean;
  fxKind?: FxKind | null;
  onSelect: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

export function HandSlot({
  item,
  index,
  selected,
  fxKind,
  onSelect,
  onReorder,
}: Props) {
  const dragFrom = useRef<number | null>(null);

  if (!item) {
    return (
      <div
        className="hand-slot empty"
        aria-label="Empty slot"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const from = Number(e.dataTransfer.getData('text/hand-index'));
          if (!Number.isNaN(from)) onReorder(from, index);
        }}
      />
    );
  }

  const def = getItem(item.itemId);
  const isBomb = item.itemId === 'bomb';
  const charge = passiveChargeProgress(item);
  const sellLabel =
    item.itemId === 'piggy_bank'
      ? 2 + item.stored
      : item.itemId === 'mystery_box'
        ? item.golden
          ? '??+??'
          : '??'
        : item.itemId === 'bomb'
          ? item.golden
            ? 100
            : 0
          : item.currentSellValue;

  return (
    <div
      className={[
        'hand-slot',
        'filled',
        isBomb ? 'bomb-slot' : '',
        item.golden ? 'golden' : '',
        selected ? 'selected' : '',
        fxKind ? `fx-hand fx-${fxKind}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={!isBomb}
      onDragStart={(e) => {
        dragFrom.current = index;
        e.dataTransfer.setData('text/hand-index', String(index));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData('text/hand-index'));
        if (!Number.isNaN(from) && from !== index) onReorder(from, index);
      }}
    >
      <button
        type="button"
        className="hand-slot-btn"
        onClick={onSelect}
        aria-label={`${item.golden ? 'Golden ' : ''}${def.name}${selected ? ', selected' : ''}`}
        aria-pressed={selected}
      >
        {item.golden && (
          <span className="hand-golden-tag" aria-hidden>
            ★
          </span>
        )}
        <span className="hand-emoji">{def.emoji}</span>
        <span className="hand-sell">🪙{sellLabel}</span>
        {isBomb && item.bombFuseMs != null && (
          <span className="hand-fuse">{Math.ceil(item.bombFuseMs / 1000)}s</span>
        )}
        {charge != null && (
          <span
            className="hand-passive-bar"
            aria-hidden
            title="Charging"
          >
            <span
              className="hand-passive-fill"
              style={{ transform: `scaleX(${charge})` }}
            />
          </span>
        )}
      </button>
    </div>
  );
}
