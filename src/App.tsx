import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGameStore } from './store';
import { Lobby } from './screens/Lobby';
import { NameAuction } from './screens/NameAuction';
import { Game } from './screens/Game';
import { Results } from './screens/Results';
import { MatchPoolReveal } from './components/MatchPoolReveal';

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

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const countdown = useGameStore((s) => s.countdown);
  const game = useGameStore((s) => s.game);
  const matchPool = useGameStore((s) => s.matchPool);
  const poolRevealOpen = useGameStore((s) => s.poolRevealOpen);
  const poolRevealPeeked = useGameStore((s) => s.poolRevealPeeked);
  const closePoolReveal = useGameStore((s) => s.closePoolReveal);

  // Keep match mounted under results so lobby stays the true bottom of the stack
  const wantMatch =
    phase === 'naming' ||
    phase === 'countdown' ||
    phase === 'playing' ||
    phase === 'results';
  const wantResults = phase === 'results';
  const matchSheet = useSheet(wantMatch);
  const resultsSheet = useSheet(wantResults);

  // Keep last match sub-phase so leave animation still shows the right screen
  const matchView = useRef<'naming' | 'countdown' | 'playing'>('naming');
  if (phase === 'naming' || phase === 'countdown' || phase === 'playing') {
    matchView.current = phase;
  }

  const lobbyBuried = matchSheet.show || resultsSheet.show;
  // While results covers the match (including joint leave), don't animate match out
  const matchCovered = resultsSheet.show;

  const pool = game?.itemPool ?? matchPool;
  const showPool =
    poolRevealOpen &&
    !!pool &&
    (phase === 'naming' || phase === 'countdown' || phase === 'playing');

  const view = matchView.current;

  return (
    <div className="app-stack">
      <div
        className={`stack-base${lobbyBuried ? ' is-buried' : ''}`}
        aria-hidden={lobbyBuried}
      >
        <Lobby />
      </div>

      <StackSheet
        show={matchSheet.show}
        leaving={matchSheet.leaving}
        kind="match"
        covered={matchCovered}
      >
        {view === 'naming' && <NameAuction />}
        {(view === 'countdown' || view === 'playing') && <Game />}
        {showPool && (
          <MatchPoolReveal
            countdown={countdown}
            itemPool={pool}
            early={phase === 'naming' || phase === 'playing'}
            skipEntrance={
              (phase === 'countdown' || phase === 'playing') && poolRevealPeeked
            }
            onClose={closePoolReveal}
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
  );
}
