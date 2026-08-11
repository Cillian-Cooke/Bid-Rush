import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { installAudioUnlock } from './audio/sfx';
import { installPortraitLockGestures } from './portraitLock';
import { preloadSprites } from './sprites/preload';

installPortraitLockGestures();
preloadSprites();
installAudioUnlock();

/** Old ?film links → standalone studio (never mount film UI inside the game). */
if (new URLSearchParams(window.location.search).has('film')) {
  const next = new URL('/film.html', window.location.origin);
  next.search = window.location.search;
  next.searchParams.delete('film');
  window.location.replace(next.pathname + next.search + window.location.hash);
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
