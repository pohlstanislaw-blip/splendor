import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TOKENS, type GameState, type Token } from '../engine';
import { GEM_COLORS } from './Gem';

/**
 * Animation layer. After each state change it compares the previous state with the new one and
 * plays short flights:
 *  - tokens taken: supply chip → player panel (arc)
 *  - tokens paid / returned: player panel → supply chip (arc)
 *  - card bought or reserved from the market: card ghost → player panel
 * It only reads the DOM (via data-fx / data-card-id attributes) and never touches game state.
 * Everything is skipped when the user prefers reduced motion.
 */
export function Fx({ state }: { state: GameState }) {
  const layer = useRef<HTMLDivElement>(null);
  const prev = useRef<GameState | null>(null);
  /** last rendered snapshot of each market card, so a bought card can still be animated */
  const cardSnapshots = useRef(new Map<string, { rect: DOMRect; html: string }>());

  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = state;
    const snapshots = cardSnapshots.current;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (before && !reduced && layer.current && before.turn === state.turn && sameGame(before, state)) {
      const who = state.current;
      const panel = document.querySelector<HTMLElement>(`[data-fx="player-${who}"]`);
      const pb = before.players[who];
      const pa = state.players[who];
      if (panel) {
        let delay = 0;
        for (const t of TOKENS) {
          const diff = pa.tokens[t] - pb.tokens[t];
          const chip = document.querySelector<HTMLElement>(`[data-fx="supply-${t}"]`);
          if (!chip || diff === 0) continue;
          for (let i = 0; i < Math.abs(diff); i++) {
            if (diff > 0) flyToken(layer.current, t, chip, panel, delay);
            else flyToken(layer.current, t, panel, chip, delay);
            delay += 70;
          }
        }
        // cards that left the market into this player's hand
        const gained = [...pa.cards.filter((id) => !pb.cards.includes(id)), ...pa.reserved.map((r) => r.cardId).filter((id) => !pb.reserved.some((r) => r.cardId === id))];
        for (const id of gained) {
          const snap = snapshots.get(id);
          if (snap) flyCard(layer.current, snap, panel);
        }
      }
    }

    // refresh snapshots of what is on the table now
    snapshots.clear();
    document.querySelectorAll<HTMLElement>('.app [data-card-id]').forEach((el) => {
      const id = el.dataset.cardId!;
      snapshots.set(id, { rect: el.getBoundingClientRect(), html: el.outerHTML });
    });
  }, [state]);

  return createPortal(<div className="fx-layer" ref={layer} aria-hidden />, document.body);
}

function sameGame(a: GameState, b: GameState) {
  return a.players.length === b.players.length && a.startPlayer === b.startPlayer && a.log.length <= b.log.length;
}

function center(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Quadratic-Bezier arc sampled into keyframes. */
function arcFrames(from: { x: number; y: number }, to: { x: number; y: number }, lift: number, endScale: number) {
  const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  const frames: Keyframe[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * ctrl.x + t ** 2 * to.x;
    const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * ctrl.y + t ** 2 * to.y;
    const s = 1 + (endScale - 1) * t + Math.sin(t * Math.PI) * 0.25;
    frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`, opacity: t > 0.85 ? (1 - t) / 0.15 : 1 });
  }
  return frames;
}

function flyToken(layer: HTMLElement, gem: Token, fromEl: HTMLElement, toEl: HTMLElement, delay: number) {
  const el = document.createElement('div');
  el.className = 'fx-token';
  el.style.setProperty('--glow', GEM_COLORS[gem].glow);
  // reuse the rendered gem icon so the shape matches exactly
  const icon = document.querySelector(`[data-fx="supply-${gem}"] svg.gem-icon`);
  if (icon) el.appendChild(icon.cloneNode(true));
  layer.appendChild(el);
  const anim = el.animate(arcFrames(center(fromEl), center(toEl), 90, 0.6), {
    duration: 620,
    delay,
    easing: 'cubic-bezier(.45,.05,.4,1)',
    fill: 'both',
  });
  anim.onfinish = () => el.remove();
  anim.oncancel = () => el.remove();
}

function flyCard(layer: HTMLElement, snap: { rect: DOMRect; html: string }, toEl: HTMLElement) {
  const wrap = document.createElement('div');
  wrap.className = 'fx-card';
  wrap.innerHTML = snap.html;
  wrap.style.width = `${snap.rect.width}px`;
  wrap.style.height = `${snap.rect.height}px`;
  layer.appendChild(wrap);
  const from = { x: snap.rect.left + snap.rect.width / 2, y: snap.rect.top + snap.rect.height / 2 };
  const to = center(toEl);
  const anim = wrap.animate(
    [
      { transform: `translate(${from.x}px, ${from.y}px) translate(-50%, -50%) rotateY(0deg) scale(1)`, opacity: 1 },
      { transform: `translate(${from.x}px, ${from.y - 24}px) translate(-50%, -50%) rotateY(0deg) scale(1.08)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${to.x}px, ${to.y}px) translate(-50%, -50%) rotateY(180deg) scale(0.25)`, opacity: 0 },
    ],
    { duration: 720, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' },
  );
  anim.onfinish = () => wrap.remove();
  anim.oncancel = () => wrap.remove();
}
