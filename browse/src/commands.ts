/**
 * Command registry — single source of truth for all browse commands.
 *
 * Dependency graph:
 *   commands.ts ──▶ server.ts (runtime dispatch)
 *                ──▶ gen-skill-docs.ts (doc generation)
 *                ──▶ skill-parser.ts (validation)
 *                ──▶ skill-check.ts (health reporting)
 *
 * Zero side effects. Safe to import from build scripts and tests.
 */

export const READ_COMMANDS = new Set([
  'text', 'html', 'links', 'forms', 'accessibility',
  'js', 'eval', 'css', 'attrs',
  'console', 'network', 'cookies', 'storage', 'perf',
  'dialog', 'is',
  'inspect',
  'media', 'data',
]);

export const WRITE_COMMANDS = new Set([
  'goto', 'back', 'forward', 'reload',
  'load-html',
  'click', 'fill', 'select', 'hover', 'type', 'press', 'scroll', 'wait',
  'viewport', 'cookie', 'cookie-import', 'cookie-import-browser', 'header', 'useragent',
  'upload', 'dialog-accept', 'dialog-dismiss',
  'style', 'cleanup', 'prettyscreenshot',
  'download', 'scrape', 'archive',
]);

export const META_COMMANDS = new Set([
  'tabs', 'tab', 'tab-each', 'newtab', 'closetab',
  'status', 'stop', 'restart',
  'screenshot', 'pdf', 'responsive',
  'chain', 'diff',
  'url', 'snapshot',
  'handoff', 'resume',
  'connect', 'disconnect', 'focus',
  'inbox',
  'watch',
  'state',
  'frame',
  'ux-audit',
  'domain-skill',
  'skill',
  'cdp',
  'memory',
]);

export const ALL_COMMANDS = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);

/** Commands that return untrusted third-party page content */
export const PAGE_CONTENT_COMMANDS = new Set([
  'text', 'html', 'links', 'forms', 'accessibility', 'attrs',
  'console', 'dialog',
  'media', 'data',
  'ux-audit',
  // snapshot emits aria tree with attacker-controlled aria-label strings.
  // The sidebar's system prompt pushes agents to run `$B snapshot` as the
  // primary read path, so unwrapped snapshot output is the biggest ingress
  // for indirect prompt injection. Envelope it like every other read.
  'snapshot',
]);

/**
 * Subset of PAGE_CONTENT_COMMANDS whose output is derived from the
 * live page DOM. These channels can carry hidden elements or
 * ARIA-injection payloads that the centralized envelope wrap alone
 * does not neutralize, so the scoped-token pipeline runs
 * `markHiddenElements` on the page before the read and surfaces any
 * hits as CONTENT WARNINGS to the LLM.
 *
 * `console`, `dialog` intentionally excluded — they read separate
 * runtime state (console capture, dialog events), not the DOM tree.
 */
export const DOM_CONTENT_COMMANDS = new Set([
  'text', 'html', 'links', 'forms', 'accessibility', 'attrs',
  'media', 'data', 'ux-audit',
]);

/** Wrap output from untrusted-content commands with trust boundary markers */
export function wrapUntrustedContent(result: string, url: string): string {
  // Sanitize URL: remove newlines to prevent marker injection via history.pushState
  const safeUrl = url.replace(/[\n\r]/g, '').slice(0, 200);
  // Escape marker strings in content to prevent boundary escape attacks
  const safeResult = result.replace(/--- (BEGIN|END) UNTRUSTED EXTERNAL CONTENT/g, '--- $1 UNTRUSTED EXTERNAL C\u200BONTENT');
  return `--- BEGIN UNTRUSTED EXTERNAL CONTENT (source: ${safeUrl}) ---\n${safeResult}\n--- END UNTRUSTED EXTERNAL CONTENT ---`;
}

