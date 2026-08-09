import type { CSSProperties } from 'react';
import { getItem } from '../game/items';
import type { FxKind, Tile } from '../game/types';
import { CONFIG } from '../game/constants';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  tile: Tile;
  bidderColor: string | null;
  isYou: boolean;
  targeting: boolean;
  selected: boolean;
  /** Multi-pick order badge (1, 2, …) while targeting */
  pickOrder?: number | null;
  fxKind: FxKind | null;
  fxLabel?: string;
  /** Atlas override (e.g. world-event art) */
  fxSpriteId?: string | null;
  onTap: () => void;
};

function timerColor(ratio: number): string {
  if (ratio > 0.5) return '#3aaa62';
  if (ratio > 0.2) return '#d49a1a';
  return '#d6453a';
}

const TILE_FX_SPRITE: Partial<Record<FxKind, string>> = {
  double: 'price_doubler',
  discount: 'bargain',
  hammer: 'reset_hammer',
  inflate: 'stock_market',
  freeze: 'cold_market',
  fastforward: 'fast_forward',
  overtime: 'cold_market',
  swap: 'swap_portal',
  refresh: 'shop_refresh',
  shuffle: 'chaos_die',
  bomb_fuse: 'bomb',
  mystery_sell: 'mystery_box',
  event_money: 'money_money_money',
  event_tax: 'tax_collector',
  event_shower: 'coin_shower',
};

export function ShopTile({
  tile,
  bidderColor,
  isYou,
  targeting,
  selected,
  pickOrder = null,
  fxKind,
  fxLabel,
  fxSpriteId = null,
  onTap,
}: Props) {
  const def = getItem(tile.itemId);
  const ratio = Math.max(0, Math.min(1, tile.timerMs / CONFIG.TILE_TIMER_MS));
  const nearlyExpired = tile.timerMs <= 2000 && tile.freezeMs <= 0;
  const frozen = tile.freezeMs > 0;
  const fxSprite =
    fxSpriteId || (fxKind ? TILE_FX_SPRITE[fxKind] : null) || 'star';

  return (
    <button
      type="button"
      className={[
        'shop-tile',
        nearlyExpired ? 'pulse' : '',
        frozen ? 'frozen' : '',
        tile.flash === 'bid' ? 'pop' : '',
        tile.flash === 'double' ? 'doubled' : '',
        tile.flash === 'resolve' ? 'resolve-flash' : '',
        targeting ? 'targetable' : '',
        selected ? 'selected-target' : '',
        targeting && !selected ? 'awaiting-pick' : '',
        bidderColor ? 'has-bidder' : '',
        isYou ? 'yours' : '',
        tile.golden ? 'golden' : '',
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
      aria-label={`${tile.golden ? 'Golden ' : ''}${def.name}, price ${tile.price}${tile.bidLocked ? ', locked' : ''}${selected && pickOrder ? `, pick ${pickOrder}` : ''}`}
    >
      {pickOrder != null && (
        <span className="shop-tile-pick" aria-hidden>
          {pickOrder}
        </span>
      )}
      <SpriteIcon
        id={tile.itemId}
        className="shop-tile-emoji"
        golden={tile.golden}
        aria-hidden
      />
      {tile.golden && (
        <span className="shop-tile-golden-tag" aria-hidden>
          ★
        </span>
      )}
      <span className="shop-tile-price">
        <SpriteIcon id="coin" className="shop-tile-coin" aria-hidden />
        {tile.price}
      </span>
      {tile.bidLocked && (
        <span className="shop-tile-lock" aria-hidden>
          <SpriteIcon id="bid_lock" aria-hidden />
        </span>
      )}
      {frozen && (
        <span className="shop-tile-frost">
          <SpriteIcon id="ice_status" aria-hidden />
        </span>
      )}
      {fxKind && (
        <span className="tile-fx-burst" aria-hidden>
          <SpriteIcon id={fxSprite} aria-hidden />
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
