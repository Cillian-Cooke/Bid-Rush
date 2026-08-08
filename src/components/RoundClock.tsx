import { CONFIG } from '../game/constants';
import type { SuddenDeathState } from '../game/types';

type Props = {
  ms: number;
  suddenDeath: SuddenDeathState;
  /** Full match length for the progress bar (defaults to CONFIG) */
  totalMs?: number;
};

export function RoundClock({ ms, suddenDeath, totalMs }: Props) {
  if (suddenDeath.active) {
    const sec = Math.max(0, Math.ceil(suddenDeath.phaseMs / 1000));
    const ratio = Math.max(
      0,
      Math.min(1, suddenDeath.phaseMs / CONFIG.SUDDEN_DEATH_PHASE_MS),
    );
    return (
      <div
        className="round-clock sudden-death critical"
        aria-label={`Sudden death. Need ${suddenDeath.bracket} coins. ${sec} seconds left`}
      >
        <span className="round-clock-kicker">Death</span>
        <span className="round-clock-time">{sec}s</span>
        <div className="round-clock-bar">
          <div
            className="round-clock-bar-fill sudden"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>
    );
  }

  const clamped = Math.max(0, ms);
  const totalSec = Math.ceil(clamped / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const urgent = clamped <= 30_000;
  const critical = clamped <= 10_000;
  const span = Math.max(1, totalMs ?? CONFIG.GAME_LENGTH_MS);

  return (
    <div
      className={`round-clock${urgent ? ' urgent' : ''}${critical ? ' critical' : ''}`}
      aria-label={`Time remaining ${m}:${s.toString().padStart(2, '0')}`}
    >
      <span className="round-clock-time">
        {m}:{s.toString().padStart(2, '0')}
      </span>
      <div className="round-clock-bar">
        <div
          className="round-clock-bar-fill"
          style={{ width: `${(clamped / span) * 100}%` }}
        />
      </div>
    </div>
  );
}
