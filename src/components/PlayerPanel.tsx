import type { FxKind } from '../game/types';
import type { Player } from '../game/types';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  player: Player;
  isYou: boolean;
  compact?: boolean;
  targeting?: boolean;
  floatText?: string | null;
  fxKind?: FxKind | null;
  /** Emoji shown when this player just cast an active item */
  fxLabel?: string | null;
  /** Sudden-death: under the current bracket */
  atRisk?: boolean;
  onTap?: () => void;
};

const PANEL_FX_SPRITE: Partial<Record<FxKind, string>> = {
  gold_spark: 'gilder',
  print: 'bank_note',
  goose: 'star',
  dividend: 'stock_market',
  piggy: 'coin',
  mystery_sell: 'mystery_box',
  leech: 'coin_leech',
  cuffs: 'lock_status',
  pickpocket: 'pickpocket',
  heist: 'heist_kit',
  quick_swap: 'quick_swap',
  bomb_fuse: 'bomb',
  event_money: 'money_bag',
  event_tax: 'receipt',
  event_shower: 'coin',
};

export function PlayerPanel({
  player,
  isYou,
  compact,
  targeting,
  floatText,
  fxKind,
  fxLabel,
  atRisk,
  onTap,
}: Props) {
  const bomb = player.hand.find((h) => h.itemId === 'bomb');
  const fuseSec =
    bomb?.bombFuseMs != null ? Math.ceil(bomb.bombFuseMs / 1000) : null;

  const casting = fxKind === 'active_cast' && !!fxLabel;
  const displayAvatar = casting ? fxLabel! : player.avatar;

  const className = [
    'player-panel',
    isYou ? 'you' : '',
    !player.isAlive ? 'dead' : '',
    compact ? 'compact' : '',
    targeting ? 'targetable' : '',
    player.handcuffMs > 0 ? 'cuffed' : '',
    fuseSec != null ? 'has-bomb' : '',
    atRisk ? 'sd-at-risk' : '',
    fxKind ? `fx-panel fx-${fxKind}` : '',
    casting ? 'casting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {isYou && <span className="you-tag">YOU</span>}
      <span className={`player-avatar${casting ? ' cast-swap' : ''}`}>
        <SpriteIcon id={displayAvatar} aria-hidden />
      </span>
      <div className="player-meta">
        <span className="player-name">{player.name}</span>
        <span className="player-coins">
          <SpriteIcon id="coin" className="inline-sprite" aria-hidden />{' '}
          {player.coins}
        </span>
      </div>
      {player.handcuffMs > 0 && (
        <span className="status-badge" title="Handcuffed">
          <SpriteIcon id="lock_status" aria-hidden />
        </span>
      )}
      {fuseSec != null && (
        <span className="bomb-fuse" title="Bomb fuse">
          <SpriteIcon id="bomb" aria-hidden /> {fuseSec}s
        </span>
      )}
      {!player.isAlive && <span className="eliminated-badge">OUT</span>}
      {floatText && (
        <span
          className={`float-text${
            floatText.startsWith('-')
              ? ' loss'
              : floatText.includes('SOLD')
                ? ' sold'
                : ''
          }`}
        >
          {floatText}
        </span>
      )}
      {fxKind && fxKind !== 'active_cast' && (
        <span className="panel-fx-burst" aria-hidden>
          <SpriteIcon id={PANEL_FX_SPRITE[fxKind] ?? 'star'} aria-hidden />
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
