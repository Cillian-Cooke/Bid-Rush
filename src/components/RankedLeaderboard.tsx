import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getItem } from '../game/items';
import {
  RANKED_RANKS,
  getRankDef,
  loadRankProgress,
  rankedNewItemsAtRank,
  rankedPoolForRank,
  type RankDef,
} from '../game/ranked';
import {
  fetchNakamaLeaderboard,
  getNakamaProfile,
  type LeaderboardRow,
} from '../net/nakama';
import { SpriteIcon } from './SpriteIcon';

type Props = { onClose: () => void };
type Tab = 'ladder' | 'items' | 'scores';

function boardRankLabel(score: number): string {
  const rankIndex = Math.max(0, Math.min(RANKED_RANKS.length - 1, Math.floor(score / 1000)));
  const rp = score % 1000;
  return `${getRankDef(rankIndex).name} · ${rp} RP`;
}

export function RankedLeaderboard({ onClose }: Props) {
  const progress = useMemo(() => loadRankProgress(), []);
  const [tab, setTab] = useState<Tab>('scores');
  const [inspectRank, setInspectRank] = useState(progress.rankIndex);
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const me = getNakamaProfile();
  const current = getRankDef(progress.rankIndex);
  const inspect = getRankDef(inspectRank);
  const inspectNew = rankedNewItemsAtRank(inspectRank);
  const inspectPool = rankedPoolForRank(inspectRank);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchNakamaLeaderboard(30);
        if (!cancelled) {
          setRows(list);
          setBoardError(null);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setBoardError('Could not load leaderboard');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="codex-overlay leaderboard-overlay" role="dialog" aria-label="Ranked">
      <div className="codex-sheet leaderboard-sheet">
        <div className="codex-head">
          <div>
            <p className="rail-kicker">Standings</p>
            <h2 className="leaderboard-title">
              <SpriteIcon id="trophy" className="leaderboard-title-icon" aria-hidden />
              Ranked
            </h2>
          </div>
          <button
            type="button"
            className="codex-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="ranked-you">
          <div className="ranked-you-top">
            <span className="ranked-you-name">{current.name}</span>
            <span className="ranked-you-rp">
              {progress.rp}/100 RP
            </span>
          </div>
          <div className="ranked-rp-track" aria-hidden>
            <div
              className="ranked-rp-fill"
              style={{ width: `${Math.min(100, progress.rp)}%` }}
            />
          </div>
          <p className="ranked-you-delta">
            Win +{current.winRp} · Loss −{current.lossRp}
          </p>
        </div>

        <div className="ranked-tabs" role="tablist">
          {(
            [
              ['scores', 'Board'],
              ['ladder', 'Ranks'],
              ['items', 'Items'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={tab === id ? 'on' : ''}
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className={`ranked-scroll${tab === 'ladder' ? ' is-ladder' : ''}`}
        >
          {tab === 'scores' && (
            <>
              <p className="leaderboard-blurb">Live global rankings</p>
              {boardError && <p className="online-error">{boardError}</p>}
              {rows == null ? (
                <p className="leaderboard-empty">Loading board…</p>
              ) : rows.length === 0 ? (
                <p className="leaderboard-empty">
                  No players on the board yet. Sign up to appear here.
                </p>
              ) : (
                <ol className="leaderboard-list">
                  {rows.map((row, i) => {
                    const name =
                      row.metadata?.name ||
                      row.username ||
                      'Player';
                    const isYou = me?.userId && row.ownerId === me.userId;
                    const place = row.rank || i + 1;
                    return (
                      <li
                        key={row.ownerId || `${name}-${i}`}
                        className={`leaderboard-row${isYou ? ' is-you' : ''}${place <= 3 ? ` place-${place}` : ''}`}
                      >
                        <span className="leaderboard-place">#{place}</span>
                        <div className="leaderboard-meta">
                          <span className="leaderboard-name">
                            {name}
                            {isYou ? ' · You' : ''}
                          </span>
                          <span className="leaderboard-when">
                            {boardRankLabel(row.score)}
                          </span>
                        </div>
                        <span className="leaderboard-coins" title="Best purse">
                          <SpriteIcon
                            id="coin"
                            className="leaderboard-coin-icon"
                            aria-hidden
                          />
                          {row.subscore || 0}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}

          {tab === 'ladder' && (
            <ol className="ranked-ladder">
              {RANKED_RANKS.map((rank, i) => (
                <RankRow
                  key={rank.id}
                  rank={rank}
                  active={i === progress.rankIndex}
                  unlocked={i <= progress.rankIndex}
                />
              ))}
            </ol>
          )}

          {tab === 'items' && (
            <div className="ranked-items-panel">
              <div className="ranked-items-pick" role="group" aria-label="Rank pool">
                {RANKED_RANKS.map((rank, i) => (
                  <button
                    key={rank.id}
                    type="button"
                    className={`diff-chip${inspectRank === i ? ' selected' : ''}`}
                    onClick={() => setInspectRank(i)}
                  >
                    {rank.name}
                  </button>
                ))}
              </div>
              <p className="leaderboard-blurb">
                {inspect.name}: {inspect.poolSize} unlocked · 16 per match
                {inspectRank > 0
                  ? ` · +${inspectNew.length} new vs ${getRankDef(inspectRank - 1).name}`
                  : ' · starter set'}
              </p>
              {inspectRank > 0 && inspectNew.length > 0 && (
                <div className="ranked-new-block">
                  <span className="ranked-new-label">New this rank</span>
                  <ul className="ranked-item-chips">
                    {inspectNew.map((id) => (
                      <li key={id} className="ranked-item-chip is-new">
                        <SpriteIcon id={id} className="ranked-item-chip-icon" aria-hidden />
                        {getItem(id).name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="ranked-item-chips">
                {inspectPool.map((id) => (
                  <li key={id} className="ranked-item-chip">
                    <SpriteIcon id={id} className="ranked-item-chip-icon" aria-hidden />
                    {getItem(id).name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RankRow({
  rank,
  active,
  unlocked,
}: {
  rank: RankDef;
  active: boolean;
  unlocked: boolean;
}) {
  return (
    <li
      className={[
        'ranked-ladder-row',
        active ? 'is-you' : '',
        unlocked ? '' : 'is-locked',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="ranked-ladder-id">R{rank.id}</span>
      <div className="ranked-ladder-meta">
        <span className="ranked-ladder-name">
          {rank.name}
          {active ? ' · You' : ''}
        </span>
        <span className="ranked-ladder-blurb">
          {rank.poolSize} items · {rank.eventPoolSize} events · Win +{rank.winRp} / Loss −{rank.lossRp}
        </span>
      </div>
    </li>
  );
}
