import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { CONFIG, PLAYER_COLORS } from '../game/constants';
import { getItem, isMoneyEngine, ITEM_LIST } from '../game/items';
import type { BotArchetype, ItemId, WorldEventId } from '../game/types';
import {
  getWorldEvent,
  RANDOM_WORLD_EVENT_IDS,
  WORLD_EVENTS,
} from '../game/worldEvents';

const COLS = 7;
const TICK_MS = 100;
const TILE_TIMER_MS = 9_000;
const EVENT_EVERY_MS = 120_000;
const EVENT_DURATION_MS = 28_000;
const MAX_LEADS = CONFIG.MAX_ACTIVE_BIDS;
const SCROLL_SPEED = 26;
const GAP_PX = 5;
/** Extra rows above/below the visible window */
const BUFFER_ROWS = 3;

type LobbyTile = {
  key: number;
  itemId: ItemId;
  price: number;
  bidderId: string | null;
  timerMs: number;
  freezeMs: number;
  flashMs: number;
};

type LobbyRow = {
  id: number;
  /** World Y — scroller translates by -scrollY; never reshuffled via scroll reset */
  y: number;
  tiles: LobbyTile[];
};

type LobbyBot = {
  id: string;
  color: string;
  arch: BotArchetype;
  cooldownMs: number;
};

type LobbyEvent = {
  id: WorldEventId;
  remainMs: number;
};

function pickItem(rng: () => number, prefer?: ItemId[]): ItemId {
  if (prefer && prefer.length > 0) {
    return prefer[Math.floor(rng() * prefer.length)]!;
  }
  return ITEM_LIST[Math.floor(rng() * ITEM_LIST.length)]!.id;
}

let tileSeq = 0;

function restock(
  tile: LobbyTile,
  eventId: WorldEventId | null,
  rng: () => number,
  initial = false,
): void {
  tile.bidderId = null;
  tile.price = 1 + Math.floor(rng() * 3);
  tile.timerMs = TILE_TIMER_MS * (0.5 + rng() * 0.6);
  tile.flashMs = initial ? 0 : 280;
  if (eventId === 'deep_freeze') {
    tile.freezeMs = Math.max(tile.freezeMs, 1);
  }
  if (eventId === 'bomb_bazaar' && rng() < 0.5) {
    tile.itemId = 'bomb';
  } else if (eventId === 'money_money_money') {
    const money = ITEM_LIST.filter((i) => isMoneyEngine(i.id)).map((i) => i.id);
    tile.itemId = pickItem(rng, money);
  } else if (eventId === 'mystery_mall') {
    tile.itemId = 'mystery_box';
  } else {
    tile.itemId = pickItem(rng);
  }
}

function makeTile(rng: () => number, eventId: WorldEventId | null = null): LobbyTile {
  const tile: LobbyTile = {
    key: ++tileSeq,
    itemId: 'coin_mine',
    price: 1 + Math.floor(rng() * 4),
    bidderId: null,
    timerMs: TILE_TIMER_MS * (0.55 + rng() * 0.55),
    freezeMs: eventId === 'deep_freeze' ? EVENT_DURATION_MS : 0,
    flashMs: 0,
  };
  restock(tile, eventId, rng, true);
  return tile;
}

function makeRow(
  id: number,
  y: number,
  rng: () => number,
  eventId: WorldEventId | null,
): LobbyRow {
  return {
    id,
    y,
    tiles: Array.from({ length: COLS }, () => makeTile(rng, eventId)),
  };
}

/** Restock tiles in place — keep stable React keys to avoid remount hitch. */
function restockRow(
  row: LobbyRow,
  rng: () => number,
  eventId: WorldEventId | null,
): void {
  for (const tile of row.tiles) {
    restock(tile, eventId, rng);
  }
}

