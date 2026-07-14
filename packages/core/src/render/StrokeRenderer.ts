import type { Cell } from './CellFactory';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Draws Latin / digit / punct / fallback characters as SVG `<text>` and animates
 * the glyph outline with `stroke-dashoffset` — a tegaki-style "drawn stroke by
 * stroke" effect. The browser supplies the glyph; `pathLength="100"` normalizes
 * the dash so every glyph draws 0% → 100%. Stroke order follows the font's
 * internal outline (not calligraphically correct, but visibly hand-drawn).
 *
 * `currentColor` is resolved to the cell's computed color.
 */
export class StrokeRenderer {
  constructor(
    private getDuration: () => number,
    private getColor: () => string,
  ) {}

  async render(cell: Cell, instant: boolean): Promise<number> {
    const duration = instant ? 0 : Math.max(0, this.getDuration());
    const color = this.resolveColor(cell);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'hw-stroke-svg');
    svg.setAttribute('overflow', 'visible');

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', '0');
    text.setAttribute('y', '0.8em');
    text.setAttribute('font-size', '1em');
    text.setAttribute('font-family', 'inherit');
    text.setAttribute('fill', color);
    text.setAttribute('stroke', color);
    text.setAttribute('stroke-width', '0.05em');
    text.setAttribute('stroke-linecap', 'round');
    text.setAttribute('stroke-linejoin', 'round');
    text.setAttribute('pathLength', '100');
    text.textContent = cell.char;
    svg.appendChild(text);

    cell.visual.replaceChildren(svg);

    // Fit the SVG viewport to the glyph so its intrinsic width matches the char.
    try {
      const b = text.getBBox();
      if (b.width > 0 && b.height > 0) {
        const pad = Math.max(2, b.height * 0.12);
        svg.setAttribute(
          'viewBox',
          `${b.x - pad} ${b.y - pad} ${b.width + 2 * pad} ${b.height + 2 * pad}`,
        );
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
    } catch {
      // getBBox unavailable — accept default sizing.
    }

    if (duration <= 0) {
      text.style.strokeDashoffset = '0';
      text.style.fillOpacity = '1';
      return 0;
    }

    // Draw the outline stroke-by-stroke, then fade the fill in near the end.
    text.style.fillOpacity = '0';
    text.style.strokeDasharray = '100';
    text.style.strokeDashoffset = '100';
    void text.getBoundingClientRect(); // force reflow so the transition runs
    const fillDelay = Math.round(duration * 0.6);
    text.style.transition = `stroke-dashoffset ${duration}ms ease-in-out, fill-opacity ${Math.round(
      duration * 0.4,
    )}ms ease-out ${fillDelay}ms`;
    text.style.strokeDashoffset = '0';
    text.style.fillOpacity = '1';

    return new Promise<number>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        text.style.transition = '';
        resolve(duration);
      };
      text.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, duration + 120);
    });
  }

  private resolveColor(cell: Cell): string {
    const c = this.getColor();
    if (c !== 'currentColor') return c;
    try {
      return getComputedStyle(cell.el).color || '#333333';
    } catch {
      return '#333333';
    }
  }
}
