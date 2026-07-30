import { buildRanking } from '../game/engine';
import { getItem } from '../game/items';
import { useGameStore } from '../store';

export function Results() {
  const game = useGameStore((s) => s.game);
  const returnToLobby = useGameStore((s) => s.returnToLobby);

  if (!game) return null;

  const ranking = buildRanking(game);

  return (
    <div className="screen results-screen">
      <h1 className="results-title">Results</h1>
      <p className="results-sub">Hands revealed</p>

      <ol className="ranking-list">
        {ranking.map(({ player, place, isWinner }) => (
          <li
            key={player.id}
            className={`rank-card${isWinner ? ' winner' : ''}`}
            style={{ ['--player-color' as string]: player.color }}
          >
            <div className="rank-header">
              <span className="rank-place">#{place}</span>
              <span className="rank-avatar">{player.avatar}</span>
              <div className="rank-info">
                <span className="rank-name">
                  {player.name}
                  {isWinner && ' 👑'}
                  {player.isHuman && ' (You)'}
                </span>
                <span className="rank-coins">💰 {player.coins}</span>
              </div>
            </div>
            <div className="rank-hand">
              {player.hand.length === 0 ? (
                <span className="empty-hand">Empty hand</span>
              ) : (
                player.hand.map((h) => (
                  <span key={h.instanceId} className="rank-item" title={getItem(h.itemId).name}>
                    {getItem(h.itemId).emoji}
                  </span>
                ))
              )}
            </div>
          </li>
        ))}
      </ol>

      <button type="button" className="btn primary" onClick={returnToLobby}>
        Play Again
      </button>
    </div>
  );
}
