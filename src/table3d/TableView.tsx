// The first-person 3D table. Loaded lazily (three.js lives only in this chunk).
// It only READS game state and reports clicks; every rule stays in the engine.
import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, memo, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { GEM_COLORS } from '../components/Gem';
import { GEMS, PATRON_BY_ID, TAKE_TWO_MIN_PILE, TOKENS, getCard, paymentFor, type GameState, type Gem, type Tier, type Token } from '../engine';
import { HIDDEN_PREFIX } from '../online/protocol';
import { assignChips, stackIndex, type ChipLocation } from './chips';
import {
  CARD,
  CHIP,
  boughtPose,
  cameraFor,
  chipPose,
  deckPose,
  figurePose,
  marketPose,
  ownedPatronPose,
  patronPose,
  platePos,
  reservedPose,
  seatFrame,
  seatTokenBase,
  supplyStackPos,
  tableSize,
  type Pose,
  type SeatFrame,
} from './layout';
import { MotionContext, Mover, type Motion, type Via } from './Mover';
import { cardBackTexture, cardFaceTexture, chipTexture, patronTexture, woodTexture } from './textures';
import type { TableSelection } from './types';

export interface TableViewProps {
  state: GameState;
  /** the seat the camera sits in */
  viewer: number;
  canSeeHidden: (seat: number) => boolean;
  /** the viewer may act right now (their turn, action phase) */
  interactive: boolean;
  picked: Gem[];
  onToggleGem: (g: Gem) => void;
  selected: TableSelection | null;
  onSelect: (s: TableSelection | null) => void;
  /** HTML name plate for an opponent's seat */
  renderPlate: (seat: number) => ReactNode;
  seatColors: string[];
  reducedMotion: boolean;
  soundOn: boolean;
  /** called once, with the measured frame rate, if the scene runs too slowly to be pleasant */
  onSlow?: (fps: number) => void;
  /** called if WebGL fails */
  onError?: () => void;
}

// ---------------------------------------------------------------------------
// sound: a soft synthesized clack (no audio files)

let audio: AudioContext | null = null;
function clack(volume = 0.25) {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const len = Math.floor(audio.sampleRate * 0.05);
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = audio.createBufferSource();
    src.buffer = buf;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1900 + Math.random() * 500;
    filter.Q.value = 1.4;
    const gain = audio.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start();
  } catch {
    /* no audio available */
  }
}

// ---------------------------------------------------------------------------
// shared geometries

const cardGeo = new THREE.BoxGeometry(CARD.w, CARD.h, CARD.t);
const patronGeo = new THREE.BoxGeometry(1, 1.25, 0.04);
const chipGeo = new THREE.CylinderGeometry(CHIP.r, CHIP.r, CHIP.h, 28);
const edgeMat = new THREE.MeshStandardMaterial({ color: '#e9dcc0', roughness: 0.8 });
const patronEdge = new THREE.MeshStandardMaterial({ color: '#7a5a24', roughness: 0.5, metalness: 0.4 });

function faceMaterial(map: THREE.Texture, glow = 0.2) {
  // the emissive map keeps faces readable in the dim room
  return new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: glow, roughness: 0.65 });
}
const matCache = new Map<string, THREE.Material>();
function cached(key: string, make: () => THREE.Material) {
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = make()));
  return m;
}

function setCursor(on: boolean) {
  document.body.style.cursor = on ? 'pointer' : '';
}

// ---------------------------------------------------------------------------
// cards

interface CardItem {
  key: string;
  /** null when the viewer may not know which card it is */
  cardId: string | null;
  tier: Tier;
  pose: Pose;
  zone: string;
  from?: Pose;
  via?: Via;
  select?: TableSelection;
  /** the viewer can afford it right now */
  affordable?: boolean;
}

