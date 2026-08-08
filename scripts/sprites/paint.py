#!/usr/bin/env python3
"""
Paint true 32×32 Bid Rush icons — ability-first silhouettes, not emoji copies.
Writes individual PNGs + assembled sheets + atlas.json (same layout as slice.py).
"""

from __future__ import annotations

import json
import math
from collections.abc import Callable
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "sprites"
SRC_ATLAS = ROOT / "src" / "sprites" / "atlas.json"

CELL = 32
GUTTER = 1

# Palette (matches docs/sprites/STYLE.md)
INK = (0x1A, 0x14, 0x20, 255)
SHADOW = (0x3D, 0x2F, 0x4A, 255)
PAPER = (0xF4, 0xE8, 0xC8, 255)
GOLD = (0xF0, 0xC0, 0x40, 255)
GOLD_D = (0xC4, 0x88, 0x20, 255)
TEAL = (0x2A, 0x9D, 0x8F, 255)
TEAL_D = (0x1A, 0x6B, 0x62, 255)
SKY = (0x7D, 0xD3, 0xFC, 255)
DANGER = (0xD6, 0x45, 0x3A, 255)
DANGER_D = (0x8B, 0x1E, 0x18, 255)
PURPLE = (0x7C, 0x3A, 0xED, 255)
PURPLE_D = (0x4C, 0x1D, 0x95, 255)
GREEN = (0x3A, 0xAA, 0x62, 255)
GREEN_D = (0x1F, 0x6B, 0x3A, 255)
EMBER = (0xF9, 0x73, 0x16, 255)
MUTE = (0x6B, 0x72, 0x80, 255)
CLEAR = (0, 0, 0, 0)
WHITE = (0xFA, 0xF6, 0xEE, 255)

PALETTE_HEX = [
    "#1a1420",
    "#3d2f4a",
    "#f4e8c8",
    "#f0c040",
    "#c48820",
    "#2a9d8f",
    "#1a6b62",
    "#7dd3fc",
    "#d6453a",
    "#8b1e18",
    "#7c3aed",
    "#4c1d95",
    "#3aaa62",
    "#1f6b3a",
    "#f97316",
    "#6b7280",
]

ITEMS_A = [
    "coin_mine",
    "money_printer",
    "golden_goose",
    "bank_note",
    "stock_market",
    "chaos_die",
    "chrysalis",
    "ipo",
    "broker",
    "piggy_bank",
    "mystery_box",
    "price_doubler",
    "reset_hammer",
    "inflation",
    "interest",
    "time_freeze",
    "fast_forward",
    "swap_portal",
    "shop_refresh",
    "handcuffs",
]

ITEMS_B = [
    "pickpocket",
    "heist_kit",
    "mute",
    "cold_market",
    "roi",
    "coin_leech",
    "magnet",
    "kickback",
    "curse_idol",
    "bomb",
    "dynamite",
    "bid_lock",
    "mirror",
    "gilder",
    "tip_jar",
    "haste_gear",
    "quick_swap",
    None,
    None,
    None,
]

UI_EMOJIS = [
    "skull",
    "runner",
    "scales",
    "fire",
    "coin",
    "money_bag",
    "receipt",
    "bolt",
    "tornado",
    "star",
    "balance",
    "lock_status",
    "ice_status",
    "mute_status",
    "roi_status",
    None,
]

AVATARS = [
    "cool",
    "cowboy",
    "fox",
    "cat",
    "frog",
    "lion",
    "panda",
    "tiger",
    "unicorn",
    "dragon",
    "alien",
    "robot",
]

EVENTS = [
    "money_money_money",
    "tax_collector",
    "fire_sale",
    "deep_freeze",
    "turbo_market",
    "bomb_bazaar",
    "coin_shower",
    "shuffle_storm",
    "inflation_wave",
    "mystery_mall",
    "golden_chaos",
    None,
]


