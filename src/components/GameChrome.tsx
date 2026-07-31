import { EventBanner } from './EventBanner';
import { PaceBanner } from './PaceBanner';
import { RoundClock } from './RoundClock';
import { SuddenDeathBanner } from './SuddenDeathBanner';
import type { Player, SuddenDeathState, WorldEventState } from '../game/types';

type Props = {
  roundMs: number;
  elapsedMs: number;
  paceBannerMs: number;
  suddenDeath: SuddenDeathState;
  worldEvent: WorldEventState;
  players: Player[];
  onQuit: () => void;
};

/** Top chrome: large timer, banners stacked underneath when live. */
export function GameChrome({
  roundMs,
  elapsedMs,
  paceBannerMs,
  suddenDeath,
  worldEvent,
  players,
  onQuit,
}: Props) {
  const showPace = paceBannerMs > 0;
  const showEvent =
    !suddenDeath.active &&
    (worldEvent.phase === 'warning' || worldEvent.phase === 'active');
  const showSudden = suddenDeath.active;
  const showStack = showPace || showSudden || showEvent;

  return (
    <header className="game-chrome">
      <div className="game-chrome-top">
        <RoundClock ms={roundMs} suddenDeath={suddenDeath} />
        <button type="button" className="quit-btn" onClick={onQuit}>
          Quit
        </button>
      </div>
      {showStack && (
        <div className="game-chrome-banner">
          {showPace && <PaceBanner elapsedMs={elapsedMs} />}
          {showSudden && (
            <SuddenDeathBanner suddenDeath={suddenDeath} players={players} />
          )}
          {showEvent && (
            <EventBanner worldEvent={worldEvent} roundMs={roundMs} />
          )}
        </div>
      )}
    </header>
  );
}
