import { CONFIG } from '../game/constants';

type Props = {
  ms: number;
};

export function RoundClock({ ms }: Props) {
  const clamped = Math.max(0, ms);
  const totalSec = Math.ceil(clamped / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const urgent = clamped <= 30_000;
  const critical = clamped <= 10_000;

  return (
    <div
      className={`round-clock${urgent ? ' urgent' : ''}${critical ? ' critical' : ''}`}
      aria-label={`Time remaining ${m}:${s.toString().padStart(2, '0')}`}
    >
      <span className="round-clock-time">
        {m}:{s.toString().padStart(2, '0')}
      </span>
      <span className="round-clock-icon" aria-hidden>
        ⏱
      </span>
      <div className="round-clock-bar">
        <div
          className="round-clock-bar-fill"
          style={{ width: `${(clamped / CONFIG.GAME_LENGTH_MS) * 100}%` }}
        />
      </div>
    </div>
  );
}
