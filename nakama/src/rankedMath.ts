/** Server-side ranked math - keep in sync with src/game/ranked.ts */

export const RP_PER_RANK = 100;
export const RANK_COUNT = 5;
export const STORAGE_COLLECTION = 'bid_rush';
export const STORAGE_KEY_PROGRESS = 'ranked_progress';
export const LEADERBOARD_ID = 'bid_rush_ranked';

const WIN_RP = [28, 22, 16, 12, 8];
const LOSS_RP = [8, 12, 18, 22, 28];

export interface RankProgress {
  rankIndex: number;
  rp: number;
}

export interface RankMatchResult {
  progress: RankProgress;
  delta: number;
  promoted: boolean;
  demoted: boolean;
  prevRankIndex: number;
  score: number;
}

export function clampProgress(p: RankProgress): RankProgress {
  const rankIndex = Math.max(
    0,
    Math.min(RANK_COUNT - 1, Math.floor(p.rankIndex) || 0),
  );
  let rp = Math.max(0, Math.min(RP_PER_RANK, Math.floor(p.rp) || 0));
  if (rankIndex === RANK_COUNT - 1) {
    rp = Math.max(0, Math.min(RP_PER_RANK, rp));
  }
  return { rankIndex, rp };
}

export function applyRankedResult(
  prev: RankProgress,
  won: boolean,
): RankMatchResult {
  const before = clampProgress(prev);
  const prevRankIndex = before.rankIndex;
  const winRp = WIN_RP[before.rankIndex] || 8;
  const lossRp = LOSS_RP[before.rankIndex] || 28;
  let rankIndex = before.rankIndex;
  let rp = before.rp + (won ? winRp : -lossRp);
  let promoted = false;
  let demoted = false;

  while (rp >= RP_PER_RANK && rankIndex < RANK_COUNT - 1) {
    rankIndex += 1;
    rp -= RP_PER_RANK;
    promoted = true;
  }
  while (rp < 0 && rankIndex > 0) {
    rankIndex -= 1;
    rp += RP_PER_RANK;
    demoted = true;
  }
  if (rankIndex === 0) rp = Math.max(0, rp);
  if (rankIndex === RANK_COUNT - 1) {
    rp = Math.max(0, Math.min(RP_PER_RANK, rp));
  }

  const progress = { rankIndex, rp };
  const delta = won ? winRp : -lossRp;
  const score = rankIndex * 1000 + rp;
  return { progress, delta, promoted, demoted, prevRankIndex, score };
}
