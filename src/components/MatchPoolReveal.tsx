import { getItem } from '../game/items';
import type { ItemId } from '../game/types';

type Props = {
  countdown: number;
  itemPool: ItemId[];
  /** Early peek during Tag Sale — can dismiss */
  early?: boolean;
  onClose?: () => void;
};

export function MatchPoolReveal({
  countdown,
  itemPool,
  early,
  onClose,
}: Props) {
  const items = [...itemPool]
    .map((id) => getItem(id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      className={`countdown-overlay${early ? ' early-peek' : ''}`}
      aria-live="assertive"
      role="dialog"
      aria-label="Match item pool"
    >
      <div className="pool-reveal">
        <p className="pool-reveal-kicker">
          {early ? 'Peek — this match’s shop' : 'This match’s shop'}
        </p>
        <h2 className="pool-reveal-title">16 Items in Play</h2>
        <div className="pool-reveal-grid">
          {items.map((item) => (
            <div key={item.id} className="pool-reveal-cell">
              <span className="pool-reveal-emoji" aria-hidden>
                {item.emoji}
              </span>
              <span className="pool-reveal-name">{item.name}</span>
            </div>
          ))}
        </div>
        {early ? (
          <div className="pool-reveal-early-actions">
            <p className="pool-reveal-early-note">
              Stays on the clock until match start (up to 10s if opened now)
            </p>
            <button type="button" className="btn primary" onClick={onClose}>
              Back to Tag Sale
            </button>
          </div>
        ) : (
          <div
            key={countdown}
            className={`pool-reveal-count${countdown === 0 ? ' go' : ''}`}
          >
            {countdown === 0 ? 'GO!' : countdown}
          </div>
        )}
      </div>
    </div>
  );
}