class Canvas:
    def __init__(self) -> None:
        self.im = Image.new("RGBA", (CELL, CELL), CLEAR)
        self.px = self.im.load()

    def p(self, x: int, y: int, c: tuple[int, int, int, int]) -> None:
        if 0 <= x < CELL and 0 <= y < CELL:
            self.px[x, y] = c

    def rect(self, x0: int, y0: int, x1: int, y1: int, c: tuple[int, int, int, int]) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.p(x, y, c)

    def hline(self, x0: int, x1: int, y: int, c: tuple[int, int, int, int]) -> None:
        for x in range(x0, x1 + 1):
            self.p(x, y, c)

    def vline(self, x: int, y0: int, y1: int, c: tuple[int, int, int, int]) -> None:
        for y in range(y0, y1 + 1):
            self.p(x, y, c)

    def outline_rect(
        self, x0: int, y0: int, x1: int, y1: int, fill: tuple, edge: tuple = INK
    ) -> None:
        self.rect(x0, y0, x1, y1, fill)
        self.hline(x0, x1, y0, edge)
        self.hline(x0, x1, y1, edge)
        self.vline(x0, y0, y1, edge)
        self.vline(x1, y0, y1, edge)

    def disc(self, cx: int, cy: int, r: int, fill: tuple, edge: tuple = INK) -> None:
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                d2 = (x - cx) ** 2 + (y - cy) ** 2
                if d2 <= r * r:
                    self.p(x, y, fill if d2 <= (r - 1) * (r - 1) or r < 2 else edge)
        # soft fill then ink ring
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                d2 = (x - cx) ** 2 + (y - cy) ** 2
                if d2 <= (r - 1) * (r - 1):
                    self.p(x, y, fill)
                elif d2 <= r * r:
                    self.p(x, y, edge)

    def coin(self, cx: int, cy: int, big: bool = False) -> None:
        r = 5 if big else 3
        self.disc(cx, cy, r, GOLD, INK)
        if big:
            self.disc(cx, cy, 2, GOLD_D, GOLD_D)
            self.p(cx - 1, cy - 2, PAPER)
        else:
            self.p(cx, cy, GOLD_D)
            self.p(cx - 1, cy - 1, PAPER)


# —— Ability painters ——


def paint_coin_mine() -> Image.Image:
    """Pack of mines → faster ticks: pickaxe + coin vein."""
    c = Canvas()
    c.outline_rect(4, 18, 20, 28, SHADOW, INK)
    c.rect(8, 20, 16, 26, MUTE)
    c.coin(12, 23)
    # pickaxe
    c.vline(22, 6, 22, GOLD_D)
    c.vline(23, 6, 22, INK)
    c.rect(16, 5, 27, 9, MUTE)
    c.hline(16, 27, 5, INK)
    c.hline(16, 27, 9, INK)
    return c.im


def paint_money_printer() -> Image.Image:
    """Prints Bank Notes on a timer."""
    c = Canvas()
    c.outline_rect(6, 8, 25, 22, MUTE, INK)
    c.rect(8, 10, 23, 14, TEAL_D)
    c.rect(10, 16, 21, 20, GREEN)
    # note coming out
    c.outline_rect(9, 20, 22, 27, GREEN, INK)
    c.hline(11, 20, 23, GREEN_D)
    c.p(15, 24, PAPER)
    return c.im


def paint_golden_goose() -> Image.Image:
    """Fast passive income — goose + coin egg."""
    c = Canvas()
    c.disc(14, 16, 7, GOLD, INK)
    c.disc(20, 12, 4, GOLD, INK)
    c.p(22, 11, INK)  # eye
    c.rect(20, 13, 26, 15, EMBER)  # beak
    c.hline(20, 26, 13, INK)
    c.coin(12, 24)
    return c.im


def paint_bank_note() -> Image.Image:
    """Sell-value from items sold."""
    c = Canvas()
    c.outline_rect(5, 10, 26, 22, GREEN, INK)
    c.rect(7, 12, 24, 20, GREEN_D)
    c.disc(16, 16, 3, GOLD, INK)
    return c.im


def paint_stock_market() -> Image.Image:
    """Sell value doubles on a timer — rising bars ×2."""
    c = Canvas()
    c.outline_rect(5, 6, 26, 26, SHADOW, INK)
    c.rect(8, 18, 11, 23, TEAL)
    c.rect(13, 14, 16, 23, TEAL)
    c.rect(18, 9, 21, 23, GOLD)
    # ×2 cue
    c.p(23, 8, GOLD)
    c.p(24, 9, GOLD)
    c.p(25, 8, GOLD)
    return c.im


def paint_chaos_die() -> Image.Image:
    """Triggers a random world event."""
    c = Canvas()
    c.outline_rect(8, 8, 23, 23, PAPER, INK)
    c.p(12, 12, DANGER)
    c.p(16, 16, PURPLE)
    c.p(20, 12, TEAL)
    c.p(12, 20, GOLD)
    c.p(20, 20, EMBER)
    # event spark
    c.p(25, 6, PURPLE)
    c.p(26, 7, GOLD)
    c.p(27, 6, PURPLE)
    return c.im


def paint_chrysalis() -> Image.Image:
    """Becomes a random golden pool item."""
    c = Canvas()
    c.outline_rect(11, 6, 20, 24, GREEN, INK)
    c.rect(13, 8, 18, 22, GREEN_D)
    c.vline(15, 8, 22, GOLD)
    c.p(12, 5, GOLD)  # emerging gold
    c.p(19, 5, GOLD)
    return c.im


def paint_ipo() -> Image.Image:
    """Cash out a hand item's sell value — hand + coin burst."""
    c = Canvas()
    c.outline_rect(6, 14, 18, 26, PAPER, INK)
    c.rect(8, 16, 16, 24, MUTE)
    c.coin(22, 12)
    c.coin(26, 18)
    c.coin(20, 22)
    return c.im


