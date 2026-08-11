import { useState } from 'react';
import { goldenBlurb, regularBlurb } from '../game/itemBlurbs';
import { getItem, itemKindLabel } from '../game/items';
import {
  getRankDef,
  rankedNewItemsAtRank,
  rankedUnlockRank,
} from '../game/ranked';
import type { ItemId } from '../game/types';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  countdown: number;
  itemPool: ItemId[];
  /** Match mode - keeps icon size in sync with shop tiles */
  mode?: 'duel' | 'blitz';
  /** Dismissible peek (Tag Sale or mid-match) - shows Back instead of countdown */
  early?: boolean;
  /** Skip cell entrance animation (already shown during Tag Sale) */
  skipEntrance?: boolean;
  onClose?: () => void;
  /** Ranked match: show rank pool banner */
  ranked?: boolean;
  rankedRankIndex?: number;
};

export function MatchPoolReveal({
  countdown,
  itemPool,
  mode = 'duel',
  early,
  skipEntrance,
  onClose,
  ranked,
  rankedRankIndex = 0,
}: Props) {
  const [selectedId, setSelectedId] = useState<ItemId | null>(null);
  const items = [...itemPool]
    .map((id) => getItem(id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const selected = selectedId ? getItem(selectedId) : null;
  const rankDef = ranked ? getRankDef(rankedRankIndex) : null;
  const newThisRank =
    ranked && rankedRankIndex > 0
      ? new Set(rankedNewItemsAtRank(rankedRankIndex))
      : null;

  return (
    <div
      className={`countdown-overlay mode-${mode}${early ? ' early-peek' : ''}${skipEntrance ? ' no-entrance' : ''}`}
      aria-live="assertive"
      role="dialog"
      aria-label="Match item pool"
    >
      <div className="pool-reveal">
        {rankDef && (
          <header className="pool-reveal-rank">
            <span className="pool-reveal-rank-name">
              Ranked · {rankDef.name}
            </span>
            <span className="pool-reveal-rank-meta">
              {itemPool.length} in this match
              {rankedRankIndex > 0
                ? ` · ${newThisRank?.size ?? 0} new unlocks showing`
                : ' · starter unlocks'}
            </span>
          </header>
        )}

        <div className="pool-reveal-grid">
          {items.map((item) => {
            const unlock = rankedUnlockRank(item.id);
            const isNew = newThisRank?.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`pool-reveal-cell${selectedId === item.id ? ' selected' : ''}${isNew ? ' is-rank-new' : ''}`}
                onClick={() =>
                  setSelectedId((cur) => (cur === item.id ? null : item.id))
                }
              >
                <span className="pool-reveal-tile">
                  <SpriteIcon
                    id={item.id}
                    className="shop-tile-emoji"
                    aria-hidden
                  />
                  {ranked && unlock != null && (
                    <span className="pool-reveal-unlock">R{unlock}</span>
                  )}
                </span>
                <span className="pool-reveal-name">{item.name}</span>
              </button>
            );
          })}
        </div>

        <div className="pool-reveal-detail" aria-live="polite">
          {selected ? (
            <>
              <div className="pool-reveal-detail-head">
                <SpriteIcon
                  id={selected.id}
                  className="pool-reveal-detail-emoji"
                  aria-hidden
                />
                <span className="pool-reveal-detail-name">{selected.name}</span>
                <span className="pool-reveal-detail-rank">{itemKindLabel(selected)}</span>
                {ranked && rankedUnlockRank(selected.id) != null && (
                  <span className="pool-reveal-detail-rank">
                    Unlocks at{' '}
                    {getRankDef(rankedUnlockRank(selected.id)! - 1).name}
                  </span>
                )}
              </div>
              <p className="pool-reveal-detail-blurb">
                {regularBlurb(selected.id)}
              </p>
              <p className="pool-reveal-detail-golden">
                {goldenBlurb(selected.id)}
              </p>
            </>
          ) : (
            <p className="pool-reveal-detail-hint">
              {ranked
                ? 'Tap an item · R# shows which rank unlocks it'
                : 'Tap an item to see what it does'}
            </p>
          )}
        </div>

        {early ? (
          <button
            type="button"
            className="btn primary pool-reveal-back"
            onClick={onClose}
          >
            Back to game
          </button>
        ) : (
          <div
            key={countdown}
            className={`pool-reveal-count${countdown === 0 ? ' go' : ''}`}
          >
            {countdown === 0 ? 'GO!' : countdown}
          </div>
        )}
      </div>
    </div>
  );
}
