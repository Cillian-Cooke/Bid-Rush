import { useState } from 'react';
import { loadLastEmail } from '../net/nakama';

type Mode = 'login' | 'signup';

type Props = {
  mode?: Mode;
  busy?: boolean;
  error?: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  onCancel?: () => void;
};

export function AccountAuthForm({
  mode: initialMode = 'signup',
  busy,
  error,
  onLogin,
  onSignUp,
  onCancel,
}: Props) {
  const savedEmail = loadLastEmail();
  const [mode, setMode] = useState<Mode>(
    savedEmail ? 'login' : initialMode,
  );
  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const submit = async () => {
    if (mode === 'login') {
      await onLogin(email, password);
      return;
    }
    await onSignUp(email, password, displayName);
  };

  return (
    <div className="account-auth">
      <div className="ranked-tabs account-auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={mode === 'signup' ? 'on' : ''}
          aria-selected={mode === 'signup'}
          onClick={() => setMode('signup')}
        >
          Sign up
        </button>
        <button
          type="button"
          role="tab"
          className={mode === 'login' ? 'on' : ''}
          aria-selected={mode === 'login'}
          onClick={() => setMode('login')}
        >
          Log in
        </button>
      </div>

      {mode === 'signup' && (
        <label className="account-name-field account-auth-field">
          <span className="account-name-label">Display name</span>
          <input
            className="account-name-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 24))}
            placeholder="Shown on the board"
            maxLength={24}
            autoComplete="nickname"
            spellCheck={false}
          />
        </label>
      )}

      <label className="account-name-field account-auth-field">
        <span className="account-name-label">Email</span>
        <input
          className="account-name-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
          spellCheck={false}
        />
      </label>

      <label className="account-name-field account-auth-field">
        <span className="account-name-label">Password</span>
        <input
          className="account-name-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'signup' ? 'At least 8 characters' : 'Password'}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
      </label>

      {error && <p className="online-error account-auth-error">{error}</p>}

      <div className="account-auth-actions">
        <button
          type="button"
          className="btn primary"
          disabled={!!busy}
          onClick={() => void submit()}
        >
          {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
        {onCancel && (
          <button type="button" className="btn" disabled={!!busy} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
