import type { HandwritingConfig, PresetName, RhythmConfig } from './types';

/** Default CDN base (Make me a Hanzi data, one JSON per character). */
export const DEFAULT_CDN_BASE = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/';

/** Named rhythm presets. `custom` has no entry — explicit values are used as-is. */
export const presets: Record<Exclude<PresetName, 'custom'>, RhythmConfig> = {
  // Smart: normal stroke speed + catch-up. Everyday long-form default.
  auto: {
    strokeAnimationSpeed: 1,
    delayBetweenStrokes: 0,
    fadeDuration: 120,
    strokeDuration: 450,
    interCharDelay: 0,
    overlap: false,
    catchUpThreshold: 40,
    catchUpDuration: 0,
  },
  // Fluid: fast, overlapping, typewriter-like.
  fluid: {
    strokeAnimationSpeed: 4,
    delayBetweenStrokes: 0,
    fadeDuration: 40,
    strokeDuration: 90,
    interCharDelay: 0,
    overlap: true,
    catchUpThreshold: 120,
    catchUpDuration: 0,
  },
  // Realistic: slow, serial, never catches up.
  realistic: {
    strokeAnimationSpeed: 1,
    delayBetweenStrokes: 200,
    fadeDuration: 200,
    strokeDuration: 700,
    interCharDelay: 60,
    overlap: false,
    catchUpThreshold: Number.POSITIVE_INFINITY,
    catchUpDuration: 0,
  },
};

export const DEFAULT_CONFIG: HandwritingConfig = {
  preset: 'auto',
  ...presets.auto,
  maxConcurrent: 8,
  strokeColor: 'currentColor',
  fontFamily: 'inherit',
  renderer: 'svg',
  baselineOffset: '-0.12em',
  cdnBase: DEFAULT_CDN_BASE,
  memoryCacheSize: 2048,
  respectReducedMotion: true,
  virtualization: { enabled: true, rootMargin: '100% 0px' },
};

/** Resolve a full config from a user partial: defaults → preset rhythm → explicit overrides. */
export function resolveConfig(user?: Partial<HandwritingConfig>): HandwritingConfig {
  if (!user || Object.keys(user).length === 0) return { ...DEFAULT_CONFIG };
  const presetName: PresetName = user.preset ?? DEFAULT_CONFIG.preset;
  const presetRhythm = presetName === 'custom' ? {} : presets[presetName];
  const resolved: HandwritingConfig = { ...DEFAULT_CONFIG, ...presetRhythm, ...user };
  // `virtualization` is a nested object — merge partially so e.g.
  // `{ virtualization: { enabled: false } }` keeps the default `rootMargin`.
  resolved.virtualization = {
    ...DEFAULT_CONFIG.virtualization,
    ...(user.virtualization ?? {}),
  };
  return resolved;
}
