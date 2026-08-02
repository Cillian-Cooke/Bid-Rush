import { BookOpen } from 'lucide-react';
import { MODE_SETUP } from '../game/constants';
import type { DifficultyMode, GameMode } from '../game/types';
import { useGameStore } from '../store';
import { ItemsCodex } from '../components/ItemsCodex';
import { LobbyAuctionBg } from '../components/LobbyAuctionBg';

const DIFFICULTIES: { id: DifficultyMode; label: string; emoji: string }[] = [
  { id: 'mixed', label: 'Mixed', emoji: '🎲' },
  { id: 'chill', label: 'Chill', emoji: '🧊' },
  { id: 'balanced', label: 'Balanced', emoji: '⚖️' },
  { id: 'ruthless', label: 'Ruthless', emoji: '🔥' },
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
      <LobbyAuctionBg />

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
        </div>

        <div className="mode-pick">
          <button type="button" className="mode-card" onClick={() => play('duel')}>
            <span className="mode-emoji">⚔️</span>
            <span className="mode-copy">
              <span className="mode-title">{MODE_SETUP.duel.label}</span>
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
            </span>
          </button>
        </div>

        <div className="field lobby-diff">
          <span>Bots</span>
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
      </div>

      {codexOpen && <ItemsCodex onClose={() => setCodexOpen(false)} />}
    </div>
  );
}
