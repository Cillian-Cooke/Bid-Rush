import type { DeathReport } from '../game/types';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  reason: 'unpaid' | 'bomb' | 'bracket' | 'roi' | 'leech' | null;
  report: DeathReport | null;
  onPlayAgain: () => void;
  onSpectate: () => void;
  onMenu: () => void;
};

function reasonFallback(reason: Props['reason']): string {
  if (reason === 'bomb') return 'The bomb went off.';
  if (reason === 'bracket') return 'You fell under the coin bracket.';
  if (reason === 'roi') return 'ROI failed — you couldn’t hit the target.';
  if (reason === 'leech') return 'Drained dry.';
  if (reason === 'unpaid') return 'You couldn’t pay your bid.';
  return 'You’re out of the match.';
}

function formatDelta(delta: number): string {
  if (delta === 0) return '';
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

export function KnockoutOverlay({
  reason,
  report,
  onPlayAgain,
  onSpectate,
  onMenu,
}: Props) {
  const headline = report?.headline ?? reasonFallback(reason);
  const swings = report?.swings ?? [];

  return (
    <div className="knockout-overlay" role="dialog" aria-label="Knocked out">
      <div className="knockout-card">
        <span className="knockout-kicker">Knocked Out</span>
        <h2 className="knockout-title">You’re Done</h2>
        <p className="knockout-line">{headline}</p>
        {swings.length > 0 && (
          <ul className="death-trail" aria-label="What hit your score">
            {swings.map((s, i) => (
              <li key={`${s.label}-${i}`} className="death-trail-row">
                <SpriteIcon
                  id={s.emoji}
                  className="death-trail-emoji"
                  aria-hidden
                />
                <span className="death-trail-label">{s.label}</span>
                {s.delta !== 0 && (
                  <span
                    className={`death-trail-delta${s.delta < 0 ? ' neg' : ' pos'}`}
                  >
                    {formatDelta(s.delta)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="knockout-sub">The match is still going — pick one:</p>
        <div className="knockout-actions">
          <button type="button" className="btn primary" onClick={onPlayAgain}>
            Play Again
          </button>
          <button type="button" className="btn" onClick={onSpectate}>
            Spectate
          </button>
          <button type="button" className="btn ghost" onClick={onMenu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
