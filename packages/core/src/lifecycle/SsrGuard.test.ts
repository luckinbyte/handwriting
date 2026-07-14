import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HandwritingEngineImpl } from '../HandwritingEngine';
import {
  NoopHandwritingEngine,
  createHandwritingEngine,
  isBrowser,
} from './SsrGuard';

const g = globalThis as { document?: Document };
const realDocument = g.document;

describe('createHandwritingEngine — SSR guard', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    g.document = realDocument;
  });

  it('returns a NoopHandwritingEngine when document is undefined (SSR)', () => {
    const container = document.createElement('div');
    delete g.document;

    const engine = createHandwritingEngine(container, {});

    expect(engine).toBeInstanceOf(NoopHandwritingEngine);
    expect(isBrowser()).toBe(false);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain('no-op');
  });

  it('does not mutate the container in SSR', () => {
    const container = document.createElement('div');
    delete g.document;

    createHandwritingEngine(container, {});

    expect(container.children).toHaveLength(0);
  });

  it('returns a real engine when the DOM is available', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const engine = createHandwritingEngine(container, {});

    expect(engine).toBeInstanceOf(HandwritingEngineImpl);
    expect(container.querySelector('.hw-root')).toBeTruthy();
    expect(warnSpy).not.toHaveBeenCalled();

    engine.destroy();
    container.remove();
  });
});
