import { getItem } from '../game/items';
import type { Player } from '../game/types';

type Props = {
  players: Player[];
};

export function SpectateHands({ players }: Props) {
  const ordered = [...players].sort((a, b) => {
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    return b.coins - a.coins;
  });

  return (
    <div className="spectate-bar" aria-label="Spectating all hands">
      <span className="spectate-label">SPECTATING</span>
      <div className="spectate-list">
        {ordered.map((p) => (
          <div
            key={p.id}
            className={`spectate-row${!p.isAlive ? ' out' : ''}`}
            style={{ ['--player-color' as string]: p.color }}
          >
            <div className="spectate-who">
              <span className="spectate-avatar">{p.avatar}</span>
              <div className="spectate-meta">
                <span className="spectate-name">
                  {p.name}
                  {p.isHuman ? ' (You)' : ''}
                  {!p.isAlive ? ' · OUT' : ''}
                </span>
                <span className="spectate-coins">💰 {p.coins}</span>
              </div>
            </div>
            <div className="spectate-hand">
              {p.hand.length === 0 ? (
                <span className="spectate-empty">Empty</span>
              ) : (
                p.hand.map((h) => {
                  const def = getItem(h.itemId);
                  return (
                    <span
                      key={h.instanceId}
                      className={`spectate-item${h.golden ? ' golden' : ''}`}
                      title={`${h.golden ? 'Golden ' : ''}${def.name}`}
                    >
                      {def.emoji}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
