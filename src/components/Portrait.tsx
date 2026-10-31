import { memo, type ReactNode } from 'react';
import type { PortraitKind } from '../engine';

const INK = '#170f0c';
const BRASS = '#d4ad5a';

/** Head-and-shoulders silhouette; accessories are drawn per kind. */
function Bust({ children, head = true }: { children?: ReactNode; head?: boolean }) {
  return (
    <g fill={INK}>
      <path d="M4 80 Q6 58 21 54 L25 50 L35 50 L39 54 Q54 58 56 80 Z" />
      <rect x="25.5" y="42" width="9" height="11" />
      {head && <ellipse cx="30" cy="34" rx="9.6" ry="11.6" />}
      {children}
    </g>
  );
}

const PORTRAITS: Record<PortraitKind, () => ReactNode> = {
  merchant: () => (
    <Bust>
      {/* turban with a feather, earrings, bead necklace */}
      <ellipse cx="30" cy="24" rx="12.5" ry="7" />
      <path d="M36 20 Q44 6 40 2 Q38 10 33 18Z" />
      <circle cx="30" cy="21" r="2" fill={BRASS} />
      <circle cx="20.6" cy="38" r="1.3" fill={BRASS} />
      <circle cx="39.4" cy="38" r="1.3" fill={BRASS} />
      {[-8, -4, 0, 4, 8].map((dx) => (
        <circle key={dx} cx={30 + dx} cy={57 + Math.abs(dx) * -0.25 + 2} r="1.2" fill={BRASS} />
      ))}
    </Bust>
  ),
  guildmaster: () => (
    <Bust>
      {/* tall hat and chain of office */}
      <rect x="21" y="7" width="18" height="16" rx="1.5" />
      <rect x="16" y="21" width="28" height="3.5" rx="1.5" />
      <rect x="21" y="18" width="18" height="2" fill={BRASS} />
      <path d="M19 55 Q30 68 41 55" stroke={BRASS} strokeWidth="1.6" fill="none" strokeDasharray="2 1.2" />
      <circle cx="30" cy="64" r="3.2" fill={BRASS} />
      <circle cx="30" cy="64" r="1.4" fill={INK} />
    </Bust>
  ),
  duchess: () => (
    <Bust>
      {/* stand-up lace collar, tiara, swept hair */}
      <path d="M17 52 Q12 40 16 36 Q22 46 30 48 Q38 46 44 36 Q48 40 43 52Z" opacity="0.9" />
      <path d="M20.5 30 Q30 16 39.5 30 Q37 22 30 21 Q23 22 20.5 30Z" />
      <path d="M22 23 L24 17 L26.5 21 L30 14 L33.5 21 L36 17 L38 23Z" fill={BRASS} />
      <circle cx="30" cy="17.5" r="1.2" fill="#bcd8ff" />
    </Bust>
  ),
  knight: () => (
    <Bust head={false}>
      {/* rounded helm with visor slit and plume */}
      <path d="M19 44 Q18 22 30 20 Q42 22 41 44 Q36 47 30 47 Q24 47 19 44Z" />
      <rect x="21" y="32" width="18" height="2.2" fill={BRASS} />
      <path d="M30 20 Q33 8 44 6 Q38 12 37 22Z" />
      <path d="M30 20 L30 46" stroke={BRASS} strokeWidth="0.8" />
      <path d="M8 62 Q30 70 52 62" stroke={BRASS} strokeWidth="1.4" fill="none" />
    </Bust>
  ),
  scholar: () => (
    <Bust>
      {/* hair bun, spectacles, scroll under arm */}
      <circle cx="30" cy="20" r="5.5" />
      <path d="M20.5 32 Q21 22 30 22 Q39 22 39.5 32 Q36 26 30 26 Q24 26 20.5 32Z" />
      <circle cx="26" cy="35" r="2.8" fill="none" stroke={BRASS} strokeWidth="1" />
      <circle cx="34" cy="35" r="2.8" fill="none" stroke={BRASS} strokeWidth="1" />
      <line x1="28.8" y1="35" x2="31.2" y2="35" stroke={BRASS} strokeWidth="0.8" />
      <rect x="40" y="58" width="14" height="5" rx="2.5" transform="rotate(-20 47 60)" fill="#e9dcc0" />
    </Bust>
  ),
  alchemist: () => (
    <Bust head={false}>
      {/* pointed hood, glowing flask */}
      <path d="M17 50 Q16 30 26 16 L30 6 L34 16 Q44 30 43 50 Q37 46 30 46 Q23 46 17 50Z" />
      <ellipse cx="30" cy="36" rx="6" ry="7" fill="#2a1d18" />
      <circle cx="27.6" cy="35" r="0.9" fill={BRASS} />
      <circle cx="32.4" cy="35" r="0.9" fill={BRASS} />
      <circle cx="46" cy="66" r="9" fill="#7cffb2" opacity="0.25" />
      <path d="M44 56 L48 56 L48 60 Q53 64 50 70 L42 70 Q39 64 44 60Z" fill="#8ef0c0" opacity="0.85" stroke={BRASS} strokeWidth="0.8" />
    </Bust>
  ),
  forewoman: () => (
    <Bust>
      {/* miner's helmet with lamp beam, braid */}
      <path d="M18 31 Q18 17 30 17 Q42 17 42 31 L45 32 L15 32Z" />
      <rect x="27" y="20" width="6" height="5" rx="1" fill={BRASS} />
      <path d="M33 22 L60 12 L60 32 Z" fill="#ffd27a" opacity="0.18" />
      <circle cx="30" cy="22.5" r="1.6" fill="#fff3c4" />
      <path d="M38 40 Q44 48 40 58" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </Bust>
  ),
  captain: () => (
    <Bust>
      {/* tricorn hat, epaulettes */}
      <path d="M12 26 Q30 12 48 26 Q42 22 30 23 Q18 22 12 26Z" />
      <path d="M17 26 Q30 8 43 26Z" />
      <path d="M17 26 Q30 21 43 26" stroke={BRASS} strokeWidth="1" fill="none" />
      <rect x="9" y="58" width="11" height="3" rx="1.5" fill={BRASS} />
      <rect x="40" y="58" width="11" height="3" rx="1.5" fill={BRASS} />
    </Bust>
  ),
  countess: () => (
    <Bust>
      {/* tall updo with comb, open fan */}
      <ellipse cx="30" cy="18" rx="9" ry="10" />
      <path d="M22 12 Q30 4 38 12" stroke={BRASS} strokeWidth="1.4" fill="none" />
      <circle cx="21.2" cy="39" r="1.1" fill={BRASS} />
      <path d="M38 70 L52 54 A16 16 0 0 1 56 68 Z" fill="#3b0f1d" stroke={BRASS} strokeWidth="0.8" />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="38" y1="70" x2={52 + i * 1.3} y2={54 + i * 4.6} stroke={BRASS} strokeWidth="0.5" />
      ))}
    </Bust>
  ),
  provost: () => (
    <Bust>
      {/* flat cap and pleated ruff */}
      <ellipse cx="30" cy="24" rx="13" ry="4.5" />
      <path d="M20 24 Q30 12 40 24Z" />
      <circle cx="37" cy="21" r="1.4" fill={BRASS} />
      <path
        d="M16 50 Q19 46 22 50 Q25 46 28 50 Q30 46.5 32 50 Q35 46 38 50 Q41 46 44 50 Q41 56 30 56 Q19 56 16 50Z"
        fill="#e9dcc0"
        stroke="#9d8b6a"
        strokeWidth="0.5"
      />
    </Bust>
  ),
};

