# diagram-render

make-pdf と /diagram のためのオフラインの図の描画。`dist/diagram-render.html`(約 9MB)という、自己完結した 1 つの HTML ページです。mermaid、excalidraw のエクスポート用ユーティリティ、そして公式の mermaid→excalidraw 変換器が、このページにバンドルされています。呼び出し元は、`lib/aside-render.ts`(make-pdf が組み込んでいる TypeScript の API)か、`bin/gstack-render.ts`(/diagram スキルが実行する CLI)を通してこのページを開きます。Aside ブラウザが起動していればそこで、起動していなければ gstack 独自のヘッドレスブラウザ(browse デーモン)で開きます。CLI の 1 行目の `ENGINE=` が、どちらを使ったかを示します。どちらの場合も、描画の 1 回ごとに、そのページのディレクトリを 127.0.0.1 で配信します。`--eval` はページの API を呼び出し、`--out` は各結果を外に書き出します(文字列はそのまま、データ URL はバイトとして)。

ビルドされたページは**コミットされています**(eng-review D2)。そのため、インストール時も描画時もネットワークなしで動作し、`./setup` には npm のサプライチェーンの攻撃対象がありません。ドリフトのテスト(`test/diagram-render-drift.test.ts`)は、`dist/` が手で編集された場合や、`BUILD_INFO.json` と食い違った場合に CI を失敗させます。

## ページの API(window の関数)

| 関数 | 入力 → 出力 |
|---|---|
| `__renderMermaid(id, text)` | mermaid のテキスト → SVG の文字列。`id` はフェンスごとに一意でなければなりません(`mermaid-fence-<n>`)。内部のすべての SVG の id の名前空間になります。 |
| `__mermaidToExcalidraw(text)` | mermaid のテキスト → `.excalidraw` のシーン JSON(フローチャートとシーケンス図は、編集可能な要素になります。ほかの種類は 1 つの画像の要素にフォールバックし、コンソールに `Error processing Mermaid diagram` と出力します)。 |
| `__excalidrawToSvg(sceneJson)` | シーン JSON → SVG の文字列(Excalifont を埋め込み、オフラインで動作)。 |
| `__rasterize(svg, targetWidthPx)` | SVG → PNG のデータ URL。DPI の計算は呼び出し側が行います。`targetWidthPx = 配置された幅(インチ) × 300`。汚染されたキャンバスでは例外を投げます。 |
| `__downscaleRaster(dataUri, targetWidthPx, mime)` | ラスターのデータ URI → `targetWidthPx` の、より小さいデータ URI(同じ mime)。make-pdf は、大きすぎる写真を印刷の解像度に揃えるためにこれを使います。 |
| `__mountForScreenshot(svg, px)` | 汚染に強いフォールバック。SVG を `#raster-stage` にマウントし、`gstack-render --screenshot out.png --selector '#raster-stage'` で使えるようにします。 |
| `__probeImage(src)` | データ URI/URL → `{width, height}` の JSON。 |
| `__bundleInfo` | `{ name, deps }` — ビルド時に埋め込まれた、固定された依存関係のバージョン。 |

準備完了の判定: `#status` のテキストが `ready` になるまでポーリングします(または `gstack-render ... --wait-selector '#done'`)。
ページのエラーは `window.__errors` に蓄積されます。

## 更新

```bash
# 1. edit the exact pin in package.json
cd lib/diagram-render && bun install
# 2. rebuild (deterministic; build twice → same sha)
bun run build
# 3. commit package.json + bun.lock + dist/ together
```

描画の契約の詳細(securityLevel strict、htmlLabels false、印刷用 CSS のフォントの固定、`<base href>` と `</scri` のエスケープ)は、`src/entry.ts` と `scripts/build.ts` に書かれています。どちらかに触れる前に、両方を読んでください。
