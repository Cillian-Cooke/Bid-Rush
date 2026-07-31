import {
  formatPaceMult,
  matchPaceMult,
  paceAccent,
  paceLabel,
} from '../game/pace';

type Props = {
  elapsedMs: number;
  motion?: 'in' | 'shown' | 'out';
};

export function PaceBanner({ elapsedMs, motion = 'shown' }: Props) {
  const mult = matchPaceMult(elapsedMs);
  const accent = paceAccent(mult);

  return (
    <div className="event-banner-slot pace-banner-slot" aria-live="polite">
      <div
        className={`event-banner pace-banner motion-${motion} active`}
        style={{ ['--event-accent' as string]: accent }}
        role="status"
      >
        <span className="event-banner-rail" aria-hidden />
        <span className="event-banner-emoji" aria-hidden>
          ⚡
        </span>
        <div className="event-banner-copy">
          <span className="event-banner-kicker">Market Pace</span>
          <span className="event-banner-title">{formatPaceMult(mult)}</span>
          <span className="event-banner-line">{paceLabel(mult)}</span>
        </div>
        <div className="event-banner-timeblock">
          <span className="event-banner-time-label">Speed</span>
          <span className="event-banner-timer">{formatPaceMult(mult)}</span>
        </div>
      </div>
    </div>
  );
}
