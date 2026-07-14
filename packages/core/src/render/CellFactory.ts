import type { CharClass } from '../types';

/** Minimal view of a HanziWriter instance, for pause/snapshot/teardown. */
export interface HanziWriterHandle {
  pauseAnimation(): unknown;
  showCharacter(opts?: { duration?: number }): Promise<unknown>;
}

/**
 * Virtualization lifecycle of a cell:
 *  - `animating` — just created, render in flight (or instant pending settle);
 *  - `static`    — finished; {@link ../viewport/Snapshot} froze the pose;
 *  - `recycled`  — scrolled out of view; {@link ../viewport/Virtualizer} dropped
 *                  the visual layer, leaving only the readable `.hw-text`.
 */
export type CellState = 'animating' | 'static' | 'recycled';

/** A rendered character cell. */
export interface Cell {
  /** `.hw-cell` root element, appended to the sandbox. */
  el: HTMLElement;
  /** Animation layer mount point (HanziWriter SVG, stroke SVG, or fade text). */
  visual: HTMLElement;
  cls: CharClass;
  char: string;
  /** Set by HanziRenderer so the lifecycle layer can pause/snapshot/teardown. */
  writer?: HanziWriterHandle;
  /** Current virtualization state; advanced by Snapshot (→static) / Virtualizer (→recycled). */
  state: CellState;
}

/**
 * Builds cells per character class. Every animatable class (hanzi, latin, digit,
 * punct, emoji, fallback) is dual-tracked: a hidden `.hw-text` carrying the real
 * character (selectable / Ctrl+F / copy / a11y) plus a `.hw-visual` layer that
 * the renderer paints into. `space` and `newline` are layout-only.
 */
export class CellFactory {
  create(char: string, cls: CharClass): Cell {
    const el = document.createElement('span');
    el.className = `hw-cell hw-cell--${cls}`;
    el.dataset.char = char;

    if (cls === 'newline') {
      el.appendChild(document.createElement('br'));
      return { el, visual: el, cls, char, state: 'static' };
    }
    if (cls === 'space') {
      el.textContent = char;
      return { el, visual: el, cls, char, state: 'static' };
    }

    const text = document.createElement('span');
    text.className = 'hw-text';
    text.textContent = char;

    const visual = document.createElement('span');
    visual.className = 'hw-visual';

    el.appendChild(text);
    el.appendChild(visual);
    el.setAttribute('aria-label', char);
    if (cls === 'hanzi') el.setAttribute('role', 'text');

    return { el, visual, cls, char, state: 'animating' };
  }
}
