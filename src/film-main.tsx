import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { installAudioUnlock } from './audio/sfx';
import { FilmStudio } from './screens/FilmStudio';
import { preloadSprites } from './sprites/preload';

/** Local-only content studio — never mounts App / login / Nakama. */
preloadSprites();
installAudioUnlock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FilmStudio />
  </StrictMode>,
);
