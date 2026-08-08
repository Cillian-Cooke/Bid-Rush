const STORAGE_KEY = 'bid-rush-player-settings-v1';

export type PlayerSettings = {
  /** Master mute for all game noise. */
  muted: boolean;
  /** SFX / UI noise level 0–100. */
  sfxVolume: number;
  /** Ambient / music noise level 0–100. */
  musicVolume: number;
};

const DEFAULTS: PlayerSettings = {
  muted: false,
  sfxVolume: 80,
  musicVolume: 50,
};

function clampVolume(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function loadPlayerSettings(): PlayerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PlayerSettings>;
    return {
      muted: !!parsed.muted,
      sfxVolume: clampVolume(parsed.sfxVolume ?? DEFAULTS.sfxVolume),
      musicVolume: clampVolume(parsed.musicVolume ?? DEFAULTS.musicVolume),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePlayerSettings(settings: PlayerSettings): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        muted: !!settings.muted,
        sfxVolume: clampVolume(settings.sfxVolume),
        musicVolume: clampVolume(settings.musicVolume),
      }),
    );
  } catch {
    /* ignore */
  }
}
