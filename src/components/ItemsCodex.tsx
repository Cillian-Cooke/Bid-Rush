import { X } from 'lucide-react';
import { ITEM_LIST } from '../game/items';

type Props = { onClose: () => void };

function effectBlurb(id: string): string {
  const map: Record<string, string> = {
    coin_mine: 'Passive: +1 coin every few seconds while held.',
    money_printer: 'Passive: +2 coins on a slower tick while held.',
    golden_goose: 'Passive: fastest steady +1 income while held.',
    dividend_stock: 'Passive: pays coins and its sell value grows over time.',
    piggy_bank: 'Passive: banks coins into itself — cash out by selling.',
    mystery_box: 'Sell-only gamble: random payout between 1 and 20.',
    price_doubler: 'Active: double a shop tile’s price instantly.',
    discount_tag: 'Active: halve a tile’s price (round up).',
    reset_hammer: 'Active: smash a tile back to price 1 and clear its leader.',
    inflation: 'Active: +2 price on every shop tile.',
    time_freeze: 'Active: freeze one tile’s timer for a few seconds.',
    fast_forward: 'Active: resolve a tile immediately.',
    overtime: 'Active: add time to a tile’s auction clock.',
    swap_portal: 'Active: swap two tiles entirely — great for bomb plays.',
    shop_refresh: 'Active: restock the whole board.',
    shuffle: 'Active: scramble tile positions (state travels with them).',
    handcuffs: 'Active: stop a player from bidding briefly.',
    pickpocket: 'Active: steal coins from a rival.',
    coin_leech: 'Passive: drain the richest living opponent over time.',
    bomb: 'Scare item: fuse on pickup — sell to defuse, or explode.',
  };
  return map[id] ?? '';
}

export function ItemsCodex({ onClose }: Props) {
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
          {ITEM_LIST.map((item) => (
            <li key={item.id} className="codex-row">
              <span className="codex-emoji">{item.emoji}</span>
              <div className="codex-body">
                <div className="codex-name">
                  {item.name}
                  <span className="codex-kind">{item.kind}</span>
                </div>
                <p>{effectBlurb(item.id)}</p>
                <span className="codex-sell">Sell ≈ {item.sellValue || 'special'}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
