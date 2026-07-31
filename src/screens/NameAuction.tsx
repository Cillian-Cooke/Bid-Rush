import type { CSSProperties } from 'react';
import { MatchPoolReveal } from '../components/MatchPoolReveal';
import { CONFIG, MODE_SETUP } from '../game/constants';
import { useGameStore } from '../store';

export function NameAuction() {
  const naming = useGameStore((s) => s.naming);
  const bidNameTag = useGameStore((s) => s.bidNameTag);
  const matchPool = useGameStore((s) => s.matchPool);
  const poolRevealOpen = useGameStore((s) => s.poolRevealOpen);
  const poolRevealEndsAt = useGameStore((s) => s.poolRevealEndsAt);
  const openPoolReveal = useGameStore((s) => s.openPoolReveal);
  const closePoolReveal = useGameStore((s) => s.closePoolReveal);

  if (!naming) return null;

  const sec = Math.ceil(naming.msLeft / 1000);
  const human = naming.participants.find((p) => p.id === naming.humanId);
  const bidsLeft = Math.max(0, CONFIG.NAME_MAX_BIDS - (human?.bidsUsed ?? 0));
  const humanLead = naming.tags.find((t) => t.highBidderId === naming.humanId);
  const cols = MODE_SETUP[naming.mode].gridCols;
  const canBid = bidsLeft > 0;

  const peekRemain =
    poolRevealOpen && poolRevealEndsAt
      ? Math.max(1, Math.ceil((poolRevealEndsAt - Date.now()) / 1000))
      : 0;

  return (
    <div
      className={`screen naming-screen mode-${naming.mode}`}
      style={{ ['--grid-cols' as string]: cols }}
    >
      <div className="naming-header">
        <h1 className="naming-title">Tag Sale</h1>
        <p className="naming-sub">
          {naming.mode === 'duel'
            ? '9 handles on a 3×3 floor — claim yours'
            : '16 handles on a 4×4 floor — claim yours'}
        </p>
        <div className="naming-meta-row">
          <div className={`naming-clock${sec <= 2 ? ' urgent' : ''}`}>{sec}</div>
          <div className={`naming-bids${bidsLeft === 0 ? ' empty' : ''}`}>
            <span className="naming-bids-label">Bids left</span>
            <span className="naming-bids-count">{bidsLeft}</span>
          </div>
        </div>
        <div className="naming-bar">
          <div
            className="naming-bar-fill"
            style={{ width: `${(naming.msLeft / CONFIG.NAME_AUCTION_MS) * 100}%` }}
          />
        </div>
        {matchPool && (
          <button
            type="button"
            className="btn secondary naming-pool-btn"
            onClick={openPoolReveal}
          >
            This match’s items
          </button>
        )}
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
                disabled={!canBid && !mine}
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

      <p className="naming-hint">
        {!canBid
          ? humanLead
            ? `Out of bids — holding ${humanLead.avatar} ${humanLead.name}`
            : 'Out of bids — wait for the sale to end'
          : humanLead
            ? `Holding ${humanLead.avatar} ${humanLead.name} — ${bidsLeft} bid${bidsLeft === 1 ? '' : 's'} left`
            : `Tap a tag to claim it (${bidsLeft} bids). Bots will fight you.`}
      </p>

      {poolRevealOpen && matchPool && (
        <MatchPoolReveal
          early
          countdown={peekRemain}
          itemPool={matchPool}
          onClose={closePoolReveal}
        />
      )}
    </div>
  );
}
