import { useEffect, useState } from 'react';
import type { GameMode } from '../game/types';

type Progress = {
  status: string;
  message?: string;
  pct?: number;
  out?: string;
  seed?: number;
  hook?: string;
  running?: boolean;
};

function shortsToolsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  const q = new URLSearchParams(window.location.search);
  return q.get('shortsTools') === '1' || q.get('shortsTools') === 'true';
}

export function ShortsGeneratePanel() {
  const [visible] = useState(shortsToolsEnabled);
  const [mode, setMode] = useState<GameMode>('blitz');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/__shorts/status');
        if (!res.ok) return;
        const data = (await res.json()) as Progress;
        if (cancelled) return;
        setProgress(data);
        setBusy(Boolean(data.running) || data.status === 'starting');
        if (data.status === 'error') setError(data.message ?? 'Failed');
        if (data.status === 'done') setError(null);
      } catch {
        /* server may not expose API in pure static host */
      }
    };
    poll();
    const id = window.setInterval(poll, 800);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [visible]);

  if (!visible) return null;

  const generate = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/__shorts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, skipBuild: true, attempts: 10 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not start');
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setBusy(false);
    }
  };

  const pct = Math.max(0, Math.min(100, progress?.pct ?? 0));
  const done = progress?.status === 'done' && progress.out;

  return (
    <div className="shorts-generate-panel">
      <div className="shorts-generate-head">
        <span className="shorts-generate-title">Shorts</span>
        <div className="shorts-generate-modes">
          <button
            type="button"
            className={`diff-chip${mode === 'duel' ? ' selected' : ''}`}
            disabled={busy}
            onClick={() => setMode('duel')}
          >
            Duel
          </button>
          <button
            type="button"
            className={`diff-chip${mode === 'blitz' ? ' selected' : ''}`}
            disabled={busy}
            onClick={() => setMode('blitz')}
          >
            Blitz
          </button>
        </div>
      </div>

      <button
        type="button"
        className="shorts-generate-btn"
        disabled={busy}
        onClick={() => void generate()}
      >
        {busy ? 'Generating…' : 'Generate Short'}
      </button>

      {(busy || progress) && (
        <div className="shorts-generate-status" aria-live="polite">
          <div className="shorts-generate-bar">
            <div style={{ width: `${pct}%` }} />
          </div>
          <p className="shorts-generate-msg">
            {progress?.message ?? 'Working…'}
            {progress?.hook ? ` · ${progress.hook}` : ''}
          </p>
        </div>
      )}

      {error && <p className="shorts-generate-error">{error}</p>}

      {done && (
        <p className="shorts-generate-done">
          Ready: <code>{progress.out}</code>
        </p>
      )}
    </div>
  );
}
