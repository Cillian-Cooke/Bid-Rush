import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getItem } from '../game/items';
import {
  RANKED_RANKS,
  botWeightPercents,
  getRankDef,
  loadRankProgress,
  loadRankedHistory,
  rankedNewItemsAtRank,
  rankedPoolForRank,
  type RankDef,
} from '../game/ranked';
import { SpriteIcon } from './SpriteIcon';

type Props = { onClose: () => void };
type Tab = 'ladder' | 'items' | 'scores';

export function RankedLeaderboard({ onClose }: Props) {
  const progress = useMemo(() => loadRankProgress(), []);
  const history = useMemo(() => loadRankedHistory(), []);
  const [tab, setTab] = useState<Tab>('ladder');
  const [inspectRank, setInspectRank] = useState(progress.rankIndex);
  const current = getRankDef(progress.rankIndex);
  const bots = botWeightPercents(progress.rankIndex);
  const inspect = getRankDef(inspectRank);
  const inspectNew = rankedNewItemsAtRank(inspectRank);
  const inspectPool = rankedPoolForRank(inspectRank);

  return (
    <div className="codex-overlay" role="dialog" aria-label="Ranked">
      <div className="codex-sheet leaderboard-sheet">
        <div className="codex-head">
          <h2 className="leaderboard-title">
            <SpriteIcon id="trophy" className="leaderboard-title-icon" aria-hidden />
            Ranked
          </h2>
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
              {progress.rp}/{100} RP
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
              ['ladder', 'Ranks'],
              ['items', 'Items'],
              ['scores', 'Scores'],
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

        <div className="ranked-scroll">
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
              {inspectPool.map((id) => {
                const isNew = inspectNew.includes(id);
                return (
                  <li
                    key={id}
                    className={`ranked-item-chip${isNew && inspectRank > 0 ? ' is-new' : ''}`}
                  >
                    <SpriteIcon id={id} className="ranked-item-chip-icon" aria-hidden />
                    {getItem(id).name}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {tab === 'scores' && (
          <>
            <p className="leaderboard-blurb">Best purse scores from Ranked Duels</p>
            {history.length === 0 ? (
              <p className="leaderboard-empty">
                No ranked scores yet. Play Ranked to climb.
              </p>
            ) : (
              <ol className="leaderboard-list">
                {history.map((row, i) => (
                  <li key={row.id} className="leaderboard-row">
                    <span className="leaderboard-place">#{i + 1}</span>
                    <span className="leaderboard-avatar" aria-hidden>
                      {row.avatar}
                    </span>
                    <div className="leaderboard-meta">
                      <span className="leaderboard-name">{row.name}</span>
                      <span className="leaderboard-when">
                        {getRankDef(row.rankId - 1).name}
                        {row.won ? ' · Win' : ' · Loss'}
                      </span>
                    </div>
                    <span className="leaderboard-coins">
                      <SpriteIcon
                        id="coin"
                        className="leaderboard-coin-icon"
                        aria-hidden
                      />
                      {row.coins}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        <div className="ranked-bots-foot">
          <span className="ranked-bots-title">
            Bot odds · {current.name}
          </span>
          <div className="ranked-bots-row">
            <span>Chill {bots.chill}%</span>
            <span>Balanced {bots.balanced}%</span>
            <span>Ruthless {bots.ruthless}%</span>
          </div>
          <p className="ranked-bots-hint">
            Higher ranks face meaner bots more often. Win RP shrinks; loss RP grows.
          </p>
        </div>
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
  const bots = botWeightPercents(rank.id - 1);
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
        <span className="ranked-ladder-bots">
          Bots {bots.chill}/{bots.balanced}/{bots.ruthless}% C/B/R
        </span>
      </div>
    </li>
  );
}
