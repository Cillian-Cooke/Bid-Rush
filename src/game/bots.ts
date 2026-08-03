import { CONFIG } from './constants';
import { handNonBombCount } from './engine';
import { getItem, isHazardItem, isMoneyEngine } from './items';
import type {
  BotArchetype,
  GameState,
  HandItem,
  ItemId,
  Player,
  Tile,
  UseTargets,
} from './types';

export type BotIntent =
  | { kind: 'bid'; tileIndex: number }
  | { kind: 'sell'; instanceId: string }
  | { kind: 'use'; instanceId: string; targets: UseTargets }
  | { kind: 'reorder'; fromIndex: number; toIndex: number };

type ArchProfile = {
  reactionMin: number;
  reactionMax: number;
  sabotage: number;
  rebidChance: number;
  /** How eagerly to force-kill a doomed rival (0–1) */
  letDie: number;
};

const PROFILES: Record<BotArchetype, ArchProfile> = {
  chill: {
    reactionMin: 1200,
    reactionMax: 2500,
    sabotage: 0.15,
    rebidChance: 0.35,
    letDie: 0.7,
  },
  balanced: {
    reactionMin: 600,
    reactionMax: 1500,
    sabotage: 0.45,
    rebidChance: 0.55,
    letDie: 0.85,
  },
  ruthless: {
    reactionMin: 300,
    reactionMax: 900,
    sabotage: 0.85,
    rebidChance: 0.75,
    letDie: 0.95,
  },
};

/** Base shop desire for passives / auras (before synergy & price). */
const PASSIVE_BID: Partial<Record<ItemId, number>> = {
  golden_goose: 52,
  money_printer: 48,
  coin_mine: 46,
  stock_market: 44,
  coin_leech: 42,
  piggy_bank: 40,
  haste_gear: 38,
  interest: 36,
  tip_jar: 34,
  gilder: 32,
  mirror: 30,
  magnet: 28,
  kickback: 26,
  broker: 24,
  chrysalis: 22,
  bank_note: 18,
  // Self-sabotage unless desperate — scored separately
  curse_idol: 4,
};

const ACTIVE_BID: Partial<Record<ItemId, number>> = {
  price_doubler: 28,
  handcuffs: 26,
  fast_forward: 24,
  pickpocket: 24,
  heist_kit: 22,
  quick_swap: 22,
  reset_hammer: 22,
  time_freeze: 22,
  bid_lock: 20,
  swap_portal: 20,
  mute: 18,
  inflation: 16,
  shop_refresh: 16,
  cold_market: 14,
  roi: 14,
  ipo: 14,
  chaos_die: 12,
};

function rngRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function getPlayer(state: GameState, id: string | null): Player | undefined {
  if (!id) return undefined;
  return state.players.find((p) => p.id === id);
}

function committedSpend(state: GameState, playerId: string): number {
  return state.tiles
    .filter((t) => t.highBidderId === playerId)
    .reduce((s, t) => s + t.price, 0);
}

function canAffordNewBid(
  state: GameState,
  player: Player,
  nextPrice: number,
): boolean {
  return committedSpend(state, player.id) + nextPrice <= player.coins;
}

function wouldDieOnTile(state: GameState, tile: Tile): boolean {
  const bidder = getPlayer(state, tile.highBidderId);
  if (!bidder || !bidder.isAlive) return false;
  const other = state.tiles
    .filter((t) => t.highBidderId === bidder.id && t.index !== tile.index)
    .reduce((s, t) => s + t.price, 0);
  return tile.price > bidder.coins || tile.price + other > bidder.coins;
}

function isDoomedLead(state: GameState, tile: Tile): boolean {
  if (!tile.highBidderId) return false;
  if (!wouldDieOnTile(state, tile)) return false;
  return (
    tile.timerMs < 6000 ||
    tile.price > (getPlayer(state, tile.highBidderId)?.coins ?? 0)
  );
}