def paint_broker() -> Image.Image:
    """Bonus coins on every sell."""
    c = Canvas()
    c.outline_rect(6, 10, 16, 24, TEAL, INK)
    c.hline(8, 14, 14, PAPER)
    c.hline(8, 14, 17, PAPER)
    c.coin(22, 16, big=True)
    return c.im


def paint_piggy_bank() -> Image.Image:
    """Stores coins; sell to cash out."""
    c = Canvas()
    c.disc(15, 17, 8, DANGER, INK)  # pink-ish via danger+paper
    c.disc(15, 17, 6, PAPER, PAPER)
    c.rect(12, 17, 18, 24, PAPER)
    c.hline(12, 18, 12, INK)  # slot
    c.coin(16, 8)
    c.p(10, 14, INK)  # eye
    return c.im


def paint_mystery_box() -> Image.Image:
    """Random 1–20 payout on sell."""
    c = Canvas()
    c.outline_rect(7, 9, 24, 26, PURPLE, INK)
    c.rect(9, 11, 22, 24, PURPLE_D)
    c.hline(7, 24, 14, GOLD)
    c.vline(15, 9, 14, GOLD)
    # ?
    c.rect(14, 17, 17, 19, GOLD)
    c.p(15, 21, GOLD)
    return c.im


def paint_price_doubler() -> Image.Image:
    """Doubles one shop tile price — price tag ×2."""
    c = Canvas()
    c.outline_rect(6, 8, 20, 22, EMBER, INK)
    c.rect(8, 10, 18, 20, GOLD)
    c.coin(12, 15)
    # ×2
    c.rect(21, 10, 27, 14, DANGER)
    c.hline(21, 27, 10, INK)
    c.hline(21, 27, 14, INK)
    c.vline(21, 10, 14, INK)
    c.vline(27, 10, 14, INK)
    c.p(23, 12, PAPER)
    c.p(25, 12, PAPER)
    return c.im


def paint_reset_hammer() -> Image.Image:
    """Reset tile price + clear bidder."""
    c = Canvas()
    c.outline_rect(14, 4, 26, 12, MUTE, INK)
    c.vline(19, 12, 26, GOLD_D)
    c.vline(20, 12, 26, INK)
    # reset arrow under
    c.hline(6, 12, 22, TEAL)
    c.p(6, 21, TEAL)
    c.p(6, 23, TEAL)
    c.p(7, 20, TEAL)
    return c.im


def paint_inflation() -> Image.Image:
    """+3 to every shop tile — rising prices board-wide."""
    c = Canvas()
    for i, x in enumerate((6, 13, 20)):
        h = 10 + i * 4
        c.outline_rect(x, 26 - h, x + 5, 26, DANGER if i == 2 else EMBER, INK)
    # up arrows
    c.p(9, 8, GOLD)
    c.p(16, 5, GOLD)
    c.p(23, 3, GOLD)
    return c.im


def paint_interest() -> Image.Image:
    """+sell value to whole hand over time."""
    c = Canvas()
    for i, x in enumerate((5, 12, 19)):
        c.outline_rect(x, 14, x + 5, 26, TEAL, INK)
        c.p(x + 2, 11, GOLD)  # + sell ticks
        c.p(x + 2, 9, GOLD)
    return c.im


def paint_time_freeze() -> Image.Image:
    """Freeze one tile timer."""
    c = Canvas()
    c.disc(16, 16, 9, SKY, INK)
    c.disc(16, 16, 6, PAPER, SKY)
    c.vline(16, 10, 16, INK)
    c.hline(16, 21, 16, INK)
    # ice crystals
    c.p(7, 8, SKY)
    c.p(25, 8, SKY)
    c.p(7, 24, SKY)
    c.p(25, 24, SKY)
    return c.im


def paint_fast_forward() -> Image.Image:
    """Resolve tile now — timer skip."""
    c = Canvas()
    # timer bar
    c.outline_rect(5, 22, 26, 26, SHADOW, INK)
    c.rect(6, 23, 24, 25, TEAL)
    # double chevron
    for ox in (8, 16):
        c.p(ox, 10, TEAL)
        c.p(ox + 1, 11, TEAL)
        c.p(ox + 2, 12, TEAL)
        c.p(ox + 1, 13, TEAL)
        c.p(ox, 14, TEAL)
        c.p(ox + 3, 10, TEAL_D)
        c.p(ox + 4, 11, TEAL_D)
        c.p(ox + 5, 12, TEAL_D)
        c.p(ox + 4, 13, TEAL_D)
        c.p(ox + 3, 14, TEAL_D)
    return c.im


def paint_swap_portal() -> Image.Image:
    """Swap two shop tiles."""
    c = Canvas()
    c.outline_rect(4, 10, 13, 20, PURPLE, INK)
    c.outline_rect(18, 10, 27, 20, TEAL, INK)
    # swap arrows
    c.hline(12, 19, 8, GOLD)
    c.p(19, 7, GOLD)
    c.p(19, 9, GOLD)
    c.hline(12, 19, 23, GOLD)
    c.p(12, 22, GOLD)
    c.p(12, 24, GOLD)
    return c.im


