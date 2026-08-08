/** Short regular / golden blurbs shared by Codex and match pool peek. */

export function regularBlurb(id: string): string {
  const map: Record<string, string> = {
    coin_mine:
      'Slow alone, fast in packs. One mine ticks slowly. Each extra mine in your hand speeds every mine up. Golden doubles coins per tick.',
    money_printer:
      'Every 20 seconds prints a Bank Note into your hand. Golden prints two notes each time.',
    golden_goose:
      'Fast steady income. Pays 1 coin about every 2 seconds. Golden doubles coins per tick.',
    bank_note:
      'Sell only. Worth 0 plus the number of items you have sold this match. Golden notes are worth double.',
    stock_market:
      'Starts at sell value 1. Every 30 seconds its sell value doubles.',
    chaos_die: 'Use to fire a random mid-match world event right now.',
    chrysalis:
      'After 20 seconds it becomes a random golden item from this match pool.',
    ipo: 'Pick a hand item. You gain coins equal to that item’s sell value.',
    broker: 'Whenever you sell an item, you also gain 3 coins.',
    piggy_bank:
      'Stores coins into itself over time. Sell it to cash out the stash.',
    mystery_box: 'Sell only. Rolls a random payout from 1 to 20 coins.',
    price_doubler: 'Instantly doubles one shop tile’s price.',
    reset_hammer:
      'Resets a shop tile to its start price and clears its high bidder.',
    inflation: 'Adds 3 to the price of every shop tile.',
    interest:
      'Every 5 seconds adds sell value to every item in your hand. Pays no coins.',
    time_freeze: 'Freezes one shop tile’s timer for a few seconds.',
    fast_forward: 'Resolves one shop tile immediately.',
    swap_portal:
      'Swap two shop tiles’ items and prices. Bids stay on their tiles.',
    shop_refresh: 'Restocks the whole shop board with new items.',
    handcuffs: 'Stops one player from bidding for a short time.',
    pickpocket: 'Steals coins from a chosen rival.',
    heist_kit: 'Steals a random hand item from a rival (not bombs).',
    quick_swap:
      'Pick a rival. After 10 seconds, swap your leftmost hand item with their rightmost. Works one-way if either hand is empty.',
    mute: 'Silences a rival’s passives for 8 seconds.',
    cold_market: 'Freezes all passives for everyone for 10 seconds.',
    roi: 'Your coins jump to 1.5× now. Hit 2× your old total in 30s or die.',
    coin_leech: 'Drains coins from rivals over time.',
    magnet: 'Whenever anyone else earns passive income, you gain 1 coin.',
    kickback: 'Whenever you win a shop purchase, you gain 3 coins.',
    curse_idol:
      'You earn no passive income. Rivals lose 1 coin every 3 seconds.',
    bomb:
      '5 second fuse. Defuse costs max(30, 10% of your coins) or you explode.',
    dynamite:
      'Every 2 seconds destroys the item on its left. Selling it is free.',
    bid_lock:
      'Locks a shop tile so nobody can outbid it. Swaps can still move it.',
    mirror:
      'Copies the passive to its right — same payout or sell-value growth on the Mirror itself.',
    gilder: 'After 30 seconds, turns the item on its right golden.',
    tip_jar: 'Adds 1 extra coin to every passive payout you earn.',
    haste_gear: 'Speeds up all your ticking passives by 1.5×.',
  };
  return map[id] ?? '';
}

export function goldenBlurb(id: string): string {
  const map: Record<string, string> = {
    coin_mine: 'Golden: double coins each tick. Merge three to go golden.',
    money_printer: 'Golden: prints two Bank Notes every 20 seconds.',
    golden_goose: 'Golden: double coins each tick.',
    bank_note: 'Golden: worth 2× items you have sold this match.',
    stock_market: 'Golden: sell value triples every 30 seconds.',
    chaos_die: 'Golden: triggers Golden Chaos, a unique gilded world event.',
    chrysalis:
      'Golden: after 20 seconds fills your hand with random golden pool items.',
    ipo: 'Golden: cash out the sell value of your whole hand at once.',
    broker: 'Golden: +6 coins whenever you sell an item.',
    piggy_bank: 'Golden: stores coins twice as fast.',
    mystery_box: 'Golden: rolls twice and adds both results (1–20 + 1–20).',
    price_doubler: 'Golden: doubles a tile’s price twice (×4).',
    reset_hammer: 'Golden: also resets a second random tile.',
    inflation: 'Golden: adds 6 to every shop tile’s price.',
    interest: 'Golden: +2 sell value to every hand item every 5 seconds.',
    time_freeze: 'Golden: briefly mega-freezes the whole board.',
    fast_forward: 'Golden: also resolves a second random tile.',
    swap_portal: 'Golden: swap a hand item with a board tile.',
    shop_refresh: 'Golden: restocks the whole shop with golden listings.',
    handcuffs: 'Golden: lasts twice as long.',
    pickpocket: 'Golden: steals twice as much.',
    heist_kit: 'Golden: steals two items.',
    quick_swap: 'Golden: after 10 seconds, swap your entire hand with theirs.',
    mute: 'Golden: lasts twice as long.',
    cold_market: 'Golden: lasts twice as long.',
    roi: 'Golden: 60 seconds to hit the target instead of 30.',
    coin_leech: 'Golden: double drain.',
    magnet: 'Golden: +2 whenever anyone else earns income.',
    kickback: 'Golden: +6 coins per purchase.',
    curse_idol: 'Golden: rivals lose 2 every 3 seconds.',
    bomb: 'Golden: fuse times add on merge. Defuse pays you +100.',
    dynamite: 'Golden: every 2 seconds wipes your whole hand (keeps the stick).',
    bid_lock: 'Golden: also freezes that tile.',
    mirror: 'Golden: also copies the passive item to its left.',
    gilder: 'Golden: turns both neighbors golden.',
    tip_jar: 'Golden: +2 coin on every passive payout.',
    haste_gear: 'Golden: 2× passive speed.',
  };
  return map[id] ?? '';
}
