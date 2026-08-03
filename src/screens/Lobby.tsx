import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { MODE_SETUP } from '../game/constants';
import type { DifficultyMode, GameMode } from '../game/types';
import { useGameStore } from '../store';
import { EventBannerCard } from '../components/EventBanner';
import { ItemsCodex } from '../components/ItemsCodex';
import {
  LobbyAuctionBg,
  type LobbyBgEvent,
} from '../components/LobbyAuctionBg';

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
  const [lobbyEvent, setLobbyEvent] = useState<LobbyBgEvent | null>(null);

  const play = (mode: GameMode) => startNaming(mode);

  return (
    <div className="screen lobby-screen">
      <LobbyAuctionBg onEventChange={setLobbyEvent} />

      <aside className="lobby-rail" aria-label="Item guide">
        <ItemsCodex embedded onClose={() => setCodexOpen(false)} />
      </aside>

      <div className="lobby-stage">
        <button
          type="button"
          className="codex-btn mobile-codex-btn"
          onClick={() => setCodexOpen(true)}
          aria-label="Item guide"
        >
          <BookOpen size={20} />
        </button>

        {lobbyEvent && (
          <div className="lobby-event-banner-slot" aria-live="polite">
            <EventBannerCard
              key={lobbyEvent.id}
              mode="active"
              id={lobbyEvent.id}
              motion="shown"
              remainMs={lobbyEvent.remainMs}
            />
          </div>
        )}

        <div className="lobby-content">
          <div className="lobby-hero">
            <p className="lobby-eyebrow">Auction arena</p>
            <h1 className="brand">Bid Rush</h1>
            <p className="tagline">Outbid. Outbuild. Outlast.</p>
          </div>

          <div className="mode-pick">
            <button type="button" className="mode-card" onClick={() => play('duel')}>
              <span className="mode-emoji">⚔️</span>
              <span className="mode-copy">
                <span className="mode-title">{MODE_SETUP.duel.label}</span>
                <span className="mode-blurb">1v1 pressure cooker</span>
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
                <span className="mode-blurb">Crowded floor, bigger chaos</span>
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
      </div>

      {codexOpen && <ItemsCodex onClose={() => setCodexOpen(false)} />}
    </div>
  );
}
