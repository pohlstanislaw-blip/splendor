// The first-person 3D table. Loaded lazily (three.js lives only in this chunk).
// It only READS game state and reports clicks; every rule stays in the engine.
import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { DRAG_THRESHOLD, justDragged, markDragEnded } from './drag';
import { useKick } from './kick';
import { cardBackTexture, cardFaceTexture, chipTexture, glowTexture, onTextureLoaded, patronTexture, setMaxAnisotropy, woodTexture } from './textures';
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
const edgeMat = new THREE.MeshLambertMaterial({ color: '#e9dcc0' });
const patronEdge = new THREE.MeshLambertMaterial({ color: '#8a6a2e' });

function faceMaterial(map: THREE.Texture, glow = 0.2) {
  // the emissive map keeps faces readable in the dim room
  return new THREE.MeshLambertMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: glow });
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
          if (!item.select || justDragged()) return;
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
    const side = cached('deck-side', () => new THREE.MeshLambertMaterial({ color: '#cbbd9c' }));
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
        if (justDragged()) return;
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
    const side = cached(`chip-side-${token}`, () => new THREE.MeshLambertMaterial({ color: c.fill, emissive: c.fill, emissiveIntensity: 0.15 }));
    const top = cached(`chip-top-${token}`, () => faceMaterial(chipTexture(token), 0.3));
    const bottom = cached('chip-bottom', () => new THREE.MeshLambertMaterial({ color: '#1a1410' }));
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
                if (!can || justDragged()) return;
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
          if (justDragged()) return;
          e.stopPropagation();
          onSelect({ kind: 'patron', patronId: id });
        }}
      />
    </Mover>
  );
});

// ---------------------------------------------------------------------------
// room, lights, figures

/** A candle. Its light is a painted glow on the table (no real light: much cheaper to draw). */
function Flame({ position }: { position: [number, number, number] }) {
  const glowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }),
    [],
  );
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 0.6, 10]} />
        <meshLambertMaterial color="#e8dcc0" emissive="#553311" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.05, 12]} />
        <meshLambertMaterial color="#8a6a2e" emissive="#3a2508" />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#ffd27a" />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} material={glowMat} renderOrder={1}>
        <planeGeometry args={[5.5, 5.5]} />
      </mesh>
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
        <meshLambertMaterial map={wood} />
      </mesh>
      {/* table rim and legs */}
      <mesh position={[0, -0.55, zMid]}>
        <boxGeometry args={[t.halfWidth * 2 - 0.5, 0.35, depth - 0.5]} />
        <meshLambertMaterial color="#2a1a10" />
      </mesh>
      <mesh position={[0, -4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial color="#0d0a08" />
      </mesh>
      <mesh position={[0, 4, -17]}>
        <planeGeometry args={[80, 24]} />
        <meshBasicMaterial color="#17110d" />
      </mesh>
      <Flame position={[-t.halfWidth + 1.0, 0, t.zFar + 1.0]} />
      <Flame position={[t.halfWidth - 1.0, 0, t.zFar + 1.0]} />
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.85} color="#ffd9b0" />
      <hemisphereLight args={['#6a5a48', '#0a0705', 0.7]} />
      <spotLight
        position={[0, 11, 3]}
        angle={0.95}
        penumbra={0.85}
        intensity={270}
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
  const cloth = cached(
    `cloth-${variant % 3}`,
    () => new THREE.MeshLambertMaterial({ color: ['#3a3046', '#3b3a2c', '#46302a'][variant % 3], emissive: '#2a1a10', emissiveIntensity: 0.6, flatShading: true }),
  );
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
        <meshLambertMaterial color="#5a4436" emissive="#3a2414" emissiveIntensity={0.7} flatShading />
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
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={active ? 1.4 : 0.3} />
      </mesh>
    </group>
  );
}


/** How far you can look around (offsets of the look-at point and camera). */
const LOOK = { x: 1.8, z: 1.1, camX: 0.7 };

/**
 * The camera sits in your seat. Drag (mouse or finger) to look around a little; the view stays
 * where you leave it. Double-click empty table or press R to look straight ahead again.
 * Plain mouse movement never moves the camera, so aiming at a card doesn't shift the table.
 */
