/** Browser Fullscreen API helpers (standard + webkit). */

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};

type FsEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function fsDoc(): FsDoc {
  return document as FsDoc;
}

export function isDisplayStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari home-screen
    ('standalone' in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function isFullscreenSupported(): boolean {
  if (isDisplayStandalone()) return false;
  const doc = fsDoc();
  const el = document.documentElement as FsEl;
  return Boolean(
    doc.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      typeof el.requestFullscreen === 'function' ||
      typeof el.webkitRequestFullscreen === 'function',
  );
}

export function getFullscreenElement(): Element | null {
  const doc = fsDoc();
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function isFullscreen(): boolean {
  return getFullscreenElement() != null;
}

export async function enterFullscreen(
  target: HTMLElement = document.documentElement,
): Promise<boolean> {
  const el = target as FsEl;
  try {
    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen();
      return true;
    }
    if (typeof el.webkitRequestFullscreen === 'function') {
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // User denied / browser policy
  }
  return false;
}

export async function exitFullscreen(): Promise<void> {
  const doc = fsDoc();
  try {
    if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
      return;
    }
    if (
      doc.webkitFullscreenElement &&
      typeof doc.webkitExitFullscreen === 'function'
    ) {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // ignore
  }
}

export async function toggleFullscreen(
  target: HTMLElement = document.documentElement,
): Promise<boolean> {
  if (isFullscreen()) {
    await exitFullscreen();
    return false;
  }
  return enterFullscreen(target);
}
