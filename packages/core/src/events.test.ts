import { describe, expect, it, vi } from 'vitest';
import { TypedEmitter } from './events';

interface Map {
  a: number;
  b: string;
}

class Sample extends TypedEmitter<Map> {
  fireA() {
    this.emit('a', 1);
  }
  fireB() {
    this.emit('b', 'x');
  }
}

describe('TypedEmitter', () => {
  it('delivers typed events with detail', () => {
    const e = new Sample();
    const cb = vi.fn();
    e.on('a', cb);
    e.fireA();
    expect(cb).toHaveBeenCalledWith(1);
  });

  it('on() returns a working disposer', () => {
    const e = new Sample();
    const cb = vi.fn();
    const off = e.on('a', cb);
    off();
    e.fireA();
    expect(cb).not.toHaveBeenCalled();
  });

  it('off() stops delivery', () => {
    const e = new Sample();
    const cb = vi.fn();
    e.on('a', cb);
    e.off('a', cb);
    e.fireA();
    expect(cb).not.toHaveBeenCalled();
  });

  it('once() fires only once', () => {
    const e = new Sample();
    const cb = vi.fn();
    e.once('a', cb);
    e.fireA();
    e.fireA();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not cross-talk between event types', () => {
    const e = new Sample();
    const cb = vi.fn();
    e.on('a', cb);
    e.fireB();
    expect(cb).not.toHaveBeenCalled();
  });
});
