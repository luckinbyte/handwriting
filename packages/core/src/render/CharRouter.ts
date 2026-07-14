import type { CharClass, HandwritingErrorEvent } from '../types';
import type { RenderTask, TaskRenderer } from '../scheduler/Scheduler';
import type { Cell, CellFactory } from './CellFactory';
import type { FadeRenderer } from './FadeRenderer';
import type { HanziRenderMode, HanziRenderer } from './HanziRenderer';
import type { StrokeRenderer } from './StrokeRenderer';

export interface CharRouterHooks {
  onCharRendered?: (char: string, cls: CharClass, index: number, duration: number) => void;
  onError?: (e: HandwritingErrorEvent) => void;
  /** Returns true when global state forces instant rendering (reduced motion / flush). */
  shouldInstant?: () => boolean;
  /** A cell entered the animating set. */
  onCellActive?: (cell: Cell) => void;
  /** A cell left the animating set (settled or failed). */
  onCellIdle?: (cell: Cell) => void;
}

/**
 * Adapts the pure Scheduler to the DOM. Routes each character class to its renderer:
 *  - hanzi            → HanziRenderer (true stroke order)
 *  - latin/digit/punct/fallback → StrokeRenderer (tegaki-style outline draw)
 *  - emoji            → FadeRenderer (color glyphs shouldn't be stroked)
 *  - space/newline    → no animation
 * Hanzi failures degrade to the stroke renderer (still "drawn"), then fade.
 */
export class CharRouter implements TaskRenderer {
  constructor(
    private readonly cellFactory: CellFactory,
    private readonly container: HTMLElement,
    private readonly hanzi: HanziRenderer,
    private readonly fade: FadeRenderer,
    private readonly stroke: StrokeRenderer,
    private readonly hooks: CharRouterHooks = {},
  ) {}

  async start(task: RenderTask): Promise<number> {
    const cell = this.cellFactory.create(task.char, task.cls);
    this.container.appendChild(cell.el);
    this.hooks.onCellActive?.(cell);

    const forcedInstant = task.instant || this.hooks.shouldInstant?.() === true;
    const hanziMode: HanziRenderMode = forcedInstant
      ? 'instant'
      : task.boost
        ? 'boost'
        : 'normal';
    let duration = 0;

    try {
      switch (task.cls) {
        case 'hanzi':
          duration = await this.hanzi.render(cell, task.char, hanziMode);
          break;
        case 'space':
        case 'newline':
          duration = 0;
          break;
        case 'emoji':
          duration = await this.fade.render(cell, forcedInstant);
          break;
        default: // latin / digit / punct / fallback
          duration = await this.stroke.render(cell, forcedInstant);
      }
    } catch (err) {
      // Hanzi failed (lib missing / char data unavailable) → try stroke, then fade.
      try {
        if (task.cls === 'hanzi') duration = await this.stroke.render(cell, forcedInstant);
        else throw err;
      } catch {
        if (cell.visual.textContent === '') cell.visual.textContent = task.char;
        duration = await this.fade.render(cell, true).catch(() => 0);
      }
      this.hooks.onError?.({ err: err as Error, char: task.char, phase: 'render' });
    } finally {
      this.hooks.onCellIdle?.(cell);
    }

    this.hooks.onCharRendered?.(task.char, task.cls, task.index, duration);
    return duration;
  }
}
