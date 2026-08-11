import { getItem, quickSwapMarkedIds } from '../game/items';
import type { PendingQuickSwap, Player } from '../game/types';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  players: Player[];
  pendingQuickSwaps?: PendingQuickSwap[];
  /** Blackout without x-ray: obscure non-viewer hand contents */
  hideRivalHands?: boolean;
  viewerId?: string;
};

export function SpectateHands({
  players,
  pendingQuickSwaps = [],
  hideRivalHands = false,
  viewerId,
}: Props) {
  const ordered = [...players].sort((a, b) => {
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    return b.coins - a.coins;
  });

  return (
    <div className="spectate-bar" aria-label="Spectating all hands">
      <span className="spectate-label">SPECTATING</span>
      <div className="spectate-list">
        {ordered.map((p) => {
          const mark = quickSwapMarkedIds(pendingQuickSwaps, p.hand, p.id);
          const obscured =
            hideRivalHands && !!viewerId && p.id !== viewerId && p.isAlive;
          return (
            <div
              key={p.id}
              className={`spectate-row${!p.isAlive ? ' out' : ''}${obscured ? ' blackout' : ''}`}
              style={{ ['--player-color' as string]: p.color }}
            >
              <div className="spectate-who">
                <SpriteIcon
                  id={p.avatar}
                  className="spectate-avatar"
                  aria-hidden
                />
                <div className="spectate-meta">
                  <span className="spectate-name">
                    {p.name}
                    {p.isHuman ? ' (You)' : ''}
                    {!p.isAlive ? ' · OUT' : ''}
                  </span>
                  <span className="spectate-coins">
                    <SpriteIcon id="coin" className="spectate-coin-icon" aria-hidden />
                    {p.coins}
                  </span>
                </div>
              </div>
              <div className="spectate-hand">
                {p.hand.length === 0 ? (
                  <span className="spectate-empty">Empty</span>
                ) : obscured ? (
                  p.hand.map((h) => (
                    <span
                      key={h.instanceId}
                      className="spectate-item blackout-slot"
                      title="Blackout"
                    >
                      <span className="spectate-blackout-mark" aria-hidden>
                        ?
                      </span>
                    </span>
                  ))
                ) : (
                  p.hand.map((h) => {
                    const def = getItem(h.itemId);
                    const threatened = mark.ids.has(h.instanceId);
                    return (
                      <span
                        key={h.instanceId}
                        className={[
                          'spectate-item',
                          h.golden ? 'golden' : '',
                          threatened ? 'quick-swap-threat' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        title={`${h.golden ? 'Golden ' : ''}${def.name}${
                          threatened ? ' · Quick Swap' : ''
                        }`}
                      >
                        <SpriteIcon
                          id={h.itemId}
                          golden={h.golden}
                          aria-hidden
                        />
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
