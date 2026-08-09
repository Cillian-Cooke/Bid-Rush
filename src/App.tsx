import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LandscapeBlocker } from './components/LandscapeBlocker';
import { useGameStore } from './store';
import { Lobby } from './screens/Lobby';
import { LoginScreen } from './screens/LoginScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { NameAuction } from './screens/NameAuction';
import { Game } from './screens/Game';
import { Results } from './screens/Results';
import { MatchPoolReveal } from './components/MatchPoolReveal';
import {
  getNakamaProfile,
  installNakamaConnectionWatchers,
  isEmailAccount,
  restoreEmailSessionIfAny,
  setNakamaConnectionListener,
  type AuthResult,
  type NakamaProfile,
} from './net/nakama';
import { leaveOnlineRoom } from './net/onlineSession';
import { cancelMatchmaking } from './net/matchmaking';
import { hasCompletedOnboarding } from './net/onboarding';

type Sheet = 'match' | 'results';
type Gate = 'loading' | 'login' | 'onboarding' | 'play';

const SHEET_MS = 400;

function useSheet(want: boolean): { show: boolean; leaving: boolean } {
  const [show, setShow] = useState(want);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(0);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (want) {
      setShow(true);
      setLeaving(false);
      return;
    }
    if (!show) return;
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      setShow(false);
      setLeaving(false);
    }, SHEET_MS);
    return () => window.clearTimeout(timer.current);
  }, [want, show]);

  return { show, leaving };
}

