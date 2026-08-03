import { EventBannerStack } from './EventBanner';
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

/**
 * Top chrome: large timer + fixed banner strip.
 * The strip always reserves the same height so the shop grid never shifts.
 */
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
  const showSudden = suddenDeath.active;
  const showWarning =
    !suddenDeath.active && worldEvent.phase === 'warning' && !!worldEvent.id;
  const showLive = !suddenDeath.active && worldEvent.live.length > 0;
  const showEvent = showWarning || showLive;
  const bannerCount =
    (showPace ? 1 : 0) +
    (showSudden ? 1 : 0) +
    (showWarning ? 1 : 0) +
    worldEvent.live.length;
  const dense = bannerCount >= 2;
  const crowded = bannerCount >= 3;

  return (
    <header className="game-chrome">
      <div className="game-chrome-top">
        <RoundClock ms={roundMs} suddenDeath={suddenDeath} />
        <button type="button" className="quit-btn" onClick={onQuit}>
          Quit
        </button>
      </div>
      <div
        className={[
          'game-chrome-banner',
          dense ? 'dense' : '',
          crowded ? 'crowded' : '',
          bannerCount === 0 ? 'is-empty' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden={bannerCount === 0}
      >
        {showPace && <PaceBanner elapsedMs={elapsedMs} />}
        {showSudden && (
          <SuddenDeathBanner suddenDeath={suddenDeath} players={players} />
        )}
        {showEvent && (
          <EventBannerStack
            worldEvent={worldEvent}
            roundMs={roundMs}
            dense={dense}
          />
        )}
      </div>
    </header>
  );
}
