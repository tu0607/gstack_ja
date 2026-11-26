# Bun ネイティブ版プロンプトインジェクション分類器 — 研究計画

**ステータス:** P3 研究 / 初期プロトタイプ
**ブランチ:** `garrytan/prompt-injection-guard`
**スケルトン:** `browse/src/security-bunnative.ts`
**TODOS の参照先:** "Bun-native 5ms DeBERTa inference (XL, P3 / research)"

## この計画が解決する問題

コンパイル済みの `browse/dist/browse` バイナリは `onnxruntime-node` をリンクできません。Bun の `--compile` は単一ファイルの実行形式を作りますが、依存ライブラリを一時展開ディレクトリから dlopen するため、そのディレクトリからのネイティブ .dylib 読み込みが失敗します(oven-sh/bun#3574、#18079 で報告済み。CEO プランの §Pre-Impl Gate 1 でも確認済み)。

現在の緩和策(branch-2 のアーキテクチャ): ML 分類器は `sidebar-agent.ts`(コンパイルしていない Bun スクリプト)でのみ動き、`@huggingface/transformers` を使います。server.ts(コンパイル済み)には ML がなく、カナリアチェックと構造的な制御(XML フレーミングとコマンドの許可リスト)に頼っています。

branch-2 の問題点: 分類器が調べられるのは sidebar-agent が見たコンテンツだけです。コンパイル済みバイナリの中にとどまるコンテンツ経路(ユーザー入力が外に出ていく途中の部分、カナリアチェックだけの部分)は ML 層を通りません。

Bun ネイティブで、ネイティブモジュールも onnxruntime も使わずにゼロから作る分類器があれば、コンパイル済みバイナリのあらゆる場所で完全な ML 防御を動かせます。

## 目標値

| 指標 | 現在(非コンパイル Bun 上の WASM) | 目標(Bun ネイティブ) |
|---|---|---|
| コールドスタート | 約 500ms(WASM の初期化) | 100ms 未満(埋め込みを mmap) |
| 定常 p50 | 約 10ms | 約 5ms |
| 定常 p95 | 約 30ms | 約 15ms |
| コンパイル済みバイナリで動作 | NO | YES(主要な目標) |
| macOS arm64 | OK(WASM) | 最優先の対象 |
| macOS x64 | OK(WASM) | 余力があれば |
| Linux amd64 | OK(WASM) | 余力があれば |

## アーキテクチャ

効果の大きい順に、3 つの構成要素があります。

### 1. トークナイザ(完了 — security-bunnative.ts に出荷済み)

HuggingFace の `tokenizer.json` を直接読み込み、BERT-small の語彙に対して transformers.js と同じ `input_ids` 列を出力する、純粋な TypeScript の WordPiece エンコーダです。

**ネイティブのトークナイザ自体に意味がある理由:** transformers.js の経路では、トークナイズ処理で小さな配列が大量に確保されます。純粋な TypeScript 版では Tensor の確保オーバーヘッドがなくなります。トークナイザ単体では約 5 倍の速度向上で、大きな意味は別にあります。非同期の境界がなくなるため、コールドパスが動的 import ゼロで始まります。

**テストカバレッジ:** `browse/test/security-bunnative.test.ts` が、20 個のフィクスチャ文字列について、私たちの `input_ids` が transformers.js の出力と一致することを確認します。

### 2. 順伝播(研究段階 — 数週間規模)

ここが難しい部分です。BERT-small の構成は次のとおりです。

  * Transformer 層 12 段
  * 隠れ層サイズ 512、アテンションヘッド 8
  * 総パラメータ数 約 3,000 万

1 回の順伝播は次の処理からなります。

  1. 埋め込みの参照(ID → 512 次元ベクトル)
  2. 位置エンコーディングの加算
  3. 12 回の(セルフアテンション + FFN + LayerNorm)
  4. Pooler(CLS トークンの射影)
  5. 分類ヘッド(2 クラスの sigmoid)

ホットパスは、各 Transformer 層にある 12 回の行列積です。どれも約 512×512×{seq_len} の大きさです。seq_len=128 のとき、(128, 512) @ (512, 512) の形の行列積が約 100 回発生します。

**現実的な進め方は 2 つあります。**

**方式 A: Float32Array と SIMD を使う純粋な TypeScript 実装**
  * Bun の型付き配列サポートと、SIMD 組み込み関数を使う(Bun の安定版に入るまではwasm のみ)
  * 実装規模は約 2,000 行の慎重な数値計算です。LayerNorm、GELU、softmax、スケール付き内積アテンションをすべて手書きします。
  * 遅延の見積もり: M シリーズで約 30〜50ms(WebAssembly SIMD を使う WASM より明らかに遅い)
  * 判定: 単独では割に合わない。純粋な TypeScript では行列積で WASM に勝てない。

**方式 B: Bun FFI + Apple Accelerate**
  * `bun:ffi` で Apple の Accelerate フレームワーク(cblas_sgemm)を呼び出します。M シリーズでは 768×768 の行列積が cblas_sgemm で約 0.5ms です。
  * 重みは Float32Array として保持し(起動時に ONNX の initializer テンソルから読み込む)、トークナイザは TS で動かし、行列積は FFI 経由で行い、活性化の計算は純粋な TS で行います。
  * 実装規模は約 1,000 行です。数値計算の内容は同じですが、大半の処理を BLAS に任せます。
  * 遅延の見積もり: p50 で 3〜6ms(目標を満たす)。
  * リスク: macOS 専用です。Linux では FFI 経由で OpenBLAS を使う必要があり(シンボルの配置が異なる)、Windows は別の話になります。
  * 判定: macOS を優先する gstack では実用的です。既存の出荷方針(Darwin arm64 向けのコンパイル済みバイナリのみ)とも合っています。

**方式 C: Bun で WebGPU を使う**
  * Bun は 1.1.x で WebGPU サポートを入れました。transformers.js にはすでに WebGPU バックエンドがあります。ネイティブの Bun からそれを経由できないでしょうか。
  * リスク: ヘッドレスのサーバー環境で、macOS の WebGPU は適切なディスプレイコンテキストを必要とします。コンパイル済みの bun バイナリから動くかは不明です。
  * 状況: 未調査。勝ち筋になるかもしれず、スパイク(短期の検証)をする価値があります。

### 3. 重みの読み込み(簡単 — 出荷済み)

ONNX の initializer テンソルは、ビルド時に一度だけ、`bun:ffi` で `mmap()` できるフラットなバイナリ blob に書き出せます。その結果、実行時の展開はゼロになります。スケルトンはまだこれを行わず(transformers.js 経由で読み込んでいる)、方式 B を選んだら最初に作るべきものです。計画としては十分単純です。

## マイルストーン

1. **トークナイザ + ベンチマーク用ハーネス**(出荷済み)
   トークナイザは正しさのテストに合格しています。ベンチマークでは現在の WASM の基準値が p50 で 10ms と記録されています。

2. **Bun FFI の概念実証** — Apple Accelerate の `cblas_sgemm` を使い、768×768 の行列積の時間を測定します。遅延が 1ms 未満であることを確認します。

3. **FFI による 1 つの Transformer 層** — Q/K/V の射影に cblas_sgemm を呼び、LayerNorm と softmax を TS で実装します。同じ input_ids に対する onnxruntime の出力と比較します。絶対誤差 1e-4 以内で一致しなければなりません。

4. **順伝播の全体** — 12 層すべて、Pooler、分類器をつなぎます。100 個のフィクスチャ文字列について onnxruntime との正しさを確認します。

5. **本番への差し替え** — security-bunnative.ts の `classify()` の本体を置き換えます。WASM のフォールバックを削除します。

6. **量子化** — int8 の行列積を、Accelerate の cblas_sgemv_u8s8(利用可能な場合)か、onnxruntime-extensions へのフォールバックで実装します。メモリは約 50% 減りますが、速度の改善はわずかです。

## なぜ v1 で出荷しないのか

問題は正しさです。事前学習済みの Transformer を浮動小数点で再実装するのは数週間規模の作業で、すべての演算が参照実装と イプシロン(微小量)レベルで一致している必要があります。LayerNorm のイプシロンを間違えると、精度が静かに狂います。softmax のオーバーフロー処理を間違えると、長い入力で分類器がでたらめな結果を返します。

これを P0 のセキュリティ機能の PR に混ぜて出荷するのは、リスクの取り方として間違っています。WASM 版を今出荷し(完了)、インターフェースを証明し(`classify()` 経由で出荷済み)、ネイティブ版は独自の正しさの回帰テストスイートを伴う後続の PR として段階的に入れます。

## ベンチマーク

現在の基準値(`browse/test/security-bunnative.test.ts` のベンチマークモードで、Apple M シリーズで測定。他のハードウェアでは結果が変わる可能性があります)。

| バックエンド | p50 | p95 | p99 | 備考 |
|---|---|---|---|---|
| transformers.js(WASM) | 約 10ms | 約 30ms | 約 80ms | ウォームアップ後 |
| bun-native(スタブ — 委譲) | WASM と同じ | | | 設計上一致する |

方式 B(Accelerate FFI)が入ったら、この行を新しい数値で更新し、差分をコミットメッセージで明記します。
