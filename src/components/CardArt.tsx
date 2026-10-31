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

const VW = 160;
const VH = 84;

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
      <circle r="12" fill="#ffb347" opacity="0.28" filter="url(#art-blur)" />
      <line x1="0" y1="-9" x2="0" y2="-5" stroke="#3a2a17" strokeWidth="1" />
      <rect x="-3" y="-5" width="6" height="8" rx="1" fill="#ffcf73" stroke="#5a3d1c" strokeWidth="1" />
      <rect x="-3.6" y="-5.6" width="7.2" height="1.6" fill="#7a5a2c" />
      <rect x="-3.6" y="2.4" width="7.2" height="1.6" fill="#7a5a2c" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Tier 1 — Mine Shafts: tunnels, ore carts, pickaxes, glowing veins
// ---------------------------------------------------------------------------
function MineScene({ r, gem }: { r: Rng; gem: Gem }) {
  const c = GEM_COLORS[gem];
  const archX = r.range(56, 104);
  const archW = r.range(46, 62);
  const parts: ReactNode[] = [];
  // rock wall
  parts.push(<rect key="bg" width={VW} height={VH} fill="#2a241f" />);
  for (let i = 0; i < 14; i++) {
    const x = r.range(-10, VW);
    const y = r.range(-5, VH - 20);
    parts.push(<ellipse key={`rk${i}`} cx={x} cy={y} rx={r.range(10, 26)} ry={r.range(6, 12)} fill={r.pick(['#3a3029', '#332a24', '#40352c'])} opacity="0.8" />);
  }
  // tunnel mouth
  const top = 14;
  parts.push(
    <path key="tunnel" d={`M${archX - archW / 2} ${VH} L${archX - archW / 2} ${top + 18} Q${archX} ${top - 6} ${archX + archW / 2} ${top + 18} L${archX + archW / 2} ${VH} Z`} fill="#0d0b0a" />,
  );
  parts.push(<ellipse key="deep" cx={archX} cy={VH - 26} rx={archW / 5} ry={8} fill={c.glow} opacity="0.18" filter="url(#art-blur)" />);
  // timber supports
  const tw = 5;
  parts.push(
    <g key="timber" fill="#6b4a2b" stroke="#3b2814" strokeWidth="0.8">
      <rect x={archX - archW / 2 - tw} y={top + 8} width={tw} height={VH - top} />
      <rect x={archX + archW / 2} y={top + 8} width={tw} height={VH - top} />
      <rect x={archX - archW / 2 - tw - 3} y={top + 4} width={archW + tw * 2 + 6} height={tw} />
    </g>,
  );
  // rails converging into the tunnel
  parts.push(
    <g key="rails" stroke="#8b8f97" strokeWidth="1.2">
      <line x1={archX - 26} y1={VH} x2={archX - 5} y2={VH - 24} />
      <line x1={archX + 26} y1={VH} x2={archX + 5} y2={VH - 24} />
      {[0, 1, 2, 3, 4].map((i) => {
        const t = i / 5;
        const y = VH - t * 24;
        const half = 30 - t * 24;
        return <line key={i} x1={archX - half} y1={y} x2={archX + half} y2={y} stroke="#5a3d22" strokeWidth={2.4 - t * 1.4} />;
      })}
    </g>,
  );
  // veins: glowing crystal clusters along a crack
  const veinCount = r.int(2, 4);
  for (let v = 0; v < veinCount; v++) {
    const side = r.chance(0.5) ? -1 : 1;
    const vx = archX + side * (archW / 2 + r.range(14, 40));
    const vy = r.range(18, 56);
    const crack = `M${vx - 14} ${vy - 6} L${vx - 4} ${vy} L${vx + 4} ${vy - 3} L${vx + 14} ${vy + 4}`;
    parts.push(<path key={`ck${v}`} d={crack} stroke={c.glow} strokeWidth="1" fill="none" opacity="0.7" />);
    for (let k = 0; k < r.int(2, 3); k++)
      parts.push(<Crystal key={`cr${v}-${k}`} x={vx + r.range(-10, 10)} y={vy + r.range(-4, 4)} s={r.range(0.7, 1.15)} gem={gem} />);
  }
  // ore cart or pickaxe
  if (r.chance(0.6)) {
    const cx = r.chance(0.5) ? r.range(14, 40) : r.range(120, 146);
    parts.push(
      <g key="cart" transform={`translate(${cx} ${VH - 14})`}>
        <polygon points="-14,-12 14,-12 11,0 -11,0" fill="#4d4f55" stroke="#22252b" strokeWidth="1" />
        <rect x="-14" y="-13" width="28" height="2" fill="#6d7079" />
        <Crystal x={-5} y={-14} s={0.8} gem={gem} glow={false} />
        <Crystal x={4} y={-15} s={0.9} gem={gem} glow={false} />
        <circle cx="-7" cy="1" r="3" fill="#2a2c31" stroke="#8b8f97" strokeWidth="1" />
        <circle cx="7" cy="1" r="3" fill="#2a2c31" stroke="#8b8f97" strokeWidth="1" />
      </g>,
    );
  }
  if (r.chance(0.65)) {
    const px = r.chance(0.5) ? r.range(10, 34) : r.range(126, 150);
    const rot = r.range(-35, -10);
    parts.push(
      <g key="pick" transform={`translate(${px} ${VH - 6}) rotate(${rot})`}>
        <rect x="-1.2" y="-30" width="2.4" height="30" fill="#8a5f34" stroke="#3b2814" strokeWidth="0.6" />
        <path d="M-12 -28 Q0 -36 12 -28 L10 -26 Q0 -32 -10 -26 Z" fill="#9aa0a8" stroke="#3b3f45" strokeWidth="0.6" />
      </g>,
    );
  }
  parts.push(<Lantern key="lantern" x={archX - archW / 2 - 12} y={top + 20} s={0.9} />);
  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Tier 2 — Cutting Workshops: cutting wheels, workbenches, lenses, gem trays
// ---------------------------------------------------------------------------
function WorkshopScene({ r, gem }: { r: Rng; gem: Gem }) {
  const c = GEM_COLORS[gem];
  const parts: ReactNode[] = [];
  parts.push(<rect key="bg" width={VW} height={VH} fill="#2b2420" />);
  // plank wall
  for (let i = 0; i < 9; i++)
    parts.push(<rect key={`pl${i}`} x={i * 18 - r.range(0, 4)} y="0" width="18" height="52" fill={i % 2 ? '#3a2d22' : '#342820'} stroke="#21180f" strokeWidth="0.6" />);
  // window or shelf
  if (r.chance(0.5)) {
    const wx = r.range(18, 120);
    parts.push(
      <g key="window">
        <rect x={wx} y="8" width="26" height="22" fill="#1d2b44" stroke="#6b4a2b" strokeWidth="2" />
        <line x1={wx + 13} y1="8" x2={wx + 13} y2="30" stroke="#6b4a2b" strokeWidth="1.5" />
        <line x1={wx} y1="19" x2={wx + 26} y2="19" stroke="#6b4a2b" strokeWidth="1.5" />
        <circle cx={wx + 19} cy="13" r="2.4" fill="#e9eef7" opacity="0.8" />
      </g>,
    );
  } else {
    const sy = r.range(14, 24);
    parts.push(<rect key="shelf" x="8" y={sy} width="144" height="3" fill="#6b4a2b" />);
    for (let i = 0; i < 6; i++) {
      const x = r.range(14, 146);
      parts.push(<rect key={`jar${i}`} x={x} y={sy - 9} width="6" height="9" rx="1" fill="#7c8a99" opacity="0.6" stroke="#2c3138" strokeWidth="0.5" />);
    }
  }
  // workbench
  parts.push(
    <g key="bench">
      <rect x="0" y="52" width={VW} height="7" fill="#7a5530" stroke="#3b2814" strokeWidth="0.8" />
      <rect x="0" y="59" width={VW} height={VH - 59} fill="#2a1f16" />
      <rect x="12" y="59" width="6" height="25" fill="#5a3d22" />
      <rect x="142" y="59" width="6" height="25" fill="#5a3d22" />
    </g>,
  );
  // cutting wheel with sparks
  const wx = r.range(28, 62);
  const wr = r.range(12, 16);
  const spokes = r.int(5, 8);
  parts.push(
    <g key="wheel" transform={`translate(${wx} ${52 - wr - 2})`}>
      <circle r={wr} fill="#8b9098" stroke="#3b3f45" strokeWidth="1.5" />
      <circle r={wr - 3} fill="none" stroke="#c9ccd2" strokeWidth="0.8" opacity="0.7" />
      {Array.from({ length: spokes }, (_, i) => (
        <line key={i} x1="0" y1="0" x2={Math.cos((i / spokes) * Math.PI * 2) * (wr - 3)} y2={Math.sin((i / spokes) * Math.PI * 2) * (wr - 3)} stroke="#4a4e55" strokeWidth="1" />
      ))}
      <circle r="2.4" fill="#3b3f45" />
      <rect x="-2" y={wr - 1} width="4" height="4" fill="#4a4e55" />
      {Array.from({ length: r.int(4, 7) }, (_, i) => {
        const a = r.range(-0.5, 0.3);
        const len = r.range(5, 11);
        return <line key={`sp${i}`} x1={wr * Math.cos(a)} y1={wr * Math.sin(a)} x2={(wr + len) * Math.cos(a)} y2={(wr + len) * Math.sin(a)} stroke={c.glow} strokeWidth="0.8" opacity="0.9" />;
      })}
    </g>,
  );
  // lens on a stand
  const lx = r.range(80, 104);
  parts.push(
    <g key="lens" transform={`translate(${lx} 52)`}>
      <rect x="-1" y="-24" width="2" height="24" fill="#b08d57" />
      <rect x="-6" y="-2" width="12" height="2" fill="#b08d57" />
      <circle cx="0" cy="-28" r="7" fill="#cfe3ff" opacity="0.25" stroke="#d9b46a" strokeWidth="1.6" />
      <path d="M-3.5 -31 Q-1 -34 2 -33" stroke="#fff" strokeWidth="0.9" fill="none" opacity="0.7" />
      <Crystal x={0} y={-6} s={0.9} gem={gem} />
    </g>,
  );
  // gem tray
  const tx = r.range(112, 132);
  const cols = r.int(3, 4);
  parts.push(
    <g key="tray" transform={`translate(${tx} 44)`}>
      <rect x="-2" y="-2" width={cols * 7 + 4} height="11" fill="#5c1a2a" stroke="#b08d57" strokeWidth="1" />
      {Array.from({ length: cols * 2 }, (_, i) => (
        <Crystal key={i} x={(i % cols) * 7 + 3.5} y={Math.floor(i / cols) * 5 + 2.6} s={0.42} gem={gem} glow={false} />
      ))}
    </g>,
  );
  parts.push(<Lantern key="lamp" x={r.range(130, 150)} y={14} s={0.85} />);
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
      <rect y="62" width={VW} height="22" fill="#2f2622" />
    </g>,
  );
  // checker floor in perspective
  for (let i = 0; i < 10; i++)
    parts.push(<line key={`fl${i}`} x1={80 + (i - 4.5) * 8} y1="62" x2={80 + (i - 4.5) * 34} y2={VH} stroke="#4a3b32" strokeWidth="0.7" />);
  // colonnade with arches
  const cols = r.int(4, 5);
  const span = VW / cols;
  for (let i = 0; i <= cols; i++) {
    const x = i * span;
    parts.push(
      <g key={`col${i}`}>
        <rect x={x - 4} y="12" width="8" height="50" fill="#4a3f45" stroke="#1a1418" strokeWidth="0.6" />
        <rect x={x - 6} y="10" width="12" height="3" fill="#b08d57" />
        <rect x={x - 6} y="60" width="12" height="3" fill="#b08d57" />
      </g>,
    );
    if (i < cols)
      parts.push(<path key={`arch${i}`} d={`M${x + 4} 22 Q${x + span / 2} 2 ${x + span - 4} 22`} stroke="#b08d57" strokeWidth="1.2" fill="none" opacity="0.8" />);
  }
  // banners hanging between columns
  const bannerSlots = new Set<number>();
  while (bannerSlots.size < Math.min(cols, r.int(1, 2))) bannerSlots.add(r.int(0, cols - 1));
  for (const i of bannerSlots) {
    const bx = i * span + span / 2;
    parts.push(
      <g key={`ban${i}`} transform={`translate(${bx} 14)`}>
        <line x1="-9" y1="0" x2="9" y2="0" stroke="#b08d57" strokeWidth="1.4" />
        <path d="M-7 0 L7 0 L7 26 L0 21 L-7 26 Z" fill={c.fill} stroke={c.dark} strokeWidth="0.6" />
        <path d="M-7 0 L7 0 L7 26 L0 21 L-7 26 Z" fill="url(#art-velvet)" />
        <Crystal x={0} y={10} s={0.75} gem={gem} glow={false} />
      </g>,
    );
  }
  // centrepiece: vault door or display case
  if (r.chance(0.5)) {
    const vx = r.range(50, 110);
    parts.push(
      <g key="vault" transform={`translate(${vx} 46)`}>
        <circle r="15" fill="#5b5f67" stroke="#b08d57" strokeWidth="2" />
        <circle r="10" fill="#3e4148" stroke="#8b8f97" strokeWidth="1" />
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={i} cx={Math.cos((i / 8) * Math.PI * 2) * 12.5} cy={Math.sin((i / 8) * Math.PI * 2) * 12.5} r="1" fill="#d9b46a" />
        ))}
        <g stroke="#d9b46a" strokeWidth="1.4">
          <line x1="-6" y1="0" x2="6" y2="0" />
          <line x1="0" y1="-6" x2="0" y2="6" />
        </g>
        <Crystal x={0} y={0} s={0.7} gem={gem} />
      </g>,
    );
  } else {
    const dx = r.range(54, 106);
    parts.push(
      <g key="case" transform={`translate(${dx} 62)`}>
        <rect x="-14" y="-6" width="28" height="6" fill="#5a3d22" stroke="#b08d57" strokeWidth="0.8" />
        <rect x="-11" y="-26" width="22" height="20" fill="#bcd3ee" opacity="0.16" stroke="#d9b46a" strokeWidth="1" />
        <polygon points="-12,-26 0,-32 12,-26" fill="#b08d57" />
        <Crystal x={-4} y={-12} s={0.9} gem={gem} />
        <Crystal x={5} y={-14} s={1.1} gem={gem} />
        <line x1="-9" y1="-24" x2="-4" y2="-19" stroke="#fff" strokeWidth="0.6" opacity="0.5" />
      </g>,
    );
  }
  // chandelier light
  parts.push(<ellipse key="glow" cx="80" cy="6" rx="60" ry="16" fill="#ffcf73" opacity="0.12" filter="url(#art-blur)" />);
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
