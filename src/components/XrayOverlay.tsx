import { getItem } from '../game/items';
import type { Player } from '../game/types';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  msLeft: number;
  rivals: Player[];
};

export function XrayOverlay({ msLeft, rivals }: Props) {
  const sec = Math.max(0, Math.ceil(msLeft / 1000));
  const alive = rivals.filter((p) => p.isAlive);

  return (
    <div
      className="xray-overlay"
      role="dialog"
      aria-label="X-ray goggles"
      aria-modal="true"
    >
      <div className="xray-sheet">
        <header className="xray-head">
          <SpriteIcon id="xray_goggles" className="xray-glyph" aria-hidden />
          <div className="xray-head-copy">
            <span className="xray-kicker">X-ray</span>
            <span className="xray-title">Rival hands</span>
          </div>
          <span className="xray-timer" aria-live="polite">
            {sec}s
          </span>
        </header>
        <ul className="xray-list">
          {alive.length === 0 ? (
            <li className="xray-empty">No living rivals</li>
          ) : (
            alive.map((p) => (
              <li
                key={p.id}
                className="xray-row"
                style={{ ['--player-color' as string]: p.color }}
              >
                <div className="xray-who">
                  <SpriteIcon
                    id={p.avatar}
                    className="xray-avatar"
                    aria-hidden
                  />
                  <span className="xray-name">{p.name}</span>
                </div>
                <div className="xray-hand">
                  {p.hand.length === 0 ? (
                    <span className="xray-hand-empty">Empty</span>
                  ) : (
                    p.hand.map((h) => {
                      const def = getItem(h.itemId);
                      return (
                        <span
                          key={h.instanceId}
                          className={`xray-item${h.golden ? ' golden' : ''}`}
                          title={`${h.golden ? 'Golden ' : ''}${def.name} · sell ${def.sellValue || '—'}`}
                        >
                          <SpriteIcon
                            id={h.itemId}
                            golden={h.golden}
                            aria-hidden
                          />
                          <span className="xray-item-name">{def.name}</span>
                        </span>
                      );
                    })
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
        <p className="xray-foot">Hands locked while scanning</p>
      </div>
    </div>
  );
}