function isRichest(state: GameState, playerId: string): boolean {
  const alive = state.players.filter((p) => p.isAlive);
  const p = alive.find((x) => x.id === playerId);
  if (!p) return false;
  return alive.every((o) => o.coins <= p.coins);
}

function handHasMoneyEngine(hand: readonly HandItem[]): boolean {
  return hand.some((h) => isMoneyEngine(h.itemId));
}

function handHasAura(hand: readonly HandItem[], id: ItemId): boolean {
  return hand.some((h) => h.itemId === id);
}

function countItem(hand: readonly HandItem[], id: ItemId): number {
  return hand.filter((h) => h.itemId === id).length;
}

function bestMoneyEngineIndex(hand: readonly HandItem[]): number | null {
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < hand.length; i++) {
    const h = hand[i]!;
    if (!isMoneyEngine(h.itemId)) continue;
    const s = h.currentSellValue + (h.golden ? 8 : 0) + (PASSIVE_BID[h.itemId] ?? 0);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return best >= 0 ? best : null;
}

/** How badly we want to keep this hand item (higher = keep). */
function keepValue(hand: readonly HandItem[], index: number): number {
  const h = hand[index];
  if (!h) return -Infinity;
  if (isHazardItem(h.itemId)) return -200;

  let v = h.currentSellValue;

  if (isMoneyEngine(h.itemId)) {
    v += PASSIVE_BID[h.itemId] ?? 30;
    if (h.golden) v += 12;
    // Mirrored engines are especially precious
    const left = hand[index - 1];
    if (left?.itemId === 'mirror') v += 45;
    const right = hand[index + 1];
    if (right?.itemId === 'mirror' && right.golden) v += 45;
    return v;
  }

  if (h.itemId === 'mirror') {
    const right = hand[index + 1];
    if (right && isMoneyEngine(right.itemId)) {
      return 50 + right.currentSellValue + (right.golden ? 10 : 0);
    }
    if (h.golden) {
      const left = hand[index - 1];
      if (left && isMoneyEngine(left.itemId)) {
        return 50 + left.currentSellValue + (left.golden ? 10 : 0);
      }
    }
    // Idle mirror — weak keep unless we expect engines soon
    return handHasMoneyEngine(hand) ? 18 : 10;
  }

  if (h.itemId === 'tip_jar' || h.itemId === 'haste_gear') {
    return handHasMoneyEngine(hand) ? 42 + (h.golden ? 8 : 0) : 14;
  }

  if (h.itemId === 'interest' || h.itemId === 'gilder') {
    return 28 + (h.golden ? 6 : 0) + h.currentSellValue;
  }

  if (h.itemId === 'magnet' || h.itemId === 'kickback' || h.itemId === 'broker') {
    return 22 + h.currentSellValue;
  }

  if (h.itemId === 'chrysalis') {
    return 20 + h.passiveAccMs / 1000;
  }

  if (h.itemId === 'bank_note') {
    return Math.max(4, h.currentSellValue);
  }

  if (h.itemId === 'curse_idol') {
    return -30;
  }

  if (h.itemId === 'mystery_box') {
    return 8;
  }

  // Held actives — keep if useful, else sell for slots/cash
  const def = getItem(h.itemId);
  if (def.kind === 'active') {
    return 12 + h.currentSellValue + (ACTIVE_BID[h.itemId] ?? 0) * 0.25;
  }

  return v + (PASSIVE_BID[h.itemId] ?? 5);
}

function weakestHeld(player: Player): string | null {
  const hand = player.hand;
  let worstId: string | null = null;
  let worstKeep = Infinity;
  for (let i = 0; i < hand.length; i++) {
    const h = hand[i]!;
    if (isHazardItem(h.itemId)) continue;
    const k = keepValue(hand, i);
    if (k < worstKeep) {
      worstKeep = k;
      worstId = h.instanceId;
    }
  }
  return worstId;
}

function findHeld(player: Player, itemId: ItemId) {
  return player.hand.find((h) => h.itemId === itemId);
}

