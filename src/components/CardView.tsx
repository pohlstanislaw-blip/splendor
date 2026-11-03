import type { Card, Gem, GemCounts, Tier } from '../engine';
import { GEMS, GEM_LABEL, TIER_NAMES } from '../engine';
import { CardArt } from './CardArt';
import { GEM_COLORS, GEM_CUT, GemIcon } from './Gem';

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

/**
 * A round cost token: gem-coloured disc with a white rim and a large number. A faint outline of
 * the gem's cut sits behind the number so the colour is never the only cue.
 */
export function CostToken({ gem, n, satisfied, size }: { gem: Gem; n: number; satisfied?: boolean; size?: number }) {
  const c = GEM_COLORS[gem];
  const light = gem === 'moonstone';
  return (
    <span
      className={`cost-token${satisfied ? ' ok' : ''}${light ? ' light' : ''}`}
      style={{ ['--fill' as string]: c.fill, ['--light' as string]: c.light, ['--dark' as string]: c.dark, ...(size ? { width: size, height: size, fontSize: size * 0.62 } : {}) }}
      title={`${n} ${GEM_LABEL[gem]} (${GEM_CUT[gem]})${satisfied ? ' — covered by your bonuses' : ''}`}
      aria-label={`${n} ${GEM_LABEL[gem]}`}
    >
      <span className="cost-cut" aria-hidden>
        <GemIcon gem={gem} size={24} />
      </span>
      <b>{n}</b>
    </span>
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
  const costs = GEMS.filter((g) => card.cost[g]);
  return (
    <div className={`card-slot${compact ? ' compact' : ''}`}>
      <div
        className={`card face tier-${card.tier}${highlight ? ' affordable' : ''}${compact ? ' compact' : ' deal'}`}
        style={{ ['--bonus' as string]: c.fill, ['--bonus-glow' as string]: c.glow }}
        data-card-id={fxId}
        title={`${card.name} · ${TIER_NAMES[card.tier]}`}
        role="group"
        aria-label={`${card.name}: ${card.points} prestige, ${card.bonus} bonus, costs ${costs.map((g) => `${card.cost[g]} ${g}`).join(', ')}`}
      >
        <CardArt card={card} />
        <div className="face-band">
          <span className="face-points" aria-hidden>
            {card.points || ''}
          </span>
          <span className="face-bonus" title={`Permanent bonus: ${GEM_LABEL[card.bonus]}`}>
            <GemIcon gem={card.bonus} size={compact ? 22 : 30} />
          </span>
        </div>
        <div className="face-costs">
          {costs.map((g) => (
            <CostToken key={g} gem={g} n={card.cost[g]!} satisfied={bonuses ? bonuses[g] >= card.cost[g]! : false} />
          ))}
        </div>
        <span className="face-tier" aria-hidden>
          {'◆'.repeat(card.tier)}
        </span>
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

/**
 * A player's purchased cards: one column per gem colour, each a cascade of cards stacked on top
 * of each other and offset so every card's top band (points + gem) stays visible.
 */
export function BoughtStacks({ cardIds, getCard }: { cardIds: string[]; getCard: (id: string) => Card }) {
  const cards = cardIds.map(getCard);
  return (
    <div className="bought-stacks">
      {GEMS.map((g) => {
        const stack = cards.filter((c) => c.bonus === g);
        const points = stack.reduce((s, c) => s + c.points, 0);
        return (
          <div
            key={g}
            className={`bought-col${stack.length ? '' : ' empty'}`}
            aria-label={`${stack.length} ${GEM_LABEL[g]} card${stack.length === 1 ? '' : 's'}, ${points} prestige`}
          >
            <div className="bought-head" title={`${stack.length} ${GEM_LABEL[g]} bonus${stack.length === 1 ? '' : 'es'} · ${points} prestige from these cards`}>
              <GemIcon gem={g} size={16} />
              <b>{stack.length}</b>
            </div>
            <div className="bought-stack">
              {stack.length === 0 && <div className="bought-slot" aria-hidden />}
              {stack.map((c) => (
                <div
                  key={c.id}
                  className={`card face bought tier-${c.tier}`}
                  style={{ ['--bonus' as string]: GEM_COLORS[c.bonus].fill, ['--bonus-glow' as string]: GEM_COLORS[c.bonus].glow }}
                  title={`${c.name} · ${c.points} prestige · ${TIER_NAMES[c.tier]}`}
                >
                  <CardArt card={c} />
                  <div className="face-band">
                    <span className="face-points">{c.points || ''}</span>
                    <span className="face-bonus">
                      <GemIcon gem={c.bonus} size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
