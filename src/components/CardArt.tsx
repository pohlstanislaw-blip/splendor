import { memo, type ReactNode } from 'react';
import type { Card, Gem } from '../engine';
import { GEM_COLORS } from './Gem';

/** Deterministic PRNG seeded from the card id, so a card always gets the same picture. */
function seeded(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  let s = h >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a: number, b: number) => a + next() * (b - a),
    int: (a: number, b: number) => Math.floor(a + next() * (b - a + 1)),
    pick: <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)],
    chance: (p: number) => next() < p,
  };
}
type Rng = ReturnType<typeof seeded>;

// Portrait cards: the picture fills the whole face. The top band (points, bonus) covers roughly the
// top 20%, and the cost tokens cover the bottom-left, so focal detail sits centre/right.
const VW = 120;
const VH = 168;

/** A tiny faceted crystal cluster used in veins, trays and display cases. */
function Crystal({ x, y, s, gem, glow = true }: { x: number; y: number; s: number; gem: Gem; glow?: boolean }) {
  const c = GEM_COLORS[gem];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {glow && <circle r="7" fill={c.glow} opacity="0.35" filter="url(#art-blur)" />}
      <polygon points="0,-6 3,-1 1.5,4 -1.5,4 -3,-1" fill={c.fill} stroke={c.dark} strokeWidth="0.5" />
      <polygon points="0,-6 3,-1 0,0" fill={c.light} opacity="0.7" />
      <polygon points="0,0 1.5,4 -1.5,4" fill={c.dark} opacity="0.5" />
    </g>
  );
}

function Lantern({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r="13" fill="#ffb347" opacity="0.3" filter="url(#art-blur)" />
      <line x1="0" y1="-12" x2="0" y2="-5" stroke="#3a2a17" strokeWidth="1" />
      <rect x="-3" y="-5" width="6" height="8" rx="1" fill="#ffcf73" stroke="#5a3d1c" strokeWidth="1" />
      <rect x="-3.6" y="-5.6" width="7.2" height="1.6" fill="#7a5a2c" />
      <rect x="-3.6" y="2.4" width="7.2" height="1.6" fill="#7a5a2c" />
    </g>
  );
}

