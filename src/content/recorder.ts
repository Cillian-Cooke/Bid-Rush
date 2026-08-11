/**
 * Tab / display capture for /film (Chrome). Pixel-accurate composited frames.
 * Prefer `npm run film` (Playwright) for reliable 1080×1920 H.264 exports.
 */

export type ContentRecorderPhase =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'stopping'
  | 'ready'
  | 'error';

type Listener = (snap: ContentRecorderSnapshot) => void;

export type ContentRecorderSnapshot = {
  phase: ContentRecorderPhase;
  startedAt: number | null;
  error: string | null;
  lastBlob: Blob | null;
  lastFilename: string | null;
};

type RestrictableTrack = MediaStreamTrack & {
  restrictTo?: (target: unknown) => Promise<void>;
};

type RestrictionTargetCtor = {
  fromElement: (el: Element) => Promise<unknown>;
};

const listeners = new Set<Listener>();

let phase: ContentRecorderPhase = 'idle';
let startedAt: number | null = null;
let error: string | null = null;
let lastBlob: Blob | null = null;
let lastFilename: string | null = null;
let mediaStream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stopPromise: Promise<Blob | null> | null = null;

const TARGET_FPS = 60;
const OUTPUT_W = 1080;
const OUTPUT_H = 1920;

function snap(): ContentRecorderSnapshot {
  return { phase, startedAt, error, lastBlob, lastFilename };
}

function emit() {
  const s = snap();
  for (const fn of listeners) fn(s);
}

function setPhase(next: ContentRecorderPhase) {
  phase = next;
  emit();
}

export function getContentRecorderSnapshot(): ContentRecorderSnapshot {
  return snap();
}

export function subscribeContentRecorder(fn: Listener): () => void {
  listeners.add(fn);
  fn(snap());
  return () => listeners.delete(fn);
}

export function canUseTabCapture(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

async function restrictStreamToElement(
  stream: MediaStream,
  el: HTMLElement,
): Promise<void> {
  const RT = (window as unknown as { RestrictionTarget?: RestrictionTargetCtor })
    .RestrictionTarget;
  const track = stream.getVideoTracks()[0] as RestrictableTrack | undefined;
  if (!RT || !track?.restrictTo) return;
  try {
    const target = await RT.fromElement(el);
    await track.restrictTo(target);
  } catch {
    /* full-tab capture still OK */
  }
}

function cleanupStream() {
  try {
    recorder?.stop();
  } catch {
    /* ignore */
  }
  recorder = null;
  if (mediaStream) {
    for (const t of mediaStream.getTracks()) t.stop();
  }
  mediaStream = null;
}

async function openDisplayStream(): Promise<MediaStream> {
  const attempts: DisplayMediaStreamOptions[] = [
    {
      video: {
        width: { ideal: OUTPUT_W },
        height: { ideal: OUTPUT_H },
        frameRate: { ideal: TARGET_FPS, max: TARGET_FPS },
        displaySurface: 'browser',
      } as MediaTrackConstraints,
      audio: false,
      // Chrome extensions
      ...({
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        monitorTypeSurfaces: 'exclude',
      } as object),
    },
    {
      video: {
        frameRate: { ideal: TARGET_FPS },
      },
      audio: false,
      ...({ preferCurrentTab: true } as object),
    },
    { video: true, audio: false },
  ];

  let lastErr: unknown;
  for (const opts of attempts) {
    try {
      return await navigator.mediaDevices.getDisplayMedia(opts);
    } catch (err) {
      lastErr = err;
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        throw err;
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('Tab capture is not supported here — use npm run film');
}

/**
 * Pixel-accurate tab capture (Chrome). Must run from a user gesture.
 */
export async function startContentCapture(
  target?: HTMLElement | null,
): Promise<void> {
  if (phase === 'recording' || phase === 'requesting') return;
  error = null;
  lastBlob = null;
  lastFilename = null;
  setPhase('requesting');

  try {
    if (!canUseTabCapture()) {
      throw new Error('Tab capture unavailable — run: npm run film');
    }
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder unavailable — run: npm run film');
    }

    mediaStream = await openDisplayStream();
    const el =
      target ??
      (document.querySelector('.film-studio-frame') as HTMLElement | null) ??
      (document.querySelector('.app-stack') as HTMLElement | null);
    if (el) await restrictStreamToElement(mediaStream, el);

    const video = mediaStream.getVideoTracks()[0];
    if (video) {
      video.addEventListener('ended', () => {
        void stopContentCapture({ download: false });
      });
    }

    chunks = [];
    const mime = pickMime();
    recorder = mime
      ? new MediaRecorder(mediaStream, {
          mimeType: mime,
          videoBitsPerSecond: 16_000_000,
        })
      : new MediaRecorder(mediaStream, { videoBitsPerSecond: 16_000_000 });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.start(100);
    startedAt = Date.now();
    setPhase('recording');
  } catch (err) {
    cleanupStream();
    error =
      err instanceof Error
        ? err.message
        : 'Could not start tab capture — use npm run film';
    setPhase('error');
    throw err;
  }
}

export async function bindCaptureTarget(
  target: HTMLElement | null,
): Promise<void> {
  if (!mediaStream || !target || phase !== 'recording') return;
  await restrictStreamToElement(mediaStream, target);
}

export async function stopContentCapture(opts?: {
  download?: boolean;
  filename?: string;
}): Promise<Blob | null> {
  if (stopPromise) return stopPromise;
  if (!recorder || phase !== 'recording') {
    cleanupStream();
    if (phase !== 'ready') setPhase('idle');
    return lastBlob;
  }

  setPhase('stopping');
  const rec = recorder;
  stopPromise = new Promise<Blob | null>((resolve) => {
    rec.onstop = () => {
      const mime = rec.mimeType || 'video/webm';
      const blob =
        chunks.length > 0 ? new Blob(chunks, { type: mime }) : null;
      chunks = [];
      cleanupStream();
      lastBlob = blob;
      if (blob) {
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        const name =
          opts?.filename ??
          `bid-rush-short-${new Date()
            .toISOString()
            .replace(/[:.]/g, '-')}.${ext}`;
        lastFilename = name;
        if (opts?.download !== false) downloadBlob(blob, name);
        setPhase('ready');
      } else {
        error = 'Recording was empty';
        setPhase('error');
      }
      stopPromise = null;
      resolve(blob);
    };
    try {
      rec.stop();
    } catch {
      cleanupStream();
      stopPromise = null;
      setPhase('error');
      resolve(null);
    }
  });
  return stopPromise;
}

export function discardContentCapture(): void {
  cleanupStream();
  chunks = [];
  startedAt = null;
  lastBlob = null;
  lastFilename = null;
  error = null;
  stopPromise = null;
  setPhase('idle');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

export function downloadLastContentCapture(): boolean {
  if (!lastBlob || !lastFilename) return false;
  downloadBlob(lastBlob, lastFilename);
  return true;
}
