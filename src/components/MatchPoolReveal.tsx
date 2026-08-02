import { useState } from 'react';
import { goldenBlurb, regularBlurb } from '../game/itemBlurbs';
import { getItem } from '../game/items';
import type { ItemId } from '../game/types';

type Props = {
  countdown: number;
  itemPool: ItemId[];
  /** Dismissible peek (Tag Sale or mid-match) — shows Back instead of countdown */
  early?: boolean;
  /** Skip cell entrance animation (already shown during Tag Sale) */
  skipEntrance?: boolean;
  onClose?: () => void;
};

export function MatchPoolReveal({
  countdown,
  itemPool,
  early,
  skipEntrance,
  onClose,
}: Props) {
  const [selectedId, setSelectedId] = useState<ItemId | null>(null);
  const items = [...itemPool]
    .map((id) => getItem(id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const selected = selectedId ? getItem(selectedId) : null;

  return (
    <div
      className={`countdown-overlay${early ? ' early-peek' : ''}${skipEntrance ? ' no-entrance' : ''}`}
      aria-live="assertive"
      role="dialog"
      aria-label="Match item pool"
    >
      <div className="pool-reveal">
        <div className="pool-reveal-grid">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`pool-reveal-cell${selectedId === item.id ? ' selected' : ''}`}
              onClick={() =>
                setSelectedId((cur) => (cur === item.id ? null : item.id))
              }
            >
              <span className="pool-reveal-emoji" aria-hidden>
                {item.emoji}
              </span>
              <span className="pool-reveal-name">{item.name}</span>
            </button>
          ))}
        </div>

        <div className="pool-reveal-detail" aria-live="polite">
          {selected ? (
            <>
              <div className="pool-reveal-detail-head">
                <span className="pool-reveal-detail-emoji" aria-hidden>
                  {selected.emoji}
                </span>
                <span className="pool-reveal-detail-name">{selected.name}</span>
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
              Tap an item to see what it does
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
