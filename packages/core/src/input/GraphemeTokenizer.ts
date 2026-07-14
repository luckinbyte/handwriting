import type { HandwritingErrorEvent } from '../types';

export interface GraphemeToken {
  cluster: string;
}

export type SegmentErrorHandler = (err: HandwritingErrorEvent) => void;

/**
 * Splits an incrementally-arriving byte/text stream into grapheme clusters.
 *
 * LLM token boundaries do NOT align with character boundaries — a flag emoji
 * `🇨🇳` may arrive as `🇨` + `🇳`, or a surrogate pair may be split in half. This
 * class buffers the trailing segment and only emits clusters that are certain
 * to be complete, flushing the remainder on `flush()` (end of stream).
 */
export class GraphemeTokenizer {
  private buffer = '';
  private segmenter: Intl.Segmenter | null = null;
  private readonly useFallback: boolean;
  private readonly onSegmentError?: SegmentErrorHandler;

  constructor(opts?: { locale?: string | string[]; onSegmentError?: SegmentErrorHandler }) {
    this.onSegmentError = opts?.onSegmentError;
    try {
      this.segmenter = new Intl.Segmenter(opts?.locale ?? [], { granularity: 'grapheme' });
      this.useFallback = false;
    } catch {
      this.useFallback = true;
    }
  }

  /** Feed a chunk. Yields complete grapheme clusters; keeps a possibly-partial tail buffered. */
  *feed(chunk: string): Generator<GraphemeToken> {
    if (!chunk) return;
    this.buffer += chunk;
    if (this.useFallback) {
      yield* this.emitByCodePoint(this.buffer);
      this.buffer = '';
      return;
    }
    const segments = [...this.segmenter!.segment(this.buffer)];
    if (segments.length === 0) return;

    const last = segments[segments.length - 1];
    const tailMayBePartial = this.mayBePartialEmoji(last.segment);
    const safeCount = tailMayBePartial ? segments.length - 1 : segments.length;

    for (let i = 0; i < safeCount; i++) {
      yield { cluster: segments[i].segment };
    }
    this.buffer = tailMayBePartial ? last.segment : '';
  }

  /** Flush whatever remains at end of stream. */
  *flush(): Generator<GraphemeToken> {
    if (!this.buffer) return;
    if (this.useFallback) {
      yield* this.emitByCodePoint(this.buffer);
    } else {
      try {
        for (const s of this.segmenter!.segment(this.buffer)) yield { cluster: s.segment };
      } catch (err) {
        // Lone surrogates etc. — emit the raw buffer so the classifier can fall back.
        this.onSegmentError?.({
          err: err as Error,
          phase: 'segment',
        });
        yield { cluster: this.buffer };
      }
    }
    this.buffer = '';
  }

  /**
   * True when a cluster could be the prefix of a longer emoji.
   * - An odd run of regional indicators is half a flag (waits for its pair).
   * - A trailing ZWJ / variation selector / skin-tone could extend further.
   * A complete flag (even run) or a pictograph not ending in a joiner is emitted.
   */
  private mayBePartialEmoji(cluster: string): boolean {
    let regionalCount = 0;
    let lastCp = 0;
    for (const ch of cluster) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      if (cp >= 0x1f1e6 && cp <= 0x1f1ff) regionalCount++;
      lastCp = cp;
    }
    if (regionalCount % 2 === 1) return true;
    if (
      lastCp === 0x200d || // ZWJ
      lastCp === 0xfe0f || // VS-16
      lastCp === 0xfe0e || // VS-15
      (lastCp >= 0x1f3fb && lastCp <= 0x1f3ff) // skin-tone
    ) {
      return true;
    }
    return false;
  }

  /** Degraded path: split by code point (surrogates kept intact; lone surrogates pass through). */
  private *emitByCodePoint(text: string): Generator<GraphemeToken> {
    for (const ch of text) yield { cluster: ch };
  }
}
