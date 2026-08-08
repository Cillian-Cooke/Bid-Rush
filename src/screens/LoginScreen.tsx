import { useState } from 'react';
import { AccountAuthForm } from '../components/AccountAuthForm';
import { LobbyAuctionBg } from '../components/LobbyAuctionBg';
import {
  logInWithEmail,
  signUpWithEmail,
  type AuthResult,
} from '../net/nakama';

type Props = {
  onAuthenticated: (result: AuthResult) => void;
};

export function LoginScreen({ onAuthenticated }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await logInWithEmail({ email, password });
      onAuthenticated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (
    email: string,
    password: string,
    displayName: string,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const result = await signUpWithEmail({ email, password, displayName });
      onAuthenticated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen login-screen">
      <LobbyAuctionBg />
      <div className="login-shell">
        <div className="login-hero">
          <p className="rail-kicker">Online auction battle</p>
          <h1 className="brand login-brand">Bid Rush</h1>
          <p className="login-tagline">
            Sign in to play ranked, casual, and custom matches.
          </p>
        </div>
        <div className="login-card">
          <AccountAuthForm
            mode="signup"
            busy={busy}
            error={error}
            onLogin={handleLogin}
            onSignUp={handleSignUp}
          />
        </div>
      </div>
    </div>
  );
}
