import type { CharClass } from '../types';
import { CatchUpController } from './CatchUpController';
import { ConcurrencyGate } from './ConcurrencyGate';

/** A single character scheduled for rendering. */
export interface RenderTask {
  char: string;
  cls: CharClass;
  index: number;
  /** Truly skip animation (source-instant: code blocks / flush / reduced motion). */
  instant: boolean;
  /** Caller requested instant rendering (e.g. a code block). */
  sourceInstant: boolean;
  /** Catch-up: render with fast-but-visible strokes instead of skipping. */
  boost: boolean;
}

/** Renderer abstraction — the scheduler never touches the DOM. */
export interface TaskRenderer {
  /** Begin rendering; resolves when finished. Returned duration is informational. */
  start(task: RenderTask): Promise<number>;
}

/** Injectable clock so the scheduler is fully deterministic in tests. */
export interface SchedulerClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): () => void;
}

export interface SchedulerConfig {
  interCharDelay: number;
  overlap: boolean;
  maxConcurrent: number;
  catchUpThreshold: number;
  catchUpDuration: number;
}

export interface SchedulerHooks {
  onCatchUpChange?: (active: boolean, backlog: number) => void;
}

const NO_START = Number.NEGATIVE_INFINITY;

/**
 * The streaming heart of the engine.
 *
 * Producers `enqueue` tasks as characters arrive; the scheduler drains the
 * queue into the renderer subject to:
 *  - `interCharDelay` — minimum gap between task starts (skipped while catching up);
 *  - `overlap` — whether the next task may start before the previous finishes;
 *  - `maxConcurrent` — hard rAF guardrail on simultaneous animations;
 *  - catch-up — when the backlog exceeds the threshold, tasks are *boosted*
 *    (fast-but-visible strokes) and inter-character delay is skipped, so the
 *    stream can't fall further behind WITHOUT erasing the handwriting effect.
 *
 * The scheduler is pure logic: it depends only on the injected renderer and clock.
 */
export class Scheduler {
  private queue: RenderTask[] = [];
  private readonly gate = new ConcurrencyGate(1);
  private readonly catchUp: CatchUpController;
  private lastStart = NO_START;
  private paused = false;

  constructor(
    private readonly renderer: TaskRenderer,
    private readonly clock: SchedulerClock,
    private readonly getConfig: () => SchedulerConfig,
    hooks: SchedulerHooks = {},
  ) {
    this.catchUp = new CatchUpController(() => this.getConfig().catchUpThreshold);
    this.catchUp.onChange = (active, backlog) => hooks.onCatchUpChange?.(active, backlog);
  }

  enqueue(task: RenderTask): void {
    this.queue.push(task);
    // Detect backlog growth immediately — pump() may short-circuit on a full gate
    // and only re-checks on task completion, by which time the backlog may have drained.
    this.catchUp.refresh(this.backlog);
    this.pump();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) this.pump();
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Drop all queued (not yet started) tasks. */
  clear(): void {
    this.queue.length = 0;
  }

  get backlog(): number {
    return this.queue.length + this.gate.count;
  }

  private pump(): void {
    if (this.paused) return;
    if (this.queue.length === 0) return;

    const cfg = this.getConfig();
    this.gate.setMax(cfg.maxConcurrent);
    const limit = cfg.overlap ? cfg.maxConcurrent : 1;
    if (this.gate.count >= limit) return;

    const catching = this.catchUp.refresh(this.backlog);

    // Inter-character delay (skipped while catching up to maximize throughput).
    if (this.lastStart !== NO_START && !catching) {
      const wait = cfg.interCharDelay - (this.clock.now() - this.lastStart);
      if (wait > 0) {
        this.clock.setTimeout(() => this.pump(), wait);
        return;
      }
    }

    this.startNext(catching);
  }

  private startNext(catching: boolean): void {
    const task = this.queue.shift();
    if (!task) return;
    // sourceInstant (code block) wins → truly no animation. Otherwise catch-up → boost.
    if (task.sourceInstant) task.instant = true;
    else if (catching) task.boost = true;
    this.gate.acquire();
    this.lastStart = this.clock.now();
    this.renderer
      .start(task)
      .then(() => this.onTaskSettled())
      .catch(() => this.onTaskSettled());

    // In overlap mode, try to start more up to the concurrency limit.
    if (this.getConfig().overlap) this.pump();
  }

  private onTaskSettled(): void {
    this.gate.release();
    this.catchUp.refresh(this.backlog);
    if (!this.paused) this.pump();
  }
}

/** Default clock backed by the host. */
export const realClock: SchedulerClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const id = globalThis.setTimeout(fn, ms);
    return () => globalThis.clearTimeout(id);
  },
};
