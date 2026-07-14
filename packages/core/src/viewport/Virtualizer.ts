import type { Cell } from '../render/CellFactory';

export interface VirtualizerOptions {
  /** Scroll container to observe; `null` = the browser viewport. */
  root?: Element | null;
  /** Buffer kept live around the viewport before cells are recycled (IntersectionObserver `rootMargin`). */
  rootMargin?: string;
  /** Disable recycling entirely (also auto-disabled when `IntersectionObserver` is missing). */
  enabled?: boolean;
}

/** Default live window: one viewport-height of headroom above and below. */
export const DEFAULT_ROOT_MARGIN = '100% 0px';

/**
 * Reclaims memory from finished cells once they scroll out of the live window by
 * releasing their hanzi-writer JS instance — the only thing still pinning char
 * data + animation state in the JS heap after {@link Snapshot} froze the pose.
 *
 * The static SVG that carries the handwritten glyph is intentionally KEPT, so a
 * cell's visual never changes when it scrolls out and back (no repaint). The
 * cell element stays in the document, so layout / selection / search / copy all
 * keep working. This trades a larger DOM (the SVG paths remain) for glyph
 * stability — fine up to a few thousand characters; for truly unbounded long-form
 * a scroll-back-rebuild strategy would be needed instead.
 *
 * Only `static` (finished) cells with a real visual layer are processed — never
 * cells mid-animation, and never layout-only cells (space/newline). Backed by
 * `IntersectionObserver`; degrades to a no-op where the API is unavailable, in
 * which case `recycle()` can still be driven by hand.
 *
 * This is the `done(static) → recycled` leg of the state machine; the
 * `animating → done` leg lives in {@link Snapshot}.
 */
export class Virtualizer {
  private readonly io: IntersectionObserver | null;
  private readonly byEl = new WeakMap<Element, Cell>();

  constructor(opts: VirtualizerOptions = {}) {
    const supported = typeof IntersectionObserver !== 'undefined';
    if (opts.enabled === false || !supported) {
      this.io = null;
      return;
    }
    this.io = new IntersectionObserver(
      (entries) => this.onIntersect(entries),
      {
        root: opts.root ?? null,
        rootMargin: opts.rootMargin ?? DEFAULT_ROOT_MARGIN,
        threshold: 0,
      },
    );
  }

  /** Begin tracking a finished cell for off-screen recycling. */
  observe(cell: Cell): void {
    if (!this.io) return;
    if (cell.state !== 'static') return; // only finished cells
    if (cell.visual === cell.el) return; // layout-only (space/newline): nothing to reclaim
    this.byEl.set(cell.el, cell);
    this.io.observe(cell.el);
  }

  /**
   * Reclaim a finished cell's hanzi-writer JS instance once it scrolls out of
   * view. The static SVG (the handwritten glyph) is intentionally KEPT, so the
   * visual never changes when the cell scrolls out and back — only the JS heap
   * reference is released. Public so it is unit-testable / reusable.
   */
  recycle(cell: Cell): void {
    if (cell.state === 'recycled') return; // idempotent
    if (cell.visual === cell.el) return; // layout-only: nothing to reclaim
    if (cell.writer) {
      try {
        cell.writer.pauseAnimation();
      } catch {
        /* noop */
      }
      cell.writer = undefined; // release the hanzi-writer JS instance
    }
    cell.state = 'recycled';
    cell.el.setAttribute('data-recycled', ''); // observable marker (no styling)
  }

  /** Stop observing all targets and release the observer. Safe across clear()/destroy(). */
  disconnect(): void {
    this.io?.disconnect();
  }

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    if (!this.io) return;
    for (const entry of entries) {
      if (entry.isIntersecting) continue; // only recycle when leaving the live window
      const cell = this.byEl.get(entry.target);
      if (!cell || cell.state !== 'static') continue;
      this.recycle(cell);
      this.io.unobserve(entry.target);
    }
  }
}
