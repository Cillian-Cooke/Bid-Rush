import { useEffect, useState } from 'react';
import {
  downloadLastContentCapture,
  getContentRecorderSnapshot,
  stopContentCapture,
  subscribeContentRecorder,
  type ContentRecorderSnapshot,
} from './recorder';
import { useGameStore } from '../store';

function formatRecTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Floating REC chrome for content-short filming. */
export function ContentRecordHud() {
  const contentRecording = useGameStore((s) => s.contentRecording);
  const phase = useGameStore((s) => s.phase);
  const returnToLobby = useGameStore((s) => s.returnToLobby);
  const [rec, setRec] = useState<ContentRecorderSnapshot>(() =>
    getContentRecorderSnapshot(),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeContentRecorder(setRec), []);

  useEffect(() => {
    if (rec.phase !== 'recording' || !rec.startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [rec.phase, rec.startedAt]);

  if (!contentRecording || phase === 'lobby') return null;
  if (rec.phase === 'idle') return null;

  const elapsed =
    rec.phase === 'recording' && rec.startedAt ? now - rec.startedAt : 0;
  const saving = rec.phase === 'stopping';
  const ready = rec.phase === 'ready' && !!rec.lastBlob;

  return (
    <div className="content-rec-hud" aria-live="polite">
      <div className="content-rec-pill">
        {rec.phase === 'recording' && (
          <>
            <span className="content-rec-dot" aria-hidden />
            <span className="content-rec-label">REC</span>
            <span className="content-rec-time">{formatRecTime(elapsed)}</span>
          </>
        )}
        {saving && <span className="content-rec-label">Exporting…</span>}
        {ready && <span className="content-rec-label">Saved</span>}
        {rec.phase === 'error' && (
          <span className="content-rec-label">Capture failed</span>
        )}
        {rec.phase === 'requesting' && (
          <span className="content-rec-label">Share this tab…</span>
        )}
      </div>

      <div className="content-rec-actions">
        {rec.phase === 'recording' && (
          <button
            type="button"
            className="content-rec-btn"
            onClick={() => void stopContentCapture({ download: true })}
          >
            Stop & save
          </button>
        )}
        {ready && (
          <button
            type="button"
            className="content-rec-btn"
            onClick={() => downloadLastContentCapture()}
          >
            Download again
          </button>
        )}
        {(phase === 'results' || ready || rec.phase === 'error') && (
          <button
            type="button"
            className="content-rec-btn ghost"
            onClick={() => returnToLobby()}
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
