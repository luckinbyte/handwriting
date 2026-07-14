import type { CharacterJson } from '../types';
import type { CharDataLoader } from '../cache/Loader';
import type { Cell, HanziWriterHandle } from './CellFactory';

/** How a Hanzi character should be drawn. */
export type HanziRenderMode = 'normal' | 'boost' | 'instant';

interface HanziWriterOptions {
  width?: number;
  height?: number;
  padding?: number;
  showOutline?: boolean;
  showCharacter?: boolean;
  strokeColor?: string;
  strokeAnimationSpeed?: number;
  delayBetweenStrokes?: number;
  renderer?: 'svg' | 'canvas';
  charDataLoader?: (
    char: string,
    onLoad: (data: CharacterJson) => void,
    onError: (err: unknown) => void,
  ) => CharacterJson | Promise<CharacterJson> | void;
}

interface HanziWriterInstance extends HanziWriterHandle {
  animateCharacter(opts?: { onComplete?: (r: { canceled: boolean }) => void }): Promise<{
    canceled: boolean;
  }>;
}

interface HanziWriterCtor {
  create(target: HTMLElement | string, char: string, options: HanziWriterOptions): HanziWriterInstance;
}

export interface HanziRenderOptions {
  strokeColor: string;
  strokeAnimationSpeed: number;
  delayBetweenStrokes: number;
  renderer: 'svg' | 'canvas';
}

/** Stroke speed multiplier used while catching up — fast, but strokes still visible. */
const BOOST_SPEED_MULT = 3;

/**
 * The only module that touches hanzi-writer. The library is dynamically imported
 * so Latin-only consumers never download it. Data loading is delegated to the
 * shared CharDataLoader (L1 cache → CDN).
 *
 * Render modes:
 *  - `normal` — full-speed stroke animation;
 *  - `boost`  — catch-up: animation sped up (strokes still visible), no inter-stroke delay;
 *  - `instant` — skip animation entirely (code blocks / flush / reduced motion).
 *
 * hanzi-writer has no `destroy()` — callers must `pauseAnimation()` and remove
 * the cell DOM to release the instance.
 */
export class HanziRenderer {
  private libPromise: Promise<HanziWriterCtor> | null = null;

  constructor(
    private readonly loader: CharDataLoader,
    private readonly getOpts: () => HanziRenderOptions,
  ) {}

  async preloadLibrary(): Promise<void> {
    await this.ensureLib();
  }

  async render(cell: Cell, char: string, mode: HanziRenderMode = 'normal'): Promise<number> {
    const HW = await this.ensureLib();
    const o = this.getOpts();
    const boosted = mode === 'boost';
    // hanzi-writer rejects the CSS keyword `currentColor`; resolve it to the
    // cell's computed color so strokes still follow the surrounding text.
    let strokeColor = o.strokeColor;
    if (strokeColor === 'currentColor') {
      try {
        strokeColor = getComputedStyle(cell.el).color || '#333333';
      } catch {
        strokeColor = '#333333';
      }
    }
    const writer = HW.create(cell.visual, char, {
      width: 100,
      height: 100,
      padding: 0,
      showOutline: false,
      showCharacter: false,
      strokeColor,
      strokeAnimationSpeed: Math.max(
        0.01,
        o.strokeAnimationSpeed * (boosted ? BOOST_SPEED_MULT : 1),
      ),
      delayBetweenStrokes: boosted ? 0 : Math.max(0, o.delayBetweenStrokes),
      renderer: o.renderer,
      charDataLoader: this.loader.toHanziWriterLoader(),
    });
    cell.writer = writer;
    // Ensure the SVG scales to fill the 1em cell. Without a viewBox, CSS
    // width/height:100% would crop instead of scale.
    const svg = cell.visual.querySelector('svg');
    if (svg && !svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 100 100');

    if (mode === 'instant') {
      await writer.showCharacter({ duration: 0 });
      return 0;
    }
    const start = Date.now();
    await writer.animateCharacter();
    return Date.now() - start;
  }

  private async ensureLib(): Promise<HanziWriterCtor> {
    if (!this.libPromise) {
      this.libPromise = import('hanzi-writer')
        .then((mod) => {
          const m = mod as unknown as { default?: HanziWriterCtor; HanziWriter?: HanziWriterCtor };
          const HW = m.default ?? m.HanziWriter;
          if (!HW) throw new Error('hanzi-writer: could not resolve HanziWriter export');
          return HW;
        })
        .catch((err) => {
          this.libPromise = null;
          throw err;
        });
    }
    return this.libPromise;
  }
}