def paint_shop_refresh() -> Image.Image:
    """Restock whole shop."""
    c = Canvas()
    for y in (8, 15, 22):
        c.outline_rect(6, y, 25, y + 4, SHADOW, INK)
        c.rect(8, y + 1, 11, y + 3, GOLD)
        c.rect(14, y + 1, 17, y + 3, TEAL)
        c.rect(20, y + 1, 23, y + 3, PURPLE)
    # refresh swirl
    c.p(28, 4, GREEN)
    c.p(29, 5, GREEN)
    c.p(28, 6, GREEN)
    return c.im


def paint_handcuffs() -> Image.Image:
    """Stop a rival from bidding — keep inset so the wide cuffs don’t clip in UI."""
    c = Canvas()
    # Slightly smaller / inset vs edge-to-edge so codex & detail rows stay even
    c.disc(11, 16, 4, MUTE, INK)
    c.disc(21, 16, 4, MUTE, INK)
    c.hline(14, 18, 15, MUTE)
    c.hline(14, 18, 16, INK)
    return c.im


def paint_pickpocket() -> Image.Image:
    """Steal coins from a rival."""
    c = Canvas()
    c.outline_rect(6, 12, 16, 26, PAPER, INK)
    c.rect(8, 14, 14, 24, MUTE)
    c.coin(22, 14)
    c.coin(24, 20)
    # motion lines
    c.hline(17, 20, 16, MUTE)
    return c.im


def paint_heist_kit() -> Image.Image:
    """Steal a hand item — bag grabbing a tile."""
    c = Canvas()
    c.outline_rect(14, 8, 26, 18, TEAL, INK)
    c.rect(16, 10, 24, 16, GOLD)
    c.outline_rect(6, 16, 16, 28, SHADOW, INK)
    c.hline(8, 14, 18, MUTE)
    return c.im


def paint_mute() -> Image.Image:
    """Silence rival passives."""
    c = Canvas()
    c.outline_rect(6, 12, 14, 20, MUTE, INK)
    c.rect(14, 10, 18, 22, MUTE)
    # red slash
    for i in range(10):
        c.p(10 + i, 8 + i, DANGER)
        c.p(11 + i, 8 + i, DANGER)
    return c.im


def paint_cold_market() -> Image.Image:
    """Freeze all passives board-wide."""
    c = Canvas()
    c.disc(12, 14, 5, MUTE, INK)
    c.disc(20, 18, 5, MUTE, INK)
    # ice overlay
    for x, y in ((8, 8), (16, 6), (24, 10), (10, 22), (22, 24)):
        c.p(x, y, SKY)
        c.p(x + 1, y, SKY)
    return c.im


def paint_roi() -> Image.Image:
    """1.5× now — hit 2× or die."""
    c = Canvas()
    c.outline_rect(5, 6, 26, 26, SHADOW, INK)
    c.hline(8, 14, 20, TEAL)
    c.hline(14, 22, 12, GOLD)
    c.p(22, 10, DANGER)
    c.p(23, 9, DANGER)
    # skull hint
    c.p(24, 22, PAPER)
    c.p(23, 23, INK)
    c.p(25, 23, INK)
    return c.im


def paint_coin_leech() -> Image.Image:
    """Drain rivals' coins over time."""
    c = Canvas()
    # leech body
    c.outline_rect(8, 12, 22, 22, PURPLE, INK)
    c.rect(10, 14, 20, 20, PURPLE_D)
    c.p(20, 15, DANGER)  # mouth
    c.coin(24, 10)
    c.hline(22, 24, 14, DANGER)
    return c.im


def paint_magnet() -> Image.Image:
    """Siphon 1 coin when others earn passive."""
    c = Canvas()
    c.rect(10, 8, 14, 20, DANGER)
    c.rect(18, 8, 22, 20, SKY)
    c.hline(10, 22, 8, INK)
    c.vline(10, 8, 20, INK)
    c.vline(14, 8, 20, INK)
    c.vline(18, 8, 20, INK)
    c.vline(22, 8, 20, INK)
    c.rect(10, 20, 14, 24, DANGER_D)
    c.rect(18, 20, 22, 24, TEAL_D)
    c.coin(16, 26)
    return c.im


def paint_kickback() -> Image.Image:
    """+3 coins when you win a shop buy."""
    c = Canvas()
    c.outline_rect(5, 8, 16, 20, TEAL, INK)
    c.coin(11, 14)
    c.coin(22, 12)
    c.coin(24, 18)
    c.coin(20, 22)
    return c.im


def paint_curse_idol() -> Image.Image:
    """You earn no passives; rivals bleed."""
    c = Canvas()
    c.outline_rect(10, 6, 21, 18, PURPLE, INK)
    c.rect(12, 8, 19, 16, PURPLE_D)
    c.disc(15, 12, 2, DANGER, INK)  # eye
    c.outline_rect(12, 18, 19, 26, SHADOW, INK)
    c.p(8, 22, DANGER)
    c.p(24, 22, DANGER)
    return c.im