/** Simple standing figure silhouette (worker, clerk, guard), facing left or right. */
function Figure({ x, y, s = 1, flip = false, hat = 'none' }: { x: number; y: number; s?: number; flip?: boolean; hat?: 'none' | 'cap' | 'hood' | 'tall' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="#16100c">
      <path d="M-7 0 Q-8 -18 -5 -24 L5 -24 Q8 -18 7 0 Z" />
      <rect x="-2" y="-28" width="4" height="5" />
      <circle cx="0" cy="-31" r="4.6" />
      {hat === 'cap' && <path d="M-5 -33 Q0 -38 5 -33 L7 -32 L-5 -32 Z" />}
      {hat === 'hood' && <path d="M-6 -27 Q-7 -38 0 -39 Q7 -38 6 -27 Z" />}
      {hat === 'tall' && <rect x="-3.6" y="-42" width="7.2" height="9" />}
      <path d="M5 -20 L12 -12 L10 -10 L4 -16 Z" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Tier 1 — Mine Shafts: tunnels, ore carts, pickaxes, glowing gem veins
// ---------------------------------------------------------------------------
function MineScene({ r, gem }: { r: Rng; gem: Gem }) {
  const c = GEM_COLORS[gem];
  const parts: ReactNode[] = [];
  parts.push(<rect key="bg" width={VW} height={VH} fill="#2a231e" />);
  for (let i = 0; i < 22; i++) {
    parts.push(
      <ellipse key={`rk${i}`} cx={r.range(-10, VW + 10)} cy={r.range(-5, VH - 30)} rx={r.range(10, 24)} ry={r.range(7, 14)} fill={r.pick(['#3a3029', '#332a24', '#41362d', '#2f2721'])} opacity="0.85" />,
    );
  }
  // tunnel, slightly right of centre
  const ax = r.range(58, 74);
  const aw = r.range(42, 52);
  const top = r.range(48, 60);
  parts.push(<path key="tunnel" d={`M${ax - aw / 2} ${VH} L${ax - aw / 2} ${top + 22} Q${ax} ${top - 8} ${ax + aw / 2} ${top + 22} L${ax + aw / 2} ${VH} Z`} fill="#0c0a09" />);
  parts.push(<ellipse key="deep" cx={ax} cy={top + 46} rx={aw / 4} ry={12} fill={c.glow} opacity="0.22" filter="url(#art-blur)" />);
  parts.push(
    <g key="timber" fill="#6b4a2b" stroke="#3b2814" strokeWidth="0.8">
      <rect x={ax - aw / 2 - 5} y={top + 10} width="5" height={VH - top} />
      <rect x={ax + aw / 2} y={top + 10} width="5" height={VH - top} />
      <rect x={ax - aw / 2 - 8} y={top + 5} width={aw + 16} height="5" />
    </g>,
  );
  // rails converging into the dark
  const ry0 = top + 40;
  parts.push(
    <g key="rails" stroke="#8b8f97" strokeWidth="1.2">
      <line x1={ax - 24} y1={VH} x2={ax - 4} y2={ry0} />
      <line x1={ax + 24} y1={VH} x2={ax + 4} y2={ry0} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const t = i / 6;
        const y = VH - t * (VH - ry0);
        const half = 28 - t * 22;
        return <line key={i} x1={ax - half} y1={y} x2={ax + half} y2={y} stroke="#5a3d22" strokeWidth={2.6 - t * 1.6} />;
      })}
    </g>,
  );
  // glowing veins on the walls
  for (let v = 0; v < r.int(3, 5); v++) {
    const vx = r.chance(0.65) ? r.range(ax + aw / 2 + 10, VW - 8) : r.range(10, ax - aw / 2 - 8);
    const vy = r.range(36, 110);
    parts.push(<path key={`ck${v}`} d={`M${vx - 12} ${vy - 6} L${vx - 4} ${vy} L${vx + 3} ${vy - 4} L${vx + 12} ${vy + 3}`} stroke={c.glow} strokeWidth="1" fill="none" opacity="0.75" />);
    for (let k = 0; k < r.int(2, 3); k++) parts.push(<Crystal key={`cr${v}-${k}`} x={vx + r.range(-9, 9)} y={vy + r.range(-4, 4)} s={r.range(0.8, 1.2)} gem={gem} />);
  }
  // ore cart (right) and pickaxe
  if (r.chance(0.7)) {
    parts.push(
      <g key="cart" transform={`translate(${r.range(92, 104)} ${VH - 12})`}>
        <polygon points="-14,-13 14,-13 11,0 -11,0" fill="#4d4f55" stroke="#22252b" strokeWidth="1" />
        <rect x="-14" y="-14" width="28" height="2" fill="#6d7079" />
        <Crystal x={-5} y={-15} s={0.9} gem={gem} glow={false} />
        <Crystal x={4} y={-16} s={1} gem={gem} glow={false} />
        <circle cx="-7" cy="1" r="3" fill="#2a2c31" stroke="#8b8f97" strokeWidth="1" />
        <circle cx="7" cy="1" r="3" fill="#2a2c31" stroke="#8b8f97" strokeWidth="1" />
      </g>,
    );
  } else {
    parts.push(<Figure key="miner" x={r.range(92, 104)} y={VH - 4} s={1.15} hat="cap" flip />);
  }
  parts.push(
    <g key="pick" transform={`translate(${r.range(100, 112)} ${VH - 30}) rotate(${r.range(-30, -12)})`}>
      <rect x="-1.2" y="-30" width="2.4" height="30" fill="#8a5f34" stroke="#3b2814" strokeWidth="0.6" />
      <path d="M-12 -28 Q0 -36 12 -28 L10 -26 Q0 -32 -10 -26 Z" fill="#9aa0a8" stroke="#3b3f45" strokeWidth="0.6" />
    </g>,
  );
  parts.push(<Lantern key="lantern" x={ax + aw / 2 + 12} y={top + 18} />);
  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Tier 2 — Cutting Workshops: cutting wheels, workbenches, lenses, gem trays
