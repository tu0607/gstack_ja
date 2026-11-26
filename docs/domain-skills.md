# ドメインスキル

> **適用範囲:** ドメインスキルは gstack 独自のブラウザエンジン(`$B`)の機能で、Aside ブラウザが使えない場合(Linux、Windows、Aside アプリが閉じている場合)に動く**フォールバック**です。Aside を操作するスキルは、代わりに `/learn` でプロジェクトごとの学習内容を記録します。詳しくは [BROWSER.md](../BROWSER.md) を参照してください。

Web サイトごとのメモを、エージェントが自分自身のために書き残す仕組みです。セッションをまたいで蓄積されます。エージェントが Web サイトについて自明でない点を見つけたらスキルとして保存し、その後のセッションで同じホストを扱うときに、そのメモがプロンプトのコンテキストに注入されます。

これは [browser-use/browser-harness](https://github.com/browser-use/browser-harness) から gstack が取り入れたものです。gstack が採用したのはサイトごとのメモというパターンだけで、ランタイムを自己書き換えするパターンは採用していません。スキルはプロンプトに読み込まれる Markdown テキストであり、実行可能なコードではありません。

## エージェントによる利用方法

```bash
# Agent wrote down what it learned about a site after a successful task.
# The host is taken from the active tab automatically (no agent argument).
echo "# LinkedIn Apply Button

The Apply button on /jobs/view pages is inside an iframe with a class
matching 'jobs-apply-button-iframe'. Use \$B frame --url 'apply' first,
then snapshot." | $B domain-skill save

# See what's saved
$B domain-skill list

# Read the body of a specific host's skill
$B domain-skill show linkedin.com

# Edit interactively in $EDITOR
$B domain-skill edit linkedin.com

# Promote an active per-project skill to global (cross-project)
$B domain-skill promote-to-global linkedin.com

# Roll back a recent edit
$B domain-skill rollback linkedin.com

# Delete (tombstone — recoverable via rollback)
$B domain-skill rm linkedin.com
```

## 状態遷移

```
  ┌──────────────┐  3 successful uses        ┌────────┐  promote-to-global   ┌────────┐
  │ quarantined  │ ─────────────────────▶  │ active │ ──────────────────▶  │ global │
  │ (per-project)│  (no classifier flags)   │(project)│  (manual command)    │        │
  └──────────────┘                          └────────┘                      └────────┘
         ▲                                       │
         │  classifier flag during use           │  rollback (version log)
         └───────────────────────────────────────┘
```

新しく保存されたスキルは **quarantined(隔離)** 状態になり、プロンプトに自動では組み込まれません。同じホストで 3 回使われ、その間 L4 ML 分類器がスキルの内容にフラグを立てなければ、プロジェクト内で **active(有効)** 状態に自動昇格します。active のスキルは、そのホスト名に対する新しいサイドバーエージェントのセッションごとに毎回組み込まれます。

複数のプロジェクトをまたいでスキルを有効にしたい場合(例: 「LinkedIn 用のスキルをすべての gstack プロジェクトで使いたい」)は、`$B domain-skill promote-to-global <host>` を明示的に実行します。これは意図的にオプトイン方式にしています(Codex T4 の外部レビューによる判断)。無関係な作業の間でコンテキストが無制限に漏れるのを防ぐためです。

## ストレージ

スキルは次の 2 か所に保存されます。

- **プロジェクトごと**: `~/.gstack/projects/<slug>/learnings.jsonl` — `/learn` スキルも使う同じ JSONL ファイルです。ドメインスキルは `type:"domain"` の行として保存されます。
- **グローバル**: `~/.gstack/global-domain-skills.jsonl` — `state:"global"` の行だけが保存されます。

どちらのファイルも追記専用の JSONL です。削除はトゥームストーン(削除マーカー)で記録され、アイドル時のコンパクター(圧縮処理)が定期的にファイルを書き直します。寛容なパーサーは読み込み時に末尾の不完全な行を捨てるため、書き込み途中でクラッシュしても後続の読み込みが壊れません。

## セキュリティモデル

スキルはエージェントが作成し、後のセッションのプロンプトコンテキストに読み込まれるコンテンツです。そのため、エージェント間のプロンプトインジェクションの典型的な経路になります。この計画では複数の層でこれに対処しています。

| 層 | 内容 | 場所 |
|-------|------|-------|
| L1-L3 | データマーキング、非表示要素の除去、ARIA の正規表現、URL ブロックリスト | `content-security.ts`(コンパイル済みバイナリ) |
| L4 | TestSavantAI ONNX 分類器 | `security-classifier.ts`(sidebar-agent、非コンパイル) |
| L4b | Claude Haiku によるトランスクリプト分類器 | `security-classifier.ts`(sidebar-agent) |
| L5 | カナリアトークンによる漏えい検出 | `security.ts` |

L1-L3 のチェックは**保存時**(デーモン内)に実行されます。L4 の ML 分類器は**読み込み時**(sidebar-agent 内)に実行されるため、スキルをプロンプトに読み込むセッションのたびにコンテンツが再検証されます。これにより、分類器モデルが更新された後にだけ現れる問題も検出できます。

保存コマンドは、エージェントの引数ではなく**アクティブタブのトップレベルのオリジン**からホスト名を導出します。これは Codex が指摘した混乱した代理(confused-deputy)のバグへの対策です。悪意のあるページのリダイレクトチェーンによって、エージェントが別のドメインを汚染させられる恐れがあったためです。

## エラーリファレンス

| エラー | 原因 | 対処 |
|-------|------|-------|
| `Save blocked: classifier flagged content as potential injection` | 保存時に L4 スコアが 0.85 以上 | 命令的な文章を取り除いてスキルを書き直し、再試行する。 |
| `Save blocked: <L1-L3 message>` | 保存時に URL ブロックリストに一致、または ARIA インジェクション | スキルの本文に不審なパターンがないか確認する。 |
| `Save failed: empty body` | stdin または `--from-file` から内容が渡されていない | Markdown を `$B domain-skill save` にパイプするか、`--from-file <path>` を指定する。 |
| `Cannot save domain-skill: no top-level URL on active tab` | タブが `about:blank` または `chrome://...` である | 先に `$B goto <target-site>` を実行してから保存する。 |
| `Cannot promote: skill is in state "quarantined"` | スキルがまだ自動昇格していない | 分類器のフラグなしで 3 回成功するまで、このプロジェクトで使い続ける。 |
| `Cannot rollback: <host> has fewer than 2 versions` | バージョンが 1 つしかない | 代わりに `$B domain-skill rm` で削除する。 |

## テレメトリ

テレメトリが有効な場合(デフォルトは `community` モード。無効にしていない限り)、次のイベントが `~/.gstack/analytics/browse-telemetry.jsonl` に記録されます。

- `domain_skill_saved {host, scope, state, bytes}`
- `domain_skill_save_blocked {host, reason}`
- `domain_skill_fired {host, source, version}`
- `domain_skill_state_changed {host, from_state, to_state}`(計画中)

記録されるのはホスト名だけで、本文の内容やエージェントのテキストは含みません。`gstack-config set telemetry off` または `GSTACK_TELEMETRY_OFF=1` で完全に無効にできます。
