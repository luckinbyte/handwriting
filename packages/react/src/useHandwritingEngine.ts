import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createHandwritingEngine } from '@handwriting/core';
import type { HandwritingConfig, HandwritingEngine, HotSwappableConfig } from '@handwriting/core';

/**
 * Config fields that can be hot-swapped on a live engine via `setConfig`.
 * Everything else (`virtualization`, `cdnBase`, `loadCharData`, `memoryCacheSize`)
 * is fixed at construction — to change those, remount via a `key`.
 */
const HOT_SWAPPABLE_KEYS = [
  'preset',
  'strokeAnimationSpeed',
  'delayBetweenStrokes',
  'fadeDuration',
  'interCharDelay',
  'overlap',
  'catchUpThreshold',
  'catchUpDuration',
  'maxConcurrent',
  'strokeColor',
  'baselineOffset',
  'fontFamily',
  'renderer',
  'respectReducedMotion',
] as const satisfies readonly (keyof HotSwappableConfig)[];

/** Shallow-diff the hot-swappable keys; returns a patch or null if unchanged. */
function diffHotSwappable(
  prev: Partial<HandwritingConfig> | undefined,
  next: Partial<HandwritingConfig> | undefined,
): HotSwappableConfig | null {
  // Record-typed accumulator: writing under a union of keys is otherwise rejected by TS.
  const patch = {} as Record<keyof HotSwappableConfig, unknown>;
  let changed = false;
  for (const key of HOT_SWAPPABLE_KEYS) {
    if (prev?.[key] !== next?.[key]) {
      // Hot-swappable fields are all primitives, so a !== check is exact.
      patch[key] = next?.[key];
      changed = true;
    }
  }
  return changed ? (patch as HotSwappableConfig) : null;
}

/**
 * Mount a {@link HandwritingEngine} into the element behind `ref`.
 *
 * - Returns `null` before mount and during SSR (the engine is created inside a
 *   `useEffect`, which never runs on the server), and the live engine afterward.
 * - The engine is created once on mount with the initial `config` and destroyed
 *   on unmount. Correct effect cleanup makes React 18/19 StrictMode's dev
 *   double-invoke (create → destroy → create) safe.
 * - When `config` changes, only the {@link HotSwappableConfig} fields are diffed
 *   (shallowly) and applied via `setConfig` — the engine is NOT recreated, so an
 *   in-flight stream keeps going. Construct-time fields are honored from the
 *   initial `config` only; later changes are ignored. This is robust to inline
 *   config objects (a fresh object every render) — no `useMemo` required.
 */
export function useHandwritingEngine(
  ref: RefObject<HTMLElement | null>,
  config?: Partial<HandwritingConfig>,
): HandwritingEngine | null {
  const [engine, setEngine] = useState<HandwritingEngine | null>(null);
  // Last config we applied to the engine (starts as the initial config).
  const prevConfigRef = useRef<Partial<HandwritingConfig> | undefined>(config);

  // Create on mount, destroy on unmount. Mount-only — reads the initial config.
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const instance = createHandwritingEngine(container, prevConfigRef.current);
    setEngine(instance);
    return () => {
      instance.destroy();
      setEngine(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply hot-swappable config changes without recreating the engine.
  useEffect(() => {
    if (!engine) return;
    const patch = diffHotSwappable(prevConfigRef.current, config);
    prevConfigRef.current = config;
    if (patch) engine.setConfig(patch);
  }, [config, engine]);

  return engine;
}
