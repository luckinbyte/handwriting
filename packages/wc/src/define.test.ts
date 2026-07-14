import { afterEach, describe, expect, it } from 'vitest';
import { defineHandwritingStream, HandwritingStreamElement } from './index';

const g = globalThis as { customElements?: CustomElementRegistry };
const realCE = g.customElements;

describe('defineHandwritingStream', () => {
  afterEach(() => {
    g.customElements = realCE;
  });

  it('is a safe no-op when customElements is undefined (SSR)', () => {
    delete g.customElements;
    expect(() => defineHandwritingStream()).not.toThrow();
  });

  it('registers <handwriting-stream> and is idempotent', () => {
    defineHandwritingStream();
    expect(g.customElements?.get('handwriting-stream')).toBe(HandwritingStreamElement);
    expect(() => defineHandwritingStream()).not.toThrow();
    expect(g.customElements?.get('handwriting-stream')).toBe(HandwritingStreamElement);
  });

  // NOTE: a single CustomElementRegistry forbids reusing the same constructor
  // under a second name, so a custom-name case can't be exercised here alongside
  // the default — `defineHandwritingStream(name)` simply forwards the name.
});