export const COMMAND_DESCRIPTIONS: Record<string, { category: string; description: string; usage?: string }> = {
  // Navigation
  'memory':  { category: 'Server', description: 'Bun のヒープ、タブごとの JS ヒープ、Chromium のプロセスツリー、上限付きバッファのサイズのスナップショット。--json で JSON 出力。', usage: 'memory [--json]' },
  'goto':    { category: 'Navigation', description: 'URL へ移動します(http://、https://、または cwd/TEMP_DIR 内に限定した file://)', usage: 'goto <url>' },
  'load-html': { category: 'Navigation', description: 'setContent で HTML を読み込みます。safe-dirs 配下のファイルパス(検証あり)、または大きなインライン HTML 用に {"html":"...","waitUntil":"..."} を持つ --from-file <payload.json> を受け付けます(Windows の argv でも安全)。', usage: 'load-html <file> [--wait-until load|domcontentloaded|networkidle] [--tab-id <N>]  |  load-html --from-file <payload.json> [--tab-id <N>]' },
  'back':    { category: 'Navigation', description: '履歴を戻る' },
  'forward': { category: 'Navigation', description: '履歴を進む' },
  'reload':  { category: 'Navigation', description: 'ページを再読み込み' },
  'url':     { category: 'Navigation', description: '現在の URL を表示' },
  // Reading
  'text':    { category: 'Reading', description: '整形した可視ページテキスト。CSS セレクタ/@ref を指定した場合は、その要素の整形テキスト', usage: 'text [selector|@ref]' },
  'html':    { category: 'Reading', description: 'セレクタの innerHTML(見つからなければエラー)。セレクタ未指定ならページ全体の HTML', usage: 'html [selector]' },
  'links':   { category: 'Reading', description: 'すべてのリンクを「text → href」の形式で' },
  'forms':   { category: 'Reading', description: 'フォームのフィールドを JSON で' },
  'accessibility': { category: 'Reading', description: 'ARIA ツリー全体' },
  'media':   { category: 'Reading', description: 'すべてのメディア要素(画像、動画、音声)と URL、寸法、種類', usage: 'media [--images|--videos|--audio] [selector]' },
  'data':    { category: 'Reading', description: '構造化データ: JSON-LD、Open Graph、Twitter Cards、meta タグ', usage: 'data [--jsonld|--og|--meta|--twitter]' },
  // Inspection
  'js':      { category: 'Inspection', description: 'ページのコンテキストでインラインの JavaScript 式を実行し、結果を文字列で返します。サンドボックスは eval と同じで、違いは js がインラインの式を受け取り、eval がファイルを読む点だけです。--out <file> を付けると、結果は返さずディスクに書き出します(base64 の data URL は --raw がなければ生のバイト列にデコード)。ローカルの描画結果を PNG にラスタライズする用途に最適で、数 MB を CLI 経由で戻さずに済みます。--out を付けた呼び出しは WRITE になります(書き込みスコープが必要で、トンネル経由では許可されません)。', usage: 'js <expr> [--out <file>] [--raw]' },
  'eval':    { category: 'Inspection', description: 'ファイルの JavaScript をページのコンテキストで実行し、結果を文字列で返します。パスは /tmp または cwd 配下に解決される必要があります(トラバーサル不可)。複数行のスクリプトには eval、1 行のものには js を使います。--out <file> を付けると結果をディスクに書き出します(base64 の data URL は --raw がなければバイト列にデコード)。--out を付けた呼び出しは WRITE になります(書き込みスコープが必要で、トンネル経由では許可されません)。', usage: 'eval <file> [--out <file>] [--raw]' },
  'css':     { category: 'Inspection', description: '計算済みの CSS 値', usage: 'css <sel> <prop>' },
  'attrs':   { category: 'Inspection', description: '要素の属性を JSON で', usage: 'attrs <sel|@ref>' },
  'is':      { category: 'Inspection', description: '要素の状態チェック。有効な <prop> の値: visible、hidden、enabled、disabled、checked、editable、focused(大文字小文字を区別)。<sel> は CSS セレクタ、または直前の snapshot の @ref トークン(例: @e3、@c1)を受け付けます。セレクタが期待される場所では、ref をセレクタと同様に使えます。', usage: 'is <prop> <sel|@ref>' },
  'console': { category: 'Inspection', description: 'コンソールメッセージ(--errors で error/warning に絞り込み)', usage: 'console [--clear|--errors]' },
  'network': { category: 'Inspection', description: '取得したネットワークリクエストを、メソッド、ステータス、リソース種別、URL の行で。--clear で取得済みバッファを空にします。', usage: 'network [--clear]' },
  'dialog':  { category: 'Inspection', description: '取得した alert/confirm/prompt のメッセージを、テキスト/JSON イベントで。--clear でダイアログのバッファを空にします。', usage: 'dialog [--clear]' },
  'cookies': { category: 'Inspection', description: 'すべての Cookie を JSON で' },
  'storage': { category: 'Inspection', description: 'localStorage と sessionStorage の両方を JSON で読み取ります。"set <key> <value>" を付けると localStorage にだけ書き込みます(このコマンドでは sessionStorage は読み取り専用。設定するには `js sessionStorage.setItem(...)` を使います)。', usage: 'storage  |  storage set <key> <value>' },
  'perf':    { category: 'Inspection', description: 'ナビゲーション/読み込み各フェーズのページ読み込み時間を、JSON 風のミリ秒で' },
  // Interaction
  'click':   { category: 'Interaction', description: '要素をクリック', usage: 'click <sel>' },
  'fill':    { category: 'Interaction', description: '入力欄に入力', usage: 'fill <sel> <val>' },
  'select':  { category: 'Interaction', description: 'ドロップダウンの選択肢を、値、ラベル、または表示テキストで選択', usage: 'select <sel> <val>' },
  'hover':   { category: 'Interaction', description: '要素にホバー', usage: 'hover <sel>' },
  'type':    { category: 'Interaction', description: 'フォーカスされた要素に、または --selector で指定した <sel>(先にフォーカスします)にキー入力を送ります。-- で始まるテキストは -- 区切りの後に置きます。', usage: 'type [--selector <sel>] [--] <text>' },
  'press':   { category: 'Interaction', description: 'フォーカスされた要素に Playwright のキーボードキーを押します。名前は大文字小文字を区別します: Enter、Tab、Escape、ArrowUp/Down/Left/Right、Backspace、Delete、Home、End、PageUp、PageDown。修飾キーは + で組み合わせます: Shift+Enter、Control+A、Meta+K。印字可能な 1 文字(a、A、1)も使えます。キーの全一覧: https://playwright.dev/docs/api/class-keyboard#keyboard-press', usage: 'press <key>' },
  'scroll':  { category: 'Interaction', description: 'セレクタを指定すると、その要素が見えるまでスムーズにスクロールします。未指定ならページの最下部へ移動します。--by/--to の量指定はありません。ピクセル単位で正確にスクロールするには `js window.scrollTo(0, N)` を使います。', usage: 'scroll [sel|@ref]' },
  'wait':    { category: 'Interaction', description: '要素、ネットワークのアイドル、またはページの読み込みを待ちます(タイムアウト: 15 秒)', usage: 'wait <sel|--networkidle|--load>' },
  'upload':  { category: 'Interaction', description: 'ファイルをアップロード', usage: 'upload <sel> <file> [file2...]' },
  'viewport':{ category: 'Interaction', description: 'ビューポートのサイズと、任意の deviceScaleFactor(1〜3、retina スクリーンショット用)を設定します。--scale はコンテキストの再構築が必要です。`auto`(別名 `reset`)は固定を解除します: headed ではウィンドウに再び追従し、headless では 1280x720 に戻ります。', usage: 'viewport [<WxH>|auto] [--scale <n>]' },
  'cookie':  { category: 'Interaction', description: '現在のページのドメインに Cookie を設定', usage: 'cookie <name>=<value>' },
  'cookie-import': { category: 'Interaction', description: 'JSON ファイルから Cookie をインポート', usage: 'cookie-import <json>' },
  'cookie-import-browser': { category: 'Interaction', description: 'chrome、chromium、brave、edge、Windows 限定の opera、opera-gx、macOS 限定の comet、arc、dia から Cookie をコピーします。ブラウザを省略すると従来どおり comet になるため、対象のブラウザは明示的に選んでください。--domain は現在のページが一致している必要があります。スコープのフラグがなければピッカーを開きます。--profile はコピー元のディレクトリで、曖昧なプロファイルは選択が必要です。--all は期限切れでない Cookie をすべて明示的に選び、--domain や --clear-storage とは併用できません。--clear-storage を指定しない限りストレージは保持されます(指定すると、取得したオリジンの localStorage(コンテキストのタブ間で共有)と対象タブの sessionStorage をリセット)。--verify-auth は、起動前にデーモンの GSTACK_COOKIE_AUTH_SELECTOR と GSTACK_COOKIE_AUTH_EXPECTED_IDENTITY を必要とし、設定がなければ変更前に拒否します。検証済みとは、Cookie の件数や HTTP 200 ではなく、可視の識別情報が正確に一致することを意味します。Windows のネイティブ抽出は、適格性の確認が済むまで無効のままです。', usage: 'cookie-import-browser [browser] [--domain d] [--profile p] [--all] [--clear-storage] [--verify-auth]' },
  'header':  { category: 'Interaction', description: 'カスタムのリクエストヘッダーを設定(コロン区切り、機密性の高い値は自動で伏せ字)', usage: 'header <name>:<value>' },
  'useragent': { category: 'Interaction', description: 'ユーザーエージェントを設定', usage: 'useragent <string>' },
  'dialog-accept': { category: 'Interaction', description: '次の alert/confirm/prompt を自動で承諾します。任意のテキストは prompt の応答として送られます', usage: 'dialog-accept [text]' },
  'dialog-dismiss': { category: 'Interaction', description: '次のダイアログを自動で閉じる' },
  // Data extraction
  'download': { category: 'Extraction', description: 'ブラウザの Cookie を使って、URL またはメディア要素をディスクにダウンロードします。既定のパス: <temp>/browse-download-<timestamp>.<ext>。--base64 は書き込まず data:<mime>;base64,... の文字列を返します(上限 10MB)。ブラウザのダウンロードを起動する URL(CDN のリダイレクト、Content-Disposition、ボット対策のあるサイト)には --navigate を使います。', usage: 'download <url|@ref> [path] [--base64] [--navigate]' },
  'scrape':   { category: 'Extraction', description: 'ページのメディアをすべて --dir(既定: <temp>/browse-scrape-<timestamp>)に一括ダウンロードします。ファイルに加え、元の URL、サイズ、種類、成功/失敗の件数を持つ manifest.json を書き出します。--limit の既定は 50、上限は 200 です。', usage: 'scrape <images|videos|media> [--selector sel] [--dir path] [--limit N]' },
  'archive':  { category: 'Extraction', description: 'CDP でページ全体を MHTML として保存します。既定のパス: <temp>/browse-archive-<timestamp>.mhtml。保存したパス、サイズ、MHTML マーカーを返します。', usage: 'archive [path]' },
  // Visual
  'screenshot': { category: 'Visual', description: 'スクリーンショットを保存します。既定のパス: <temp>/browse-screenshot.png。既定はページ全体の撮影で、--viewport はビューポートだけを撮影します。--selector は特定の要素を対象にし、--clip は x,y,width,height のピクセルを使います。--base64 は書き込まず data:image/png;base64,... を返します(上限 10MB)。./#/@/[ で始まる位置引数のセレクタも引き続き使えます。', usage: 'screenshot [--selector <css>] [--viewport] [--clip x,y,w,h] [--base64] [selector|@ref] [path]' },
  'pdf':     { category: 'Visual', description: '現在のページを PDF として保存します。既定のパス: <temp>/browse-page.pdf。<dim> は 1in、72pt、25mm、2.54cm のような CSS 単位を受け付け、数字だけならピクセルです。ページレイアウト(--format、--width、--height、--margins、--margin-*)、構造(--toc は Paged.js を少し待ちます)、ブランディング(--header-template、--footer-template、--page-numbers)、アクセシビリティ(--tagged、--outline)、大きなペイロード用の --from-file <payload.json> に対応します。特定のタブを対象にするには --tab-id <N> を使います。', usage: 'pdf [path] [--format letter|a4|legal] [--width <dim> --height <dim>] [--margins <dim>] [--margin-top <dim> --margin-right <dim> --margin-bottom <dim> --margin-left <dim>] [--header-template <html>] [--footer-template <html>] [--page-numbers] [--tagged] [--outline] [--print-background] [--prefer-css-page-size] [--toc] [--tab-id <N>]  |  pdf --from-file <payload.json> [--tab-id <N>]' },
  'responsive': { category: 'Visual', description: 'モバイル(375x812)、タブレット(768x1024)、デスクトップ(1280x720)のスクリーンショット。{prefix}-mobile.png などの名前で保存します。', usage: 'responsive [prefix]' },
  'diff':    { category: 'Visual', description: 'ページ間のテキスト差分', usage: 'diff <url1> <url2>' },
  // Tabs
  'tabs':    { category: 'Tabs', description: '開いているタブを一覧表示' },
  'tab':     { category: 'Tabs', description: 'タブを切り替え', usage: 'tab <id>' },
  'newtab':  { category: 'Tabs', description: '新しいタブを開きます。--json を付けると、プログラム用(make-pdf)に {"tabId":N,"url":...} を返します。', usage: 'newtab [url] [--json]' },
  'closetab':{ category: 'Tabs', description: 'タブを閉じる', usage: 'closetab [id]' },
  'tab-each':{ category: 'Tabs', description: '開いているすべてのタブでコマンドを実行します。タブごとの結果を JSON で返します。', usage: 'tab-each <command> [args...]' },
  // Server
  'status':  { category: 'Server', description: 'ヘルスチェック' },
  'stop':    { category: 'Server', description: 'サーバーを停止' },
  'restart': { category: 'Server', description: 'サーバーを再起動' },
  // Meta
  'snapshot':{ category: 'Snapshot', description: '要素選択用の @e ref を持つアクセシビリティツリー。フラグ: -i インタラクティブのみ、-c コンパクト、-d N 深さ制限、-s sel スコープ、-D 直前との差分、-a 注釈付きスクリーンショット、-o path 出力先、-C cursor-interactive の @c ref', usage: 'snapshot [flags]' },
  'chain':   { category: 'Meta', description: '標準入力の JSON からコマンドの列を実行します。配列の配列を 1 つ渡し、内側の各配列は [cmd, ...args] です。出力はコマンドごとに 1 つの JSON 結果です。JSON 配列(例: `[["goto","https://example.com"],["text","h1"]]`)を `$B chain` にパイプすると、goto、続いて text コマンドの順に実行します。最初のエラーで停止します。', usage: 'chain  (JSON via stdin)' },
  // Handoff
  'handoff': { category: 'Server', description: 'ユーザーが引き継げるように、現在のページで可視の Chrome を開く', usage: 'handoff [message]' },
  'resume':  { category: 'Server', description: 'ユーザーの引き継ぎ後に snapshot を取り直し、制御を AI に戻す', usage: 'resume' },
  // Headed mode
  'connect': { category: 'Server', description: 'Chrome 拡張機能つきの headed Chromium を起動します。--supervise は CLI をつないだままにして、クラッシュしたサーバーを再起動します', usage: 'connect [--supervise]' },
  'disconnect': { category: 'Server', description: 'headed ブラウザを切断し、headless モードに戻す' },
  'focus':   { category: 'Server', description: 'headed ブラウザのウィンドウを前面に出す(macOS)', usage: 'focus [@ref]' },
  // Inbox
  'inbox':   { category: 'Meta', description: '可視のブラウザ拡張機能のサイドバー受信箱のメッセージを JSON/テキストで一覧表示します。--clear は読み取り後に削除します。', usage: 'inbox [--clear]' },
  // Watch
  'watch':   { category: 'Meta', description: '受動的な観察モードを開始します。ユーザーがブラウズする間、定期的に snapshot を記録し、変更を伴うコマンドをブロックします。watch stop で観察を終了し、集めた snapshot の要約を返します。', usage: 'watch [stop]' },
  // State
  'state':   { category: 'Server', description: 'ブラウザの状態(Cookie + URL)を保存/読み込み', usage: 'state save|load <name>' },
  // Frame
  'frame':   { category: 'Meta', description: 'コマンドのコンテキストを iframe に切り替えるか、`main` で最上位のページに戻します。<sel> は CSS、@ref は snapshot 由来、--name はフレーム名の完全一致、--url pattern はフレームの URL への部分一致です。', usage: 'frame <sel|@ref|--name n|--url pattern|main>' },
  // CSS Inspector
  'inspect': { category: 'Inspection', description: 'CDP による CSS の詳細な検査。既定では 1 つのセレクタを検査し、一致した要素、ルールのカスケード全体、ボックスモデル、計算済みスタイルを返します。--all は検査可能なすべての要素の要約を返し、--history は過去のスタイル変更/検査の状態を返します。', usage: 'inspect [selector] [--all] [--history]' },
  'style':   { category: 'Interaction', description: '要素の CSS プロパティを変更(元に戻す機能つき)', usage: 'style <sel> <prop> <value> | style --undo [N]' },
  'cleanup': { category: 'Interaction', description: '一致した要素を隠して、ページの邪魔なものを取り除きます。フラグなしでは --all が既定です。--all は広告、Cookie、固定表示、ソーシャル、オーバーレイ、その他の邪魔なものを含み、個別のフラグでカテゴリを絞れます。取り除いた要素の数を返します。', usage: 'cleanup [--ads] [--cookies] [--sticky] [--social] [--overlays] [--clutter] [--all]' },
  'prettyscreenshot': { category: 'Visual', description: '任意のクリーンアップ、スクロール位置の指定、要素の非表示つきの、きれいなスクリーンショット', usage: 'prettyscreenshot [--scroll-to sel|text] [--cleanup] [--hide sel...] [--width px] [path]' },
  // UX Audit
  'ux-audit': { category: 'Inspection', description: 'UX の挙動分析のためにページ構造(サイト ID、ナビゲーション、見出し、テキストブロック、インタラクティブ要素)を抽出します。エージェントが解釈するための JSON を返します。', usage: 'ux-audit' },
  // Domain skills (per-site notes the agent writes for itself)
  'domain-skill': { category: 'Meta', description: 'エージェントが自分のために書く、サイトごとのメモ。ホストはアクティブなタブから導出します。ライフサイクル: `save` は隔離状態のメモを追加し、プロンプトインジェクション分類器に検出されないまま 3 回成功して使われると、メモは自動的に "active" に昇格し、`promote-to-global` でグローバル層(マシン全体、全プロジェクト)に引き上げます。分類器のフラグは L4 のプロンプトインジェクションスキャンが自動で設定し、エージェントが手動で設定することはありません。`list` / `show` で確認し、`edit` で修正し、`rollback` で降格し、`rm` で墓標化します。', usage: 'domain-skill save|list|show|edit|promote-to-global|rollback|rm <host?>' },
  // Browser-skills (hand-written or generated Playwright scripts the runtime spawns)
  'skill':        { category: 'Meta', description: 'browser-skill を実行します。ループバック HTTP 経由でデーモンを操作する、決定的な Playwright スクリプトです。3 層の探索(プロジェクト > グローバル > 同梱)。起動したスクリプトは、起動ごとのスコープ付きトークン(読み取り+書き込みのみ)を受け取り、デーモンのルートトークンは決して受け取りません。', usage: 'skill list|show|run|test|rm <name?> [--arg k=v]... [--timeout=Ns]' },
  // CDP escape hatch (deny-default; see browse/src/cdp-allowlist.ts)
  'cdp':          { category: 'Inspection', description: '生の Chrome DevTools Protocol メソッドのディスパッチ。既定で拒否: `browse/src/cdp-allowlist.ts`(CDP_ALLOWLIST 定数)に列挙されたメソッドだけが到達可能で、それ以外のメソッドは 403 になります。許可リストの各エントリはスコープ(タブかブラウザか)と出力(信頼するか信頼しないか)を宣言し、信頼しないメソッド(データ流出の形をしたもの。例: Network.getResponseBody)の出力は UNTRUSTED エンベロープで包まれます。許可されたメソッドを調べるには `browse/src/cdp-allowlist.ts` を読みます。例: `$B cdp Page.getLayoutMetrics`。', usage: 'cdp <Domain.method> [json-params]' },
};

