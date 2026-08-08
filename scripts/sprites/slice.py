#!/usr/bin/env python3
"""Slice Bid Rush raw sprite sheets into 32×32 atlas cells + sheets."""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "sprites"
OUT = ROOT / "public" / "sprites"

CELL = 32
GUTTER = 1  # transparent gutter between cells in assembled sheets

PALETTE = [
    (0x1A, 0x14, 0x20),  # ink
    (0x3D, 0x2F, 0x4A),  # shadow
    (0xF4, 0xE8, 0xC8),  # paper
    (0xF0, 0xC0, 0x40),  # gold
    (0xC4, 0x88, 0x20),  # gold-dark
    (0x2A, 0x9D, 0x8F),  # teal
    (0x1A, 0x6B, 0x62),  # teal-dark
    (0x7D, 0xD3, 0xFC),  # sky
    (0xD6, 0x45, 0x3A),  # danger
    (0x8B, 0x1E, 0x18),  # danger-dark
    (0x7C, 0x3A, 0xED),  # purple
    (0x4C, 0x1D, 0x95),  # purple-dark
    (0x3A, 0xAA, 0x62),  # green
    (0x1F, 0x6B, 0x3A),  # green-dark
    (0xF9, 0x73, 0x16),  # ember
    (0x6B, 0x72, 0x80),  # mute
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


def dist2(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def nearest_palette(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    best = PALETTE[0]
    best_d = 10**9
    for p in PALETTE:
        d = dist2(rgb, p)
        if d < best_d:
            best_d = d
            best = p
    return best


def is_background(r: int, g: int, b: int, a: int = 255) -> bool:
    if a < 40:
        return True
    # near-white / light gray sheet fill
    if r > 230 and g > 230 and b > 230:
        return True
    # soft gray leftover from AI bg
    if min(r, g, b) > 220 and max(r, g, b) - min(r, g, b) < 12:
        return True
    return False


def knock_out_bg(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_background(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)
    return rgba


def content_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    """Return (left, top, right, bottom) of non-transparent content."""
    alpha = im.split()[-1]
    bbox = alpha.getbbox()
    return bbox


def cell_to_32(cell: Image.Image) -> Image.Image:
    """Downsample one grid cell to a crisp 32×32 quantized icon."""
    cell = knock_out_bg(cell)
    bbox = content_bbox(cell)
    if bbox is None:
        return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))

    # pad bbox slightly
    l, t, r, b = bbox
    pad = 2
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(cell.width, r + pad)
    b = min(cell.height, b + pad)
    cropped = cell.crop((l, t, r, b))

    # fit into 28×28 then center on 32×32 (2px margin)
    inner = 28
    cw, ch = cropped.size
    scale = min(inner / cw, inner / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    # pixelate: shrink with BOX then NEAREST up if needed
    small = cropped.resize((nw, nh), Image.Resampling.BOX)

    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    ox = (CELL - nw) // 2
    oy = (CELL - nh) // 2
    out.paste(small, (ox, oy), small)

    # quantize opaque pixels to palette
    px = out.load()
    for y in range(CELL):
        for x in range(CELL):
            r, g, b, a = px[x, y]
            if a < 90:
                px[x, y] = (0, 0, 0, 0)
            else:
                pr, pg, pb = nearest_palette((r, g, b))
                px[x, y] = (pr, pg, pb, 255)
    return out


def slice_grid(
    path: Path,
    cols: int,
    rows: int,
    ids: list[str | None],
) -> list[tuple[str, Image.Image]]:
    im = Image.open(path)
    im = knock_out_bg(im)
    w, h = im.size
    cw = w / cols
    rh = h / rows
    # trim a small fraction of each cell edge to avoid gutters/labels bleed
    inset = 0.04
    results: list[tuple[str, Image.Image]] = []
    for i, sid in enumerate(ids):
        if sid is None:
            continue
        col = i % cols
        row = i // cols
        x0 = int(round(col * cw + cw * inset))
        y0 = int(round(row * rh + rh * inset))
        x1 = int(round((col + 1) * cw - cw * inset))
        y1 = int(round((row + 1) * rh - rh * inset))
        cell = im.crop((x0, y0, x1, y1))
        results.append((sid, cell_to_32(cell)))
    return results


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
        (0, 0, 0, 0),
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


# 2×2 patch over texty AI cells: inflation, price_doubler, ipo, shop_refresh
PATCH_IDS = ["inflation", "price_doubler", "ipo", "shop_refresh"]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "items").mkdir(exist_ok=True)
    (OUT / "ui").mkdir(exist_ok=True)
    (OUT / "avatars").mkdir(exist_ok=True)
    (OUT / "events").mkdir(exist_ok=True)

    atlas: dict = {
        "cell": CELL,
        "gutter": GUTTER,
        "palette": [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in PALETTE],
        "frames": {},
    }

    jobs = [
        ("items-a-raw.png", 4, 5, ITEMS_A, "items-a.png", "items"),
        ("items-b-raw.png", 4, 5, ITEMS_B, "items-b.png", "items"),
        ("ui-emojis-raw.png", 4, 4, UI_EMOJIS, "ui-emojis.png", "ui"),
        ("avatars-raw.png", 4, 3, AVATARS, "avatars.png", "avatars"),
        ("events-raw.png", 4, 3, EVENTS, "events.png", "events"),
    ]

    # id → icon across all sheets (items rebuilt after patch)
    all_by_id: dict[str, Image.Image] = {}
    sheet_jobs: list[tuple[list[str | None], dict[str, Image.Image], int, int, str, str]] = []

    for raw_name, cols, rows, ids, sheet_name, folder in jobs:
        raw = DOCS / raw_name
        if not raw.exists():
            raise SystemExit(f"missing {raw}")
        icons = slice_grid(raw, cols, rows, ids)
        by_id = dict(icons)
        all_by_id.update(by_id)
        sheet_jobs.append((ids, by_id, cols, rows, sheet_name, folder))
        print(f"sliced {raw_name} → {len(icons)} icons")

    patch_path = DOCS / "items-patch-raw.png"
    if patch_path.exists():
        patches = slice_grid(patch_path, 2, 2, PATCH_IDS)
        for sid, icon in patches:
            all_by_id[sid] = icon
            # keep items-a by_id in sync
            for ids, by_id, cols, rows, sheet_name, folder in sheet_jobs:
                if sid in by_id or (folder == "items" and sid in ids):
                    by_id[sid] = icon
        print(f"applied patch → {len(patches)} cells: {', '.join(PATCH_IDS)}")

    for ids, by_id, cols, rows, sheet_name, folder in sheet_jobs:
        # refresh from all_by_id for patched frames
        for sid in ids:
            if sid and sid in all_by_id:
                by_id[sid] = all_by_id[sid]
        for sid, icon in by_id.items():
            icon.save(OUT / folder / f"{sid}.png")
        frames = write_sheet(ids, by_id, cols, rows, OUT / sheet_name)
        for sid, meta in frames.items():
            meta["folder"] = folder
            meta["file"] = f"{folder}/{sid}.png"
            atlas["frames"][sid] = meta
        print(f"wrote {sheet_name} ({len(frames)} frames)")

    atlas_path = OUT / "atlas.json"
    text = json.dumps(atlas, indent=2) + "\n"
    atlas_path.write_text(text)
    src_atlas = ROOT / "src" / "sprites" / "atlas.json"
    src_atlas.parent.mkdir(parents=True, exist_ok=True)
    src_atlas.write_text(text)
    print(f"wrote {atlas_path} + {src_atlas} ({len(atlas['frames'])} frames)")


if __name__ == "__main__":
    main()
