import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { FxKind, GameMode, Player } from '../game/types';
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
  onSelectPlayer: (playerId: string) => void;
};

type RGB = readonly [number, number, number];

const COIN_COLORS = {
  critical: [255, 77, 61] as RGB,
  low: [255, 122, 69] as RGB,
  warm: [232, 184, 74] as RGB,
  green: [30, 207, 108] as RGB,
  blue: [47, 127, 255] as RGB,
  violet: [168, 85, 247] as RGB,
  amber: [255, 138, 40] as RGB,
} as const;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  const u = Math.max(0, Math.min(1, t));
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
}

/** Ease-in so the shift is gentle early and stronger near the milestone. */
function easeTowardMilestone(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u;
}

type CoinTint = {
  mode: 'solid' | 'rainbow';
  rgb: RGB;
  glow: number;
  critical: boolean;
  /** True at exact milestone hits for a firmer “award” feel */
  solidAward: boolean;
};

function coinTint(coins: number): CoinTint {
  const n = Math.max(0, coins);

  if (n <= 3) {
    return { mode: 'solid', rgb: COIN_COLORS.critical, glow: 0, critical: true, solidAward: false };
  }
  if (n < 8) {
    return {
      mode: 'solid',
      rgb: lerpRgb(COIN_COLORS.critical, COIN_COLORS.low, (n - 3) / 5),
      glow: 0,
      critical: false,
      solidAward: false,
    };
  }
  if (n < 50) {
    return {
      mode: 'solid',
      rgb: lerpRgb(COIN_COLORS.low, COIN_COLORS.warm, (n - 8) / 42),
      glow: 0,
      critical: false,
      solidAward: false,
    };
  }
  // 50 → 100: drift warm → green; solid green at 100
  if (n < 100) {
    const t = easeTowardMilestone((n - 50) / 50);
    return {
      mode: 'solid',
      rgb: lerpRgb(COIN_COLORS.warm, COIN_COLORS.green, t),
      glow: t * 0.55,
      critical: false,
      solidAward: false,
    };
  }
  if (n === 100) {
    return {
      mode: 'solid',
      rgb: COIN_COLORS.green,
      glow: 0.85,
      critical: false,
      solidAward: true,
    };
  }
  // 100 → 200: green → blue; solid blue at 200
  if (n < 200) {
    const t = easeTowardMilestone((n - 100) / 100);
    return {
      mode: 'solid',
      rgb: lerpRgb(COIN_COLORS.green, COIN_COLORS.blue, t),
      glow: 0.55 + t * 0.25,
      critical: false,
      solidAward: false,
    };
  }
  if (n === 200) {
    return {
      mode: 'solid',
      rgb: COIN_COLORS.blue,
      glow: 0.9,
      critical: false,
      solidAward: true,
    };
  }
  if (n < 300) {
    const t = easeTowardMilestone((n - 200) / 100);
    return {
      mode: 'solid',
      rgb: lerpRgb(COIN_COLORS.blue, COIN_COLORS.violet, t),
      glow: 0.55 + t * 0.25,
      critical: false,
      solidAward: false,
    };
  }
  if (n === 300) {
    return {
      mode: 'solid',
      rgb: COIN_COLORS.violet,
      glow: 0.9,
      critical: false,
      solidAward: true,
    };
  }
  if (n < 400) {
    const t = easeTowardMilestone((n - 300) / 100);
    return {
      mode: 'solid',
      rgb: lerpRgb(COIN_COLORS.violet, COIN_COLORS.amber, t),
      glow: 0.55 + t * 0.25,
      critical: false,
      solidAward: false,
    };
  }
  if (n < 500) {
    // Hold amber award, then open into rainbow territory near 500
    const t = easeTowardMilestone((n - 400) / 100);
    return {
      mode: 'solid',
      rgb: COIN_COLORS.amber,
      glow: 0.7 + t * 0.25,
      critical: false,
      solidAward: n === 400,
    };
  }
  return {
    mode: 'rainbow',
    rgb: COIN_COLORS.amber,
    glow: 1,
    critical: false,
    solidAward: true,
  };
}

function AnimatedPurse({
  coins,
  atRisk,
  name,
  avatar,
  floatText,
  player,
  activeFx,
  coldMarketMs,
}: {
  coins: number;
  atRisk: boolean;
  name: string;
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
  const valueStyle =
    tint.mode === 'rainbow'
      ? undefined
      : {
          color: `rgb(${r}, ${g}, ${b})`,
          textShadow:
            tint.glow > 0.05
              ? `0 0 ${5 + tint.glow * 10}px rgba(${r}, ${g}, ${b}, ${0.25 + tint.glow * 0.55})`
              : undefined,
        };

  return (
    <div
      className={[
        'purse',
        tint.mode === 'rainbow' ? 'heat-rainbow' : '',
        tint.critical ? 'heat-critical' : '',
        tint.solidAward ? 'heat-award' : '',
        atRisk ? 'at-risk' : '',
        punch ? `punch-${punch}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        tint.mode === 'solid'
          ? ({
              ['--purse-tint' as string]: `rgb(${r}, ${g}, ${b})`,
            } as CSSProperties)
          : undefined
      }
      aria-label={`Your coins: ${coins}`}
    >
      <div className="purse-main">
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
          <span className="purse-value" style={valueStyle}>
            {shown}
          </span>
        </div>
        {delta != null && (
          <span className={`purse-delta ${delta > 0 ? 'gain' : 'loss'}`}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
        {floatText && <span className="purse-float">{floatText}</span>}
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
      <span className="score-coins">
        {showName ? `🪙${player.coins}` : player.coins}
      </span>
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
  activeFx,
  coldMarketMs,
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
        player={human}
        activeFx={activeFx}
        coldMarketMs={coldMarketMs}
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
