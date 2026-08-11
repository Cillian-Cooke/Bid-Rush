import {
  loadPlayerSettings,
  type PlayerSettings,
} from '../net/playerSettings';

export type SfxId =
  | 'bid_win_self'
  | 'bid_win_rival'
  | 'hand_pickup'
  | 'hand_drop'
  | 'hand_cancel'
  | 'event_warn'
  | 'event_start'
  | 'active_cast'
  | 'active_cast_hostile'
  | 'active_cast_board'
  | 'explosion'
  | 'magnet_tick';

type PlayOpts = {
  /** Extra gain multiplier 0–1 */
  gain?: number;
  /** Playback rate / pitch scale (1 = normal) */
  rate?: number;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let muted = false;
let sfxVolume = 0.8;

const lastPlayedAt = new Map<SfxId, number>();

function ensureGraph(): { ctx: AudioContext; sfxBus: GainNode } | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    master.connect(ctx.destination);
    applyGains();
  }
  return { ctx, sfxBus: sfxBus! };
}

function applyGains() {
  if (!master || !sfxBus || !ctx) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(muted ? 0 : 1, now, 0.02);
  sfxBus.gain.cancelScheduledValues(now);
  sfxBus.gain.setTargetAtTime(sfxVolume, now, 0.02);
}

export function syncSfxFromSettings(settings?: PlayerSettings) {
  const s = settings ?? loadPlayerSettings();
  muted = !!s.muted;
  sfxVolume = Math.max(0, Math.min(1, s.sfxVolume / 100));
  applyGains();
}

/** Resume AudioContext after a user gesture (browsers require this). */
export async function unlockAudio(): Promise<void> {
  const graph = ensureGraph();
  if (!graph) return;
  syncSfxFromSettings();
  if (graph.ctx.state === 'suspended') {
    try {
      await graph.ctx.resume();
    } catch {
      /* ignore */
    }
  }
}

export function installAudioUnlock(): void {
  if (typeof window === 'undefined') return;
  syncSfxFromSettings();
  const tryUnlock = () => {
    void unlockAudio();
  };
  window.addEventListener('pointerdown', tryUnlock, { passive: true });
  window.addEventListener('keydown', tryUnlock);
  window.addEventListener(
    'pointerdown',
    () => {
      window.removeEventListener('pointerdown', tryUnlock);
      window.removeEventListener('keydown', tryUnlock);
    },
    { once: true, capture: true },
  );
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function canPlay(id: SfxId, minGapMs: number): boolean {
  const t = nowMs();
  const last = lastPlayedAt.get(id) ?? 0;
  if (t - last < minGapMs) return false;
  lastPlayedAt.set(id, t);
  return true;
}

function envGain(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  peak: number,
  attack: number,
  decay: number,
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  g.connect(dest);
  return g;
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playNoise(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  {
    duration,
    peak,
    attack = 0.004,
    decay,
    filterFreq,
    filterType = 'bandpass',
    Q = 1.2,
  }: {
    duration: number;
    peak: number;
    attack?: number;
    decay: number;
    filterFreq: number;
    filterType?: BiquadFilterType;
    Q?: number;
  },
) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, when);
  filter.Q.setValueAtTime(Q, when);
  const g = envGain(ctx, dest, when, peak, attack, decay);
  src.connect(filter);
  filter.connect(g);
  src.start(when);
  src.stop(when + attack + decay + 0.02);
}

function playTone(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  {
    freq,
    type = 'triangle',
    peak,
    attack = 0.008,
    decay,
    endFreq,
  }: {
    freq: number;
    type?: OscillatorType;
    peak: number;
    attack?: number;
    decay: number;
    endFreq?: number;
  },
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (endFreq != null && endFreq !== freq) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFreq),
      when + attack + decay,
    );
  }
  const g = envGain(ctx, dest, when, peak, attack, decay);
  osc.connect(g);
  osc.start(when);
  osc.stop(when + attack + decay + 0.03);
}

function playPartialChime(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  freqs: number[],
  peak: number,
  decay: number,
) {
  const share = peak / Math.max(1, freqs.length);
  freqs.forEach((f, i) => {
    playTone(ctx, dest, when + i * 0.012, {
      freq: f,
      type: i % 2 === 0 ? 'triangle' : 'sine',
      peak: share * (1 - i * 0.12),
      attack: 0.006,
      decay: decay * (1 - i * 0.08),
    });
  });
}

function jitter(n: number, amount = 0.03) {
  return n * (1 + (Math.random() * 2 - 1) * amount);
}

function voice(
  id: SfxId,
  build: (ctx: AudioContext, bus: GainNode, t0: number, gain: number) => void,
  opts: PlayOpts | undefined,
  minGapMs: number,
) {
  if (muted || sfxVolume <= 0) return;
  if (!canPlay(id, minGapMs)) return;
  const graph = ensureGraph();
  if (!graph) return;
  if (graph.ctx.state === 'suspended') void graph.ctx.resume();
  const rate = opts?.rate ?? 1;
  const gain = (opts?.gain ?? 1) * rate;
  const t0 = graph.ctx.currentTime + 0.001;
  build(graph.ctx, graph.sfxBus, t0, gain);
}

