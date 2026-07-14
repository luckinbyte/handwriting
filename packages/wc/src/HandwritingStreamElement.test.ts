import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineHandwritingStream } from './define';
import type { HandwritingStreamElement } from './HandwritingStreamElement';

function makeEl(): HandwritingStreamElement {
  defineHandwritingStream();
  return document.createElement('handwriting-stream') as unknown as HandwritingStreamElement;
}

describe('HandwritingStreamElement', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates the engine on connect (.hw-root appears, getConfig available)', () => {
    const el = makeEl();
    document.body.appendChild(el);
    expect(el.querySelector('.hw-root')).toBeTruthy();
    expect(el.getConfig()).not.toBeNull();
  });

  it('renders cells from a pushed stream', async () => {
    const el = makeEl();
    document.body.appendChild(el);
    el.push('Hi', { instant: true });
    el.done();
    await el.idle();
    expect(el.querySelectorAll('.hw-cell').length).toBeGreaterThan(0);
  });

  it('reflects the preset attribute into the engine config', async () => {
    const el = makeEl();
    document.body.appendChild(el);
    el.setAttribute('preset', 'fluid');
    expect(el.getConfig()?.preset).toBe('fluid');
  });

  it('re-emits engine events as hw-* CustomEvents with detail', async () => {
    const el = makeEl();
    document.body.appendChild(el);
    const seen = vi.fn();
    el.addEventListener('hw-charrendered', seen);
    el.push('A', { instant: true });
    el.done();
    await el.idle();
    expect(seen).toHaveBeenCalled();
    expect((seen.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({ char: 'A' });
  });

  it('events bubble to a parent listener', async () => {
    const parent = document.createElement('div');
    const el = makeEl();
    parent.appendChild(el);
    document.body.appendChild(parent);
    const gotComplete = vi.fn();
    parent.addEventListener('hw-complete', gotComplete);
    el.push('B', { instant: true });
    el.done();
    await el.idle();
    expect(gotComplete).toHaveBeenCalled();
  });

  it('text setter clears, pushes, and completes', async () => {
    const el = makeEl();
    document.body.appendChild(el);
    // Latin/punct path avoids the hanzi char-data network fetch under happy-dom.
    el.text = 'Hi!';
    await el.idle();
    expect(el.querySelectorAll('.hw-cell').length).toBe(3);
    expect(el.text).toBe('Hi!');
  });

  it('destroys the engine on disconnect', async () => {
    const el = makeEl();
    document.body.appendChild(el);
    el.push('C', { instant: true });
    el.done();
    await el.idle();
    expect(el.querySelector('.hw-root')).toBeTruthy();

    el.remove();
    expect(el.querySelector('.hw-root')).toBeNull();
    expect(el.getConfig()).toBeNull();
  });
});
