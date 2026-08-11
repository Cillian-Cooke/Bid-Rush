import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MatchPoolReveal } from '../components/MatchPoolReveal';
import { ContentRecordController } from '../content/ContentRecordController';
import {
  canUseTabCapture,
  startContentCapture,
} from '../content/recorder';
import { useGameStore } from '../store';
import { Game } from './Game';
import { Results } from './Results';

type Sheet = 'match' | 'results';

const SHEET_MS = 400;

function useSheet(want: boolean): { show: boolean; leaving: boolean } {
  const [show, setShow] = useState(want);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(0);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (want) {
      setShow(true);
      setLeaving(false);
      return;
    }
    if (!show) return;
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      setShow(false);
      setLeaving(false);
    }, SHEET_MS);
    return () => window.clearTimeout(timer.current);
  }, [want, show]);

  return { show, leaving };
}

function StackSheet({
  show,
  leaving,
  kind,
  covered,
  children,
}: {
  show: boolean;
  leaving: boolean;
  kind: Sheet;
  covered?: boolean;
  children: ReactNode;
}) {
  if (!show) return null;
  return (
    <div
      className={[
        'stack-sheet',
        `stack-sheet-${kind}`,
        leaving ? 'is-leave' : 'is-enter',
        covered ? 'is-covered' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

function wantsAutoFilm(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('auto') === '1';
}

/** Standalone no-account studio for filming bot-played shorts. */
export function FilmStudio() {
  const phase = useGameStore((s) => s.phase);
  const countdown = useGameStore((s) => s.countdown);
  const game = useGameStore((s) => s.game);
  const matchPool = useGameStore((s) => s.matchPool);
  const poolRevealOpen = useGameStore((s) => s.poolRevealOpen);
  const poolRevealPeeked = useGameStore((s) => s.poolRevealPeeked);
  const closePoolReveal = useGameStore((s) => s.closePoolReveal);
  const startContentShort = useGameStore((s) => s.startContentShort);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const tabCaptureOk = canUseTabCapture();

  const wantMatch =
    phase === 'countdown' || phase === 'playing' || phase === 'results';
  const wantResults = phase === 'results';
  const matchSheet = useSheet(wantMatch);
  const resultsSheet = useSheet(wantResults);
  const matchCovered = resultsSheet.show;

  const matchView = useRef<'countdown' | 'playing'>('countdown');
  if (phase === 'countdown' || phase === 'playing') {
    matchView.current = phase;
  }

  const pool = game?.itemPool ?? matchPool;
  const poolMode = game?.mode ?? 'blitz';
  const showPool =
    poolRevealOpen &&
    !!pool &&
    (phase === 'countdown' || phase === 'playing');

  // Playwright / CLI: /film?auto=1 starts a normal-speed match (external recorder).
  useEffect(() => {
    if (autoStarted.current) return;
    if (!wantsAutoFilm()) return;
    if (phase !== 'lobby') return;
    autoStarted.current = true;
    startContentShort('blitz');
  }, [phase, startContentShort]);

  const startBrowserFilm = async () => {
    setError(null);
    setBusy(true);
    try {
      await startContentCapture(
        document.querySelector('.film-studio-frame') as HTMLElement | null,
      );
      startContentShort('blitz');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Tab capture failed — use npm run film instead',
      );
    } finally {
      setBusy(false);
    }
  };

  const idle = phase === 'lobby' || phase === 'naming';

  return (
    <div
      className="app-stack film-studio-stack"
      data-film-phase={phase}
    >
      <div className="film-studio-frame">
        <ContentRecordController />

        {idle && (
          <div className="screen film-studio-screen">
            <div className="film-studio-copy">
              <p className="rail-kicker">Content studio</p>
              <h1 className="film-studio-title">Film a short</h1>
              <p className="film-studio-blurb">
                Best quality: run <code>npm run film</code> with the dev server
                up. Open this page at <code>/film.html</code> — no account, no
                main-game login. Saves a 1080×1920 clip into{' '}
                <code>recordings/</code>.
              </p>
              <ol className="film-studio-steps">
                <li>
                  Terminal A: <code>npm run dev</code>
                </li>
                <li>
                  Open <code>http://127.0.0.1:5173/film.html</code>
                </li>
                <li>
                  Terminal B: <code>npm run film</code> → file in{' '}
                  <code>recordings/</code>
                </li>
              </ol>
              {tabCaptureOk && (
                <p className="film-studio-blurb film-studio-alt">
                  Or record from Chrome on this page (share this tab when
                  prompted). Cursor’s built-in browser cannot capture tabs.
                </p>
              )}
              {error && <p className="film-studio-error">{error}</p>}
              {tabCaptureOk && (
                <button
                  type="button"
                  className="home-play-btn ghost film-studio-go"
                  disabled={busy}
                  onClick={() => void startBrowserFilm()}
                >
                  <span className="home-play-title">
                    {busy ? 'Share this tab…' : 'Record in Chrome'}
                  </span>
                  <span className="home-play-meta">
                    Tab capture · normal pace · downloads to browser folder
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        <StackSheet
          show={matchSheet.show}
          leaving={matchSheet.leaving}
          kind="match"
          covered={matchCovered}
        >
          {(matchView.current === 'countdown' ||
            matchView.current === 'playing') && <Game />}
          {showPool && (
            <MatchPoolReveal
              countdown={countdown}
              itemPool={pool}
              mode={poolMode === 'blitz' ? 'blitz' : 'duel'}
              early={phase === 'playing'}
              skipEntrance={
                (phase === 'countdown' || phase === 'playing') &&
                poolRevealPeeked
              }
              onClose={closePoolReveal}
              ranked={false}
              rankedRankIndex={0}
            />
          )}
        </StackSheet>

        <StackSheet
          show={resultsSheet.show}
          leaving={resultsSheet.leaving}
          kind="results"
        >
          <Results />
        </StackSheet>
      </div>
    </div>
  );
}

