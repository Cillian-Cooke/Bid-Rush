import { applyShortsProfile, isShortsMode, readShortsQuery } from './game/shortsProfile';
import { useGameStore } from './store';
import type { Phase } from './game/types';

export type BidRushBridge = {
  phase: Phase;
  ended: boolean;
  winnerId: string | null;
  seed: number | null;
  mode: 'duel' | 'blitz';
  stepRecord: boolean;
  /** Advance game clock by dtMs then yield for paint (step mode). */
  step: (dtMs: number) => void;
};

declare global {
  interface Window {
    __BID_RUSH__?: BidRushBridge;
  }
}

function syncBridge(): void {
  const s = useGameStore.getState();
  const q = readShortsQuery();
  const prev = window.__BID_RUSH__;
  window.__BID_RUSH__ = {
    phase: s.phase,
    ended: s.game?.ended ?? s.phase === 'results',
    winnerId: s.game?.winnerId ?? null,
    seed: s.game?.seed ?? s.naming?.seed ?? q.seed,
    mode: q.mode,
    stepRecord: q.stepRecord,
    step:
      prev?.step ??
      ((dtMs: number) => {
        useGameStore.getState().stepRecord(dtMs);
      }),
  };
}

/** Apply Shorts profile, scale CSS, auto-start match, expose recorder bridge. */
export function bootShortsIfNeeded(): void {
  const q = readShortsQuery();
  if (!q.enabled) return;

  applyShortsProfile({ stepRecord: q.stepRecord });
  document.documentElement.classList.add('shorts-mode');
  if (q.stepRecord) {
    document.documentElement.classList.add('shorts-step');
  }

  useGameStore.getState().setDifficulty('ruthless');
  useGameStore.getState().setMode(q.mode);
  syncBridge();
  useGameStore.subscribe(syncBridge);

  // Defer past first paint so CSS/layout settle before Tag Sale
  queueMicrotask(() => {
    if (!isShortsMode()) return;
    useGameStore.getState().startNaming(q.mode, q.seed ?? undefined);
  });
}
