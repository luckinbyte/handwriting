import type { CharacterJson } from '../types';
import { CharDataCache } from './CharDataCache';

export interface LoaderOptions {
  cdnBase: string;
  memoryCacheSize: number;
  /** Custom loader overriding the CDN (e.g. self-hosted data). */
  loadCharData?: (char: string) => CharacterJson | Promise<CharacterJson>;
}

/**
 * Resolves character stroke data with a three-tier strategy:
 *   L1 memory cache (sync) → custom loader or CDN (async) → backfill L1.
 *
 * Concurrent requests for the same character are deduplicated.
 *
 * `toHanziWriterLoader()` adapts this into hanzi-writer's `charDataLoader`
 * signature so a cache hit follows hanzi-writer's synchronous fast path.
 */
export class CharDataLoader {
  readonly cache: CharDataCache;
  private inflight = new Map<string, Promise<CharacterJson>>();

  constructor(private opts: LoaderOptions) {
    this.cache = new CharDataCache(opts.memoryCacheSize);
  }

  /** Synchronous L1 lookup. */
  get(char: string): CharacterJson | undefined {
    return this.cache.get(char);
  }

  /** Async fetch with L1 → source → backfill, deduping concurrent calls. */
  async fetch(char: string): Promise<CharacterJson> {
    const cached = this.cache.get(char);
    if (cached) return cached;

    const existing = this.inflight.get(char);
    if (existing) return existing;

    const promise = this.loadFromSource(char)
      .then((data) => {
        this.cache.set(char, data);
        this.inflight.delete(char);
        return data;
      })
      .catch((err) => {
        this.inflight.delete(char);
        throw err;
      });

    this.inflight.set(char, promise);
    return promise;
  }

  private async loadFromSource(char: string): Promise<CharacterJson> {
    if (this.opts.loadCharData) return await this.opts.loadCharData(char);
    const url = `${this.opts.cdnBase}${encodeURIComponent(char)}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load char data for "${char}" (${res.status})`);
    return (await res.json()) as CharacterJson;
  }

  /** hanzi-writer-compatible charDataLoader: sync hit, else async via callbacks. */
  toHanziWriterLoader(): (
    char: string,
    onLoad: (data: CharacterJson) => void,
    onError: (err: unknown) => void,
  ) => CharacterJson | Promise<CharacterJson> | void {
    return (char, onLoad, onError) => {
      const cached = this.get(char);
      if (cached) return cached;
      this.fetch(char).then(onLoad).catch(onError);
      // Returning void tells hanzi-writer to wait for onLoad/onError.
      return;
    };
  }
}