function biggestThreat(state: GameState, selfId: string): Player | null {
  const others = state.players.filter((p) => p.isAlive && p.id !== selfId);
  if (others.length === 0) return null;
  const human = others.find((p) => p.isHuman);
  const richest = others.reduce((a, b) => (b.coins > a.coins ? b : a));
  if (human && human.coins >= richest.coins * 0.7) return human;
  return richest;
}

function scoreTile(
  tile: Tile,
  player: Player,
  state: GameState,
  arch: BotArchetype,
  rng: () => number,
): number {
  if (isHazardItem(tile.itemId)) return -Infinity;
  if (tile.highBidderId === player.id) return -Infinity;

  const activeBids = state.tiles.filter((t) => t.highBidderId === player.id).length;
  if (activeBids >= CONFIG.MAX_ACTIVE_BIDS) return -Infinity;

  const nextPrice = tile.price + CONFIG.BID_INCREMENT;
  if (!canAffordNewBid(state, player, nextPrice)) return -Infinity;

  if (isDoomedLead(state, tile)) {
    if (rng() < PROFILES[arch].letDie) return -Infinity;
  }

  const def = getItem(tile.itemId);
  const hand = player.hand;
  let score = 0;

  if (isMoneyEngine(tile.itemId)) {
    score += PASSIVE_BID[tile.itemId] ?? 40;
    score += (def.passiveAmount ?? 0) * 8;
    // Extra mines stack speed — still want more
    if (tile.itemId === 'coin_mine') {
      score += countItem(hand, 'coin_mine') * 6;
    }
    // Mirror waiting for something to copy
    if (handHasAura(hand, 'mirror')) score += 14;
    if (handHasAura(hand, 'tip_jar') || handHasAura(hand, 'haste_gear')) {
      score += 8;
    }
  } else if (tile.itemId === 'mirror') {
    score += PASSIVE_BID.mirror ?? 30;
    if (handHasMoneyEngine(hand)) score += 28;
    else score -= 6;
    // Don't hoard idle mirrors
    if (countItem(hand, 'mirror') >= 2) score -= 18;
  } else if (tile.itemId === 'tip_jar' || tile.itemId === 'haste_gear') {
    score += PASSIVE_BID[tile.itemId] ?? 30;
    if (handHasMoneyEngine(hand)) score += 16;
    else score -= 4;
    if (countItem(hand, tile.itemId) >= 2) score -= 10;
  } else if (tile.itemId === 'gilder') {
    score += PASSIVE_BID.gilder ?? 30;
    const ungilded = hand.filter(
      (h) => isMoneyEngine(h.itemId) && !h.golden,
    ).length;
    score += ungilded * 10;
  } else if (tile.itemId === 'interest') {
    score += PASSIVE_BID.interest ?? 34;
    score += Math.min(16, hand.length * 3);
  } else if (tile.itemId === 'curse_idol') {
    // Only desperate / ruthless trailing picks
    const richest = Math.max(...state.players.filter((p) => p.isAlive).map((p) => p.coins));
    if (player.coins >= richest * 0.55) return -Infinity;
    score += arch === 'ruthless' ? 12 : 2;
  } else if (def.kind === 'passive') {
    score += PASSIVE_BID[tile.itemId] ?? 12;
  } else if (def.kind === 'active') {
    score += ACTIVE_BID[tile.itemId] ?? 14;
    if (tile.itemId === 'price_doubler' || tile.itemId === 'handcuffs') score += 6;
    if (tile.itemId === 'fast_forward' || tile.itemId === 'heist_kit') score += 4;
  } else {
    score += 6;
  }

  score += Math.max(0, 12 - nextPrice);
  if (tile.timerMs < 2500) score += 10;

  const headroom = player.coins - committedSpend(state, player.id) - nextPrice;
  if (headroom < 2) score -= 12;

  const human = state.players.find((p) => p.isHuman);
  if (
    tile.highBidderId &&
    !isDoomedLead(state, tile) &&
    (tile.highBidderId === human?.id || isRichest(state, tile.highBidderId))
  ) {
    score += PROFILES[arch].sabotage * 15;
  }

  score += (rng() - 0.5) * 8;
  return score;
}

