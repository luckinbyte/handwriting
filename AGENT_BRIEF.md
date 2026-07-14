# 给 AI 编程 Agent 的接入简报 — `@handwriting/*`

> 把整段贴进 AI 编程 agent（Claude Code / Cursor / Copilot 等）的 prompt，或把本文件交给它读。照做即可正确接入「中文真笔顺 + 一笔一划流式手写」效果。

## 这是什么
`@handwriting/*` 把（LLM）流式文本变成「一笔一划手写动画」的前端库：**中文走 [hanzi-writer](https://github.com/chanind/hanzi-writer) 真笔顺逐字逐笔写出**，英文 / 数字 / 标点 tegaki 风格描边，emoji 渐显。纯 TS 核心 `@handwriting/core`，可选 `@handwriting/react`（hook）/ `@handwriting/wc`（Web Component）。动画下藏一层真实文本 → 可选中、搜索、复制、读屏。

## ⚠️ 接入前必须知道的 4 个坑（否则第一步就失败）

1. **它不在 npm 上。** `pnpm add @handwriting/core` / `npm i @handwriting/core` 会失败 —— **不要用 npm 安装它**。
2. **不要用 `esm.sh` / `unpkg` / jsdelivr 等 CDN import。** 它们只镜像已发布的 npm 包，本项目从不上 npm。
3. **仓库里的 `dist/` 被 `.gitignore`，GitHub 上没有构建产物。** 不能从 GitHub 直接拷 `dist/` 用 —— 必须 clone 后 `pnpm build` 本地生成。
4. **要中文真笔顺，必须额外装 `hanzi-writer`。** 它被标成 optional peer（纯英文可不装），但渲染中文必装，否则中文字画不出来。

## 正确接入步骤

```bash
# 1) 克隆并构建（dist 只在本地生成）
git clone <本项目 GitHub 地址>
cd handwriting && pnpm install && pnpm build
```

在你的项目里让包名可解析（二选一）：

**A) 本地路径依赖：**
```jsonc
// 你的项目 package.json
"dependencies": {
  "@handwriting/core": "file:../handwriting/packages/core",
  "@handwriting/react": "file:../handwriting/packages/react",   // 用 React 才加
  "hanzi-writer": "^3.7.0"                                       // 渲染中文必装
}
```

**B) 打包器别名直引源码（跳过 build，让 bundler 编译 TS）：**
```ts
// vite.config.ts
resolve: { alias: { '@handwriting/core': '../handwriting/packages/core/src/index.ts' } }
// 别忘了 pnpm add hanzi-writer
```

## 最小可用代码

```ts
import { createHandwritingEngine } from '@handwriting/core'
import '@handwriting/core/styles.css'   // 必须引入一次样式，否则无外观

const engine = createHandwritingEngine(document.getElementById('reader')!)
engine.push('你好 hello 🎉')
engine.done()
```

**接 LLM 流**：任何上游（SSE / WebSocket / fetch stream）都归约成 `engine.push(chunk)`，chunk 把字腰斩了也没事（内部 grapheme 安全切分）：
```ts
const reader = res.body!.getReader(), dec = new TextDecoder()
while (true) {
  const { value, done } = await reader.read()
  if (done) { engine.done(); break }
  engine.push(dec.decode(value, { stream: true }))
}
```

## 三种框架用法
- **任意框架 / 纯 TS**：`createHandwritingEngine(container)` → `push()` / `done()` / `flush()` / `pause()` / `clear()`。
- **React**：`const engine = useHandwritingEngine(ref, { preset: 'auto' })`，卸载自动 destroy，config 变化热切换。
- **Web Component**：`import '@handwriting/wc/auto'` → `<handwriting-stream>`，`el.push()` / `el.done()` / `el.text = '整段'`，属性 `preset` 反射，事件 `hw-complete` / `hw-error` 等。

## 关键配置（都有默认值，按需调）
- `preset: 'auto' | 'fluid' | 'realistic' | 'custom'` —— 智能追速 / 流畅交叠 / 写实串行；运行时 `engine.setConfig({ preset })` 热切换。
- `strokeColor` 默认 `currentColor`（跟随容器文字色）；改字号用容器 CSS `font-size`。
- **笔顺数据默认从 jsdelivr CDN 拉（Make me a Hanzi）** —— 运行环境要能访问该 CDN，否则中文字画不出；可用 `cdnBase` 改自托管。
- 默认尊重系统 `prefers-reduced-motion` → 全瞬时。

## 验证效果
想先看效果：在克隆下来的仓库里 `pnpm install && pnpm demo` → http://localhost:5173（`/`、`/react.html`、`/wc.html`）。

## 已知边界（非 bug）
- 常见字笔顺完美；**字库里没有的生僻字会自动降级为渐显**，不报错不中断。
- SSR 安全：服务端渲染返回 no-op，不报错。

## ❌ → ✅ 常见错误速查
| 错误 | 原因 | 正解 |
| --- | --- | --- |
| `pnpm add @handwriting/core` 失败 | 不在 npm | 本地路径 / 别名引用 |
| `esm.sh` / CDN import 失败 | 同上 | 同上 |
| 元素出现但无样式 | 忘了引入 CSS | `import '@handwriting/core/styles.css'` |
| 中文字空白 | 没装 `hanzi-writer` | `pnpm add hanzi-writer` |
| 中文字仍空白（装了 hanzi-writer） | 屏蔽了 jsdelivr CDN | `cdnBase` 改自托管数据 |
| 从 GitHub 拷 `dist/` 没东西 | `dist` 被 gitignore | clone 后 `pnpm build` |
