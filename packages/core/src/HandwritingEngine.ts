import { CharClassifier } from './input/CharClassifier';
import { GraphemeTokenizer } from './input/GraphemeTokenizer';
import { CharDataLoader } from './cache/Loader';
import { Prefetcher } from './cache/Prefetcher';
import { realClock, Scheduler } from './scheduler/Scheduler';
import type { RenderTask, SchedulerConfig } from './scheduler/Scheduler';
import { CellFactory } from './render/CellFactory';
import type { Cell } from './render/CellFactory';
import { FadeRenderer } from './render/FadeRenderer';
import { HanziRenderer } from './render/HanziRenderer';
import { CharRouter } from './render/CharRouter';
import { StrokeRenderer } from './render/StrokeRenderer';
import { Snapshot } from './viewport/Snapshot';
import { Virtualizer } from './viewport/Virtualizer';
import { TypedEmitter } from './events';
import { prefersReducedMotion } from './env';
import { presets, resolveConfig } from './presets';
import type {
  CharClass,
  HandwritingConfig,
  HandwritingEngine,
  HandwritingErrorEvent,
  HandwritingEventMap,
  HotSwappableConfig,
  PushOptions,
} from './types';

/**
 * Concrete engine: wires tokenizer → classifier → scheduler → router → renderers.
 * Owns a sandbox `<div class="hw-root">` inside the consumer's container.
 */
