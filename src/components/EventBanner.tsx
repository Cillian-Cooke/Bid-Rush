import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../game/constants';
import { getWorldEvent } from '../game/worldEvents';
import type { WorldEventId, WorldEventState } from '../game/types';

type Props = {
  worldEvent: WorldEventState;
  roundMs: number;
};

type BannerMode = 'warning' | 'active';

type BannerSlide = {
  key: string;
  mode: BannerMode;
  id: WorldEventId;
  motion: 'in' | 'shown' | 'out';
};

const SLIDE_MS = 420;

function formatSec(ms: number): string {
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

function desiredFrom(worldEvent: WorldEventState): {
  mode: BannerMode;
  id: WorldEventId;
} | null {
  if (!worldEvent.id) return null;
  if (worldEvent.phase === 'warning') {
    return { mode: 'warning', id: worldEvent.id };
  }
  if (worldEvent.phase === 'active') {
    return { mode: 'active', id: worldEvent.id };
  }
  return null;
}

function sameBanner(
  a: BannerSlide | null,
  b: { mode: BannerMode; id: WorldEventId } | null,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.mode === b.mode && a.id === b.id && a.motion !== 'out';
}

function liveRemainMs(
  mode: BannerMode,
  worldEvent: WorldEventState,
  roundMs: number,
): number {
  if (mode === 'warning') {
    return Math.max(0, roundMs - CONFIG.EVENT_START_AT_MS);
  }
  return Math.max(0, worldEvent.activeMs);
}

export function EventBanner({ worldEvent, roundMs }: Props) {
  const [slide, setSlide] = useState<BannerSlide | null>(null);
  const slideRef = useRef<BannerSlide | null>(null);
  const frozenRemainRef = useRef(0);
  const seqRef = useRef(0);
  const chainRef = useRef(0);

  useEffect(() => {
    slideRef.current = slide;
  }, [slide]);

  useEffect(() => {
    const target = desiredFrom(worldEvent);
    const current = slideRef.current;

    if (sameBanner(current, target)) return;

    const chain = ++chainRef.current;
    let exitTimer = 0;
    let enterTimer = 0;

    const startEnter = (mode: BannerMode, id: WorldEventId) => {
      if (chain !== chainRef.current) return;
      const key = `${mode}-${id}-${++seqRef.current}`;
      const next: BannerSlide = { key, mode, id, motion: 'in' };
      frozenRemainRef.current = liveRemainMs(mode, worldEvent, roundMs);
      slideRef.current = next;
      setSlide(next);
      enterTimer = window.setTimeout(() => {
        if (chain !== chainRef.current) return;
        setSlide((cur) => {
          if (!cur || cur.key !== key) return cur;
          const shown: BannerSlide = { ...cur, motion: 'shown' };
          slideRef.current = shown;
          return shown;
        });
      }, SLIDE_MS);
    };

    if (current && current.motion !== 'out') {
      frozenRemainRef.current = liveRemainMs(
        current.mode,
        worldEvent,
        roundMs,
      );
      const leaving: BannerSlide = { ...current, motion: 'out' };
      slideRef.current = leaving;
      setSlide(leaving);
      exitTimer = window.setTimeout(() => {
        if (chain !== chainRef.current) return;
        slideRef.current = null;
        setSlide(null);
        if (target) startEnter(target.mode, target.id);
      }, SLIDE_MS);
    } else if (target) {
      startEnter(target.mode, target.id);
    } else {
      slideRef.current = null;
      setSlide(null);
    }

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(enterTimer);
    };
    // Intentionally only phase/id — roundMs/activeMs drive the timer display
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldEvent.phase, worldEvent.id]);

  const remainMs =
    slide && slide.motion !== 'out'
      ? liveRemainMs(slide.mode, worldEvent, roundMs)
      : frozenRemainRef.current;

  return (
    <div className="event-banner-slot" aria-live="polite">
      {slide && (
        <BannerCard
          key={slide.key}
          mode={slide.mode}
          id={slide.id}
          motion={slide.motion}
          remainMs={remainMs}
        />
      )}
    </div>
  );
}

function BannerCard({
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
      className={`event-banner motion-${motion}${isWarn ? ' warning' : ' active'}`}
      style={{ ['--event-accent' as string]: def.accent }}
      role="status"
    >
      <span className="event-banner-rail" aria-hidden />
      <span className="event-banner-emoji" aria-hidden>
        {def.emoji}
      </span>
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
  );
}
