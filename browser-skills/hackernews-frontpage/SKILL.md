---
name: hackernews-frontpage
description: Hacker News のトップページをスクレイピングします(タイトル、ポイント数、コメント数)。
host: news.ycombinator.com
trusted: true
source: human
version: 1.0.0
args: []
triggers:
  - scrape hacker news frontpage
  - scrape hn frontpage
  - get hn top stories
  - latest hacker news stories
---

# Hacker News トップページのスクレイパー

Hacker News(`news.ycombinator.com`)のトップページをスクレイピングし、上位 30 件のストーリーを JSON で返します。各ストーリーには、順位、タイトル、リンク先の URL、ポイント数、コメント数が含まれます。

## 使い方

```
$ $B skill run hackernews-frontpage
{
  "stories": [
    { "rank": 1, "title": "...", "url": "...", "points": 412, "comments": 87 },
    ...
  ],
  "count": 30
}
```

## 仕組み

1. デーモン経由で `https://news.ycombinator.com` に移動します。
2. ページの HTML を読みます。
3. 各ストーリーの行(HN の安定した `tr.athing` の構造)を解析し、型付きの `Story` レコードにします。
4. 単一の JSON ドキュメントを標準出力に出します。

## これがリファレンススキルである理由

`hackernews-frontpage` は、最も小さくて興味深いブラウザスキルです。認証がなく、HTML が安定しており、出力が決定的で、フィクスチャのファイルで扱いやすいです。Phase 1 のすべてのコンポーネント(SDK、範囲を限定したトークン、3 段階の検索、プロセスの起動と終了の管理)は、`$B skill run hackernews-frontpage` と同梱の `script.test.ts` によって検証されます。

HN の HTML が変わって、セレクターが壊れた場合は、取得済みのフィクスチャに対するテストが失敗します。ユーザーが気づく前に検出できることが、このテストの目的です。
