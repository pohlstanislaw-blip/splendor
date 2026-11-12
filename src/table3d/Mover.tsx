// Moves a group to its target pose. Game state is the only source of truth: whenever the pose
// computed from state changes, the object tweens there. A change of `zone` (e.g. market → a
// player's stack) plays the pick-up sequence: rise, turn to the viewer, hold, then fly.
import { useFrame, useThree } from '@react-three/fiber';
import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Pose } from './layout';

export interface Motion {
  /** false until the scene's first layout is on screen: nothing animates in on load */
  ready: { current: boolean };
  reduced: boolean;
  /** changes when the camera seat changes: everything snaps instead of flying */
  snapKey: string;
}
export const MotionContext = createContext<Motion>({ ready: { current: true }, reduced: false, snapKey: '' });

interface Q {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
}
interface Segment {
  from: Q;
  to: Q;
  dur: number;
  arc: number;
  wait: number;
}

const euler = new THREE.Euler();
function toQ(p: Pose): Q {
  euler.set(p.rot[0], p.rot[1], p.rot[2], 'YXZ');
  return { pos: new THREE.Vector3(...p.pos), quat: new THREE.Quaternion().setFromEuler(euler), scale: p.scale };
}
const poseKey = (p: Pose) => [...p.pos, ...p.rot, p.scale].map((n) => n.toFixed(3)).join(',');
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export type Via = 'showcase' | 'lift' | undefined;

export function Mover({
  pose,
  zone,
  from,
  via,
  delay = 0,
  onArrive,
  flash = false,
  children,
}: {
  pose: Pose;
  /** logical place (market, bought-0, supply, …); a change triggers `via` and `onArrive` */
  zone: string;
  /** where the object appears from when it first enters the scene after load (e.g. its deck) */
  from?: Pose;
  /** pick-up style used when the zone changes */
  via?: Via;
  delay?: number;
  onArrive?: () => void;
  /** show a glow instead of a flight when motion is reduced */
  flash?: boolean;
  children: ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const motion = useContext(MotionContext);
  const camera = useThree((s) => s.camera);
  const anim = useRef<{ segments: Segment[]; i: number; t: number; arrive: boolean } | null>(null);
  const last = useRef<{ key: string; zone: string; snapKey: string } | null>(null);
  const glowT = useRef(0);
  const key = poseKey(pose);

  useLayoutEffect(() => {
    const g = group.current!;
    const target = toQ(pose);
    const set = (q: Q) => {
      g.position.copy(q.pos);
      g.quaternion.copy(q.quat);
      g.scale.setScalar(q.scale);
    };
    const prev = last.current;
    last.current = { key, zone, snapKey: motion.snapKey };
    const zoneChanged = !!prev && prev.zone !== zone;

    // first appearance
    if (!prev) {
      if (from && motion.ready.current && !motion.reduced) {
        const start = toQ(from);
        set(start);
        anim.current = { segments: [{ from: start, to: target, dur: 0.6, arc: 0.7, wait: delay }], i: 0, t: 0, arrive: false };
      } else {
        set(target);
        if (from && motion.ready.current) glowT.current = 1;
      }
      return;
    }
    if (prev.key === key && !zoneChanged) return;

    // seat changed or motion reduced: no flights
    if (prev.snapKey !== motion.snapKey || motion.reduced) {
      anim.current = null;
      set(target);
      if (motion.reduced && zoneChanged && prev.snapKey === motion.snapKey) {
        glowT.current = 1;
        onArrive?.();
      }
      return;
    }

    // a flight is already under way and only its destination moved: retarget it, keep the sequence
    if (anim.current && !zoneChanged) {
      const segs = anim.current.segments;
      segs[segs.length - 1].to = target;
      return;
    }

    const cur: Q = { pos: g.position.clone(), quat: g.quaternion.clone(), scale: g.scale.x };
    const dist = cur.pos.distanceTo(target.pos);
    const segments: Segment[] = [];
    if (zoneChanged && via) {
      let mid: Q;
      if (via === 'showcase') {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        mid = { pos: camera.position.clone().addScaledVector(dir, 4.4), quat: camera.quaternion.clone(), scale: Math.max(cur.scale, 1) };
      } else {
        mid = {
          pos: cur.pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
          quat: cur.quat.clone().slerp(camera.quaternion, 0.65),
          scale: cur.scale,
        };
      }
      segments.push({ from: cur, to: mid, dur: 0.38, arc: 0.15, wait: delay });
      segments.push({ from: mid, to: target, dur: 0.55, arc: 0.5, wait: 0.42 });
    } else {
      const small = dist < 0.6;
      segments.push({ from: cur, to: target, dur: small ? 0.16 : 0.55, arc: small ? 0 : Math.min(1.5, dist * 0.22), wait: delay });
    }
    anim.current = { segments, i: 0, t: 0, arrive: zoneChanged };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, zone, motion.snapKey, motion.reduced]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (glow.current) {
      if (glowT.current > 0) {
        glowT.current = Math.max(0, glowT.current - dt / 0.9);
        glow.current.visible = true;
        (glow.current.material as THREE.MeshBasicMaterial).opacity = glowT.current * 0.85;
      } else if (glow.current.visible) glow.current.visible = false;
    }
    const a = anim.current;
    if (!a) return;
    const seg = a.segments[a.i];
    a.t += Math.min(dt, 0.05);
    const local = a.t - seg.wait;
    if (local < 0) return;
    const u = Math.min(1, local / seg.dur);
    const e = ease(u);
    g.position.lerpVectors(seg.from.pos, seg.to.pos, e);
    g.position.y += Math.sin(Math.PI * u) * seg.arc;
    g.quaternion.slerpQuaternions(seg.from.quat, seg.to.quat, e);
    g.scale.setScalar(seg.from.scale + (seg.to.scale - seg.from.scale) * e);
    if (u >= 1) {
      a.i++;
      a.t = 0;
      if (a.i >= a.segments.length) {
        anim.current = null;
        if (a.arrive) onArrive?.();
      }
    }
  });

  return (
    <group ref={group}>
      {children}
      {flash && (
        <mesh ref={glow} visible={false} position={[0, 0, -0.02]} renderOrder={2}>
          <planeGeometry args={[1.22, 1.62]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
