/** Bump this key to force every account through onboarding again. */
const ONBOARDING_KEY = 'bid-rush-onboarding-done-v2';

function readMap(): Record<string, true> {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, true> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v) out[k] = true;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, true>) {
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function hasCompletedOnboarding(userId: string): boolean {
  if (!userId) return false;
  return !!readMap()[userId];
}

export function markOnboardingComplete(userId: string) {
  if (!userId) return;
  const map = readMap();
  map[userId] = true;
  writeMap(map);
}
