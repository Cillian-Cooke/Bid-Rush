import { useMemo } from 'react';
import { ExplosionFx } from '../components/ExplosionFx';
import { FxLayer } from '../components/FxLayer';
import { GameChrome } from '../components/GameChrome';
import { HandSlot } from '../components/HandSlot';
import { KnockoutOverlay } from '../components/KnockoutOverlay';
import { PurseStrip } from '../components/PurseStrip';
import { ShopTile } from '../components/ShopTile';
import { SpectateHands } from '../components/SpectateHands';
import { TargetingOverlay } from '../components/TargetingOverlay';
import { CONFIG } from '../game/constants';
import { getItem } from '../game/items';
import type { FxKind } from '../game/types';
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
  const knockoutOffer = useGameStore((s) => s.knockoutOffer);
  const knockoutReason = useGameStore((s) => s.knockoutReason);
  const spectating = useGameStore((s) => s.spectating);
  const phase = useGameStore((s) => s.phase);
  const bidTile = useGameStore((s) => s.bidTile);
  const sellFocused = useGameStore((s) => s.sellFocused);
  const selectHandItem = useGameStore((s) => s.selectHandItem);
  const cancelTargeting = useGameStore((s) => s.cancelTargeting);
  const selectTargetTile = useGameStore((s) => s.selectTargetTile);
  const selectTargetPlayer = useGameStore((s) => s.selectTargetPlayer);
  const reorderHandSlots = useGameStore((s) => s.reorderHandSlots);
  const enterSpectate = useGameStore((s) => s.enterSpectate);
  const replayMatch = useGameStore((s) => s.replayMatch);
  const returnToLobby = useGameStore((s) => s.returnToLobby);

  const colorById = useMemo(() => {
    const map = new Map<string, string>();
    if (!game) return map;
    for (const p of game.players) map.set(p.id, p.color);
    return map;
  }, [game]);

  const fxByPlayer = useMemo(() => {
    const map = new Map<string, { kind: FxKind; label?: string | null }>();
    if (!game) return map;
    for (const p of game.players) {
      const fx = fxForPlayer(activeFx, p.id);
      const castFx = activeFx
        .filter((f) => f.kind === 'active_cast' && f.playerId === p.id)
        .at(-1);
      const show = castFx ?? fx;
      if (show) {
        map.set(p.id, {
          kind: show.kind,
          label: castFx?.label ?? null,
        });
      }
    }
    return map;
  }, [game, activeFx]);

  if (!game) return null;

  const human = game.players.find((p) => p.id === game.humanId)!;
  const others = game.players.filter((p) => p.id !== game.humanId);
  const sd = game.suddenDeath;
  const humanAtRisk =
    sd.active && human.isAlive && human.coins < sd.bracket;

  const floatFor = (playerId: string) => {
    const f = floats.filter((x) => x.playerId === playerId).at(-1);
    return f?.text ?? null;
  };

  const targetingPlayers = targeting?.target === 'player';
  const targetingTiles =
    targeting?.target === 'item' || targeting?.target === 'two-items';

  const focusedId = targeting?.instanceId ?? handFocus;
  const inUseMode = !!focusedId && !spectating && human.isAlive;
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

  const cols = game.gridCols;
  const zoomedOut = knockoutOffer || spectating;
  const dockMotion = [
    'status-dock',
    phase === 'countdown' ? 'dock-pre' : '',
    phase === 'playing' && !knockoutOffer ? 'dock-in' : '',
    knockoutOffer ? 'dock-out' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={[
        'screen',
        'game-screen',
        `mode-${game.mode}`,
        targeting ? 'targeting-active' : '',
        inUseMode ? 'use-mode' : '',
        sd.active ? 'sudden-death-live' : '',
        humanAtRisk ? 'sd-human-risk' : '',
        zoomedOut ? 'knocked-out' : '',
        spectating ? 'spectating' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ['--grid-cols' as string]: cols }}
    >
      <GameChrome
        roundMs={game.roundMs}
        suddenDeath={game.suddenDeath}
        worldEvent={game.worldEvent}
        players={game.players}
      />

      {targeting && (
        <TargetingOverlay targeting={targeting} onCancel={cancelTargeting} />
      )}
      {!targeting && handFocus && focusedItem && human.isAlive && !spectating && (
        <div className="use-mode-banner">
          <span>{getItem(focusedItem.itemId).emoji}</span>
          <span>Sell or tap again to cancel</span>
          <button type="button" className="use-mode-cancel" onClick={cancelTargeting}>
            Cancel
          </button>
        </div>
      )}
      <ExplosionFx />

      <div className="game-main">
        <div className="game-stage">
          <div
            className="shop-grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, var(--tile-size))`,
              gridTemplateRows: `repeat(${cols}, var(--tile-size))`,
            }}
          >
            <FxLayer activeFx={activeFx} gridCols={cols} />
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
                  targeting={!!targetingTiles && human.isAlive && !spectating}
                  selected={targeting?.selectedTile === tile.index}
                  fxKind={fx?.kind ?? null}
                  fxLabel={fx?.label}
                  onTap={() => {
                    if (spectating || knockoutOffer || !human.isAlive) return;
                    if (targetingTiles) selectTargetTile(tile.index);
                    else if (!targeting) bidTile(tile.index);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {!spectating && (
        <div className={dockMotion}>
          <PurseStrip
            human={human}
            others={others}
            mode={game.mode}
            atRisk={humanAtRisk}
            suddenBracket={sd.active ? sd.bracket : null}
            floatText={floatFor(human.id)}
            rivalFloatText={others[0] ? floatFor(others[0].id) : null}
            targetingPlayers={!!targetingPlayers && human.isAlive}
            fxByPlayer={fxByPlayer}
            onSelectPlayer={selectTargetPlayer}
          />
          <div className="hand-bar">
            <span className="hand-label">HAND</span>
            <div className="hand-slots">
              {handSlots.map((item, i) => {
                const fx = item ? fxForHandItem(activeFx, item.instanceId) : null;
                return (
                  <HandSlot
                    key={item?.instanceId ?? `empty-${i}`}
                    item={item}
                    index={i}
                    selected={!!item && item.instanceId === focusedId}
                    fxKind={fx?.kind ?? null}
                    onSelect={() => item && selectHandItem(item.instanceId)}
                    onReorder={reorderHandSlots}
                  />
                );
              })}
              {overflowBomb && (
                <HandSlot
                  item={overflowBomb}
                  index={CONFIG.HAND_SLOTS}
                  selected={overflowBomb.instanceId === focusedId}
                  fxKind={
                    fxForHandItem(activeFx, overflowBomb.instanceId)?.kind ?? null
                  }
                  onSelect={() => selectHandItem(overflowBomb.instanceId)}
                  onReorder={reorderHandSlots}
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
      )}

      {spectating && <SpectateHands players={game.players} />}

      {knockoutOffer && (
        <KnockoutOverlay
          reason={knockoutReason}
          onPlayAgain={replayMatch}
          onSpectate={enterSpectate}
          onMenu={returnToLobby}
        />
      )}
    </div>
  );
}
