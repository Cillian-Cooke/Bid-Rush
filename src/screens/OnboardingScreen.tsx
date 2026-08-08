import { useState } from 'react';
import { LobbyAuctionBg } from '../components/LobbyAuctionBg';
import { SpriteIcon } from '../components/SpriteIcon';
import { markOnboardingComplete } from '../net/onboarding';

const STEPS = [
  {
    kicker: 'Step 1 of 3',
    title: 'Outbid the market',
    body: 'Race the clock to buy items, sell for profit, and stack combos into the biggest purse.',
    sprite: 'coin' as const,
  },
  {
    kicker: 'Step 2 of 3',
    title: 'Climb the ranks',
    body: 'Win Ranked Duels to earn RP. Higher ranks unlock more items and world events.',
    sprite: 'trophy' as const,
  },
  {
    kicker: 'Step 3 of 3',
    title: 'You are on the board',
    body: 'Your account already shows on the global leaderboard. Jump into Ranked, Casual, or Custom whenever you are ready.',
    sprite: 'book' as const,
  },
] as const;

type Props = {
  userId: string;
  displayName: string;
  onDone: () => void;
};

export function OnboardingScreen({ userId, displayName, onDone }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const last = step >= STEPS.length - 1;

  const finish = () => {
    markOnboardingComplete(userId);
    onDone();
  };

  const next = () => {
    if (last) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <div className="screen onboarding-screen">
      <LobbyAuctionBg />
      <div className="onboarding-shell">
        <div className="onboarding-card">
          <p className="rail-kicker">{current.kicker}</p>
          <div className="onboarding-icon" aria-hidden>
            <SpriteIcon id={current.sprite} className="onboarding-sprite" />
          </div>
          <h1 className="onboarding-title">{current.title}</h1>
          <p className="onboarding-body">{current.body}</p>
          {step === 0 && displayName ? (
            <p className="onboarding-hello">Welcome, {displayName}.</p>
          ) : null}

          <div className="onboarding-dots" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={`onboarding-dot${i === step ? ' on' : ''}`}
              />
            ))}
          </div>

          <div className="onboarding-actions">
            <button type="button" className="btn primary" onClick={next}>
              {last ? 'Enter lobby' : 'Next'}
            </button>
            {!last && (
              <button type="button" className="btn" onClick={finish}>
                Skip
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
