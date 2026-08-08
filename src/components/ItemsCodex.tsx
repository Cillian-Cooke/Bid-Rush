import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { goldenBlurb, regularBlurb } from '../game/itemBlurbs';
import { ITEM_LIST } from '../game/items';
import {
  RANKED_RANKS,
  getRankDef,
  loadRankProgress,
  rankedEventUnlockRank,
  rankedUnlockRank,
} from '../game/ranked';
import { WORLD_EVENT_IDS, getWorldEvent } from '../game/worldEvents';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  onClose: () => void;
  /** Inline side panel (desktop lobby) instead of modal overlay. */
  embedded?: boolean;
};

type CodexSection = 'items' | 'events';

export function ItemsCodex({ onClose, embedded = false }: Props) {
  const [section, setSection] = useState<CodexSection>('items');
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

  const events = useMemo(() => {
    const list = WORLD_EVENT_IDS.map((id) => getWorldEvent(id)).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    if (filterRank === 'all') return list;
    const rankId = RANKED_RANKS[filterRank]!.id;
    return list.filter((ev) => rankedEventUnlockRank(ev.id) === rankId);
  }, [filterRank]);

  const body = (
    <div className={`codex-sheet${embedded ? ' embedded' : ''}`}>
      <div className="codex-head">
        <div>
          {!embedded && <p className="rail-kicker">Reference</p>}
          <h2>{section === 'items' ? 'Item Guide' : 'Event Guide'}</h2>
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

      <div
        className="codex-section-tabs ranked-tabs"
        role="tablist"
        aria-label="Guide section"
      >
        <button
          type="button"
          className={section === 'items' ? 'on' : ''}
          role="tab"
          aria-selected={section === 'items'}
          onClick={() => setSection('items')}
        >
          Items
        </button>
        <button
          type="button"
          className={section === 'events' ? 'on' : ''}
          role="tab"
          aria-selected={section === 'events'}
          onClick={() => setSection('events')}
        >
          Events
        </button>
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
            title={
              section === 'items'
                ? `${rank.poolSize} items unlocked · 16 per match`
                : `${rank.eventPoolSize} events unlocked`
            }
          >
            {rank.name}
          </button>
        ))}
      </div>

      {section === 'items' ? (
        <ul className="codex-list">
          {items.map((item) => {
            const golden = !!goldenById[item.id];
            const unlock = rankedUnlockRank(item.id);
            const locked =
              filterRank !== 'all' &&
              unlock != null &&
              unlock - 1 > playerRank;
            return (
              <li
                key={item.id}
                className={`codex-row${golden ? ' golden-view' : ''}${locked ? ' is-rank-locked' : ''}`}
              >
                <div className="codex-icon" aria-hidden>
                  <SpriteIcon
                    id={item.id}
                    className="codex-emoji"
                    golden={golden}
                    aria-hidden
                  />
                </div>
                <div className="codex-body">
                  <div className="codex-name">
                    {golden ? `Golden ${item.name}` : item.name}
                  </div>
                  <div className="codex-sub">
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
                  <p className="codex-blurb">
                    {golden ? goldenBlurb(item.id) : regularBlurb(item.id)}
                  </p>
                  <span className="codex-sell">
                    Start {item.startPrice ?? Math.max(1, item.sellValue - 2)} ·
                    Sell ≈ {item.sellValue || 'special'}
                    {unlock != null
                      ? ` · Unlock: ${getRankDef(unlock - 1).name}`
                      : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="codex-list">
          {events.map((ev) => {
            const unlock = rankedEventUnlockRank(ev.id);
            const locked =
              filterRank !== 'all' &&
              unlock != null &&
              unlock - 1 > playerRank;
            const special = ev.id === 'golden_chaos';
            return (
              <li
                key={ev.id}
                className={`codex-row${locked ? ' is-rank-locked' : ''}`}
              >
                <div className="codex-icon" aria-hidden>
                  <SpriteIcon id={ev.id} className="codex-emoji" aria-hidden />
                </div>
                <div className="codex-body">
                  <div className="codex-name">{ev.name}</div>
                  <div className="codex-sub">
                    <span className="codex-kind">
                      {special ? 'chaos die' : 'event'}
                    </span>
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
                  <p className="codex-blurb">{ev.blurb}</p>
                  <span className="codex-sell">
                    {special
                      ? 'Golden Chaos Die only'
                      : `Warn: ${ev.warnLine}`}
                    {unlock != null
                      ? ` · Unlock: ${getRankDef(unlock - 1).name}`
                      : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="codex-overlay" role="dialog" aria-label="Guide">
      {body}
    </div>
  );
}
