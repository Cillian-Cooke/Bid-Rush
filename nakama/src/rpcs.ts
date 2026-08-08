import { MATCH_MODULE } from './moduleName';
import {
  LEADERBOARD_ID,
  STORAGE_COLLECTION,
  STORAGE_KEY_PROGRESS,
  applyRankedResult,
  clampProgress,
  type RankProgress,
} from './rankedMath';

function readProgress(nk: nkruntime.Nakama, userId: string): RankProgress {
  const objects = nk.storageRead([
    {
      collection: STORAGE_COLLECTION,
      key: STORAGE_KEY_PROGRESS,
      userId,
    },
  ]);
  if (!objects || objects.length === 0 || !objects[0].value) {
    return { rankIndex: 0, rp: 0 };
  }
  const v = objects[0].value as RankProgress;
  return clampProgress({
    rankIndex: Number(v.rankIndex) || 0,
    rp: Number(v.rp) || 0,
  });
}

function writeProgress(
  nk: nkruntime.Nakama,
  userId: string,
  progress: RankProgress,
): void {
  nk.storageWrite([
    {
      collection: STORAGE_COLLECTION,
      key: STORAGE_KEY_PROGRESS,
      userId,
      value: clampProgress(progress),
      permissionRead: 1,
      permissionWrite: 0,
    },
  ]);
}

function accountLabel(nk: nkruntime.Nakama, userId: string): {
  username: string;
  displayName: string;
} {
  const account = nk.accountGetId(userId);
  const username = String(account.user.username || '').trim();
  const displayName = String(
    account.user.displayName || account.user.username || 'Player',
  )
    .trim()
    .slice(0, 24);
  return { username, displayName: displayName || 'Player' };
}

/** Upsert this account onto the global ranked leaderboard immediately. */
export function writeLeaderboardPresence(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  userId: string,
  progress: RankProgress,
  coins = 0,
  extraMeta: { [key: string]: string | boolean | number } = {},
): void {
  const { username, displayName } = accountLabel(nk, userId);
  const score = progress.rankIndex * 1000 + progress.rp;
  try {
    nk.leaderboardRecordWrite(
      LEADERBOARD_ID,
      userId,
      username || displayName,
      score,
      coins,
      {
        name: displayName,
        ...extraMeta,
      },
      undefined,
    );
  } catch (e) {
    logger.warn('leaderboard presence write: %s', e);
  }
}

export function rpcGetProfile(
  ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
): string {
  if (!ctx.userId) throw Error('No user ID');
  const account = nk.accountGetId(ctx.userId);
  return JSON.stringify({
    userId: ctx.userId,
    username: account.user.username,
    displayName: account.user.displayName || account.user.username,
    progress: readProgress(nk, ctx.userId),
  });
}

export function rpcSetDisplayName(
  ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  if (!ctx.userId) throw Error('No user ID');
  let req = { displayName: '' };
  try {
    req = JSON.parse(payload || '{}');
  } catch {
    throw Error('Invalid payload');
  }
  const name = String(req.displayName || '')
    .trim()
    .slice(0, 24);
  if (!name) throw Error('Display name required');
  nk.accountUpdateId(ctx.userId, null, name, null, null, null, null, null);
  return JSON.stringify({ displayName: name });
}

export function rpcGetRanked(
  ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
): string {
  if (!ctx.userId) throw Error('No user ID');
  return JSON.stringify({ progress: readProgress(nk, ctx.userId) });
}

export function rpcMigrateRanked(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  if (!ctx.userId) throw Error('No user ID');
  const existing = readProgress(nk, ctx.userId);
  if (existing.rankIndex > 0 || existing.rp > 0) {
    return JSON.stringify({ progress: existing, migrated: false });
  }
  let req = { rankIndex: 0, rp: 0 };
  try {
    req = JSON.parse(payload || '{}');
  } catch {
    throw Error('Invalid payload');
  }
  const progress = clampProgress({
    rankIndex: Number(req.rankIndex) || 0,
    rp: Number(req.rp) || 0,
  });
  writeProgress(nk, ctx.userId, progress);
  // Do not write the public leaderboard here - anonymous device sessions were
  // creating nameless score-0 rows. Accounts call ensure_leaderboard instead.
  return JSON.stringify({ progress, migrated: true });
}

