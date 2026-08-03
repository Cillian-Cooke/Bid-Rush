/** Best-effort portrait lock (works in installed PWAs / fullscreen; no-ops elsewhere). */
export function lockPortraitOrientation(): void {
  const orient = window.screen?.orientation as
    | (ScreenOrientation & {
        lock?: (orientation: OrientationLockType) => Promise<void>;
      })
    | undefined;
  if (!orient || typeof orient.lock !== 'function') return;
  void orient.lock('portrait').catch(() => {
    // Browsers often reject outside fullscreen / installed web app — ignore.
  });
}

/** Retry lock on first user gesture (required by some browsers). */
export function installPortraitLockGestures(): () => void {
  lockPortraitOrientation();
  const onGesture = () => {
    lockPortraitOrientation();
  };
  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('touchstart', onGesture, { passive: true });
  window.addEventListener('orientationchange', onGesture);
  document.addEventListener('visibilitychange', onGesture);
  return () => {
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('touchstart', onGesture);
    window.removeEventListener('orientationchange', onGesture);
    document.removeEventListener('visibilitychange', onGesture);
  };
}
