import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../game/constants';
import { getItem } from '../game/items';
import type { HandItem, Player } from '../game/types';
import type { FxInstance } from '../store';

type Props = {
  player: Player;
  activeFx: FxInstance[];
  coldMarketMs?: number;
};

type EffectCell = {
  key: string;
  emoji: string;
  count: number;
  golden: boolean;
};

type Flash = {
  key: string;
  emoji: string;
  golden?: boolean;
  /** Progress 0–1 remaining; null = no bar (brief pop) */
  progress: number | null;
  until?: number;
};

const BUFF_IDS = new Set([
  'coin_mine',
  'money_printer',
  'golden_goose',
  'stock_market',
  'interest',
  'chrysalis',
  'piggy_bank',
  'coin_leech',
  'mirror',
  'gilder',
  'tip_jar',
  'haste_gear',
  'magnet',
  'kickback',
  'broker',
  'curse_idol',
]);

const BRIEF_MS = 3_000;

function buildGrid(hand: HandItem[]): EffectCell[] {
  const map = new Map<string, EffectCell>();
  for (const item of hand) {
    if (!BUFF_IDS.has(item.itemId)) continue;
    const key = `${item.itemId}:${item.golden ? 'g' : 'n'}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      const def = getItem(item.itemId);
      map.set(key, {
        key,
        emoji: def.emoji,
        count: 1,
        golden: item.golden,
      });
    }
  }
  return [...map.values()].slice(0, 9);
}

export function PurseEffects({ player, activeFx, coldMarketMs = 0 }: Props) {
  const seenBuffs = useRef(new Set<string>());
  const seenFx = useRef(new Set<number>());
  const cuffPeak = useRef(CONFIG.HANDCUFF_MS as number);
  const mutePeak = useRef(CONFIG.MUTE_MS as number);
  const roiPeak = useRef(CONFIG.ROI_MS as number);
  const coldPeak = useRef(CONFIG.COLD_MARKET_MS as number);
  const [brief, setBrief] = useState<Flash | null>(null);
  const primed = useRef(false);

  useEffect(() => {
    if (primed.current) return;
    for (const item of player.hand) {
      if (BUFF_IDS.has(item.itemId)) seenBuffs.current.add(item.instanceId);
    }
    primed.current = true;
  }, [player.hand]);

  useEffect(() => {
    for (const item of player.hand) {
      if (!BUFF_IDS.has(item.itemId)) continue;
      if (seenBuffs.current.has(item.instanceId)) continue;
      seenBuffs.current.add(item.instanceId);
      const def = getItem(item.itemId);
      setBrief({
        key: `buff-${item.instanceId}`,
        emoji: def.emoji,
        golden: item.golden,
        progress: null,
        until: performance.now() + BRIEF_MS,
      });
    }
    const live = new Set(player.hand.map((h) => h.instanceId));
    for (const id of [...seenBuffs.current]) {
      if (!live.has(id)) seenBuffs.current.delete(id);
    }
  }, [player.hand]);

  useEffect(() => {
    for (const f of activeFx) {
      if (seenFx.current.has(f.id)) continue;
      if (f.targetPlayerId !== player.id) continue;
      if (f.kind !== 'pickpocket' && f.kind !== 'leech' && f.kind !== 'heist' && f.kind !== 'quick_swap') {
        continue;
      }
      seenFx.current.add(f.id);
      setBrief({
        key: `fx-${f.id}`,
        emoji:
          f.kind === 'pickpocket'
            ? '🧤'
            : f.kind === 'heist'
              ? '🥷'
              : f.kind === 'quick_swap'
                ? '🔀'
                : '🧛',
        progress: null,
        until: performance.now() + BRIEF_MS,
      });
    }
  }, [activeFx, player.id]);

  useEffect(() => {
    if (player.handcuffMs > cuffPeak.current) cuffPeak.current = player.handcuffMs;
    if (player.handcuffMs <= 0) cuffPeak.current = CONFIG.HANDCUFF_MS;
    if (player.muteMs > mutePeak.current) mutePeak.current = player.muteMs;
    if (player.muteMs <= 0) mutePeak.current = CONFIG.MUTE_MS;
    if (player.roiMs > roiPeak.current) roiPeak.current = player.roiMs;
    if (player.roiMs <= 0) roiPeak.current = CONFIG.ROI_MS;
    if (coldMarketMs > coldPeak.current) coldPeak.current = coldMarketMs;
    if (coldMarketMs <= 0) coldPeak.current = CONFIG.COLD_MARKET_MS;
  }, [player.handcuffMs, player.muteMs, player.roiMs, coldMarketMs]);

  useEffect(() => {
    if (!brief?.until) return;
    const left = brief.until - performance.now();
    if (left <= 0) {
      setBrief(null);
      return;
    }
    const t = window.setTimeout(() => setBrief(null), left);
    return () => window.clearTimeout(t);
  }, [brief]);

  const grid = buildGrid(player.hand);

  let flash: Flash | null = null;
  if (player.handcuffMs > 0) {
    flash = {
      key: 'cuffs',
      emoji: '🔒',
      progress: Math.max(0, Math.min(1, player.handcuffMs / cuffPeak.current)),
    };
  } else if (coldMarketMs > 0) {
    flash = {
      key: 'cold',
      emoji: '🧊',
      progress: Math.max(0, Math.min(1, coldMarketMs / coldPeak.current)),
    };
  } else if (player.muteMs > 0) {
    flash = {
      key: 'mute',
      emoji: '🔇',
      progress: Math.max(0, Math.min(1, player.muteMs / mutePeak.current)),
    };
  } else if (player.roiMs > 0) {
    flash = {
      key: 'roi',
      emoji: '📉',
      progress: Math.max(0, Math.min(1, player.roiMs / roiPeak.current)),
    };
  } else if (brief) {
    flash = brief;
  }

  return (
    <div
      className={`purse-effects${flash ? ' flash-mode' : ''}`}
      aria-label="Active effects"
    >
      {flash ? (
        <div
          className={`purse-effect-flash${flash.golden ? ' golden' : ''}`}
          key={flash.key}
        >
          <span className="purse-effect-flash-emoji">{flash.emoji}</span>
          {flash.key === 'roi' && player.roiTargetCoins > 0 && (
            <span className="purse-effect-flash-meta">
              →{player.roiTargetCoins}
            </span>
          )}
          {flash.progress != null && (
            <span className="purse-effect-flash-bar" aria-hidden>
              <span
                className="purse-effect-flash-fill"
                style={{ transform: `scaleX(${flash.progress})` }}
              />
            </span>
          )}
        </div>
      ) : (
        <div className="purse-effect-grid">
          {grid.map((cell) => (
            <div
              key={cell.key}
              className={`purse-effect-cell${cell.golden ? ' golden' : ''}`}
              title={cell.count > 1 ? `${cell.count}×` : undefined}
            >
              <span className="purse-effect-emoji">{cell.emoji}</span>
              {cell.count > 1 && (
                <span className="purse-effect-count">{cell.count}×</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
