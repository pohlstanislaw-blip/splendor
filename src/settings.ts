// Per-browser display settings: table (3D) or classic (2D) view, motion and sound.
import { useCallback, useEffect, useState } from 'react';

export type ViewChoice = 'auto' | 'table' | 'classic';
export interface Settings {
  view: ViewChoice;
  /** null = follow the system "reduce motion" setting */
  reduceMotion: boolean | null;
  sound: boolean;
}

const KEY = 'facets-settings';
const DEFAULTS: Settings = { view: 'auto', reduceMotion: null, sound: false };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return DEFAULTS;
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
  const [wide, setWide] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 900);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);
  const tablePossible = webglAvailable();
  /** the view actually shown */
  const view: 'table' | 'classic' = !tablePossible || settings.view === 'classic' ? 'classic' : settings.view === 'table' || wide ? 'table' : 'classic';
  const reducedMotion = settings.reduceMotion ?? systemReducedMotion();
  return { settings, update, view, reducedMotion, tablePossible };
}