def paint_bomb() -> Image.Image:
    """Fuse — pay or explode."""
    c = Canvas()
    c.disc(15, 18, 8, SHADOW, INK)
    c.disc(15, 18, 6, MUTE, MUTE)
    c.vline(15, 6, 10, MUTE)
    c.p(15, 5, EMBER)
    c.p(16, 4, GOLD)
    c.p(14, 4, GOLD)
    return c.im


def paint_dynamite() -> Image.Image:
    """Destroys item on its left every 2s."""
    c = Canvas()
    for dx in (0, 5, 10):
        c.outline_rect(8 + dx, 8, 11 + dx, 26, DANGER, INK)
        c.rect(9 + dx, 9, 10 + dx, 25, DANGER_D)
    c.hline(8, 21, 8, MUTE)
    c.p(14, 5, EMBER)
    # destroy arrow left
    c.hline(2, 6, 16, MUTE)
    c.p(2, 15, MUTE)
    c.p(2, 17, MUTE)
    return c.im


def paint_bid_lock() -> Image.Image:
    """Nobody can outbid this tile."""
    c = Canvas()
    c.outline_rect(9, 14, 22, 26, GOLD, INK)
    c.rect(11, 16, 20, 24, GOLD_D)
    c.p(15, 20, INK)
    # shackle
    c.hline(12, 19, 10, MUTE)
    c.vline(12, 10, 14, MUTE)
    c.vline(19, 10, 14, MUTE)
    return c.im


def paint_mirror() -> Image.Image:
    """Copies passive to its right onto itself."""
    c = Canvas()
    c.outline_rect(8, 6, 23, 26, TEAL, INK)
    c.rect(10, 8, 21, 24, SKY)
    c.vline(16, 10, 22, PAPER)
    # reflection glint
    c.p(12, 10, PAPER)
    c.p(13, 11, PAPER)
    return c.im


def paint_gilder() -> Image.Image:
    """Turns neighbor golden after charge."""
    c = Canvas()
    c.vline(10, 8, 24, GOLD_D)
    c.rect(8, 6, 14, 10, GOLD)
    c.hline(8, 14, 6, INK)
    # sparkles on right neighbor slot
    c.outline_rect(18, 12, 28, 24, SHADOW, INK)
    c.p(20, 10, GOLD)
    c.p(24, 8, GOLD)
    c.p(26, 14, GOLD)
    return c.im


def paint_tip_jar() -> Image.Image:
    """+1 to every passive payout."""
    c = Canvas()
    c.outline_rect(10, 10, 22, 26, SKY, INK)
    c.rect(12, 12, 20, 24, PAPER)
    c.hline(10, 22, 10, GOLD)
    c.coin(16, 18)
    c.p(16, 8, GOLD)  # +1
    c.p(15, 7, GOLD)
    c.p(17, 7, GOLD)
    return c.im


def paint_haste_gear() -> Image.Image:
    """1.5× all ticking passives."""
    c = Canvas()
    c.disc(16, 16, 9, MUTE, INK)
    c.disc(16, 16, 4, TEAL, INK)
    for a in range(0, 8):
        rad = math.radians(a * 45)
        x = int(round(16 + 10 * math.cos(rad)))
        y = int(round(16 + 10 * math.sin(rad)))
        c.p(x, y, MUTE)
        c.p(x + 1, y, MUTE)
    c.hline(2, 5, 8, GOLD)
    c.hline(2, 5, 10, GOLD)
    return c.im


def paint_quick_swap() -> Image.Image:
    """Delayed leftmost ↔ rightmost hand swap."""
    c = Canvas()
    c.outline_rect(4, 12, 12, 24, PURPLE, INK)
    c.outline_rect(20, 12, 28, 24, TEAL, INK)
    c.hline(12, 20, 10, GOLD)
    c.hline(12, 20, 26, GOLD)
    # hourglass tick
    c.outline_rect(14, 14, 18, 22, SHADOW, INK)
    c.p(16, 16, GOLD)
    c.p(16, 20, GOLD)
    return c.im


# UI glyphs


def paint_skull() -> Image.Image:
    c = Canvas()
    c.disc(16, 14, 8, PAPER, INK)
    c.rect(10, 18, 22, 24, PAPER)
    c.hline(10, 22, 24, INK)
    c.rect(11, 12, 14, 15, INK)
    c.rect(18, 12, 21, 15, INK)
    c.p(16, 17, INK)
    c.vline(13, 21, 23, INK)
    c.vline(16, 21, 23, INK)
    c.vline(19, 21, 23, INK)
    return c.im