/** Slide Mirror to the left of the best money engine so it copies that engine. */
function decideReorder(player: Player): BotIntent | null {
  const hand = player.hand;
  if (hand.length < 2) return null;

  const engineIdx = bestMoneyEngineIndex(hand);
  if (engineIdx == null) return null;

  for (let mi = 0; mi < hand.length; mi++) {
    const mirror = hand[mi]!;
    if (mirror.itemId !== 'mirror') continue;

    // Already copying this engine from the left
    if (mi === engineIdx - 1) continue;
    // Golden mirror on the right also copies — fine if that's the only engine
    if (mirror.golden && mi === engineIdx + 1) continue;

    // Move mirror to immediately left of the engine
    let toIndex = engineIdx;
    if (mi < engineIdx) toIndex = engineIdx - 1;
    if (toIndex === mi) continue;
    if (toIndex < 0 || toIndex >= hand.length) continue;
    return { kind: 'reorder', fromIndex: mi, toIndex };
  }

  // Park dynamite at the far right so it chews the least (until we sell it)
  for (let di = 0; di < hand.length; di++) {
    if (hand[di]!.itemId !== 'dynamite') continue;
    const last = hand.length - 1;
    if (di !== last) {
      return { kind: 'reorder', fromIndex: di, toIndex: last };
    }
  }

  return null;
}

