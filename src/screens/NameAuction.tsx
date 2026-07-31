import type { CSSProperties } from 'react';
import { CONFIG, MODE_SETUP } from '../game/constants';
import { useGameStore } from '../store';

export function NameAuction() {
  const naming = useGameStore((s) => s.naming);
  const bidNameTag = useGameStore((s) => s.bidNameTag);
  const matchPool = useGameStore((s) => s.matchPool);
  const openPoolReveal = useGameStore((s) => s.openPoolReveal);

  if (!naming) return null;

  const sec = Math.ceil(naming.msLeft / 1000);
  const humanLeads = naming.tags.filter(
    (t) => t.highBidderId === naming.humanId,
  ).length;
  const atCap = humanLeads >= CONFIG.MAX_ACTIVE_BIDS;
  const cols = MODE_SETUP[naming.mode].gridCols;

  return (
    <div
      className={`screen naming-screen mode-${naming.mode}`}
      style={{ ['--grid-cols' as string]: cols }}
    >
      <div className="naming-header">
        <h1 className="naming-title">Tag Sale</h1>
        <div className="naming-meta-row">
          <div className={`naming-clock${sec <= 2 ? ' urgent' : ''}`}>{sec}</div>
          <div className={`naming-bids${atCap ? ' empty' : ''}`}>
            <span className="naming-bids-label">Active</span>
            <span className="naming-bids-count">
              {humanLeads}/{CONFIG.MAX_ACTIVE_BIDS}
            </span>
          </div>
        </div>
        <div className="naming-bar">
          <div
            className="naming-bar-fill"
            style={{ width: `${(naming.msLeft / CONFIG.NAME_AUCTION_MS) * 100}%` }}
          />
        </div>
      </div>

      <div className="naming-stage">
        <div
          className="shop-grid naming-tag-grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, var(--tile-size))`,
            gridTemplateRows: `repeat(${cols}, var(--tile-size))`,
          }}
        >
          {naming.tags.map((tag) => {
            const bidder = naming.participants.find(
              (p) => p.id === tag.highBidderId,
            );
            const mine = tag.highBidderId === naming.humanId;
            return (
              <button
                key={tag.id}
                type="button"
                className={`shop-tile tag-card${mine ? ' mine' : ''}${tag.highBidderId ? ' claimed' : ''}`}
                style={
                  bidder
                    ? ({
                        ['--bidder' as string]: bidder.color,
                        background: bidder.color,
                      } as CSSProperties)
                    : undefined
                }
                disabled={atCap && !mine}
                onClick={() => bidNameTag(tag.id)}
              >
                <span className="tag-avatar">{tag.avatar}</span>
                <span className="tag-name">{tag.name}</span>
                <span className="tag-price">
                  {tag.price === 0 ? 'FREE' : `🪙 ${tag.price}`}
                </span>
                {mine && <span className="tag-yours">YOURS</span>}
              </button>
            );
          })}
        </div>
      </div>

      {matchPool && (
        <button
          type="button"
          className="btn secondary naming-pool-btn"
          onClick={openPoolReveal}
        >
          See the items
        </button>
      )}
    </div>
  );
}
