import { getItem } from '../game/items';
import type { ItemId } from '../game/types';

type Props = {
  countdown: number;
  itemPool: ItemId[];
  /** Early peek during Tag Sale — can dismiss */
  early?: boolean;
  /** Skip cell entrance animation (already shown during Tag Sale) */
  skipEntrance?: boolean;
  onClose?: () => void;
};

export function MatchPoolReveal({
  countdown,
  itemPool,
  early,
  skipEntrance,
  onClose,
}: Props) {
  const items = [...itemPool]
    .map((id) => getItem(id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      className={`countdown-overlay${early ? ' early-peek' : ''}${skipEntrance ? ' no-entrance' : ''}`}
      aria-live="assertive"
      role="dialog"
      aria-label="Match item pool"
    >
      <div className="pool-reveal">
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
          <button type="button" className="btn primary" onClick={onClose}>
            Back
          </button>
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
