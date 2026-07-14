import type { CharDataLoader } from './Loader';

/**
 * Fire-and-forget prefetcher that warms the cache ahead of the playhead.
 * Errors are swallowed here — they resurface at render time for that character.
 */
export class Prefetcher {
  private requested = new Set<string>();

  constructor(private loader: CharDataLoader) {}

  /** Prefetch a batch of characters, deduping against prior requests and the cache. */
  prefetch(chars: string[]): void {
    for (const ch of chars) {
      if (ch.length === 0) continue;
      if (this.requested.has(ch) || this.loader.cache.has(ch)) continue;
      this.requested.add(ch);
      void this.loader.fetch(ch).catch(() => {
        // Allow a retry later if it failed.
        this.requested.delete(ch);
      });
    }
  }
}
