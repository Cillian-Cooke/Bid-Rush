import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../game/constants';
import { getWorldEvent } from '../game/worldEvents';
import type { LiveWorldEvent, WorldEventId, WorldEventState } from '../game/types';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  worldEvent: WorldEventState;
  roundMs: number;
  /** Compact stacked layout when many banners are up */
  dense?: boolean;
};

type BannerMode = 'warning' | 'active';

type BannerSlide = {
  key: string;
  mode: BannerMode;
  id: WorldEventId;
  motion: 'in' | 'shown' | 'out';
  remainMs: number;
};

const SLIDE_MS = 420;

function formatSec(ms: number): string {
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

function slidesFrom(
  worldEvent: WorldEventState,
  roundMs: number,
): BannerSlide[] {
  const slides: BannerSlide[] = [];

  if (worldEvent.phase === 'warning' && worldEvent.id) {
    slides.push({
      key: `warn-${worldEvent.id}`,
      mode: 'warning',
      id: worldEvent.id,
      motion: 'shown',
      remainMs: Math.max(0, roundMs - CONFIG.EVENT_START_AT_MS),
    });
  }

  for (const live of worldEvent.live) {
    slides.push({
      key: live.key,
      mode: 'active',
      id: live.id,
      motion: 'shown',
      remainMs: Math.max(0, live.activeMs),
    });
  }

  return slides;
}

export function EventBannerStack({ worldEvent, roundMs, dense }: Props) {
  const desired = slidesFrom(worldEvent, roundMs);
  const [slides, setSlides] = useState<BannerSlide[]>(desired);
  const prevKeysRef = useRef<Set<string>>(new Set(desired.map((s) => s.key)));

  useEffect(() => {
    const next = slidesFrom(worldEvent, roundMs);
    const nextKeys = new Set(next.map((s) => s.key));
    const prevKeys = prevKeysRef.current;

    const entering = next.filter((s) => !prevKeys.has(s.key));
    const staying = next.filter((s) => prevKeys.has(s.key));
    const leavingKeys = [...prevKeys].filter((k) => !nextKeys.has(k));

    setSlides((cur) => {
      const leaving = cur
        .filter((s) => leavingKeys.includes(s.key) && s.motion !== 'out')
        .map((s) => ({ ...s, motion: 'out' as const }));
      const kept = staying.map((s) => {
        const old = cur.find((c) => c.key === s.key);
        return {
          ...s,
          motion: old?.motion === 'in' ? ('in' as const) : ('shown' as const),
        };
      });
      const fresh = entering.map((s) => ({ ...s, motion: 'in' as const }));
      return [...leaving, ...kept, ...fresh];
    });

    prevKeysRef.current = nextKeys;

    const enterTimer = window.setTimeout(() => {
      setSlides((cur) =>
        cur.map((s) => (s.motion === 'in' ? { ...s, motion: 'shown' } : s)),
      );
    }, SLIDE_MS);

    const exitTimer = window.setTimeout(() => {
      setSlides((cur) => cur.filter((s) => s.motion !== 'out'));
    }, SLIDE_MS);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
    };
    // remainMs updates every tick via live - refresh timers without remounting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    worldEvent.phase,
    worldEvent.id,
    worldEvent.live.map((e) => `${e.key}:${Math.ceil(e.activeMs / 500)}`).join('|'),
    roundMs > CONFIG.EVENT_START_AT_MS
      ? Math.ceil((roundMs - CONFIG.EVENT_START_AT_MS) / 500)
      : 0,
  ]);

  // Keep remainMs fresh on every render for visible slides
  const liveByKey = new Map(worldEvent.live.map((e) => [e.key, e]));
  const rendered = slides.map((s) => {
    if (s.mode === 'warning') {
      return {
        ...s,
        remainMs: Math.max(0, roundMs - CONFIG.EVENT_START_AT_MS),
      };
    }
    const live = liveByKey.get(s.key);
    return live ? { ...s, remainMs: live.activeMs } : s;
  });

  if (rendered.length === 0) return null;

  return (
    <div
      className={`event-banner-stack${dense ? ' dense' : ''}${
        rendered.length >= 3 ? ' crowded' : ''
      }`}
      aria-live="polite"
    >
      {rendered.map((slide) => (
        <EventBannerCard
          key={slide.key}
          mode={slide.mode}
          id={slide.id}
          motion={slide.motion}
          remainMs={slide.remainMs}
        />
      ))}
    </div>
  );
}

/** @deprecated single-slot wrapper - prefer EventBannerStack */
export function EventBanner({ worldEvent, roundMs }: Props) {
  return <EventBannerStack worldEvent={worldEvent} roundMs={roundMs} />;
}

export function EventBannerCard({
  mode,
  id,
  motion,
  remainMs,
}: {
  mode: BannerMode;
  id: WorldEventId;
  motion: BannerSlide['motion'];
  remainMs: number;
}) {
  const def = getWorldEvent(id);
  const isWarn = mode === 'warning';

  return (
    <div
      className={`event-banner-slot`}
      role="status"
    >
      <div
        className={`event-banner motion-${motion}${isWarn ? ' warning' : ' active'}`}
        style={{ ['--event-accent' as string]: def.accent }}
      >
        <span className="event-banner-rail" aria-hidden />
        <SpriteIcon
          id={id}
          className="event-banner-emoji"
          aria-hidden
        />
        <div className="event-banner-copy">
          <span className="event-banner-kicker">
            {isWarn ? 'Next Event' : 'Live Event'}
          </span>
          <span className="event-banner-title">{def.name}</span>
          <span className="event-banner-line">
            {isWarn ? def.warnLine : def.activeLine}
          </span>
        </div>
        <div className="event-banner-timeblock">
          <span className="event-banner-time-label">
            {isWarn ? 'Starts in' : 'Ends in'}
          </span>
          <span className="event-banner-timer">{formatSec(remainMs)}</span>
        </div>
      </div>
    </div>
  );
}

export type { LiveWorldEvent };
