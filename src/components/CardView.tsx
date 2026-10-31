import type { Card, GemCounts, Tier } from '../engine';
import { GEMS, TIER_NAMES } from '../engine';
import { CostPip, GEM_COLORS, GemIcon } from './Gem';

export interface CardButton {
  label: string;
  onClick: () => void;
  /** null = enabled; string = disabled with this tooltip */
  disabledReason: string | null;
  primary?: boolean;
}

export function CardView({
  card,
  bonuses,
  buttons = [],
  highlight,
  compact,
}: {
  card: Card;
  bonuses?: GemCounts;
  buttons?: CardButton[];
  highlight?: boolean;
  compact?: boolean;
}) {
  const c = GEM_COLORS[card.bonus];
  return (
    <div
      className={`card tier-${card.tier}${highlight ? ' affordable' : ''}${compact ? ' compact' : ''}`}
      style={{ ['--bonus' as string]: c.fill, ['--bonus-light' as string]: c.light }}
    >
      <div className="card-head">
        <span className="card-points">{card.points || ''}</span>
        <span className="card-bonus" title={`Permanent bonus: ${card.bonus}`}>
          <GemIcon gem={card.bonus} size={compact ? 20 : 26} />
        </span>
      </div>
      <div className="card-name" title={card.name}>
        {card.name}
      </div>
      <div className="card-cost">
        {GEMS.filter((g) => card.cost[g]).map((g) => (
          <CostPip key={g} gem={g} n={card.cost[g]!} satisfied={bonuses ? bonuses[g] >= card.cost[g]! : false} />
        ))}
      </div>
      {buttons.length > 0 && (
        <div className="card-buttons">
          {buttons.map((b) => (
            <span key={b.label} title={b.disabledReason ?? ''} className="btn-wrap">
              <button
                className={b.primary ? 'primary small' : 'small'}
                disabled={b.disabledReason !== null}
                onClick={b.onClick}
              >
                {b.label}
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CardBack({ tier, label, compact }: { tier: Tier; label?: string; compact?: boolean }) {
  return (
    <div className={`card card-back tier-${tier}${compact ? ' compact' : ''}`}>
      <div className="back-facet" aria-hidden>
        <svg viewBox="0 0 40 40" width={compact ? 26 : 36} height={compact ? 26 : 36}>
          <polygon points="20,3 37,15 30,37 10,37 3,15" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="20,11 29,17 25,29 15,29 11,17" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M20 3 L20 11 M37 15 L29 17 M30 37 L25 29 M10 37 L15 29 M3 15 L11 17" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
      <div className="back-label">{label ?? TIER_NAMES[tier]}</div>
    </div>
  );
}
