import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  bombDefuseCost,
  getItem,
  handLinkHints,
  passiveChargeProgress,
} from '../game/items';
import type { FxKind, HandItem } from '../game/types';

type Props = {
  item: HandItem | null;
  index: number;
  selected: boolean;
  fxKind?: FxKind | null;
  fxLabel?: string | null;
  walletCoins?: number;
  hand?: HandItem[];
  /** Quick Swap: this slot is about to be stolen/swapped */
  swapThreatened?: boolean;
  /** Seconds left on the nearest pending Quick Swap involving this mark */
  swapThreatSec?: number | null;
  onSelect: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

const DRAG_THRESHOLD_PX = 10;

function slotIndexFromPoint(
  x: number,
  y: number,
  ignoreIndex?: number,
): number | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    const slot = el.closest('[data-hand-slot]');
    if (!slot) continue;
    const n = Number(slot.getAttribute('data-hand-slot'));
    if (!Number.isFinite(n)) continue;
    if (ignoreIndex != null && n === ignoreIndex) continue;
    return n;
  }
  for (const el of stack) {
    const slot = el.closest('[data-hand-slot]');
    if (!slot) continue;
    const n = Number(slot.getAttribute('data-hand-slot'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function HandSlot({
  item,
  index,
  selected,
  fxKind,
  fxLabel,
  walletCoins = 0,
  hand,
  swapThreatened = false,
  swapThreatSec = null,
  onSelect,
  onReorder,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
    canDrag: boolean;
    over: number | null;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const clearDragOverMarks = () => {
    document
      .querySelectorAll('.hand-slot.drag-over')
      .forEach((n) => n.classList.remove('drag-over'));
  };

  const markOver = (over: number | null) => {
    clearDragOverMarks();
    if (over == null || over === index) return;
    document
      .querySelector(`[data-hand-slot="${over}"]`)
      ?.classList.add('drag-over');
  };

  const endDrag = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    dragRef.current = null;
    clearDragOverMarks();
    setDragging(false);
    if (!drag) return;

    if (!drag.dragging) {
      onSelect();
      return;
    }

    const to = slotIndexFromPoint(clientX, clientY, index);
    if (to != null && to !== index) onReorder(index, to);
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!item) return;
    if (e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      canDrag: item.itemId !== 'bomb' && item.itemId !== 'dynamite',
      over: index,
    };
    rootRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (!drag.canDrag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (
      !drag.dragging &&
      dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX
    ) {
      drag.dragging = true;
      setDragging(true);
    }
    if (!drag.dragging) return;

    e.preventDefault();
    const over = slotIndexFromPoint(e.clientX, e.clientY, index);
    drag.over = over;
    markOver(over);
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (rootRef.current?.hasPointerCapture(e.pointerId)) {
      rootRef.current.releasePointerCapture(e.pointerId);
    }
    endDrag(e.clientX, e.clientY);
  };

  const onPointerCancel = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    clearDragOverMarks();
    setDragging(false);
  };

  if (!item) {
    return (
      <div
        ref={rootRef}
        className="hand-slot empty"
        data-hand-slot={index}
        aria-label="Empty slot"
      />
    );
  }

  const def = getItem(item.itemId);
  const isBomb = item.itemId === 'bomb';
  const isDynamite = item.itemId === 'dynamite';
  const isMirror = item.itemId === 'mirror';
  const charge = passiveChargeProgress(item, hand, index);
  const links = hand ? handLinkHints(hand, index) : null;
  const sellLabel =
    item.itemId === 'piggy_bank'
      ? 2 + item.stored
      : item.itemId === 'mystery_box'
        ? item.golden
          ? '??+??'
          : '??'
        : item.itemId === 'bomb'
          ? item.golden
            ? '+100'
            : `-${bombDefuseCost(walletCoins)}`
          : item.itemId === 'dynamite'
            ? 0
            : item.currentSellValue;

  return (
    <div
      ref={rootRef}
      className={[
        'hand-slot',
        'filled',
        isBomb ? 'bomb-slot' : '',
        isDynamite ? 'dynamite-slot' : '',
        isMirror ? 'mirror-slot' : '',
        item.golden ? 'golden' : '',
        selected ? 'selected' : '',
        dragging ? 'dragging' : '',
        fxKind ? `fx-hand fx-${fxKind}` : '',
        links?.gildTarget ? 'adj-gild-target' : '',
        links?.dynamiteThreat ? 'adj-dynamite-threat' : '',
        swapThreatened ? 'quick-swap-threat' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-hand-slot={index}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {links?.dynamiteThreat && (
        <span className="hand-adj-badge threat" aria-hidden>
          !
        </span>
      )}
      {swapThreatened && (
        <span className="hand-adj-badge quick-swap" aria-hidden>
          {swapThreatSec != null ? `${swapThreatSec}s` : '🔀'}
        </span>
      )}
      <button
        type="button"
        className="hand-slot-btn"
        tabIndex={-1}
        onClick={(e) => {
          e.preventDefault();
        }}
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
            className={`hand-passive-bar${isMirror ? ' mirror-bar' : ''}`}
            aria-hidden
            title="Charging"
          >
            <span
              className="hand-passive-fill"
              style={{ transform: `scaleX(${charge})` }}
            />
          </span>
        )}
        {links?.gildTarget && (
          <span className="hand-gild-recv" aria-hidden title="Being gilded">
            <span
              className="hand-gild-recv-fill"
              style={{ transform: `scaleX(${links.gildProgress})` }}
            />
          </span>
        )}
        {fxLabel && (
          <span className="hand-fx-label" aria-hidden>
            {fxLabel}
          </span>
        )}
      </button>
    </div>
  );
}
