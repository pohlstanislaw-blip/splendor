import type { Token } from '../engine';
import { GEM_LABEL } from '../engine';

/** Fill / stroke / facet-line colours for each gem. */
export const GEM_COLORS: Record<Token, { fill: string; light: string; stroke: string; text: string }> = {
  garnet: { fill: '#c23a3a', light: '#ec7b6f', stroke: '#6e1515', text: '#fff' },
  lapis: { fill: '#2a5bd7', light: '#7ea3f2', stroke: '#112b6e', text: '#fff' },
  jade: { fill: '#1f9a62', light: '#6fd4a2', stroke: '#0b4f31', text: '#fff' },
  obsidian: { fill: '#2b2a33', light: '#8a879c', stroke: '#a9a6bb', text: '#fff' },
  moonstone: { fill: '#e9eef5', light: '#ffffff', stroke: '#7d8796', text: '#1d2230' },
  gold: { fill: '#e2ab27', light: '#ffe08a', stroke: '#7a5208', text: '#2a1c00' },
};

/** Each gem has its own cut so it never relies on colour alone. */
export const GEM_CUT: Record<Token, string> = {
  garnet: 'triangle cut',
  lapis: 'square cut',
  jade: 'hexagon cut',
  obsidian: 'tall diamond cut',
  moonstone: 'round cabochon',
  gold: 'star nugget',
};

function Shape({ gem }: { gem: Token }) {
  const c = GEM_COLORS[gem];
  const common = { fill: c.fill, stroke: c.stroke, strokeWidth: 1.2, strokeLinejoin: 'round' as const };
  const facet = { stroke: c.light, strokeWidth: 0.9, fill: 'none', opacity: 0.9 };
  switch (gem) {
    case 'garnet': // trillion
      return (
        <>
          <polygon points="12,2.5 22,20.5 2,20.5" {...common} />
          <polygon points="12,8.5 16.6,16.8 7.4,16.8" {...facet} />
          <path d="M12 2.5 L12 8.5 M22 20.5 L16.6 16.8 M2 20.5 L7.4 16.8" {...facet} />
        </>
      );
    case 'lapis': // princess
      return (
        <>
          <rect x="3" y="3" width="18" height="18" rx="1.5" {...common} />
          <rect x="8" y="8" width="8" height="8" {...facet} />
          <path d="M3 3 L8 8 M21 3 L16 8 M3 21 L8 16 M21 21 L16 16" {...facet} />
        </>
      );
    case 'jade': // hexagon
      return (
        <>
          <polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7" {...common} />
          <polygon points="12,7 16.3,9.5 16.3,14.5 12,17 7.7,14.5 7.7,9.5" {...facet} />
          <path d="M12 2 L12 7 M20.7 7 L16.3 9.5 M20.7 17 L16.3 14.5 M12 22 L12 17 M3.3 17 L7.7 14.5 M3.3 7 L7.7 9.5" {...facet} />
        </>
      );
    case 'obsidian': // tall diamond
      return (
        <>
          <polygon points="12,1.5 19.5,12 12,22.5 4.5,12" {...common} />
          <polygon points="12,6.5 15.5,12 12,17.5 8.5,12" {...facet} />
          <path d="M4.5 12 L19.5 12" {...facet} />
        </>
      );
    case 'moonstone': // cabochon
      return (
        <>
          <circle cx="12" cy="12" r="9.5" {...common} />
          <ellipse cx="9" cy="8.5" rx="3.6" ry="2.2" fill={c.stroke} opacity="0.18" transform="rotate(-30 9 8.5)" />
          <circle cx="12" cy="12" r="5.5" {...facet} stroke={c.stroke} opacity="0.35" />
        </>
      );
    case 'gold': // star nugget
      return (
        <>
          <polygon
            points="12,2 14.6,8.6 21.5,9 16.2,13.4 17.9,20.3 12,16.5 6.1,20.3 7.8,13.4 2.5,9 9.4,8.6"
            {...common}
          />
          <polygon points="12,7.5 13.4,10.6 16.6,11 14.2,13.1 14.9,16.3 12,14.5 9.1,16.3 9.8,13.1 7.4,11 10.6,10.6" {...facet} />
        </>
      );
  }
}

export function GemIcon({ gem, size = 20, title }: { gem: Token; size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title ?? GEM_LABEL[gem]} className="gem-icon">
      <title>{title ?? `${GEM_LABEL[gem]} (${GEM_CUT[gem]})`}</title>
      <Shape gem={gem} />
    </svg>
  );
}

/** A round token chip with the gem cut inside and an optional count. */
export function TokenChip({
  gem,
  count,
  size = 44,
  dim,
}: {
  gem: Token;
  count?: number;
  size?: number;
  dim?: boolean;
}) {
  const c = GEM_COLORS[gem];
  return (
    <span
      className={`token-chip${dim ? ' dim' : ''}`}
      style={{ width: size, height: size, borderColor: c.fill, background: `radial-gradient(circle at 35% 30%, ${c.light}55, #1b2233 70%)` }}
      title={`${GEM_LABEL[gem]} — ${GEM_CUT[gem]}`}
    >
      <GemIcon gem={gem} size={size * 0.58} />
      {count !== undefined && <span className="token-count">{count}</span>}
    </span>
  );
}

/** Small "N × gem" pill used for card costs and requirements. */
export function CostPip({ gem, n, satisfied }: { gem: Token; n: number; satisfied?: boolean }) {
  const c = GEM_COLORS[gem];
  return (
    <span
      className={`cost-pip${satisfied ? ' ok' : ''}`}
      style={{ borderColor: c.fill }}
      title={`${n} ${GEM_LABEL[gem]}`}
    >
      <GemIcon gem={gem} size={13} />
      <b>{n}</b>
    </span>
  );
}
