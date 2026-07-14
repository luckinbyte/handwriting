import { HandwritingStreamElement } from './HandwritingStreamElement';

/**
 * Register `<handwriting-stream>` (or a custom name). Idempotent and SSR-safe:
 * a no-op when `customElements` is unavailable, and safe to call repeatedly.
 */
export function defineHandwritingStream(name = 'handwriting-stream'): void {
  if (typeof customElements === 'undefined') return; // SSR / non-browser
  if (customElements.get(name)) return; // already defined
  customElements.define(name, HandwritingStreamElement);
}
