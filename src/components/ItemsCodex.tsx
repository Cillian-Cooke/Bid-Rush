import { useState } from 'react';
import { X } from 'lucide-react';
import { goldenBlurb, regularBlurb } from '../game/itemBlurbs';
import { ITEM_LIST } from '../game/items';

type Props = {
  onClose: () => void;
  /** Inline side panel (desktop lobby) instead of modal overlay. */
  embedded?: boolean;
};

export function ItemsCodex({ onClose, embedded = false }: Props) {
  const [goldenById, setGoldenById] = useState<Record<string, boolean>>({});

  const body = (
    <div className={`codex-sheet${embedded ? ' embedded' : ''}`}>
      <div className="codex-head">
        <div>
          <p className="rail-kicker">Reference</p>
          <h2>Item Guide</h2>
        </div>
        {!embedded && (
          <button
            type="button"
            className="codex-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        )}
      </div>
      <ul className="codex-list">
        {ITEM_LIST.map((item) => {
          const golden = !!goldenById[item.id];
          return (
            <li
              key={item.id}
              className={`codex-row${golden ? ' golden-view' : ''}`}
            >
              <span className="codex-emoji" aria-hidden>
                {item.emoji}
              </span>
              <div className="codex-body">
                <div className="codex-name">
                  {golden ? `Golden ${item.name}` : item.name}
                  <span className="codex-kind">{item.kind}</span>
                </div>
                <div className="codex-toggle" role="group" aria-label="Variant">
                  <button
                    type="button"
                    className={!golden ? 'on' : ''}
                    onClick={() =>
                      setGoldenById((s) => ({ ...s, [item.id]: false }))
                    }
                  >
                    Regular
                  </button>
                  <button
                    type="button"
                    className={golden ? 'on' : ''}
                    onClick={() =>
                      setGoldenById((s) => ({ ...s, [item.id]: true }))
                    }
                  >
                    Golden
                  </button>
                </div>
                <p>{golden ? goldenBlurb(item.id) : regularBlurb(item.id)}</p>
                <span className="codex-sell">
                  Start {item.startPrice ?? Math.max(1, item.sellValue - 2)} · Sell ≈{' '}
                  {item.sellValue || 'special'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="codex-overlay" role="dialog" aria-label="Item guide">
      {body}
    </div>
  );
}