function makeBots(): LobbyBot[] {
  const arches: BotArchetype[] = ['ruthless', 'balanced', 'chill', 'balanced'];
  return arches.map((arch, i) => ({
    id: `lobby_bot_${i}`,
    color: PLAYER_COLORS[i]!,
    arch,
    cooldownMs: 400 + i * 350,
  }));
}

function allTiles(rows: LobbyRow[]): LobbyTile[] {
  return rows.flatMap((r) => r.tiles);
}

function leadCount(tiles: LobbyTile[], botId: string): number {
  return tiles.reduce((n, t) => n + (t.bidderId === botId ? 1 : 0), 0);
}

function scoreTile(
  tile: LobbyTile,
  bot: LobbyBot,
  leads: number,
  eventId: WorldEventId | null,
  rng: () => number,
): number {
  if (tile.bidderId === bot.id) return -Infinity;
  if (leads >= MAX_LEADS) return -Infinity;
  if (tile.itemId === 'bomb' && eventId !== 'bomb_bazaar') {
    if (rng() > 0.08) return -Infinity;
  }

  const def = getItem(tile.itemId);
  let score = 0;
  const next = tile.price + 1;

  if (isMoneyEngine(tile.itemId)) {
    score += 38 + (def.passiveAmount ?? 0) * 8;
    score += Math.max(0, 14 - next * 2);
  } else if (def.kind === 'active') {
    score += 16;
    if (tile.itemId === 'price_doubler' || tile.itemId === 'handcuffs') score += 7;
    if (tile.itemId === 'fast_forward' || tile.itemId === 'swap_portal') score += 5;
  } else {
    score += 4;
  }

  score += Math.max(0, 10 - next);
  if (tile.timerMs < 2800) score += 9;

  if (bot.arch === 'ruthless' && tile.bidderId) score += 14;
  if (bot.arch === 'chill' && tile.bidderId) score -= 6;
  if (bot.arch === 'chill' && isMoneyEngine(tile.itemId)) score += 8;
  if (bot.arch === 'ruthless' && def.kind === 'active') score += 6;

  if (eventId === 'money_money_money' && isMoneyEngine(tile.itemId)) score += 20;
  if (eventId === 'fire_sale') score += 10;
  if (eventId === 'mystery_mall' && tile.itemId === 'mystery_box') score += 12;

  score += (rng() - 0.5) * 10;
  return score;
}

function applyEventStart(tiles: LobbyTile[], id: WorldEventId, rng: () => number): void {
  switch (id) {
    case 'deep_freeze':
      for (const t of tiles) t.freezeMs = EVENT_DURATION_MS;
      break;
    case 'fire_sale':
      for (const t of tiles) {
        t.price = 1;
        t.flashMs = 400;
      }
      break;
    case 'bomb_bazaar':
      for (const t of tiles) {
        if (rng() < 0.55) {
          t.itemId = 'bomb';
          t.bidderId = null;
          t.price = 1;
          t.flashMs = 350;
        }
      }
      break;
    case 'money_money_money': {
      const money = ITEM_LIST.filter((i) => isMoneyEngine(i.id)).map((i) => i.id);
      for (const t of tiles) {
        t.itemId = pickItem(rng, money);
        t.flashMs = 350;
      }
      break;
    }
    case 'mystery_mall':
      for (const t of tiles) {
        t.itemId = 'mystery_box';
        t.flashMs = 350;
      }
      break;
    case 'inflation_wave':
      for (const t of tiles) {
        t.price += 2;
        t.flashMs = 300;
      }
      break;
    case 'shuffle_storm': {
      const items = tiles.map((t) => t.itemId);
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [items[i], items[j]] = [items[j]!, items[i]!];
      }
      tiles.forEach((t, i) => {
        t.itemId = items[i]!;
        t.flashMs = 280;
      });
      break;
    }
    case 'golden_chaos': {
      const money = ITEM_LIST.filter((i) => isMoneyEngine(i.id)).map((i) => i.id);
      for (const t of tiles) {
        t.itemId = pickItem(rng, money);
        t.price += 3;
        t.flashMs = 350;
      }
      break;
    }
    default:
      break;
  }
}