// Load-time validation: descriptions must cover exactly the command sets
const allCmds = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);
const descKeys = new Set(Object.keys(COMMAND_DESCRIPTIONS));
for (const cmd of allCmds) {
  if (!descKeys.has(cmd)) throw new Error(`COMMAND_DESCRIPTIONS missing entry for: ${cmd}`);
}
for (const key of descKeys) {
  if (!allCmds.has(key)) throw new Error(`COMMAND_DESCRIPTIONS has unknown command: ${key}`);
}

/**
 * Command aliases — user-friendly names that route to canonical commands.
 *
 * Single source of truth: server.ts dispatch and meta-commands.ts chain prevalidation
 * both import `canonicalizeCommand()`, so aliases resolve identically everywhere.
 *
 * When adding a new alias: keep the alias name guessable (e.g. setcontent → load-html
 * helps agents migrating from Puppeteer's page.setContent()).
 */
export const COMMAND_ALIASES: Record<string, string> = {
  'setcontent': 'load-html',
  'set-content': 'load-html',
  'setContent': 'load-html',
};

/** Resolve an alias to its canonical command name. Non-aliases pass through unchanged. */
export function canonicalizeCommand(cmd: string): string {
  return COMMAND_ALIASES[cmd] ?? cmd;
}

/**
 * Commands added in specific versions — enables future "this command was added in vX"
 * upgrade hints in unknown-command errors. Only helps agents on *newer* browse builds
 * that encounter typos of recently-added commands; does NOT help agents on old builds
 * that type a new command (they don't have this map).
 */
