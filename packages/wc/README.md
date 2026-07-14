# @handwriting/wc

`<handwriting-stream>` — a Web Component wrapping
[`@handwriting/core`](../core) for streaming handwriting animation.

## Install

```bash
pnpm add @handwriting/wc @handwriting/core
```

Import the styles once (the element does not inject CSS):

```ts
import '@handwriting/core/styles.css'
```

## Usage

Register the element, then drop it in and drive it:

```html
<handwriting-stream></handwriting-stream>
```

```ts
// register (side-effect entry — one-liner):
import '@handwriting/wc/auto'
// or explicitly: import { defineHandwritingStream } from '@handwriting/wc'; defineHandwritingStream()

const el = document.querySelector('handwriting-stream')!
el.config = { preset: 'auto' }
el.push('你好 hello')
el.done()
```

Light DOM (no Shadow): the element is the engine's container, so text stays
selectable / searchable / copyable. Engine events are re-emitted as bubbling
`CustomEvent`s prefixed `hw-` (`hw-charrendered`, `hw-complete`, `hw-error`, …).

The `preset` attribute is reflected (`<handwriting-stream preset="fluid">`),
and `el.text = '...'` is a convenience that clears, pushes, and completes.