function decideUse(
  state: GameState,
  player: Player,
  arch: BotArchetype,
  rng: () => number,
): BotIntent | null {
  const profile = PROFILES[arch];
  const threat = biggestThreat(state, player.id);
  const bombTile = state.tiles.find((t) => t.itemId === 'bomb');

  // Force-kill: fast-forward a doomed rival's tile
  const ff = findHeld(player, 'fast_forward');
  if (ff && rng() < profile.letDie) {
    const doomed = state.tiles.find(
      (t) =>
        t.highBidderId &&
        t.highBidderId !== player.id &&
        isDoomedLead(state, t),
    );
    if (doomed) {
      return {
        kind: 'use',
        instanceId: ff.instanceId,
        targets: { tileIndex: doomed.index },
      };
    }
  }

  // Kill shot: double a threat's lead so they can't pay
  const doubler = findHeld(player, 'price_doubler');
  if (doubler && threat && rng() < profile.sabotage) {
    const t = state.tiles.find((tile) => tile.highBidderId === threat.id);
    if (t && threat.coins >= t.price && threat.coins < t.price * 2) {
      return {
        kind: 'use',
        instanceId: doubler.instanceId,
        targets: { tileIndex: t.index },
      };
    }
    if (t && !isDoomedLead(state, t) && rng() < profile.sabotage) {
      return {
        kind: 'use',
        instanceId: doubler.instanceId,
        targets: { tileIndex: t.index },
      };
    }
  }

  // Weaponize bomb via swap onto a threat
  const swap = findHeld(player, 'swap_portal');
  if (swap && bombTile && threat && rng() < profile.sabotage) {
    const leaderTile = state.tiles.find(
      (t) =>
        t.highBidderId === threat.id &&
        t.itemId !== 'bomb' &&
        !isDoomedLead(state, t),
    );
    if (leaderTile) {
      return {
        kind: 'use',
        instanceId: swap.instanceId,
        targets: { tileIndex: bombTile.index, tileIndexB: leaderTile.index },
      };
    }
  }

  // Handcuffs on threat
  const cuffs = findHeld(player, 'handcuffs');
  if (cuffs && threat && threat.handcuffMs <= 0 && rng() < profile.sabotage) {
    return {
      kind: 'use',
      instanceId: cuffs.instanceId,
      targets: { playerId: threat.id },
    };
  }

  // Mute threat passives
  const mute = findHeld(player, 'mute');
  if (mute && threat && threat.muteMs <= 0 && rng() < profile.sabotage * 0.85) {
    return {
      kind: 'use',
      instanceId: mute.instanceId,
      targets: { playerId: threat.id },
    };
  }

  // Heist / pickpocket / quick swap threat
  const heist = findHeld(player, 'heist_kit');
  if (heist && threat && threat.hand.length > 0 && rng() < 0.4 + profile.sabotage * 0.2) {
    return {
      kind: 'use',
      instanceId: heist.instanceId,
      targets: { playerId: threat.id },
    };
  }

  const quick = findHeld(player, 'quick_swap');
  if (quick && threat && rng() < 0.35 + profile.sabotage * 0.35) {
    return {
      kind: 'use',
      instanceId: quick.instanceId,
      targets: { playerId: threat.id },
    };
  }

  const pp = findHeld(player, 'pickpocket');
  if (pp && threat && threat.coins > 0 && rng() < 0.4) {
    return {
      kind: 'use',
      instanceId: pp.instanceId,
      targets: { playerId: threat.id },
    };
  }

  // Bid lock own valuable lead
  const lock = findHeld(player, 'bid_lock');
  if (lock && rng() < 0.45) {
    const mine = state.tiles
      .filter(
        (t) =>
          t.highBidderId === player.id &&
          !t.bidLocked &&
          player.coins >= t.price &&
          (isMoneyEngine(t.itemId) || t.price >= 4),
      )
      .sort((a, b) => b.price - a.price)[0];
    if (mine) {
      return {
        kind: 'use',
        instanceId: lock.instanceId,
        targets: { tileIndex: mine.index },
      };
    }
  }

  // Freeze own resolving lead we can pay, or freeze a contested steal
  const freeze = findHeld(player, 'time_freeze');
  if (freeze) {
    if (freeze.golden && rng() < 0.35) {
      return { kind: 'use', instanceId: freeze.instanceId, targets: {} };
    }
    const ownUrgent = state.tiles.find(
      (t) =>
        t.highBidderId === player.id &&
        t.timerMs < 3500 &&
        player.coins >= t.price &&
        t.freezeMs <= 0,
    );
    if (ownUrgent && rng() < 0.55) {
      return {
        kind: 'use',
        instanceId: freeze.instanceId,
        targets: { tileIndex: ownUrgent.index },
      };
    }
    if (threat && rng() < profile.sabotage * 0.6) {
      const rivalLead = state.tiles.find(
        (t) =>
          t.highBidderId === threat.id &&
          !isDoomedLead(state, t) &&
          t.freezeMs <= 0,
      );
      if (rivalLead) {
        return {
          kind: 'use',
          instanceId: freeze.instanceId,
          targets: { tileIndex: rivalLead.index },
        };
      }
    }
  }

  // Fast-forward own lead only if we can pay
  if (ff) {
    const mine = state.tiles.find(
      (t) => t.highBidderId === player.id && player.coins >= t.price,
    );
    if (mine && rng() < 0.5) {
      return {
        kind: 'use',
        instanceId: ff.instanceId,
        targets: { tileIndex: mine.index },
      };
    }
  }

  // Inflation when we lead the board / want to squeeze wallets
  const inflation = findHeld(player, 'inflation');
  if (inflation && rng() < 0.28 + profile.sabotage * 0.2) {
    const myLeads = state.tiles.filter((t) => t.highBidderId === player.id).length;
    const rivalLeads = state.tiles.filter(
      (t) => t.highBidderId && t.highBidderId !== player.id,
    ).length;
    if (myLeads >= 1 || rivalLeads >= 2) {
      return { kind: 'use', instanceId: inflation.instanceId, targets: {} };
    }
  }

  // Cold market when threat is farming hard
  const cold = findHeld(player, 'cold_market');
  if (cold && threat && state.coldMarketMs <= 0 && rng() < profile.sabotage * 0.5) {
    if (handHasMoneyEngine(threat.hand) || threat.coins > player.coins) {
      return { kind: 'use', instanceId: cold.instanceId, targets: {} };
    }
  }

  // ROI when sitting on a pile
  const roi = findHeld(player, 'roi');
  if (roi && player.coins >= 12 && player.roiTargetCoins == null && rng() < 0.4) {
    return { kind: 'use', instanceId: roi.instanceId, targets: {} };
  }

  const hammer = findHeld(player, 'reset_hammer');
  if (hammer) {
    const ownExpensive = [...state.tiles]
      .filter(
        (t) =>
          !isHazardItem(t.itemId) &&
          isMoneyEngine(t.itemId) &&
          !isDoomedLead(state, t) &&
          (t.highBidderId === null || t.highBidderId === player.id),
      )
      .sort((a, b) => b.price - a.price)[0];
    if (ownExpensive && ownExpensive.price >= 5 && rng() < 0.35) {
      return {
        kind: 'use',
        instanceId: hammer.instanceId,
        targets: { tileIndex: ownExpensive.index },
      };
    }
    const rival = state.tiles.find(
      (t) =>
        t.price >= 5 &&
        !isDoomedLead(state, t) &&
        t.highBidderId !== null &&
        t.highBidderId !== player.id,
    );
    if (rival && rng() < 0.35) {
      return {
        kind: 'use',
        instanceId: hammer.instanceId,
        targets: { tileIndex: rival.index },
      };
    }
  }

  const refresh = findHeld(player, 'shop_refresh');
  if (refresh) {
    const good = state.tiles.filter(
      (t) =>
        (isMoneyEngine(t.itemId) ||
          t.itemId === 'mirror' ||
          t.itemId === 'tip_jar' ||
          t.itemId === 'haste_gear') &&
        t.price <= 3,
    ).length;
    if (good === 0 && rng() < 0.4) {
      return { kind: 'use', instanceId: refresh.instanceId, targets: {} };
    }
  }

  const die = findHeld(player, 'chaos_die');
  if (die && rng() < 0.22) {
    return { kind: 'use', instanceId: die.instanceId, targets: {} };
  }

  const ipo = findHeld(player, 'ipo');
  if (ipo && rng() < 0.35) {
    if (ipo.golden) {
      return { kind: 'use', instanceId: ipo.instanceId, targets: {} };
    }
    const cashables = player.hand.filter(
      (h) =>
        h.instanceId !== ipo.instanceId &&
        !isHazardItem(h.itemId) &&
        h.itemId !== 'ipo',
    );
    if (cashables.length > 0) {
      let best = cashables[0]!;
      for (const h of cashables) {
        if (h.currentSellValue > best.currentSellValue) best = h;
      }
      // Don't IPO away a mirrored engine or the mirror copying it
      const bestIdx = player.hand.findIndex((h) => h.instanceId === best.instanceId);
      if (bestIdx >= 0 && keepValue(player.hand, bestIdx) < 40 && best.currentSellValue >= 3) {
        return {
          kind: 'use',
          instanceId: ipo.instanceId,
          targets: { handInstanceId: best.instanceId },
        };
      }
    }
  }

  return null;
}

