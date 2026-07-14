import { describe, expect, it, vi } from 'vitest';
import type { Cell, CellState } from '../render/CellFactory';
import type { HanziWriterHandle } from '../render/CellFactory';
import { Snapshot } from './Snapshot';

function makeCell(opts: { state?: CellState; writer?: HanziWriterHandle } = {}): Cell {
  const el = document.createElement('span');
  const visual = document.createElement('span');
  el.appendChild(visual);
  const cell: Cell = {
    el,
    visual,
    cls: 'hanzi',
    char: '永',
    state: opts.state ?? 'animating',
  };
  if (opts.writer) cell.writer = opts.writer;
  return cell;
}

const fakeWriter = () => ({
  pauseAnimation: vi.fn(),
  showCharacter: vi.fn((o?: { duration?: number }) => {
    expect(o).toEqual({ duration: 0 });
    return Promise.resolve();
  }),
});

describe('Snapshot', () => {
  it('freezes a finished hanzi cell and marks it static', () => {
    const writer = fakeWriter();
    const cell = makeCell({ writer });
    new Snapshot().toStatic(cell);

    expect(writer.pauseAnimation).toHaveBeenCalledTimes(1);
    expect(writer.showCharacter).toHaveBeenCalledWith({ duration: 0 });
    expect(cell.state).toBe('static');
  });

  it('is a no-op for cells without a writer (stroke/fade)', () => {
    const cell = makeCell({ writer: undefined });
    new Snapshot().toStatic(cell);
    expect(cell.state).toBe('static');
  });

  it('does not refreeze an already-settled cell', () => {
    const writer = fakeWriter();
    const cell = makeCell({ writer, state: 'animating' });
    const snap = new Snapshot();
    snap.toStatic(cell); // animating → static, freezes once
    snap.toStatic(cell); // already static → skipped
    expect(writer.pauseAnimation).toHaveBeenCalledTimes(1);
    expect(writer.showCharacter).toHaveBeenCalledTimes(1);
    expect(cell.state).toBe('static');
  });

  it('leaves recycled cells untouched', () => {
    const writer = fakeWriter();
    const cell = makeCell({ writer, state: 'recycled' });
    new Snapshot().toStatic(cell);
    expect(writer.pauseAnimation).not.toHaveBeenCalled();
    expect(cell.state).toBe('recycled');
  });

  it('tolerates a writer that throws on pause/show', () => {
    const writer = {
      pauseAnimation: vi.fn(() => {
        throw new Error('boom');
      }),
      showCharacter: vi.fn(() => {
        throw new Error('boom');
      }),
    };
    const cell = makeCell({ writer });
    expect(() => new Snapshot().toStatic(cell)).not.toThrow();
    expect(cell.state).toBe('static');
  });
});
