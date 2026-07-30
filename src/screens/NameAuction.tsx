import type { CSSProperties } from 'react';
import { CONFIG } from '../game/constants';
import { useGameStore } from '../store';

export function NameAuction() {
  const naming = useGameStore((s) => s.naming);
  const bidNameTag = useGameStore((s) => s.bidNameTag);

  if (!naming) return null;

  const sec = Math.ceil(naming.msLeft / 1000);
  const humanLead = naming.tags.find((t) => t.highBidderId === naming.humanId);

  return (
    <div className="screen naming-screen">
      <div className="naming-header">
        <h1 className="naming-title">Tag Sale</h1>
        <p className="naming-sub">Snap a handle before the clock dies</p>
        <div className={`naming-clock${sec <= 2 ? ' urgent' : ''}`}>{sec}</div>
        <div className="naming-bar">
          <div
            className="naming-bar-fill"
            style={{ width: `${(naming.msLeft / CONFIG.NAME_AUCTION_MS) * 100}%` }}
          />
        </div>
      </div>

      <div
        className={`tag-grid cols-${naming.tags.length <= 2 ? 2 : naming.tags.length <= 4 ? 2 : 4}`}
      >
        {naming.tags.map((tag) => {
          const bidder = naming.participants.find((p) => p.id === tag.highBidderId);
          const mine = tag.highBidderId === naming.humanId;
          return (
            <button
              key={tag.id}
              type="button"
              className={`tag-card${mine ? ' mine' : ''}${tag.highBidderId ? ' claimed' : ''}`}
              style={
                bidder
                  ? ({
                      ['--bidder' as string]: bidder.color,
                      background: bidder.color,
                    } as CSSProperties)
                  : undefined
              }
              onClick={() => bidNameTag(tag.id)}
            >
              <span className="tag-avatar">{tag.avatar}</span>
              <span className="tag-name">{tag.name}</span>
              <span className="tag-price">{tag.price === 0 ? 'FREE' : `🪙 ${tag.price}`}</span>
              {mine && <span className="tag-yours">YOURS</span>}
            </button>
          );
        })}
      </div>

      <p className="naming-hint">
        {humanLead
          ? `Holding ${humanLead.avatar} ${humanLead.name} — tap another to steal`
          : 'Tap a tag to claim it. Bots will fight you for it.'}
      </p>
    </div>
  );
}
