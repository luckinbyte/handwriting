/**
 * @handwriting/core — public types.
 *
 * The engine reduces every upstream source (SSE, WebSocket, fetch stream, …)
 * to a single `push(text)` entry point and renders text character-by-character
 * with a handwriting effect: Chinese via hanzi-writer stroke order, everything
 * else via a fade.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type PresetName = 'auto' | 'fluid' | 'realistic' | 'custom';

/** Rhythm fields — overridden by the chosen preset, then by any explicit user values. */
export interface RhythmConfig {
  /** hanzi-writer stroke animation speed multiplier (1 = default). */
  strokeAnimationSpeed: number;
  /** hanzi-writer delay between strokes, ms. */
  delayBetweenStrokes: number;
  /** Animation duration for non-Hanzi characters, ms. */
  fadeDuration: number;
  /** Stroke-draw duration for Latin/digit/punct characters, ms. */
  strokeDuration: number;
  /** Delay before starting the next character, ms. */
  interCharDelay: number;
  /** When false, the next character waits for the previous to finish (serial handwriting).
   *  When true, characters may overlap (fluid). */
  overlap: boolean;
  /** When the backlog exceeds this many queued characters, subsequent chars render instantly. */
  catchUpThreshold: number;
  /** Duration used while catching up, ms (0 = skip animation entirely). */
  catchUpDuration: number;
}

export interface ConcurrencyConfig {
  /** Max number of HanziWriter instances animating at once (rAF guardrail). */
  maxConcurrent: number;
}

export interface StyleConfig {
  /** Stroke color for Hanzi. `'currentColor'` follows the container text color. */
  strokeColor: string;
  /** Font family for non-Hanzi characters. `'inherit'` follows the container. */
  fontFamily: string;
  /** hanzi-writer renderer. `svg` is selectable; `canvas` is faster but not selectable. */
  renderer: 'svg' | 'canvas';
  /** Vertical baseline correction for the Hanzi cell vs Latin baseline (CSS length). */
  baselineOffset: string;
}

export interface DataConfig {
  /** Base URL for per-character stroke JSON (Make me a Hanzi). */
  cdnBase: string;
  /** Custom loader overriding the CDN. Synchronous return = cache hit (zero latency). */
  loadCharData?: (char: string) => CharacterJson | Promise<CharacterJson>;
  /** L1 memory cache capacity (number of characters). */
  memoryCacheSize: number;
}

export interface A11yConfig {
  /** When true (default), honor `prefers-reduced-motion` → everything renders instantly. */
  respectReducedMotion: boolean;
}

export interface VirtualizationConfig {
  /** Reclaim finished cells that scroll out of view (default true). */
  enabled: boolean;
  /**
   * Buffer kept live around the viewport (CSS `rootMargin`). Cells beyond it
   * collapse to their text layer. Larger = more cells stay handwritten at once
   * (higher memory); smaller = tighter bound. Default `'100% 0px'`.
   */
  rootMargin: string;
}

export interface HandwritingConfig
  extends RhythmConfig, ConcurrencyConfig, StyleConfig, DataConfig, A11yConfig {
  preset: PresetName;
  /** Long-text virtualization: reclaim finished cells that scroll out of view. */
  virtualization: VirtualizationConfig;
}

/** Subset of config that may be hot-swapped at runtime via `setConfig`. */
export type HotSwappableConfig = Partial<
  Pick<
    HandwritingConfig,
    | 'preset' | 'strokeAnimationSpeed' | 'delayBetweenStrokes' | 'fadeDuration' | 'interCharDelay'
    | 'overlap' | 'catchUpThreshold' | 'catchUpDuration' | 'maxConcurrent' | 'strokeColor'
    | 'baselineOffset' | 'fontFamily' | 'renderer' | 'respectReducedMotion'
  >
>;

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

export type CharClass =
  | 'hanzi'
  | 'latin'
  | 'digit'
  | 'punct'
  | 'space'
  | 'newline'
  | 'emoji'
  | 'fallback';

/** Make me a Hanzi character JSON (subset relevant to rendering). */
export interface CharacterJson {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
}

// ---------------------------------------------------------------------------
// Push options
// ---------------------------------------------------------------------------

export interface PushOptions {
  /** Render this text instantly with no animation (used for code blocks / tables). */
  instant?: boolean;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventListener<T> = (detail: T) => void;

export interface CharRenderedEvent {
  char: string;
  cls: CharClass;
  index: number;
  duration: number;
}
export interface GraphemeQueuedEvent {
  cluster: string;
  cls: CharClass;
}
export interface CatchUpChangeEvent {
  active: boolean;
  backlog: number;
}
export interface ConfigChangeEvent {
  patch: HotSwappableConfig;
}
export interface HandwritingErrorEvent {
  err: Error;
  char?: string;
  phase: 'segment' | 'load' | 'render';
}
export interface CompleteEvent {
  total: number;
}

export interface HandwritingEventMap {
  charrendered: CharRenderedEvent;
  graphemequeued: GraphemeQueuedEvent;
  catchupchange: CatchUpChangeEvent;
  configchange: ConfigChangeEvent;
  error: HandwritingErrorEvent;
  complete: CompleteEvent;
  destroy: void;
}

// ---------------------------------------------------------------------------
// Engine contract
// ---------------------------------------------------------------------------

export interface HandwritingEngine {
  /** Feed a chunk of streamed text. Safe to call repeatedly. */
  push(text: string, opts?: PushOptions): void;
  /** Explicitly mark the stream ended (idle ≠ end). Triggers `complete` when drained. */
  done(): void;
  /** Skip all remaining animation, render everything to its final state. */
  flush(): void;
  /** Resolves when the queue is empty and all animations have finished. */
  idle(): Promise<void>;

  /** Hot-swap config; affects characters not yet started. */
  setConfig(patch: HotSwappableConfig): void;
  getConfig(): Readonly<HandwritingConfig>;

  pause(): void;
  resume(): void;
  isPaused(): boolean;

  /** Remove all rendered cells and clear the queue; keep the sandbox. */
  clear(): void;
  /** Pause all writers, remove the sandbox, release references, emit `destroy`. */
  destroy(): void;

  on<K extends keyof HandwritingEventMap & string>(
    type: K,
    listener: EventListener<HandwritingEventMap[K]>,
  ): () => void;
  once<K extends keyof HandwritingEventMap & string>(
    type: K,
    listener: EventListener<HandwritingEventMap[K]>,
  ): void;
  off<K extends keyof HandwritingEventMap & string>(
    type: K,
    listener: EventListener<HandwritingEventMap[K]>,
  ): void;
}

// The public factory (`createHandwritingEngine`) and `preloadHanzi` are
// implemented in ./lifecycle/SsrGuard and ./preload, and re-exported from ./index.
