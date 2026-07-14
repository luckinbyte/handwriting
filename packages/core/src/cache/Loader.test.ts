import { describe, expect, it, vi } from 'vitest';
import type { CharacterJson } from '../types';
import { CharDataLoader } from './Loader';
import { Prefetcher } from './Prefetcher';

const json = (n = 1): CharacterJson => ({ strokes: [`M${n}`], medians: [] });
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('CharDataLoader', () => {
  it('returns synchronously on cache hit after a fetch', async () => {
    const load = vi.fn(async () => json(1));
    const loader = new CharDataLoader({ cdnBase: '', memoryCacheSize: 8, loadCharData: load });
    await loader.fetch('你');
    expect(loader.get('你')).toEqual(json(1));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('dedups concurrent requests for the same char', async () => {
    const load = vi.fn(async () => json(1));
    const loader = new CharDataLoader({ cdnBase: '', memoryCacheSize: 8, loadCharData: load });
    await Promise.all([loader.fetch('你'), loader.fetch('你'), loader.fetch('你')]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('serves repeat fetches from cache without re-loading', async () => {
    const load = vi.fn(async () => json(1));
    const loader = new CharDataLoader({ cdnBase: '', memoryCacheSize: 8, loadCharData: load });
    await loader.fetch('你');
    await loader.fetch('你');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('hanzi-writer loader returns sync object on hit, void on miss', async () => {
    const load = vi.fn(async () => json(7));
    const loader = new CharDataLoader({ cdnBase: '', memoryCacheSize: 8, loadCharData: load });
    await loader.fetch('永'); // warm the cache
    const hw = loader.toHanziWriterLoader();

    expect(hw('永', () => {}, () => {})).toEqual(json(7)); // synchronous hit
    expect(hw('新', () => {}, () => {})).toBeUndefined(); // void → resolves via callbacks

    await flush();
    expect(load).toHaveBeenCalledTimes(2); // 永 (warm) + 新 (miss)
  });
});

describe('Prefetcher', () => {
  it('prefetches each unique char once', async () => {
    const load = vi.fn(async (c: string) => json(c.charCodeAt(0)));
    const loader = new CharDataLoader({ cdnBase: '', memoryCacheSize: 8, loadCharData: load });
    const pf = new Prefetcher(loader);
    pf.prefetch(['你', '好']);
    pf.prefetch(['你', '世']); // 你 already requested → deduped
    await flush();
    expect(load).toHaveBeenCalledTimes(3); // 你 好 世
  });
});
