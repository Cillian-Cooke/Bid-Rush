import { CONFIG } from '../game/constants';
import type { Player, SuddenDeathState } from '../game/types';

type Props = {
  suddenDeath: SuddenDeathState;
  players: Player[];
};

export function SuddenDeathBanner({ suddenDeath, players }: Props) {
  const sec = Math.max(0, Math.ceil(suddenDeath.phaseMs / 1000));
  const urgent = suddenDeath.phaseMs <= 10_000;
  const critical = suddenDeath.phaseMs <= 5_000;
  const alive = players.filter((p) => p.isAlive);
  const atRisk = alive.filter((p) => p.coins < suddenDeath.bracket);
  const safeCount = alive.length - atRisk.length;

  return (
    <div className="event-banner-slot sd-banner-slot" aria-live="assertive">
      <div
        className={`event-banner sd-banner${urgent ? ' urgent' : ''}${critical ? ' critical' : ''}`}
        role="status"
      >
        <span className="event-banner-rail" aria-hidden />
        <span className="event-banner-emoji" aria-hidden>
          💀
        </span>
        <div className="event-banner-copy">
          <span className="event-banner-kicker">Sudden Death</span>
          <span className="event-banner-title">
            Bracket ≥{suddenDeath.bracket}
          </span>
          <span className="event-banner-line">
            {atRisk.length === 0
              ? `All clear — next bar doubles soon`
              : `${atRisk.length} at risk · ${safeCount} safe · stay above ${suddenDeath.bracket}`}
          </span>
        </div>
        <div className="event-banner-timeblock">
          <span className="event-banner-time-label">Cull in</span>
          <span className="event-banner-timer">{sec}s</span>
          <div className="sd-banner-mini-bar" aria-hidden>
            <div
              className="sd-banner-mini-fill"
              style={{
                width: `${Math.max(0, Math.min(1, suddenDeath.phaseMs / CONFIG.SUDDEN_DEATH_PHASE_MS)) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
