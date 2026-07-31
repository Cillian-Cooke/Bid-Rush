import { useState } from 'react';
import { X } from 'lucide-react';
import { ITEM_LIST } from '../game/items';

type Props = { onClose: () => void };

function regularBlurb(id: string): string {
  const map: Record<string, string> = {
    coin_mine: 'Passive: +1 coin every few seconds while held.',
    money_printer: 'Passive: +2 coins on a slower tick while held.',
    golden_goose: 'Passive: fastest steady +1 income while held.',
    dividend_stock: 'Passive: pays coins and its sell value grows over time.',
    piggy_bank: 'Passive: banks coins into itself — sell to cash out.',
    mystery_box: 'Sell-only gamble: random payout between 1 and 20.',
    price_doubler: 'Active: double a shop tile’s price instantly.',
    discount_tag: 'Active: halve a tile’s price (round up).',
    reset_hammer: 'Active: smash a tile back to price 1 and clear its leader.',
    inflation: 'Active: +2 price on every shop tile.',
    time_freeze: 'Active: freeze one tile’s timer for a few seconds.',
    fast_forward: 'Active: resolve a tile immediately.',
    overtime: 'Active: add time to a tile’s auction clock.',
    swap_portal: 'Active: swap two tiles’ item and price — bids stay put.',
    shop_refresh: 'Active: restock the whole board.',
    shuffle: 'Active: scramble tile positions (state travels with them).',
    handcuffs: 'Active: stop a player from bidding briefly.',
    pickpocket: 'Active: steal coins from a rival.',
    coin_leech: 'Passive: drain the richest living opponent over time.',
    bomb: 'Scare item: fuse on pickup — sell to defuse, or explode.',
    bid_lock: 'Active: lock a tile so nobody can outbid it (swaps still work).',
    blank_slate: 'Active: doubles your coins on use.',
    echo_lens: 'Passive: doubles the item to its right.',
    gilder: 'Passive: after 30s, turns the item on its right golden.',
    tip_jar: 'Passive: +1 coin on every passive payout you earn.',
    haste_gear: 'Passive: speeds up all your ticking passives (×1.5).',
  };
  return map[id] ?? '';
}

function goldenBlurb(id: string): string {
  const map: Record<string, string> = {
    coin_mine: 'Golden: double payout every tick. Merge 3 → golden.',
    money_printer: 'Golden: double payout every tick.',
    golden_goose: 'Golden: double payout every tick.',
    dividend_stock: 'Golden: double income and sell-value growth.',
    piggy_bank: 'Golden: stores coins twice as fast.',
    mystery_box: 'Golden: rolls twice and sums them (1–20 + 1–20).',
    price_doubler: 'Golden: doubles a tile’s price twice (×4).',
    discount_tag: 'Golden: halves a tile’s price twice.',
    reset_hammer: 'Golden: also resets a second random tile.',
    inflation: 'Golden: +4 price on every shop tile.',
    time_freeze: 'Golden: mega-freeze the whole board briefly.',
    fast_forward: 'Golden: also resolves a second random tile.',
    overtime: 'Golden: twice the bonus time.',
    swap_portal: 'Golden: swap a hand item with a board tile.',
    shop_refresh: 'Golden: also −1 price and +2s on every tile.',
    shuffle: 'Golden: also −1 price on every tile.',
    handcuffs: 'Golden: twice as long.',
    pickpocket: 'Golden: steal twice as much.',
    coin_leech: 'Golden: double drain.',
    bomb: 'Golden: fuse times add on merge; sells for 100.',
    bid_lock: 'Golden: also freezes that tile.',
    blank_slate: 'Golden: doubles your coins twice (×4).',
    echo_lens: 'Golden: also doubles the item to its left.',
    gilder: 'Golden: turns both neighbors golden.',
    tip_jar: 'Golden: +2 coin on every passive payout.',
    haste_gear: 'Golden: ×2 passive speed.',
  };
  return map[id] ?? '';
}

export function ItemsCodex({ onClose }: Props) {
  const [goldenById, setGoldenById] = useState<Record<string, boolean>>({});

  return (
    <div className="codex-overlay" role="dialog" aria-label="Item guide">
      <div className="codex-sheet">
        <div className="codex-head">
          <h2>Item Guide</h2>
          <button type="button" className="codex-close" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>
        <ul className="codex-list">
          {ITEM_LIST.map((item) => {
            const golden = !!goldenById[item.id];
            return (
              <li
                key={item.id}
                className={`codex-row${golden ? ' golden-view' : ''}`}
              >
                <span className="codex-emoji" aria-hidden>
                  {item.emoji}
                </span>
                <div className="codex-body">
                  <div className="codex-name">
                    {golden ? `Golden ${item.name}` : item.name}
                    <span className="codex-kind">{item.kind}</span>
                  </div>
                  <div className="codex-toggle" role="group" aria-label="Variant">
                    <button
                      type="button"
                      className={!golden ? 'on' : ''}
                      onClick={() =>
                        setGoldenById((s) => ({ ...s, [item.id]: false }))
                      }
                    >
                      Regular
                    </button>
                    <button
                      type="button"
                      className={golden ? 'on' : ''}
                      onClick={() =>
                        setGoldenById((s) => ({ ...s, [item.id]: true }))
                      }
                    >
                      Golden
                    </button>
                  </div>
                  <p>{golden ? goldenBlurb(item.id) : regularBlurb(item.id)}</p>
                  <span className="codex-sell">
                    Sell ≈ {item.sellValue || 'special'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