def paint_runner() -> Image.Image:
    c = Canvas()
    c.disc(14, 8, 3, TEAL, INK)
    c.vline(14, 11, 18, TEAL)
    c.hline(10, 18, 14, TEAL)
    c.p(12, 20, TEAL)
    c.p(16, 20, TEAL)
    c.hline(20, 26, 12, MUTE)
    c.hline(20, 24, 14, MUTE)
    return c.im


def paint_scales() -> Image.Image:
    c = Canvas()
    c.vline(16, 6, 24, GOLD)
    c.hline(8, 24, 10, GOLD)
    c.outline_rect(6, 12, 12, 18, GOLD_D, INK)
    c.outline_rect(20, 12, 26, 18, GOLD_D, INK)
    c.rect(14, 24, 18, 26, SHADOW)
    return c.im


def paint_fire() -> Image.Image:
    c = Canvas()
    c.disc(16, 20, 6, DANGER, INK)
    c.disc(16, 16, 5, EMBER, DANGER)
    c.disc(16, 12, 3, GOLD, EMBER)
    return c.im


def paint_coin_ui() -> Image.Image:
    c = Canvas()
    c.coin(16, 16, big=True)
    return c.im


def paint_money_bag() -> Image.Image:
    c = Canvas()
    c.disc(16, 18, 8, GOLD_D, INK)
    c.rect(12, 8, 20, 14, GOLD_D)
    c.hline(12, 20, 8, INK)
    c.p(16, 16, GOLD)
    return c.im


def paint_receipt() -> Image.Image:
    c = Canvas()
    c.outline_rect(9, 6, 22, 26, PAPER, INK)
    for y in (10, 14, 18, 22):
        c.hline(11, 20, y, MUTE)
    return c.im


def paint_bolt() -> Image.Image:
    c = Canvas()
    pts = [(14, 4), (20, 4), (16, 12), (22, 12), (10, 28), (14, 16), (8, 16)]
    for x, y in pts:
        c.p(x, y, GOLD)
        c.p(x + 1, y, GOLD)
    c.rect(12, 10, 18, 14, GOLD)
    c.rect(10, 14, 16, 20, GOLD)
    return c.im


def paint_tornado() -> Image.Image:
    c = Canvas()
    for i, w in enumerate((10, 8, 6, 4, 3)):
        y = 6 + i * 4
        x0 = 16 - w // 2
        c.hline(x0, x0 + w, y, PURPLE)
        c.hline(x0, x0 + w, y + 1, PURPLE_D)
    return c.im


def paint_star() -> Image.Image:
    c = Canvas()
    c.disc(16, 16, 4, GOLD, INK)
    for x, y in ((16, 6), (16, 26), (6, 16), (26, 16), (10, 10), (22, 10), (10, 22), (22, 22)):
        c.p(x, y, GOLD)
        c.p(x, y + 1, GOLD_D)
    return c.im


def paint_balance() -> Image.Image:
    return paint_scales()


def paint_lock_status() -> Image.Image:
    return paint_bid_lock()


def paint_ice_status() -> Image.Image:
    c = Canvas()
    c.outline_rect(10, 10, 22, 24, SKY, INK)
    c.rect(12, 12, 20, 22, PAPER)
    c.p(14, 14, SKY)
    c.p(18, 18, SKY)
    return c.im


def paint_mute_status() -> Image.Image:
    return paint_mute()


def paint_roi_status() -> Image.Image:
    return paint_roi()


# Avatars — simple face chips


def _face(skin: tuple, hair: tuple | None = None, eyes: str = "normal") -> Image.Image:
    c = Canvas()
    c.disc(16, 17, 10, skin, INK)
    if hair:
        c.rect(8, 6, 24, 12, hair)
        c.hline(8, 24, 6, INK)
    if eyes == "shades":
        c.rect(10, 14, 22, 18, INK)
    else:
        c.p(12, 15, INK)
        c.p(20, 15, INK)
    c.hline(13, 19, 21, INK)
    return c.im


def paint_cool() -> Image.Image:
    return _face(PAPER, INK, "shades")


def paint_cowboy() -> Image.Image:
    c = Canvas()
    im = _face(PAPER, GOLD_D)
    c.im = im
    c.px = im.load()
    c.outline_rect(6, 4, 25, 10, GOLD_D, INK)
    return c.im


def paint_fox() -> Image.Image:
    c = Canvas()
    c.disc(16, 18, 9, EMBER, INK)
    c.p(10, 8, EMBER)
    c.p(22, 8, EMBER)
    c.p(12, 16, INK)
    c.p(20, 16, INK)
    c.rect(14, 20, 18, 22, PAPER)
    return c.im


def paint_cat() -> Image.Image:
    c = Canvas()
    c.disc(16, 18, 9, MUTE, INK)
    c.p(10, 8, MUTE)
    c.p(22, 8, MUTE)
    c.p(12, 16, INK)
    c.p(20, 16, INK)
    return c.im


def paint_frog() -> Image.Image:
    c = Canvas()
    c.disc(16, 18, 9, GREEN, INK)
    c.disc(12, 12, 3, PAPER, INK)
    c.disc(20, 12, 3, PAPER, INK)
    c.p(12, 12, INK)
    c.p(20, 12, INK)
    return c.im


