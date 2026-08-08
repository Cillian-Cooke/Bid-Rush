import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { goldenBlurb, regularBlurb } from '../game/itemBlurbs';
import { ITEM_LIST } from '../game/items';
import {
  RANKED_RANKS,
  getRankDef,
  loadRankProgress,
  rankedUnlockRank,
} from '../game/ranked';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  onClose: () => void;
  /** Inline side panel (desktop lobby) instead of modal overlay. */
  embedded?: boolean;
};

export function ItemsCodex({ onClose, embedded = false }: Props) {
  const [goldenById, setGoldenById] = useState<Record<string, boolean>>({});
  const [filterRank, setFilterRank] = useState<number | 'all'>('all');
  const progress = useMemo(() => loadRankProgress(), []);
  const playerRank = progress.rankIndex;

  const items = useMemo(() => {
    const list = [...ITEM_LIST].sort((a, b) => a.name.localeCompare(b.name));
    if (filterRank === 'all') return list;
    const rankId = RANKED_RANKS[filterRank]!.id;
    return list.filter((item) => rankedUnlockRank(item.id) === rankId);
  }, [filterRank]);

  const body = (
    <div className={`codex-sheet${embedded ? ' embedded' : ''}`}>
      <div className="codex-head">
        <div>
          {!embedded && <p className="rail-kicker">Reference</p>}
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

      <div className="codex-rank-filters" role="group" aria-label="Rank unlocks">
        <button
          type="button"
          className={`diff-chip${filterRank === 'all' ? ' selected' : ''}`}
          onClick={() => setFilterRank('all')}
        >
          All
        </button>
        {RANKED_RANKS.map((rank, i) => (
          <button
            key={rank.id}
            type="button"
            className={`diff-chip${filterRank === i ? ' selected' : ''}`}
            onClick={() => setFilterRank(i)}
            title={`${rank.poolSize} items by this rank`}
          >
            {rank.name}
          </button>
        ))}
      </div>
      <p className="codex-rank-hint">
        Ranked unlocks: Bronze 16 → +4 items each rank up to Diamond (32). Your
        rank: {getRankDef(playerRank).name}.
      </p>

      <ul className="codex-list">
        {items.map((item) => {
          const golden = !!goldenById[item.id];
          const unlock = rankedUnlockRank(item.id);
          const locked = unlock != null && unlock - 1 > playerRank;
          return (
            <li
              key={item.id}
              className={`codex-row${golden ? ' golden-view' : ''}${locked ? ' is-rank-locked' : ''}`}
            >
              <SpriteIcon
                id={item.id}
                className="codex-emoji"
                golden={golden}
                aria-hidden
              />
              <div className="codex-body">
                <div className="codex-name">
                  {golden ? `Golden ${item.name}` : item.name}
                  <span className="codex-kind">{item.kind}</span>
                  {unlock != null && (
                    <span
                      className={`codex-rank-badge${locked ? ' locked' : ''}`}
                    >
                      {locked
                        ? `Rank ${getRankDef(unlock - 1).name}`
                        : `R${unlock}`}
                    </span>
                  )}
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
                  Start {item.startPrice ?? Math.max(1, item.sellValue - 2)} ·
                  Sell ≈ {item.sellValue || 'special'}
                  {unlock != null
                    ? ` · Ranked unlock: ${getRankDef(unlock - 1).name}`
                    : ''}
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
