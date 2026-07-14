# handwriting

> 把 LLM 流式输出变成「一笔一划手写」的前端库。
> 中文走 [hanzi-writer](https://github.com/chanind/hanzi-writer) 真笔顺逐字逐笔写出，英文/数字/标点 tegaki 风格描边，emoji 渐显——中英混排统一在一个流式调度器下。

框架无关的纯 TS 核心（`@handwriting/core`），可选 React hook（`@handwriting/react`）和 Web Component（`@handwriting/wc`）适配。任意上游流（SSE / WebSocket / fetch stream）都归约成一个 `push(text)`。

> 🤖 **用 AI 编程 agent 接入本项目？** 见 [`AGENT_BRIEF.md`](./AGENT_BRIEF.md) —— 一段可直接贴进 agent prompt 的接入简报（含取库方式、必装依赖、常见坑）。

---

## 它能做什么

- **真笔顺手写**：中文按真实笔顺一笔一划写出（hanzi-writer + Make me a Hanzi 数据）
- **逐字符调度**：英文 / 数字 / 标点逐笔描边、emoji 渐显，流式追加不重播
- **双轨文本层**：动画下面藏一层真实文本 → **能鼠标选中、Ctrl+F 搜索、复制粘贴、读屏**（普通 SVG 手写做不到的它都做到了）
- **grapheme 安全**：用 `Intl.Segmenter` 切字素，emoji / ZWJ / 生僻字不会被 LLM 的 chunk 腰斩成乱码
- **节奏可调**：预设 `auto`（智能追速）/ `fluid`（流畅交叠）/ `realistic`（写实串行）/ `custom`，运行时热切换
- **追速不掉笔画**：积压时加速但保留笔顺，不直接跳过
- **无障碍**：默认尊重 `prefers-reduced-motion` → 全瞬时
- **零负担**：hanzi-writer 动态 `import()`，纯英文项目永不下载它和字数据
- **缓存**：内存 LRU + CDN，同一个字第二次 0 网络请求
- **长文虚拟化**：完成的字滚出视口自动回收 hanzi-writer 实例（字形不变），几千字长文滚动流畅
- **SSR 安全**：服务端渲染返回 no-op，不报错
- **生僻字降级**：无笔画数据的字自动改渐显并报错，绝不中断流

## 获取与安装

> 本项目**不发布到 npm**，从 GitHub 克隆后在你的项目里本地引用。`react` / `wc` 都依赖 `core`，用到哪个引用哪个。

**1. 克隆并构建**（构建产物仅在本地生成，仓库里不提交 `dist/`）：

```bash
git clone <本项目 GitHub 地址>     # ← 替换成你的仓库地址
cd handwriting
pnpm install
pnpm build                          # 生成 packages/*/dist
```

**2. 让包名在你的项目里可解析**（任选一种）：

- **本地路径依赖**（`pnpm` / `npm` 都支持，最省心）：

```jsonc
// 你的项目 package.json
"dependencies": {
  "@handwriting/core": "file:../handwriting/packages/core",
  "@handwriting/react": "file:../handwriting/packages/react",   // 用 React 才加
  "hanzi-writer": "^3.7.0"                                       // 渲染中文必装，见下
}
```

- **打包器别名直引源码**（跳过 `pnpm build`，让 Vite / Webpack 自己编译 TS）：

```ts
// vite.config.ts
resolve: { alias: { '@handwriting/core': '../handwriting/packages/core/src/index.ts' } }
```

**peer 依赖**：
- `@handwriting/core`：`hanzi-writer`（标注为可选 peer，但**要中文真笔顺就必须装**，否则中文字画不出来；仅纯英文可不装）
- `@handwriting/react`：`react` / `react-dom` `^18 || ^19`

每种用法都要引入一次样式（库本身不注入 CSS）：`import '@handwriting/core/styles.css'`。

## 快速开始

### 1) 纯 TS / 任意框架

```ts
import { createHandwritingEngine } from '@handwriting/core'
import '@handwriting/core/styles.css'

const engine = createHandwritingEngine(document.getElementById('reader')!)

engine.push('你好 hello 🎉')
engine.done() // 标记流结束
```

### 2) React

```tsx
import { useRef } from 'react'
import { useHandwritingEngine } from '@handwriting/react'
import '@handwriting/core/styles.css'

function Writer() {
  const ref = useRef<HTMLDivElement>(null)
  // 挂载后返回 engine；卸载自动 destroy；config 变化热切换、不重建引擎
  const engine = useHandwritingEngine(ref, { preset: 'auto' })
  return (
    <>
      <div ref={ref} />
      <button onClick={() => engine?.push('你好 hello')}>写</button>
      <button onClick={() => engine?.done()}>结束</button>
    </>
  )
}
```

### 3) Web Component（任意框架 / 无框架）

```html
<script type="module">
  import '@handwriting/wc/auto' // 注册 <handwriting-stream>
  import '@handwriting/core/styles.css'
</script>

<handwriting-stream></handwriting-stream>
```

```ts
const el = document.querySelector('handwriting-stream')!
el.push('你好 hello') // 也可 el.text = '整段静态文本'（clear + push + done）
el.done()
el.setAttribute('preset', 'fluid') // 属性反射进引擎
el.addEventListener('hw-complete', () => console.log('done'))
```

## 接入 LLM 流

任何上游流都归约成 `push(text)`——`push` 内部做 grapheme 切分 + 缓冲，chunk 把字腰斩了也没事：

```ts
const res = await fetch('/api/chat', { method: 'POST', body: '…' })
const reader = res.body!.getReader()
const decoder = new TextDecoder()

while (true) {
  const { value, done } = await reader.read()
  if (done) { engine.done(); break }
  engine.push(decoder.decode(value, { stream: true }))
}
```

## 配置

`createHandwritingEngine(container, config?)`，常用字段（都有默认值，可不传）：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `preset` | `'auto'` | `'auto'` 智能追速 / `'fluid'` 流畅交叠 / `'realistic'` 写实串行 / `'custom'` |
| `strokeColor` | `'currentColor'` | 笔画颜色，跟随容器文字色 |
| `strokeAnimationSpeed` | `1` | 中文笔画速度倍率 |
| `fadeDuration` / `strokeDuration` | `120` / `450` | 非汉字渐显 / 描边时长（ms） |
| `interCharDelay` / `overlap` | `0` / `false` | 起字间隔 / 是否允许相邻字交叠 |
| `catchUpThreshold` | `40` | 积压超此字数 → 自动追速 |
| `maxConcurrent` | `8` | 同时动画上限（rAF 护栏） |
| `renderer` | `'svg'` | `'svg'`（文本可选）/ `'canvas'`（更快但不可选） |
| `respectReducedMotion` | `true` | 尊重系统减少动效偏好 |
| `cdnBase` | jsdelivr | 字数据 CDN，可改自托管 |
| `loadCharData` | — | 自定义取字数据（同步返回 = 缓存命中、零延迟） |
| `virtualization` | `{ enabled: true, rootMargin: '100% 0px' }` | 长文虚拟化 |

运行时热切换可变字段：`engine.setConfig({ preset: 'fluid' })`。

## API

```ts
engine.push(text, { instant? }) // 喂文本；instant = true 跳过动画
engine.done()                    // 标记流结束（触发 complete）
engine.flush()                   // 一步跳到最终态
engine.idle()                    // Promise<void>：队列空 + 动画完
engine.pause() / resume() / isPaused()
engine.clear() / destroy()
engine.setConfig(patch) / getConfig()
engine.on(type, cb) / once / off // on 返回 unsubscribe
```

事件：`charrendered` · `graphemequeued` · `catchupchange` · `configchange` · `error` · `complete` · `destroy`。
Web Component 把它们转发为 `hw-*` 冒泡事件（`hw-complete`、`hw-error`、…）。

## License

- **源码**：MIT
- **中文笔顺数据**：来自 [Make me a Hanzi](https://github.com/skishore/makemeahanzi)（经 hanzi-writer-data），采用 **Arphic Public License**（**非 MIT**）——商用或自托管字数据时需留意该协议

## 现状与路线

- ✅ M0 工程地基 · M1 核心引擎 + vanilla demo · M2 长文虚拟化 · M3 React / Web Component 适配
- ⏳ M4 流式 markdown 高层（段落手写 + 代码块/表格瞬时高亮） · M5 打磨发布（错误重试、文档站、性能基准、a11y 审计）

## 本仓结构

```
packages/
  core/    @handwriting/core   纯 TS 引擎（调度器 / 渲染器 / 缓存 / 虚拟化 / SSR 守卫）
  react/   @handwriting/react  useHandwritingEngine
  wc/      @handwriting/wc     <handwriting-stream>
demo/      vanilla · react · wc 三页 demo
```

跑 demo：`pnpm install && pnpm demo` → http://localhost:5173（`/`、`/react.html`、`/wc.html`）。
