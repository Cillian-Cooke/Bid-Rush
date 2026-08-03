import { useEffect, useRef, useState } from 'react';
import { CONFIG, PLAYER_COLORS } from '../game/constants';
import { getItem, isMoneyEngine, ITEM_LIST } from '../game/items';
import type { BotArchetype, ItemId, WorldEventId } from '../game/types';
import { getWorldEvent, RANDOM_WORLD_EVENT_IDS } from '../game/worldEvents';

export type LobbyBgEvent = {
  id: WorldEventId;
  remainMs: number;
};

type Props = {
  onEventChange?: (event: LobbyBgEvent | null) => void;
};

const MOBILE_COLS = 4;
const DESKTOP_COLS = 7;
/** Matches the desktop lobby split breakpoint in index.css */
const DESKTOP_MIN_PX = 960;
const TICK_MS = 120;
const TILE_TIMER_MS = 9_000;
const EVENT_EVERY_MS = 120_000;
const EVENT_DURATION_MS = 28_000;
const MAX_LEADS = CONFIG.MAX_ACTIVE_BIDS;
const SCROLL_SPEED = 26;
const GAP_PX = 5;
const BUFFER_ROWS = 3;

function lobbyCols(): number {
  if (typeof window === 'undefined') return MOBILE_COLS;
  return window.matchMedia(`(min-width: ${DESKTOP_MIN_PX}px)`).matches
    ? DESKTOP_COLS
    : MOBILE_COLS;
}

type LobbyTile = {
  key: number;
  itemId: ItemId;
  price: number;
  bidderId: string | null;
  timerMs: number;
  freezeMs: number;
  flashMs: number;
  /** Last painted snapshot — skip DOM work when unchanged */
  painted?: string;
};

type LobbyRow = {
  id: number;
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

type TileDom = {
  root: HTMLDivElement;
  emoji: HTMLSpanElement;
  price: HTMLSpanElement;
  timer: HTMLSpanElement;
  frost: HTMLSpanElement;
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
  tile.painted = undefined;
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
  cols: number,
): LobbyRow {
  return {
    id,
    y,
    tiles: Array.from({ length: cols }, () => makeTile(rng, eventId)),
  };
}

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
      for (const t of tiles) {
        t.freezeMs = EVENT_DURATION_MS;
        t.painted = undefined;
      }
      break;
    case 'fire_sale':
      for (const t of tiles) {
        t.price = 1;
        t.flashMs = 400;
        t.painted = undefined;
      }
      break;
    case 'bomb_bazaar':
      for (const t of tiles) {
        if (rng() < 0.55) {
          t.itemId = 'bomb';
          t.bidderId = null;
          t.price = 1;
          t.flashMs = 350;
          t.painted = undefined;
        }
      }
      break;
    case 'money_money_money': {
      const money = ITEM_LIST.filter((i) => isMoneyEngine(i.id)).map((i) => i.id);
      for (const t of tiles) {
        t.itemId = pickItem(rng, money);
        t.flashMs = 350;
        t.painted = undefined;
      }
      break;
    }
    case 'mystery_mall':
      for (const t of tiles) {
        t.itemId = 'mystery_box';
        t.flashMs = 350;
        t.painted = undefined;
      }
      break;
    case 'inflation_wave':
      for (const t of tiles) {
        t.price += 2;
        t.flashMs = 300;
        t.painted = undefined;
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
        t.painted = undefined;
      });
      break;
    }
    case 'golden_chaos': {
      const money = ITEM_LIST.filter((i) => isMoneyEngine(i.id)).map((i) => i.id);
      for (const t of tiles) {
        t.itemId = pickItem(rng, money);
        t.price += 3;
        t.flashMs = 350;
        t.painted = undefined;
      }
      break;
    }
    default:
      break;
  }
}

