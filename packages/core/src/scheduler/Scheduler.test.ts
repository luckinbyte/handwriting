import { describe, expect, it } from 'vitest';
import type { RenderTask, SchedulerClock, SchedulerConfig, TaskRenderer } from './Scheduler';
import { Scheduler } from './Scheduler';

const task = (char: string, index: number, sourceInstant = false): RenderTask => ({
  char,
  cls: 'hanzi',
  index,
  instant: false,
  sourceInstant,
  boost: false,
});

// Let pending promise-chain microtasks drain.
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

class FakeClock implements SchedulerClock {
  t = 0;
  private timers: { at: number; fn: () => void }[] = [];
  now(): number {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number): () => void {
    const entry = { at: this.t + ms, fn };
    this.timers.push(entry);
    return () => {
      this.timers = this.timers.filter((x) => x !== entry);
    };
  }
  advance(ms: number): void {
    const target = this.t + ms;
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at);
      const next = this.timers.find((x) => x.at <= target);
      if (!next) break;
      this.timers = this.timers.filter((x) => x !== next);
      this.t = next.at;
      next.fn();
    }
    this.t = target;
  }
}

class FakeRenderer implements TaskRenderer {
  started: RenderTask[] = [];
  pending: { resolve: (n: number) => void }[] = [];
  start(t: RenderTask): Promise<number> {
    this.started.push(t);
    return new Promise<number>((resolve) => {
      this.pending.push({ resolve });
    });
  }
  completeNext(duration = 10): void {
    this.pending.shift()?.resolve(duration);
  }
}

const base = (over: Partial<SchedulerConfig> = {}): SchedulerConfig => ({
  interCharDelay: 0,
  overlap: false,
  maxConcurrent: 8,
  catchUpThreshold: 999,
  catchUpDuration: 0,
  ...over,
});

describe('Scheduler', () => {
  it('runs tasks strictly serially when overlap is false', async () => {
    const clock = new FakeClock();
    const renderer = new FakeRenderer();
    const sched = new Scheduler(renderer, clock, () => base());
    sched.enqueue(task('A', 0));
    sched.enqueue(task('B', 1));
    sched.enqueue(task('C', 2));

    await flush();
    expect(renderer.started.map((x) => x.char)).toEqual(['A']);
    expect(renderer.pending.length).toBe(1);

    renderer.completeNext();
    await flush();
    expect(renderer.started.map((x) => x.char)).toEqual(['A', 'B']);

    renderer.completeNext();
    await flush();
    expect(renderer.started.map((x) => x.char)).toEqual(['A', 'B', 'C']);

    renderer.completeNext();
    await flush();
    expect(renderer.pending.length).toBe(0);
  });

  it('overlaps up to maxConcurrent', async () => {
    const clock = new FakeClock();
    const renderer = new FakeRenderer();
    const sched = new Scheduler(renderer, clock, () => base({ overlap: true, maxConcurrent: 2 }));
    sched.enqueue(task('A', 0));
    sched.enqueue(task('B', 1));
    sched.enqueue(task('C', 2));

    await flush();
    expect(renderer.started.map((x) => x.char)).toEqual(['A', 'B']);
    expect(renderer.pending.length).toBe(2);

    renderer.completeNext();
    await flush();
    expect(renderer.started.map((x) => x.char)).toEqual(['A', 'B', 'C']);
  });

  it('respects interCharDelay between starts (serial)', async () => {
    const clock = new FakeClock();
    const renderer = new FakeRenderer();
    const sched = new Scheduler(renderer, clock, () => base({ interCharDelay: 100 }));
    sched.enqueue(task('A', 0));
    sched.enqueue(task('B', 1));

    await flush();
    expect(renderer.started.map((x) => x.char)).toEqual(['A']);

    renderer.completeNext();
    await flush();
    // B is gated behind a 100ms timer that hasn't fired yet.
    expect(renderer.started.map((x) => x.char)).toEqual(['A']);

    clock.advance(100);
    await flush();
    expect(renderer.started.map((x) => x.char)).toEqual(['A', 'B']);
  });

  it('boosts tasks (fast strokes, not instant) while backlog exceeds threshold', async () => {
    const clock = new FakeClock();
    const renderer = new FakeRenderer();
    const sched = new Scheduler(renderer, clock, () => base({ catchUpThreshold: 3 }));
    // Queue 5 while paused so the backlog is real when we resume.
    sched.setPaused(true);
    for (let i = 0; i < 5; i++) sched.enqueue(task('x', i));
    sched.setPaused(false);

    await flush();
    // backlog 5 > 3 → first task is boosted, NOT instant (strokes still visible).
    expect(renderer.started[0].boost).toBe(true);
    expect(renderer.started[0].instant).toBe(false);

    renderer.completeNext();
    await flush();
    // backlog still 4 > 3 → next still boosted.
    expect(renderer.started[1].boost).toBe(true);
  });

  it('honors sourceInstant (truly instant) even under backlog', async () => {
    const clock = new FakeClock();
    const renderer = new FakeRenderer();
    const sched = new Scheduler(renderer, clock, () => base({ catchUpThreshold: 2 }));
    sched.setPaused(true);
    sched.enqueue(task('A', 0, true)); // sourceInstant
    sched.enqueue(task('B', 1));
    sched.enqueue(task('C', 2));
    sched.setPaused(false);

    await flush();
    expect(renderer.started[0].instant).toBe(true);
    expect(renderer.started[0].boost).toBe(false);
  });

  it('fires onCatchUpChange on transitions only', async () => {
    const clock = new FakeClock();
    const renderer = new FakeRenderer();
    const events: boolean[] = [];
    const cfg = base({ catchUpThreshold: 2 });
    const sched = new Scheduler(renderer, clock, () => cfg, {
      onCatchUpChange: (active) => events.push(active),
    });
    sched.enqueue(task('A', 0));
    sched.enqueue(task('B', 1));
    sched.enqueue(task('C', 2));
    await flush();
    expect(events).toContain(true);

    for (let i = 0; i < 3; i++) {
      renderer.completeNext();
      await flush();
    }
    expect(events).toContain(false);
  });

  it('does not advance while paused', async () => {
    const clock = new FakeClock();
    const renderer = new FakeRenderer();
    const sched = new Scheduler(renderer, clock, () => base());
    sched.setPaused(true);
    sched.enqueue(task('A', 0));
    await flush();
    expect(renderer.started.length).toBe(0);

    sched.setPaused(false);
    await flush();
    expect(renderer.started.length).toBe(1);
  });
});
