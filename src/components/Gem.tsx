import type { Token } from '../engine';
import { GEM_LABEL } from '../engine';

/** Jewel tones (only the gems get saturated colour) + light/dark shades for facets. */
export const GEM_COLORS: Record<Token, { fill: string; light: string; dark: string; glow: string; text: string }> = {
  garnet: { fill: '#a3192f', light: '#f0617a', dark: '#4a0612', glow: '#ff4d6d', text: '#fff' },
  lapis: { fill: '#2346b0', light: '#7d9cf5', dark: '#0c1a4d', glow: '#5b8cff', text: '#fff' },
  jade: { fill: '#23875a', light: '#7fdcaa', dark: '#0b3d26', glow: '#46e39a', text: '#fff' },
  obsidian: { fill: '#2a2433', light: '#a99cc4', dark: '#07060a', glow: '#b48cff', text: '#fff' },
  moonstone: { fill: '#d9e3f0', light: '#ffffff', dark: '#7f93b3', glow: '#bcd8ff', text: '#1d2230' },
  gold: { fill: '#d29b1e', light: '#ffe08a', dark: '#6b4806', glow: '#ffc54a', text: '#2a1c00' },
};

/** Each gem has its own cut so it never relies on colour alone. */
export const GEM_CUT: Record<Token, string> = {
  garnet: 'rounded cushion cut',
  lapis: 'square step cut',
  jade: 'oval cabochon',
  obsidian: 'jagged shard',
  moonstone: 'round moon cut',
  gold: 'rough nugget',
};

const TOKENS_ALL: Token[] = ['garnet', 'lapis', 'jade', 'obsidian', 'moonstone', 'gold'];

