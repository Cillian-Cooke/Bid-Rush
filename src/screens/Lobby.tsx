import { AVATAR_EMOJIS } from '../game/constants';
import type { DifficultyMode } from '../game/types';
import { useGameStore } from '../store';

const DIFFICULTIES: { id: DifficultyMode; label: string; emoji: string }[] = [
  { id: 'mixed', label: 'Mixed Table', emoji: '🎲' },
  { id: 'chill', label: 'All Chill', emoji: '🧊' },
  { id: 'balanced', label: 'All Balanced', emoji: '⚖️' },
  { id: 'ruthless', label: 'All Ruthless', emoji: '🔥' },
];

export function Lobby() {
  const lobby = useGameStore((s) => s.lobby);
  const joinOpen = useGameStore((s) => s.joinOpen);
  const setBotCount = useGameStore((s) => s.setBotCount);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const setHumanName = useGameStore((s) => s.setHumanName);
  const setHumanAvatar = useGameStore((s) => s.setHumanAvatar);
  const setJoinOpen = useGameStore((s) => s.setJoinOpen);
  const startCountdown = useGameStore((s) => s.startCountdown);

  return (
    <div className="screen lobby-screen">
      <div className="lobby-hero">
        <h1 className="brand">Bid Rush</h1>
        <p className="tagline">Outbid. Outearn. Outlast.</p>
      </div>

      <div className="lobby-actions">
        <button type="button" className="btn primary" onClick={() => setJoinOpen(false)}>
          Create Lobby
        </button>
        <button type="button" className="btn secondary" onClick={() => setJoinOpen(true)}>
          Join Lobby
        </button>
      </div>

      {joinOpen ? (
        <div className="join-stub">
          <p>Online multiplayer coming soon.</p>
          <button type="button" className="btn ghost" onClick={() => setJoinOpen(false)}>
            Back
          </button>
        </div>
      ) : (
        <div className="lobby-form">
          <label className="field">
            <span>Your name</span>
            <input
              type="text"
              maxLength={16}
              value={lobby.humanName}
              onChange={(e) => setHumanName(e.target.value)}
              placeholder="You"
            />
          </label>

          <div className="field">
            <span>Avatar</span>
            <div className="avatar-picker">
              {AVATAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`avatar-opt${lobby.humanAvatar === e ? ' selected' : ''}`}
                  onClick={() => setHumanAvatar(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>Bots: {lobby.botCount}</span>
            <input
              type="range"
              min={1}
              max={7}
              value={lobby.botCount}
              onChange={(e) => setBotCount(Number(e.target.value))}
            />
            <span className="hint">Total players: {lobby.botCount + 1}</span>
          </label>

          <div className="field">
            <span>Bot difficulty</span>
            <div className="diff-grid">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`diff-opt${lobby.difficulty === d.id ? ' selected' : ''}${d.id === 'mixed' ? ' recommended' : ''}`}
                  onClick={() => setDifficulty(d.id)}
                >
                  <span>{d.emoji}</span>
                  <span>{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="btn primary start-btn" onClick={startCountdown}>
            Start Game
          </button>
        </div>
      )}
    </div>
  );
}
