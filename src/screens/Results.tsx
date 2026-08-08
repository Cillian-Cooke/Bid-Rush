import type { CSSProperties } from 'react';
import { SpriteIcon } from '../components/SpriteIcon';
import { coinTint } from '../game/coinHeat';
import { MODE_SETUP } from '../game/constants';
import { buildRanking } from '../game/engine';
import { getItem } from '../game/items';
import { useGameStore } from '../store';

export function Results() {
  const game = useGameStore((s) => s.game);
  const knockoutReport = useGameStore((s) => s.knockoutReport);
  const returnToLobby = useGameStore((s) => s.returnToLobby);

  if (!game) return null;

  const ranking = buildRanking(game);
  const champ = ranking.find((r) => r.isWinner) ?? ranking[0] ?? null;
  const modeLabel = MODE_SETUP[game.mode]?.label ?? 'Match';
  const youWon = champ?.player.isHuman ?? false;
  const human = game.players.find((p) => p.isHuman);
  const deathReport = human?.deathReport ?? knockoutReport;
  const showDeath = !!human && !human.isAlive && !!deathReport;

  return (
    <div className="screen results-screen">
      <header className="results-top">
        <div className="results-top-row">
          <span className="results-kicker">Auction closed</span>
          <span className="results-mode-tag">{modeLabel}</span>
        </div>
        <h1 className="results-title">
          {champ
            ? youWon
              ? 'You take the floor'
              : `${champ.player.name} wins`
            : 'Floor settled'}
        </h1>
      </header>

      {champ && (
        <div
          className={`results-winner${youWon ? ' is-you' : ''}`}
          style={{ ['--player-color' as string]: champ.player.color }}
        >
          <span className="results-winner-place">#1</span>
          <span className="results-winner-avatar" aria-hidden>
            {champ.player.avatar}
          </span>
          <div className="results-winner-meta">
            <span className="results-winner-name">
              {champ.player.name}
              {youWon ? ' · You' : ''}
            </span>
            <ChampCoins coins={champ.player.coins} />
          </div>
        </div>
      )}

      {showDeath && deathReport && (
        <div className="results-death" role="status">
          <span className="results-death-kicker">How you went out</span>
          <p className="results-death-line">{deathReport.headline}</p>
          <ul className="death-trail">
            {deathReport.swings.map((s, i) => (
              <li key={`${s.label}-${i}`} className="death-trail-row">
                <span className="death-trail-emoji" aria-hidden>
                  {s.emoji}
                </span>
                <span className="death-trail-label">{s.label}</span>
                {s.delta !== 0 && (
                  <span
                    className={`death-trail-delta${s.delta < 0 ? ' neg' : ' pos'}`}
                  >
                    {s.delta > 0 ? `+${s.delta}` : s.delta}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="ranking-list">
        {ranking.map(({ player, place, isWinner }) => {
          const tint = coinTint(player.coins);
          const [r, g, b] = tint.rgb;
          return (
            <li
              key={player.id}
              className={[
                'rank-card',
                isWinner ? 'winner' : '',
                !player.isAlive ? 'eliminated' : '',
                player.isHuman ? 'is-you' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                {
                  ['--player-color' as string]: player.color,
                } as CSSProperties
              }
            >
              <div className="rank-header">
                <span className="rank-place">#{place}</span>
                <span className="rank-avatar">{player.avatar}</span>
                <div className="rank-info">
                  <span className="rank-name">
                    {player.name}
                    {player.isHuman ? ' · You' : ''}
                  </span>
                  <span
                    className="rank-coins"
                    style={
                      tint.rainbowMix >= 0.5
                        ? undefined
                        : { color: `rgb(${r}, ${g}, ${b})` }
                    }
                  >
                    <SpriteIcon id="coin" className="rank-coin-icon" aria-hidden />
                    {player.coins}
                  </span>
                </div>
                {!player.isAlive && <span className="rank-out">Out</span>}
              </div>
              <div className="rank-hand">
                {player.hand.length === 0 ? (
                  <span className="empty-hand">Empty hand</span>
                ) : (
                  player.hand.map((h) => {
                    const def = getItem(h.itemId);
                    return (
                      <span
                        key={h.instanceId}
                        className={`rank-item${h.golden ? ' golden' : ''}`}
                        title={`${def.name}${h.golden ? ' (Golden)' : ''}`}
                      >
                        {def.emoji}
                      </span>
                    );
                  })
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="results-footer">
        <button type="button" className="btn primary results-again" onClick={returnToLobby}>
          Play again
        </button>
      </div>
    </div>
  );
}

function ChampCoins({ coins }: { coins: number }) {
  const tint = coinTint(coins);
  const [r, g, b] = tint.rgb;
  const rainbow = tint.rainbowMix >= 0.5;
  return (
    <span
      className={`results-winner-coins${rainbow ? ' rainbow' : ''}`}
      style={
        rainbow
          ? undefined
          : {
              color: `rgb(${r}, ${g}, ${b})`,
              textShadow:
                tint.glow > 0.2
                  ? `0 0 12px rgba(${r}, ${g}, ${b}, 0.45)`
                  : undefined,
            }
      }
    >
      <SpriteIcon id="coin" className="results-champ-coin" aria-hidden />
      {coins}
    </span>
  );
}
