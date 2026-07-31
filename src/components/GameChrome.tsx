import { EventBanner } from './EventBanner';
import { RoundClock } from './RoundClock';
import { SuddenDeathBanner } from './SuddenDeathBanner';
import type { Player, SuddenDeathState, WorldEventState } from '../game/types';

type Props = {
  roundMs: number;
  suddenDeath: SuddenDeathState;
  worldEvent: WorldEventState;
  players: Player[];
};

/** Compact top chrome: clock + event/sudden-death banner share one band. */
export function GameChrome({
  roundMs,
  suddenDeath,
  worldEvent,
  players,
}: Props) {
  const showEvent =
    !suddenDeath.active &&
    (worldEvent.phase === 'warning' || worldEvent.phase === 'active');

  return (
    <header className="game-chrome">
      <RoundClock ms={roundMs} suddenDeath={suddenDeath} />
      <div className="game-chrome-banner">
        {suddenDeath.active ? (
          <SuddenDeathBanner suddenDeath={suddenDeath} players={players} />
        ) : showEvent ? (
          <EventBanner worldEvent={worldEvent} roundMs={roundMs} />
        ) : (
          <div className="chrome-idle" aria-hidden>
            <span className="chrome-idle-mark">Bid Rush</span>
            <span className="chrome-idle-line">Shop is live — bid sharp</span>
          </div>
        )}
      </div>
    </header>
  );
}