function pulseEvent(tiles: LobbyTile[], id: WorldEventId, rng: () => number): void {
  if (id === 'inflation_wave') {
    for (const t of tiles) {
      t.price += 2;
      t.painted = undefined;
    }
  } else if (id === 'shuffle_storm') {
    applyEventStart(tiles, 'shuffle_storm', rng);
  } else if (id === 'coin_shower' || id === 'tax_collector') {
    for (const t of tiles) {
      if (rng() < 0.25) {
        t.flashMs = 280;
        t.painted = undefined;
      }
    }
  } else if (id === 'golden_chaos') {
    applyEventStart(tiles, 'shuffle_storm', rng);
    for (const t of tiles) {
      t.price += 1;
      t.painted = undefined;
    }
  }
}

const REACTION: Record<BotArchetype, [number, number]> = {
  chill: [1100, 2400],
  balanced: [550, 1400],
  ruthless: [280, 850],
};

function computeLayout(width: number, height: number, cols: number) {
  const inner = Math.max(280, width);
  const tile = Math.floor((inner - GAP_PX * (cols + 1)) / cols);
  const rowH = tile + GAP_PX;
  const visible = Math.max(4, Math.ceil(height / rowH) + 1);
  const total = visible + BUFFER_ROWS * 2;
  return { tile, rowH, total, visible };
}

function tileSig(
  tile: LobbyTile,
  eventId: WorldEventId | null,
  ratioBucket: number,
): string {
  return [
    tile.itemId,
    tile.price,
    tile.bidderId ?? '',
    tile.flashMs > 0 ? '1' : '0',
    tile.freezeMs > 0 || eventId === 'deep_freeze' ? '1' : '0',
    tile.itemId === 'bomb' ? '1' : '0',
    eventId === 'turbo_market' ? '1' : '0',
    eventId === 'bomb_bazaar' && tile.itemId === 'bomb' ? '1' : '0',
    ratioBucket,
  ].join('|');
}