export function rpcEnsureLeaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  if (!ctx.userId) throw Error('No user ID');
  let req: { displayName?: string } = {};
  try {
    req = JSON.parse(payload || '{}');
  } catch {
    throw Error('Invalid payload');
  }
  const wanted = String(req.displayName || '')
    .trim()
    .slice(0, 24);
  if (wanted) {
    nk.accountUpdateId(ctx.userId, null, wanted, null, null, null, null, null);
  }
  const progress = readProgress(nk, ctx.userId);
  writeLeaderboardPresence(nk, logger, ctx.userId, progress);
  const { username, displayName } = accountLabel(nk, ctx.userId);
  return JSON.stringify({
    ok: true,
    username,
    displayName,
    progress,
  });
}

export function rpcApplyRanked(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  if (!ctx.userId) throw Error('No user ID');
  let req: { won?: boolean; coins?: number; name?: string; avatar?: string } =
    {};
  try {
    req = JSON.parse(payload || '{}');
  } catch {
    throw Error('Invalid payload');
  }
  const prev = readProgress(nk, ctx.userId);
  const result = applyRankedResult(prev, !!req.won);
  writeProgress(nk, ctx.userId, result.progress);
  const label = accountLabel(nk, ctx.userId);
  const name =
    String(req.name || '').trim().slice(0, 24) || label.displayName;
  writeLeaderboardPresence(nk, logger, ctx.userId, result.progress, Number(req.coins) || 0, {
    name,
    avatar: String(req.avatar || '').slice(0, 8),
    won: !!req.won,
  });
  return JSON.stringify({
    progress: result.progress,
    delta: result.delta,
    promoted: result.promoted,
    demoted: result.demoted,
    prevRankIndex: result.prevRankIndex,
  });
}

export function rpcListLeaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  if (!ctx.userId) throw Error('No user ID');
  let limit = 20;
  try {
    const req = JSON.parse(payload || '{}');
    limit = Math.max(1, Math.min(50, Number(req.limit) || 20));
  } catch {
    /* default */
  }
  try {
    const records = nk.leaderboardRecordsList(
      LEADERBOARD_ID,
      undefined,
      limit,
      undefined,
      0,
    );
    return JSON.stringify({
      records: (records.records || []).map((r) => {
        const anyR = r as nkruntime.LeaderboardRecord & { owner_id?: string };
        const meta = (anyR.metadata || {}) as {
          name?: string;
          avatar?: string;
          won?: boolean;
        };
        return {
          ownerId: anyR.ownerId || anyR.owner_id || '',
          username: anyR.username || '',
          score: Number(anyR.score) || 0,
          subscore: Number(anyR.subscore) || 0,
          rank: Number(anyR.rank) || 0,
          metadata: meta,
        };
      }),
      owner: records.ownerRecords || [],
    });
  } catch (e) {
    logger.warn('leaderboard list: %s', e);
    return JSON.stringify({ records: [], owner: [] });
  }
}

export function rpcCreateCustomMatch(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  if (!ctx.userId) throw Error('No user ID');
  let req: {
    mode?: string;
    difficulty?: string;
    custom?: unknown;
  } = {};
  try {
    req = JSON.parse(payload || '{}');
  } catch {
    throw Error('Invalid payload');
  }
  const mode = req.mode === 'duel' ? 'duel' : 'blitz';
  const difficulty =
    req.difficulty === 'chill' ||
    req.difficulty === 'balanced' ||
    req.difficulty === 'ruthless' ||
    req.difficulty === 'mixed'
      ? req.difficulty
      : 'mixed';
  const code = makeRoomCode(nk);
  const params: { [key: string]: string } = {
    mode,
    difficulty,
    queue: 'custom',
    code,
    autoStart: '0',
  };
  if (req.custom) {
    params.custom = JSON.stringify(req.custom);
  }
  const matchId = nk.matchCreate(MATCH_MODULE, params);
  logger.info('create_custom_match code=%s match=%s', code, matchId);
  return JSON.stringify({ matchId, code, mode, difficulty });
}

export function rpcJoinCustomMatch(
  ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  if (!ctx.userId) throw Error('No user ID');
  let code = '';
  try {
    const req = JSON.parse(payload || '{}');
    code = String(req.code || '')
      .trim()
      .toUpperCase();
  } catch {
    throw Error('Invalid payload');
  }
  if (!code) throw Error('Enter a room code');
  const query = `+label.code:${code} +label.open:1`;
  const matches = nk.matchList(10, true, undefined, undefined, 1, query);
  if (!matches || matches.length === 0) {
    throw Error('Room not found or already started');
  }
  return JSON.stringify({
    matchId: matches[0].matchId,
    code,
  });
}

function makeRoomCode(nk: nkruntime.Nakama): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 8; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)]!;
    }
    const existing = nk.matchList(
      1,
      true,
      undefined,
      undefined,
      1,
      `+label.code:${code}`,
    );
    if (!existing || existing.length === 0) return code;
  }
  return nk.uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase();
}
