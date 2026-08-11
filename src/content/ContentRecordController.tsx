import { useEffect, useRef } from 'react';
import {
  bindCaptureTarget,
  discardContentCapture,
  getContentRecorderSnapshot,
  stopContentCapture,
} from './recorder';
import { ContentRecordHud } from './ContentRecordHud';
import { useGameStore } from '../store';

/**
 * Framing + optional Chrome tab-recorder lifecycle.
 * `npm run film` records via Playwright and does not need MediaRecorder.
 */
export function ContentRecordController() {
  const contentRecording = useGameStore((s) => s.contentRecording);
  const phase = useGameStore((s) => s.phase);
  const savedForMatch = useRef(false);

  useEffect(() => {
    document.body.classList.add('film-studio');
    return () => document.body.classList.remove('film-studio');
  }, []);

  useEffect(() => {
    document.body.classList.toggle('content-recording', contentRecording);
    return () => document.body.classList.remove('content-recording');
  }, [contentRecording]);

  useEffect(() => {
    if (!contentRecording) {
      savedForMatch.current = false;
      return;
    }
    if (phase === 'countdown' || phase === 'playing') {
      const el = document.querySelector(
        '.film-studio-frame',
      ) as HTMLElement | null;
      void bindCaptureTarget(el);
    }
    if (phase === 'results' && !savedForMatch.current) {
      const rec = getContentRecorderSnapshot();
      if (rec.phase === 'recording') {
        savedForMatch.current = true;
        void stopContentCapture({ download: true });
      }
    }
    if (phase === 'lobby') {
      discardContentCapture();
      savedForMatch.current = false;
    }
  }, [contentRecording, phase]);

  return <ContentRecordHud />;
}
