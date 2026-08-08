import type { GameMode } from '../game/types';
import { loadRankProgress } from '../game/ranked';
import { joinMatchedGame, leaveOnlineRoom } from './onlineSession';
import {
  displayNameForOnline,
  ensureNakamaSession,
  getNakamaSocket,
} from './nakama';
import { useGameStore } from '../store';

export type QueueKind = 'ranked' | 'casual';

export type MatchmakingStatus =
  | 'idle'
  | 'connecting'
  | 'searching'
  | 'found'
  | 'joining'
  | 'error';

let ticket: string | null = null;
let status: MatchmakingStatus = 'idle';
let lastError: string | null = null;
let onStatus: ((s: MatchmakingStatus, err?: string | null) => void) | null =
  null;
let fallbackTimer = 0;
let searchStartedAt = 0;

export function getMatchmakingStatus(): MatchmakingStatus {
  return status;
}

export function getMatchmakingError(): string | null {
  return lastError;
}

/** When the current search started (ms), or 0 if not searching. */
export function getMatchmakingStartedAt(): number {
  return searchStartedAt;
}

export function setMatchmakingListener(
  fn: ((s: MatchmakingStatus, err?: string | null) => void) | null,
) {
  onStatus = fn;
}

function setStatus(s: MatchmakingStatus, err: string | null = null) {
  status = s;
  lastError = err;
  if (s !== 'searching') searchStartedAt = 0;
  onStatus?.(s, err);
}

function clearFallback() {
  if (fallbackTimer) {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = 0;
  }
}

export async function cancelMatchmaking() {
  clearFallback();
  searchStartedAt = 0;
  const socket = getNakamaSocket();
  if (socket && ticket) {
    try {
      await socket.removeMatchmaker(ticket);
    } catch {
      /* ignore */
    }
  }
  ticket = null;
  setStatus('idle');
}

/**
 * Queue for Ranked or Casual. After `fallbackMs` with no match, `onFallback`
 * runs (typically a local offline match). Ranked RP online is applied by Nakama.
 */
export async function startMatchmaking(opts: {
  kind: QueueKind;
  mode: GameMode;
  /** Search window before offline fallback. Default 10s. */
  fallbackMs?: number;
  onFallback?: () => void;
}): Promise<void> {
  await cancelMatchmaking();
  setStatus('connecting');

  const mode = opts.mode === 'blitz' ? 'blitz' : 'duel';
  const kind = opts.kind;
  const maxPlayers = mode === 'blitz' ? 4 : 2;
  const minPlayers = 2;

  try {
    await ensureNakamaSession();
    const socket = getNakamaSocket();
    if (!socket) throw new Error('Nakama socket unavailable');

    socket.onmatchmakermatched = (matched) => {
      clearFallback();
      ticket = null;
      setStatus('found');
      const matchId = matched.match_id;
      if (!matchId && !matched.token) {
        setStatus('error', 'No match id from matchmaker');
        return;
      }
      void (async () => {
        try {
          setStatus('joining');
          useGameStore.setState({
            matchKind: kind === 'ranked' ? 'ranked' : 'casual',
            onlineError: null,
          });
          if (matched.token && !matchId) {
            // Relayed match - should not happen with our authoritative hook
            await socket.joinMatch(undefined, matched.token);
          }
          await joinMatchedGame(matchId, {
            displayName: displayNameForOnline(),
          });
          setStatus('idle');
        } catch (err) {
          setStatus(
            'error',
            err instanceof Error ? err.message : 'Could not join match',
          );
        }
      })();
    };

    const progress = loadRankProgress();
    const query = `+properties.queue:${kind} +properties.mode:${mode}`;
    const stringProps: Record<string, string> = {
      queue: kind,
      mode,
    };
    const numericProps: Record<string, number> = {
      rank: progress.rankIndex,
    };

    searchStartedAt = Date.now();
    setStatus('searching');
    const result = await socket.addMatchmaker(
      query,
      minPlayers,
      maxPlayers,
      stringProps,
      numericProps,
    );
    ticket = result.ticket;

    const fallbackMs = opts.fallbackMs ?? 10_000;
    if (fallbackMs > 0 && opts.onFallback) {
      fallbackTimer = window.setTimeout(() => {
        void (async () => {
          await cancelMatchmaking();
          opts.onFallback?.();
        })();
      }, fallbackMs);
    }
  } catch (err) {
    setStatus(
      'error',
      err instanceof Error
        ? err.message
        : 'Matchmaking unavailable. Is Nakama running?',
    );
  }
}
export async function abandonOnlineMatch() {
  await cancelMatchmaking();
  await leaveOnlineRoom();
}
