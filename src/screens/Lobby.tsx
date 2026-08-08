import { ArrowLeft, BookOpen, Copy, Settings, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { MODE_SETUP } from '../game/constants';
import {
  loadCustomSettings,
  saveCustomSettings,
  type CustomMatchSettings,
} from '../game/customSettings';
import type { DifficultyMode, GameMode } from '../game/types';
import {
  createOnlineRoom,
  joinOnlineRoom,
  leaveOnlineRoom,
  setOnlineOptions,
  setOnlineReady,
  startOnlineMatch,
} from '../net/onlineSession';
import { useGameStore } from '../store';
import { CustomSettingsPanel } from '../components/CustomSettingsPanel';
import { ItemsCodex } from '../components/ItemsCodex';
import { RankedLeaderboard } from '../components/RankedLeaderboard';
import {
  LobbyAuctionBg,
  type LobbyBgEvent,
} from '../components/LobbyAuctionBg';
import { SpriteIcon } from '../components/SpriteIcon';

const DIFFICULTIES: {
  id: DifficultyMode;
  label: string;
  sprite: string;
}[] = [
  { id: 'mixed', label: 'Mixed', sprite: 'chaos_die' },
  { id: 'chill', label: 'Chill', sprite: 'ice_status' },
  { id: 'balanced', label: 'Balanced', sprite: 'scales' },
  { id: 'ruthless', label: 'Ruthless', sprite: 'fire' },
];

type LobbyView = 'home' | 'casual' | 'create';

export function Lobby() {
  const lobby = useGameStore((s) => s.lobby);
  const codexOpen = useGameStore((s) => s.codexOpen);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const setCodexOpen = useGameStore((s) => s.setCodexOpen);
  const startNaming = useGameStore((s) => s.startNaming);
  const online = useGameStore((s) => s.online);
  const roomCode = useGameStore((s) => s.roomCode);
  const onlineHost = useGameStore((s) => s.onlineHost);
  const onlineSeats = useGameStore((s) => s.onlineSeats);
  const onlineError = useGameStore((s) => s.onlineError);
  const sessionId = useGameStore((s) => s.sessionId);

  const [view, setView] = useState<LobbyView>('home');
  const [, setLobbyEvent] = useState<LobbyBgEvent | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [customSettings, setCustomSettings] = useState<CustomMatchSettings>(
    () => loadCustomSettings(),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const updateCustom = (next: CustomMatchSettings) => {
    setCustomSettings(next);
    saveCustomSettings(next);
  };

  const playLocal = (mode: GameMode, kind: 'ranked' | 'casual') => {
    useGameStore.setState({
      lobby: { ...useGameStore.getState().lobby, difficulty: 'mixed' },
      matchKind: kind,
    });
    startNaming(mode);
  };

  const createRoom = async (mode: GameMode) => {
    setBusy(true);
    useGameStore.setState({ onlineError: null });
    try {
      await createOnlineRoom({
        mode,
        difficulty: lobby.difficulty,
        custom: customSettings,
      });
    } catch (err) {
      useGameStore.setState({
        onlineError:
          err instanceof Error ? err.message : 'Could not create room',
      });
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async () => {
    setBusy(true);
    useGameStore.setState({ onlineError: null });
    try {
      await joinOnlineRoom(joinCode);
    } catch (err) {
      useGameStore.setState({
        onlineError:
          err instanceof Error ? err.message : 'Could not join room',
      });
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const mySeat = onlineSeats.find((s) => s.sessionId === sessionId);

  /* —— Connected room lobby —— */
  if (online && roomCode) {
    const maxPlayers = MODE_SETUP[lobby.mode].players;
    return (
      <div className="screen lobby-screen">
        <LobbyAuctionBg onEventChange={setLobbyEvent} />
        <div className="lobby-content online-room">
          <div className="lobby-hero">
            <h1 className="brand">Bid Rush</h1>
            <p className="online-room-blurb">Room lobby</p>
          </div>

          <div className="online-code-block">
            <span className="online-code-label">Code</span>
            <button
              type="button"
              className="online-code"
              onClick={copyCode}
              aria-label="Copy room code"
            >
              {roomCode}
              <Copy size={16} />
            </button>
            {copied && <span className="online-copied">Copied</span>}
          </div>

          <div className="online-seats">
            <div className="online-seats-head">
              <Users size={16} />
              <span>
                {onlineSeats.length}/{maxPlayers} players
              </span>
            </div>
            <ul className="online-seat-list">
              {onlineSeats.map((seat) => (
                <li key={seat.sessionId} className="online-seat">
                  <span
                    className="online-seat-dot"
                    style={{ background: seat.color }}
                  />
                  <span className="online-seat-name">
                    {seat.displayName}
                    {seat.sessionId === sessionId ? ' (you)' : ''}
                    {onlineHost && seat.sessionId === sessionId ? ' · host' : ''}
                  </span>
                  <span className="online-seat-ready">
                    {seat.ready ? 'Ready' : '…'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="online-fill-hint">
              Empty seats fill with bots when you start.
            </p>
          </div>

          {onlineHost && (
            <div className="field lobby-diff">
              <span>Mode</span>
              <div className="diff-row">
                {(['duel', 'blitz'] as GameMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`diff-chip${lobby.mode === mode ? ' selected' : ''}`}
                    onClick={() => {
                      useGameStore.getState().setMode(mode);
                      setOnlineOptions({ mode });
                    }}
                  >
                    {MODE_SETUP[mode].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {onlineHost && (
            <div className="field lobby-diff">
              <span>Bots</span>
              <div className="diff-row">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`diff-chip${lobby.difficulty === d.id ? ' selected' : ''}`}
                    onClick={() => {
                      setDifficulty(d.id);
                      setOnlineOptions({ difficulty: d.id });
                    }}
                  >
                    <SpriteIcon
                      id={d.sprite}
                      className="diff-chip-icon"
                      aria-hidden
                    />{' '}
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {onlineError && <p className="online-error">{onlineError}</p>}

          <div className="online-actions">
            {!onlineHost && (
              <button
                type="button"
                className="btn primary"
                onClick={() => setOnlineReady(!mySeat?.ready)}
              >
                {mySeat?.ready ? 'Unready' : 'Ready'}
              </button>
            )}
            {onlineHost && (
              <button
                type="button"
                className="btn primary"
                onClick={() => startOnlineMatch()}
              >
                Start match
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => {
                void leaveOnlineRoom();
                setView('create');
              }}
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* —— Casual: pick Duel or Blitz —— */
  if (view === 'casual') {
    return (
      <div className="screen lobby-screen">
        <LobbyAuctionBg onEventChange={setLobbyEvent} />

        <button
          type="button"
          className="lobby-back"
          onClick={() => setView('home')}
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="lobby-content home-menu">
          <div className="lobby-hero">
            <h1 className="brand">Bid Rush</h1>
            <p className="friends-subtitle">Casual</p>
          </div>

          <nav className="home-play" aria-label="Casual modes">
            <button
              type="button"
              className="home-play-btn"
              onClick={() => playLocal('duel', 'casual')}
            >
              <span className="home-play-title">Duel</span>
              <span className="home-play-meta">vs bot · 3×3</span>
            </button>
            <button
              type="button"
              className="home-play-btn featured"
              onClick={() => playLocal('blitz', 'casual')}
            >
              <span className="home-play-title">Blitz</span>
              <span className="home-play-meta">vs bots · 4×4</span>
            </button>
          </nav>
        </div>
      </div>
    );
  }

  /* —— Create / join room —— */
  if (view === 'create') {
    return (
      <div className="screen lobby-screen">
        <LobbyAuctionBg onEventChange={setLobbyEvent} />

        <button
          type="button"
          className="lobby-back"
          onClick={() => {
            setView('home');
            useGameStore.setState({ onlineError: null });
          }}
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="lobby-content friends-page">
          <div className="lobby-hero">
            <h1 className="brand">Bid Rush</h1>
            <p className="friends-subtitle">Custom room</p>
          </div>

          <section className="friends-section">
            <div className="field lobby-diff">
              <div className="custom-diff-head">
                <span>Bot difficulty</span>
                <button
                  type="button"
                  className="custom-settings-btn"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Custom match settings"
                >
                  <Settings size={18} />
                </button>
              </div>
              <div className="diff-row">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`diff-chip${lobby.difficulty === d.id ? ' selected' : ''}`}
                    onClick={() => {
                      setDifficulty(d.id);
                      setOnlineOptions({ difficulty: d.id });
                    }}
                  >
                    <SpriteIcon
                      id={d.sprite}
                      className="diff-chip-icon"
                      aria-hidden
                    />{' '}
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="custom-settings-summary">
                {customSettings.itemIds.length} items ·{' '}
                {Math.round(customSettings.gameLengthMs / 60_000)}m ·{' '}
                {customSettings.speedMult}× speed
              </p>
            </div>
            <div className="friends-create-row">
              <button
                type="button"
                className="home-play-btn"
                disabled={busy}
                onClick={() => void createRoom('duel')}
              >
                <span className="home-play-title">Create Duel</span>
                <span className="home-play-meta">1v1 · 3×3</span>
              </button>
              <button
                type="button"
                className="home-play-btn featured"
                disabled={busy}
                onClick={() => void createRoom('blitz')}
              >
                <span className="home-play-title">Create Blitz</span>
                <span className="home-play-meta">4 players · 4×4</span>
              </button>
            </div>
          </section>

          <div className="friends-divider" aria-hidden>
            <span>or</span>
          </div>

          <section className="friends-section">
            <h2 className="friends-section-label">Join with a code</h2>
            <div className="online-join-row">
              <input
                className="online-join-input"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Room code"
                maxLength={16}
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button
                type="button"
                className="btn primary"
                disabled={busy || !joinCode.trim()}
                onClick={() => void joinRoom()}
              >
                Join
              </button>
            </div>
          </section>

          {onlineError && <p className="online-error">{onlineError}</p>}
        </div>

        {settingsOpen && (
          <CustomSettingsPanel
            settings={customSettings}
            onChange={(next) => {
              updateCustom(next);
              setOnlineOptions({ custom: next });
            }}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
    );
  }

  /* —— Home —— */
  return (
    <div className="screen lobby-screen">
      <LobbyAuctionBg onEventChange={setLobbyEvent} />

      <aside className="lobby-rail" aria-label="Item guide">
        <ItemsCodex embedded onClose={() => setCodexOpen(false)} />
      </aside>

      <button
        type="button"
        className="trophy-btn"
        onClick={() => setLeaderboardOpen(true)}
        aria-label="Ranked leaderboard"
      >
        <Trophy size={20} />
      </button>

      <button
        type="button"
        className="codex-btn"
        onClick={() => setCodexOpen(true)}
        aria-label="Item guide"
      >
        <BookOpen size={20} />
      </button>

      <div className="lobby-stage">
        <button
          type="button"
          className="codex-btn mobile-codex-btn"
          onClick={() => setCodexOpen(true)}
          aria-label="Item guide"
        >
          <BookOpen size={20} />
        </button>

      <div className="lobby-content home-menu">
        <div className="lobby-hero">
          <h1 className="brand">Bid Rush</h1>
        </div>

        <nav className="home-play" aria-label="Play">
          <button
            type="button"
            className="home-play-btn featured"
            onClick={() => playLocal('duel', 'ranked')}
          >
            <span className="home-play-title">Ranked</span>
            <span className="home-play-meta">Duel · 1v1</span>
          </button>
          <button
            type="button"
            className="home-play-btn"
            onClick={() => setView('casual')}
          >
            <span className="home-play-title">Casual</span>
            <span className="home-play-meta">Duel or Blitz</span>
          </button>
          <button
            type="button"
            className="home-play-btn ghost"
            onClick={() => setView('create')}
          >
            <span className="home-play-title">Custom</span>
            <span className="home-play-meta">Host room · pick items & rules</span>
          </button>
        </nav>
      </div>
      </div>

      {codexOpen && <ItemsCodex onClose={() => setCodexOpen(false)} />}
      {leaderboardOpen && (
        <RankedLeaderboard onClose={() => setLeaderboardOpen(false)} />
      )}
    </div>
  );
}
