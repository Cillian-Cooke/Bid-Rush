import { X } from 'lucide-react';
import { useState } from 'react';
import {
  loadPlayerSettings,
  savePlayerSettings,
  type PlayerSettings,
} from '../net/playerSettings';
import { syncSfxFromSettings } from '../audio/sfx';
import { logOutAccount, setNakamaDisplayName } from '../net/nakama';
import { SpriteIcon } from '../components/SpriteIcon';

type Props = {
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  onLoggedOut?: () => void;
  onClose: () => void;
};

export function SettingsScreen({
  displayName,
  onDisplayNameChange,
  onLoggedOut,
  onClose,
}: Props) {
  const [noise, setNoise] = useState<PlayerSettings>(() => loadPlayerSettings());
  const [nameDraft, setNameDraft] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const patchNoise = (partial: Partial<PlayerSettings>) => {
    setNoise((prev) => {
      const next = { ...prev, ...partial };
      savePlayerSettings(next);
      syncSfxFromSettings(next);
      return next;
    });
  };

  const saveName = async () => {
    const next = nameDraft.trim().slice(0, 24);
    if (!next) {
      setError('Enter a nickname');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await setNakamaDisplayName(next);
      onDisplayNameChange(saved);
      setNameDraft(saved);
      setSavedHint('Nickname saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save nickname');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError(null);
    try {
      await logOutAccount();
      onLoggedOut?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log out');
      setBusy(false);
    }
  };

  return (
    <div className="codex-overlay settings-overlay" role="dialog" aria-label="Settings">
      <div className="codex-sheet settings-sheet">
        <div className="codex-head">
          <div>
            <p className="rail-kicker">Options</p>
            <h2 className="settings-title">
              <SpriteIcon id="settings" className="settings-title-icon" aria-hidden />
              Settings
            </h2>
          </div>
          <button
            type="button"
            className="codex-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="settings-scroll">
          <section className="settings-block" aria-label="Noise">
            <h3 className="settings-block-title">Noise</h3>
            <label className="settings-toggle">
              <span>Mute all noise</span>
              <input
                type="checkbox"
                checked={noise.muted}
                onChange={(e) => patchNoise({ muted: e.target.checked })}
              />
            </label>
            <label className={`settings-slider${noise.muted ? ' is-disabled' : ''}`}>
              <span>Game sounds</span>
              <input
                type="range"
                min={0}
                max={100}
                value={noise.sfxVolume}
                disabled={noise.muted}
                onChange={(e) =>
                  patchNoise({ sfxVolume: Number(e.target.value) })
                }
              />
              <em>{noise.sfxVolume}</em>
            </label>
            <label className={`settings-slider${noise.muted ? ' is-disabled' : ''}`}>
              <span>Music</span>
              <input
                type="range"
                min={0}
                max={100}
                value={noise.musicVolume}
                disabled={noise.muted}
                onChange={(e) =>
                  patchNoise({ musicVolume: Number(e.target.value) })
                }
              />
              <em>{noise.musicVolume}</em>
            </label>
          </section>

          <section className="settings-block" aria-label="Nickname">
            <h3 className="settings-block-title">Nickname</h3>
            <label className="account-name-field">
              <span className="account-name-label">How you show up online</span>
              <div className="account-name-row">
                <input
                  className="account-name-input"
                  value={nameDraft}
                  onChange={(e) => {
                    setNameDraft(e.target.value.slice(0, 24));
                    setSavedHint(null);
                  }}
                  placeholder="Nickname"
                  maxLength={24}
                  spellCheck={false}
                  autoComplete="nickname"
                />
              </div>
            </label>
            <button
              type="button"
              className="btn primary"
              disabled={busy || nameDraft.trim() === displayName}
              onClick={() => void saveName()}
            >
              Save nickname
            </button>
            {savedHint ? <p className="settings-hint">{savedHint}</p> : null}
          </section>

          <section className="settings-block" aria-label="Account">
            <h3 className="settings-block-title">Account</h3>
            <button
              type="button"
              className="btn account-logout-btn"
              disabled={busy}
              onClick={() => void handleLogout()}
            >
              Log out
            </button>
          </section>

          {error ? <p className="online-error">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
