<!-- AUTO-GENERATED from pretext-patterns.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
### Pretext の配線パターン

Step 2 で選んだ階層に基づいて、これらのパターンを使います。これらは正しい Pretext API の使い方のパターンです。
そのとおりに従ってください。

**パターン 1: 基本的な高さの計算 (シンプルなレイアウト、カード/グリッド)**
```js
import { prepare, layout } from '@chenglou/pretext'
// Vanilla HTML: omit the import; this code follows the inlined bundle in the same <script type="module">

// 1. PREPARE — one-time, after fonts load
await document.fonts.ready
const elements = document.querySelectorAll('[data-pretext]')
const prepared = new Map()

for (const el of elements) {
  const text = el.textContent
  const font = getComputedStyle(el).font
  prepared.set(el, prepare(text, font))
}

// 2. LAYOUT — cheap, call on every resize
function relayout() {
  for (const [el, handle] of prepared) {
    const { height } = layout(handle, el.clientWidth, parseFloat(getComputedStyle(el).lineHeight))
    el.style.height = `${height}px`
  }
}

// 3. RESIZE-AWARE
new ResizeObserver(() => relayout()).observe(document.body)
relayout()

// 4. CONTENT-EDITABLE — re-prepare when text changes
for (const el of elements) {
  if (el.contentEditable === 'true') {
    new MutationObserver(() => {
      const font = getComputedStyle(el).font
      prepared.set(el, prepare(el.textContent, font))
      relayout()
    }).observe(el, { characterData: true, subtree: true, childList: true })
  }
}
```

**パターン 2: シュリンクラップ / ぴったり収まるコンテナ (チャットの吹き出し)**
```js
import { prepareWithSegments, walkLineRanges } from '@chenglou/pretext'

// Tight-fit width: lay out at maxWidth, then shrink the bubble to its widest line
function shrinkwrap(text, font, maxWidth) {
  const segs = prepareWithSegments(text, font)
  let widest = 0
  const lineCount = walkLineRanges(segs, maxWidth, (line) => {
    widest = Math.max(widest, line.width)
  })
  return { width: Math.ceil(widest), lineCount }
}
```

**パターン 3: 障害物の周りのテキスト (エディトリアルのレイアウト)**
```js
import { prepareWithSegments, layoutNextLine } from '@chenglou/pretext'

function layoutAroundObstacles(text, font, containerWidth, lineHeight, obstacles) {
  const segs = prepareWithSegments(text, font)
  let cursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = 0
  const lines = []

  while (true) {
    // Calculate available width at current y position, accounting for obstacles
    let availWidth = containerWidth
    for (const obs of obstacles) {
      if (y >= obs.top && y < obs.top + obs.height) {
        availWidth -= obs.width
      }
    }

    const result = layoutNextLine(segs, cursor, availWidth)
    if (!result) break

    lines.push({ text: result.text, width: result.width, x: 0, y })
    cursor = result.end
    y += lineHeight
  }

  return { lines, totalHeight: y }
}
```

**パターン 4: 行ごとの完全なレンダリング (複雑なエディトリアル)**
```js
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

const segs = prepareWithSegments(text, font)
const { lines, height } = layoutWithLines(segs, containerWidth, lineHeight)

// lines = [{ text, width, start, end }, ...] (no x/y: line i sits at y = i * lineHeight)
// Use for Canvas/SVG rendering or custom DOM positioning
lines.forEach((line, i) => {
  const span = document.createElement('span')
  span.textContent = line.text
  span.style.position = 'absolute'
  span.style.left = '0px'
  span.style.top = `${i * lineHeight}px`
  container.appendChild(span)
})
```

### Pretext API リファレンス

```
PRETEXT API CHEATSHEET:

prepare(text, font) → handle
  One-time text measurement. Call after document.fonts.ready.
  Font: CSS shorthand like '16px Inter' or 'bold 24px Georgia'.

layout(prepared, maxWidth, lineHeight) → { height, lineCount }
  Fast layout computation. Call on every resize. Sub-millisecond.

prepareWithSegments(text, font) → handle
  Like prepare() but enables line-level APIs below.

layoutWithLines(segs, maxWidth, lineHeight) → { lineCount, height, lines: [{text, width, start, end}...] }
  Full line-by-line breakdown (no x/y: line i is at y = i * lineHeight). For Canvas/SVG rendering.

walkLineRanges(segs, maxWidth, onLine) → lineCount
  Calls onLine({ width, start, end }) once per line at maxWidth (no text built).
  The widest line's width is the tight-fit container width. For chat bubbles.

layoutNextLine(segs, cursor, maxWidth) → { text, width, start, end } | null
  Iterator. Different maxWidth per line = text around obstacles.
  Start with cursor { segmentIndex: 0, graphemeIndex: 0 }; pass result.end next.
  Returns null when text is exhausted. Takes no lineHeight: advance y yourself.

clearCache() → void
  Clears internal measurement caches. Use when cycling many fonts.

setLocale(locale?) → void
  Retargets word segmenter for future prepare() calls.
```
