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

  if (phase === 'lobby') return <Lobby />;
  if (phase === 'results') return <Results />;

  if (phase === 'naming') return <NameAuction />;

  return (
    <>
      {(phase === 'countdown' || phase === 'playing') && <Game />}
      {phase === 'countdown' && poolRevealOpen && (game?.itemPool ?? matchPool) && (
        <MatchPoolReveal
          countdown={countdown}
          itemPool={game?.itemPool ?? matchPool!}
        />
      )}
    </>
  );
}
