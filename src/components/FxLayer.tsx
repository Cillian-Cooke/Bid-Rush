import type { FxInstance } from '../store';

type Props = {
  activeFx: FxInstance[];
};

/** Purple portal streak between two swapped tiles on the 3×3 grid. */
export function FxLayer({ activeFx }: Props) {
  const swaps = activeFx.filter(
    (f) =>
      f.kind === 'swap' &&
      f.tileIndex !== undefined &&
      f.tileIndexB !== undefined,
  );

  if (swaps.length === 0) return null;

  return (
    <div className="fx-layer" aria-hidden>
      {swaps.map((f) => {
        const a = f.tileIndex!;
        const b = f.tileIndexB!;
        const ax = (a % 3) + 0.5;
        const ay = Math.floor(a / 3) + 0.5;
        const bx = (b % 3) + 0.5;
        const by = Math.floor(b / 3) + 0.5;
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        return (
          <div
            key={f.id}
            className="fx-swap-wrap"
            style={{
              left: `${(mx / 3) * 100}%`,
              top: `${(my / 3) * 100}%`,
              width: `${(len / 3) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${angle}deg)`,
            }}
          >
            <div className="fx-swap-streak" />
          </div>
        );
      })}
    </div>
  );
}
