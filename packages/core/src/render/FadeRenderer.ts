import type { Cell } from './CellFactory';

/** Fades a cell in via CSS opacity (used for emoji, where an outline stroke would look wrong). */
export class FadeRenderer {
  constructor(private getDuration: () => number) {}

  async render(cell: Cell, instant: boolean): Promise<number> {
    const el = cell.visual;
    if (!el.textContent) el.textContent = cell.char;

    const duration = instant ? 0 : Math.max(0, this.getDuration());
    if (duration <= 0) {
      el.style.opacity = '1';
      return 0;
    }
    el.style.opacity = '0';
    el.style.transition = `opacity ${duration}ms ease-out`;
    void el.getBoundingClientRect?.(); // force reflow
    el.style.opacity = '1';

    return new Promise<number>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.style.transition = '';
        resolve(duration);
      };
      el.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, duration + 60);
    });
  }
}
