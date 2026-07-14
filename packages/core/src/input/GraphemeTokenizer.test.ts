import { describe, expect, it } from 'vitest';
import { GraphemeTokenizer } from './GraphemeTokenizer';

const drain = (t: GraphemeTokenizer, ...chunks: string[]): string[] => {
  const out: string[] = [];
  for (const c of chunks) for (const tok of t.feed(c)) out.push(tok.cluster);
  return out;
};

describe('GraphemeTokenizer', () => {
  it('splits basic ASCII', () => {
    const t = new GraphemeTokenizer();
    expect(drain(t, 'Hello')).toEqual(['H', 'e', 'l', 'l', 'o']);
  });

  it('splits CJK one cluster per character', () => {
    const t = new GraphemeTokenizer();
    expect(drain(t, '你好世界')).toEqual(['你', '好', '世', '界']);
  });

  it('buffers a lone regional indicator and emits the flag once paired', () => {
    const t = new GraphemeTokenizer();
    // 🇨🇳 = U+1F1E8 U+1F1F3. Half of a flag is buffered (could be a prefix).
    expect(drain(t, '🇨')).toEqual([]);
    expect(drain(t, '🇳')).toEqual(['🇨🇳']);
  });

  it('keeps a ZWJ family emoji intact when it arrives whole', () => {
    const t = new GraphemeTokenizer();
    const got: string[] = [];
    for (const tok of t.feed('x👨‍👩‍👧y')) got.push(tok.cluster);
    expect(got).toEqual(['x', '👨‍👩‍👧', 'y']);
  });

  it('flush releases a buffered partial tail', () => {
    const t = new GraphemeTokenizer();
    expect(drain(t, '🇨')).toEqual([]);
    const tail: string[] = [];
    for (const tok of t.flush()) tail.push(tok.cluster);
    expect(tail).toEqual(['🇨']);
  });

  it('handles a mixed stream arriving in arbitrary chunks', () => {
    const t = new GraphemeTokenizer();
    // "Hi 你好 🇨🇳!" split mid-emoji on purpose
    expect(drain(t, 'Hi 你好 🇨', '🇳!')).toEqual([
      'H',
      'i',
      ' ',
      '你',
      '好',
      ' ',
      '🇨🇳',
      '!',
    ]);
  });
});
