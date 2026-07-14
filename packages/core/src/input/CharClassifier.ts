import type { CharClass } from '../types';

// Pre-compiled regexes (Unicode property escapes are not free).
const RE_HAN = /\p{Script=Han}/u;
const RE_LATN = /\p{Script=Latn}/u;
const RE_ND = /\p{Nd}/u;
const RE_PUNCT = /\p{P}/u;
const RE_PICTO = /\p{Extended_Pictographic}/u;
const RE_WHITESPACE = /^\s$/su;

const isFlagCp = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff;

/**
 * Classifies a grapheme cluster into a rendering class. The renderer uses the
 * class to pick the cell shape and the animation strategy.
 *
 * Order matters: emoji is checked before Han (a ZWJ sequence may contain Han
 * components in rare cases), and Han/digit before Latin so fullwidth forms route
 * correctly. Newlines beat the generic `\s` whitespace check.
 */
export class CharClassifier {
  classify(cluster: string): CharClass {
    if (
      cluster === '\n' ||
      cluster === '\r' ||
      cluster === ' ' ||
      cluster === ' '
    ) {
      return 'newline';
    }
    if (RE_WHITESPACE.test(cluster)) return 'space';
    if (this.isEmoji(cluster)) return 'emoji';
    if (RE_HAN.test(cluster)) return 'hanzi';
    if (RE_ND.test(cluster)) return 'digit';
    if (RE_LATN.test(cluster)) return 'latin';
    if (RE_PUNCT.test(cluster)) return 'punct';
    return 'fallback';
  }

  private isEmoji(cluster: string): boolean {
    if (RE_PICTO.test(cluster)) return true;
    // Regional-indicator flags (🇨🇳) are not "pictographic" — detect by code point.
    for (const ch of cluster) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined && isFlagCp(cp)) return true;
    }
    return false;
  }
}
