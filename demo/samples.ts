/** Shared sample text for the vanilla / React / Web Component demos. */

export const SAMPLE = `handwriting 是一个把 LLM 流式输出变成"一笔一划手写"的前端库。

中文走 hanzi-writer 的真实笔顺，逐字逐笔地写出来；英文、数字、标点则逐字符渐显，两者统一在同一个流式调度器下。比如这句 Hello World, 你好世界！——中英文混排时节奏一致，不会割裂。

它还支持 emoji 🎉 和 CJK 标点。生僻字（如 𠀇）若没有笔画数据，会自动降级为渐显，绝不中断流。

代码块和表格在 markdown 高层会整体瞬时渲染，不做手写——因为手写代码可读性太差。这里只演示纯文本流式手写。

试试切换右上的节奏预设：auto 是智能追速，realistic 是慢速真笔顺，fluid 是流畅打字机感。你也可以拖动滑块改字号、吐字间隔，或者暂停 / 跳到结尾。`;

// Long-form sample (~10k chars) for the M2 virtualization stress test:
// scroll through it and watch the bottom-right counter — 'writer 已释放' climbs
// as finished cells scroll out of view (their hanzi-writer JS instance is
// reclaimed), while every glyph stays identical (the static SVG is kept).
export const LONG_SAMPLE = `${SAMPLE}\n\n`.repeat(26);
