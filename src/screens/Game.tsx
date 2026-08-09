import { useMemo, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { ExplosionFx } from '../components/ExplosionFx';
import { FxLayer } from '../components/FxLayer';
import { GameChrome } from '../components/GameChrome';
import { HandSlot } from '../components/HandSlot';
import { KnockoutOverlay } from '../components/KnockoutOverlay';
import { MatchPoolPanel } from '../components/MatchPoolPanel';
import { PoolToggleButton } from '../components/PoolToggleButton';
import { PurseStrip } from '../components/PurseStrip';
import { ShopTile } from '../components/ShopTile';
import { SpectateHands } from '../components/SpectateHands';
import { SpriteIcon } from '../components/SpriteIcon';
import { TargetingOverlay } from '../components/TargetingOverlay';
import { CONFIG } from '../game/constants';
import { canInstantUse, quickSwapMarkedIds } from '../game/items';
import { rankThemeClass } from '../game/ranked';
import { getWorldEvent } from '../game/worldEvents';
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
  const knockoutReport = useGameStore((s) => s.knockoutReport);
  const spectating = useGameStore((s) => s.spectating);
  const phase = useGameStore((s) => s.phase);
  const poolRevealOpen = useGameStore((s) => s.poolRevealOpen);
  const openPoolReveal = useGameStore((s) => s.openPoolReveal);
  const closePoolReveal = useGameStore((s) => s.closePoolReveal);
  const bidTile = useGameStore((s) => s.bidTile);
  const sellFocused = useGameStore((s) => s.sellFocused);
  const useFocused = useGameStore((s) => s.useFocused);
  const selectHandItem = useGameStore((s) => s.selectHandItem);
  const cancelTargeting = useGameStore((s) => s.cancelTargeting);
  const selectTargetTile = useGameStore((s) => s.selectTargetTile);
  const selectTargetPlayer = useGameStore((s) => s.selectTargetPlayer);
  const reorderHandSlots = useGameStore((s) => s.reorderHandSlots);
  const enterSpectate = useGameStore((s) => s.enterSpectate);
  const replayMatch = useGameStore((s) => s.replayMatch);
  const returnToLobby = useGameStore((s) => s.returnToLobby);
  const matchKind = useGameStore((s) => s.matchKind);
  const rankedRankIndex = useGameStore((s) => s.rankedRankIndex);
  const [quitConfirm, setQuitConfirm] = useState(false);

  const colorById = useMemo(() => {
    const map = new Map<string, string>();
    if (!game) return map;
    for (const p of game.players) map.set(p.id, p.color);
    return map;
  }, [game]);

  const fxByPlayer = useMemo(() => {
    const map = new Map<
      string,
      { kind: FxKind; label?: string | null; spriteId?: string | null }
    >();
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
          spriteId: show.spriteId ?? null,
        });
      }
    }
    return map;
  }, [game, activeFx]);

  if (!game) return null;

  const human = game.players.find((p) => p.id === game.humanId)!;
  const others = game.players.filter((p) => p.id !== game.humanId);
  const sd = game.suddenDeath;
  const humanSwapMark = quickSwapMarkedIds(
    game.pendingQuickSwaps,
    human.hand,
    human.id,
  );
  const humanSwapSec =
    humanSwapMark.msLeft != null
      ? Math.ceil(humanSwapMark.msLeft / 1000)
      : null;
  const humanAtRisk =
    sd.active && human.isAlive && human.coins < sd.bracket;
  const eventLive = !sd.active && game.worldEvent.live.length > 0;
  const eventAccents = eventLive
    ? game.worldEvent.live.map((e) => getWorldEvent(e.id).accent)
    : [];
  const eventGlowStyle =
    eventAccents.length === 0
      ? undefined
      : ({
          ['--event-glow-1' as string]: eventAccents[0],
          ['--event-glow-2' as string]:
            eventAccents[1] ?? eventAccents[0],
          ['--event-glow-3' as string]:
            eventAccents[2] ?? eventAccents[0],
        } as CSSProperties);

  const floatFor = (playerId: string) => {
    const f = floats.filter((x) => x.playerId === playerId).at(-1);
    return f?.text ?? null;
  };

  const targetingPlayers = targeting?.target === 'player';
  const targetingHand =
    targeting?.target === 'hand' ||
    (targeting?.target === 'hand-then-item' &&
      targeting.selectedHandInstanceId === undefined);
  const targetingTiles =
    targeting?.target === 'item' ||
    targeting?.target === 'two-items' ||
    targeting?.target === 'all-items' ||
    (targeting?.target === 'hand-then-item' &&
      !!targeting.selectedHandInstanceId);

  const focusedId = targeting?.instanceId ?? handFocus;
  const inUseMode = !!focusedId && !spectating && human.isAlive;
  const focusedItem = focusedId
    ? human.hand.find((h) => h.instanceId === focusedId)
    : null;
  // Use only for actives that need no tile/player/hand pick
  const canUse =
    !!focusedItem &&
    !targeting &&
    !poolRevealOpen &&
    canInstantUse(focusedItem);
  const canSell = inUseMode && !!focusedItem && !poolRevealOpen;
  const showPoolToggle =
    phase === 'playing' &&
    !spectating &&
    human.isAlive &&
    !knockoutOffer &&
    !poolRevealOpen &&
    !inUseMode;

  const handSlots = Array.from({ length: CONFIG.HAND_SLOTS }, (_, i) => {
    return human.hand[i] ?? null;
  });
  const overflowBomb =
    human.hand.length > CONFIG.HAND_SLOTS
      ? human.hand.find((h) => h.itemId === 'bomb' && !handSlots.includes(h))
      : null;

  const cols = game.gridCols;
  const zoomedOut = knockoutOffer || spectating;
  const live = phase === 'playing' && !knockoutOffer;
  const rankedChrome =
    matchKind === 'ranked' && rankedRankIndex != null
      ? `ranked-match ${rankThemeClass(rankedRankIndex)}`
      : '';
  const dockMotion = [
    'status-dock',
    phase === 'countdown' ? 'dock-pre' : '',
    live ? 'dock-in' : '',
    knockoutOffer ? 'dock-out' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const stripProps = {
    human,
    others,
    mode: game.mode,
    atRisk: humanAtRisk,
    suddenBracket: sd.active ? sd.bracket : null,
    floatText: floatFor(human.id),
    rivalFloatText: others[0] ? floatFor(others[0].id) : null,
    targetingPlayers: !!targetingPlayers && human.isAlive,
    fxByPlayer,
    activeFx,
    coldMarketMs: game.coldMarketMs,
    pendingQuickSwaps: game.pendingQuickSwaps,
    onSelectPlayer: selectTargetPlayer,
  } as const;

  return (
    <div
      className={[
        'screen',
        'game-screen',
        `mode-${game.mode}`,
        targeting ? 'targeting-active' : '',
        targetingPlayers ? 'targeting-players' : '',
        targetingTiles ? 'targeting-tiles' : '',
        targetingHand ? 'targeting-hand' : '',
        targeting?.selectedTile !== undefined ? 'targeting-has-pick' : '',
        inUseMode ? 'use-mode' : '',
        sd.active ? 'sudden-death-live' : '',
        humanAtRisk ? 'sd-human-risk' : '',
        zoomedOut ? 'knocked-out' : '',
        spectating ? 'spectating' : '',
        live ? 'widgets-in' : '',
        poolRevealOpen ? 'pool-peek-open' : '',
        eventLive ? 'event-live' : '',
        rankedChrome,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ['--grid-cols' as string]: cols,
        ...eventGlowStyle,
      }}
    >
      <aside className="game-rail" aria-label="Standings and match items">
        <div className="rail-standings-block">
          <div className="rail-pool-head">
            <span className="rail-kicker">Live</span>
            <span className="rail-title">Scoreboard</span>
          </div>
          <PurseStrip {...stripProps} sections="board" rail />
        </div>
        <MatchPoolPanel itemPool={game.itemPool} />
      </aside>

      <div className="game-play">
        <GameChrome
          roundMs={game.roundMs}
          elapsedMs={game.elapsedMs}
          paceBannerMs={game.paceBannerMs}
          suddenDeath={game.suddenDeath}
          worldEvent={game.worldEvent}
          players={game.players}
          onQuit={() => setQuitConfirm(true)}
          matchLengthMs={game.rules?.gameLengthMs}
        />

        {targeting && (
          <TargetingOverlay
            targeting={targeting}
            tiles={game.tiles}
            onCancel={cancelTargeting}
          />
        )}
        {!targeting && handFocus && focusedItem && human.isAlive && !spectating && (
          <div className="use-mode-banner">
            <SpriteIcon id={focusedItem.itemId} aria-hidden />
            <span>
              {canUse
                ? 'Tap again to use, or Sell above'
                : 'Sell above. Tap again to cancel'}
            </span>
            <button type="button" className="use-mode-cancel" onClick={cancelTargeting} aria-label="Cancel">
              <X size={16} />
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
                const isSelected = targeting?.selectedTile === tile.index;
                return (
                  <ShopTile
                    key={tile.index}
                    tile={tile}
                    bidderColor={bidderColor}
                    isYou={tile.highBidderId === human.id}
                    targeting={!!targetingTiles && human.isAlive && !spectating}
                    selected={isSelected}
                    pickOrder={
                      targeting?.target === 'two-items' && isSelected ? 1 : null
                    }
                    fxKind={fx?.kind ?? null}
                    fxLabel={fx?.label}
                    fxSpriteId={fx?.spriteId ?? null}
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
            <div className="dock-actions" aria-label="Item actions">
              {showPoolToggle ? (
                <div className="dock-action-slot dock-action-slot-full mobile-only-pool">
                  <PoolToggleButton
                    open={false}
                    onOpen={openPoolReveal}
                    onClose={closePoolReveal}
                  />
                </div>
              ) : (
                <>
                  <div className="dock-action-slot">
                    {canSell && (
                      <button
                        type="button"
                        className="dock-action sell"
                        onClick={sellFocused}
                      >
                        Sell
                      </button>
                    )}
                  </div>
                  <div className="dock-action-slot">
                    {canUse && (
                      <button
                        type="button"
                        className="dock-action use"
                        onClick={useFocused}
                      >
                        Use
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="mobile-full-strip">
              <PurseStrip {...stripProps} sections="all" />
            </div>
            <div className="desktop-purse-only">
              <PurseStrip {...stripProps} sections="purse" />
            </div>
            <div className="hand-bar">
              <div className="hand-slots">
                {handSlots.map((item, i) => {
                  const fx = item ? fxForHandItem(activeFx, item.instanceId) : null;
                  const threatened =
                    !!item && humanSwapMark.ids.has(item.instanceId);
                  const handTargetable =
                    !!targetingHand &&
                    !!item &&
                    item.instanceId !== targeting?.instanceId &&
                    item.itemId !== 'bomb' &&
                    item.itemId !== 'dynamite' &&
                    human.isAlive &&
                    !spectating;
                  const handPicked =
                    targeting?.selectedHandInstanceId === item?.instanceId;
                  return (
                    <HandSlot
                      key={item?.instanceId ?? `empty-${i}`}
                      item={item}
                      index={i}
                      selected={
                        (!!item && item.instanceId === focusedId) || handPicked
                      }
                      targetable={handTargetable}
                      fxKind={fx?.kind ?? null}
                      fxLabel={fx?.label ?? null}
                      walletCoins={human.coins}
                      hand={human.hand}
                      swapThreatened={threatened}
                      swapThreatSec={threatened ? humanSwapSec : null}
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
                      fxForHandItem(activeFx, overflowBomb.instanceId)?.kind ??
                      null
                    }
                    fxLabel={
                      fxForHandItem(activeFx, overflowBomb.instanceId)?.label ??
                      null
                    }
                    walletCoins={human.coins}
                    hand={human.hand}
                    swapThreatened={humanSwapMark.ids.has(
                      overflowBomb.instanceId,
                    )}
                    swapThreatSec={
                      humanSwapMark.ids.has(overflowBomb.instanceId)
                        ? humanSwapSec
                        : null
                    }
                    onSelect={() => selectHandItem(overflowBomb.instanceId)}
                    onReorder={reorderHandSlots}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {spectating && (
          <SpectateHands
            players={game.players}
            pendingQuickSwaps={game.pendingQuickSwaps}
          />
        )}
      </div>

      {quitConfirm && (
        <div className="quit-overlay" role="dialog" aria-label="Forfeit">
          <div className="quit-sheet">
            <p>Are you sure you want to forfeit?</p>
            <div className="quit-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setQuitConfirm(false)}
              >
                Keep playing
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  setQuitConfirm(false);
                  returnToLobby();
                }}
              >
                Forfeit
              </button>
            </div>
          </div>
        </div>
      )}

      {knockoutOffer && (
        <KnockoutOverlay
          reason={knockoutReason}
          report={knockoutReport}
          onPlayAgain={replayMatch}
          onSpectate={enterSpectate}
          onMenu={returnToLobby}
        />
      )}
    </div>
  );
}
