import type { GameMode } from '../game/types';
import type { MatchmakerMatched, Socket } from '@heroiclabs/nakama-js';
import { loadRankProgress } from '../game/ranked';
import { joinMatchedGame, leaveOnlineRoom } from './onlineSession';
import {
  displayNameForOnline,
  ensureNakamaRealtime,
  getNakamaSocket,
  reconnectNakamaSocket,
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

/** Search window before offline bot fallback (and loading-bar duration). */
export const MATCHMAKING_FALLBACK_MS = 25_000;

let ticket: string | null = null;
let status: MatchmakingStatus = 'idle';
let lastError: string | null = null;
let onStatus: ((s: MatchmakingStatus, err?: string | null) => void) | null =
  null;
let fallbackTimer = 0;
let searchStartedAt = 0;
let searchDurationMs = MATCHMAKING_FALLBACK_MS;
let searchGen = 0;

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

/** 0–1 progress for the queue loading bar (hits 1 when a match/bot is ready). */
export function getMatchmakingProgress(): number {
  if (status === 'found' || status === 'joining') return 1;
  if (status === 'connecting') return 0.05;
  if (status !== 'searching' || !searchStartedAt) return 0;
  const dur = Math.max(1, searchDurationMs);
  return Math.min(1, (Date.now() - searchStartedAt) / dur);
}

export function setMatchmakingListener(
  fn: ((s: MatchmakingStatus, err?: string | null) => void) | null,
) {
  onStatus = fn;
}

function setStatus(s: MatchmakingStatus, err: string | null = null) {
  status = s;
  lastError = err;
  if (s === 'idle' || s === 'error' || s === 'connecting') {
    searchStartedAt = 0;
  }
  onStatus?.(s, err);
}

function clearFallback() {
  if (fallbackTimer) {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = 0;
  }
}

async function dropTicket(activeTicket: string | null) {
  const socket = getNakamaSocket();
  if (socket) {
    socket.onmatchmakermatched = () => {};
    if (activeTicket) {
      try {
        await socket.removeMatchmaker(activeTicket);
      } catch {
        /* ignore — ticket may already be gone */
      }
    }
  }
}

export async function cancelMatchmaking() {
  clearFallback();
  searchStartedAt = 0;
  searchGen += 1;
  const pending = ticket;
  ticket = null;
  await dropTicket(pending);
  setStatus('idle');
}

/**
 * Queue for Ranked or Casual. After `fallbackMs` with no match, `onFallback`
 * runs (typically a local offline match). Ranked RP online is applied by Nakama.
 */
export async function startMatchmaking(opts: {
  kind: QueueKind;
  mode: GameMode;
  /** Search window before offline fallback. Default MATCHMAKING_FALLBACK_MS. */
  fallbackMs?: number;
  onFallback?: () => void;
}): Promise<void> {
  await cancelMatchmaking();
  const gen = searchGen;
  setStatus('connecting');

  const mode = opts.mode === 'blitz' ? 'blitz' : 'duel';
  const kind = opts.kind;
  const maxPlayers = mode === 'blitz' ? 4 : 2;
  const minPlayers = 2;
  const fallbackMs = opts.fallbackMs ?? MATCHMAKING_FALLBACK_MS;

  const onMatched = (sock: Socket) => (matched: MatchmakerMatched) => {
    if (gen !== searchGen) return;
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
        if (gen !== searchGen) return;
        setStatus('joining');
        useGameStore.setState({
          matchKind: kind === 'ranked' ? 'ranked' : 'casual',
          onlineError: null,
        });
        if (matched.token && !matchId) {
          await sock.joinMatch(undefined, matched.token);
        }
        await joinMatchedGame(matchId, {
          displayName: displayNameForOnline(),
        });
        if (gen !== searchGen) return;
        setStatus('idle');
      } catch (err) {
        if (gen !== searchGen) return;
        try {
          await leaveOnlineRoom(true);
        } catch {
          /* ignore */
        }
        useGameStore.getState().returnToLobby();
        setStatus(
          'error',
          err instanceof Error ? err.message : 'Could not join match',
        );
      }
    })();
  };

  try {
    await ensureNakamaRealtime();
    if (gen !== searchGen) return;

    const progress = loadRankProgress();
    const query = `+properties.queue:${kind} +properties.mode:${mode}`;
    const stringProps: Record<string, string> = {
      queue: kind,
      mode,
    };
    const numericProps: Record<string, number> = {
      rank: progress.rankIndex,
    };

    // Start the bar and bot-fallback clock together (before addMatchmaker).
    searchDurationMs = Math.max(1, fallbackMs);
    searchStartedAt = Date.now();
    setStatus('searching');

    if (fallbackMs > 0 && opts.onFallback) {
      fallbackTimer = window.setTimeout(() => {
        void (async () => {
          if (gen !== searchGen) return;
          if (status === 'found' || status === 'joining') return;

          // Fill the bar, then invalidate this search so a late addMatchmaker
          // result cannot leave a stale ticket or flip status back to error.
          setStatus('found');
          await new Promise((r) => window.setTimeout(r, 320));
          if (gen !== searchGen) return;

          clearFallback();
          searchGen += 1;
          const pending = ticket;
          ticket = null;
          await dropTicket(pending);

          useGameStore.setState({
            onlineError: 'No online players found. Playing offline vs bots.',
          });
          opts.onFallback?.();
          setStatus('idle');
        })();
      }, fallbackMs);
    }

    const queueOnSocket = async (sock: Socket) => {
      sock.onmatchmakermatched = onMatched(sock);
      const result = await sock.addMatchmaker(
        query,
        minPlayers,
        maxPlayers,
        stringProps,
        numericProps,
      );
      return result.ticket;
    };

    let sock = getNakamaSocket();
    if (!sock) throw new Error('Nakama socket unavailable');

    let newTicket: string;
    try {
      newTicket = await queueOnSocket(sock);
    } catch {
      // Stale socket / leftover ticket from a prior queue — reconnect and retry.
      if (gen !== searchGen) return;
      await reconnectNakamaSocket();
      if (gen !== searchGen) return;
      sock = getNakamaSocket();
      if (!sock) throw new Error('Nakama socket unavailable');
      newTicket = await queueOnSocket(sock);
    }

    if (gen !== searchGen) {
      // Bot fallback or cancel already won — drop the late ticket.
      await dropTicket(newTicket);
      return;
    }
    ticket = newTicket;
  } catch (err) {
    // Don't clobber an in-progress match if this search was already abandoned
    // (bot fallback bumps searchGen; cancel does too).
    if (gen !== searchGen) return;
    clearFallback();
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