/** Pure bot decision: returns at most one intent, or null. */
export function decideBotAction(
  state: GameState,
  playerId: string,
  rng: () => number = Math.random,
): BotIntent | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.isAlive || player.isHuman) return null;
  if (player.handcuffMs > 0) return null;

  const arch = player.archetype ?? 'balanced';
  const profile = PROFILES[arch];

  // 1. Safety: dump hazards immediately — unless we're planting via Quick Swap
  const hazard = player.hand.find((h) => isHazardItem(h.itemId));
  if (hazard) {
    const planting = state.pendingQuickSwaps.some(
      (p) => p.casterId === player.id && !p.golden && p.msLeft > 0,
    );
    const qs = findHeld(player, 'quick_swap');
    const threat = biggestThreat(state, player.id);
    if (qs && threat && rng() < profile.sabotage) {
      return {
        kind: 'use',
        instanceId: qs.instanceId,
        targets: { playerId: threat.id },
      };
    }
    if (planting) {
      const hi = player.hand.findIndex((h) => h.instanceId === hazard.instanceId);
      if (hi > 0) {
        return { kind: 'reorder', fromIndex: hi, toIndex: 0 };
      }
      // Hazard already leftmost — hold still for the swap
      return null;
    }
    return { kind: 'sell', instanceId: hazard.instanceId };
  }

  // Sell curse idol unless intentionally desperate
  const curse = player.hand.find((h) => h.itemId === 'curse_idol');
  if (curse) {
    const richest = Math.max(
      0,
      ...state.players.filter((p) => p.isAlive).map((p) => p.coins),
    );
    if (player.coins >= richest * 0.5 || arch === 'chill') {
      return { kind: 'sell', instanceId: curse.instanceId };
    }
  }

  // Sell to cover looming payments about to resolve
  const looming = state.tiles.filter(
    (t) => t.highBidderId === player.id && t.timerMs < 4000,
  );
  const totalDue = looming.reduce((s, t) => s + t.price, 0);
  if (totalDue > player.coins && player.hand.length > 0) {
    const sellId = weakestHeld(player);
    if (sellId) return { kind: 'sell', instanceId: sellId };
  }

  // 2. Arrange mirror next to the best engine before other plays
  if (rng() < 0.7) {
    const reorder = decideReorder(player);
    if (reorder) return reorder;
  }

  // 3. Hand management — free a slot for better engines (only if affordable)
  if (handNonBombCount(player) >= CONFIG.HAND_SLOTS) {
    const bestBoard = state.tiles
      .filter(
        (t) =>
          (isMoneyEngine(t.itemId) ||
            t.itemId === 'mirror' ||
            t.itemId === 'tip_jar' ||
            t.itemId === 'haste_gear') &&
          !isHazardItem(t.itemId),
      )
      .sort((a, b) => a.price - b.price)[0];
    if (bestBoard && canAffordNewBid(state, player, bestBoard.price + 1)) {
      const sellId = weakestHeld(player);
      if (sellId) {
        const idx = player.hand.findIndex((h) => h.instanceId === sellId);
        // Don't eject a mirrored engine or active mirror copy for a marginal shop tile
        if (idx < 0 || keepValue(player.hand, idx) < 48) {
          return { kind: 'sell', instanceId: sellId };
        }
      }
    }
  }

  // 4. Use actives (kills, sabotage, utility)
  const useIntent = decideUse(state, player, arch, rng);
  if (useIntent) return useIntent;

  // 5. Shop evaluation / bid
  const scored = state.tiles
    .map((t) => ({ t, s: scoreTile(t, player, state, arch, rng) }))
    .filter((x) => x.s > -Infinity)
    .sort((a, b) => b.s - a.s);

  const top = scored[0];
  if (top && top.s > 5) {
    const contested = scored.find(
      (x) =>
        x.t.highBidderId !== null &&
        x.t.highBidderId !== player.id &&
        !isDoomedLead(state, x.t) &&
        x.s > 10,
    );
    if (contested && rng() < PROFILES[arch].rebidChance) {
      return { kind: 'bid', tileIndex: contested.t.index };
    }
    return { kind: 'bid', tileIndex: top.t.index };
  }

  // Idle: sell junk / mystery if hand is cluttered
  if (player.hand.length >= 4 && rng() < 0.25) {
    const sellId = weakestHeld(player);
    if (sellId) {
      const idx = player.hand.findIndex((h) => h.instanceId === sellId);
      if (idx >= 0 && keepValue(player.hand, idx) < 16) {
        return { kind: 'sell', instanceId: sellId };
      }
    }
  }

  return null;
}

export function nextBotCooldown(arch: BotArchetype, rng: () => number): number {
  const p = PROFILES[arch];
  return rngRange(rng, p.reactionMin, p.reactionMax);
}
