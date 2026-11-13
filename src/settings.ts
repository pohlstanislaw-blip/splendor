// Per-browser display settings: table (3D) or classic (2D) view, motion and sound.
import { useCallback, useEffect, useState } from 'react';

export type ViewChoice = 'auto' | 'table' | 'classic';
export interface Settings {
  /** settings format; 2 = automatic fallbacks are no longer saved */
  v?: number;
  view: ViewChoice;
  /** null = follow the system "reduce motion" setting */
  reduceMotion: boolean | null;
  sound: boolean;
  /** readable cost labels on cards on the 3D table */
  costLabels: boolean;
}

const KEY = 'facets-settings';
const DEFAULTS: Settings = { view: 'auto', reduceMotion: null, sound: false, costLabels: true };

/**
 * Version 1 saved an automatic "too slow" fallback as if the player had chosen Classic.
 * Give those browsers the table again; a real choice is saved as version 2 from now on.
 */
export function normalizeSettings(saved: Partial<Settings>): Settings {
  const s = { ...saved };
  if (!s.v && s.view === 'classic') s.view = 'auto';
  return { ...DEFAULTS, ...s, v: 2 };
}

function load(): Settings {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>);
  } catch {
    return { ...DEFAULTS, v: 2 };
  }
}

const FALLBACK_KEY = 'facets-table-fallback';
/** An automatic switch to Classic lasts for this visit (tab) only, never saved as a choice. */
function loadFallback(): string | null {
  try {
    return sessionStorage.getItem(FALLBACK_KEY);
  } catch {
    return null;
  }
}

let webgl: boolean | null = null;
export function webglAvailable(): boolean {
  if (webgl === null) {
    try {
      const c = document.createElement('canvas');
      webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

function systemReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);
  /** why the table was switched off automatically this visit, if it was */
  const [fallback, setFallbackState] = useState<string | null>(loadFallback);
  const setFallback = useCallback((why: string | null) => {
    setFallbackState(why);
    try {
      if (why) sessionStorage.setItem(FALLBACK_KEY, why);
      else sessionStorage.removeItem(FALLBACK_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const [wide, setWide] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 900);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const update = useCallback((patch: Partial<Settings>) => {
    // choosing a view yourself clears any automatic fallback
    if (patch.view) setFallback(null);
    setSettings((s) => {
      const next = { ...s, ...patch, v: 2 };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, [setFallback]);
  const tablePossible = webglAvailable();
  /** the view actually shown */
  const view: 'table' | 'classic' =
    !tablePossible || settings.view === 'classic' || (settings.view === 'auto' && fallback)
      ? 'classic'
      : settings.view === 'table' || wide
        ? 'table'
        : 'classic';
  const reducedMotion = settings.reduceMotion ?? systemReducedMotion();
  return { settings, update, view, reducedMotion, tablePossible, fallback, setFallback };
}
