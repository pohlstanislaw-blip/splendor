// Textures for the 3D table, drawn in code from the same SVG art as the 2D view.
// An SVG is rendered to markup, loaded as an image and painted onto a canvas texture; textures are
// cached, and appear as soon as the image has decoded.
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { ArtDefsContent, CardScene } from '../components/CardArt';
import { GEM_COLORS, GemDefsContent, GemShape } from '../components/Gem';
import { Portrait } from '../components/Portrait';
import { GEMS, type Card, type Gem, type Patron, type Tier, type Token } from '../engine';

const cache = new Map<string, THREE.CanvasTexture>();

/** Strongest texture filtering the graphics card offers: keeps angled cards sharp. */
let maxAnisotropy = 8;
export function setMaxAnisotropy(n: number) {
  maxAnisotropy = Math.max(1, n);
  for (const tex of cache.values()) {
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
  }
}

/** The scene draws on demand, so it must hear when a picture finishes decoding. */
const loadedListeners = new Set<() => void>();
export function onTextureLoaded(fn: () => void) {
  loadedListeners.add(fn);
  return () => {
    loadedListeners.delete(fn);
  };
}
const SERIF = "Georgia, 'Times New Roman', serif"; // web fonts are not available inside SVG images

function svgTexture(key: string, w: number, h: number, placeholder: string, build: () => ReactElement): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = placeholder;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  cache.set(key, tex);
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    tex.needsUpdate = true;
    for (const fn of loadedListeners) fn();
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderToStaticMarkup(build()))}`;
  return tex;
}

function Defs() {
  return (
    <defs>
      <ArtDefsContent />
      <GemDefsContent />
    </defs>
  );
}

/** A gem drawn at (x, y) with the given size, inside a larger SVG. */
function GemAt({ gem, x, y, size }: { gem: Token; x: number; y: number; size: number }) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" overflow="visible">
      <GemShape gem={gem} />
    </svg>
  );
}

function CostDisc({ gem, n, cx, cy, r }: { gem: Gem; n: number; cx: number; cy: number; r: number }) {
  const light = gem === 'moonstone';
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 1.8} fill="#fffaf0" stroke="#000" strokeOpacity="0.45" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r={r} fill={`url(#gem-rad-${gem})`} />
      <g opacity="0.3">
        <GemAt gem={gem} x={cx - r * 0.8} y={cy - r * 0.8} size={r * 1.6} />
      </g>
      <text
        x={cx}
        y={cy + r * 0.42}
        textAnchor="middle"
        fontFamily={SERIF}
        fontStyle="italic"
        fontWeight="700"
        fontSize={r * 1.6}
        fill={light ? '#1b2130' : '#fff'}
        stroke={light ? '#fff' : '#000'}
        strokeWidth="1.1"
        paintOrder="stroke"
      >
        {n}
      </text>
    </g>
  );
}

/** The card face: full-bleed scene, translucent band with points and bonus gem, cost discs bottom-left. */
export function cardFaceTexture(card: Card): THREE.CanvasTexture {
  return svgTexture(`face:${card.id}`, 640, 896, '#1a1512', () => {
    const costs = GEMS.filter((g) => card.cost[g]);
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="896" viewBox="0 0 120 168">
        <Defs />
        <clipPath id="card-clip">
          <rect width="120" height="168" rx="7" />
        </clipPath>
        <g clipPath="url(#card-clip)">
          <rect width="120" height="168" fill="#120e0b" />
          <CardScene card={card} />
          <rect width="120" height="35" fill="#fff" opacity="0.5" />
          {card.points > 0 && (
            <text x="9" y="29" fontFamily={SERIF} fontStyle="italic" fontWeight="700" fontSize="32" fill="#fff" stroke="#000" strokeWidth="1.6" paintOrder="stroke">
              {card.points}
            </text>
          )}
          <GemAt gem={card.bonus} x={86} y={4} size={27} />
          {costs.map((g, i) => (
            <CostDisc key={g} gem={g} n={card.cost[g]!} cx={19} cy={150 - i * 28} r={12} />
          ))}
          <text x="111" y="161" textAnchor="end" fontSize="7" fill="#f4ead1" opacity="0.75">
            {'◆'.repeat(card.tier)}
          </text>
        </g>
        <rect x="1" y="1" width="118" height="166" rx="6.5" fill="none" stroke="#f4ead1" strokeWidth="2" />
      </svg>
    );
  });
}

const BACK: Record<Tier, { a: string; b: string; ink: string }> = {
  1: { a: '#7a5532', b: '#5b3d22', ink: '#f3d9a6' },
  2: { a: '#6b7079', b: '#474b52', ink: '#e5e7ea' },
  3: { a: '#d9a83e', b: '#8a6414', ink: '#4a3208' },
};