export class HandwritingEngineImpl
  extends TypedEmitter<HandwritingEventMap>
  implements HandwritingEngine
{
  private config: HandwritingConfig;
  private readonly sandbox: HTMLElement;
  private readonly tokenizer: GraphemeTokenizer;
  private readonly classifier = new CharClassifier();
  private readonly loader: CharDataLoader;
  private readonly prefetcher: Prefetcher;
  private readonly cellFactory = new CellFactory();
  private readonly hanzi: HanziRenderer;
  private readonly fade: FadeRenderer;
  private readonly stroke: StrokeRenderer;
  private readonly router: CharRouter;
  private readonly scheduler: Scheduler;
  private readonly activeCells = new Set<Cell>();
  private readonly snapshot = new Snapshot();
  private readonly virtualizer: Virtualizer;

  private charIndex = 0;
  private pending = 0;
  private streamDone = false;
  private completed = false;
  private destroyed = false;
  private forceInstant = false; // reduced-motion: render without animation
  private flushDrain = false; // flush(): instant + fast drain
  private idleResolve?: () => void;

  constructor(container: HTMLElement, config?: Partial<HandwritingConfig>) {
    super();
    this.config = resolveConfig(config);

    this.sandbox = document.createElement('div');
    this.sandbox.className = 'hw-root';
    this.sandbox.setAttribute('aria-live', 'polite');
    container.appendChild(this.sandbox);

    if (this.config.respectReducedMotion && prefersReducedMotion()) {
      this.forceInstant = true;
    }

    this.virtualizer = new Virtualizer({
      root: null, // observe against the browser viewport (page-scroll by default)
      rootMargin: this.config.virtualization.rootMargin,
      enabled: this.config.virtualization.enabled,
    });

    this.loader = new CharDataLoader({
      cdnBase: this.config.cdnBase,
      memoryCacheSize: this.config.memoryCacheSize,
      loadCharData: this.config.loadCharData,
    });
    this.prefetcher = new Prefetcher(this.loader);
    this.tokenizer = new GraphemeTokenizer({ onSegmentError: (e) => this.emit('error', e) });

    this.hanzi = new HanziRenderer(this.loader, () => ({
      strokeColor: this.config.strokeColor,
      strokeAnimationSpeed: this.config.strokeAnimationSpeed,
      delayBetweenStrokes: this.config.delayBetweenStrokes,
      renderer: this.config.renderer,
    }));
    this.fade = new FadeRenderer(() => this.config.fadeDuration);
    this.stroke = new StrokeRenderer(
      () => this.config.strokeDuration,
      () => this.config.strokeColor,
    );

    this.router = new CharRouter(this.cellFactory, this.sandbox, this.hanzi, this.fade, this.stroke, {
      shouldInstant: () => this.forceInstant || this.flushDrain,
      onCharRendered: (char, cls, index, duration) =>
        this.onCharRendered(char, cls, index, duration),
      onError: (e: HandwritingErrorEvent) => this.emit('error', e),
      onCellActive: (cell) => this.activeCells.add(cell),
      onCellIdle: (cell) => this.onCellSettled(cell),
    });

    this.scheduler = new Scheduler(this.router, realClock, () => this.schedulerConfig(), {
      onCatchUpChange: (active, backlog) => this.emit('catchupchange', { active, backlog }),
    });
  }

  private schedulerConfig(): SchedulerConfig {
    if (this.flushDrain) {
      return {
        interCharDelay: 0,
        overlap: true,
        maxConcurrent: this.config.maxConcurrent,
        catchUpThreshold: 0,
        catchUpDuration: 0,
      };
    }
    const c = this.config;
    return {
      interCharDelay: c.interCharDelay,
      overlap: c.overlap,
      maxConcurrent: c.maxConcurrent,
      catchUpThreshold: c.catchUpThreshold,
      catchUpDuration: c.catchUpDuration,
    };
  }

  push(text: string, opts?: PushOptions): void {
    if (this.destroyed) return;
    const sourceInstant = opts?.instant === true;
    for (const tok of this.tokenizer.feed(text)) {
      this.enqueueCluster(tok.cluster, sourceInstant);
    }
  }

  done(): void {
    if (this.destroyed || this.streamDone) return;
    for (const tok of this.tokenizer.flush()) this.enqueueCluster(tok.cluster, false);
    this.streamDone = true;
    this.checkComplete();
  }

  flush(): void {
    if (this.destroyed) return;
    this.flushDrain = true;
    for (const tok of this.tokenizer.flush()) this.enqueueCluster(tok.cluster, true);
    this.scheduler.setPaused(false);
  }

  idle(): Promise<void> {
    if (this.streamDone && this.pending === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const prev = this.idleResolve;
      this.idleResolve = () => {
        resolve();
        prev?.();
      };
    });
  }

  setConfig(patch: HotSwappableConfig): void {
    const next = patch.preset;
    const presetRhythm =
      next !== undefined && next !== this.config.preset && next !== 'custom'
        ? presets[next]
        : null;
    this.config = { ...this.config, ...(presetRhythm ?? {}), ...patch };
    this.emit('configchange', { patch });
  }

  getConfig(): Readonly<HandwritingConfig> {
    return this.config;
  }

  pause(): void {
    this.scheduler.setPaused(true);
    for (const cell of this.activeCells) cell.writer?.pauseAnimation();
  }

  resume(): void {
    this.scheduler.setPaused(false);
  }

  isPaused(): boolean {
    return this.scheduler.isPaused();
  }

  clear(): void {
    this.scheduler.clear();
    for (const cell of this.activeCells) cell.writer?.pauseAnimation();
    this.activeCells.clear();
    this.virtualizer.disconnect(); // drop observations on cells we're about to remove
    this.sandbox.replaceChildren();
    this.pending = 0;
    this.charIndex = 0;
    this.streamDone = false;
    this.completed = false;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scheduler.setPaused(true);
    for (const cell of this.activeCells) cell.writer?.pauseAnimation();
    this.activeCells.clear();
    this.virtualizer.disconnect();
    this.sandbox.remove();
    this.emit('destroy', undefined);
  }

  private enqueueCluster(cluster: string, sourceInstant: boolean): void {
    const cls = this.classifier.classify(cluster);
    this.emit('graphemequeued', { cluster, cls });
    if (cls === 'hanzi') this.prefetcher.prefetch([cluster]);
    const task: RenderTask = {
      char: cluster,
      cls,
      index: this.charIndex++,
      instant: false,
      sourceInstant,
      boost: false,
    };
    this.pending++;
    this.scheduler.enqueue(task);
  }

  private onCharRendered(char: string, cls: CharClass, index: number, duration: number): void {
    this.pending--;
    this.emit('charrendered', { char, cls, index, duration });
    this.checkComplete();
  }

  /**
   * A cell finished rendering (or degraded). Freeze it into its static pose
   * (stops any lingering hanzi-writer rAF) and hand it to the virtualizer so it
   * can be reclaimed to text-only once it scrolls out of view.
   */
  private onCellSettled(cell: Cell): void {
    this.activeCells.delete(cell);
    this.snapshot.toStatic(cell);
    this.virtualizer.observe(cell);
  }

  private checkComplete(): void {
    if (this.streamDone && this.pending === 0 && !this.completed) {
      this.completed = true;
      this.idleResolve?.();
      this.idleResolve = undefined;
      this.emit('complete', { total: this.charIndex });
    }
  }
}
