import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { coinTint, heatClassName } from '../game/coinHeat';
import { getItem, quickSwapMarkedIds } from '../game/items';
import type { FxKind, GameMode, PendingQuickSwap, Player } from '../game/types';
import type { FxInstance } from '../store';
import { PurseEffects } from './PurseEffects';

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
  activeFx: FxInstance[];
  coldMarketMs?: number;
  pendingQuickSwaps: PendingQuickSwap[];
  onSelectPlayer: (playerId: string) => void;
  /** Mobile dock shows both; desktop splits purse vs scoreboard. */
  sections?: 'all' | 'purse' | 'board';
  /** Vertical named standings for the desktop rail. */
  rail?: boolean;
};

function AnimatedPurse({
  coins,
  atRisk,
  avatar,
  floatText,
  player,
  activeFx,
  coldMarketMs,
}: {
  coins: number;
  atRisk: boolean;
  name?: string;
  avatar: string;
  floatText?: string | null;
  player: Player;
  activeFx: FxInstance[];
  coldMarketMs?: number;
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

  const tint = coinTint(shown);
  const [r, g, b] = tint.rgb;
  const shakeMs = Math.max(0.08, 0.62 - tint.shake * 0.52);
  const shakeX = (1 + tint.shake * 7).toFixed(2);
  const shakeY = (0.5 + tint.shake * 3.5).toFixed(2);
  const shakeR = (0.3 + tint.shake * 3.2).toFixed(2);
  const shakeS = (tint.shake * 0.1).toFixed(3);
  const rainbowDur = `${(2.8 / Math.max(0.35, tint.rainbowSpeed)).toFixed(2)}s`;

  const heatVars = {
    ['--purse-tint' as string]: `rgb(${r}, ${g}, ${b})`,
    ['--heat-shake' as string]: tint.shake.toFixed(3),
    ['--heat-shake-ms' as string]: `${shakeMs.toFixed(2)}s`,
    ['--heat-shake-x' as string]: `${shakeX}px`,
    ['--heat-shake-y' as string]: `${shakeY}px`,
    ['--heat-shake-r' as string]: `${shakeR}deg`,
    ['--heat-shake-s' as string]: shakeS,
    ['--rainbow-speed' as string]: rainbowDur,
    ['--rainbow-mix' as string]: tint.rainbowMix.toFixed(3),
    ['--heat-glow' as string]: tint.glow.toFixed(3),
    ['--heat-award' as string]: tint.award.toFixed(3),
  } as CSSProperties;

  const valueStyle: CSSProperties =
    tint.mode === 'solid'
      ? {
          color: `rgb(${r}, ${g}, ${b})`,
          textShadow:
            tint.glow > 0.05
              ? `0 0 ${5 + tint.glow * 10}px rgba(${r}, ${g}, ${b}, ${0.25 + tint.glow * 0.55})`
              : undefined,
        }
      : {};

  return (
    <div
      className={[
        'purse',
        heatClassName(tint),
        atRisk ? 'at-risk' : '',
        punch ? `punch-${punch}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={heatVars}
      aria-label={`Your coins: ${coins}`}
      title={tint.stage}
    >
      <div className="purse-main">
        <div className="purse-who">
          <span className="purse-avatar">{avatar}</span>
          <div className="purse-who-meta">
            <span className="purse-kicker">You</span>
          </div>
        </div>
        <div className="purse-amount">
          <span className="purse-value" style={valueStyle}>
            {shown}
          </span>
          {delta != null && (
            <span className={`purse-delta ${delta > 0 ? 'gain' : 'loss'}`}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
          {floatText && (
            <span
              className={`purse-float${
                floatText.startsWith('-')
                  ? ' loss'
                  : floatText.startsWith('+')
                    ? ' gain'
                    : ''
              }`}
            >
              {floatText}
            </span>
          )}
        </div>
      </div>
      <PurseEffects
        player={player}
        activeFx={activeFx}
        coldMarketMs={coldMarketMs}
      />
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
  swapMarks,
  swapSec,
  onTap,
}: {
  player: Player;
  rank?: number;
  leading?: boolean;
  atRisk: boolean;
  targeting: boolean;
  floatText?: string | null;
  fxLabel?: string | null;
  showName?: boolean;
  swapMarks?: { emoji: string; golden: boolean }[];
  swapSec?: number | null;
  onTap?: () => void;
}) {
  const bomb = player.hand.find((h) => h.itemId === 'bomb');
  const fuseSec =
    bomb?.bombFuseMs != null ? Math.ceil(bomb.bombFuseMs / 1000) : null;
  const className = [
    'score-chip',
    'anon',
    !player.isAlive ? 'dead' : '',
    leading ? 'leading' : '',
    atRisk ? 'at-risk' : '',
    targeting ? 'targetable' : '',
    player.handcuffMs > 0 ? 'cuffed' : '',
    fuseSec != null ? 'has-bomb' : '',
    swapMarks && swapMarks.length > 0 ? 'has-quick-swap' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {rank != null && <span className="score-rank">#{rank}</span>}
      <span className="score-avatar">{fxLabel || player.avatar}</span>
      <span className="score-coins">{player.coins}</span>
      {player.handcuffMs > 0 && <span className="score-badge">🔒</span>}
      {fuseSec != null && <span className="score-badge">💣{fuseSec}</span>}
      {swapMarks && swapMarks.length > 0 && (
        <span className="score-swap-marks" aria-label="Quick Swap pending">
          {swapMarks.slice(0, 3).map((m, i) => (
            <span
              key={`${m.emoji}-${i}`}
              className={`score-swap-mark${m.golden ? ' golden' : ''}`}
            >
              {m.emoji}
            </span>
          ))}
          {swapMarks.length > 3 && (
            <span className="score-swap-mark more">+{swapMarks.length - 3}</span>
          )}
          {swapSec != null && (
            <span className="score-swap-sec">{swapSec}s</span>
          )}
        </span>
      )}
      {!player.isAlive && <span className="score-out">OUT</span>}
      {floatText && (
        <span
          className={`score-float${
            floatText.startsWith('-')
              ? ' loss'
              : floatText.startsWith('+')
                ? ' gain'
                : ''
          }`}
        >
          {floatText}
        </span>
      )}
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
  activeFx,
  coldMarketMs,
  pendingQuickSwaps,
  onSelectPlayer,
  sections = 'all',
  rail = false,
}: Props) {
  const ranked = [...others, human].sort((a, b) => {
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    return b.coins - a.coins;
  });

  const swapPreview = (p: Player) => {
    const mark = quickSwapMarkedIds(pendingQuickSwaps, p.hand, p.id);
    if (mark.ids.size === 0) return { marks: [], sec: null as number | null };
    const marks = p.hand
      .filter((h) => mark.ids.has(h.instanceId))
      .map((h) => ({ emoji: getItem(h.itemId).emoji, golden: h.golden }));
    const sec =
      mark.msLeft != null ? Math.ceil(mark.msLeft / 1000) : null;
    return { marks, sec };
  };

  const showPurse = sections === 'all' || sections === 'purse';
  const showBoard = sections === 'all' || sections === 'board';

  return (
    <div
      className={[
        'purse-strip',
        `mode-${mode}`,
        rail ? 'rail-standings' : '',
        sections !== 'all' ? `sections-${sections}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showPurse && (
        <AnimatedPurse
          coins={human.coins}
          atRisk={atRisk}
          name={human.name}
          avatar={human.avatar}
          floatText={floatText}
          player={human}
          activeFx={activeFx}
          coldMarketMs={coldMarketMs}
        />
      )}

      {showBoard && (rail || mode !== 'duel') && (
        <div className="purse-board" aria-label="Scoreboard">
          {ranked.map((p, i) => {
            const canTarget =
              targetingPlayers && p.id !== human.id && p.isAlive;
            const fx = fxByPlayer.get(p.id);
            const preview =
              p.id === human.id ? { marks: [], sec: null } : swapPreview(p);
            return (
              <ScoreChip
                key={p.id}
                player={p}
                showName={rail}
                rank={p.isAlive ? i + 1 : undefined}
                leading={i === 0 && p.isAlive}
                atRisk={
                  !!suddenBracket && p.isAlive && p.coins < suddenBracket
                }
                targeting={canTarget}
                fxLabel={fx?.kind === 'active_cast' ? fx.label : null}
                swapMarks={preview.marks}
                swapSec={preview.sec}
                onTap={canTarget ? () => onSelectPlayer(p.id) : undefined}
              />
            );
          })}
        </div>
      )}

      {showBoard && !rail && mode === 'duel' && others[0] && (
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
            swapMarks={swapPreview(others[0]).marks}
            swapSec={swapPreview(others[0]).sec}
            onTap={
              targetingPlayers
                ? () => onSelectPlayer(others[0]!.id)
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
