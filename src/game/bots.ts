import { CONFIG } from './constants';
import { handNonBombCount } from './engine';
import { getItem, isMoneyEngine } from './items';
import type {
  BotArchetype,
  GameState,
  ItemId,
  Player,
  Tile,
  UseTargets,
} from './types';

export type BotIntent =
  | { kind: 'bid'; tileIndex: number }
  | { kind: 'sell'; instanceId: string }
  | { kind: 'use'; instanceId: string; targets: UseTargets };

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

function rngRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function getPlayer(state: GameState, id: string | null): Player | undefined {
  if (!id) return undefined;
  return state.players.find((p) => p.id === id);
}

/** Sum of prices on tiles this player currently leads. */
function committedSpend(state: GameState, playerId: string): number {
  return state.tiles
    .filter((t) => t.highBidderId === playerId)
    .reduce((s, t) => s + t.price, 0);
}

/**
 * Hard wallet check: never bid into a price you couldn't pay even if every
 * lead resolved back-to-back with no extra income.
 */
function canAffordNewBid(
  state: GameState,
  player: Player,
  nextPrice: number,
): boolean {
  return committedSpend(state, player.id) + nextPrice <= player.coins;
}

/** True if paying this tile's price (plus other leads) would eliminate them. */
function wouldDieOnTile(state: GameState, tile: Tile): boolean {
  const bidder = getPlayer(state, tile.highBidderId);
  if (!bidder || !bidder.isAlive) return false;
  const other = state.tiles
    .filter((t) => t.highBidderId === bidder.id && t.index !== tile.index)
    .reduce((s, t) => s + t.price, 0);
  // They die if this tile alone exceeds coins, or total commitments do
  return tile.price > bidder.coins || tile.price + other > bidder.coins;
}

/** Rival is overcommitted and close to resolving — leave them alone. */
function isDoomedLead(state: GameState, tile: Tile): boolean {
  if (!tile.highBidderId) return false;
  if (!wouldDieOnTile(state, tile)) return false;
  // Especially clear when the fuse is short
  return tile.timerMs < 6000 || tile.price > (getPlayer(state, tile.highBidderId)?.coins ?? 0);
}

function scoreTile(
  tile: Tile,
  player: Player,
  state: GameState,
  arch: BotArchetype,
  rng: () => number,
): number {
  if (tile.itemId === 'bomb' || tile.itemId === 'dynamite') return -Infinity;
  if (tile.highBidderId === player.id) return -Infinity;

  const activeBids = state.tiles.filter((t) => t.highBidderId === player.id).length;
  if (activeBids >= CONFIG.MAX_ACTIVE_BIDS) return -Infinity;

  const nextPrice = tile.price + CONFIG.BID_INCREMENT;

  // Never bid more than they can pay across all active leads
  if (!canAffordNewBid(state, player, nextPrice)) return -Infinity;

  // Let doomed rivals die — don't steal their losing bid
  if (isDoomedLead(state, tile)) {
    if (rng() < PROFILES[arch].letDie) return -Infinity;
  }

  const def = getItem(tile.itemId);
  let score = 0;

  if (isMoneyEngine(tile.itemId)) {
    score += 40 + (def.passiveAmount ?? 0) * 10;
    score += Math.max(0, 15 - nextPrice * 2);
  } else if (def.kind === 'active') {
    score += 18;
    if (tile.itemId === 'price_doubler' || tile.itemId === 'handcuffs') score += 8;
    if (tile.itemId === 'fast_forward' || tile.itemId === 'swap_portal') score += 6;
  } else {
    score += 5;
  }

  score += Math.max(0, 12 - nextPrice);
  if (tile.timerMs < 2500) score += 10;

  // Prefer staying comfortably under wallet
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

function isRichest(state: GameState, playerId: string): boolean {
  const alive = state.players.filter((p) => p.isAlive);
  const p = alive.find((x) => x.id === playerId);
  if (!p) return false;
  return alive.every((o) => o.coins <= p.coins);
}

function weakestHeld(player: Player): string | null {
  const candidates = player.hand.filter(
    (h) => h.itemId !== 'bomb' && h.itemId !== 'dynamite',
  );
  if (candidates.length === 0) return null;
  let worst = candidates[0]!;
  for (const h of candidates) {
    if (h.currentSellValue < worst.currentSellValue) worst = h;
  }
  return worst.instanceId;
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
    // Also double any non-doomed threat lead
    if (t && !isDoomedLead(state, t) && rng() < profile.sabotage) {
      return {
        kind: 'use',
        instanceId: doubler.instanceId,
        targets: { tileIndex: t.index },
      };
    }
  }

  if (rng() > 0.35 + profile.sabotage * 0.4) {
    // Still allow kill-oriented uses above; fall through for others less often
  }

  // Weaponize bomb via swap onto a threat (not onto someone already dying)
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

  // Pickpocket
  const pp = findHeld(player, 'pickpocket');
  if (pp && threat && threat.coins > 0 && rng() < 0.4) {
    return {
      kind: 'use',
      instanceId: pp.instanceId,
      targets: { playerId: threat.id },
    };
  }

  const hammer = findHeld(player, 'reset_hammer');
  if (hammer) {
    const ownExpensive = [...state.tiles]
      .filter(
        (t) =>
          t.itemId !== 'bomb' &&
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
    const good = state.tiles.filter((t) => isMoneyEngine(t.itemId) && t.price <= 3).length;
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
        h.itemId !== 'bomb' &&
        h.itemId !== 'dynamite' &&
        h.itemId !== 'ipo',
    );
    if (cashables.length > 0) {
      let best = cashables[0]!;
      for (const h of cashables) {
        if (h.currentSellValue > best.currentSellValue) best = h;
      }
      if (best.currentSellValue >= 3) {
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

  // 1. Safety: sell bomb immediately
  const bomb = player.hand.find((h) => h.itemId === 'bomb');
  if (bomb) {
    return { kind: 'sell', instanceId: bomb.instanceId };
  }

  // Sell to cover ALL looming payments (not just the max one)
  const looming = state.tiles.filter(
    (t) => t.highBidderId === player.id && t.timerMs < 4000,
  );
  const totalDue = looming.reduce((s, t) => s + t.price, 0);
  if (totalDue > player.coins && player.hand.length > 0) {
    const sellId = weakestHeld(player);
    if (sellId) return { kind: 'sell', instanceId: sellId };
  }

  // Also bail: if already overcommitted overall, sell to free cash
  if (committedSpend(state, player.id) > player.coins && player.hand.length > 0) {
    const sellId = weakestHeld(player);
    if (sellId) return { kind: 'sell', instanceId: sellId };
  }

  // 2. Hand management — free a slot for better engines (only if affordable)
  if (handNonBombCount(player) >= CONFIG.HAND_SLOTS) {
    const bestBoard = state.tiles
      .filter((t) => isMoneyEngine(t.itemId) && t.itemId !== 'bomb')
      .sort((a, b) => a.price - b.price)[0];
    if (bestBoard && canAffordNewBid(state, player, bestBoard.price + 1)) {
      const sellId = weakestHeld(player);
      if (sellId) return { kind: 'sell', instanceId: sellId };
    }
  }

  // 3. Use actives (kills, sabotage, safe self-FF)
  const useIntent = decideUse(state, player, arch, rng);
  if (useIntent) return useIntent;

  // 4. Shop evaluation / bid
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

  return null;
}

export function nextBotCooldown(arch: BotArchetype, rng: () => number): number {
  const p = PROFILES[arch];
  return rngRange(rng, p.reactionMin, p.reactionMax);
}
