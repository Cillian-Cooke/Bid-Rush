import { useMemo } from 'react';
import { ExplosionFx } from '../components/ExplosionFx';
import { FxLayer } from '../components/FxLayer';
import { HandSlot } from '../components/HandSlot';
import { PlayerPanel } from '../components/PlayerPanel';
import { RoundClock } from '../components/RoundClock';
import { ShopTile } from '../components/ShopTile';
import { TargetingOverlay } from '../components/TargetingOverlay';
import { CONFIG } from '../game/constants';
import { getItem } from '../game/items';
import {
  fxForHandItem,
  fxForPlayer,
  fxForTile,
  useGameStore,
} from '../store';

export function Game() {
  const game = useGameStore((s) => s.game);
  const targeting = useGameStore((s) => s.targeting);
  const handFocus = useGameStore((s) => s.handFocus);
  const floats = useGameStore((s) => s.floats);
  const activeFx = useGameStore((s) => s.activeFx);
  const bidTile = useGameStore((s) => s.bidTile);
  const sellFocused = useGameStore((s) => s.sellFocused);
  const selectHandItem = useGameStore((s) => s.selectHandItem);
  const cancelTargeting = useGameStore((s) => s.cancelTargeting);
  const selectTargetTile = useGameStore((s) => s.selectTargetTile);
  const selectTargetPlayer = useGameStore((s) => s.selectTargetPlayer);

  const colorById = useMemo(() => {
    const map = new Map<string, string>();
    if (!game) return map;
    for (const p of game.players) map.set(p.id, p.color);
    return map;
  }, [game]);

  if (!game) return null;

  const human = game.players.find((p) => p.id === game.humanId)!;
  const others = game.players.filter((p) => p.id !== game.humanId);

  const leftPlayers = [...others.slice(0, 3), human];
  const rightPlayers = others.slice(3);

  const floatFor = (playerId: string) => {
    const f = floats.filter((x) => x.playerId === playerId).at(-1);
    return f?.text ?? null;
  };

  const targetingPlayers = targeting?.target === 'player';
  const targetingTiles =
    targeting?.target === 'item' || targeting?.target === 'two-items';

  const focusedId = targeting?.instanceId ?? handFocus;
  const inUseMode = !!focusedId;
  const focusedItem = focusedId
    ? human.hand.find((h) => h.instanceId === focusedId)
    : null;

  const handSlots = Array.from({ length: CONFIG.HAND_SLOTS }, (_, i) => {
    return human.hand[i] ?? null;
  });
  const overflowBomb =
    human.hand.length > CONFIG.HAND_SLOTS
      ? human.hand.find((h) => h.itemId === 'bomb' && !handSlots.includes(h))
      : null;

  return (
    <div
      className={`screen game-screen${targeting ? ' targeting-active' : ''}${inUseMode ? ' use-mode' : ''}`}
    >
      <RoundClock ms={game.roundMs} />

      {targeting && (
        <TargetingOverlay targeting={targeting} onCancel={cancelTargeting} />
      )}
      {!targeting && handFocus && focusedItem && (
        <div className="use-mode-banner">
          <span>{getItem(focusedItem.itemId).emoji}</span>
          <span>Sell or tap again to cancel</span>
          <button type="button" className="use-mode-cancel" onClick={cancelTargeting}>
            Cancel
          </button>
        </div>
      )}
      <ExplosionFx />

      <div className="game-board">
        <div className="player-col left">
          {leftPlayers.map((p) => {
            const fx = fxForPlayer(activeFx, p.id);
            // Prefer cast flash for this player (caster), not being a leech/cuff target
            const castFx = activeFx
              .filter((f) => f.kind === 'active_cast' && f.playerId === p.id)
              .at(-1);
            const showFx = castFx ?? fx;
            return (
              <PlayerPanel
                key={p.id}
                player={p}
                isYou={p.id === human.id}
                compact
                targeting={targetingPlayers && p.id !== human.id && p.isAlive}
                floatText={floatFor(p.id)}
                fxKind={showFx?.kind ?? null}
                fxLabel={castFx?.label ?? null}
                onTap={
                  targetingPlayers && p.id !== human.id && p.isAlive
                    ? () => selectTargetPlayer(p.id)
                    : undefined
                }
              />
            );
          })}
        </div>

        <div className="shop-grid">
          <FxLayer activeFx={activeFx} />
          {game.tiles.map((tile) => {
            const bidderColor = tile.highBidderId
              ? (colorById.get(tile.highBidderId) ?? null)
              : null;
            const fx = fxForTile(activeFx, tile.index);
            return (
              <ShopTile
                key={tile.index}
                tile={tile}
                bidderColor={bidderColor}
                isYou={tile.highBidderId === human.id}
                targeting={!!targetingTiles}
                selected={targeting?.selectedTile === tile.index}
                fxKind={fx?.kind ?? null}
                fxLabel={fx?.label}
                onTap={() => {
                  if (targetingTiles) selectTargetTile(tile.index);
                  else if (!targeting) bidTile(tile.index);
                }}
              />
            );
          })}
        </div>

        <div className="player-col right">
          {rightPlayers.map((p) => {
            const fx = fxForPlayer(activeFx, p.id);
            const castFx = activeFx
              .filter((f) => f.kind === 'active_cast' && f.playerId === p.id)
              .at(-1);
            const showFx = castFx ?? fx;
            return (
              <PlayerPanel
                key={p.id}
                player={p}
                isYou={false}
                compact
                targeting={targetingPlayers && p.isAlive}
                floatText={floatFor(p.id)}
                fxKind={showFx?.kind ?? null}
                fxLabel={castFx?.label ?? null}
                onTap={
                  targetingPlayers && p.isAlive
                    ? () => selectTargetPlayer(p.id)
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>

      <div className="hand-bar">
        <span className="hand-label">HAND</span>
        <div className="hand-slots">
          {handSlots.map((item, i) => {
            const fx = item ? fxForHandItem(activeFx, item.instanceId) : null;
            return (
              <HandSlot
                key={item?.instanceId ?? `empty-${i}`}
                item={item}
                selected={!!item && item.instanceId === focusedId}
                fxKind={fx?.kind ?? null}
                onSelect={() => item && selectHandItem(item.instanceId)}
              />
            );
          })}
          {overflowBomb && (
            <HandSlot
              item={overflowBomb}
              selected={overflowBomb.instanceId === focusedId}
              fxKind={fxForHandItem(activeFx, overflowBomb.instanceId)?.kind ?? null}
              onSelect={() => selectHandItem(overflowBomb.instanceId)}
            />
          )}
        </div>
        {inUseMode && (
          <button
            type="button"
            className="sell-fab"
            onClick={sellFocused}
            aria-label="Sell selected item"
          >
            💰
          </button>
        )}
      </div>
    </div>
  );
}