// ---------------------------------------------------------------------------
function WorkshopScene({ r, gem }: { r: Rng; gem: Gem }) {
  const c = GEM_COLORS[gem];
  const parts: ReactNode[] = [];
  parts.push(<rect key="bg" width={VW} height={VH} fill="#2b2420" />);
  for (let i = 0; i < 8; i++)
    parts.push(<rect key={`pl${i}`} x={i * 16 - r.range(0, 4)} y="0" width="16" height="118" fill={i % 2 ? '#3a2d22' : '#342820'} stroke="#21180f" strokeWidth="0.6" />);
  // tall window with a beam of daylight
  const wx = r.range(52, 76);
  parts.push(
    <g key="window">
      <polygon points={`${wx},${34} ${wx + 30},${34} ${wx + 60},${118} ${wx - 30},${118}`} fill="#ffe6a8" opacity="0.07" />
      <rect x={wx} y="30" width="30" height="44" fill="#1d2b44" stroke="#6b4a2b" strokeWidth="2.5" />
      <path d={`M${wx} 30 Q${wx + 15} 18 ${wx + 30} 30`} fill="#1d2b44" stroke="#6b4a2b" strokeWidth="2.5" />
      <line x1={wx + 15} y1="22" x2={wx + 15} y2="74" stroke="#6b4a2b" strokeWidth="1.6" />
      <line x1={wx} y1="52" x2={wx + 30} y2="52" stroke="#6b4a2b" strokeWidth="1.6" />
      <circle cx={wx + 22} cy="40" r="3" fill="#e9eef7" opacity="0.8" />
    </g>,
  );
  // shelf of jars on the left wall
  const sy = r.range(80, 92);
  parts.push(<rect key="shelf" x="0" y={sy} width={wx - 6} height="3" fill="#6b4a2b" />);
  for (let i = 0; i < 4; i++) parts.push(<rect key={`jar${i}`} x={4 + i * 10 + r.range(0, 3)} y={sy - 10} width="6" height="10" rx="1" fill="#7c8a99" opacity="0.6" stroke="#2c3138" strokeWidth="0.5" />);
  // workbench
  parts.push(
    <g key="bench">
      <rect x="0" y="118" width={VW} height="8" fill="#7a5530" stroke="#3b2814" strokeWidth="0.8" />
      <rect x="0" y="126" width={VW} height={VH - 126} fill="#2a1f16" />
      <rect x="104" y="126" width="7" height={VH - 126} fill="#5a3d22" />
    </g>,
  );
  // craftsman at the wheel
  const wheelX = r.range(80, 92);
  const wr = r.range(12, 15);
  parts.push(<Figure key="cutter" x={wheelX + wr + 10} y={118} s={1.25} hat={r.pick(['cap', 'none', 'hood'] as const)} flip />);
  parts.push(
    <g key="wheel" transform={`translate(${wheelX} ${118 - wr - 2})`}>
      <circle r={wr} fill="#8b9098" stroke="#3b3f45" strokeWidth="1.5" />
      <circle r={wr - 3} fill="none" stroke="#c9ccd2" strokeWidth="0.8" opacity="0.7" />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1="0" y1="0" x2={Math.cos((i / 6) * Math.PI * 2) * (wr - 3)} y2={Math.sin((i / 6) * Math.PI * 2) * (wr - 3)} stroke="#4a4e55" strokeWidth="1" />
      ))}
      <circle r="2.4" fill="#3b3f45" />
      {Array.from({ length: r.int(5, 8) }, (_, i) => {
        const a = Math.PI + r.range(-0.5, 0.4);
        const len = r.range(6, 12);
        return <line key={`sp${i}`} x1={wr * Math.cos(a)} y1={wr * Math.sin(a)} x2={(wr + len) * Math.cos(a)} y2={(wr + len) * Math.sin(a)} stroke={c.glow} strokeWidth="0.9" />;
      })}
    </g>,
  );
  // lens on a stand + gem tray
  const lx = r.range(52, 62);
  parts.push(
    <g key="lens" transform={`translate(${lx} 118)`}>
      <rect x="-1" y="-24" width="2" height="24" fill="#b08d57" />
      <rect x="-6" y="-2" width="12" height="2" fill="#b08d57" />
      <circle cx="0" cy="-29" r="7.5" fill="#cfe3ff" opacity="0.25" stroke="#d9b46a" strokeWidth="1.6" />
      <path d="M-4 -32 Q-1 -35 2 -34" stroke="#fff" strokeWidth="0.9" fill="none" opacity="0.7" />
      <Crystal x={0} y={-6} s={1} gem={gem} />
    </g>,
  );
  parts.push(
    <g key="tray" transform="translate(64 108)">
      <rect x="-2" y="-2" width="25" height="11" fill="#5c1a2a" stroke="#b08d57" strokeWidth="1" />
      {Array.from({ length: 6 }, (_, i) => (
        <Crystal key={i} x={(i % 3) * 7 + 3.5} y={Math.floor(i / 3) * 5 + 2.6} s={0.42} gem={gem} glow={false} />
      ))}
    </g>,
  );
  parts.push(<Lantern key="lamp" x={r.range(18, 34)} y={44} />);
  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Tier 3 — Guildhalls: grand halls, vaults, display cases, guild banners
