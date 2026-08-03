/** Blocks play while a phone is held in landscape. */
export function LandscapeBlocker() {
  return (
    <div className="landscape-blocker" role="dialog" aria-live="polite">
      <div className="landscape-blocker-card">
        <span className="landscape-blocker-icon" aria-hidden>
          📱
        </span>
        <p className="landscape-blocker-title">Flip upright</p>
        <p className="landscape-blocker-copy">
          Bid Rush is portrait-only. Rotate your phone to keep playing.
        </p>
      </div>
    </div>
  );
}
