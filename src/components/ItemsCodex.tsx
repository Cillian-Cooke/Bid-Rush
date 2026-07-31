import { X } from 'lucide-react';
import { ITEM_LIST } from '../game/items';

type Props = { onClose: () => void };

function effectBlurb(id: string): string {
  const map: Record<string, string> = {
    coin_mine:
      'Passive: +1 coin every few seconds. Golden: double payout. Merge 3 → golden.',
    money_printer:
      'Passive: +2 coins on a slower tick. Golden: double payout.',
    golden_goose:
      'Passive: fastest steady +1 income. Golden: double payout.',
    dividend_stock:
      'Passive: pays coins and sell value grows. Golden: double both.',
    piggy_bank:
      'Passive: banks coins into itself — sell to cash out. Golden: stores twice as fast.',
    mystery_box:
      'Sell-only gamble: 1–20 coins. Golden: rolls twice and sums them.',
    price_doubler:
      'Active: double a shop tile’s price. Golden: doubles twice (×4).',
    discount_tag:
      'Active: halve a tile’s price. Golden: halves twice.',
    reset_hammer:
      'Active: smash a tile to price 1 and clear its leader. Golden: also resets a second random tile.',
    inflation:
      'Active: +2 price on every shop tile. Golden: +4.',
    time_freeze:
      'Active: freeze one tile’s timer. Golden: mega-freeze the whole board.',
    fast_forward:
      'Active: resolve a tile immediately. Golden: also resolves a second random tile.',
    overtime:
      'Active: add time to a tile’s clock. Golden: twice the bonus time.',
    swap_portal:
      'Active: swap two tiles’ item+price. Golden: swap a hand item with a board tile.',
    shop_refresh:
      'Active: restock the whole board. Golden: also −1 price and +2s on every tile.',
    shuffle:
      'Active: scramble tile positions. Golden: also −1 price on every tile.',
    handcuffs:
      'Active: stop a player from bidding briefly. Golden: twice as long.',
    pickpocket:
      'Active: steal coins from a rival. Golden: steal twice as much.',
    coin_leech:
      'Passive: drain the richest opponent over time. Golden: double drain.',
    bomb:
      'Scare item: fuse on pickup — sell to defuse. Golden: fuse times add on merge, sells for 100.',
    bid_lock:
      'Active: lock a tile so nobody can outbid it. Golden: also freezes that tile.',
    blank_slate:
      'Active: doubles your coins on use. Golden: doubles twice (×4).',
    echo_lens:
      'Passive: doubles the item to its right. Golden: also doubles the item to its left.',
    gilder:
      'Passive: after 30s, turns the item on its right golden. Golden: both neighbors.',
    tip_jar:
      'Passive: +1 coin on every passive payout you earn. Golden: +2 per payout.',
    haste_gear:
      'Passive: speeds up all your ticking passives (×1.5). Golden: ×2 speed.',
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
