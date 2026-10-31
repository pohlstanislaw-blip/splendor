import type { Card, GemCounts, Tier } from '../engine';
import { GEMS, TIER_NAMES } from '../engine';
import { CardArt } from './CardArt';
import { CostPip, GEM_COLORS, GemIcon } from './Gem';

export interface CardButton {
  label: string;
  onClick: () => void;
  /** null = enabled; string = disabled with this tooltip */
  disabledReason: string | null;
  primary?: boolean;
}

const FRAME: Record<Tier, string> = { 1: 'frame-timber', 2: 'frame-iron', 3: 'frame-gilded' };

/** Gold filigree flourish for Guildhall corners (one corner; rotated with CSS). */
function Filigree() {
  return (
    <svg className="filigree" viewBox="0 0 30 30" aria-hidden focusable="false">
      <path d="M2 28 L2 8 Q2 2 8 2 L28 2" fill="none" stroke="#f3d27a" strokeWidth="1.6" />
      <path d="M6 24 Q6 10 14 8 Q10 13 14 15 Q18 9 24 6" fill="none" stroke="#c99a2e" strokeWidth="1.1" />
      <circle cx="7" cy="7" r="2.2" fill="#f3d27a" stroke="#8a6414" strokeWidth="0.6" />
      <path d="M12 4 Q15 7 18 4 M4 12 Q7 15 4 18" fill="none" stroke="#f3d27a" strokeWidth="0.9" />
    </svg>
  );
}

export function CardView({
  card,
  bonuses,
  buttons = [],
  highlight,
  compact,
  fxId,
}: {
  card: Card;
  bonuses?: GemCounts;
  buttons?: CardButton[];
  highlight?: boolean;
  compact?: boolean;
  /** marks the element for animations (card ghosts) */
  fxId?: string;
}) {
  const c = GEM_COLORS[card.bonus];
  return (
    <div
      className={`card ${FRAME[card.tier]} tier-${card.tier}${highlight ? ' affordable' : ''}${compact ? ' compact' : ' deal'}`}
      style={{ ['--bonus' as string]: c.fill, ['--bonus-glow' as string]: c.glow }}
      data-card-id={fxId}
    >
      {card.tier === 3 && (
        <>
          <span className="corner tl"><Filigree /></span>
          <span className="corner tr"><Filigree /></span>
          <span className="corner bl"><Filigree /></span>
          <span className="corner br"><Filigree /></span>
        </>
      )}
      <div className="card-art-wrap">
        {!compact && <CardArt card={card} />}
        <div className="card-head">
          <span className="card-points" aria-label={`${card.points} prestige`}>
            {card.points || ''}
          </span>
          <span className="card-bonus" title={`Permanent bonus: ${card.bonus}`}>
            <GemIcon gem={card.bonus} size={compact ? 20 : 26} />
          </span>
        </div>
      </div>
      <div className="card-parchment">
        <div className="card-name" title={card.name}>
          {card.name}
        </div>
        <div className="card-cost">
          {GEMS.filter((g) => card.cost[g]).map((g) => (
            <CostPip key={g} gem={g} n={card.cost[g]!} satisfied={bonuses ? bonuses[g] >= card.cost[g]! : false} />
          ))}
        </div>
      </div>
      {buttons.length > 0 && (
        <div className="card-buttons">
          {buttons.map((b) => (
            <span key={b.label} title={b.disabledReason ?? ''} className="btn-wrap">
              <button className={b.primary ? 'primary small' : 'small'} disabled={b.disabledReason !== null} onClick={b.onClick}>
                {b.label}
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const BACK_EMBLEM: Record<Tier, JSX.Element> = {
  // pick & lantern
  1: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M10 30 L28 12" />
      <path d="M20 6 Q30 8 34 18" />
      <rect x="22" y="22" width="8" height="10" rx="1.5" />
      <path d="M26 18 L26 22" />
    </g>
  ),
  // cutting wheel
  2: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="20" cy="20" r="12" />
      <circle cx="20" cy="20" r="3" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1={20} y1={20} x2={20 + Math.cos((i * Math.PI) / 3) * 12} y2={20 + Math.sin((i * Math.PI) / 3) * 12} />
      ))}
    </g>
  ),
  // guild crown over gem
  3: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M8 16 L12 6 L17 12 L20 4 L23 12 L28 6 L32 16 Z" />
      <polygon points="20,20 27,26 20,36 13,26" />
      <path d="M13 26 L27 26" />
    </g>
  ),
};

export function CardBack({ tier, label, compact, fxId }: { tier: Tier; label?: string; compact?: boolean; fxId?: string }) {
  return (
    <div className={`card card-back ${FRAME[tier]} tier-${tier}${compact ? ' compact' : ''}`} data-card-id={fxId}>
      {tier === 3 && (
        <>
          <span className="corner tl"><Filigree /></span>
          <span className="corner tr"><Filigree /></span>
          <span className="corner bl"><Filigree /></span>
          <span className="corner br"><Filigree /></span>
        </>
      )}
      <div className="back-emblem" aria-hidden>
        <svg viewBox="0 0 40 40" width={compact ? 26 : 38} height={compact ? 26 : 38}>
          {BACK_EMBLEM[tier]}
        </svg>
      </div>
      <div className="back-label">{label ?? TIER_NAMES[tier]}</div>
    </div>
  );
}
