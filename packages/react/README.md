# @handwriting/react

React hook for [`@handwriting/core`](../core) — streaming handwriting animation
(Chinese stroke order via [hanzi-writer](https://github.com/chanind/hanzi-writer)
+ Latin fade).

## Install

```bash
pnpm add @handwriting/react @handwriting/core
# peer: react / react-dom ^18 || ^19
```

Import the styles once (the engine does not inject CSS):

```ts
import '@handwriting/core/styles.css'
```

## Usage

```tsx
import { useRef } from 'react'
import { useHandwritingEngine } from '@handwriting/react'

function Writer() {
  const ref = useRef<HTMLDivElement>(null)
  const engine = useHandwritingEngine(ref, { preset: 'auto' })

  return (
    <>
      <div ref={ref} />
      <button onClick={() => engine?.push('你好 hello')}>write</button>
      <button onClick={() => engine?.done()}>done</button>
    </>
  )
}
```

`useHandwritingEngine` returns `null` before mount (and during SSR), then the live
`HandwritingEngine`. The engine is created on mount and destroyed on unmount.
Hot-swappable `config` fields (rhythm/style) are applied live via `setConfig`
without recreating the engine; construct-time fields (`virtualization`, `cdnBase`,
`loadCharData`, `memoryCacheSize`) are read from the initial config only — change
them by remounting with a `key`.
