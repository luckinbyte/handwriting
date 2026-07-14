// Side-effect entry: importing `@handwriting/wc/auto` registers the element.
// The main entry (`@handwriting/wc`) is side-effect-free.
import { defineHandwritingStream } from './define';

defineHandwritingStream();