/** Stylised silhouette in an oval brass frame, lit by lantern glow. */
export const Portrait = memo(function Portrait({ kind, size = 64, id }: { kind: PortraitKind; size?: number; id: string }) {
  const gid = `pg-${id}`;
  return (
    <svg className="portrait" width={size} height={size * (80 / 60)} viewBox="0 0 60 80" aria-hidden focusable="false">
      <defs>
        <radialGradient id={gid} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#f3c97a" />
          <stop offset="0.55" stopColor="#a8642a" />
          <stop offset="1" stopColor="#3a1a0e" />
        </radialGradient>
        <clipPath id={`${gid}-clip`}>
          <ellipse cx="30" cy="40" rx="26" ry="36" />
        </clipPath>
      </defs>
      <ellipse cx="30" cy="40" rx="26" ry="36" fill={`url(#${gid})`} />
      <g clipPath={`url(#${gid}-clip)`}>{PORTRAITS[kind]()}</g>
      <ellipse cx="30" cy="40" rx="27.5" ry="37.5" fill="none" stroke="#6b4a1e" strokeWidth="3.5" />
      <ellipse cx="30" cy="40" rx="27.5" ry="37.5" fill="none" stroke={BRASS} strokeWidth="1.8" />
      <ellipse cx="30" cy="40" rx="25.6" ry="35.6" fill="none" stroke="#fff3c4" strokeWidth="0.5" opacity="0.6" />
      <circle cx="30" cy="2.6" r="2" fill={BRASS} stroke="#6b4a1e" strokeWidth="0.6" />
    </svg>
  );
});