/** Play a named one-shot. Safe to call often; respects mute/volume + debounce. */
export function playSfx(id: SfxId, opts?: PlayOpts): void {
  switch (id) {
    case 'bid_win_self':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playNoise(ctx, bus, t0, {
            duration: 0.08,
            peak: 0.22 * g,
            decay: 0.09,
            filterFreq: 2200,
            filterType: 'highpass',
            Q: 0.7,
          });
          playTone(ctx, bus, t0, {
            freq: jitter(90),
            type: 'sine',
            peak: 0.45 * g,
            attack: 0.004,
            decay: 0.18,
            endFreq: 55,
          });
          const root = jitter(523.25, 0.02);
          const notes = [root, root * 1.25, root * 1.5, root * 2];
          notes.forEach((f, i) => {
            playTone(ctx, bus, t0 + 0.04 + i * 0.055, {
              freq: f,
              type: 'triangle',
              peak: (0.28 - i * 0.03) * g,
              attack: 0.01,
              decay: 0.28 + i * 0.04,
            });
          });
          playPartialChime(
            ctx,
            bus,
            t0 + 0.22,
            [root * 2, root * 2.5, root * 3],
            0.12 * g,
            0.35,
          );
        },
        opts,
        80,
      );
      break;

    case 'bid_win_rival':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playTone(ctx, bus, t0, {
            freq: jitter(140),
            type: 'sine',
            peak: 0.28 * g,
            attack: 0.005,
            decay: 0.14,
            endFreq: 80,
          });
          playTone(ctx, bus, t0 + 0.05, {
            freq: jitter(330),
            type: 'triangle',
            peak: 0.14 * g,
            decay: 0.16,
            endFreq: 260,
          });
          playTone(ctx, bus, t0 + 0.11, {
            freq: jitter(247),
            type: 'sine',
            peak: 0.1 * g,
            decay: 0.2,
          });
        },
        opts,
        70,
      );
      break;

    case 'hand_pickup':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playNoise(ctx, bus, t0, {
            duration: 0.12,
            peak: 0.16 * g,
            attack: 0.01,
            decay: 0.11,
            filterFreq: 1400,
            filterType: 'bandpass',
            Q: 0.9,
          });
          playTone(ctx, bus, t0, {
            freq: jitter(520),
            type: 'sine',
            peak: 0.08 * g,
            attack: 0.01,
            decay: 0.08,
            endFreq: 720,
          });
        },
        opts,
        40,
      );
      break;

    case 'hand_drop':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playNoise(ctx, bus, t0, {
            duration: 0.04,
            peak: 0.28 * g,
            attack: 0.001,
            decay: 0.035,
            filterFreq: 1800,
            filterType: 'bandpass',
            Q: 1.6,
          });
          playTone(ctx, bus, t0, {
            freq: jitter(180, 0.05),
            type: 'triangle',
            peak: 0.32 * g,
            attack: 0.002,
            decay: 0.09,
            endFreq: 110,
          });
          playTone(ctx, bus, t0 + 0.018, {
            freq: jitter(880, 0.04),
            type: 'sine',
            peak: 0.09 * g,
            attack: 0.001,
            decay: 0.04,
          });
        },
        opts,
        35,
      );
      break;

    case 'hand_cancel':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playNoise(ctx, bus, t0, {
            duration: 0.08,
            peak: 0.1 * g,
            attack: 0.008,
            decay: 0.07,
            filterFreq: 900,
            filterType: 'lowpass',
          });
          playTone(ctx, bus, t0, {
            freq: jitter(300),
            type: 'sine',
            peak: 0.07 * g,
            decay: 0.08,
            endFreq: 220,
          });
        },
        opts,
        40,
      );
      break;

    case 'event_warn':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playTone(ctx, bus, t0, {
            freq: 110,
            type: 'sine',
            peak: 0.22 * g,
            attack: 0.04,
            decay: 0.55,
            endFreq: 70,
          });
          playTone(ctx, bus, t0 + 0.02, {
            freq: 220,
            type: 'sawtooth',
            peak: 0.08 * g,
            attack: 0.05,
            decay: 0.5,
            endFreq: 520,
          });
          playNoise(ctx, bus, t0 + 0.05, {
            duration: 0.4,
            peak: 0.1 * g,
            attack: 0.08,
            decay: 0.35,
            filterFreq: 600,
            filterType: 'bandpass',
            Q: 0.8,
          });
          playTone(ctx, bus, t0 + 0.28, {
            freq: 440,
            type: 'triangle',
            peak: 0.12 * g,
            attack: 0.02,
            decay: 0.25,
            endFreq: 660,
          });
        },
        opts,
        400,
      );
      break;

    case 'event_start':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playNoise(ctx, bus, t0, {
            duration: 0.2,
            peak: 0.42 * g,
            attack: 0.002,
            decay: 0.18,
            filterFreq: 400,
            filterType: 'lowpass',
            Q: 0.6,
          });
          playTone(ctx, bus, t0, {
            freq: jitter(70),
            type: 'sine',
            peak: 0.55 * g,
            attack: 0.003,
            decay: 0.35,
            endFreq: 40,
          });
          playTone(ctx, bus, t0 + 0.03, {
            freq: jitter(180),
            type: 'triangle',
            peak: 0.22 * g,
            decay: 0.28,
            endFreq: 120,
          });
          playPartialChime(
            ctx,
            bus,
            t0 + 0.06,
            [jitter(660), jitter(880), jitter(1320), jitter(1760)],
            0.18 * g,
            0.45,
          );
          playNoise(ctx, bus, t0 + 0.04, {
            duration: 0.25,
            peak: 0.14 * g,
            attack: 0.01,
            decay: 0.22,
            filterFreq: 3200,
            filterType: 'highpass',
          });
        },
        opts,
        350,
      );
      break;

    case 'active_cast':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playNoise(ctx, bus, t0, {
            duration: 0.1,
            peak: 0.18 * g,
            attack: 0.006,
            decay: 0.09,
            filterFreq: 1600,
            filterType: 'bandpass',
            Q: 1,
          });
          playTone(ctx, bus, t0, {
            freq: jitter(420),
            type: 'sine',
            peak: 0.16 * g,
            attack: 0.01,
            decay: 0.12,
            endFreq: 780,
          });
          playPartialChime(
            ctx,
            bus,
            t0 + 0.04,
            [jitter(660), jitter(990), jitter(1320)],
            0.2 * g,
            0.32,
          );
        },
        opts,
        50,
      );
      break;

    case 'active_cast_hostile':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playNoise(ctx, bus, t0, {
            duration: 0.12,
            peak: 0.24 * g,
            attack: 0.004,
            decay: 0.11,
            filterFreq: 500,
            filterType: 'bandpass',
            Q: 1.4,
          });
          playTone(ctx, bus, t0, {
            freq: jitter(160),
            type: 'sawtooth',
            peak: 0.12 * g,
            attack: 0.008,
            decay: 0.18,
            endFreq: 90,
          });
          playTone(ctx, bus, t0 + 0.05, {
            freq: jitter(240),
            type: 'triangle',
            peak: 0.16 * g,
            decay: 0.2,
            endFreq: 180,
          });
          playTone(ctx, bus, t0 + 0.1, {
            freq: jitter(190),
            type: 'sine',
            peak: 0.1 * g,
            decay: 0.22,
          });
        },
        opts,
        50,
      );
      break;

    case 'active_cast_board':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playNoise(ctx, bus, t0, {
            duration: 0.09,
            peak: 0.2 * g,
            attack: 0.004,
            decay: 0.08,
            filterFreq: 1100,
            filterType: 'bandpass',
          });
          playTone(ctx, bus, t0, {
            freq: jitter(280),
            type: 'triangle',
            peak: 0.22 * g,
            attack: 0.006,
            decay: 0.14,
            endFreq: 420,
          });
          playTone(ctx, bus, t0 + 0.06, {
            freq: jitter(560),
            type: 'sine',
            peak: 0.14 * g,
            decay: 0.2,
          });
          playTone(ctx, bus, t0 + 0.1, {
            freq: jitter(840),
            type: 'triangle',
            peak: 0.1 * g,
            decay: 0.22,
          });
        },
        opts,
        50,
      );
      break;

    case 'explosion':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playNoise(ctx, bus, t0, {
            duration: 0.35,
            peak: 0.55 * g,
            attack: 0.002,
            decay: 0.32,
            filterFreq: 280,
            filterType: 'lowpass',
            Q: 0.5,
          });
          playTone(ctx, bus, t0, {
            freq: jitter(55),
            type: 'sine',
            peak: 0.65 * g,
            attack: 0.002,
            decay: 0.45,
            endFreq: 28,
          });
          playNoise(ctx, bus, t0 + 0.02, {
            duration: 0.2,
            peak: 0.28 * g,
            attack: 0.002,
            decay: 0.18,
            filterFreq: 1800,
            filterType: 'bandpass',
            Q: 0.8,
          });
          playTone(ctx, bus, t0 + 0.04, {
            freq: jitter(120),
            type: 'triangle',
            peak: 0.2 * g,
            decay: 0.25,
            endFreq: 60,
          });
        },
        opts,
        200,
      );
      break;

    case 'magnet_tick':
      voice(
        id,
        (ctx, bus, t0, g) => {
          playTone(ctx, bus, t0, {
            freq: jitter(880, 0.03),
            type: 'sine',
            peak: 0.18 * g,
            attack: 0.002,
            decay: 0.08,
            endFreq: 660,
          });
          playTone(ctx, bus, t0 + 0.03, {
            freq: jitter(1320, 0.04),
            type: 'triangle',
            peak: 0.1 * g,
            decay: 0.1,
          });
          playNoise(ctx, bus, t0, {
            duration: 0.04,
            peak: 0.08 * g,
            decay: 0.05,
            filterFreq: 3000,
            filterType: 'highpass',
            Q: 0.7,
          });
        },
        opts,
        120,
      );
      break;
  }
}
