import { useCallback, useEffect, useRef, useState } from 'react';
import { applyAction, chooseAiAction, createGame, type Action, type GameState, type SeatConfig } from './engine';

const SAVE_KEY = 'facets-save-v1';
const AI_DELAY_MS = 750;
const AI_CONFIRM_DELAY_MS = 450;

interface Session {
  state: GameState;
  /** snapshot at the start of the current turn, used for undo */
  turnStart: GameState;
  /** undo is disabled after peeking at a blind-drawn card */
  undoBlocked: boolean;
}

function load(): Session | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.state?.players?.length) return null;
    return s;
  } catch {
    return null;
  }
}

function save(s: Session | null) {
  try {
    if (s) localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable: play on without saving */
  }
}

export function useGame() {
  const [session, setSession] = useState<Session | null>(() => load());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => save(session), [session]);

  // Keep a ref so dispatches chain correctly even before React re-renders.
  const ref = useRef(session);
  ref.current = session;
  const commit = useCallback((s: Session | null) => {
    ref.current = s;
    setSession(s);
  }, []);

  const newGame = useCallback((seats: SeatConfig[]) => {
    const state = createGame(seats, Math.floor(Math.random() * 2 ** 31));
    commit({ state, turnStart: state, undoBlocked: false });
    setError(null);
  }, [commit]);

  const dispatch = useCallback(
    (action: Action) => {
      const prev = ref.current;
      if (!prev) return;
      try {
        const state = applyAction(prev.state, action);
        const turnEnded = action.type === 'endTurn' || state.current !== prev.state.current;
        setError(null);
        commit({
          state,
          turnStart: turnEnded ? state : prev.turnStart,
          undoBlocked: turnEnded
            ? false
            : prev.undoBlocked || (action.type === 'reserve' && action.source.kind === 'deck'),
        });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [commit],
  );

  const undo = useCallback(() => {
    const prev = ref.current;
    if (prev && !prev.undoBlocked) commit({ ...prev, state: prev.turnStart });
  }, [commit]);

  const quit = useCallback(() => commit(null), [commit]);

  // AI driver: one step per tick with a visible delay.
  const state = session?.state;
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state || state.phase === 'gameover') return;
    const p = state.players[state.current];
    if (p.controller === 'human') return;
    const delay = state.phase === 'confirm' ? AI_CONFIRM_DELAY_MS : AI_DELAY_MS;
    timer.current = window.setTimeout(() => {
      dispatch(chooseAiAction(state));
    }, delay);
    return () => window.clearTimeout(timer.current);
  }, [state, dispatch]);

  const canUndo =
    !!session &&
    !session.undoBlocked &&
    session.state.phase !== 'gameover' &&
    session.state.players[session.state.current].controller === 'human' &&
    session.state.phase !== 'action';

  return { session, error, newGame, dispatch, undo, canUndo, quit, clearError: () => setError(null) };
}
