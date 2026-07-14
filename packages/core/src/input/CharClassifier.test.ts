import { describe, expect, it } from 'vitest';
import { CharClassifier } from './CharClassifier';

const c = new CharClassifier();
const classify = (s: string) => c.classify(s);

describe('CharClassifier', () => {
  it('classifies Han (incl. rare Ext-B)', () => {
    expect(classify('你')).toBe('hanzi');
    expect(classify('永')).toBe('hanzi');
    expect(classify('𠀇')).toBe('hanzi');
  });

  it('classifies Latin (incl. accented)', () => {
    expect(classify('a')).toBe('latin');
    expect(classify('Z')).toBe('latin');
    expect(classify('é')).toBe('latin');
  });

  it('classifies digits (incl. fullwidth / arabic-indic)', () => {
    expect(classify('1')).toBe('digit');
    expect(classify('０')).toBe('digit');
    expect(classify('٠')).toBe('digit'); // arabic-indic zero
  });

  it('classifies punctuation (incl. CJK)', () => {
    expect(classify(',')).toBe('punct');
    expect(classify('。')).toBe('punct');
    expect(classify('！')).toBe('punct');
  });

  it('classifies whitespace vs newlines distinctly', () => {
    expect(classify(' ')).toBe('space');
    expect(classify('\t')).toBe('space');
    expect(classify('\n')).toBe('newline');
    expect(classify(' ')).toBe('newline');
    expect(classify(' ')).toBe('newline');
  });

  it('classifies emoji (pictograph, flag, ZWJ family)', () => {
    expect(classify('👍')).toBe('emoji');
    expect(classify('🇨🇳')).toBe('emoji');
    expect(classify('👨‍👩‍👧')).toBe('emoji');
  });

  it('falls back for lone surrogates / unknown', () => {
    expect(classify('\uD800')).toBe('fallback');
  });
});
