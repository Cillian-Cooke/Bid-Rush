type Props = {
  reason: 'unpaid' | 'bomb' | 'bracket' | 'roi' | 'leech' | null;
  onPlayAgain: () => void;
  onSpectate: () => void;
  onMenu: () => void;
};

function reasonLine(reason: Props['reason']): string {
  if (reason === 'bomb') return 'The bomb went off.';
  if (reason === 'bracket') return 'You fell under the coin bracket.';
  if (reason === 'roi') return 'ROI failed — you couldn’t hit the target.';
  if (reason === 'leech') return 'Drained dry.';
  if (reason === 'unpaid') return 'You couldn’t pay your bid.';
  return 'You’re out of the match.';
}

export function KnockoutOverlay({
  reason,
  onPlayAgain,
  onSpectate,
  onMenu,
}: Props) {
  return (
    <div className="knockout-overlay" role="dialog" aria-label="Knocked out">
      <div className="knockout-card">
        <span className="knockout-kicker">Knocked Out</span>
        <h2 className="knockout-title">You’re Done</h2>
        <p className="knockout-line">{reasonLine(reason)}</p>
        <p className="knockout-sub">The match is still going — pick one:</p>
        <div className="knockout-actions">
          <button type="button" className="btn primary" onClick={onPlayAgain}>
            Play Again
          </button>
          <button type="button" className="btn" onClick={onSpectate}>
            Spectate
          </button>
          <button type="button" className="btn ghost" onClick={onMenu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
