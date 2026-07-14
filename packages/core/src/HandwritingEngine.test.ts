import { describe, expect, it } from 'vitest';
import { HandwritingEngineImpl } from './HandwritingEngine';
import { resolveConfig } from './presets';

describe('HandwritingEngine virtualization wiring', () => {
  it('settles streamed cells without recycling them while virtualization is off', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const engine = new HandwritingEngineImpl(container, {
      virtualization: { enabled: false },
    });
    engine.push('Hi', { instant: true });
    engine.done();
    await engine.idle();

    const cells = container.querySelectorAll('.hw-cell');
    expect(cells.length).toBeGreaterThan(0);
    // Observer is disabled → nothing should have been recycled.
    expect(container.querySelectorAll('.hw-cell--recycled').length).toBe(0);

    engine.destroy();
    expect(container.querySelector('.hw-root')).toBeNull();
    container.remove();
  });

  it('clear() resets the sandbox and a fresh stream renders again', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const engine = new HandwritingEngineImpl(container, { virtualization: { enabled: false } });

    engine.push('A', { instant: true });
    engine.done();
    await engine.idle();
    expect(container.querySelectorAll('.hw-cell').length).toBe(1);

    engine.clear();
    expect(container.querySelectorAll('.hw-cell').length).toBe(0);

    engine.push('BC', { instant: true });
    engine.done();
    await engine.idle();
    expect(container.querySelectorAll('.hw-cell').length).toBe(2);

    engine.destroy();
    container.remove();
  });
});

describe('resolveConfig virtualization defaults', () => {
  it('fills in default rootMargin when only `enabled` is provided', () => {
    const cfg = resolveConfig({ virtualization: { enabled: false } });
    expect(cfg.virtualization.enabled).toBe(false);
    expect(cfg.virtualization.rootMargin).toBe('100% 0px');
  });

  it('keeps virtualization enabled by default', () => {
    expect(resolveConfig().virtualization.enabled).toBe(true);
  });
});
