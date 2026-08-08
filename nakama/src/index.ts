/// <reference types="nakama-runtime" />

/**
 * Exports handlers on the esbuild IIFE global `__bidRushHandlers`.
 * `scripts/build.mjs` wraps them as top-level named functions for Nakama.
 */

import { LEADERBOARD_ID } from './rankedMath';
import { MATCH_MODULE } from './moduleName';
import {
  matchInit as matchInitImpl,
  matchJoin as matchJoinImpl,
  matchJoinAttempt as matchJoinAttemptImpl,
  matchLeave as matchLeaveImpl,
  matchLoop as matchLoopImpl,
  matchSignal as matchSignalImpl,
  matchTerminate as matchTerminateImpl,
} from './match/bidRushMatch';
import {
  rpcApplyRanked,
  rpcCreateCustomMatch,
  rpcEnsureLeaderboard,
  rpcGetProfile,
  rpcGetRanked,
  rpcJoinCustomMatch,
  rpcListLeaderboard,
  rpcMigrateRanked,
  rpcSetDisplayName,
} from './rpcs';

export function get_profile(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
) {
  return rpcGetProfile(ctx, logger, nk, payload);
}

export function set_display_name(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
) {
  return rpcSetDisplayName(ctx, logger, nk, payload);
}

export function get_ranked(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
) {
  return rpcGetRanked(ctx, logger, nk, payload);
}

export function migrate_ranked(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
) {
  return rpcMigrateRanked(ctx, logger, nk, payload);
}

export function apply_ranked(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
) {
  return rpcApplyRanked(ctx, logger, nk, payload);
}

export function list_leaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
) {
  return rpcListLeaderboard(ctx, logger, nk, payload);
}

export function ensure_leaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
) {
  return rpcEnsureLeaderboard(ctx, logger, nk, payload);
}

export function create_custom_match(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
) {
  return rpcCreateCustomMatch(ctx, logger, nk, payload);
}

export function join_custom_match(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
) {
  return rpcJoinCustomMatch(ctx, logger, nk, payload);
}

export function matchInit(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string },
) {
  return matchInitImpl(ctx, logger, nk, params);
}

export function matchJoinAttempt(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: unknown },
) {
  return matchJoinAttemptImpl(
    ctx,
    logger,
    nk,
    dispatcher,
    tick,
    state as never,
    presence,
    metadata,
  );
}

export function matchJoin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[],
) {
  return matchJoinImpl(
    ctx,
    logger,
    nk,
    dispatcher,
    tick,
    state as never,
    presences,
  );
}

export function matchLeave(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[],
) {
  return matchLeaveImpl(
    ctx,
    logger,
    nk,
    dispatcher,
    tick,
    state as never,
    presences,
  );
}

export function matchLoop(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[],
) {
  return matchLoopImpl(
    ctx,
    logger,
    nk,
    dispatcher,
    tick,
    state as never,
    messages,
  );
}

export function matchTerminate(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  graceSeconds: number,
) {
  return matchTerminateImpl(
    ctx,
    logger,
    nk,
    dispatcher,
    tick,
    state as never,
    graceSeconds,
  );
}

export function matchSignal(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  data: string,
) {
  return matchSignalImpl(
    ctx,
    logger,
    nk,
    dispatcher,
    tick,
    state as never,
    data,
  );
}

export function matchmakerMatched(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  entries: nkruntime.MatchmakerResult[],
): string | void {
  const props = entries[0]?.properties || {};
  const mode = String(props['mode'] || 'duel');
  const queue = String(props['queue'] || 'casual');
  let rankIndex = 0;
  if (typeof props['rank'] === 'number') {
    rankIndex = Math.max(0, Math.min(4, props['rank']));
  } else if (typeof props['rank'] === 'string') {
    rankIndex = Math.max(0, Math.min(4, Number(props['rank']) || 0));
  }

  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }

  logger.info(
    'Matchmaker matched %d players mode=%s queue=%s',
    entries.length,
    mode,
    queue,
  );

  return nk.matchCreate(MATCH_MODULE, {
    mode,
    queue,
    code,
    autoStart: '1',
    difficulty: 'mixed',
    rankIndex: String(rankIndex),
  });
}

export function setupLeaderboard(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
) {
  try {
    // JS runtime wants string enums ("desc"/"set"), not TypeScript nkruntime.* values.
    nk.leaderboardCreate(LEADERBOARD_ID, true, 'desc', 'set', '', null, true);
    logger.info('Leaderboard %s ready', LEADERBOARD_ID);
  } catch (e) {
    logger.info('Leaderboard create (may already exist): %s', e);
  }

  // Drop nameless score-0 ghost rows (old anonymous device migrates).
  try {
    const listed = nk.leaderboardRecordsList(
      LEADERBOARD_ID,
      undefined,
      100,
      undefined,
      0,
    );
    const bad: string[] = [];
    for (const r of listed.records || []) {
      const anyR = r as nkruntime.LeaderboardRecord & {
        owner_id?: string;
      };
      const ownerId = String(anyR.ownerId || anyR.owner_id || '');
      const meta = (anyR.metadata || {}) as { name?: string };
      const name = String(meta.name || anyR.username || '').trim();
      if (ownerId && !name && Number(anyR.score) === 0) {
        bad.push(ownerId);
      }
    }
    if (bad.length > 0) {
      for (const ownerId of bad) {
        try {
          // Runtime API takes one owner id (string), not an array.
          nk.leaderboardRecordDelete(LEADERBOARD_ID, ownerId);
        } catch (delErr) {
          logger.warn('Failed deleting leaderboard row %s: %s', ownerId, delErr);
        }
      }
      logger.info('Purged %d empty leaderboard rows', bad.length);
    } else {
      logger.info('No empty leaderboard rows to purge');
    }
  } catch (e) {
    logger.warn('Leaderboard purge skipped: %s', e);
  }
}

/** @deprecated registration happens in the build wrapper's InitModule */
export function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _initializer: nkruntime.Initializer,
) {
  setupLeaderboard(nk, logger);
  logger.info('Bid Rush handlers ready (register via wrapper).');
}