export function cardBackTexture(tier: Tier): THREE.CanvasTexture {
  return svgTexture(`back:${tier}`, 240, 336, BACK[tier].b, () => {
    const c = BACK[tier];
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="240" height="336" viewBox="0 0 120 168">
        <defs>
          <linearGradient id="bk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c.a} />
            <stop offset="0.5" stopColor={c.b} />
            <stop offset="1" stopColor={c.a} />
          </linearGradient>
        </defs>
        <rect width="120" height="168" rx="7" fill="url(#bk)" />
        <rect x="5" y="5" width="110" height="158" rx="5" fill="none" stroke={c.ink} strokeWidth="1.4" opacity="0.7" />
        <circle cx="60" cy="84" r="30" fill="#0003" stroke={c.ink} strokeWidth="2" />
        <polygon points="60,60 80,80 60,110 40,80" fill="none" stroke={c.ink} strokeWidth="2.2" />
        <path d="M40 80 L80 80 M60 60 L52 80 L60 110 L68 80 Z" fill="none" stroke={c.ink} strokeWidth="1.4" />
        {Array.from({ length: tier }, (_, i) => (
          <polygon key={i} points="0,-5 4,0 0,5 -4,0" transform={`translate(${60 + (i - (tier - 1) / 2) * 13} 138)`} fill={c.ink} />
        ))}
      </svg>
    );
  });
}

/** A patron tile: portrait, 3 points, name, and what they require. */
export function patronTexture(patron: Patron): THREE.CanvasTexture {
  return svgTexture(`patron:${patron.id}`, 400, 500, '#3b111c', () => {
    const req = GEMS.filter((g) => patron.requires[g]);
    const words = patron.name.split(' ');
    const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
    const line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 120 150">
        <defs>
          <GemDefsContent />
          <linearGradient id="velvet" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6a2033" />
            <stop offset="1" stopColor="#35101a" />
          </linearGradient>
        </defs>
        <rect width="120" height="150" rx="7" fill="url(#velvet)" />
        <rect x="3" y="3" width="114" height="144" rx="5" fill="none" stroke="#c9a052" strokeWidth="1.6" />
        <svg x="8" y="8" width="48" height="64" viewBox="0 0 60 80">
          <Portrait kind={patron.portrait} id={`tx-${patron.id}`} size={60} />
        </svg>
        <text x="108" y="42" textAnchor="end" fontFamily={SERIF} fontWeight="700" fontSize="38" fill="#f0d28a" stroke="#2a1a05" strokeWidth="1" paintOrder="stroke">
          {patron.points}
        </text>
        <text x="60" y="88" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="11.5" fill="#f1e6cf">
          {line1}
        </text>
        <text x="60" y="101" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="11.5" fill="#f1e6cf">
          {line2}
        </text>
        {req.map((g, i) => (
          <CostDisc key={g} gem={g} n={patron.requires[g]!} cx={60 + (i - (req.length - 1) / 2) * 30} cy={126} r={11.5} />
        ))}
      </svg>
    );
  });
}

/** Top face of a token chip. */
export function chipTexture(token: Token): THREE.CanvasTexture {
  return svgTexture(`chip:${token}`, 128, 128, '#2a221c', () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64">
      <defs>
        <GemDefsContent />
        <radialGradient id="face" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#3a302a" />
          <stop offset="1" stopColor="#15100d" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" fill={GEM_COLORS[token].dark} />
      <circle cx="32" cy="32" r="31" fill="#c9a052" />
      <circle cx="32" cy="32" r="26.5" fill="url(#face)" stroke="#7a5a24" strokeWidth="1.2" />
      <GemAt gem={token} x={14} y={14} size={36} />
    </svg>
  ));
}

let wood: THREE.CanvasTexture | null = null;
/** Procedural wood grain for the table top (seeded, so it looks the same every time). */
export function woodTexture(): THREE.CanvasTexture {
  if (wood) return wood;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext('2d')!;
  g.fillStyle = '#4a2f1c';
  g.fillRect(0, 0, 1024, 1024);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // planks
  for (let p = 0; p < 6; p++) {
    const y0 = (p * 1024) / 6;
    g.fillStyle = `rgba(${p % 2 ? 20 : 60}, ${p % 2 ? 10 : 35}, ${p % 2 ? 0 : 15}, 0.25)`;
    g.fillRect(0, y0, 1024, 1024 / 6);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, y0, 1024, 3);
  }
  // grain
  for (let i = 0; i < 900; i++) {
    const y = rnd() * 1024;
    const x = rnd() * 1024;
    const len = 80 + rnd() * 380;
    g.strokeStyle = `rgba(${rnd() > 0.5 ? '255,210,150' : '0,0,0'}, ${0.03 + rnd() * 0.07})`;
    g.lineWidth = 0.6 + rnd() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + len * 0.3, y + (rnd() - 0.5) * 8, x + len * 0.7, y + (rnd() - 0.5) * 8, x + len, y + (rnd() - 0.5) * 5);
    g.stroke();
  }
  // knots and wear
  for (let i = 0; i < 9; i++) {
    const x = rnd() * 1024;
    const y = rnd() * 1024;
    const r = 8 + rnd() * 18;
    const grad = g.createRadialGradient(x, y, 1, x, y, r);
    grad.addColorStop(0, 'rgba(20,10,5,0.55)');
    grad.addColorStop(1, 'rgba(20,10,5,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, r * 1.8, r, 0, 0, Math.PI * 2);
    g.fill();
  }
  wood = new THREE.CanvasTexture(c);
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.anisotropy = 8;
  return wood;
}

let glow: THREE.CanvasTexture | null = null;
/** A soft warm pool of light, painted on the table under each candle instead of a real light. */
export function glowTexture(): THREE.CanvasTexture {
  if (glow) return glow;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,190,110,0.85)');
  grad.addColorStop(0.35, 'rgba(255,150,70,0.35)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  glow = new THREE.CanvasTexture(c);
  glow.colorSpace = THREE.SRGBColorSpace;
  return glow;
}