export function LobbyAuctionBg({ onEventChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const tileElsRef = useRef<Map<number, TileDom>>(new Map());
  const rngRef = useRef(() => Math.random());
  const botsRef = useRef(makeBots());
  const rowsRef = useRef<LobbyRow[]>([]);
  const rowIdRef = useRef(0);
  const scrollYRef = useRef(0);
  const nextYRef = useRef(0);
  const rowHRef = useRef(80);
  const tileRef = useRef(72);
  const colsRef = useRef(MOBILE_COLS);
  const viewHRef = useRef(600);
  const eventRef = useRef<LobbyEvent | null>(null);
  const untilEventRef = useRef(18_000);
  const pulseAccRef = useRef(0);
  const onEventChangeRef = useRef(onEventChange);
  onEventChangeRef.current = onEventChange;
  const lastEventPubRef = useRef<{ id: WorldEventId | null; bucket: number }>({
    id: null,
    bucket: -1,
  });
  const colorByIdRef = useRef(new Map(botsRef.current.map((b) => [b.id, b.color])));
  const [layoutTick, setLayoutTick] = useState(0);

  const publishEvent = (force = false) => {
    const event = eventRef.current;
    const id = event?.id ?? null;
    const bucket = event ? Math.ceil(event.remainMs / 1000) : -1;
    const prev = lastEventPubRef.current;
    if (!force && prev.id === id && prev.bucket === bucket) return;
    lastEventPubRef.current = { id, bucket };
    onEventChangeRef.current?.(
      event ? { id: event.id, remainMs: event.remainMs } : null,
    );
  };

  const paintTile = (tile: LobbyTile, eventId: WorldEventId | null) => {
    const els = tileElsRef.current.get(tile.key);
    if (!els) return;

    const ratio = Math.max(0, Math.min(1, tile.timerMs / TILE_TIMER_MS));
    // Coarse timer buckets keep paint cheap; scroll stays on its own path
    const ratioBucket = Math.round(ratio * 20);
    const sig = tileSig(tile, eventId, ratioBucket);
    if (tile.painted === sig) {
      els.timer.style.transform = `scaleX(${ratio})`;
      return;
    }
    tile.painted = sig;

    const frozen = tile.freezeMs > 0 || eventId === 'deep_freeze';
    const bidderColor = tile.bidderId
      ? (colorByIdRef.current.get(tile.bidderId) ?? null)
      : null;

    els.root.className = [
      'lobby-auction-tile',
      bidderColor ? 'has-bidder' : '',
      frozen ? 'frozen' : '',
      tile.flashMs > 0 ? 'pop' : '',
      tile.itemId === 'bomb' ? 'bomb' : '',
      eventId === 'turbo_market' ? 'turbo' : '',
      eventId === 'bomb_bazaar' && tile.itemId === 'bomb' ? 'ticking' : '',
    ]
      .filter(Boolean)
      .join(' ');

    if (bidderColor) {
      els.root.style.setProperty('--bidder', bidderColor);
      els.root.style.background = bidderColor;
    } else {
      els.root.style.removeProperty('--bidder');
      els.root.style.background = '';
    }

    const def = getItem(tile.itemId);
    if (els.emoji.textContent !== def.emoji) els.emoji.textContent = def.emoji;
    const priceText = `🪙${tile.price}`;
    if (els.price.textContent !== priceText) els.price.textContent = priceText;

    els.timer.style.transform = `scaleX(${ratio})`;
    els.timer.style.background = ratio > 0.35 ? '#3aaa62' : '#d6453a';
    els.frost.hidden = !frozen;
  };

  const paintAll = () => {
    const eventId = eventRef.current?.id ?? null;
    for (const row of rowsRef.current) {
      for (const tile of row.tiles) paintTile(tile, eventId);
    }
  };

  const syncScrollerHeight = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const bottom =
      rowsRef.current.length > 0
        ? Math.max(...rowsRef.current.map((r) => r.y)) + rowHRef.current
        : rowHRef.current;
    scroller.style.height = `${Math.max(bottom + viewHRef.current, viewHRef.current)}px`;
  };

  const ensureRows = (count: number) => {
    const rng = rngRef.current;
    const eventId = eventRef.current?.id ?? null;
    const rows = rowsRef.current;
    const rowH = rowHRef.current;
    const cols = colsRef.current;
    while (rows.length < count) {
      const y = nextYRef.current;
      nextYRef.current = y + rowH;
      rows.push(makeRow(++rowIdRef.current, y, rng, eventId, cols));
    }
    while (rows.length > count && rows.length > 4) {
      rows.pop();
      if (rows.length > 0) {
        const last = rows[rows.length - 1]!;
        nextYRef.current = last.y + rowH;
      }
    }
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const applySize = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      viewHRef.current = h;
      const cols = lobbyCols();
      const prevCols = colsRef.current;
      colsRef.current = cols;
      const { tile, rowH, total } = computeLayout(w, h, cols);
      tileRef.current = tile;
      const prevH = rowHRef.current;
      rowHRef.current = rowH;
      root.style.setProperty('--lobby-cols', String(cols));
      root.style.setProperty('--lobby-tile', `${tile}px`);
      root.style.setProperty('--lobby-gap', `${GAP_PX}px`);
      root.style.setProperty('--lobby-row-h', `${rowH}px`);

      if (rowsRef.current.length === 0 || prevH !== rowH || prevCols !== cols) {
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
            tiles[Math.floor(rng() * Math.min(tiles.length, cols * 5))]!;
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
    // After React commits row DOM, paint once and size the scroller
    syncScrollerHeight();
    paintAll();
  }, [layoutTick]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let paused = false;

    const syncRowDom = (row: LobbyRow) => {
      const el = rowElsRef.current.get(row.id);
      if (el) el.style.top = `${row.y}px`;
    };

    const isPaused = () => {
      if (document.hidden) return true;
      const root = rootRef.current;
      return !!root?.closest('.stack-base.is-buried');
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
      let moved = false;
      while (rows.length > 0 && rows[0]!.y + rowH <= scrollYRef.current) {
        const row = rows.shift()!;
        row.y = nextYRef.current;
        nextYRef.current = row.y + rowH;
        restockRow(row, rng, eventRef.current?.id ?? null);
        rows.push(row);
        syncRowDom(row);
        moved = true;
      }

      if (scrollYRef.current > rowH * 64) {
        const shift = Math.floor(scrollYRef.current / rowH) * rowH;
        scrollYRef.current -= shift;
        nextYRef.current -= shift;
        for (const row of rows) {
          row.y -= shift;
          syncRowDom(row);
        }
        moved = true;
      }
      if (moved) syncScrollerHeight();
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
          const root = rootRef.current;
          if (root) {
            root.classList.add('event-live', `event-${eid}`);
            const accent = getWorldEvent(eid).accent;
            root.style.setProperty('--event-glow', accent);
          }
          publishEvent(true);
        }
      } else {
        event.remainMs -= dtMs;
        pulseAccRef.current += dtMs;
        if (pulseAccRef.current >= 5000) {
          pulseAccRef.current = 0;
          pulseEvent(allTiles(rows), event.id, rng);
        }
        if (event.remainMs <= 0) {
          for (const t of allTiles(rows)) {
            t.freezeMs = 0;
            t.painted = undefined;
          }
          const root = rootRef.current;
          if (root) {
            root.classList.remove('event-live', `event-${event.id}`);
            root.style.removeProperty('--event-glow');
          }
          eventRef.current = null;
          event = null;
          untilEventRef.current = EVENT_EVERY_MS;
          publishEvent(true);
        } else {
          publishEvent();
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
        if (tile.flashMs > 0) {
          tile.flashMs = Math.max(0, tile.flashMs - dtMs);
          tile.painted = undefined;
        }
        if (tile.freezeMs > 0) {
          tile.freezeMs = Math.max(0, tile.freezeMs - dtMs);
          tile.painted = undefined;
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
          best.painted = undefined;
        }
      }

      paintAll();
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);

      const shouldPause = isPaused();
      if (shouldPause) {
        last = now;
        if (!paused && scrollerRef.current) {
          // Drop will-change while buried so the compositor can rest
          scrollerRef.current.style.willChange = 'auto';
        }
        paused = true;
        return;
      }
      if (paused && scrollerRef.current) {
        scrollerRef.current.style.willChange = 'transform';
        paused = false;
      }

      const dt = Math.min(50, now - last);
      last = now;
      const rng = rngRef.current;

      scrollYRef.current += (SCROLL_SPEED * dt) / 1000;
      recycleOffscreen(rng);

      const scroller = scrollerRef.current;
      if (scroller) {
        // Round to device pixels to avoid thrashing the compositor
        const y = Math.round(scrollYRef.current * 100) / 100;
        scroller.style.transform = `translate3d(0, ${-y}px, 0)`;
      }

      acc += dt;
      if (acc >= TICK_MS) {
        tickSim(acc);
        acc = 0;
      } else {
        // Cheap timer-bar refresh between sim ticks (visible tiles only)
        const eventId = eventRef.current?.id ?? null;
        for (const tile of visibleTilesNow()) {
          const els = tileElsRef.current.get(tile.key);
          if (!els) continue;
          const ratio = Math.max(0, Math.min(1, tile.timerMs / TILE_TIMER_MS));
          els.timer.style.transform = `scaleX(${ratio})`;
          // Decay flash clock visually even between ticks
          if (tile.flashMs > 0) {
            tile.flashMs = Math.max(0, tile.flashMs - dt);
            if (tile.flashMs === 0) paintTile(tile, eventId);
          }
        }
      }
    };

    raf = requestAnimationFrame(loop);
    const onVis = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const rows = rowsRef.current;
  const rowH = rowHRef.current;
  void layoutTick;

  return (
    <div ref={rootRef} className="lobby-auction-bg" aria-hidden>
      <div ref={scrollerRef} className="lobby-auction-scroller">
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
            {row.tiles.map((tile) => (
              <div
                key={tile.key}
                ref={(el) => {
                  if (!el) {
                    tileElsRef.current.delete(tile.key);
                    return;
                  }
                  tileElsRef.current.set(tile.key, {
                    root: el,
                    emoji: el.querySelector('.lobby-auction-emoji')!,
                    price: el.querySelector('.lobby-auction-price')!,
                    timer: el.querySelector('.lobby-auction-timer')!,
                    frost: el.querySelector('.lobby-auction-frost')!,
                  });
                }}
                className="lobby-auction-tile"
              >
                <span className="lobby-auction-emoji" />
                <span className="lobby-auction-price" />
                <span className="lobby-auction-timer" />
                <span className="lobby-auction-frost" hidden aria-hidden />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="lobby-auction-veil" />
    </div>
  );
}
