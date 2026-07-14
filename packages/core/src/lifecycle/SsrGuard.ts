import { HandwritingEngineImpl } from '../HandwritingEngine';
import { resolveConfig } from '../presets';
import type { HandwritingConfig, HandwritingEngine, HotSwappableConfig } from '../types';

/** True when a DOM is available (false during SSR). */
export function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

/** No-op engine returned in non-browser environments — safe to call, does nothing. */
export class NoopHandwritingEngine implements HandwritingEngine {
  private config: HandwritingConfig;

  constructor(config?: Partial<HandwritingConfig>) {
    this.config = resolveConfig(config);
  }

  push(): void {}
  done(): void {}
  flush(): void {}
  idle(): Promise<void> {
    return Promise.resolve();
  }
  setConfig(patch: HotSwappableConfig): void {
    this.config = { ...this.config, ...patch };
  }
  getConfig(): Readonly<HandwritingConfig> {
    return this.config;
  }
  pause(): void {}
  resume(): void {}
  isPaused(): boolean {
    return false;
  }
  clear(): void {}
  destroy(): void {}
  on(): () => void {
    return () => {};
  }
  once(): void {}
  off(): void {}
}

/** SSR-safe factory. Returns a no-op engine when `document` is undefined. */
export function createHandwritingEngine(
  container: HTMLElement,
  config?: Partial<HandwritingConfig>,
): HandwritingEngine {
  if (!isBrowser()) {
    if (typeof console !== 'undefined') {
      console.warn('@handwriting/core: no DOM available — returning a no-op engine.');
    }
    return new NoopHandwritingEngine(config);
  }
  return new HandwritingEngineImpl(container, config);
}