def paint_lion() -> Image.Image:
    c = Canvas()
    c.disc(16, 16, 11, GOLD_D, INK)
    c.disc(16, 17, 7, GOLD, INK)
    c.p(13, 15, INK)
    c.p(19, 15, INK)
    return c.im


def paint_panda() -> Image.Image:
    c = Canvas()
    c.disc(16, 17, 10, PAPER, INK)
    c.disc(11, 14, 3, INK, INK)
    c.disc(21, 14, 3, INK, INK)
    c.p(16, 18, INK)
    return c.im


def paint_tiger() -> Image.Image:
    c = Canvas()
    c.disc(16, 17, 10, EMBER, INK)
    c.vline(16, 10, 20, INK)
    c.p(12, 15, INK)
    c.p(20, 15, INK)
    return c.im


def paint_unicorn() -> Image.Image:
    c = Canvas()
    c.disc(16, 18, 9, PAPER, INK)
    c.vline(16, 4, 10, GOLD)
    c.p(12, 15, INK)
    c.p(20, 15, INK)
    c.rect(8, 10, 12, 14, PURPLE)
    return c.im


def paint_dragon() -> Image.Image:
    c = Canvas()
    c.disc(16, 17, 10, GREEN, INK)
    c.p(10, 8, GREEN)
    c.p(22, 8, GREEN)
    c.p(12, 15, GOLD)
    c.p(20, 15, GOLD)
    c.p(14, 20, PAPER)
    c.p(18, 20, PAPER)
    return c.im


def paint_alien() -> Image.Image:
    c = Canvas()
    c.disc(16, 17, 10, PURPLE, INK)
    c.disc(12, 15, 3, INK, INK)
    c.disc(20, 15, 3, INK, INK)
    c.vline(12, 6, 10, PURPLE)
    c.vline(20, 6, 10, PURPLE)
    return c.im


def paint_robot() -> Image.Image:
    c = Canvas()
    c.outline_rect(8, 8, 23, 24, MUTE, INK)
    c.rect(10, 12, 14, 16, SKY)
    c.rect(18, 12, 22, 16, SKY)
    c.hline(12, 20, 20, DANGER)
    c.vline(16, 4, 8, MUTE)
    return c.im


# Events — ability/feel icons


def paint_money_money_money() -> Image.Image:
    c = Canvas()
    c.coin(10, 12, True)
    c.coin(20, 14, True)
    c.coin(15, 22, True)
    return c.im


def paint_tax_collector() -> Image.Image:
    c = Canvas()
    im = paint_receipt()
    c.im = im
    c.px = im.load()
    c.coin(24, 8)
    c.hline(20, 24, 12, DANGER)
    return c.im


def paint_fire_sale() -> Image.Image:
    """Everything crashes to 1 coin."""
    c = Canvas()
    c.outline_rect(5, 10, 18, 24, DANGER, INK)
    c.rect(7, 12, 16, 22, EMBER)
    c.p(8, 8, GOLD)
    c.p(10, 6, EMBER)
    c.outline_rect(20, 16, 28, 26, GOLD, INK)
    c.vline(24, 18, 24, INK)
    return c.im


def paint_deep_freeze() -> Image.Image:
    return paint_time_freeze()


def paint_turbo_market() -> Image.Image:
    return paint_bolt()


def paint_bomb_bazaar() -> Image.Image:
    return paint_bomb()


def paint_coin_shower() -> Image.Image:
    c = Canvas()
    for x, y in ((8, 6), (16, 4), (24, 8), (10, 14), (20, 12), (14, 20)):
        c.coin(x, y)
    return c.im


def paint_shuffle_storm() -> Image.Image:
    return paint_tornado()


def paint_inflation_wave() -> Image.Image:
    return paint_inflation()


def paint_mystery_mall() -> Image.Image:
    return paint_mystery_box()


def paint_golden_chaos() -> Image.Image:
    c = Canvas()
    c.im = paint_chaos_die()
    c.px = c.im.load()
    c.p(6, 6, GOLD)
    c.p(26, 6, GOLD)
    c.p(6, 26, GOLD)
    c.p(26, 26, GOLD)
    return c.im


