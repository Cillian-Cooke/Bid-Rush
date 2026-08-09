import { useEffect, useState } from 'react';
import { useGameStore } from '../store';
import { SpriteIcon } from './SpriteIcon';

/** Shows a brief explosion burst when a bomb detonates. */
export function ExplosionFx() {
  const lastEvents = useGameStore((s) => s.lastEvents);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (lastEvents.some((e) => e.type === 'explosion')) {
      setBurst(true);
      const t = setTimeout(() => setBurst(false), 900);
      return () => clearTimeout(t);
    }
  }, [lastEvents]);

  if (!burst) return null;

  return (
    <div className="explosion-fx" aria-hidden>
      <SpriteIcon id="dynamite" className="explosion-burst" />
    </div>
  );
}