function CameraRig({ playerCount, reduced }: { playerCount: number; reduced: boolean }) {
  const { camera, size, invalidate, gl } = useThree();
  const look = useRef(new THREE.Vector3());
  /** wanted look offset, -1..1 on each axis */
  const aim = useRef({ x: 0, y: 0 });
  const base = useMemo(() => cameraFor(playerCount, size.width / size.height), [playerCount, size.width, size.height]);
  useEffect(() => {
    camera.position.set(...base.pos);
    (camera as THREE.PerspectiveCamera).fov = base.fov;
    camera.updateProjectionMatrix();
    look.current.set(base.target[0] + aim.current.x * LOOK.x, base.target[1], base.target[2] - aim.current.y * LOOK.z);
    camera.position.x = aim.current.x * LOOK.camX;
    camera.lookAt(look.current);
    invalidate();
  }, [camera, base, invalidate]);

  useEffect(() => {
    const el = gl.domElement;
    let press: { id: number; x: number; y: number; ax: number; ay: number; dragging: boolean } | null = null;
    const recenter = () => {
      aim.current = { x: 0, y: 0 };
      invalidate();
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, ax: aim.current.x, ay: aim.current.y, dragging: false };
    };
    const move = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      const dx = e.clientX - press.x;
      const dy = e.clientY - press.y;
      if (!press.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        press.dragging = true;
        el.setPointerCapture?.(e.pointerId);
        document.body.style.cursor = 'grabbing';
      }
      // drag the table: moving the pointer right looks left, like pulling the view
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      aim.current = { x: clamp(press.ax - (dx / el.clientWidth) * 2.2), y: clamp(press.ay + (dy / el.clientHeight) * 2.2) };
      invalidate();
    };
    const up = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      if (press.dragging) {
        markDragEnded();
        document.body.style.cursor = '';
      }
      press = null;
    };
    const key = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && !(e.target instanceof HTMLInputElement) && !e.ctrlKey && !e.metaKey) recenter();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('dblclick', recenter);
    window.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('dblclick', recenter);
      window.removeEventListener('keydown', key);
    };
  }, [gl, invalidate]);

  useFrame((_, dt) => {
    const tx = base.target[0] + aim.current.x * LOOK.x;
    const tz = base.target[2] - aim.current.y * LOOK.z;
    const camX = aim.current.x * LOOK.camX;
    // with reduced motion the view jumps straight to where you dragged it
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 10);
    look.current.x += (tx - look.current.x) * k;
    look.current.z += (tz - look.current.z) * k;
    camera.position.x += (camX - camera.position.x) * k;
    camera.lookAt(look.current);
    // keep drawing until the view has settled
    if (Math.abs(tx - look.current.x) + Math.abs(tz - look.current.z) + Math.abs(camX - camera.position.x) > 0.002) invalidate();
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
/** Below this, drop to 1 device pixel per screen pixel (sharpness for speed). */
const SHARP_FPS = 40;
function PerfWatch({ onSlow }: { onSlow?: (fps: number) => void }) {
  const acc = useRef({ warm: 0, t: 0, frames: 0, done: false, round: 0 });
  const invalidate = useThree((s) => s.invalidate);
  const setDpr = useThree((s) => s.setDpr);
  const dpr = useThree((s) => s.viewport.dpr);
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.done) return;
    invalidate(); // the scene normally draws on demand; keep drawing while measuring
    if (dt > 0.25 || document.hidden) return;
    if (a.warm < 3) {
      a.warm += dt;
      return;
    }
    a.t += dt;
    a.frames++;
    if (a.t < 4) return;
    const fps = a.frames / a.t;
    if (fps < SHARP_FPS && dpr > 1 && a.round < 2) {
      // too slow at this sharpness: step down (2 → 1.5 → 1) and measure again
      setDpr(dpr > 1.5 ? 1.5 : 1);
      Object.assign(a, { warm: 2, t: 0, frames: 0, round: a.round + 1 });
      return;
    }
    a.done = true;
    if (fps < SLOW_FPS) onSlow?.(fps);
  });
  return null;
}

/** Redraw when a card picture finishes decoding. */
function TextureKick() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => onTextureLoaded(() => invalidate()), [invalidate]);
  return null;
}

/** Redraw (and refresh shadows) whenever the game state changes. */
function StateKick({ state }: { state: GameState }) {
  const kick = useKick();
  useEffect(() => kick(), [state, kick]);
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
      <TextureKick />
      <StateKick state={state} />
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
        frameloop="demand"
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: 42, near: 0.1, far: 80, position: [0, 8, 9.4] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.setClearColor('#0b0806');
          setMaxAnisotropy(gl.capabilities.getMaxAnisotropy());
          // shadows are recomputed only when something moves (see kick.ts)
          gl.shadowMap.autoUpdate = false;
          gl.shadowMap.needsUpdate = true;
        }}
        onPointerMissed={() => {
          if (!justDragged()) props.onSelect(null);
        }}
      >
        <Scene {...props} />
      </Canvas>
    </Boundary>
  );
}
