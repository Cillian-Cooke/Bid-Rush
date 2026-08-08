import { useState } from 'react';
import { LobbyAuctionBg } from '../components/LobbyAuctionBg';
import { SpriteIcon } from '../components/SpriteIcon';
import { markOnboardingComplete } from '../net/onboarding';

const STEPS = [
  {
    id: 'bid',
    kicker: 'Step 1 of 3',
    title: 'Bid on the shop',
    body: 'Tap a tile to raise its price and take the lead. The timer resets on every bid — hold it until it hits zero.',
  },
  {
    id: 'buy',
    kicker: 'Step 2 of 3',
    title: 'Buy, then sell',
    body: 'When the timer ends you pay the price and the item lands in your hand. Sell anything you don’t need for coins.',
  },
  {
    id: 'use',
    kicker: 'Step 3 of 3',
    title: 'Use your items',
    body: 'Play actives from your hand to freeze timers, lock bids, or drain rivals. Biggest purse at the end wins.',
  },
] as const;

type StepId = (typeof STEPS)[number]['id'];

type Props = {
  userId: string;
  displayName: string;
  onDone: () => void;
};

function DemoBid() {
  return (
    <div className="onboard-demo demo-bid" aria-hidden>
      <div className="onboard-demo-tile">
        <SpriteIcon id="golden_goose" className="onboard-demo-item" />
        <div className="onboard-demo-timer">
          <span className="onboard-demo-timer-fill" />
        </div>
        <div className="onboard-demo-price">
          <SpriteIcon id="coin" className="onboard-demo-coin" />
          <span className="onboard-demo-price-stack">
            <span className="onboard-demo-price-a">3</span>
            <span className="onboard-demo-price-b">4</span>
          </span>
        </div>
        <span className="onboard-demo-bid-flash">BID</span>
      </div>
      <span className="onboard-demo-finger" />
    </div>
  );
}

function DemoBuy() {
  return (
    <div className="onboard-demo demo-buy" aria-hidden>
      <div className="onboard-demo-tile onboard-demo-tile-resolve">
        <SpriteIcon id="coin_mine" className="onboard-demo-item" />
        <div className="onboard-demo-price">
          <SpriteIcon id="coin" className="onboard-demo-coin" />
          <span>4</span>
        </div>
      </div>
      <div className="onboard-demo-arrow">→</div>
      <div className="onboard-demo-hand">
        <div className="onboard-demo-hand-slot">
          <SpriteIcon id="coin_mine" className="onboard-demo-item" />
        </div>
        <span className="onboard-demo-sell">SELL +6</span>
      </div>
    </div>
  );
}

function DemoUse() {
  return (
    <div className="onboard-demo demo-use" aria-hidden>
      <div className="onboard-demo-hand onboard-demo-hand-wide">
        <div className="onboard-demo-hand-slot is-cast">
          <SpriteIcon id="time_freeze" className="onboard-demo-item" />
        </div>
        <div className="onboard-demo-hand-slot">
          <SpriteIcon id="bargain" className="onboard-demo-item" />
        </div>
      </div>
      <div className="onboard-demo-arrow">→</div>
      <div className="onboard-demo-tile is-frozen">
        <SpriteIcon id="money_printer" className="onboard-demo-item" />
        <div className="onboard-demo-frost" />
        <span className="onboard-demo-freeze-tag">FREEZE</span>
      </div>
    </div>
  );
}

function StepDemo({ id }: { id: StepId }) {
  if (id === 'bid') return <DemoBid />;
  if (id === 'buy') return <DemoBuy />;
  return <DemoUse />;
}

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
          {step === 0 && displayName ? (
            <p className="onboarding-hello">Welcome, {displayName}.</p>
          ) : null}

          <div key={current.id} className="onboarding-demo-wrap">
            <StepDemo id={current.id} />
          </div>

          <h1 className="onboarding-title">{current.title}</h1>
          <p className="onboarding-body">{current.body}</p>

          <div className="onboarding-dots" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.id}
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
