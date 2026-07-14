import { describe, expect, it } from 'vitest';
import type { CharacterJson } from '../types';
import { CharDataCache } from './CharDataCache';

const json = (n = 1): CharacterJson => ({ strokes: [`M${n}`], medians: [] });

describe('CharDataCache', () => {
  it('stores and retrieves', () => {
    const c = new CharDataCache(2);
    c.set('你', json(1));
    expect(c.get('你')).toEqual(json(1));
    expect(c.has('我')).toBe(false);
  });

  it('evicts least-recently-used when over capacity', () => {
    const c = new CharDataCache(2);
    c.set('你', json(1));
    c.set('好', json(2));
    c.set('世', json(3)); // evicts 你
    expect(c.has('你')).toBe(false);
    expect(c.has('好')).toBe(true);
    expect(c.has('世')).toBe(true);
  });

  it('refreshes recency on get', () => {
    const c = new CharDataCache(2);
    c.set('你', json(1));
    c.set('好', json(2));
    c.get('你'); // 你 is now most-recent
    c.set('世', json(3)); // evicts 好 instead of 你
    expect(c.has('你')).toBe(true);
    expect(c.has('好')).toBe(false);
  });
});