function StackSheet({
  show,
  leaving,
  kind,
  covered,
  children,
}: {
  show: boolean;
  leaving: boolean;
  kind: Sheet;
  covered?: boolean;
  children: ReactNode;
}) {
  if (!show) return null;
  return (
    <div
      className={[
        'stack-sheet',
        `stack-sheet-${kind}`,
        leaving ? 'is-leave' : 'is-enter',
        covered ? 'is-covered' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

function gateAfterProfile(profile: NakamaProfile, forceOnboarding: boolean): Gate {
  if (forceOnboarding || !hasCompletedOnboarding(profile.userId)) {
    return 'onboarding';
  }
  return 'play';
}

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const countdown = useGameStore((s) => s.countdown);
  const game = useGameStore((s) => s.game);
  const matchPool = useGameStore((s) => s.matchPool);
  const poolRevealOpen = useGameStore((s) => s.poolRevealOpen);
  const poolRevealPeeked = useGameStore((s) => s.poolRevealPeeked);
  const closePoolReveal = useGameStore((s) => s.closePoolReveal);

  const [gate, setGate] = useState<Gate>('loading');
  const [profile, setProfile] = useState<NakamaProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const restored = await restoreEmailSessionIfAny();
        if (cancelled) return;
        if (restored && isEmailAccount()) {
          setProfile(restored);
          setGate(gateAfterProfile(restored, false));
          return;
        }
        setGate('login');
      } catch {
        if (!cancelled) setGate('login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stopWatchers = installNakamaConnectionWatchers();
    setNakamaConnectionListener((ev) => {
      const st = useGameStore.getState();
      if (ev.kind === 'lost') {
        void cancelMatchmaking();
        if (!st.online) return;
        useGameStore.setState({
          onlineError: `${ev.reason}. Reconnecting…`,
        });
        return;
      }
      // restored
      const phase = useGameStore.getState().phase;
      const online = useGameStore.getState().online;
      if (
        online &&
        (phase === 'playing' ||
          phase === 'countdown' ||
          phase === 'naming' ||
          phase === 'results')
      ) {
        void leaveOnlineRoom(true).finally(() => {
          useGameStore.getState().returnToLobby();
          useGameStore.setState({
            onlineError:
              'Connection dropped during the match. Queue again when ready.',
          });
        });
        return;
      }
      useGameStore.setState({ onlineError: null });
    });
    return () => {
      stopWatchers();
      setNakamaConnectionListener(null);
    };
  }, []);

  const onAuthenticated = (result: AuthResult) => {
    setProfile(result.profile);
    setGate(gateAfterProfile(result.profile, result.isNewAccount));
  };

  const onOnboardingDone = () => {
    const p = profile ?? getNakamaProfile();
    if (p) setProfile(p);
    setGate('play');
  };

  const onLoggedOut = () => {
    setProfile(null);
    setGate('login');
    useGameStore.getState().returnToLobby();
  };

  // Keep match mounted under results so lobby stays the true bottom of the stack
  const wantMatch =
    gate === 'play' &&
    (phase === 'naming' ||
      phase === 'countdown' ||
      phase === 'playing' ||
      phase === 'results');
  const wantResults = gate === 'play' && phase === 'results';
  const matchSheet = useSheet(wantMatch);
  const resultsSheet = useSheet(wantResults);

  // Keep last match sub-phase so leave animation still shows the right screen
  const matchView = useRef<'naming' | 'countdown' | 'playing'>('naming');
  if (phase === 'naming' || phase === 'countdown' || phase === 'playing') {
    matchView.current = phase;
  }

  const lobbyBuried = matchSheet.show || resultsSheet.show;
  // While results covers the match (including joint leave), don't animate match out
  const matchCovered = resultsSheet.show;

  const pool = game?.itemPool ?? matchPool;
  const matchKind = useGameStore((s) => s.matchKind);
  const rankedRankIndex = useGameStore((s) => s.rankedRankIndex);
  const lobbyMode = useGameStore((s) => s.lobby.mode);
  const namingMode = useGameStore((s) => s.naming?.mode);
  const poolMode = game?.mode ?? namingMode ?? lobbyMode ?? 'duel';
  const showPool =
    poolRevealOpen &&
    !!pool &&
    (phase === 'naming' || phase === 'countdown' || phase === 'playing');

  const view = matchView.current;

  if (gate === 'loading') {
    return (
      <div className="app-stack">
        <LandscapeBlocker />
        <div className="screen login-screen login-loading">
          <p className="login-loading-copy">Loading…</p>
        </div>
      </div>
    );
  }

  if (gate === 'login') {
    return (
      <div className="app-stack">
        <LandscapeBlocker />
        <LoginScreen onAuthenticated={onAuthenticated} />
      </div>
    );
  }

  if (gate === 'onboarding' && profile) {
    return (
      <div className="app-stack">
        <LandscapeBlocker />
        <OnboardingScreen
          userId={profile.userId}
          displayName={profile.displayName}
          onDone={onOnboardingDone}
        />
      </div>
    );
  }

  return (
    <div className="app-stack">
      <LandscapeBlocker />
      <div
        className={`stack-base${lobbyBuried ? ' is-buried' : ''}`}
        aria-hidden={lobbyBuried}
      >
        <Lobby onLoggedOut={onLoggedOut} />
      </div>

      <StackSheet
        show={matchSheet.show}
        leaving={matchSheet.leaving}
        kind="match"
        covered={matchCovered}
      >
        {view === 'naming' && <NameAuction />}
        {(view === 'countdown' || view === 'playing') && <Game />}
        {showPool && (
          <MatchPoolReveal
            countdown={countdown}
            itemPool={pool}
            mode={poolMode === 'blitz' ? 'blitz' : 'duel'}
            early={phase === 'naming' || phase === 'playing'}
            skipEntrance={
              (phase === 'countdown' || phase === 'playing') && poolRevealPeeked
            }
            onClose={closePoolReveal}
            ranked={matchKind === 'ranked'}
            rankedRankIndex={rankedRankIndex ?? 0}
          />
        )}
      </StackSheet>

      <StackSheet
        show={resultsSheet.show}
        leaving={resultsSheet.leaving}
        kind="results"
      >
        <Results />
      </StackSheet>
    </div>
  );
}
