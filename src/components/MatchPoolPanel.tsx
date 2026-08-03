import { useState } from 'react';
import { goldenBlurb, regularBlurb } from '../game/itemBlurbs';
import { getItem } from '../game/items';
import type { ItemId } from '../game/types';

type Props = {
  itemPool: ItemId[];
};

/** Always-visible match pool for the desktop side rail. */
export function MatchPoolPanel({ itemPool }: Props) {
  const [selectedId, setSelectedId] = useState<ItemId | null>(null);
  const items = [...itemPool]
    .map((id) => getItem(id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const selected = selectedId ? getItem(selectedId) : null;

  return (
    <div className="rail-pool" aria-label="Match item pool">
      <div className="rail-pool-head">
        <span className="rail-kicker">This match</span>
        <span className="rail-title">Items</span>
      </div>
      <div className="rail-pool-grid">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rail-pool-cell${selectedId === item.id ? ' selected' : ''}`}
            onClick={() =>
              setSelectedId((cur) => (cur === item.id ? null : item.id))
            }
            title={item.name}
          >
            <span className="rail-pool-emoji" aria-hidden>
              {item.emoji}
            </span>
            <span className="rail-pool-name">{item.name}</span>
          </button>
        ))}
      </div>
      <div className="rail-pool-detail" aria-live="polite">
        {selected ? (
          <>
            <div className="rail-pool-detail-head">
              <span aria-hidden>{selected.emoji}</span>
              <strong>{selected.name}</strong>
            </div>
            <p>{regularBlurb(selected.id)}</p>
            <p className="rail-pool-golden">{goldenBlurb(selected.id)}</p>
          </>
        ) : (
          <p className="rail-pool-hint">Tap an item to read its rules</p>
        )}
      </div>
    </div>
  );
}