function pulseEvent(tiles: LobbyTile[], id: WorldEventId, rng: () => number): void {
  if (id === 'inflation_wave') {
    for (const t of tiles) t.price += 2;
  } else if (id === 'shuffle_storm') {
    applyEventStart(tiles, 'shuffle_storm', rng);
  } else if (id === 'coin_shower' || id === 'tax_collector') {
    for (const t of tiles) {
      if (rng() < 0.25) t.flashMs = 280;
    }
  } else if (id === 'golden_chaos') {
    applyEventStart(tiles, 'shuffle_storm', rng);
    for (const t of tiles) t.price += 1;
  }
}

const REACTION: Record<BotArchetype, [number, number]> = {
  chill: [1100, 2400],
  balanced: [550, 1400],
  ruthless: [280, 850],
};

function computeLayout(width: number, height: number) {
  const inner = Math.max(280, width);
  const tile = Math.floor((inner - GAP_PX * (COLS + 1)) / COLS);
  const rowH = tile + GAP_PX;
  const visible = Math.max(4, Math.ceil(height / rowH) + 1);
  const total = visible + BUFFER_ROWS * 2;
  return { tile, rowH, total, visible };
}

export function LobbyAuctionBg() {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const rngRef = useRef(() => Math.random());
  const botsRef = useRef(makeBots());
  const rowsRef = useRef<LobbyRow[]>([]);
  const rowIdRef = useRef(0);
  const scrollYRef = useRef(0);
  const nextYRef = useRef(0);
  const rowHRef = useRef(80);
  const tileRef = useRef(72);
  const viewHRef = useRef(600);
  const eventRef = useRef<LobbyEvent | null>(null);
  const untilEventRef = useRef(18_000);
  const pulseAccRef = useRef(0);
  const [layoutTick, setLayoutTick] = useState(0);
  const [, setFrame] = useState(0);

  const ensureRows = (count: number) => {
    const rng = rngRef.current;
    const eventId = eventRef.current?.id ?? null;
    const rows = rowsRef.current;
    const rowH = rowHRef.current;
    while (rows.length < count) {
      const y = nextYRef.current;
      nextYRef.current = y + rowH;
      rows.push(makeRow(++rowIdRef.current, y, rng, eventId));
    }
    while (rows.length > count && rows.length > 4) {
      rows.pop();
      if (rows.length > 0) {
        const last = rows[rows.length - 1]!;
        nextYRef.current = last.y + rowH;
      }
    }
  };

  // Init + measure — fixed tile size so every row is identical height
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const applySize = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      viewHRef.current = h;
      const { tile, rowH, total } = computeLayout(w, h);
      tileRef.current = tile;
      const prevH = rowHRef.current;
      rowHRef.current = rowH;
      root.style.setProperty('--lobby-tile', `${tile}px`);
      root.style.setProperty('--lobby-gap', `${GAP_PX}px`);
      root.style.setProperty('--lobby-row-h', `${rowH}px`);

      // Rebuild strip if row height changed so world Y stays consistent
      if (rowsRef.current.length === 0 || prevH !== rowH) {
        rowsRef.current = [];
        rowIdRef.current = 0;
        nextYRef.current = 0;
        scrollYRef.current = 0;
        ensureRows(total);
        const tiles = allTiles(rowsRef.current);
        const bots = botsRef.current;
        const rng = rngRef.current;
        for (let i = 0; i < 6; i++) {
          const bot = bots[i % bots.length]!;
          const tileItem =
            tiles[Math.floor(rng() * Math.min(tiles.length, COLS * 5))]!;
          if (leadCount(tiles, bot.id) >= MAX_LEADS) continue;
          if (tileItem.bidderId) continue;
          tileItem.bidderId = bot.id;
          tileItem.price = 1 + Math.floor(rng() * 3);
        }
      } else {
        ensureRows(total);
      }
      setLayoutTick((n) => n + 1);
    };

    applySize();
    const ro = new ResizeObserver(applySize);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const syncRowDom = (row: LobbyRow) => {
      const el = rowElsRef.current.get(row.id);
      if (el) el.style.top = `${row.y}px`;
    };

    const visibleTilesNow = (): LobbyTile[] => {
      const rows = rowsRef.current;
      const rowH = rowHRef.current;
      const viewH = viewHRef.current;
      const scrollY = scrollYRef.current;
      const visible: LobbyTile[] = [];
      for (const row of rows) {
        const top = row.y - scrollY;
        const bottom = top + rowH;
        if (bottom < 0 || top > viewH) continue;
        visible.push(...row.tiles);
      }
      return visible;
    };

    const recycleOffscreen = (rng: () => number) => {
      const rows = rowsRef.current;
      const rowH = rowHRef.current;
      if (rowH <= 0 || rows.length === 0) return;
      // Move fully-above rows to the bottom without resetting scrollY
      while (rows.length > 0 && rows[0]!.y + rowH <= scrollYRef.current) {
        const row = rows.shift()!;
        row.y = nextYRef.current;
        nextYRef.current = row.y + rowH;
        restockRow(row, rng, eventRef.current?.id ?? null);
        rows.push(row);
        syncRowDom(row);
      }

      // Keep scrollY from growing without bound (rare long lobby sessions)
      if (scrollYRef.current > rowH * 64) {
        const shift = Math.floor(scrollYRef.current / rowH) * rowH;
        scrollYRef.current -= shift;
        nextYRef.current -= shift;
        for (const row of rows) {
          row.y -= shift;
          syncRowDom(row);
        }
      }
    };

    const tickSim = (dtMs: number) => {
      const rng = rngRef.current;
      const rows = rowsRef.current;
      if (rows.length === 0) return;
      const bots = botsRef.current;
      let event = eventRef.current;
      const visibleTiles = visibleTilesNow();

      if (!event) {
        untilEventRef.current -= dtMs;
        if (untilEventRef.current <= 0) {
          const eid =
            RANDOM_WORLD_EVENT_IDS[
              Math.floor(rng() * RANDOM_WORLD_EVENT_IDS.length)
            ]!;
          event = { id: eid, remainMs: EVENT_DURATION_MS };
          eventRef.current = event;
          applyEventStart(allTiles(rows), eid, rng);
          pulseAccRef.current = 0;
        }
      } else {
        event.remainMs -= dtMs;
        pulseAccRef.current += dtMs;
        if (pulseAccRef.current >= 5000) {
          pulseAccRef.current = 0;
          pulseEvent(allTiles(rows), event.id, rng);
        }
        if (event.remainMs <= 0) {
          for (const t of allTiles(rows)) t.freezeMs = 0;
          eventRef.current = null;
          event = null;
          untilEventRef.current = EVENT_EVERY_MS;
        }
      }

      const eventId = event?.id ?? null;
      const timerScale =
        eventId === 'deep_freeze'
          ? 0
          : eventId === 'turbo_market'
            ? 2
            : eventId === 'golden_chaos'
              ? 1.5
              : 1;

      for (const tile of visibleTiles) {
        if (tile.flashMs > 0) tile.flashMs = Math.max(0, tile.flashMs - dtMs);
        if (tile.freezeMs > 0) {
          tile.freezeMs = Math.max(0, tile.freezeMs - dtMs);
          continue;
        }
        if (timerScale === 0) continue;
        tile.timerMs -= dtMs * timerScale;
        if (tile.timerMs <= 0) restock(tile, eventId, rng);
      }

      const bufferTiles = allTiles(rows);
      for (const bot of bots) {
        bot.cooldownMs -= dtMs;
        if (bot.cooldownMs > 0) continue;
        const [lo, hi] = REACTION[bot.arch];
        bot.cooldownMs = lo + rng() * (hi - lo);
        const leads = leadCount(bufferTiles, bot.id);
        let best: LobbyTile | null = null;
        let bestScore = -Infinity;
        for (const tile of visibleTiles) {
          const s = scoreTile(tile, bot, leads, eventId, rng);
          if (s > bestScore) {
            bestScore = s;
            best = tile;
          }
        }
        if (best && bestScore > 8) {
          best.bidderId = bot.id;
          best.price += 1;
          best.flashMs = 320;
        }
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const rng = rngRef.current;

      scrollYRef.current += (SCROLL_SPEED * dt) / 1000;
      recycleOffscreen(rng);

      if (scrollerRef.current) {
        scrollerRef.current.style.transform = `translate3d(0, ${-scrollYRef.current}px, 0)`;
      }

      acc += dt;
      if (acc >= TICK_MS) {
        tickSim(acc);
        acc = 0;
        setFrame((n) => n + 1);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const rows = rowsRef.current;
  const event = eventRef.current;
  const bots = botsRef.current;
  const colorById = new Map(bots.map((b) => [b.id, b.color]));
  const accent = event ? getWorldEvent(event.id).accent : null;
  const eventDef = event ? WORLD_EVENTS[event.id] : null;
  const rowH = rowHRef.current;
  void layoutTick;

  const stripBottom =
    rows.length > 0 ? Math.max(...rows.map((r) => r.y)) + rowH : rowH;
  const scrollerH = Math.max(
    stripBottom - scrollYRef.current + viewHRef.current,
    viewHRef.current,
  );

  return (
    <div
      ref={rootRef}
      className={`lobby-auction-bg${event ? ' event-live' : ''}${
        event ? ` event-${event.id}` : ''
      }`}
      style={
        accent ? ({ ['--event-glow' as string]: accent } as CSSProperties) : undefined
      }
      aria-hidden
    >
      <div
        ref={scrollerRef}
        className="lobby-auction-scroller"
        style={{ height: scrollerH }}
      >
        {rows.map((row) => (
          <div
            key={row.id}
            ref={(el) => {
              if (el) rowElsRef.current.set(row.id, el);
              else rowElsRef.current.delete(row.id);
            }}
            className="lobby-auction-row"
            style={{ top: row.y, height: rowH }}
          >
            {row.tiles.map((tile) => {
              const def = getItem(tile.itemId);
              const bidderColor = tile.bidderId
                ? (colorById.get(tile.bidderId) ?? null)
                : null;
              const ratio = Math.max(0, Math.min(1, tile.timerMs / TILE_TIMER_MS));
              const frozen = tile.freezeMs > 0 || event?.id === 'deep_freeze';
              return (
                <div
                  key={tile.key}
                  className={[
                    'lobby-auction-tile',
                    bidderColor ? 'has-bidder' : '',
                    frozen ? 'frozen' : '',
                    tile.flashMs > 0 ? 'pop' : '',
                    tile.itemId === 'bomb' ? 'bomb' : '',
                    event?.id === 'turbo_market' ? 'turbo' : '',
                    event?.id === 'bomb_bazaar' && tile.itemId === 'bomb'
                      ? 'ticking'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={
                    bidderColor
                      ? ({
                          ['--bidder' as string]: bidderColor,
                          background: bidderColor,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <span className="lobby-auction-emoji">{def.emoji}</span>
                  <span className="lobby-auction-price">🪙{tile.price}</span>
                  <span
                    className="lobby-auction-timer"
                    style={{
                      transform: `scaleX(${ratio})`,
                      background: ratio > 0.35 ? '#3aaa62' : '#d6453a',
                    }}
                  />
                  {frozen && <span className="lobby-auction-frost" aria-hidden />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="lobby-auction-veil" />
      {eventDef && (
        <div
          className="lobby-auction-event-chip"
          style={{ ['--event-accent' as string]: accent! }}
        >
          <span>{eventDef.emoji}</span>
          <span>{eventDef.name}</span>
        </div>
      )}
    </div>
  );
}
