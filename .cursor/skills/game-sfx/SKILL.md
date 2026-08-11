---
name: game-sfx
description: >-
  Add or tune Bidding Game sound effects via the Web Audio SFX module. Use when
  working on audio, SFX, game sounds, mute/volume wiring, bid-win / hand-move /
  world-event / active-item feedback, or when the user asks for more satisfying
  game juice sounds.
---

# Bidding Game SFX

Procedural Web Audio one-shots in `src/audio/`. Settings (`muted`, `sfxVolume`) already exist — always respect them through `syncSfxFromSettings` / `playSfx`.

## Play these (impactful, sparse)

| Moment | API | Hook |
|---|---|---|
| You win a bid | `bid_win_self` | `GameEvent` `resolve` + `winnerId === humanId` via `reactGameSfx` |
| Rival wins a bid | `bid_win_rival` | same, other winner |
| Pick up hand item | `hand_pickup` | `HandSlot` drag threshold crossed |
| Successful hand reorder | `hand_drop` | successful reorder / `reorderHandSlots` |
| Drag canceled | `hand_cancel` | drag ended without slot change |
| Event warning | `event_warn` | `worldEvent.phase` → `warning` |
| Event starts | `event_start` | new `worldEvent.live` key |
| Active item cast | `active_cast` / `_hostile` / `_board` | `fx` + `kind === 'active_cast'` (`label` = item id) |
| Bomb explosion | `explosion` | `GameEvent` `explosion` |
| Magnet steals a coin | `magnet_tick` | `fx` kind `magnet` or income emoji `🧲` (debounced) |

## Never play on (frequent / ambient)

- `income` / `loss` floats, interest, printer, goose, leech pulses (exception: magnet_tick above)
- Rubber-band / leader-tax drip
- World-event `pulseEvent` / `ambientFx` (~every few hundred ms)
- Bot hand reorders
- Passive “making money” of any kind (except explicit magnet_tick)

## Architecture

- **Synth + bus:** `src/audio/sfx.ts` — `playSfx`, `syncSfxFromSettings`, `installAudioUnlock`
- **Event mapping:** `src/audio/reactGameSfx.ts` — call after every `ingest()`
- **Store:** `commitGame` / `masterTick` / `applyOnlineGame` must call `reactGameSfx` with prev/next + `lastEvents`
- **Unlock:** `installAudioUnlock()` once from `main.tsx` (gesture required)
- **Settings:** `SettingsScreen` `patchNoise` → `syncSfxFromSettings(next)`
- Keep `engine.ts` / `worldEvents.ts` pure — no audio imports there

## Satisfying juice rules

- Layer transient (noise) + body (tone) + short sparkle; avoid flat single beeps
- Slight pitch jitter so repeats don’t feel robotic
- Debounce per `SfxId` (already in `playSfx`)
- Prefer procedural Web Audio over new asset files unless a specific recorded sample is requested
- Self win should feel brighter/higher than rival win; hostile casts darker than board casts
- Do not add music loops unless explicitly asked (`musicVolume` is reserved)

## Adding a new SFX

1. Add an `SfxId` + synth voice in `sfx.ts`
2. Map the trigger in `reactGameSfx.ts` or the UI component
3. Update the tables in this skill
4. Confirm it is not a high-frequency tick