// ---------------------------------------------------------------------------
function HallScene({ r, gem }: { r: Rng; gem: Gem }) {
  const c = GEM_COLORS[gem];
  const parts: ReactNode[] = [];
  parts.push(
    <g key="bg">
      <rect width={VW} height={VH} fill="#231d22" />
      <rect y="128" width={VW} height={VH - 128} fill="#2f2622" />
    </g>,
  );
  // perspective floor
  for (let i = 0; i < 10; i++) parts.push(<line key={`fl${i}`} x1={60 + (i - 4.5) * 7} y1="128" x2={60 + (i - 4.5) * 30} y2={VH} stroke="#4a3b32" strokeWidth="0.7" />);
  for (let j = 1; j < 4; j++) parts.push(<line key={`fz${j}`} x1="0" y1={128 + j * j * 3.4} x2={VW} y2={128 + j * j * 3.4} stroke="#4a3b32" strokeWidth="0.6" />);
  // three tall arches
  const span = VW / 3;
  for (let i = 0; i <= 3; i++) {
    const x = i * span;
    parts.push(
      <g key={`col${i}`}>
        <rect x={x - 4} y="40" width="8" height="88" fill="#4a3f45" stroke="#1a1418" strokeWidth="0.6" />
        <rect x={x - 6} y="38" width="12" height="3" fill="#b08d57" />
        <rect x={x - 6} y="126" width="12" height="3" fill="#b08d57" />
      </g>,
    );
    if (i < 3) {
      parts.push(<path key={`arch${i}`} d={`M${x + 4} 46 Q${x + span / 2} 14 ${x + span - 4} 46`} stroke="#b08d57" strokeWidth="1.3" fill="none" opacity="0.85" />);
      parts.push(<path key={`win${i}`} d={`M${x + 10} 120 L${x + 10} 56 Q${x + span / 2} 34 ${x + span - 10} 56 L${x + span - 10} 120 Z`} fill="#1a1622" opacity="0.6" />);
    }
  }
  // banners in two of the arches
  const slots = r.chance(0.5) ? [0, 2] : [1, 2];
  for (const i of slots) {
    const bx = i * span + span / 2;
    parts.push(
      <g key={`ban${i}`} transform={`translate(${bx} 50)`}>
        <line x1="-10" y1="0" x2="10" y2="0" stroke="#b08d57" strokeWidth="1.4" />
        <path d="M-8 0 L8 0 L8 36 L0 30 L-8 36 Z" fill={c.fill} stroke={c.dark} strokeWidth="0.6" />
        <path d="M-8 0 L8 0 L8 36 L0 30 L-8 36 Z" fill="url(#art-velvet)" />
        <Crystal x={0} y={14} s={0.9} gem={gem} glow={false} />
      </g>,
    );
  }
  // centrepiece, right of centre: vault door or display case
  if (r.chance(0.5)) {
    parts.push(
      <g key="vault" transform={`translate(${r.range(74, 86)} 106)`}>
        <circle r="18" fill="#5b5f67" stroke="#b08d57" strokeWidth="2.2" />
        <circle r="12" fill="#3e4148" stroke="#8b8f97" strokeWidth="1" />
        {Array.from({ length: 10 }, (_, i) => (
          <circle key={i} cx={Math.cos((i / 10) * Math.PI * 2) * 15} cy={Math.sin((i / 10) * Math.PI * 2) * 15} r="1" fill="#d9b46a" />
        ))}
        <g stroke="#d9b46a" strokeWidth="1.5">
          <line x1="-7" y1="0" x2="7" y2="0" />
          <line x1="0" y1="-7" x2="0" y2="7" />
        </g>
        <Crystal x={0} y={0} s={0.8} gem={gem} />
      </g>,
    );
  } else {
    parts.push(
      <g key="case" transform={`translate(${r.range(74, 86)} 130)`}>
        <rect x="-16" y="-7" width="32" height="7" fill="#5a3d22" stroke="#b08d57" strokeWidth="0.8" />
        <rect x="-13" y="-32" width="26" height="25" fill="#bcd3ee" opacity="0.16" stroke="#d9b46a" strokeWidth="1" />
        <polygon points="-14,-32 0,-39 14,-32" fill="#b08d57" />
        <Crystal x={-4} y={-15} s={1.1} gem={gem} />
        <Crystal x={6} y={-18} s={1.3} gem={gem} />
        <line x1="-10" y1="-29" x2="-4" y2="-23" stroke="#fff" strokeWidth="0.6" opacity="0.5" />
      </g>,
    );
  }
  if (r.chance(0.5)) parts.push(<Figure key="guard" x={r.range(100, 110)} y={130} s={1.2} hat="tall" flip />);
  // chandelier glow
  parts.push(
    <g key="chandelier">
      <ellipse cx="60" cy="30" rx="50" ry="22" fill="#ffcf73" opacity="0.14" filter="url(#art-blur)" />
      <line x1="60" y1="0" x2="60" y2="24" stroke="#b08d57" strokeWidth="0.8" />
      <path d="M46 26 Q60 34 74 26" stroke="#b08d57" strokeWidth="1.2" fill="none" />
      {[46, 53, 60, 67, 74].map((x) => (
        <circle key={x} cx={x} cy={x === 60 ? 30 : 27} r="1.5" fill="#ffe08a" />
      ))}
    </g>,
  );
  return <>{parts}</>;
}

export const CardArt = memo(function CardArt({ card }: { card: Card }) {
  const r = seeded(card.id);
  const Scene = card.tier === 1 ? MineScene : card.tier === 2 ? WorkshopScene : HallScene;
  return (
    <svg className="card-art" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <Scene r={r} gem={card.bonus} />
      <rect width={VW} height={VH} fill="url(#art-vignette)" />
    </svg>
  );
});

/** Shared filters/gradients for card art — render once near the root. */
export function ArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <filter id="art-blur" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <radialGradient id="art-vignette" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </radialGradient>
        <linearGradient id="art-velvet" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
    </svg>
  );
}
