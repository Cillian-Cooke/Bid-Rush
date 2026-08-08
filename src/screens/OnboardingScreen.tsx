import { useState } from 'react';
import { LobbyAuctionBg } from '../components/LobbyAuctionBg';
import { SpriteIcon } from '../components/SpriteIcon';
import { markOnboardingComplete } from '../net/onboarding';

const STEPS = [
  {
    id: 'bid',
    kicker: 'Step 1 of 3',
    title: 'Bid on three at once',
    body: 'You can lead up to three shop tiles at the same time. Tap a tile to raise the price and claim it. If you still lead when the timer hits zero, you win that auction.',
  },
  {
    id: 'buy',
    kicker: 'Step 2 of 3',
    title: 'Wins go to your hand',
    body: 'Pay the winning price and the item is added to your hand. That’s your toolkit for the rest of the match.',
  },
  {
    id: 'win',
    kicker: 'Step 3 of 3',
    title: 'Earn up or go broke',
    body: 'Use hand items to make more money or knock rivals out. Hit 0 coins and you’re eliminated. Last player with a purse, or the richest when time’s up, wins.',
  },
] as const;

type StepId = (typeof STEPS)[number]['id'];

type Props = {
  userId: string;
  displayName: string;
  onDone: () => void;
};

function MiniTile({
  itemId,
  price,
  yours,
}: {
  itemId: string;
  price: number;
  yours?: boolean;
}) {
  return (
    <div className={`onboard-mini-tile${yours ? ' is-yours' : ''}`}>
      <SpriteIcon id={itemId} className="onboard-demo-item" />
      <div className="onboard-demo-timer onboard-mini-timer">
        <span className="onboard-demo-timer-fill" />
      </div>
      <div className="onboard-demo-price">
        <SpriteIcon id="coin" className="onboard-demo-coin" />
        <span>{price}</span>
      </div>
      {yours ? <span className="onboard-mini-you">YOU</span> : null}
    </div>
  );
}

function DemoBid() {
  return (
    <div className="onboard-demo demo-bid demo-bid-triple" aria-hidden>
      <MiniTile itemId="golden_goose" price={3} yours />
      <MiniTile itemId="coin_mine" price={2} yours />
      <MiniTile itemId="bargain" price={4} yours />
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
        <span className="onboard-demo-bid-flash is-win">WIN</span>
      </div>
      <div className="onboard-demo-arrow">→</div>
      <div className="onboard-demo-hand">
        <div className="onboard-demo-hand-slot">
          <SpriteIcon id="coin_mine" className="onboard-demo-item" />
        </div>
        <span className="onboard-demo-sell">IN HAND</span>
      </div>
    </div>
  );
}

function DemoWin() {
  return (
    <div className="onboard-demo demo-win" aria-hidden>
      <div className="onboard-demo-hand onboard-demo-hand-wide">
        <div className="onboard-demo-hand-slot is-cast">
          <SpriteIcon id="pickpocket" className="onboard-demo-item" />
        </div>
        <div className="onboard-demo-hand-slot is-earn">
          <SpriteIcon id="golden_goose" className="onboard-demo-item" />
        </div>
      </div>
      <div className="onboard-demo-arrow">→</div>
      <div className="onboard-demo-purses">
        <div className="onboard-purse is-you">
          <span className="onboard-purse-label">You</span>
          <span className="onboard-purse-coins">
            <SpriteIcon id="coin" className="onboard-demo-coin" />
            <span className="onboard-purse-num-stack">
              <span className="onboard-purse-a">12</span>
              <span className="onboard-purse-b">18</span>
            </span>
          </span>
        </div>
        <div className="onboard-purse is-rival">
          <span className="onboard-purse-label">Rival</span>
          <span className="onboard-purse-coins">
            <SpriteIcon id="coin" className="onboard-demo-coin" />
            <span className="onboard-purse-num-stack">
              <span className="onboard-rival-a">5</span>
              <span className="onboard-rival-b">0</span>
            </span>
          </span>
          <span className="onboard-ko-tag">OUT</span>
        </div>
      </div>
    </div>
  );
}

function StepDemo({ id }: { id: StepId }) {
  if (id === 'bid') return <DemoBid />;
  if (id === 'buy') return <DemoBuy />;
  return <DemoWin />;
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
