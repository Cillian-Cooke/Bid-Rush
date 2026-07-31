import { useEffect, useRef, useState } from 'react';
import type { FxKind, GameMode, Player } from '../game/types';

type Props = {
  human: Player;
  others: Player[];
  mode: GameMode;
  atRisk: boolean;
  suddenBracket: number | null;
  floatText?: string | null;
  rivalFloatText?: string | null;
  targetingPlayers: boolean;
  fxByPlayer: Map<string, { kind: FxKind; label?: string | null }>;
  onSelectPlayer: (playerId: string) => void;
};

function coinHeat(coins: number): string {
  if (coins <= 3) return 'heat-critical';
  if (coins <= 8) return 'heat-low';
  if (coins < 100) return 'heat-warm';
  // Milestone awards every 100 — rainbow is the late crown
  if (coins < 200) return 'heat-century'; // 100+
  if (coins < 300) return 'heat-double'; // 200+
  if (coins < 400) return 'heat-triple'; // 300+
  if (coins < 500) return 'heat-quad'; // 400+
  return 'heat-rainbow'; // 500+
}

function AnimatedPurse({
  coins,
  atRisk,
  name,
  avatar,
  floatText,
}: {
  coins: number;
  atRisk: boolean;
  name: string;
  avatar: string;
  floatText?: string | null;
}) {
  const prev = useRef(coins);
  const shownRef = useRef(coins);
  const [shown, setShown] = useState(coins);
  const [delta, setDelta] = useState<number | null>(null);
  const [punch, setPunch] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (coins === prev.current) return;
    const diff = coins - prev.current;
    const from = shownRef.current;
    setDelta(diff);
    setPunch(diff > 0 ? 'up' : 'down');
    prev.current = coins;

    const to = coins;
    const start = performance.now();
    const dur = 380;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (to - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const clearPunch = window.setTimeout(() => setPunch(null), 420);
    const clearDelta = window.setTimeout(() => setDelta(null), 700);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(clearPunch);
      window.clearTimeout(clearDelta);
    };
  }, [coins]);

  return (
    <div
      className={[
        'purse',
        coinHeat(coins),
        atRisk ? 'at-risk' : '',
        punch ? `punch-${punch}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`Your coins: ${coins}`}
    >
      <div className="purse-who">
        <span className="purse-avatar">{avatar}</span>
        <div className="purse-who-meta">
          <span className="purse-kicker">You</span>
          <span className="purse-name">{name}</span>
        </div>
      </div>
      <div className="purse-amount">
        <span className="purse-glyph" aria-hidden>
          🪙
        </span>
        <span className="purse-value">{shown}</span>
      </div>
      {delta != null && (
        <span className={`purse-delta ${delta > 0 ? 'gain' : 'loss'}`}>
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
      {floatText && <span className="purse-float">{floatText}</span>}
    </div>
  );
}

function ScoreChip({
  player,
  rank,
  leading,
  atRisk,
  targeting,
  floatText,
  fxLabel,
  showName,
  onTap,
}: {
  player: Player;
  rank?: number;
  leading?: boolean;
  atRisk: boolean;
  targeting: boolean;
  floatText?: string | null;
  fxLabel?: string | null;
  showName: boolean;
  onTap?: () => void;
}) {
  const bomb = player.hand.find((h) => h.itemId === 'bomb');
  const fuseSec =
    bomb?.bombFuseMs != null ? Math.ceil(bomb.bombFuseMs / 1000) : null;
  const className = [
    'score-chip',
    showName ? '' : 'anon',
    !player.isAlive ? 'dead' : '',
    leading ? 'leading' : '',
    atRisk ? 'at-risk' : '',
    targeting ? 'targetable' : '',
    player.handcuffMs > 0 ? 'cuffed' : '',
    fuseSec != null ? 'has-bomb' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {rank != null && <span className="score-rank">#{rank}</span>}
      <span className="score-avatar">{fxLabel || player.avatar}</span>
      {showName && <span className="score-name">{player.name}</span>}
      <span className="score-coins">🪙{player.coins}</span>
      {player.handcuffMs > 0 && <span className="score-badge">🔒</span>}
      {fuseSec != null && <span className="score-badge">💣{fuseSec}</span>}
      {!player.isAlive && <span className="score-out">OUT</span>}
      {floatText && <span className="score-float">{floatText}</span>}
    </>
  );

  if (onTap) {
    return (
      <button
        type="button"
        className={className}
        style={{ ['--player-color' as string]: player.color }}
        onClick={onTap}
        disabled={!player.isAlive}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={className}
      style={{ ['--player-color' as string]: player.color }}
    >
      {inner}
    </div>
  );
}

export function PurseStrip({
  human,
  others,
  mode,
  atRisk,
  suddenBracket,
  floatText,
  rivalFloatText,
  targetingPlayers,
  fxByPlayer,
  onSelectPlayer,
}: Props) {
  const ranked = [...others, human].sort((a, b) => {
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    return b.coins - a.coins;
  });

  return (
    <div className={`purse-strip mode-${mode}`}>
      <AnimatedPurse
        coins={human.coins}
        atRisk={atRisk}
        name={human.name}
        avatar={human.avatar}
        floatText={floatText}
      />

      {mode === 'duel' ? (
        others[0] && (
          <div className="purse-rival">
            <span className="purse-vs">Rival</span>
            <ScoreChip
              player={others[0]}
              showName
              leading={others[0].isAlive && others[0].coins > human.coins}
              atRisk={
                !!suddenBracket &&
                others[0].isAlive &&
                others[0].coins < suddenBracket
              }
              targeting={targetingPlayers && others[0].isAlive}
              floatText={rivalFloatText}
              fxLabel={
                fxByPlayer.get(others[0].id)?.kind === 'active_cast'
                  ? fxByPlayer.get(others[0].id)?.label
                  : null
              }
              onTap={
                targetingPlayers
                  ? () => onSelectPlayer(others[0]!.id)
                  : undefined
              }
            />
          </div>
        )
      ) : (
        <div className="purse-board" aria-label="Scoreboard">
          {ranked.map((p, i) => {
            const canTarget =
              targetingPlayers && p.id !== human.id && p.isAlive;
            const fx = fxByPlayer.get(p.id);
            return (
              <ScoreChip
                key={p.id}
                player={p}
                showName={false}
                rank={p.isAlive ? i + 1 : undefined}
                leading={i === 0 && p.isAlive}
                atRisk={
                  !!suddenBracket && p.isAlive && p.coins < suddenBracket
                }
                targeting={canTarget}
                fxLabel={fx?.kind === 'active_cast' ? fx.label : null}
                onTap={canTarget ? () => onSelectPlayer(p.id) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
