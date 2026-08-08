import { useState } from 'react';
import { LobbyAuctionBg } from '../components/LobbyAuctionBg';
import { SpriteIcon } from '../components/SpriteIcon';
import { PLAYER_COLORS } from '../game/constants';
import { markOnboardingComplete } from '../net/onboarding';

const YOU = PLAYER_COLORS[0]!;

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

function DemoShopTile({
  itemId,
  price,
  yours,
  className = '',
}: {
  itemId: string;
  price: number;
  yours?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        'shop-tile',
        yours ? 'has-bidder yours' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        yours
          ? ({ ['--bidder' as string]: YOU, background: YOU } as object)
          : undefined
      }
    >
      <SpriteIcon id={itemId} className="shop-tile-emoji" aria-hidden />
      <span className="shop-tile-price">
        <SpriteIcon id="coin" className="shop-tile-coin" aria-hidden />
        {price}
      </span>
      <div className="shop-tile-timer" aria-hidden>
        <div className="shop-tile-timer-fill onboard-real-timer" />
      </div>
      {yours ? <span className="onboard-tile-you">YOU</span> : null}
    </div>
  );
}

function DemoHandSlot({
  itemId,
  className = '',
}: {
  itemId: string;
  className?: string;
}) {
  return (
    <div className={`hand-slot filled ${className}`.trim()}>
      <SpriteIcon id={itemId} className="hand-emoji" aria-hidden />
    </div>
  );
}

function DemoBid() {
  return (
    <div className="onboard-demo demo-bid demo-bid-real" aria-hidden>
      <div className="onboard-shop-row">
        <DemoShopTile itemId="golden_goose" price={3} yours />
        <DemoShopTile itemId="coin_mine" price={2} yours />
        <DemoShopTile itemId="bargain" price={4} yours className="onboard-bid-pulse" />
      </div>
      <span className="onboard-demo-finger" />
    </div>
  );
}

function DemoBuy() {
  return (
    <div className="onboard-demo demo-buy demo-buy-real" aria-hidden>
      <DemoShopTile
        itemId="coin_mine"
        price={4}
        yours
        className="onboard-tile-resolve"
      />
      <div className="onboard-demo-arrow">→</div>
      <div className="hand-bar onboard-hand-bar">
        <div className="hand-slots">
          <DemoHandSlot itemId="coin_mine" className="onboard-hand-catch" />
          <div className="hand-slot empty" />
          <div className="hand-slot empty" />
        </div>
      </div>
      <span className="onboard-demo-sell">IN HAND</span>
    </div>
  );
}

function DemoWin() {
  return (
    <div className="onboard-demo demo-win demo-win-real" aria-hidden>
      <div className="hand-bar onboard-hand-bar">
        <div className="hand-slots">
          <DemoHandSlot itemId="pickpocket" className="onboard-hand-cast" />
          <DemoHandSlot itemId="golden_goose" className="onboard-hand-earn" />
          <DemoHandSlot itemId="time_freeze" />
        </div>
      </div>
      <div className="onboard-demo-arrow">→</div>
      <div className="onboard-demo-purses">
        <div className="onboard-purse is-you">
          <span className="onboard-purse-label">You</span>
          <span className="onboard-purse-coins">
            <SpriteIcon id="coin" className="onboard-demo-coin" aria-hidden />
            <span className="onboard-purse-num-stack">
              <span className="onboard-purse-a">12</span>
              <span className="onboard-purse-b">18</span>
            </span>
          </span>
        </div>
        <div className="onboard-purse is-rival">
          <span className="onboard-purse-label">Rival</span>
          <span className="onboard-purse-coins">
            <SpriteIcon id="coin" className="onboard-demo-coin" aria-hidden />
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