export const NEW_IN_VERSION: Record<string, string> = {
  'load-html': '0.19.0.0',
};

/**
 * Levenshtein distance (dynamic programming).
 * O(a.length * b.length) — fast for command name sizes (<20 chars).
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m: number[][] = [];
  for (let i = 0; i <= a.length; i++) m.push([i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}

/**
 * Build an actionable error message for an unknown command.
 *
 * Pure function — takes the full command set + alias map + version map as args so tests
 * can exercise the synthetic "older-version" case without mutating any global state.
 *
 *   1. Always names the input.
 *   2. If Levenshtein distance ≤ 2 AND input.length ≥ 4, suggests the closest match
 *      (alphabetical tiebreak for determinism). Short-input guard prevents noisy
 *      suggestions for typos of 2-letter commands like 'js' or 'is'.
 *   3. If the input appears in newInVersion, appends an upgrade hint. Honesty caveat:
 *      this only fires on builds that have this handler AND the map entry; agents on
 *      older builds hitting a newly-added command won't see it. Net benefit compounds
 *      as more commands land.
 */
export function buildUnknownCommandError(
  command: string,
  commandSet: Set<string>,
  aliasMap: Record<string, string> = COMMAND_ALIASES,
  newInVersion: Record<string, string> = NEW_IN_VERSION,
): string {
  let msg = `Unknown command: '${command}'.`;

  // Suggestion via Levenshtein, gated on input length to avoid noisy short-input matches.
  // Candidates are pre-sorted alphabetically, so strict "d < bestDist" gives us the
  // closest match with alphabetical tiebreak for free — first equal-distance candidate
  // wins because subsequent equal-distance candidates fail the strict-less check.
  if (command.length >= 4) {
    let best: string | undefined;
    let bestDist = 3; // sentinel: distance 3 would be rejected by the <= 2 gate below
    const candidates = [...commandSet, ...Object.keys(aliasMap)].sort();
    for (const cand of candidates) {
      const d = levenshtein(command, cand);
      if (d <= 2 && d < bestDist) {
        best = cand;
        bestDist = d;
      }
    }
    if (best) msg += ` Did you mean '${best}'?`;
  }

  if (newInVersion[command]) {
    msg += ` This command was added in browse v${newInVersion[command]}. Upgrade: cd ~/.claude/skills/gstack && git pull && bun run build.`;
  }

  return msg;
}