const CardMesh = memo(function CardMesh({
  item,
  lifted,
  onSelect,
  onLand,
}: {
  item: CardItem;
  lifted: boolean;
  onSelect: (s: TableSelection) => void;
  onLand: () => void;
}) {
  const [hover, setHover] = useState(false);
  const materials = useMemo(() => {
    const back = cached(`back-${item.tier}`, () => faceMaterial(cardBackTexture(item.tier), 0.18));
    const front = item.cardId ? cached(`face-${item.cardId}`, () => faceMaterial(cardFaceTexture(getCard(item.cardId!)))) : back;
    return [edgeMat, edgeMat, edgeMat, edgeMat, front, back];
  }, [item.cardId, item.tier]);
  const up = (hover && item.select ? 0.14 : 0) + (lifted ? 0.3 : 0);
  const pose = useMemo<Pose>(
    () => (up ? { ...item.pose, pos: [item.pose.pos[0], item.pose.pos[1] + up, item.pose.pos[2]], rot: [item.pose.rot[0] + (lifted ? 0.18 : 0.08), item.pose.rot[1], item.pose.rot[2]] } : item.pose),
    [item.pose, up, lifted],
  );
  useEffect(() => () => setCursor(false), []);
  return (
    <Mover pose={pose} zone={item.zone} from={item.from} via={item.via} flash onArrive={onLand}>
      <mesh
        geometry={cardGeo}
        material={materials}
        castShadow
        onPointerOver={(e) => {
          if (!item.select) return;
          e.stopPropagation();
          setHover(true);
          setCursor(true);
        }}
        onPointerOut={() => {
          setHover(false);
          setCursor(false);
        }}
        onClick={(e) => {
          if (!item.select) return;
          e.stopPropagation();
          onSelect(item.select);
        }}
      />
      {item.affordable && (
        <mesh position={[0, 0, -0.004]} renderOrder={1}>
          <planeGeometry args={[CARD.w + 0.14, CARD.h + 0.14]} />
          <meshBasicMaterial color="#8fd18b" transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </Mover>
  );
});

function DeckPile({ tier, count, selected, onSelect }: { tier: Tier; count: number; selected: boolean; onSelect: (s: TableSelection) => void }) {
  const [hover, setHover] = useState(false);
  const top = deckPose(tier, count);
  const h = Math.max(0.012, top.pos[1] - 0.012);
  const materials = useMemo(() => {
    const side = cached('deck-side', () => new THREE.MeshStandardMaterial({ color: '#cbbd9c', roughness: 0.9 }));
    const back = cached(`back-${tier}`, () => faceMaterial(cardBackTexture(tier), 0.18));
    return [side, side, back, side, side, side];
  }, [tier]);
  if (count === 0) return null;
  return (
    <mesh
      position={[top.pos[0], h / 2 + 0.006 + (hover || selected ? 0.05 : 0), top.pos[2]]}
      material={materials}
      castShadow
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        setCursor(true);
      }}
      onPointerOut={() => {
        setHover(false);
        setCursor(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({ kind: 'deck', tier });
      }}
    >
      <boxGeometry args={[CARD.w, h, CARD.h]} />
      <Html position={[-0.2, h / 2 + 0.05, 0.9]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="supply3d" title="Cards left in this deck">
          <b>{count}</b>
          <small>left</small>
        </div>
      </Html>
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// chips

const Chip = memo(function Chip({ token, pose, zone, delay, sound }: { token: Token; pose: Pose; zone: string; delay: number; sound: boolean }) {
  const materials = useMemo(() => {
    const c = GEM_COLORS[token];
    const side = cached(`chip-side-${token}`, () => new THREE.MeshStandardMaterial({ color: c.fill, roughness: 0.45, metalness: 0.15, emissive: c.fill, emissiveIntensity: 0.12 }));
    const top = cached(`chip-top-${token}`, () => faceMaterial(chipTexture(token), 0.3));
    const bottom = cached('chip-bottom', () => new THREE.MeshStandardMaterial({ color: '#1a1410' }));
    return [side, top, bottom];
  }, [token]);
  return (
    <Mover pose={pose} zone={zone} delay={delay} onArrive={sound ? () => clack() : undefined}>
      <mesh geometry={chipGeo} material={materials} castShadow />
    </Mover>
  );
});

function Chips({ state, frames, picked, sound }: { state: GameState; frames: SeatFrame[]; picked: Gem[]; sound: boolean }) {
  const where = useRef<Partial<Record<Token, ChipLocation[]>>>({});
  const chips = useMemo(() => {
    const out: { key: string; token: Token; pose: Pose; zone: string; delay: number }[] = [];
    for (const token of TOKENS) {
      const counts: Record<ChipLocation, number> = { supply: state.supply[token] };
      state.players.forEach((p, i) => (counts[String(i)] = p.tokens[token]));
      const prev = where.current[token];
      const next = assignChips(prev, counts);
      where.current[token] = next;
      const sel = picked.filter((g) => g === token).length;
      let moved = 0;
      next.forEach((loc, i) => {
        const rank = stackIndex(next, i);
        const changed = !!prev && prev[i] !== loc;
        let pose: Pose;
        if (loc === 'supply') {
          const lifted = rank >= counts.supply - sel;
          pose = chipPose(supplyStackPos(token), rank, lifted ? 0.32 : 0);
        } else {
          const f = frames[Number(loc)];
          pose = chipPose(seatTokenBase(f, token), rank, 0, f.slot === 'self' ? 0.85 : 0.6);
        }
        out.push({ key: `${token}-${i}`, token, pose, zone: loc, delay: changed ? moved++ * 0.08 : 0 });
      });
    }
    return out;
  }, [state.supply, state.players, frames, picked]);
  return (
    <>
      {chips.map((c) => (
        <Chip key={c.key} token={c.token} pose={c.pose} zone={c.zone} delay={c.delay} sound={sound} />
      ))}
    </>
  );
}

function SupplyStacks({ state, interactive, picked, onToggleGem }: { state: GameState; interactive: boolean; picked: Gem[]; onToggleGem: (g: Gem) => void }) {
  return (
    <>
      {TOKENS.map((token) => {
        const count = state.supply[token];
        const pos = supplyStackPos(token);
        const isGem = token !== 'gold';
        const can = interactive && isGem && count > 0;
        const sel = picked.filter((g) => g === token).length;
        return (
          <group key={token} position={pos}>
            <mesh
              position={[0, 0.3, 0]}
              visible={false}
              onPointerOver={(e) => {
                if (!can) return;
                e.stopPropagation();
                setCursor(true);
              }}
              onPointerOut={() => setCursor(false)}
              onClick={(e) => {
                if (!can) return;
                e.stopPropagation();
                onToggleGem(token as Gem);
              }}
            >
              <cylinderGeometry args={[CHIP.r + 0.08, CHIP.r + 0.08, 0.9, 12]} />
            </mesh>
            <Html position={[0.62, 0.12, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <div className={`supply3d${sel ? ' sel' : ''}${count === 0 ? ' empty' : ''}`}>
                <b>{count}</b>
                {sel > 0 && <i>+{sel}</i>}
                {isGem && count >= TAKE_TWO_MIN_PILE && sel === 0 && <small>×2</small>}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// patrons

const PatronTile3D = memo(function PatronTile3D({ id, pose, zone, via, onSelect }: { id: string; pose: Pose; zone: string; via: Via; onSelect: (s: TableSelection) => void }) {
  const materials = useMemo(() => {
    const front = cached(`patron-${id}`, () => faceMaterial(patronTexture(PATRON_BY_ID[id]), 0.3));
    return [patronEdge, patronEdge, patronEdge, patronEdge, front, patronEdge];
  }, [id]);
  return (
    <Mover pose={pose} zone={zone} via={via} flash>
      <mesh
        geometry={patronGeo}
        material={materials}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          setCursor(true);
        }}
        onPointerOut={() => setCursor(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect({ kind: 'patron', patronId: id });
        }}
      />
    </Mover>
  );
});

// ---------------------------------------------------------------------------
// room, lights, figures

function Flame({ position, intensity = 9 }: { position: [number, number, number]; intensity?: number }) {
  const light = useRef<THREE.PointLight>(null);
  const flame = useRef<THREE.Mesh>(null);
  const phase = useMemo(() => position[0] * 3.1 + position[2], [position]);
  const { reduced } = useMotion();
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime + phase;
    const f = 1 + Math.sin(t * 11) * 0.06 + Math.sin(t * 23.7) * 0.04 + Math.sin(t * 3.1) * 0.05;
    if (light.current) light.current.intensity = intensity * f;
    if (flame.current) flame.current.scale.set(1, 0.9 + f * 0.25, 1);
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.13, 0.6, 10]} />
        <meshStandardMaterial color="#e8dcc0" roughness={0.9} emissive="#553311" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.05, 12]} />
        <meshStandardMaterial color="#8a6a2e" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh ref={flame} position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#ffd27a" />
      </mesh>
      <pointLight ref={light} position={[0, 0.85, 0]} color="#ffb060" intensity={intensity} distance={14} decay={1.6} />
    </group>
  );
}

function Room({ playerCount }: { playerCount: number }) {
  const t = tableSize(playerCount);
  const wood = useMemo(() => {
    const tex = woodTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set(t.halfWidth / 4.5, 1.3);
    return tex;
  }, [t.halfWidth]);
  const depth = t.zNear - t.zFar;
  const zMid = (t.zNear + t.zFar) / 2;
  return (
    <group>
      <mesh position={[0, -0.2, zMid]} receiveShadow>
        <boxGeometry args={[t.halfWidth * 2, 0.4, depth]} />
        <meshStandardMaterial map={wood} roughness={0.78} />
      </mesh>
      {/* table rim and legs */}
      <mesh position={[0, -0.55, zMid]}>
        <boxGeometry args={[t.halfWidth * 2 - 0.5, 0.35, depth - 0.5]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.9} />
      </mesh>
      <mesh position={[0, -4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0d0a08" roughness={1} />
      </mesh>
      <mesh position={[0, 4, -17]}>
        <planeGeometry args={[80, 24]} />
        <meshStandardMaterial color="#17110d" roughness={1} />
      </mesh>
      <Flame position={[-t.halfWidth + 1.0, 0, t.zFar + 1.0]} />
      <Flame position={[t.halfWidth - 1.0, 0, t.zFar + 1.0]} />
      {/* unseen candle behind the viewer, so the near edge is lit too */}
      <pointLight position={[0, 2.2, t.zNear + 1.5]} color="#ffb060" intensity={14} distance={12} decay={1.6} />
    </group>
  );
}

function Lights() {
  const lamp = useRef<THREE.SpotLight>(null);
  const { reduced } = useMotion();
  useFrame(({ clock }) => {
    if (reduced || !lamp.current) return;
    const t = clock.elapsedTime;
    lamp.current.intensity = 260 * (1 + Math.sin(t * 7.3) * 0.025 + Math.sin(t * 17.1) * 0.02);
  });
  return (
    <>
      <ambientLight intensity={0.5} color="#ffd9b0" />
      <hemisphereLight args={['#5a4a3a', '#0a0705', 0.6]} />
      <spotLight
        ref={lamp}
        position={[0, 11, 3]}
        angle={0.95}
        penumbra={0.85}
        intensity={260}
        decay={1.5}
        color="#ffc98a"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0006}
      />
    </>
  );
}

/** An opponent: a simple hooded low-poly bust lit by the candles, with a scarf in their seat colour. */
function Figure({ frame, color, active, variant }: { frame: SeatFrame; color: string; active: boolean; variant: number }) {
  const f = figurePose(frame);
  const glow = useRef<THREE.PointLight>(null);
  const { reduced } = useMotion();
  useFrame(({ clock }) => {
    if (!glow.current) return;
    glow.current.intensity = active ? (reduced ? 16 : 16 + Math.sin(clock.elapsedTime * 3) * 5) : 0;
  });
  const cloth = cached(`cloth-${variant % 3}`, () => new THREE.MeshStandardMaterial({ color: ['#3a3046', '#3b3a2c', '#46302a'][variant % 3], roughness: 0.95, flatShading: true }));
  return (
    <group position={[f.pos[0], -1.35, f.pos[2]]} rotation={[0, f.rotY, 0]} scale={1.3}>
      <mesh position={[0, 1.0, 0]} material={cloth} castShadow>
        <cylinderGeometry args={[0.5, 0.95, 1.9, 7]} />
      </mesh>
      <mesh position={[0, 2.0, 0]} scale={[1.25, 0.5, 0.8]} material={cloth}>
        <sphereGeometry args={[0.62, 7, 5]} />
      </mesh>
      <mesh position={[0, 2.62, 0]} castShadow>
        <sphereGeometry args={[0.36, 8, 6]} />
        <meshStandardMaterial color="#5a4436" roughness={0.9} flatShading />
      </mesh>
      {variant % 2 === 0 ? (
        <mesh position={[0, 2.78, -0.08]} material={cloth}>
          <coneGeometry args={[0.5, 0.75, 7]} />
        </mesh>
      ) : (
        <mesh position={[0, 2.95, 0]} material={cloth}>
          <cylinderGeometry args={[0.27, 0.34, 0.3, 7]} />
        </mesh>
      )}
      <mesh position={[0, 2.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.36, 0.09, 6, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.9 : 0.25} roughness={0.6} />
      </mesh>
      <pointLight ref={glow} position={[0, 2.4, 1.2]} color={color} intensity={0} distance={7} decay={1.6} />
      {/* a low warm light so the figure reads against the dark room */}
      <pointLight position={[0, 1.6, 1.6]} color="#ffb878" intensity={7} distance={5} decay={1.4} />
    </group>
  );
}

function useMotion(): Motion {
  return useContext(MotionContext);
}

function CameraRig({ playerCount, reduced }: { playerCount: number; reduced: boolean }) {
  const { camera, size } = useThree();
  const look = useRef(new THREE.Vector3());
  const base = useMemo(() => cameraFor(playerCount, size.width / size.height), [playerCount, size.width, size.height]);
  useEffect(() => {
    camera.position.set(...base.pos);
    (camera as THREE.PerspectiveCamera).fov = base.fov;
    camera.updateProjectionMatrix();
    look.current.set(...base.target);
    camera.lookAt(look.current);
  }, [camera, base]);
  useFrame(({ pointer }, dt) => {
    // a little head movement: lean toward the pointer, never far enough to lose the table
    const tx = base.target[0] + (reduced ? 0 : pointer.x * 0.9);
    const tz = base.target[2] + (reduced ? 0 : -pointer.y * 0.55);
    const k = 1 - Math.exp(-dt * 4);
    look.current.x += (tx - look.current.x) * k;
    look.current.z += (tz - look.current.z) * k;
    camera.position.x += ((reduced ? 0 : pointer.x * 0.35) - camera.position.x) * k;
    camera.lookAt(look.current);
  });
  return null;
}

/**
 * Reports the table as too slow only after a fair measurement:
 * - waits until 3 s of real rendering have passed (shaders compiled, card pictures decoded);
 * - then measures 5 s of frames;
 * - ignores gaps longer than 0.25 s (a hidden tab, a stall while textures load), so time spent
 *   in another tab never counts as "slow".
 */
export const SLOW_FPS = 15;
function PerfWatch({ onSlow }: { onSlow?: (fps: number) => void }) {
  const acc = useRef({ warm: 0, t: 0, frames: 0, done: false });
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.done || !onSlow) return;
    if (dt > 0.25 || document.hidden) return;
    if (a.warm < 3) {
      a.warm += dt;
      return;
    }
    a.t += dt;
    a.frames++;
    if (a.t >= 5) {
      a.done = true;
      const fps = a.frames / a.t;
      if (fps < SLOW_FPS) onSlow(fps);
    }
  });
  return null;
}

// ---------------------------------------------------------------------------
// the scene

function Scene(props: TableViewProps) {
  const { state, viewer, canSeeHidden, selected, onSelect } = props;
  const n = state.players.length;
  const frames = useMemo(() => state.players.map((_, i) => seatFrame(i, viewer, n)), [n, viewer]);
  const ready = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => (ready.current = true), 300);
    return () => window.clearTimeout(t);
  }, []);
  const motion = useMemo<Motion>(() => ({ ready, reduced: props.reducedMotion, snapKey: String(viewer) }), [props.reducedMotion, viewer]);
  const viaFor = (seat: number): Via => (seat === viewer ? 'showcase' : 'lift');

  const cards = useMemo(() => {
    const out: CardItem[] = [];
    const me = state.players[state.current];
    const canAfford = (id: string) => props.interactive && !!paymentFor(me, getCard(id));
    for (const tier of [1, 2, 3] as Tier[]) {
      const deckTop = deckPose(tier, state.decks[tier - 1].length);
      state.market[tier - 1].forEach((id, slot) => {
        if (id) out.push({ key: id, cardId: id, tier, pose: marketPose(tier, slot), zone: 'market', from: deckTop, select: { kind: 'market', tier, slot, cardId: id }, affordable: canAfford(id) });
      });
    }
    state.players.forEach((p, seat) => {
      const f = frames[seat];
      for (const g of GEMS) {
        const stack = p.cards.filter((id) => getCard(id).bonus === g);
        stack.forEach((id, i) =>
          out.push({ key: id, cardId: id, tier: getCard(id).tier, pose: boughtPose(f, g, i, stack.length), zone: `bought-${seat}`, via: viaFor(seat), select: { kind: 'card', cardId: id } }),
        );
      }
      p.reserved.forEach((r, i) => {
        const placeholder = r.cardId.startsWith(HIDDEN_PREFIX);
        const tier = (placeholder ? Number(r.cardId.slice(HIDDEN_PREFIX.length)) : getCard(r.cardId).tier) as Tier;
        const known = !placeholder && (!r.hidden || canSeeHidden(seat));
        out.push({
          key: placeholder ? `hidden-${seat}-${i}` : r.cardId,
          cardId: known ? r.cardId : null,
          tier,
          pose: reservedPose(f, i, known),
          zone: `reserved-${seat}`,
          from: deckPose(tier, state.decks[tier - 1].length),
          via: viaFor(seat),
          select: known ? (seat === viewer ? { kind: 'reserved', index: i, cardId: r.cardId } : { kind: 'card', cardId: r.cardId }) : undefined,
          affordable: known && seat === viewer && seat === state.current && canAfford(r.cardId),
        });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.market, state.decks, state.players, state.current, frames, viewer, props.interactive]);

  const patrons = useMemo(() => {
    const out: { id: string; pose: Pose; zone: string; via: Via }[] = [];
    state.patrons.forEach((id, i) => out.push({ id, pose: patronPose(i), zone: 'patrons', via: undefined }));
    state.players.forEach((p, seat) => p.patrons.forEach((id, i) => out.push({ id, pose: ownedPatronPose(frames[seat], i), zone: `patron-${seat}`, via: viaFor(seat) })));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.patrons, state.players, frames]);

  const selectedCard = selected && 'cardId' in selected ? selected.cardId : null;
  const land = props.soundOn ? () => clack(0.12) : () => {};

  return (
    <MotionContext.Provider value={motion}>
      <CameraRig playerCount={n} reduced={props.reducedMotion} />
      <PerfWatch onSlow={props.onSlow} />
      <fog attach="fog" args={['#0b0806', 16, 38]} />
      <Lights />
      <Room playerCount={n} />
      {([1, 2, 3] as Tier[]).map((tier) => (
        <DeckPile key={tier} tier={tier} count={state.decks[tier - 1].length} selected={selected?.kind === 'deck' && selected.tier === tier} onSelect={onSelect} />
      ))}
      {cards.map((c) => (
        <CardMesh key={c.key} item={c} lifted={!!c.cardId && c.cardId === selectedCard} onSelect={onSelect} onLand={land} />
      ))}
      {patrons.map((p) => (
        <PatronTile3D key={p.id} id={p.id} pose={p.pose} zone={p.zone} via={p.via} onSelect={onSelect} />
      ))}
      <Chips state={state} frames={frames} picked={props.picked} sound={props.soundOn} />
      <SupplyStacks state={state} interactive={props.interactive} picked={props.picked} onToggleGem={props.onToggleGem} />
      {state.players.map((_, seat) =>
        seat === viewer ? null : (
          <group key={seat}>
            <Figure frame={frames[seat]} color={props.seatColors[seat]} active={state.current === seat && state.phase !== 'gameover'} variant={seat} />
            <Html position={platePos(frames[seat])} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
              {props.renderPlate(seat)}
            </Html>
          </group>
        ),
      )}
    </MotionContext.Provider>
  );
}

class Boundary extends Component<{ onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function TableView(props: TableViewProps) {
  return (
    <Boundary onError={props.onError}>
      <Canvas
        className="table-canvas"
        shadows
        dpr={[1, 2]}
        camera={{ fov: 42, near: 0.1, far: 80, position: [0, 8, 9.4] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.setClearColor('#0b0806');
        }}
        onPointerMissed={() => props.onSelect(null)}
      >
        <Scene {...props} />
      </Canvas>
    </Boundary>
  );
}
