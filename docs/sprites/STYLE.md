# Bid Rush - 8-bit sprite style card

**Source of truth:** emoji-faithful raw sheets in `docs/sprites/*-raw.png`.  
Slice with `npm run sprites:slice` → `public/sprites/`.

Icons should read as the item’s emoji (pickaxe, piggy, goose/duck, bomb, magnet, etc.) in NES pixel style - recognizable subjects, not abstract ability diagrams.

## Cell & sheet geometry

- **Cell:** 32×32 logical pixels
- **Gutter:** 1px transparent between cells
- **Background:** transparent (near-white knocked out on slice)
- **Scale:** `image-rendering: pixelated`

## Palette (16 colors)

| Role | Hex |
|------|-----|
| ink | `#1a1420` |
| shadow | `#3d2f4a` |
| paper | `#f4e8c8` |
| gold | `#f0c040` |
| gold-dark | `#c48820` |
| teal | `#2a9d8f` |
| teal-dark | `#1a6b62` |
| sky | `#7dd3fc` |
| danger | `#d6453a` |
| danger-dark | `#8b1e18` |
| purple | `#7c3aed` |
| purple-dark | `#4c1d95` |
| green | `#3aaa62` |
| green-dark | `#1f6b3a` |
| ember | `#f97316` |
| mute | `#6b7280` |

## Rules

1. Follow the item emoji’s subject closely (distinct silhouettes).
2. 1px ink outline, light from top-left, no anti-alias where possible.
3. Prefer clear characters/objects over abstract charts/boxes.
4. Optional: `scripts/sprites/paint.py` is experimental - do not overwrite emoji sheets unless asked.
