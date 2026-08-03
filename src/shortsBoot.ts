import {
  applyShortsProfile,
  isShortsMode,
  readShortsQuery,
} from './game/shortsProfile';
import { useGameStore } from './store';
import type { Phase } from './game/types';

export type BidRushBridge = {
  phase: Phase;
  ended: boolean;
  winnerId: string | null;
  seed: number | null;
  mode: 'duel' | 'blitz';
  stepRecord: boolean;
  /** Match elapsed ms while playing (0 otherwise). */
  elapsedMs: number;
  /** Advance game clock by dtMs then yield for paint (step mode). */
  step: (dtMs: number) => void;
  /** Pause wall clocks and drive via step (fast-forward). */
  setClock: (mode: 'step' | 'realtime') => void;
  /**
   * Fast-forward in step mode until playing elapsedMs >= target
   * (or match ends). Returns a snapshot.
   */
  fastForwardTo: (targetElapsedMs: number) => {
    phase: Phase;
    elapsedMs: number;
    ended: boolean;
  };
};

declare global {
  interface Window {
    __BID_RUSH__?: BidRushBridge;
  }
}

function snapshot() {
  const s = useGameStore.getState();
  return {
    phase: s.phase,
    elapsedMs: s.game?.elapsedMs ?? 0,
    ended: s.game?.ended ?? s.phase === 'results',
  };
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
    elapsedMs: s.game?.elapsedMs ?? 0,
    step:
      prev?.step ??
      ((dtMs: number) => {
        useGameStore.getState().stepRecord(dtMs);
      }),
    setClock:
      prev?.setClock ??
      ((mode: 'step' | 'realtime') => {
        useGameStore.getState().setRecorderClock(mode);
        syncBridge();
      }),
    fastForwardTo:
      prev?.fastForwardTo ??
      ((targetElapsedMs: number) => {
        const store = useGameStore.getState();
        store.setRecorderClock('step');
        const maxIters = 8_000;
        for (let i = 0; i < maxIters; i++) {
          const cur = useGameStore.getState();
          if (cur.phase === 'results' || cur.game?.ended) break;
          if (
            cur.phase === 'playing' &&
            (cur.game?.elapsedMs ?? 0) >= targetElapsedMs
          ) {
            break;
          }
          const dt =
            cur.phase === 'playing'
              ? Math.min(250, Math.max(50, targetElapsedMs - (cur.game?.elapsedMs ?? 0)))
              : 400;
          cur.stepRecord(dt);
        }
        syncBridge();
        return snapshot();
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