/** Shared gradients — render once near the root. */
export function GemDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        {TOKENS_ALL.map((g) => {
          const c = GEM_COLORS[g];
          return (
            <g key={g}>
              <linearGradient id={`gem-lin-${g}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={c.light} />
                <stop offset="0.45" stopColor={c.fill} />
                <stop offset="1" stopColor={c.dark} />
              </linearGradient>
              <radialGradient id={`gem-rad-${g}`} cx="0.38" cy="0.32" r="0.75">
                <stop offset="0" stopColor={c.light} />
                <stop offset="0.5" stopColor={c.fill} />
                <stop offset="1" stopColor={c.dark} />
              </radialGradient>
            </g>
          );
        })}
        <radialGradient id="moon-sheen" cx="0.62" cy="0.38" r="0.6">
          <stop offset="0" stopColor="#9cc6ff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#9cc6ff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

const W = (o: number) => ({ fill: '#fff', opacity: o });
const B = (o: number) => ({ fill: '#000', opacity: o });

function Shape({ gem }: { gem: Token }) {
  const c = GEM_COLORS[gem];
  const edge = { stroke: c.dark, strokeWidth: 0.8, strokeLinejoin: 'round' as const };
  switch (gem) {
    case 'garnet': {
      // rounded cushion: pillow outline, octagonal table, star facets
      const outline = 'M6.5 2.6 Q12 1.4 17.5 2.6 Q21.4 2.6 21.4 6.5 Q22.6 12 21.4 17.5 Q21.4 21.4 17.5 21.4 Q12 22.6 6.5 21.4 Q2.6 21.4 2.6 17.5 Q1.4 12 2.6 6.5 Q2.6 2.6 6.5 2.6Z';
      return (
        <>
          <path d={outline} fill={`url(#gem-lin-${gem})`} {...edge} />
          <polygon points="9,6.5 15,6.5 17.5,9 17.5,15 15,17.5 9,17.5 6.5,15 6.5,9" style={W(0.18)} />
          <polygon points="12,2 15,6.5 9,6.5" style={W(0.3)} />
          <polygon points="22,12 17.5,15 17.5,9" style={B(0.25)} />
          <polygon points="12,22 9,17.5 15,17.5" style={B(0.35)} />
          <polygon points="2,12 6.5,9 6.5,15" style={W(0.22)} />
          <path d="M6.5 6.5 L9 6.5 M6.5 6.5 L6.5 9 M17.5 6.5 L15 6.5 M17.5 17.5 L15 17.5 M6.5 17.5 L9 17.5" stroke={c.light} strokeWidth="0.5" opacity="0.7" />
          <ellipse cx="9.5" cy="8.6" rx="2.2" ry="1.1" style={W(0.55)} transform="rotate(-30 9.5 8.6)" />
        </>
      );
    }
    case 'lapis': {
      // square step cut: concentric stepped squares with clipped corners
      return (
        <>
          <polygon points="4.5,2.5 19.5,2.5 21.5,4.5 21.5,19.5 19.5,21.5 4.5,21.5 2.5,19.5 2.5,4.5" fill={`url(#gem-lin-${gem})`} {...edge} />
          <polygon points="6.5,5 17.5,5 19,6.5 19,17.5 17.5,19 6.5,19 5,17.5 5,6.5" fill="none" stroke={c.light} strokeWidth="0.6" opacity="0.75" />
          <polygon points="8.5,7.5 15.5,7.5 16.5,8.5 16.5,15.5 15.5,16.5 8.5,16.5 7.5,15.5 7.5,8.5" fill="none" stroke={c.light} strokeWidth="0.6" opacity="0.6" />
          <rect x="10" y="10" width="4" height="4" style={W(0.25)} />
          <polygon points="4.5,2.5 19.5,2.5 17.5,5 6.5,5" style={W(0.28)} />
          <polygon points="21.5,4.5 21.5,19.5 19,17.5 19,6.5" style={B(0.25)} />
          <polygon points="4.5,21.5 19.5,21.5 17.5,19 6.5,19" style={B(0.35)} />
          <path d="M2.5 4.5 L10 10 M21.5 4.5 L14 10 M2.5 19.5 L10 14 M21.5 19.5 L14 14" stroke={c.light} strokeWidth="0.4" opacity="0.5" />
        </>
      );
    }
    case 'jade': {
      // oval cabochon: smooth dome, no facets
      return (
        <>
          <ellipse cx="12" cy="12" rx="7.6" ry="10.2" fill={`url(#gem-rad-${gem})`} {...edge} />
          <ellipse cx="12" cy="12.6" rx="6" ry="8.4" fill="none" stroke={c.dark} strokeWidth="0.5" opacity="0.4" />
          <path d="M8 7.5 Q9.5 4.3 12.6 3.8" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.7" />
          <ellipse cx="14.2" cy="17" rx="2.4" ry="1.2" style={W(0.15)} />
        </>
      );
    }
    case 'obsidian': {
      // jagged shard with conchoidal facet planes
      return (
        <>
          <polygon points="11,1.2 15.8,6.4 20.4,8.2 17.6,13.6 19.6,22.4 11.6,18.6 4.6,22.2 7,13.4 3.2,8.6 8.8,6.2" fill={`url(#gem-lin-${gem})`} {...edge} stroke={c.light} strokeOpacity="0.55" />
          <polygon points="11,1.2 15.8,6.4 11.6,11 8.8,6.2" style={W(0.22)} />
          <polygon points="15.8,6.4 20.4,8.2 17.6,13.6 11.6,11" style={W(0.1)} />
          <polygon points="17.6,13.6 19.6,22.4 11.6,18.6 11.6,11" style={B(0.3)} />
          <polygon points="3.2,8.6 8.8,6.2 11.6,11 7,13.4" style={W(0.14)} />
          <path d="M11 1.2 L11.6 11 L11.6 18.6 M7 13.4 L11.6 11 L17.6 13.6" stroke={c.light} strokeWidth="0.45" opacity="0.6" fill="none" />
        </>
      );
    }
    case 'moonstone': {
      // round moon cut: round stone with a blue adularescent crescent
      return (
        <>
          <circle cx="12" cy="12" r="9.8" fill={`url(#gem-rad-${gem})`} {...edge} />
          <circle cx="12" cy="12" r="9.8" fill="url(#moon-sheen)" />
          <path d="M15.6 4.6 A8 8 0 1 0 15.6 19.4 A6.3 6.3 0 1 1 15.6 4.6Z" fill="#fff" opacity="0.55" />
          <circle cx="12" cy="12" r="5.6" fill="none" stroke={c.dark} strokeWidth="0.4" opacity="0.45" />
          <circle cx="8.6" cy="8" r="1.3" style={W(0.9)} />
        </>
      );
    }
    case 'gold': {
      // rough nugget: lumpy outline, pitted surface
      return (
        <>
          <path
            d="M5.2 9.2 Q4 5.6 7.8 4.6 Q10 2.4 13 3.6 Q16.8 2.8 18.4 6 Q21.8 7.6 20.6 11.4 Q22 15 19 17 Q18 20.6 14 20 Q11.4 22 8.6 19.8 Q4.4 19.6 4.4 15.8 Q2.2 12.6 5.2 9.2Z"
            fill={`url(#gem-rad-${gem})`}
            {...edge}
          />
          <circle cx="9.2" cy="9" r="1.8" style={W(0.45)} />
          <circle cx="14.5" cy="13.5" r="1.3" style={B(0.25)} />
          <circle cx="10" cy="15.6" r="0.9" style={B(0.25)} />
          <circle cx="16.4" cy="8.6" r="0.8" style={B(0.2)} />
          <path d="M7 11.5 Q9 10.5 10.5 12" stroke={c.dark} strokeWidth="0.5" fill="none" opacity="0.5" />
        </>
      );
    }
  }
}

export function GemIcon({ gem, size = 20, title }: { gem: Token; size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title ?? `${GEM_LABEL[gem]} (${GEM_CUT[gem]})`} className={`gem-icon gem-${gem}`}>
      <title>{title ?? `${GEM_LABEL[gem]} (${GEM_CUT[gem]})`}</title>
      <Shape gem={gem} />
    </svg>
  );
}

/** A round brass-rimmed token with the gem inside, a shine sweep on hover, and an optional count. */
export function TokenChip({ gem, count, size = 44, dim }: { gem: Token; count?: number; size?: number; dim?: boolean }) {
  const c = GEM_COLORS[gem];
  return (
    <span
      className={`token-chip${dim ? ' dim' : ''}`}
      style={{ width: size, height: size, ['--glow' as string]: c.glow }}
      title={`${GEM_LABEL[gem]} — ${GEM_CUT[gem]}`}
    >
      <span className="chip-face">
        <GemIcon gem={gem} size={size * 0.66} />
      </span>
      {count !== undefined && <span className="token-count">{count}</span>}
    </span>
  );
}

/** Small "N × gem" pill used for card costs and requirements. */
export function CostPip({ gem, n, satisfied }: { gem: Token; n: number; satisfied?: boolean }) {
  return (
    <span className={`cost-pip${satisfied ? ' ok' : ''}`} title={`${n} ${GEM_LABEL[gem]}${satisfied ? ' — covered by your bonuses' : ''}`}>
      <GemIcon gem={gem} size={15} />
      <b>{n}</b>
    </span>
  );
}
