import type { CSSProperties } from 'react';
import { getItem } from '../game/items';
import type { FxKind, Tile } from '../game/types';
import { CONFIG } from '../game/constants';

type Props = {
  tile: Tile;
  bidderColor: string | null;
  isYou: boolean;
  targeting: boolean;
  selected: boolean;
  fxKind: FxKind | null;
  fxLabel?: string;
  onTap: () => void;
};

function timerColor(ratio: number): string {
  if (ratio > 0.5) return '#3aaa62';
  if (ratio > 0.2) return '#d49a1a';
  return '#d6453a';
}

const TILE_FX_EMOJI: Partial<Record<FxKind, string>> = {
  double: '💥',
  discount: '🏷️',
  hammer: '🔨',
  inflate: '📈',
  freeze: '❄️',
  fastforward: '⏩',
  overtime: '⏳',
  swap: '🌀',
  refresh: '✨',
  shuffle: '🎲',
  bomb_fuse: '💣',
  mystery_sell: '🎁',
  event_money: '💰',
  event_tax: '🧾',
  event_shower: '🪙',
};

export function ShopTile({
  tile,
  bidderColor,
  isYou,
  targeting,
  selected,
  fxKind,
  fxLabel,
  onTap,
}: Props) {
  const def = getItem(tile.itemId);
  const isBomb = tile.itemId === 'bomb';
  const ratio = Math.max(0, Math.min(1, tile.timerMs / CONFIG.TILE_TIMER_MS));
  const nearlyExpired = tile.timerMs <= 2000 && tile.freezeMs <= 0;
  const frozen = tile.freezeMs > 0;

  return (
    <button
      type="button"
      className={[
        'shop-tile',
        isBomb && !bidderColor ? 'bomb' : '',
        nearlyExpired ? 'pulse' : '',
        frozen ? 'frozen' : '',
        tile.flash === 'bid' ? 'pop' : '',
        tile.flash === 'double' ? 'doubled' : '',
        tile.flash === 'resolve' ? 'resolve-flash' : '',
        targeting ? 'targetable' : '',
        selected ? 'selected-target' : '',
        bidderColor ? 'has-bidder' : '',
        isYou ? 'yours' : '',
        fxKind ? `fx-tile fx-${fxKind}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        bidderColor
          ? ({
              ['--bidder' as string]: bidderColor,
              background: bidderColor,
            } as CSSProperties)
          : undefined
      }
      onClick={onTap}
      aria-label={`${def.name}, price ${tile.price}`}
    >
      <span className="shop-tile-emoji">{def.emoji}</span>
      <span className="shop-tile-price">🪙 {tile.price}</span>
      {frozen && <span className="shop-tile-frost">❄️</span>}
      {fxKind && (
        <span className="tile-fx-burst" aria-hidden>
          {TILE_FX_EMOJI[fxKind] ?? '✨'}
          {fxLabel && <span className="tile-fx-label">{fxLabel}</span>}
        </span>
      )}
      <div className="shop-tile-timer">
        <div
          className="shop-tile-timer-fill"
          style={{
            width: `${ratio * 100}%`,
            background: timerColor(ratio),
          }}
        />
      </div>
    </button>
  );
}
