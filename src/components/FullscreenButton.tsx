import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import {
  isFullscreen,
  isFullscreenSupported,
  toggleFullscreen,
} from '../fullscreen';
import { lockPortraitOrientation } from '../portraitLock';

/**
 * Fixed bottom-right control to enter/exit browser fullscreen
 * (hides address bar / chrome where the Fullscreen API is allowed).
 */
export function FullscreenButton() {
  const [supported] = useState(() => isFullscreenSupported());
  const [active, setActive] = useState(() => isFullscreen());

  useEffect(() => {
    if (!supported) return;
    const sync = () => setActive(isFullscreen());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [supported]);

  if (!supported) return null;

  return (
    <button
      type="button"
      className={`fullscreen-btn${active ? ' is-active' : ''}`}
      aria-label={active ? 'Exit full screen' : 'Full screen'}
      title={active ? 'Exit full screen' : 'Full screen'}
      onClick={() => {
        void (async () => {
          const nowFs = await toggleFullscreen(document.documentElement);
          setActive(nowFs);
          if (nowFs) lockPortraitOrientation();
        })();
      }}
    >
      {active ? (
        <Minimize2 size={22} strokeWidth={2.25} aria-hidden />
      ) : (
        <Maximize2 size={22} strokeWidth={2.25} aria-hidden />
      )}
    </button>
  );
}
