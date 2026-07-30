import { BookOpen } from 'lucide-react';
import { MODE_SETUP } from '../game/constants';
import type { DifficultyMode, GameMode } from '../game/types';
import { useGameStore } from '../store';
import { ItemsCodex } from '../components/ItemsCodex';

const DIFFICULTIES: { id: DifficultyMode; label: string; emoji: string }[] = [
  { id: 'mixed', label: 'Mixed', emoji: '🎲' },
  { id: 'chill', label: 'Chill', emoji: '🧊' },
  { id: 'balanced', label: 'Balanced', emoji: '⚖️' },
  { id: 'ruthless', label: 'Ruthless', emoji: '🔥' },
];

const BG_BITS: { emoji: string; x: string; delay: string; dur: string; size: string }[] = [
  { emoji: '💰', x: '8%', delay: '0s', dur: '14s', size: '1.4rem' },
  { emoji: '💣', x: '18%', delay: '2.2s', dur: '16s', size: '1.2rem' },
  { emoji: '🪿', x: '28%', delay: '4s', dur: '13s', size: '1.5rem' },
  { emoji: '⛏️', x: '40%', delay: '1s', dur: '15s', size: '1.3rem' },
  { emoji: '🏷️', x: '52%', delay: '3.5s', dur: '17s', size: '1.2rem' },
  { emoji: '🖨️', x: '64%', delay: '0.8s', dur: '14s', size: '1.35rem' },
  { emoji: '🎁', x: '74%', delay: '5s', dur: '16s', size: '1.25rem' },
  { emoji: '📈', x: '86%', delay: '2.8s', dur: '15s', size: '1.3rem' },
  { emoji: '🪙', x: '12%', delay: '6s', dur: '12s', size: '1.1rem' },
  { emoji: '⚡', x: '58%', delay: '7s', dur: '13s', size: '1.15rem' },
  { emoji: '❄️', x: '34%', delay: '8s', dur: '18s', size: '1.2rem' },
  { emoji: '🎲', x: '78%', delay: '4.5s', dur: '14s', size: '1.2rem' },
];

export function Lobby() {
  const lobby = useGameStore((s) => s.lobby);
  const codexOpen = useGameStore((s) => s.codexOpen);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const setCodexOpen = useGameStore((s) => s.setCodexOpen);
  const startNaming = useGameStore((s) => s.startNaming);

  const play = (mode: GameMode) => startNaming(mode);

  return (
    <div className="screen lobby-screen">
      <div className="lobby-bg" aria-hidden>
        <div className="lobby-bg-grid" />
        <div className="lobby-bg-glow" />
        {BG_BITS.map((bit, i) => (
          <span
            key={i}
            className="lobby-float"
            style={{
              left: bit.x,
              animationDelay: bit.delay,
              animationDuration: bit.dur,
              fontSize: bit.size,
            }}
          >
            {bit.emoji}
          </span>
        ))}
        <span className="lobby-bid-chip chip-a">💰 3</span>
        <span className="lobby-bid-chip chip-b">💰 7</span>
        <span className="lobby-bid-chip chip-c">💰 12</span>
      </div>

      <button
        type="button"
        className="codex-btn"
        onClick={() => setCodexOpen(true)}
        aria-label="Item guide"
      >
        <BookOpen size={20} />
      </button>

      <div className="lobby-content">
        <div className="lobby-hero">
          <h1 className="brand">Bid Rush</h1>
          <p className="tagline">Outbid. Outearn. Outlast.</p>
        </div>

        <div className="mode-pick">
          <button type="button" className="mode-card" onClick={() => play('duel')}>
            <span className="mode-emoji">⚔️</span>
            <span className="mode-copy">
              <span className="mode-title">{MODE_SETUP.duel.label}</span>
              <span className="mode-blurb">{MODE_SETUP.duel.blurb}</span>
              <span className="mode-meta">3×3 · 2 players</span>
            </span>
          </button>
          <button
            type="button"
            className="mode-card featured"
            onClick={() => play('blitz')}
          >
            <span className="mode-emoji">⚡</span>
            <span className="mode-copy">
              <span className="mode-title">{MODE_SETUP.blitz.label}</span>
              <span className="mode-blurb">{MODE_SETUP.blitz.blurb}</span>
              <span className="mode-meta">4×4 · 8 players</span>
            </span>
          </button>
        </div>

        <div className="field lobby-diff">
          <span>Bot table</span>
          <div className="diff-row">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`diff-chip${lobby.difficulty === d.id ? ' selected' : ''}`}
                onClick={() => setDifficulty(d.id)}
              >
                {d.emoji} {d.label}
              </button>
            ))}
          </div>
        </div>

        <p className="lobby-note">
          Handles are won in a 5-second Tag Sale before kickoff.
        </p>
      </div>

      {codexOpen && <ItemsCodex onClose={() => setCodexOpen(false)} />}
    </div>
  );
}
