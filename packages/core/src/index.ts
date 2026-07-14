// @handwriting/core — public entry.

export { createHandwritingEngine, isBrowser, NoopHandwritingEngine } from './lifecycle/SsrGuard';
export { preloadHanzi } from './preload';
export { presets, DEFAULT_CONFIG, DEFAULT_CDN_BASE, resolveConfig } from './presets';
export { HandwritingEngineImpl } from './HandwritingEngine';

export type {
  A11yConfig,
  CatchUpChangeEvent,
  CharClass,
  CharacterJson,
  CharRenderedEvent,
  CompleteEvent,
  ConcurrencyConfig,
  ConfigChangeEvent,
  DataConfig,
  EventListener,
  GraphemeQueuedEvent,
  HandwritingConfig,
  HandwritingEngine,
  HandwritingErrorEvent,
  HandwritingEventMap,
  HotSwappableConfig,
  PresetName,
  PushOptions,
  RhythmConfig,
  StyleConfig,
  VirtualizationConfig,
} from './types';
