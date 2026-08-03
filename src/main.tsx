import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { installPortraitLockGestures } from './portraitLock';
import { bootShortsIfNeeded } from './shortsBoot';

bootShortsIfNeeded();
installPortraitLockGestures();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
