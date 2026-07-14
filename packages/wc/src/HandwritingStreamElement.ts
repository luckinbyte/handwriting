import { createHandwritingEngine } from '@handwriting/core';
import type {
  HandwritingConfig,
  HandwritingEngine,
  HotSwappableConfig,
  PresetName,
  PushOptions,
} from '@handwriting/core';
import { relayEvents } from './events';

/** Config fields a live engine accepts via setConfig. Construct-time-only fields are excluded. */
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

function pickHotSwappable(c: Partial<HandwritingConfig> | null | undefined): HotSwappableConfig {
  if (!c) return {};
  // Record-typed accumulator: writing under a union of keys is otherwise rejected by TS.
  const out = {} as Record<keyof HotSwappableConfig, unknown>;
  for (const k of HOT_SWAPPABLE_KEYS) if (k in c) out[k] = c[k];
  return out as HotSwappableConfig;
}

/**
 * `<handwriting-stream>` — a drop-in custom element wrapping @handwriting/core.
 *
 * Light DOM (no Shadow): the element itself is the engine's container, so core's
 * `.hw-text` selectable/searchable text layer stays in the document. The consumer
 * must import `@handwriting/core/styles.css` (the element does not inject CSS).
 *
 * Drive it imperatively (`push`/`done`/…) or declaratively via the `text`
 * property / `preset` attribute. Engine events are re-emitted as bubbling
 * `CustomEvent`s prefixed `hw-` (`hw-charrendered`, `hw-complete`, …).
 *
 * Limitation: disconnecting the element (including a DOM move) destroys the
 * engine and its in-flight stream. Reconnecting starts fresh.
 */
export class HandwritingStreamElement extends HTMLElement {
  static readonly observedAttributes = ['preset'];

  #engine: HandwritingEngine | null = null;
  #unrelay: (() => void) | null = null;
  #config: Partial<HandwritingConfig> | null = null;

  // ---- config (JS object) ----
  get config(): Partial<HandwritingConfig> | null {
    return this.#config;
  }
  set config(next: Partial<HandwritingConfig> | null) {
    this.#config = next;
    this.#engine?.setConfig(pickHotSwappable(next));
  }

  // ---- reflected `preset` attribute ----
  get preset(): PresetName | null {
    return (this.getAttribute('preset') as PresetName | null) ?? null;
  }
  set preset(next: PresetName | null) {
    if (next == null) this.removeAttribute('preset');
    else this.setAttribute('preset', next);
  }

  // ---- convenience: render static text in one shot ----
  get text(): string {
    return Array.from(this.querySelectorAll('.hw-cell[data-char]'))
      .map((el) => el.getAttribute('data-char') ?? '')
      .join('');
  }
  set text(value: string) {
    const engine = this.#engine;
    if (!engine) return;
    engine.clear();
    engine.push(value);
    engine.done();
  }

  // ---- imperative streaming (delegate; no-op before connect) ----
  push(text: string, opts?: PushOptions): void {
    this.#engine?.push(text, opts);
  }
  done(): void {
    this.#engine?.done();
  }
  flush(): void {
    this.#engine?.flush();
  }
  idle(): Promise<void> {
    return this.#engine?.idle() ?? Promise.resolve();
  }
  clear(): void {
    this.#engine?.clear();
  }
  pause(): void {
    this.#engine?.pause();
  }
  resume(): void {
    this.#engine?.resume();
  }
  isPaused(): boolean {
    return this.#engine?.isPaused() ?? false;
  }
  setConfig(patch: HotSwappableConfig): void {
    this.#engine?.setConfig(patch);
  }
  getConfig(): Readonly<HandwritingConfig> | null {
    return this.#engine?.getConfig() ?? null;
  }

  // ---- lifecycle ----
  connectedCallback(): void {
    if (this.#engine) return; // already live (e.g. the element was moved)
    const initial: Partial<HandwritingConfig> = { ...(this.#config ?? {}) };
    const presetAttr = this.getAttribute('preset') as PresetName | null;
    if (presetAttr) initial.preset = presetAttr;
    const engine = createHandwritingEngine(this, initial);
    this.#engine = engine;
    this.#unrelay = relayEvents(engine, this);
  }

  disconnectedCallback(): void {
    this.#unrelay?.();
    this.#unrelay = null;
    this.#engine?.destroy();
    this.#engine = null;
  }

  attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
    if (name === 'preset' && this.#engine && next) {
      this.#engine.setConfig({ preset: next as PresetName });
    }
  }
}