PAINTERS: dict[str, Callable[[], Image.Image]] = {
    "coin_mine": paint_coin_mine,
    "money_printer": paint_money_printer,
    "golden_goose": paint_golden_goose,
    "bank_note": paint_bank_note,
    "stock_market": paint_stock_market,
    "chaos_die": paint_chaos_die,
    "chrysalis": paint_chrysalis,
    "ipo": paint_ipo,
    "broker": paint_broker,
    "piggy_bank": paint_piggy_bank,
    "mystery_box": paint_mystery_box,
    "price_doubler": paint_price_doubler,
    "reset_hammer": paint_reset_hammer,
    "inflation": paint_inflation,
    "interest": paint_interest,
    "time_freeze": paint_time_freeze,
    "fast_forward": paint_fast_forward,
    "swap_portal": paint_swap_portal,
    "shop_refresh": paint_shop_refresh,
    "handcuffs": paint_handcuffs,
    "pickpocket": paint_pickpocket,
    "heist_kit": paint_heist_kit,
    "mute": paint_mute,
    "cold_market": paint_cold_market,
    "roi": paint_roi,
    "coin_leech": paint_coin_leech,
    "magnet": paint_magnet,
    "kickback": paint_kickback,
    "curse_idol": paint_curse_idol,
    "bomb": paint_bomb,
    "dynamite": paint_dynamite,
    "bid_lock": paint_bid_lock,
    "mirror": paint_mirror,
    "gilder": paint_gilder,
    "tip_jar": paint_tip_jar,
    "haste_gear": paint_haste_gear,
    "quick_swap": paint_quick_swap,
    "skull": paint_skull,
    "runner": paint_runner,
    "scales": paint_scales,
    "fire": paint_fire,
    "coin": paint_coin_ui,
    "money_bag": paint_money_bag,
    "receipt": paint_receipt,
    "bolt": paint_bolt,
    "tornado": paint_tornado,
    "star": paint_star,
    "balance": paint_balance,
    "lock_status": paint_lock_status,
    "ice_status": paint_ice_status,
    "mute_status": paint_mute_status,
    "roi_status": paint_roi_status,
    "cool": paint_cool,
    "cowboy": paint_cowboy,
    "fox": paint_fox,
    "cat": paint_cat,
    "frog": paint_frog,
    "lion": paint_lion,
    "panda": paint_panda,
    "tiger": paint_tiger,
    "unicorn": paint_unicorn,
    "dragon": paint_dragon,
    "alien": paint_alien,
    "robot": paint_robot,
    "money_money_money": paint_money_money_money,
    "tax_collector": paint_tax_collector,
    "fire_sale": paint_fire_sale,
    "deep_freeze": paint_deep_freeze,
    "turbo_market": paint_turbo_market,
    "bomb_bazaar": paint_bomb_bazaar,
    "coin_shower": paint_coin_shower,
    "shuffle_storm": paint_shuffle_storm,
    "inflation_wave": paint_inflation_wave,
    "mystery_mall": paint_mystery_mall,
    "golden_chaos": paint_golden_chaos,
}


def write_sheet(
    ordered_ids: list[str | None],
    by_id: dict[str, Image.Image],
    cols: int,
    rows: int,
    dest: Path,
) -> dict[str, dict]:
    stride = CELL + GUTTER
    sheet = Image.new(
        "RGBA",
        (cols * stride - GUTTER, rows * stride - GUTTER),
        CLEAR,
    )
    frames: dict[str, dict] = {}
    for i, sid in enumerate(ordered_ids):
        if sid is None or sid not in by_id:
            continue
        col = i % cols
        row = i // cols
        x = col * stride
        y = row * stride
        sheet.paste(by_id[sid], (x, y), by_id[sid])
        frames[sid] = {
            "sheet": dest.name,
            "x": x,
            "y": y,
            "w": CELL,
            "h": CELL,
        }
    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest)
    return frames


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for folder in ("items", "ui", "avatars", "events"):
        (OUT / folder).mkdir(exist_ok=True)

    all_icons: dict[str, Image.Image] = {}
    for sid, fn in PAINTERS.items():
        all_icons[sid] = fn()

    atlas: dict = {
        "cell": CELL,
        "gutter": GUTTER,
        "palette": PALETTE_HEX,
        "frames": {},
        "source": "paint.py",
    }

    jobs = [
        (ITEMS_A, 4, 5, "items-a.png", "items"),
        (ITEMS_B, 4, 5, "items-b.png", "items"),
        (UI_EMOJIS, 4, 4, "ui-emojis.png", "ui"),
        (AVATARS, 4, 3, "avatars.png", "avatars"),
        (EVENTS, 4, 3, "events.png", "events"),
    ]

    for ids, cols, rows, sheet_name, folder in jobs:
        by_id = {sid: all_icons[sid] for sid in ids if sid}
        for sid, icon in by_id.items():
            icon.save(OUT / folder / f"{sid}.png")
        frames = write_sheet(ids, by_id, cols, rows, OUT / sheet_name)
        for sid, meta in frames.items():
            meta["folder"] = folder
            meta["file"] = f"{folder}/{sid}.png"
            atlas["frames"][sid] = meta
        print(f"painted {sheet_name} ({len(frames)} frames)")

    text = json.dumps(atlas, indent=2) + "\n"
    (OUT / "atlas.json").write_text(text)
    SRC_ATLAS.parent.mkdir(parents=True, exist_ok=True)
    SRC_ATLAS.write_text(text)
    print(f"atlas: {len(atlas['frames'])} frames")


if __name__ == "__main__":
    main()
