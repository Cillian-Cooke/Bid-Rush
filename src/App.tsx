import { useGameStore } from './store';
import { Lobby } from './screens/Lobby';
import { NameAuction } from './screens/NameAuction';
import { Game } from './screens/Game';
import { Results } from './screens/Results';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const countdown = useGameStore((s) => s.countdown);

  if (phase === 'lobby') return <Lobby />;
  if (phase === 'naming') return <NameAuction />;
  if (phase === 'results') return <Results />;

  return (
    <>
      {(phase === 'countdown' || phase === 'playing') && <Game />}
      {phase === 'countdown' && (
        <div className="countdown-overlay" aria-live="assertive">
          <span className="countdown-num">{countdown === 0 ? 'GO!' : countdown}</span>
        </div>
      )}
    </>
  );
}
