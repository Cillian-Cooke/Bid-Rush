import { useGameStore } from './store';
import { Lobby } from './screens/Lobby';
import { NameAuction } from './screens/NameAuction';
import { Game } from './screens/Game';
import { Results } from './screens/Results';
import { MatchPoolReveal } from './components/MatchPoolReveal';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const countdown = useGameStore((s) => s.countdown);
  const game = useGameStore((s) => s.game);
  const matchPool = useGameStore((s) => s.matchPool);
  const poolRevealOpen = useGameStore((s) => s.poolRevealOpen);
  const poolRevealPeeked = useGameStore((s) => s.poolRevealPeeked);
  const closePoolReveal = useGameStore((s) => s.closePoolReveal);

  if (phase === 'lobby') return <Lobby />;
  if (phase === 'results') return <Results />;

  const pool = game?.itemPool ?? matchPool;
  const showPool =
    poolRevealOpen &&
    !!pool &&
    (phase === 'naming' || phase === 'countdown');

  return (
    <>
      {phase === 'naming' && <NameAuction />}
      {(phase === 'countdown' || phase === 'playing') && <Game />}
      {showPool && (
        <MatchPoolReveal
          countdown={countdown}
          itemPool={pool}
          early={phase === 'naming'}
          skipEntrance={phase === 'countdown' && poolRevealPeeked}
          onClose={closePoolReveal}
        />
      )}
    </>
  );
}
