import { EventBannerCard } from './EventBanner';
import { PaceBanner } from './PaceBanner';
import { RoundClock } from './RoundClock';
import { SuddenDeathBanner } from './SuddenDeathBanner';
import { SpriteIcon } from './SpriteIcon';
import { CONFIG } from '../game/constants';
import { getWorldEvent } from '../game/worldEvents';
import type { Player, SuddenDeathState, WorldEventState } from '../game/types';

type Props = {
  roundMs: number;
  elapsedMs: number;
  paceBannerMs: number;
  suddenDeath: SuddenDeathState;
  worldEvent: WorldEventState;
  players: Player[];
  onQuit: () => void;
  matchLengthMs?: number;
};

function formatSec(ms: number): string {
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

/**
 * Top chrome: timer panel with live-event chips, plus a single banner slot.
 * Newest event owns the banner; every live event stays visible as a chip.
 */
export function GameChrome({
  roundMs,
  elapsedMs,
  paceBannerMs,
  suddenDeath,
  worldEvent,
  players,
  onQuit,
  matchLengthMs,
}: Props) {
  const showPace = paceBannerMs > 0;
  const showSudden = suddenDeath.active;
  const showWarning =
    !suddenDeath.active && worldEvent.phase === 'warning' && !!worldEvent.id;
  const liveEvents = suddenDeath.active ? [] : worldEvent.live;
  const newestLive = liveEvents[liveEvents.length - 1] ?? null;

  const hasBanner =
    showSudden || !!newestLive || showWarning || showPace;

  return (
    <header className="game-chrome">
      <div className="game-chrome-top">
        <div
          className={`round-clock-panel${liveEvents.length ? ' has-chips' : ''}`}
        >
          <RoundClock
            ms={roundMs}
            suddenDeath={suddenDeath}
            totalMs={matchLengthMs}
          />
          {liveEvents.length > 0 && (
            <div className="event-chip-grid" aria-label="Live events">
              {liveEvents.map((live) => {
                const def = getWorldEvent(live.id);
                return (
                  <div
                    key={live.key}
                    className={`event-chip${
                      newestLive?.key === live.key ? ' focus' : ''
                    }`}
                    style={{ ['--event-accent' as string]: def.accent }}
                    title={`${def.name}: ${formatSec(live.activeMs)} left`}
                  >
                    <SpriteIcon
                      id={live.id}
                      className="event-chip-emoji"
                      aria-hidden
                    />
                    <span className="event-chip-timer">
                      {formatSec(live.activeMs)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button type="button" className="quit-btn" onClick={onQuit}>
          Quit
        </button>
      </div>

      <div
        className={`game-chrome-banner${hasBanner ? '' : ' is-empty'}`}
        aria-hidden={!hasBanner}
      >
        {showSudden ? (
          <SuddenDeathBanner suddenDeath={suddenDeath} players={players} />
        ) : newestLive ? (
          <EventBannerCard
            key={newestLive.key}
            mode="active"
            id={newestLive.id}
            motion="shown"
            remainMs={newestLive.activeMs}
          />
        ) : showWarning && worldEvent.id ? (
          <EventBannerCard
            key={`warn-${worldEvent.id}`}
            mode="warning"
            id={worldEvent.id}
            motion="shown"
            remainMs={Math.max(0, roundMs - CONFIG.EVENT_START_AT_MS)}
          />
        ) : showPace ? (
          <PaceBanner elapsedMs={elapsedMs} />
        ) : null}
      </div>
    </header>
  );
}
