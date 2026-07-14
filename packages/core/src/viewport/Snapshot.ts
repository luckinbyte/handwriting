import type { Cell } from '../render/CellFactory';

/**
 * Settles a finished cell into a cost-free static pose.
 *
 * hanzi-writer has no `destroy()`, and a completed character may still hold an
 * internal rAF loop. The cheapest "done" state is to stop that loop
 * (`pauseAnimation()`) and lock the final pose (`showCharacter({duration:0})`).
 * For stroke/fade cells — which settle via one-shot CSS transitions and keep no
 * JS animator — there is no writer, so this is an idempotent no-op.
 *
 * This is the `animating → done(static)` leg of the virtualization state machine
 * (`pending → animating → done(static) → recycled`); the `done → recycled` leg
 * lives in {@link Virtualizer}.
 */
export class Snapshot {
  /**
   * Freeze a finished cell into its final pose and halt its animator.
   * Safe to call multiple times — only the first call (while still `animating`)
   * does any work.
   */
  toStatic(cell: Cell): void {
    if (cell.state !== 'animating') return; // already settled (static/recycled)
    this.freeze(cell);
    cell.state = 'static';
  }

  private freeze(cell: Cell): void {
    const writer = cell.writer;
    if (!writer) return; // stroke/fade: nothing to stop

    // Stop the rAF loop synchronously (the memory goal), then re-affirm the
    // completed pose. The character is already fully drawn by the time we reach
    // here (called after the render promise resolved), so neither call changes
    // what's on screen.
    try {
      writer.pauseAnimation();
    } catch {
      /* noop */
    }
    try {
      void Promise.resolve(writer.showCharacter({ duration: 0 })).catch(() => {});
    } catch {
      /* noop */
    }
  }
}
