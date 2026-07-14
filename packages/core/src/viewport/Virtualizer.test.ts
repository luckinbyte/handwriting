import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cell, CellState, HanziWriterHandle } from '../render/CellFactory';
import { Virtualizer } from './Virtualizer';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeCell(opts: {
  cls?: Cell['cls'];
  char?: string;
  state?: CellState;
  withWriter?: boolean;
  withSvg?: boolean;
} = {}): Cell {
  const el = document.createElement('span');
  const visual = document.createElement('span');
  el.appendChild(visual);
  if (opts.withSvg) visual.appendChild(document.createElementNS(SVG_NS, 'svg'));
  const cell: Cell = {
    el,
    visual,
    cls: opts.cls ?? 'hanzi',
    char: opts.char ?? '永',
    state: opts.state ?? 'static',
  };
  if (opts.withWriter) {
    cell.writer = { pauseAnimation: vi.fn(), showCharacter: vi.fn(() => Promise.resolve()) };
  }
  return cell;
}

describe('Virtualizer.recycle', () => {
  it('releases the writer but keeps the static SVG (glyph unchanged)', () => {
    const v = new Virtualizer({ enabled: false });
    const cell = makeCell({ withWriter: true, withSvg: true });
    v.recycle(cell);

    expect(cell.state).toBe('recycled');
    expect(cell.writer).toBeUndefined();
    expect(cell.visual.children).toHaveLength(1); // SVG preserved
    expect(cell.el.hasAttribute('data-recycled')).toBe(true);
    expect(cell.el.classList.contains('hw-cell--recycled')).toBe(false); // no styling class
  });

  it('pauses the writer before releasing it', () => {
    const v = new Virtualizer({ enabled: false });
    const cell = makeCell({ withWriter: true, withSvg: true });
    const pause = cell.writer!.pauseAnimation as ReturnType<typeof vi.fn>;
    v.recycle(cell);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('is idempotent', () => {
    const v = new Virtualizer({ enabled: false });
    const cell = makeCell({ withWriter: true, withSvg: true });
    v.recycle(cell);
    v.recycle(cell);
    expect(cell.state).toBe('recycled');
    expect(cell.visual.children).toHaveLength(1); // SVG still preserved
  });

  it('skips layout-only cells (space/newline: visual === el) and preserves their text', () => {
    const v = new Virtualizer({ enabled: false });
    const el = document.createElement('span');
    el.textContent = ' ';
    const cell: Cell = { el, visual: el, cls: 'space', char: ' ', state: 'static' };
    v.recycle(cell);
    expect(cell.state).toBe('static');
    expect(el.textContent).toBe(' ');
  });
});

describe('Virtualizer.observe (disabled)', () => {
  it('observe() and disconnect() are safe no-ops when disabled', () => {
    const v = new Virtualizer({ enabled: false });
    const cell = makeCell({ withSvg: true });
    expect(() => v.observe(cell)).not.toThrow();
    expect(() => v.disconnect()).not.toThrow();
    expect(cell.state).toBe('static'); // not recycled by a disabled observer
  });
});

describe('Virtualizer.observe (IntersectionObserver path)', () => {
  type FakeIOInstance = {
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  const g = globalThis as { IntersectionObserver?: unknown };
  const prevIO = g.IntersectionObserver;
  let callback: ((entries: Array<{ target: Element; isIntersecting: boolean }>) => void) | null = null;
  let instance: FakeIOInstance;
  const observed = new Set<Element>();

  beforeEach(() => {
    callback = null;
    observed.clear();
    instance = {
      observe: vi.fn((t: Element) => void observed.add(t)),
      unobserve: vi.fn((t: Element) => void observed.delete(t)),
      disconnect: vi.fn(() => observed.clear()),
    };
    g.IntersectionObserver = vi.fn((cb: typeof callback) => {
      callback = cb;
      return instance;
    });
  });

  afterEach(() => {
    g.IntersectionObserver = prevIO;
  });

  it('recycles a static cell once it leaves the live window, then unobserves it', () => {
    const v = new Virtualizer(); // enabled: FakeIO is present
    const cell = makeCell({ withWriter: true, withSvg: true });
    v.observe(cell);
    expect(observed.has(cell.el)).toBe(true);

    callback!([{ target: cell.el, isIntersecting: false }]);
    expect(cell.state).toBe('recycled');
    expect(instance.unobserve).toHaveBeenCalledWith(cell.el);
  });

  it('ignores entries that are still intersecting', () => {
    const v = new Virtualizer();
    const cell = makeCell({ withSvg: true });
    v.observe(cell);
    callback!([{ target: cell.el, isIntersecting: true }]);
    expect(cell.state).toBe('static');
  });

  it('observe() ignores layout-only and non-static cells', () => {
    const v = new Virtualizer();
    const spaceEl = document.createElement('span');
    const space: Cell = { el: spaceEl, visual: spaceEl, cls: 'space', char: ' ', state: 'static' };
    const animating = makeCell({ withSvg: true, state: 'animating' });
    v.observe(space);
    v.observe(animating);
    expect(observed.size).toBe(0);
  });
});
