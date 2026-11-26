# スキル詳細ガイド

gstack の全スキルについての詳細ガイドです。思想、ワークフロー、使用例をまとめています。

| スキル | 担当スペシャリスト | 概要 |
|-------|----------------|--------------|
| [`/office-hours`](#office-hours) | **YC Office Hours** | まずはここから始めます。6つの強制質問で、コードを書く前にプロダクトの捉え方を組み直します。あなたの前提に異を唱え、前提そのものに疑問を投げかけ、実装案を生成します。ここで作られる設計ドキュメントが、後続のすべてのスキルの入力になります。 |
| [`/spec`](#spec) | **Spec Author** | 曖昧な意図を、5つのフェーズで正確で実行可能な仕様に落とし込みます。バックログにそのまま載せられる成果物を出し、後続のスキルが拾える形にします。最後に任意でエージェントを起動できます。 |
| [`/plan-ceo-review`](#plan-ceo-review) | **CEO / Founder** | 問題そのものを考え直します。依頼の中に隠れた「10 つ星のプロダクト」を探します。モードは4つ:Expansion、Selective Expansion、Hold Scope、Reduction です。 |
| [`/plan-eng-review`](#plan-eng-review) | **Eng Manager** | アーキテクチャ、データフロー、図、エッジケース、テストを固めます。隠れた前提を表に引き出します。 |
| [`/plan-design-review`](#plan-design-review) | **Senior Designer** | プランモードで対話しながら行う設計レビューです。各観点を 0〜10 で評価し、10 点とは何かを説明して、プランを修正します。プランモードで動作します。 |
| [`/design-consultation`](#design-consultation) | **Design Partner** | デザインシステムをゼロから構築します。市場の状況を把握したうえで創造的なリスクを提案し、現実的なプロダクトのモックアップを生成します。デザインは他のすべてのフェーズの中心に置かれます。 |
| [`/review`](#review) | **Staff Engineer** | CI は通るのに本番で壊れるバグを見つけます。明らかな問題は自動で修正します。網羅性の抜けを指摘します。簡素化の観点では、過剰に作り込まれたコードを指摘します。ブロックもせず、自動適用もしません。 |
| [`/investigate`](#investigate) | **Debugger** | 体系的に根本原因を突き止めるデバッグです。鉄則は「調査なしに修正しない」です。データフローをたどり、仮説を検証し、修正が3回失敗したところで止まります。 |
| [`/design-review`](#design-review) | **Designer Who Codes** | 公開中のサイトのビジュアル監査と修正ループです。80項目の監査を行ったうえで、見つかった問題を修正します。アトミックなコミットと、修正前後のスクリーンショットを残します。 |
| [`/design-shotgun`](#design-shotgun) | **Design Explorer** | AI によるデザインのバリエーションを複数生成し、比較ボードをブラウザで開きます。方向性が決まるまで反復できます。テイスト・メモリがあなたの好みに合わせて提案を寄せていきます。 |
| [`/design-html`](#design-html) | **Design Engineer** | Pretext ネイティブの本番品質の HTML を生成します。承認済みモックアップ、CEO プラン、デザインレビュー、あるいはゼロからの作成に対応します。リサイズでテキストが折り返し直され、高さはコンテンツに合わせて変わります。デザインの種類に応じて API を賢く使い分けます。React、Svelte、Vue のフレームワークも検出します。プレビューは Aside ブラウザで表示されます。 |
| [`/qa`](#qa) | **QA Lead** | ブラウザや機能の挙動(API、CLI、ジョブ、ワーカー、Webhook)を探索し、不具合を再現します。修正の前に回帰が失敗することを証明し、修正して再検証します。 |
| [`/qa-only`](#qa) | **QA Reporter** | 同じ対象を探索し、証拠付きで回帰テストケースを提案します。プロダクトのコードやテストは変更しません。 |
| [`/scrape`](#browse) | **Browser Data Extractor** | 表、リスト、価格などの構造化データを Web ページから取り出します。Aside ブラウザで、ページ上の実際のログイン状態のまま動作します。`/browse` と同じドライバー契約に従います。フォールバックのブラウザでは、スキル化された処理が同じ用途の繰り返しに約 200ms で応答します。 |
| [`/skillify`](#browse) | **Skill Codifier** | フォールバックブラウザ用のスキルです。会話をさかのぼって最後の `/scrape` の試作を見つけ、スクリプト、テスト、フィクスチャを組み立てて、テストを実行し、コミットする前に確認します。Aside では、サイトごとの持続的な自動化は Aside 独自のスキルの領分です。 |
| [`/ship`](#ship) | **Release Engineer** | main を同期し、テストを実行し、変更された振る舞いを範囲を決めて探索し、最終検証の前にカバレッジとドキュメントを監査してから、プッシュして PR を作成または更新します。必要に応じてテストフレームワークも導入します。 |
| [`/land-and-deploy`](#land-and-deploy) | **Release Engineer** | PR をマージし、CI とデプロイを待ち、本番環境の健全性を確認します。「承認」から「本番で検証済み」までを一つのコマンドで実行します。 |
| [`/canary`](#canary) | **SRE** | デプロイ後の監視ループです。Aside ブラウザで、コンソールエラー、パフォーマンスの劣化、ページの障害を監視します。 |
| [`/benchmark`](#benchmark) | **Performance Engineer** | ページの読み込み時間、Core Web Vitals、リソースサイズのベースラインを測定します。PR ごとに変更前後を比較し、傾向を時系列で追跡します。 |
| [`/cso`](#cso) | **Chief Security Officer** | 明示的なカバレッジ付きで、対応済みのセキュリティ検出結果を提供します。カタログのプロファイルがなくても静的評価は利用できます。ランタイムやスキャナーの実行を伴う検証には、対応するプロファイルの認定が必要です。ランタイムテスト済みのバンドルは、外部のアサーションを個別に認証します。対象コードがテストプロセスを制御するため、プロジェクトテストの完了は `self_reported` のままです。`tested` は将来、対象コードに依存しない完了証明が導入されたときのために予約されています。 |
| [`/document-release`](#document-release) | **Technical Writer** | 出荷のたびに、関連するドキュメントを最終検証の前に監査します。PR が存在した後に単独で実行することもできます。古くなった README を見つけ、未解決のギャップを報告します。 |
| [`/document-generate`](#document-generate) | **Technical Writer** | 機能のコードから Diátaxis 形式(チュートリアル / ハウツー / リファレンス / 解説)のドキュメントを生成します。 |
| [`/retro`](#retro) | **Eng Manager** | チームを考慮した週次のふりかえりです。メンバーごとの内訳、出荷の連続記録、テストの健全性の推移、成長の機会を示します。 |
| [`/browse`](#browse) | **QA Engineer** | エージェントに「目」を与えます。Aside ブラウザを最優先で操作します。実際のセッション、実際のクリック、実際のスクリーンショットを、決定論的な `aside repl` スクリプトで実行します。Aside がない場合は、gstack 独自の Chromium にフォールバックします(コマンドあたり約 100ms)。 |
| [`/setup-browser-cookies`](#setup-browser-cookies) | **Session Manager** | Chrome、Chromium、Brave、Edge、Windows 限定の Opera と Opera GX、macOS 限定の Comet、Arc、Dia から、選んだ Cookie をフォールバックブラウザにコピーします。プロファイルとドメインを選び、サインインは別途確認します。Aside では、すでにセッションを持っているため不要です。 |
| [`/autoplan`](#autoplan) | **Review Pipeline** | 1つのコマンドで、十分にレビューされたプランを出力します。CEO → デザイン → DX → エンジニアリングの順にレビューを自動実行します。エンジニアリングは必ず最後に実行され、出荷前のゲートが最終的に修正されたプランをレビューするようにします。判断原則を組み込み、承認が必要な「テイスト」の判断だけを提示します。 |
| [`/plan-devex-review`](#plan-devex-review) | **DX Reviewer** | プランの段階での DX レビューです。TTHW(Hello World までの所要時間)、感動ポイント、摩擦点、ペルソナごとの流れ、エラーメッセージを、それを読むエージェント向けに評価します([エージェント対応のエラー](agent-ready-errors.md))。モードは3つ:Expansion、Polish、Triage です。 |
| [`/devex-review`](#devex-review) | **DX Reviewer (live)** | 稼働中の開発者体験の監査です。実際のオンボーディングの流れをたどり、TTHW を測定し、ドキュメントの誤りを見つけます。エージェントが遭遇する形で CLI のエラーを発生させ(ターミナルなし、隔離、秘匿化)、`gstack-error-capture` を通して記録します。 |
| [`/plan-tune`](#plan-tune) | **Question Tuner** | AskUserQuestion の頻度を質問ごとに自己調整します。質問を「聞かない」「常に聞く」「一方向の場合のみ聞く」のいずれかに指定できます。 |
| [`/spec`](#spec) | **Spec Author** | 曖昧な意図を、5つのフェーズで正確で実行可能な仕様に落とし込みます。GitHub の Issue を作成し、必要に応じて新しいワークツリー(worktree)で Claude Code のエージェントを起動します。マージ時には `/ship` が元の Issue をクローズします。 |
| [`/learn`](#learn) | **Memory** | gstack がセッションをまたいで学んだ内容を管理します。プロジェクト固有のパターンや好みを確認、検索、整理、エクスポートできます。 |
| [`/context-save`](#context-save) | **Save State** | 作業コンテキスト(Git の状態、決定事項、残りの作業)を保存し、後のどのセッションからでも再開できるようにします。 |
| [`/context-restore`](#context-restore) | **Restore State** | 保存したコンテキストから再開します。Conductor のワークスペース間の引き継ぎをまたいでも動作します。 |
| [`/health`](#health) | **Code Quality Dashboard** | 型チェッカー、リンター、テスト、デッドコード検出をまとめて実行します。重み付けした 0〜10 のスコアを算出し、推移を追跡します。 |
| [`/deslop-shared-libs`](#deslop-shared-libs) | **Shared Code Reviewer** | 最近の作業の中から、共有コードとして切り出す価値のあるものを探します。提案のみを行います。 |
| [`/test-audit`](#test-audit) | **Test Auditor** | 既存のテストを調べ、価値の低いもの、実装に強く依存しているもの、重複したものを見つけます。承認したバッチ以外は、報告のみを行います。 |
| [`/landing-report`](#landing-report) | **Ship Queue Dashboard** | ワークスペースを考慮した出荷キューを、読み取り専用で表示します。どのバージョン枠が確保されているか、どの兄弟ワークスペースに作業中のものがあるかを示します。 |
| [`/benchmark-models`](#benchmark-models) | **Model Benchmark** | スキルのクロスモデル比較ベンチマークです(Claude と GPT と Gemini)。レイテンシ、トークン、コスト、任意で LLM による品質評価を並べて示します。 |
| [`/eval-plan`](#eval-plan) | **Eval Planner** | 有料の評価を事前登録します(合格基準、比較アーム、デコイ、停止ルール)。スタブモデルで費用ゼロのドライランを行い、3件の有料パイロットを実行してから、推定表をもとに支出を承認します。 |
| | | |
| **Multi-AI** | | |
| [`/codex`](#codex) | **Second Opinion** | OpenAI Codex によるレビュー、チャレンジ、相談です。Codex のハーネス以外でも利用できます。 |
| [`/claude-code`](#claude-code) | **Second Opinion** | Claude Code によるレビュー、チャレンジ、相談です。Claude Code のハーネス以外でも利用できます。Codex での自動の外部レビューにも使われます。 |
| [`/pair-agent`](#browse) | **Remote Agent Bridge** | リモートの AI エージェント(OpenClaw、Codex、Cursor、Hermes)を、gstack 独自のブラウザにペアリングします。スコープ付きのトンネル、許可リストの固定、セッショントークンを使います。フォールバックブラウザ用のスキルです。Aside を操作するエージェントは、自分のタブを開きます。 |
| [`/setup-gbrain`](#setup-gbrain) | **Memory Sync** | gbrain を設定し、マシンをまたいだセッションメモリの同期を行います。ゼロから稼働まで、一つのコマンドで完了します。 |
| [`/sync-gbrain`](#sync-gbrain) | **Keep Brain Current** | このリポジトリのコードに合わせて gbrain を更新します。エージェントに、Grep ではなく `gbrain search` や `code-def` を使うべきタイミングを教えます。冪等なので、何度実行しても安全です。 |
| | | |
| **Safety & Utility** | | |
| [`/careful`](#safety--guardrails) | **Safety Guardrails** | 破壊的なコマンド(rm -rf、DROP TABLE、強制プッシュ、git reset --hard)の前に警告します。中程度の警告は上書きできます。ルートやホームの再帰削除、デフォルトブランチへの強制プッシュは、ハードに拒否されます。一般的なビルドの後片付けは許可リストに入っています。 |
| [`/freeze`](#safety--guardrails) | **Edit Lock** | ファイルの編集を1つのディレクトリに限定します。その外側での Edit、Write、NotebookEdit をブロックします。デバッグ中の事故防止に役立ちます。 |
| [`/guard`](#safety--guardrails) | **Full Safety** | `/careful` と `/freeze` を一つのコマンドにまとめたものです。本番作業のための最大限の安全策です。 |
| [`/unfreeze`](#safety--guardrails) | **Unlock** | `/freeze` の境界を解除し、どこでも再び編集できるようにします。 |
| [`/open-gstack-browser`](#open-gstack-browser) | **GStack Browser** | gstack 独自のブラウザを、ヘッドありで起動します。サイドバー、アンチボット対策のステルス機能、自動のモデルルーティング、Cookie のインポート、Claude Code との連携を備えています。フォールバックエンジンの見える顔です。Aside を開いていれば、エージェントのタブをそこで確認できます。 |
| [`/setup-deploy`](#setup-deploy) | **Deploy Configurator** | `/land-and-deploy` のための一度きりのセットアップです。プラットフォーム、本番環境の URL、デプロイコマンドを検出します。 |
| [`/gstack-upgrade`](#gstack-upgrade) | **Self-Updater** | gstack を最新バージョンに上げます。グローバルとベンダリングのどちらでインストールされているかを検出し、両方を同期して、何が変わったかを表示します。 |
| [`/make-pdf`](#make-pdf) | **PDF Generator** | 任意の Markdown ファイルを、出版品質の PDF に変換します。余白、ページ番号、表紙、クリック可能な目次を備えます。Mermaid や excalidraw のフェンスはベクターの図として描画されます。他の形式には `--to html\|docx` を使います。印刷は Aside ブラウザ(macOS 15 以降)で行い、Aside がない場合は gstack 同梱のブラウザを使います。 |
| [`/diagram`](#diagram) | **Diagram Maker** | 英語で依頼すると図が出てきます。Mermaid のソース、編集可能な `.excalidraw` ファイル(excalidraw.com で手描き風に開けます)、レンダリング済みの SVG と PNG を出力します。完全にオフラインで動作します。 |
| [`/ios-qa`](#ios-qa) | **iOS QA Lead** | USB の CoreDevice トンネルと組み込みの StateServer を使って、実機の iOS を QA します。Swift のソースを読み、アクセサを生成し、実際の iPhone や iPad を操作します。必要に応じて、Tailscale を通じてリモートエージェントにデバイスを公開できます。 |
| [`/ios-fix`](#ios-fix) | **iOS Autonomous Fixer** | 実機の iPhone で「発見→修正→検証」のループを閉じます。再現するスナップショットを取得し、ソースを修正し、再ビルドして再デプロイし、検証します。 |
| [`/ios-design-review`](#ios-design-review) | **iOS Designer's Eye** | 実機の iPhone で、Apple HIG に基づく 10 観点の監査を行います。各画面を評価し、10 点にするには何が必要かを示します。 |
| [`/ios-clean`](#ios-clean) | **iOS Bridge Cleanup** | DebugBridge の SPM と `#if DEBUG` の配線を取り除くための便利なラッパーです。Release ビルドを守る構造的なガードは Package.swift と CI にあります。このスキルは手動での案内付き削除のためのものです。 |
| [`/ios-sync`](#ios-sync) | **iOS Bridge Resync** | 最新の上流の gstack に合わせて、アクセサと Swift テンプレートを再生成します。新しい `@Observable` クラスを追加したときや、gstack をアップグレードしたときに実行します。 |

---

## `/office-hours`

ここからすべてのプロジェクトを始めるべきです。

プランを立てる前、レビューする前、コードを書く前に、YC スタイルのパートナーと腰を据えて、実際に何を作ろうとしているのかを考えてください。作っていると思っているものではなく、*本当に*作ろうとしているものです。

### 捉え直し

実際のプロジェクトでの話です。ユーザーは「カレンダー用の毎日のブリーフィングアプリを作りたい」と言いました。もっともな依頼です。そこでスキルは、痛みについて尋ねました。仮定の話ではなく、具体的な例です。ユーザーは、アシスタントが物事を取りこぼすこと、複数の Google アカウントにまたがる予定の情報が古いこと、AI が作った質の低い準備資料、場所が間違っていて、特定に何時間もかかった予定について話しました。

返ってきた答えはこうでした。*「枠組みに異を唱えさせてください。あなたはもうその枠を超えていると思います。あなたは『複数の Google カレンダーを管理する毎日のブリーフィングアプリ』と言いました。しかし、あなたが実際に説明しているのは、個人向けの AI チーフ・オブ・スタッフです。」*

続いてスキルは、ユーザーが自覚していなかった5つの機能を抽出しました。

1. **カレンダーを監視する**:すべてのアカウントを対象に、古い情報、欠けた場所、権限の不足を検出します
2. **実際の準備作業を生成する**:ロジスティクスの要約ではなく、役員会、ポッドキャスト、資金調達イベントに向けた*知的な準備作業*です
3. **CRM を管理する**:誰に会うのか、どんな関係か、相手が何を求めているのか、これまでの経緯は何か
4. **時間を優先順位づけする**:準備を早めに始める必要があるタイミングを知らせ、先回りして時間を確保し、予定の重要度を順位づけします
5. **お金でレバレッジを買う**:仕事を委任したり自動化したりできる方法を積極的に探します

この捉え直しで、プロジェクト全体が変わりました。ユーザーはカレンダーアプリを作ろうとしていました。いまでは、その10倍は価値のあるものを作っています。スキルが機能要望ではなく、ユーザーの痛みに耳を傾けたからです。

### 前提の検証

捉え直しのあと、スキルは検証してもらうための前提を提示します。「これで良さそうですか?」ではなく、プロダクトについての反証可能な主張です。

1. カレンダーは中心となるデータソースだが、価値は上に載る知性のレイヤーにある
2. アシスタントは置き換えられるのではなく、強化される
3. 最も狭い切り口は、本当に機能する毎日のブリーフィングである
4. CRM 連携は「あれば良い」ではなく、必須である

同意する、反対する、調整する、のいずれかを選んでください。同意した前提はすべて、設計ドキュメントの中で重い意味を持ちます。

### 実装の代替案

次に、2〜3 の具体的な実装アプローチを、誠実な工数の見積もりとともに生成します。

- **アプローチ A:毎日のブリーフィングを先に**:最も狭い切り口で、明日にでも出せます。工数 M(人間:約 3 週間 / CC:約 2 日)
- **アプローチ B:CRM を先に**:先に関係性のグラフを作ります。工数 L(人間:約 6 週間 / CC:約 4 日)
- **アプローチ C:フルビジョン**:すべてを一度に作ります。工数 XL(人間:約 3 か月 / CC:約 1.5 週間)

実際に使うことで学べるため、A を推奨します。CRM のデータは 2 週目には自然に集まります。

### 2 つのモード

**スタートアップモード**:事業を立ち上げる創業者や社内起業家向けです。YC のパートナーがプロダクトを評価する方法から抽出した6つの強制質問が得られます。需要の現実、現状維持、切実な具体性、最も狭い切り口、観察と驚き、将来への適合です。これらの質問はあえて居心地の悪いものにしています。製品を必要としている具体的な人間を一人も挙げられないなら、コードを書く前に最も重要なことを学んだことになります。

**ビルダーモード**:ハッカソン、個人のサイドプロジェクト、オープンソース、学習、楽しむことが目的の場合向けです。アイデアの最もクールな形を一緒に探してくれる、熱のこもった協力者が得られます。何があれば「おお」と言わせられるか? 共有できるものにたどり着く最短の道は何か? 質問は詰問ではなく、発想を広げるためのものです。

### 設計ドキュメント

どちらのモードも、`~/.gstack/projects/` に書かれる設計ドキュメントで終わります。そのドキュメントは `/plan-ceo-review` と `/plan-eng-review` に直接渡されます。全体の流れは今や次のとおりです:`office-hours → plan → implement → review → QA → ship → retro`。

設計ドキュメントが承認されたあと、`/office-hours` は、あなたの考え方について気づいたことを振り返ります。一般的な褒め言葉ではなく、セッション中に言ったことへの具体的な言及です。その観察は設計ドキュメントにも載るので、後で読み返したときにもう一度目にすることになります。

---

## `/plan-ceo-review`

これは私の**創業者モード**です。

ここでは、モデルに趣味の良さ、野心、ユーザーへの共感、長い時間軸をもって考えてほしいのです。依頼を文字どおりに受け取ってほしくありません。もっと重要な問いを先に立ててほしいのです。

**このプロダクトは、そもそも何のためにあるのか?**

私はこれを**ブライアン・チェスキーモード**と呼んでいます。

目的は、わかりきったチケットを実装することではありません。ユーザーの視点から問題を捉え直し、自然で、心地よく、少し魔法のように感じられる、そのような形を見つけることです。

### 例

Craigslist 風の出品アプリを作っていて、次のように言ったとします。

> 「売り手が商品の写真をアップロードできるようにして。」

弱いアシスタントは、ファイル選択と画像の保存を追加するでしょう。

それは本当のプロダクトではありません。

`/plan-ceo-review` では、「写真のアップロード」が本当に機能なのかを問いたいのです。本当の機能は、*実際に売れる*出品をつくるのを助けることなのかもしれません。

その仕事が本当にそれなら、プラン全体が変わります。

このときモデルは次のように問うべきです。

* 写真から商品を特定できるか?
* 型番や SKU を推定できるか?
* Web を検索して、タイトルと説明文を自動で下書きできるか?
* 仕様、カテゴリ、価格の比較対象を取得できるか?
* どの写真が最も売れやすいか、メイン画像として提案できるか?
* アップロードされた写真が、暗い、雑然としている、信頼感が低いといった問題を検出できるか?
* 2007 年の死んだフォームのようではなく、上質に感じられる体験にできるか?

`/plan-ceo-review` がしてくれるのはこういうことです。

「この機能をどう追加するか?」だけを問うのではありません。

問うのは **「この依頼の中に隠れている 10 つ星のプロダクトは何か?」** です。

### 4 つのモード

- **SCOPE EXPANSION**:大きく夢を見ます。エージェントは野心的なバージョンを提案します。拡張のひとつひとつを、あなたが選ぶ個別の判断として提示します。積極的に推奨します。
- **SELECTIVE EXPANSION**:現在のスコープを基準として保ちつつ、ほかに何が可能かを見ます。エージェントは機会を一つずつ、中立的な推奨とともに提示します。やる価値のあるものを、あなたが選びます。
- **HOLD SCOPE**:既存のプランに対して最大限の厳密さを求めます。拡張は提示しません。
- **SCOPE REDUCTION**:最小限の実行可能なバージョンを見つけます。それ以外はすべて削ります。

ビジョンと判断は `~/.gstack/projects/` に保存され、会話が終わっても残ります。優れたビジョンは、チームのために、リポジトリの `docs/designs/` に昇格させることができます。

---

## `/plan-eng-review`

これは私の**エンジニアリングマネージャーモード**です。

プロダクトの方向性が正しくなったら、まったく別の種類の知性が必要です。これ以上広がりすぎるアイデア出しは要りません。「こんなのできたら面白くない?」ももう要りません。モデルに、最高の技術リードになってほしいのです。

このモードでしっかり押さえてほしいのは次のとおりです。

* アーキテクチャ
* システムの境界
* データフロー
* 状態遷移
* 障害モード
* エッジケース
* 信頼の境界
* テストのカバレッジ

そして、思いがけず大きな転機になったのが **図**です。

LLM は、システムを図に描くよう強制されると、はるかに完全になります。シーケンス図、状態図、コンポーネント図、データフロー図、さらにはテストのマトリクスまで。図は隠れた前提を表に出します。曖昧な計画を立てることを格段に難しくします。


だから `/plan-eng-review` は、プロダクトのビジョンを支えられる技術的な背骨を組み立てる場所だと考えています。

### 例

同じ出品アプリの例で考えてみます。

`/plan-ceo-review` がすでに役割を果たしたとします。本当の機能は写真のアップロードだけではないと決めました。次のことをする、スマートな出品フローです。

* 写真をアップロードする
* 商品を特定する
* Web から出品情報を補う
* 強いタイトルと説明文を下書きする
* 最適なメイン画像を提案する

ここで `/plan-eng-review` の出番です。

このときモデルには、次のような問いに答えてほしいのです。

* アップロード、分類、情報の補完、下書き生成のアーキテクチャはどうなっているか?
* どの処理が同期で、どの処理がバックグラウンドジョブになるか?
* アプリサーバー、オブジェクトストレージ、画像認識モデル、検索・補完 API、出品データベースの境界はどこか?
* アップロードは成功したが補完が失敗したら、何が起きるか?
* 商品の特定の確信度が低かったら、どうなるか?
* リトライはどう動くか?
* ジョブの重複をどう防ぐか?
* いつ何が永続化され、何を安全に再計算できるか?

そして、ここで図の出番です。アーキテクチャ図、状態モデル、データフロー図、テストのマトリクス。図は隠れた前提を表に出します。曖昧な計画を立てることを格段に難しくします。

これが `/plan-eng-review` です。

「アイデアを小さくする」ではありません。
**アイデアを作れる形にする**のです。

呼び出し方について一点。プランモードでは、このスキルは「何をレビューしますか?」というスコープの質問を省き、有効なプランを自動でレビューします。選んだ対象は「Scope gate: plan mode — auto-selected B」のように一行で知らせるので、別のものに変えたければ指示できます。対象を明示的に名指しすれば(例: PLAN.md)、どのモードでもその指定が優先されます。プランモード以外で、何も指定していない場合は、先に質問します。このゲートは確実に止まります。

<a id="review-readiness-dashboard"></a>
### レビュー準備ダッシュボード

すべてのレビュー(CEO、エンジニアリング、デザイン)は結果を記録します。各レビューの終わりに、ダッシュボードが表示されます。

```
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review          | Runs | Last Run            | Status    | Required |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  1   | 2026-03-16 14:30    | CLEAR     | no       |
| Design Review   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
```

Eng Review は唯一の必須ゲートです(`gstack-config set skip_eng_review true` で無効にできます)。CEO と Design は参考情報で、それぞれプロダクトと UI の変更に推奨されます。

差分のレビューは、`gstack-review-read` が算出する `review_freshness` の等級を使います。これは `/ship` と `/land-and-deploy` で共有されます。CURRENT となるには、クリーンで、レビュアーが完了と報告し、収束した実行であり、かつ取得した開始時と終了時のフィンガープリントが現在の作業ツリーの内容と一致している必要があります。追跡されている編集と、無視されていない未追跡のソースの両方が対象です。同じコミットハッシュや、レビュー以降のコミットがゼロであることは代替になりません。

取得された実行で開始時と終了時の内容が異なれば STALE になります。以前に検証された実行のフィンガープリントが一致しなくなった場合も STALE です。開始レシートの欠落や再利用、ログのみの古い記録、未完了や未収束の実行、未解決の指摘は、CURRENT にはなれません。根拠が欠けていれば UNVERIFIED です。出荷のテレメトリはレビューの実行ではありません。修正のあとは、新しい開始レシートを伴う本物の全体の再レビューを行ってください。結果をログに残すためだけにレシートを取得するのは駄目です。完了はあくまでレビュアーの申告であり、モデルがソースを実際に読んだことの独立した証明ではありません。

プランファイルのレビューは、既存の7日間の鮮度の扱いと、任意のプランハッシュの比較を保ちます。リポジトリの内容に関するルールは適用されません。差分のレビューは、ダッシュボードの既存の経過時間とクリーン状態の要件に加えて、Eng Review を通すために CURRENT と判定される必要があります。

### プランから QA への流れ

`/plan-eng-review` がテストのレビューの節を終えると、テストプランの成果物を `~/.gstack/projects/` に書き出します。あとで `/qa` を実行すると、そのテストプランを自動的に拾います。エンジニアリングのレビューが、手作業のコピー＆ペーストなしで QA のテストに直接つながります。

---

## `/plan-design-review`

これは私の**プランをレビューするシニアデザイナー**です。コードを一行も書く前に行います。

多くのプランは、バックエンドが何をするかは書いてあっても、ユーザーが実際に何を見るかは決めていません。空の状態は? エラーの状態は? 読み込み中の状態は? モバイルのレイアウトは? AI っぽさのリスクは? こうした決定は「実装中に考えよう」と先送りされ、結局エンジニアは、誰も指定しなかったために「アイテムが見つかりません。」を空の状態として出荷してしまいます。

`/plan-design-review` は、計画の段階でこれらすべてを捉えます。修正のコストが低いうちにです。

`/plan-ceo-review` や `/plan-eng-review` と同じように動きます。対話型で、一度に一つの課題を扱い、**STOP + AskUserQuestion** のパターンを使います。各デザインの観点を 0〜10 で評価し、10 点とは何かを説明し、そこに到達するようにプランを編集します。評価が作業量を決めます。評価が低ければ修正は多く、高ければ軽い確認で済みます。`/plan-eng-review` と同様に、プランモードでは「何をレビューしますか?」の質問を省き、有効なプランを自動的に対象にします(一行で知らせるので、変更できます)。名指しされた対象は、どのモードでも優先されます。

プランを7つのパスで確認します。情報設計、インタラクション状態のカバレッジ、ユーザーの流れ、AI っぽさのリスク、デザインシステムとの整合、レスポンシブとアクセシビリティ、未解決のデザイン判断です。各パスでギャップを見つけ、明白なものは直接修正し、本当のトレードオフがあるものは、デザインの選択をあなたに求めます。

### 例

```
You:   /plan-design-review

Claude: Initial Design Rating: 4/10

        "This plan describes a user dashboard but never specifies
         what the user sees first. It says 'cards with icons' —
         which looks like every SaaS template. It mentions zero
         loading states, zero empty states, and no mobile behavior."

        Pass 1 (Info Architecture): 3/10
        "A 10 would define primary/secondary/tertiary content
         hierarchy for every screen."
        → Added information hierarchy section to plan

        Pass 2 (Interaction States): 2/10
        "The plan has 4 UI features but specifies 0 out of 20
         interaction states (4 features × 5 states each)."
        → Added interaction state table to plan

        Pass 4 (AI Slop): 4/10
        "The plan says 'clean, modern UI with cards and icons'
         and 'hero section with gradient'. These are the top 2
         AI-generated-looking patterns."
        → Rewrote UI descriptions with specific, intentional alternatives

        Overall: 4/10 → 8/10 after fixes
        "Plan is design-complete. Run /design-review after
         implementation for visual QA."
```

もう一度実行すると、8 点以上のセクションは軽く確認され、8 点未満のセクションは本格的に扱われます。実装後にライブサイトのビジュアル監査を行うなら、`/design-review` を使ってください。

---

## `/design-consultation`

これは私の**デザインパートナーモード**です。

`/plan-design-review` は既にあるサイトを監査します。`/design-consultation` は、まだ何もないときのためのものです。デザインシステムも、フォントの選択も、カラーパレットもありません。ゼロからの出発であり、シニアデザイナーと一緒に座って、ビジュアルのアイデンティティ全体を組み立てたいときのためのものです。

これはフォームではなく、対話です。エージェントはプロダクト、ユーザー、オーディエンスについて尋ねます。プロダクトが何を伝える必要があるか(信頼、スピード、丁寧な作り、温かさなど、何が合うか)を考え、そこから具体的な選択に逆算します。そうして、一貫したデザインシステムを提案します。美的な方向性、タイポグラフィ(役割の決まった3つ以上のフォント)、HEX 値を伴うカラーパレット、スペーシングのスケール、レイアウトのアプローチ、モーションの方針です。どの提案にも根拠が付きます。どの選択も、ほかのすべての選択を強化します。

しかし、一貫性は最低条件にすぎません。どのダッシュボードツールも似て見えます。すっきりしたサンセリフ、抑えたグレー、青のアクセント。どれも一貫していて、どれも忘れられます。プロダクトが「いい感じ」に見えるのと、人々に実際に認識されるのとの違いは、**意図的な創造的リスク**にあります。見出しに使う意外なセリフ体、そのカテゴリで誰も使っていない大胆なアクセント、データを空っぽではなく信頼できるものに見せる、詰まったスペーシングです。

`/design-consultation` が本当に扱うのは、そこです。安全なシステムを提案するだけではありません。安全な選択と、リスクの両方を提案し、どちらがどちらかを示します。「ここが、そのカテゴリで体裁を保つための選択です。そして、ここで慣習から外れるべきだと私が考える理由です。」あなたが、どのリスクを取るかを選びます。エージェントは、どちらを選んでもシステム全体が一貫していることを確認します。

希望すれば、エージェントは、あなたの分野にすでに何があるかを調べます。実在するサイトのスクリーンショットを撮り、フォント、色、スペーシングを分析します。これは真似をするためではありません。どこに相場があり、慣習が何かを知り、そのうえでどの慣習を破る価値があるかを決めるためです。

システムに合意すると、エージェントは対話型の HTML プレビューページを生成します。色見本やフォントのサンプルだけではなく、現実的なプロダクトのページを見せます。ダッシュボードを作るなら、サイドバー、データテーブル、統計カードのあるダッシュボードが表示されます。マーケティングサイトなら、実際のコピーと CTA を持つヒーローセクションが表示されます。すべてがデザインシステムで描画され、あなたのプロダクト名が入り、ライトモードとダークモードの両方で見られます。本番のコードが一行も書かれる前に、プロダクトがどう感じられるかが分かります。

そのあと、エージェントはリポジトリのルートに `DESIGN.md` を書き出します。これがプロジェクトのデザインに関する信頼できる情報源です。そして `CLAUDE.md` を更新するので、今後のすべての Claude Code のセッションがそのシステムを尊重します。それ以降、`/design-review` はそれに対して監査でき、フロントエンドに関わるどのエージェントも、ルールを知っています。

このファイルは、オープンな DESIGN.md 形式([google-labs-code/design.md](https://github.com/google-labs-code/design.md))で書かれます。すべてのトークンは YAML のフロントマター(`colors`、`typography`、`rounded`、`spacing`、`components`)に置かれ、根拠は仕様の正規のセクションに書かれます。そのため、impeccable、Google Stitch など、この形式を読むものはすべて同じファイルを共有できます。すでに従来の gstack の `DESIGN.md` がある場合、スキルは一度だけ変換を提案します(バックアップは残ります)。そして、あなたの回答をファイルに記録するので、二度と尋ねません。リポジトリのルートに `PRODUCT.md` があれば、プロダクトに関する質問を聞き直す代わりに、その内容で事前に埋めます。

### 例

```
You:   /design-consultation

Claude: From the README, this looks like a developer analytics dashboard
        for engineering teams. Sound right? Tell me about the feeling
        you want — and would you like me to look at what's out there
        first so we can see the landscape?

You:    Yes, it's for eng managers. Show me what's out there.

Claude: [browses Linear, Vercel, Datadog, Posthog — takes screenshots]

        Here's the landscape. They all converge on clean sans-serifs
        and muted blue-gray palettes. Linear stands out with dark-first
        and tight spacing. The rest feel interchangeable.

        Here's my proposal — and where I'd play it safe vs. take risks:

        AESTHETIC: Industrial/Utilitarian — data-first, every pixel earns its place
        TYPOGRAPHY: Geist (body + UI), Instrument Serif (display), JetBrains Mono (data)
        COLOR: Restrained — slate neutrals, single teal accent (#0D9488)
        SPACING: 4px base, compact density
        LAYOUT: Grid-disciplined, 12-column
        MOTION: Minimal-functional — only transitions that aid comprehension

        SAFE CHOICES (match category expectations):
          Geist for body — your users already know this font from Vercel
          Slate neutrals — warm grays feel right for data-heavy UIs
          Grid-disciplined layout — dashboards need predictable alignment

        RISKS (where you'd stand out):
          Instrument Serif for display headings — nobody in dev tools
            uses a serif. It creates instant hierarchy contrast and
            signals "we care about craft" in a space full of sans-serifs.
          Single teal accent instead of blue — everyone else in this space uses blue.
            Teal is close enough to feel trustworthy, different enough
            to be recognizable.
          4px compact density — tighter than Linear, says "we respect
            your screen real estate."

        The safe choices keep you literate. The risks are where your
        product gets its own face. Which risks appeal to you?

You:    Love the serif risk. Let's see it.

Claude: Preview opened in your browser.
        [/tmp/design-consultation-preview-1710000000.html]

        The page shows a realistic dashboard: sidebar nav, header with
        avatar, stat cards, data table — all in your design system.
        Instrument Serif at hero scale, Geist in body text, JetBrains
        Mono in the data table. Teal accent on buttons and active states.
        Light and dark mode toggle in the corner.

        How does it feel? Want to adjust anything before I write DESIGN.md?

You:    Ship it.

Claude: Wrote DESIGN.md (typography, color, spacing, layout, motion).
        Updated CLAUDE.md with design system guidelines.
        All future sessions will respect these choices.
```

---

## `/design-review`

これは私の**コードを書くデザイナーモード**です。

`/plan-design-review` は実装の前にプランをレビューします。`/design-review` は、そのあとに稼働中のサイトを監査して修正します。

Aside ブラウザで、ライブサイトに対して80項目のビジュアル監査を実行します。ログイン中のあなたが見るのとまったく同じものを見ます。そのあと修正ループに入ります。デザイン上の検出結果ごとに、ソースファイルを特定し、CSS やスタイルの最小限の変更を行い、`style(design): FINDING-NNN` としてコミットし、再度ナビゲートして検証し、修正前後のスクリーンショットを撮ります。修正ごとに1つのコミットで、完全にバイセクト可能です。

自己調整のヒューリスティックはデザインの作業向けに調整されています。CSS だけの変更は、本質的に安全で元に戻せるため、リスクの予算を消費しません。ただし、コンポーネントの JSX や TSX ファイルへの変更は、リスクの予算に数えられます。修正数は 30 件で打ち止めです。リスクスコアが 20% を超えたら、止まって確認します。

**デザイン検出器。** [impeccable](https://impeccable.style) がインストールされていれば、そのエンジンが最初に走ります。URL に対しては、ページのレンダリング済み DOM をダンプし(リンクされたスタイルはインライン化されます)、スキャンします。URL のないフィーチャーブランチでは、変更されたフロントエンドのファイルをスキャンします(`.dart` ファイルは除きます。フロントエンドの範囲には含まれますが、エンジンは Web のソースを読みます)。機械的に検出されたものはすべて、ルール ID(`[nested-cards]`、`[low-contrast]`)付きの `FINDING-NNN` として届き、レポートの最後に `Detector: N → M` が表示されます。gstack が impeccable のインストーラーを実行することはありません。エンジンがない場合は、一度だけ、エンジンのバイナリをダウンロードするかを尋ねます(チェックサムで固定され、egress の台帳に記録されます)。答えは覚えておきます。エンジンがなければ、監査は変わりません。`gstack-config set design_detector off` で、この事前スキャンを無効にできます。

### 例

```
You:   /design-review https://myapp.com

Claude: [Runs full 80-item visual audit on the live site]
        Design Score: C  |  AI Slop Score: D
        12 findings (4 high, 5 medium, 3 polish)

        Fixing 9 design issues...

        style(design): FINDING-001 — replace 3-column icon grid with asymmetric layout
        style(design): FINDING-002 — add heading scale 48/32/24/18/16
        style(design): FINDING-003 — remove gradient hero, use bold typography
        style(design): FINDING-004 — add second font for headings
        style(design): FINDING-005 — vary border-radius by element role
        style(design): FINDING-006 — left-align body text, reserve center for headings
        style(design): FINDING-007 — add hover/focus states to all interactive elements
        style(design): FINDING-008 — add prefers-reduced-motion media query
        style(design): FINDING-009 — set max content width to 680px for body text

        Final audit:
        Design Score: C → B+  |  AI Slop Score: D → A
        9 fixes applied (8 verified, 1 best-effort). 3 deferred.

        [Report with before/after screenshots saved to .gstack/design-reports/]
```

コミットは9件で、それぞれが1つの関心事だけに触れています。AI Slop のスコアが D から A になったのは、最も見覚えのあるパターン三つ(グラデーションのヒーロー、3 列のグリッド、一様な角丸)がなくなったからです。

---

## `/design-shotgun`

これは私の**デザイン探索モード**です。

あなたも覚えがあるはずです。機能、ページ、ランディング画面があって、どう見せるべきか確信がない。Claude に説明すれば、答えは一つ返ってくるでしょう。しかし答えが一つでは、視点も一つです。デザインは趣味の勝負です。選択肢を見る必要があります。

`/design-shotgun` は、GPT Image API を使ってビジュアルデザインの案を 3 つ生成し、比較ボードをブラウザで開き、フィードバックを待ちます。方向性を選んでもいいし、変更を依頼してもいいし、まったく新しい案を求めてもいいです。ボードは、リミックス、再生成、承認のアクションに対応しています。

### ループ

1. 作りたいものを説明する(または既存のページを指定する)
2. スキルは、ブランドの制約について `DESIGN.md` を読む(存在する場合)
3. 3 つの異なるデザイン案を PNG として生成する
4. 3 つを並べた比較ボードがブラウザで開く
5. 気に入ったものの「Approve」をクリックするか、次のラウンドのためのフィードバックを出す
6. 承認された案は、`approved.json` とともに `~/.gstack/projects/$SLUG/designs/` に保存される

その `approved.json` は、`/design-html` に渡す方法の一つです。デザインのパイプラインは連鎖します。shotgun が方向性を選び、design-html がそれを動くコードとして描画します。ただし `/design-html` は、CEO のプラン、デザインレビュー、あるいは単なる説明からでも動きます。

### テイスト・メモリ

このスキルは、セッションをまたいであなたの好みを覚えます。いつもミニマルなデザインを選ぶなら、以降の生成をその方向に寄せます。これは設定項目ではありません。承認の積み重ねから自然に生まれるものです。

### 例

```
You:   /design-shotgun — hero section for a developer tools landing page

Claude: [Generates 3 variants]
        Variant A: Bold typography, dark background, code snippet hero
        Variant B: Split layout, product screenshot left, copy right
        Variant C: Minimal, centered headline, gradient accent

        [Opens comparison board at localhost:PORT]

You:    [Clicks "Approve" on Variant A in the browser]

Claude: Approved Variant A. Saved to ~/.gstack/projects/myapp/designs/
        Next: run /design-html to generate production HTML from this mockup.
```

---

## `/design-html`

これは私の**デザインからコードへのモード**です。

AI によるコード生成ツールは、どれも静的な CSS を出力します。高さはハードコードされ、リサイズでテキストがはみ出し、ブレークポイントは滑らかに変わらずにガクッと切り替わります。出力は一つのビューポートサイズでだけ正しく見え、それ以外のあらゆるサイズで壊れます。

`/design-html` はこれを解決します。[Pretext](https://github.com/chenglou/pretext)(Cheng Lou 作。元 React コア、Midjourney のフロントエンド)を使って HTML を生成します。Pretext は 15KB のライブラリで、DOM の計測なしにテキストレイアウトを計算します。テキストは折り返し直され、高さはコンテンツに合わせて変わります。カードは自分でサイズを決め、チャットの吹き出しはぴったり縮みます。どれもミリ秒以下で、すべて動的です。

複数の入力元に対応しています。`/design-shotgun` の承認済みモックアップ、`/plan-ceo-review` の CEO プラン、`/plan-design-review` のデザインレビューの文脈、あなたが用意した PNG、あるいは欲しいものの説明だけでも構いません。どんな文脈が存在するかを検出し、どう進めるかを尋ねます。

### スマートな API ルーティング

どんなページにも、Pretext エンジンのフル機能が必要なわけではありません。スキルはデザインを読み取り、適切なツールを選びます。

- **シンプルなレイアウト**(ランディング、マーケティング):リサイズに対応した高さのために `prepare()` + `layout()`
- **カードのグリッド**(ダッシュボード、一覧):自分でサイズを決めるカードのために `prepare()` + `layout()`
- **チャット UI**:無駄なピクセルを残さない、ぴったり収まる吹き出しのために `walkLineRanges()`
- **エディトリアルのレイアウト**:障害物の周りを回り込むテキストのために `layoutNextLine()`
- **複雑なエディトリアル**:手動での行描画のために `layoutWithLines()` を使う、フル機能のエンジン

### 改良ループ

1. `approved.json` から承認済みモックアップを読む
2. GPT-4o のビジョンを使って、実装仕様(色、タイポグラフィ、レイアウト)を抽出する
3. Pretext をインラインで組み込んだ、自己完結型の HTML を生成する(15KB、ネットワーク依存なし)
4. ライブリロードのサーバーを立ち上げ、変更がすぐに見えるようにする
5. 3 つのビューポート(モバイル、タブレット、デスクトップ)でスクリーンショットを撮り、レイアウトを確認する
6. AskUserQuestion:何を変更するか?
7. Edit ツールによる外科的な編集を行う(全体の再生成はしない)
8. 「done」と言うまで繰り返す

**スロップのゲート。** [impeccable](https://impeccable.style) がインストールされていれば、完成したページは、検証用のスクリーンショットの前に、そのエンジンで一度スキャンされます。検出結果があれば、アドバイザリ以外のルールに対して一度だけ外科的な修正を行い、もう一度スキャンします。残ったものは「理由付きで受け入れた」ものとして提示されます(承認済みのモックアップに含まれている、`DESIGN.md` で許容されている、またはインラインの `impeccable-disable` コメントに同意した、のいずれか)。パスは一度きりで、ループにはなりません。impeccable がなければ、この手順は黙ってスキップされます。スキルの禁止リストには、検出器が報告するのと同じルール ID が、`lib/design-catalog.ts` から載っています。

### フレームワークの検出

プロジェクトが React、Svelte、Vue を使っている場合(`package.json` から検出)、スキルはバニラの HTML ではなく、フレームワークのコンポーネントを生成するか提案します。フレームワーク向けの出力は、インラインで同梱する代わりに `npm install @chenglou/pretext` を使います。

### 例

```
You:   /design-html

Claude: Found approved mockup: variant-A.png (hero section)
        Design type: simple layout → using prepare() + layout()

        [Generates HTML with Pretext, opens live-reload server]
        [Screenshots at 375px, 768px, 1440px — all verified]

        The HTML is live at localhost:3456. Resize your browser.
        Text reflows dynamically. What needs to change?

You:    Make the headline bigger and add more spacing below the CTA

Claude: [Edits font-size and margin, browser auto-reloads]
        Updated. Two changes applied.

You:    Done

Claude: Saved to ~/.gstack/projects/myapp/designs/hero-20260330/finalized.html
```

---

## `/review`

これは私の**偏執的なスタッフエンジニアモード**です。

テストが通っても、ブランチが安全だとは限りません。

`/review` が存在するのは、CI を通り抜けても、本番で容赦なく殴りつけてくるバグの一群があるからです。このモードは、より大きな夢を見ることや、プランをきれいに見せることが目的ではありません。問うのはこれです。

**まだ何が壊れうるか?**

これは文体の揚げ足取りではなく、構造の監査です。モデルには次のようなものを探してほしいのです。

* N+1 クエリ
* 古い読み取り
* 競合状態
* 悪い信頼の境界
* インデックスの欠落
* エスケープのバグ
* 壊れた不変条件
* 悪いリトライ・ロジック
* 本当の障害モードを見逃したまま通るテスト
* 忘れられた列挙型のハンドラー:新しいステータスや型の定数を追加すると、`/review` はコードベース中のすべての switch 文と許可リストをたどります。変更したファイルだけではありません

### Fix-First(先に修正)

指摘には、リストアップされるだけでなく、対処が付きます。明白な機械的修正(デッドコード、古くなったコメント、N+1 クエリ)は自動で適用されます。各修正について `[AUTO-FIXED] file:line Problem → what was done` が表示されます。判断が本当に曖昧な問題(セキュリティ、競合状態、デザイン上の判断)は、あなたの判断に回されます。

### 完了性のギャップ

`/review` は、完全な実装のコストが CC の作業時間で 30 分未満で済むのに、手抜きの実装になっている箇所を指摘するようになりました。80% の解を選んだのに、100% の解が海ではなく湖程度の大きさなら、レビューがそれを指摘します。

例外が一つあります。意図的に手抜きをして、それを記録した場合です。決定 ID が決定台帳で解決される `gstack-shortcut(dec-<id>)` のマーカーがあれば、その指摘は認識済みの負債に格下げされます。台帳に対応するエントリがない孤立したマーカーは、何も抑制しません。ギャップは通常どおり報告され、マーカー自体にも印が付きます。

**デザインのパス。** 差分がフロントエンドのファイルに触れると、デザインの専門担当が `review/design-checklist.md` を読みます。これは `lib/design-catalog.ts` から生成されるので、`/review`、`/ship`、`/design-review` は同じパターンに同じルール ID を付けて指摘します。impeccable がインストールされていれば、そのエンジンが変更されたフロントエンドのファイルを最初にスキャンします(`.dart` ファイルはチェックリストのパスだけになります)。その行は階層(自動修正、確認、可能性)ごとに分けられ、検出器のヒットとチェックリストのヒットが同じファイル:行で重なった場合は1行にまとめられます。リポジトリの `.impeccable/config*.json` の無視設定は、決着済みの判断として読まれます。なければ、チェックリストのパスだけが単独で動きます。

### 例

スマートな出品フローが実装され、テストはすべて緑だとします。

`/review` はそれでも次のことを問うべきです。

* 出品の写真や下書きの提案を描画するときに、N+1 クエリを発生させていないか?
* ファイルの実体を検証せず、クライアントが送ったファイルのメタデータを信頼していないか?
* 2 つのタブが競合して、表紙写真の選択や商品の詳細を上書きしないか?
* アップロードに失敗したファイルが、ストレージに永久に孤立して残らないか?
* 「メイン画像はちょうど1枚」というルールは、並行処理のもとで壊れないか?
* 補完 API が一部だけ失敗したとき、穏やかに縮退するか、それともゴミを保存するか?
* Web のデータを下書き生成に取り込んだことで、プロンプトインジェクションや信頼の境界の問題を生んでいないか?

それが `/review` の目的です。

ここではお世辞は要りません。
モデルに、インシデントが起きる前に本番の障害を想像させるのです。

---

## `/investigate`

何かが壊れていて、理由が分からないとき、`/investigate` が体系的なデバッガーです。鉄則に従います。**根本原因の調査なしに修正はしない**です。

推測してパッチを当てる代わりに、データフローをたどり、既知のバグのパターンと照合し、仮説を一度に一つずつ検証します。修正の試行が3回失敗したら、止まってアーキテクチャを疑います。これで、「もう一つだけ試してみよう」という、何時間も無駄にする悪循環を防げます。

---

## `/qa`

これは私の**QA リードモード**です。

`/browse` はエージェントに目を与えます。`/qa` は、テストの方法論を与えます。

最もよくあるユースケースはこうです。機能ブランチにいて、コーディングを終えたばかりで、すべてが動くことを確かめたい。`/qa` と言えばいいだけです。リクエスト、リポジトリの契約、テストプラン、差分を使って、ブラウザ、機能(API、CLI、ジョブ、ワーカー、Webhook)、あるいは両方の対象を選びます。URL も手作業のテストプランも要りません。ブラウザの対象では、該当するページを Aside のタブ(またはフォールバックのブラウザ)で開きます。機能だけの対象では、文書化されたネイティブコマンドと隔離されたローカルのフィクスチャを使い、ブラウザは起動しません。

深さは Full、Quick、Regression から選びます。差分ベースの選択が、テスト対象を決めます。

- **差分ベース**(機能ブランチでは自動):変更された挙動と隣接する挙動を選びます。単独で実行する `/qa` は、まず作業ツリーの汚れをコミット、スタッシュ、中止のいずれで扱うかを尋ね、結果のチェックアウトをテストします。ブラウザの対象では、影響を受けたページを特定し、それを個別にテストします。
- **Full**:ブラウザの QA はアプリ全体を体系的に探索します(通常 5〜15 分で、十分な証拠のある問題を 5〜10 件記録します)。機能の QA は、適用される文書化された契約を網羅し、ブロックされたものや未テストのものを別に報告します。
- **Quick**(`--quick`):ブラウザの QA は、30 秒のホームページと上位 5 件のナビゲーションのスモークテストを保ちます。機能の QA は、成功する操作と、最もリスクの高い変更された境界を確認し、それ以外の契約は「未実行」と表示します。
- **Regression**(`--regression <前回のレポートまたはベースライン>`):ブラウザの QA は Full モードで実行し、前回の `baseline.json` と差分を取ります。機能の QA は、読み取り可能な前回の機能レポートと再生のエビデンスを必要とし、失敗したプローブを意図された契約に対して繰り返し、そのあと変更された隣接する挙動を確認します。ブラウザだけのベースラインは、機能のベースラインではありません。

探索は書面の痕跡を残します。次の発見のプローブを行う前に、QA は所有するレポートディレクトリに `exploration-NNN.json` のチェックポイントを保存します。そこには、直前のコマンドと結果、仮説、次の正確なコマンドが記録されます。最終レポートは、それらのファイルにリンクします。`/qa-only` と、範囲を絞ったレビュー/出荷のパスは、同じエビデンスの契約を使います。ただし、プロダクトのコードやテストを編集する権限は得られません。

時間の上限には、チェックポイントとエビデンスの作業も含まれます。終わらなかったプローブは、未テストのまま残ります。新しい実行は、以前のレポートとベースラインを保存します。選択された出力ディレクトリにすでに成果物がある場合は、所有する新しい実行ディレクトリを使います。混在した実行では、ブラウザとは別に、機能の結果を同じレポートの別のセクションに置きます。ブラウザのスコアが機能のカバレッジに適用されることはありません。Quick と Regression の要求が矛盾する場合は、プローブを始める前に解決します。

### 自動の回帰テスト

再現された不具合については、`/qa` はインフラが利用できる場合にネイティブの回帰テストを書き、根本原因の修正の前に、そのテストがその不具合で失敗することを証明します。CSS だけの不具合では、ブラウザのエビデンスを使ってもかまいません。根本原因の修正のあとは、元のプローブ、隣接する正常系、そしてネイティブの回帰テスト(利用可能な場合)がすべて通ることを求めてから、修正が検証済みと呼びます。テストは QA レポートまでたどれます。`/qa-only` はそのケースを提案し、再生可能なエビデンスを保持できますが、プロダクトのコードやテストを変更することは決してありません。ネイティブのテストインフラがないことは、明示的なカバレッジの限界として扱われます。機能の QA のために新しいフレームワークを入れる許可にはなりません。

### 例

```
You:   /qa https://staging.myapp.com

Claude: [Explores 12 pages, fills 3 forms, tests 2 flows]

        QA Report: staging.myapp.com — Health Score: 72/100

        Top 3 Issues:
        1. CRITICAL: Checkout form submits with empty required fields
        2. HIGH: Mobile nav menu doesn't close after selecting an item
        3. MEDIUM: Dashboard chart overlaps sidebar below 1024px

        [Full report with screenshots saved to .gstack/qa-reports/]
```

**認証が必要なページのテスト:** Aside を使えば、設定は不要です。Aside はあなたのブラウザなので、`/qa` はすでにあなたのセッションを持っています。サインインの壁にぶつかったら、Aside の中でサインインして、完了したと伝えてください。そうすれば、そのステップを再実行します。パスワードを代わりに入力することは決してありません。フォールバックのブラウザでは、まず `/setup-browser-cookies` を実行して実際のセッションをインポートするか、ヘッドありのモードで一度ログインしてください。

---

## `/ship`

これは私の**リリースマシンモード**です。

何を作るかを決め、技術的なプランを固め、真剣なレビューを行ったら、もう議論は要りません。実行が欲しいのです。

`/ship` は最後の一区間のためのものです。準備の整ったブランチのためのものであり、何を作るかを決めるためのものではありません。

ここでモデルは、ブレインストームの相手であることをやめ、規律あるリリースエンジニアとして振る舞うべきです。main と同期し、適切なテストを実行し、ブランチの状態が健全であることを確かめ、リポジトリが求めるなら CHANGELOG やバージョンを更新し、プッシュして、PR を作成または更新します。

### テストのブートストラップ

プロジェクトにテストフレームワークがなければ、`/ship` が設定します。ランタイムを検出し、最適なフレームワークを調べ、インストールし、実際のコードに対する 3〜5 件の本物のテストを書き、CI/CD(GitHub Actions)を設定し、TESTING.md を作成します。目標は 100% のテストカバレッジです。テストがあれば、バイブコーディングが無謀なコーディングではなく、安全なものになります。

### カバレッジの監査

`/ship` を実行するたびに、差分からコードパスの地図を作り、対応するテストを探し、品質の星付きの ASCII のカバレッジ図を出力します。ギャップには、テストが自動生成されます。PR の本文にはカバレッジが表示されます。例えば `Tests: 42 → 47 (+5 new)` のように。

`/review` と `/ship` は、変更された挙動と近くのリスクに対して、範囲の限られた探索的パスも実行します。プランや Web サーバーがなく、差分が小さくてもです。既存の承認とテストのルールが、修正や恒久的なテストを規定します。ブロックされたプローブは、合格した QA の結果ではなく、カバレッジのギャップとして扱われます。

### レビューのゲート

`/ship` は、事前チェックの間に、過去のレビュー準備状況を [レビュー準備ダッシュボード](#review-readiness-dashboard) で表示します。Eng Review がない場合は、余計な質問なしに報告されます。それは、現在の出荷前レビューを置き換えたり免除したりするものではありません。ステップ 9 は、引き続きチェックリスト、該当する専門担当、範囲を限定した探索的 QA を実行し、既存の承認と完了のゲートに従います。

出荷で作業が終わった後に、退屈なリリース作業だけが残るブランチは多いものです。人間は、その部分を先延ばしにしがちです。AI がそうしてはいけません。

### バージョンの場所と、バージョンなしで出荷する場合

`/ship` は、プロジェクトがバージョンの場所を指定しているときだけバージョンを上げます。順番に次を確認します。

1. `gstack-version-bump` / `gstack-next-version` に渡された `--version-path <path>`
2. `.gstack/version-path`:バージョンファイルのリポジトリからの相対パスを一行で書いた、コミット済みのファイル(例:`package.json` や `apps/web/package.json`)。`.json` のパスは `"version"` フィールドとして読み書きされます。3 桁のセマンティックバージョンは 3 桁のままです。
3. ルートの `VERSION` ファイル(gstack 自身の 4 桁 `MAJOR.MINOR.PATCH.MICRO` 形式)

ルートの `package.json` だけでは数えられません。多くのアプリはそこにプレースホルダーを置いているからです。`/ship` にバージョンを管理させたいなら、`echo package.json > .gstack/version-path` を実行し、そのファイルをコミットしてください。

これらのどれも存在しない場合、`/ship` はバージョンを変えずに出荷します。バージョンのバンプはなく、CHANGELOG にバージョンの見出しもなく、`v1.2.3` のタイトルの接頭辞もなく、タグも付けません。次のように表示されます。

> バージョンを変えずに出荷しました: バージョンの取得元が設定されていません(VERSION ファイルも .gstack/version-path もありません)。リリースにバージョンを付けるには、VERSION ファイルを作成するか、バージョンファイルのパス(例: package.json)を .gstack/version-path に書いてください。

release-please、Changesets、semantic-release が設定されている場合、リポジトリがワークスペースのモノレポである場合、`package.json` に `0.0.0-development` のようなプレースホルダーが入っている場合も、同じように理由付きで出荷されます。それらのツールがバージョンを管理しているからです。`/land-and-deploy` と `/document-release` も同じ信号を読みます。設定されたバージョンファイルが存在しない、空、読めない、または形式が不正な場合は、`/ship` がそのファイルのパスと問題を示して止まります。gstack が `0.0.0.0` で代用することは決してありません。

### サードパーティの Web アクション(v1.72.0.0 以降)

リリース作業がターミナルの外に出ることがあります。API キーの登録、ベンダーアカウントの作成、Webhook や OAuth アプリの設定などです。`/ship`(および `/spec`、`/office-hours`、`/land-and-deploy`、`/setup-deploy`)は、手順の一覧を渡す代わりに、ブラウザの操作を代行するかを提案します。まず Aside を使います。Aside はあなたの実際のログイン済みセッションで動くため、ベンダーのダッシュボードにまさに必要なものです。Aside がない場合は、gstack 独自の見えるブラウザ(ヘッドありの `$B`、サインインのための引き継ぎ付き)がすべてのプラットフォームでのフォールバックになります。タスクごとに、aside.com(macOS 15 以降)への案内が一度だけ出ます。

同意のルールは厳格で、テストで固定されています。タスクごとに、対象のサイトと操作を正確に名指しした明示的な質問を一つだけ行います。常設の許可はありません。自動インストールは決して行いません(Aside のない Mac では、タスクごとに一度だけ、ダウンロードの案内が表示されるだけです)。パスワード、支払い、CAPTCHA、本人確認はあなたの担当のままです。Apple の認証情報の作成は、どのスキルでも操作の対象にはなりません。取得した機密情報がチャットに現れることは決してありません。所有者だけが読めるファイルに保存され、gstack が成功を宣言する前に、読み取り専用の API 呼び出しを 1 回行って検証されます。

---

## `/land-and-deploy`

これは私の**デプロイパイプラインモード**です。

`/ship` が PR を作成します。`/land-and-deploy` が仕事を完成させます。マージし、デプロイし、検証するのです。

PR の準備状況とマージの承認を確認してから、マージし、CI とデプロイを監視し、そのあと本番を確認します。デプロイが壊れた場合は、何が失敗したか、ロールバックが可能かを報告します。新しいリビジョンのデプロイが確認できない場合は、古いページが正常に表示されていることを証拠とみなすのではなく、その不確かさを報告します。

初回の実行時、またはデプロイの設定が変わったときは、ドライランのウォークスルーが走ります。取り返しのつかないことが起きる前に、パイプラインを確認できます。変更がなく、以前に確認された設定なら、そのウォークスルーはスキップされます。ただし、準備状況の確認とマージの承認は省略されません。承認は、正確な PR の HEAD と、マージ先のブランチに結び付けられます。どちらかが変わったら、準備状況と承認をやり直す必要があります。

### セットアップ

まず `/setup-deploy` を実行してください。プラットフォーム(Fly.io、Render、Vercel、Netlify、Heroku、GitHub Actions、またはカスタム)を検出し、本番の URL とヘルスチェックのエンドポイントを見つけ、設定を CLAUDE.md に書き出します。一度だけ、60 秒で終わります。

### 例

```
You:   /land-and-deploy

Claude: Merging PR #42...
        CI: 3/3 checks passed
        Deploy: Fly.io — deploying v2.1.0...
        Health check: https://myapp.fly.dev/health → 200 OK
        Canary: 5 pages checked, 0 console errors, p95 < 800ms

        Production verified. v2.1.0 is live.
```

---

## `/canary`

これは私の**デプロイ後の監視モード**です。

デプロイのあと、`/canary` はライブサイトで問題が起きていないかを見張ります。Aside ブラウザで主要なページを順に巡回します(ページごとに 1 つの `aside repl` スクリプトを使うので、どのサイクルも新しく読み込まれます)。コンソールエラー、パフォーマンスの劣化、ページの障害、見た目の異常を確認します。定期的にスクリーンショットを撮り、デプロイ前のベースラインと比較します。

`/land-and-deploy` の直後に使うか、リスクの高いデプロイのあとに定期的に実行するようスケジュールしてください。

```
You:   /canary https://myapp.com

Claude: Monitoring 8 pages every 2 minutes...

        Cycle 1: ✓ All pages healthy. p95: 340ms. 0 console errors.
        Cycle 2: ✓ All pages healthy. p95: 380ms. 0 console errors.
        Cycle 3: ⚠ /dashboard — new console error: "TypeError: Cannot read
                   property 'map' of undefined" at dashboard.js:142
                 Screenshot saved.

        Alert: 1 new console error after 3 monitoring cycles.
```

---

## `/deslop-shared-libs`

最近の作業の中から、共有コードとして切り出す価値のあるものを探します。標準では、直近 14 日(UTC)のコミットと PR、そして関連する現在のブランチの作業を見ます。既存のヘルパーを確認し、互換性のある作成者の呼び出し元を検証し、新しい候補を最大 5 件比べて、最大 3 件まで推奨します。見積もりにはテストと統合作業も含めます。そのため、コードを新しいファイルに移しただけでは、節約にはなりません。推奨が少なくても、まったくなくても、それは正しい結果です。

```text
You: /deslop-shared-libs
You: /deslop-shared-libs — focus on the API and workers over the past 30 days
```

レポートは、確認したソースにリンクし、最も小さく役に立つヘルパーとその呼び出し元の名前を挙げ、信頼性の向上と共有された障害のリスクを説明します。すでに PR でカバーされている作業は区別して示します。古いオープンな PR も、範囲の決まったスキャンの中で候補の重なりを確認し、アクセスできない履歴や不完全なカバレッジを開示します。プロジェクトのフックやフィルタを実行せずに、コミットされていない生のソースも読みます。コードを編集することも、プロジェクトのテストを実行することも、レポートを保存することも、Issue や PR を作成することもありません。

`/plan-eng-review` は、プランと提案された呼び出し元に同じ基準を当てます。`/review` は、どんなに小さな変更でも、差分と関連する呼び出し元を確認します。これらの範囲を限定したチェックでは、履歴の監査は実行しません。任意の抽出はアドバイザリであり、承認が必要です。クリーンなレビューをブロックしたり、スコアを下げたりはしません。実際の欠陥は、通常どおりの修正の扱いになります。

## `/test-audit`

コストが保護する価値を上回っているテストを見つけます。`/review`、`/ship`、`/qa`、`/plan-eng-review` は、差分にあるテストに対して同じ [テストの価値の基準](test-value-bar.md) を適用します。`/test-audit` は、すでに存在するテストを一通り調べます。

```text
You: /test-audit
You: /test-audit test/ --max-candidates 5
You: /test-audit --since origin/main
```

機械的な事前フィルタが、モデルが読む前に、アサーションのないプローブ、ソースの grep、エクスポートリストのコピー、ほぼ重複したファイルを候補として絞り込みます。各候補には、引退カードが付きます。何を検出しているか、テスト以外の呼び出し元(検索コマンド付き)、残っている強い証明、履歴、引退によって何が解放されるか、検証コマンドです。SKILL.md のゴールデンや、プロンプトのバイトの検証(英語の文ではなく、機械が読むトークン。[価値の基準](test-value-bar.md) を参照)のような契約テストは残します。レポートと JSON のサイドカーは `~/.gstack/projects/<slug>/` に保存されます。承認したバッチ以外は何も編集されません。生成されたセッションは、報告のみです。`gstack:test-value keep reason="..."` と印されたテストはスキップされ、レポートの付録に一覧されます。

## `/eval-plan`

最初の有料の呼び出しの前に、有料の評価を事前登録します。

```text
You: /eval-plan
You: /eval-plan how much will the retrieval eval cost before I run it?
```

`bin/gstack-eval-plan prereg --init` は事前登録(問い、合格基準、アーム、デコイ、停止ルール、上限)を書き出し、`--check` は項目が空の間は続行を拒否します(`PREREG_INCOMPLETE`)。`arms` は `eval-arms` のモデルの役割を `lib/pricing.ts` と照合し、価格のないモデルで停止します(`EVAL_PRICE_MISSING`)。`dry-run` は、すべての行をスタブモデルで費用ゼロで実行し、不正な行を検出します(`EVAL_DRY_RUN_FAILED`)。`pilot start|settle|release|report` は、有料の 3 件を実行し、実際の支出を記録し、全体に外挿して上限と比べ(`EVAL_BUDGET_EXHAUSTED`)、承認の質問で示される支出表を出力します。このスキルの締めくくりの節には、ティア 3 の項目(計測の監査、定常状態、封印されたパス、オフマシンでの永続化、メモリの事前確認、検出力の表、QA のソーク)が `tier 3, after P7` として並んでいます。それらはまだ一つも実行されていません。

## `/benchmark`

これは私の**パフォーマンスエンジニアモード**です。

`/benchmark` は、ページのベースラインのパフォーマンスを確立します。読み込み時間、Core Web Vitals(LCP、CLS、INP)、リソース数、転送サイズの合計です。PR の前後に実行して、性能の劣化を捉えてください。

Aside ブラウザで測定します。推定値ではなく、実際の読み込みでページ自身の `performance` のナビゲーションとリソースのエントリを使います。複数回の実行の平均です。結果は保存されるので、PR をまたいで傾向を追えます。

```
You:   /benchmark https://myapp.com

Claude: Benchmarking 5 pages (3 runs each)...

        /           load: 1.2s  LCP: 0.9s  CLS: 0.01  resources: 24 (890KB)
        /dashboard  load: 2.1s  LCP: 1.8s  CLS: 0.03  resources: 31 (1.4MB)
        /settings   load: 0.8s  LCP: 0.6s  CLS: 0.00  resources: 18 (420KB)

        Baseline saved. Run again after changes to compare.
```

---

## `/cso`

これは私の**最高セキュリティ責任者**です。

`/cso` を実行すると、アプリケーションのモデル、検証済みの指摘、明示的なカバレッジを伴う、範囲の限られた静的な調査が行われます。ランタイムやスキャナーのカタログプロファイルが認定されていない場合も、静的評価は利用できます。対応するプロファイルが認定されていれば、`/cso --comprehensive` は Node/Bun、Python、Rails のアプリケーションを隔離されたローカルのランタイムで準備し、欠陥を再現し、作業ブランチを変えずに、レビュー可能な修正の候補を残せます。外部のプロセスにある監視役が、外部のブート、正当な制御、セキュリティのアサーションを認証し、`runtime_tested` のバンドルを発行できます。対象コードがそのプロセスを共有し、レポーターの出力を偽装したり、ランナーを終了させたりできるため、プロジェクトのテストの完了は `self_reported` のままです。記録されたコマンド、件数、終了コード、出力のハッシュは診断用の証拠であり、対象に依存しない完了の証明ではありません。すべてのレポートは、アサーション、テストの完了、レビューの保証をそれぞれ別々に示します。`tested` の状態は、将来の対象に依存しない証明のために予約されており、現時点では出力されません。`/cso --doctor`、`--resume`、`--replay`、`--recheck` は、前提条件の診断、中断された作業の回復、記録された検証の再実行、新しい証拠に基づく現在のソースの完了の確立を行います。

```
You:   /cso

Claude: complete — assessed application routes, tenant authorization, secrets,
        dependency exposure, and deployment configuration.

        HIGH: Cross-tenant invoice access (app/controllers/invoices.rb:47)
        Confidence: high — caller, middleware, and policy checks traced
        Evidence: supported static finding; runtime not requested

        1 supported finding. Run ID: cso-…
```

---

## `/document-release`

これは私の**テクニカルライターモード**です。

`/ship` を実行するたびに(再実行や既存の PR の更新を含みます)、出荷が所有する `/document-release` の監査が、最終コミット、検証、公開の前に、関連する執筆済みのドキュメントを、コミット済みの変更と選択された未コミットの変更の両方に照らして確認します。明確な事実の訂正は、チェック済みの変更に加わります。versioning、Git、PR の公開は、出荷の親が担当します。ブロックされた、または不完全な監査は、回復するか、指摘された文書化のリスクを明示的に受け入れてから出荷する必要があります。黙って「最新」になることはありません。PR が存在したあとに、`/document-release` を単独で実行することもできます。そのワークフローは、独自の承認、コミット、PR 本文の手順を保持します。

```
You:   /document-release

Claude: Analyzing 21 files changed across 3 commits. Found 8 documentation files.

        README.md: updated skill count from 9 to 10, added new skill to table
        CLAUDE.md: added new directory to project structure
        CONTRIBUTING.md: current — no changes needed
        TODOS.md: marked 2 items complete, added 1 new item

        All docs updated and committed. PR body updated with doc diff.
```

また、CHANGELOG の文体を磨きます(既存のエントリを決して上書きしません)。完了した TODOS を整理し、ドキュメント間の一貫性を確認し、VERSION を上げるかどうかは、必要なときだけ尋ねます。

---

## `/retro`

これは私の**エンジニアリングマネージャーモード**です。

週の終わりには、実際に何が起きたかを知りたいものです。雰囲気ではなく、データで。`/retro` はコミット履歴、作業のパターン、出荷の速度を分析し、率直なふりかえりを書きます。

チームを考慮します。コマンドを実行している人を特定し、あなた自身の作業には最も深い分析を行い、そのあと全員の内訳を、具体的な賞賛と成長の機会とともに示します。コミット数、LOC、テストの比率、PR のサイズ、修正の比率といった指標を算出します。コミットのタイムスタンプからコーディングのセッションを検出し、ホットスポットのファイルを見つけ、出荷の連続記録を追跡し、今週いちばん大きな出荷を特定します。

テストの健全性も追跡します。テストファイルの総数、この期間に追加されたテスト、回帰テストのコミット、傾向の差分です。テストの比率が 20% を下回ったら、成長の領域として指摘します。

### 例

```
You:   /retro

Claude: Week of Mar 1: 47 commits (3 contributors), 3.2k LOC, 38% tests, 12 PRs, peak: 10pm | Streak: 47d

        ## Your Week
        32 commits, +2.4k LOC, 41% tests. Peak hours: 9-11pm.
        Biggest ship: one browser contract for every browser skill (Aside).
        What you did well: shipped a complete feature with encryption, UI, and
        18 unit tests in one focused push...

        ## Team Breakdown

        ### Alice
        12 commits focused on app/services/. Every PR under 200 LOC — disciplined.
        Opportunity: test ratio at 12% — worth investing before payment gets more complex.

        ### Bob
        3 commits — fixed the N+1 query on dashboard. Small but high-impact.
        Opportunity: only 1 active day this week — check if blocked on anything.

        [Top 3 team wins, 3 things to improve, 3 habits for next week]
```

次回の実行で傾向を示せるように、JSON のスナップショットを `.context/retros/` に保存します。

---

## `/browse`

これは私の**QA エンジニアモード**です。

`/browse` は、ループを閉じるスキルです。これがなかったころのエージェントは、考えてコードを書くことはできても、半分は盲目でした。UI の状態、認証のフロー、リダイレクト、コンソールエラー、空の状態、壊れたレイアウトについて推測するしかありませんでした。いまは、ただ見に行けます。

[Aside](https://aside.com) の AI ブラウザ(あなたの実際のブラウザで、実際のログイン済みセッションを持っています)を、`aside repl` のスクリプトで操作します。Playwright 風の JavaScript で、タブを開き、作業をし、証拠をラベル付きの行として出力し、タブを閉じます。スクリプトは 1 回に 1 つのフローで、呼び出し間で状態を持ち越さず、取り込むものは何もありません。ほかのすべてのブラウザ系スキル(`/qa`、`/qa-only`、`/design-review`、`/canary`、`/benchmark`、`/scrape`)は、同じ契約の上に作られています。`/scrape` はデータ抽出版です。ページを指定すると、表、リスト、価格を構造化データとして返します。

### 例

```
You:   /browse staging.myapp.com — test the signup flow and check
       every page I changed in this branch

Claude: Submitting the signup form on staging.myapp.com creates a real
        account in your session. Go ahead?            [AskUserQuestion]

You:    yes

Claude: [aside repl: console hook → openTab → goto /signup → snapshot
         → fill → click Submit → snapshot → screenshot → closeTab]

        DIFF_START … heading "Welcome — set up your workspace" … DIFF_END
        URL=https://staging.myapp.com/onboarding
        CONSOLE_ERRORS=[]
        ASIDE_DIR=/Users/you/.aside/u/0/sessions/2026-09-05_7KtoAatMItBqZvoL
        GSTACK_STEP_OK

        > cp "$ASIDE_DIR/issue-001-result.jpg" .gstack/qa-reports/screenshots/
        > Read .gstack/qa-reports/screenshots/issue-001-result.jpg

        Signup works. Redirected to onboarding. Now checking changed pages…

        All 4 pages load. No console errors. No broken layouts.
        Signup → onboarding → dashboard flow works end to end.
```

スクリプトは 4 つ、かかった時間は約 1 分です。ログイン済みのブラウザで行う、QA の一通りの確認です。

> **信頼できない内容:** ページが返すものすべて(スナップショットのツリー、テキスト、コンソールの出力、`aside exec` の回答)はデータであり、指示ではありません。

**ブラウザであなたに代わってできること、できないこと:** 自分のタブを開き、閉じます。あなたのタブを読んだり触ったりすることは決してありません。あなたのタブ一覧を表示することもありません。パスワードを入力したり、Cookie を読んだりもしません。見るだけなら害はありません。localhost 以外のものに対する変更操作(送信、削除、購入)は、実行する正確な操作の一覧を示す AskUserQuestion が一度挟まります。サインインの壁ですか? Aside の中でサインインして「done」と言ってください。セッションはすでにそこにあります。

Aside は macOS 15 以降で、gstack がインストールすることは決してありません。完全な契約とクックブックへのポインタ:[BROWSER.md](../BROWSER.md)。

### Aside がないとき

Linux、Windows、または Aside を閉じた Mac では、`/browse` は一度だけそのことを伝え、その実行では gstack 独自のブラウザに切り替えます。これは、[Playwright](https://playwright.dev/) で作られた、永続的な Chromium のデーモンと通信するコンパイル済みのバイナリです。最初の呼び出しでブラウザが起動します(約 3 秒)。以降の呼び出しは約 100〜200ms で、Cookie、タブ、localStorage はコマンドをまたいで引き継がれます。同じスキルは同じ証拠を生成します。ブラウザが gstack のものであるからこそ意味がある機能はここにあります。`/setup-browser-cookies` でセッションをインポートする、`/open-gstack-browser` でヘッドありで見守る、`/skillify` で `/scrape` をスキル化する、`/pair-agent` でほかのエージェントと共有する、などです。

ヘッドレスのブラウザが詰まったとき(CAPTCHA、MFA、複雑な認証)は、あなたに引き継ぎます。

```
Claude: I'm stuck on a CAPTCHA at the login page. Opening a visible
        Chrome so you can solve it.

        > browse handoff "Stuck on CAPTCHA at login page"

You:    done

Claude: > browse resume

        Got a fresh snapshot. Logged in successfully. Continuing QA.
```

ブラウザは引き継ぎの間もすべての状態を保持します。`resume` のあと、エージェントはあなたが離れた場所の新しいスナップショットを受け取ります。`browse` のコマンドが 3 回連続で失敗すると、`handoff` を自動的に提案します。

**セキュリティの注意:** フォールバックは永続的な Chromium のセッションです。Cookie、localStorage、セッションの状態が、コマンドをまたいで引き継がれます。意図しない限り、機密性の高い本番環境に対して使わないでください。セッションは、30 分間アイドルになると自動的に終了します。`$B` の完全なコマンドリファレンス:[BROWSER.md](../BROWSER.md#the-fallback-engine--complete-reference)。

---

## `/setup-browser-cookies`

これは私の**セッションマネージャーモード**です。フォールバックのブラウザのためのものです。Aside を開いていれば、`/qa` と `/browse` は実際のセッションのなかで動くので、このスキルの出番はありません。

gstack 独自のブラウザで認証を伴うテストをするには、`/setup-browser-cookies` が、普段使っているブラウザから選んだ Cookie をコピーします。サイトによっては、ストレージのコピーや新しいログインが必要な場合もあります。そのため、Cookie をコピーしたことは、セッションが機能するという証明にはなりません。

ピッカーは、Chrome、Chromium、Brave、Edge、Windows 限定の Opera と Opera GX、macOS 限定の Comet、Arc、Dia を検出します。ブラウザ、アカウントやプロファイル、ドメインを選びます。プロファイルのラベルは、現在の `Local State` の名前と、ディレクトリを区別する識別子を使います。そのため、名前を変えたプロファイルや同名のプロファイルを区別できます。Cookie の値は表示されません。ただし、ソースとプロファイルのラベルは依然として機密です。

```
You:   /setup-browser-cookies

Claude: Cookie picker opened. Select your browser, profile, and domains,
        then tell me when you're done.

        [You choose a browser/profile and pick github.com, myapp.com]

You:    done

Claude: Imported 2 domains (47 cookies). Sign-in has not been checked.
```

直接インポートする場合は、先にブラウザとプロファイルを選び、対応する対象に移動します。CLI の従来の Comet の既定値から、アカウントを推測しないでください。

```
You:   /setup-browser-cookies github.com from Chrome, Profile 2

Claude: Imported 12 cookies; sign-in has not been checked.
```

`--verify-auth` は明示的に指定するもので、デーモンの環境で、セレクタと期待されるアイデンティティを、デーモンの起動前に非公開で設定しておく必要があります。HTTP 200 や Cookie の件数ではなく、取得した対象の上で、ひとつの正確に表示されたアイデンティティを確認します。設定がなければ、変更の前に失敗します。`--clear-storage` は別の、オプトインの Chromium 対象向けの回復手段です。取得したオリジンの localStorage(そのオリジンのタブ全体で共有されます)と、対象タブの sessionStorage だけを、隔離されたワールドでネイティブの期限付きでクリアします。ほかのブラウザエンジンでは、インポートと認証の確認は残りますが、リセットは拒否されます。自動では決して行われず、`--all` と組み合わせることもできません。一部だけのインポートや、成功しなかった確認は、「準備完了」に化けることなく、見えたままになります。

macOS では、キーチェーンの承認を求められることがあります。Linux は、サポートされているキーリングやフォールバックのパスを使います。Windows は、DPAPI と互換性のある Cookie をインポートできますが、ネイティブの App-Bound Encryption の抽出は、認定されるまで無効のままです。Chrome を閉じても、Chrome 136 以降のデフォルトのディレクトリの保護は回避できません。サインインは、ヘッドありのフォールバックブラウザで手動で行うのが、表示が使えるときの方法です。TCP のダウングレードや、実際のプロファイルのコピーは決して行いません。フラグ、設定、プライバシーの手引きの全体:[cookie インポートのリファレンス](../BROWSER.md#choosing-a-source-and-checking-sign-in)。

---

## `/make-pdf`

任意の Markdown ファイルを、出版品質の PDF に変換します。適切な余白、ページ番号、表紙、クリック可能な目次、Mermaid と excalidraw のフェンスをベクターの図として描画し、ほかの形式が必要なときは `--to html|docx` を使えます。コンパイル済みの `pdf` バイナリが組版を行い、印刷はブラウザで行われます。まず Aside ブラウザです。make-pdf は、完成した HTML をあなたのマシンからループバックで配信し、Aside が終わったら閉じるタブで開き、ブラウザ自身の PDF エンジンで印刷し(タグ付き PDF、文書のアウトライン、ヘッダーとフッターのテンプレートがすべて保たれます)、ファイルを取り出します。何も箱の外には出ません。Aside がない場合(Linux、Windows、またはアプリを閉じている場合)、同じパイプラインが gstack 同梱のブラウザで印刷するので、どのプラットフォームでも PDF が得られます。フェンスと形式の完全なガイド:[howto-diagrams-and-formats.md](howto-diagrams-and-formats.md)。

---

## `/diagram`

英語で入力すると、図が出てきます。図を説明する(または mermaid のソースを貼る)と、3 つのセットが得られます。mermaid のソース、編集可能な `.excalidraw` ファイル(excalidraw.com で手描き風に開けます)、レンダリング済みの SVG と PNG です。mermaid と excalidraw のランタイムは `lib/diagram-render/` に同梱されており、`bin/gstack-render.ts` で描画されます。これは make-pdf と同じ一つのレンダリングスクリプトです。Aside ブラウザが開いていればそれで、そうでなければ gstack 同梱のブラウザで描画されます。そのため、どのプラットフォームでも完全にオフラインで動きます。

---

## `/autoplan`

これは私の**レビューの自動操縦モード**です。

`/plan-ceo-review`、次に `/plan-design-review`、次に `/plan-eng-review` を個別に実行すると、15〜30 個の中間の質問に答えることになります。どの質問も価値はありますが、すべての判断で止まらずに、一通りの流れを走らせたいこともあります。

`/autoplan` は、レビューのスキルをディスクから読み込み、順番に実行します。CEO → デザイン(UI の範囲がある場合)→ DX(開発者向けの範囲がある場合)→ エンジニアリングです。エンジニアリングは必ず最後に実行されます。必須の出荷ゲートが、古いものではなく、最終的に修正されたプランをレビューするためです。判断は自動で行われます。各質問は、既定では推奨される選択肢に解決されます。6 つの判断原則が、タイブレークを担い、推奨のない質問を決めます。完全性を優先する、既存のパターンに合わせる、元に戻せる選択肢を選ぶ、似た過去の判断であなたが選んだ選択肢を優先する、曖昧な項目は保留する、セキュリティはエスカレーションする、です。テイストの判断(僅差のアプローチ、境界線上の範囲の拡大、モデル間の意見の相違)は、保存されて、最終の承認ゲートで提示されます。

コマンドは一つ。レビュー済みのプランが一つ出てきます。

```
You:   /autoplan

Claude: Running CEO review... [4 scope decisions auto-resolved]
        Running design review... [3 design dimensions auto-scored]
        Running eng review... [2 architecture decisions auto-resolved]

        TASTE DECISIONS (need your input):
        1. Scope: Codex suggested adding search — borderline expansion. Add?
        2. Design: Two approaches scored within 1 point. Which feels right?

        [Shows both options with context]

You:    1) Yes, add search. 2) Option A.

Claude: Plan complete. 9 decisions auto-resolved, 2 taste decisions approved.
```

---

## `/learn`

これは私の**組織の記憶モード**です。

gstack は、すべてのセッションから学びます。パターン、落とし穴、好み、アーキテクチャの判断。それらは `~/.gstack/projects/$SLUG/learnings.jsonl` に蓄積されます。それぞれの学びには、確信度、出典の帰属、参照するファイルが付きます。

`/learn` を使うと、gstack が吸収した内容を確認し、特定のパターンを検索し、古くなったエントリを整理(参照するファイルが削除されていたら)でき、チームで共有するために学びをエクスポートできます。本当の魔法は、ほかのスキルにあります。推奨を出す前に、それらは自動的に過去の学びを検索し、過去の知見が関係するときには「過去の学びを適用」と表示します。

```
You:   /learn

Claude: 23 learnings for this project (14 high confidence, 6 medium, 3 low)

        Top patterns:
        - [9/10] API responses always wrapped in { data, error } envelope
        - [8/10] Tests use factory helpers in test/support/factories.ts
        - [8/10] All DB queries go through repository pattern, never direct

        3 potentially stale (referenced files deleted):
        - "auth middleware uses JWT" — auth/middleware.ts was deleted
        [Prune these? Y/N]
```

---

## `/open-gstack-browser`

これは私の**同席モード**です。フォールバックのブラウザのためのものです。Aside を開いていれば、エージェントのタブは Aside の中で見えています。このスキルは、ブラウザが gstack 独自のものであるときに、それを見守る方法です。

Aside がなければ、`/browse` は既定でヘッドレスで動きます。エージェントが見ているものは見えません。`/open-gstack-browser` がそれを変えます。Playwright で操作される GStack Browser(アンチボット対策のステルス機能を持つ Chromium を改名したもの)を、サイドバーの拡張機能を自動で読み込んで起動します。エージェントの操作をリアルタイムで見られます。

サイドバーのチャットは、ブラウザを操作する Claude のインスタンスです。適切なモデルに自動でルーティングします。ナビゲーションや操作(click、goto、fill、screenshot)には Sonnet、読解や分析(summarize、find bugs、describe)には Opus を使います。サイドバーのフッターから、ワンクリックで Cookie をインポートできます。ブラウザは、ウィンドウが開いているあいだ動き続けます。ヘッドありのモードでは、アイドルのタイムアウトはありません。メニューバーには「Chrome for Testing」ではなく「GStack Browser」と表示されます。

サイドバーのエージェントには、多層のプロンプトインジェクション対策が組み込まれています。ローカルの 22MB の ML 分類器が、すべてのページとツールの出力をスキャンします。Haiku によるトランスクリプトの確認が、会話全体について投票します。カナリアトークンが、セッションの流出の試みを捕捉します。判定の統合器は、ブロックする前に 2 つの分類器の一致を求めます。ヘッダーの盾のアイコンが状態(緑、黄、赤)を示します。詳細は [ARCHITECTURE.md](../ARCHITECTURE.md#prompt-injection-defense-sidebar-agent) にあります。

```
You:   /open-gstack-browser

Claude: Launched GStack Browser with sidebar extension.
        Anti-bot stealth active. All $B commands run in headed mode.
        Type in the sidebar to direct the browser agent.
        Sidebar model routing: sonnet for actions, opus for analysis.
```

---

## `/setup-deploy`

一度だけのデプロイ設定です。最初の `/land-and-deploy` の前に実行してください。

プラットフォーム(Fly.io、Render、Vercel、Netlify、Heroku、GitHub Actions、またはカスタム)を自動で検出し、本番の URL、ヘルスチェックのエンドポイント、デプロイの状態を確認するコマンドを見つけます。すべてを CLAUDE.md に書き出すので、以後のデプロイはすべて自動になります。

```
You:   /setup-deploy

Claude: Detected: Fly.io (fly.toml found)
        Production URL: https://myapp.fly.dev
        Health check: /health → expects 200
        Deploy command: fly deploy
        Status command: fly status

        Written to CLAUDE.md. Run /land-and-deploy when ready.
```

「まだ何もデプロイしていない」と答えた場合、`/setup-deploy` は何も書かずに止まります。記録すべき本番のデプロイがないからです。[最初の本番デプロイの立ち上げ方](./howto-bring-up-a-first-deploy.md) が最初のステップを説明しています。アプリが公開されたら、もう一度 `/setup-deploy` を実行してください。

---

## `/codex`

これは私の**セカンドオピニオンモード**です。

`/codex` は、OpenAI Codex CLI を使って、同じ差分を独立してレビューします。Codex 自身のハーネス以外のすべてのハーネスで利用できます。外部のハーネスでは `/gstack-codex` としてインストールされます。Codex の指摘と、ネイティブのレビューの指摘を比べると、両方が指摘した確かなものと、片方だけが見つけたものを区別できます。

役割を指定しない場合、gstack 管理の Codex の呼び出しは、リクエストごとに選ばれたモデルを使い、次に `GSTACK_CODEX_MODEL`、次に Codex のネイティブ設定を使い、最後に `gpt-6-astra` にフォールバックします。これは、再開された相談にも適用されます。生成されるコマンドは、選択を `-c model=...` で渡し、その呼び出しに限って CLI に設定されたモデルを上書きします。ネイティブのレビューでは、`-c review_model=...` にも同じ選択を設定し、別のレビュー用のモデルの固定を上書きします。

Codex のホストでは、Claude の外部視点のスキルは `gstack-claude-code` です。そのレビュー、チャレンジ、相談の呼び出しは、Claude に設定されたモデルをそのまま保ちます。`GSTACK_CLAUDE_MODEL=<model>` は明示的な上書きを提供します。再開されたセッションにも効きます。リクエストで名指しされたモデルは、それより優先されます。ハーネスのルーティングは、モデルの選択とは独立しています。

明示的な `--role plan-review` は、代わりに設定されたプラン・レビューの階層を使います。リクエストと環境の上書きは依然として優先されます。`host` モードでは、ネイティブの選択に戻ります。固定、優先順位、復旧については [モデルのポリシー](model-policy.md) を参照してください。

### 3 つのモード

**Review**:現在の差分に対して `codex review` を実行します。Codex は変更されたすべてのファイルを読み、深刻度(P1 重大、P2 高、P3 中)で指摘を分類し、PASS/FAIL の判定を返します。P1 の指摘が 1 件でもあれば FAIL です。レビューは完全に独立しており、Codex は Claude のレビューを見ません。

深刻度ゲートの PASS は、[レビューの鮮度](#review-readiness-dashboard) とは別物です。未解決の記録された指摘(`findings > findings_fixed`。`findings_fixed` が欠けている場合はゼロとして扱います)があれば、ゲートが通っても CURRENT にはなりません。これは深刻度ゲートを変えるものではありません。修正後の作業ツリーが CURRENT と判定されるには、依然として、完了し、変更のない新しいレビューの実行が必要です。

**Challenge**:敵対的なモードです。Codex は積極的にあなたのコードを壊しにかかります。エッジケース、競合状態、セキュリティの穴、負荷のもとで失敗しそうな前提を探します。あなたのロジックに対する侵入テストのようなものだと考えてください。

**推論の努力**:Review と Challenge は `high`、Consult は `medium` で実行されます。`gstack-config set codex_effort <level>` は、すべての実行に対してこれを変更します。`--effort <level>` は、`/codex` のすぐ後、またはそのモードの語の後に、先頭のフラグ(`-m`、`--model`、`--role`)と並べて指定すると、一回の実行だけ変更します(例:`/codex review --effort medium` は、より速く、より安いレビューになります)。`--xhigh` は `--effort xhigh` の短縮形です。知らないレベルを指定すると、Codex を実行する前に止まります。レベルと優先順位については [モデルのポリシー](model-policy.md#reasoning-effort) を参照してください。

**Consult**:セッションの継続性を持つ、オープンな会話です。コードベースについて、何でも Codex に尋ねられます。フォローアップの質問は同じセッションを再利用するので、文脈が引き継がれます。「この考え方で合っているだろうか?」という瞬間に最適です。

### モデル横断の分析

`/review`(Claude)と `/codex`(OpenAI)の両方が同じブランチをレビューすると、モデル横断の比較が得られます。どの指摘が重なるか(確度が高い)、どれが Codex だけのものか(別の視点)、どれが Claude だけのものかが分かります。これは「二人の医者、同じ患者」というコードレビューのやり方です。

```
You:   /codex review

Claude: Running independent Codex review...

        CODEX REVIEW: PASS (3 findings)
        [P2] Race condition in payment handler — concurrent charges
             can double-debit without advisory lock
        [P3] Missing null check on user.email before downcase
        [P3] Token comparison not using constant-time compare

        Cross-model analysis (vs /review):
        OVERLAP: Race condition in payment handler (both caught it)
        UNIQUE TO CODEX: Token comparison timing attack
        UNIQUE TO CLAUDE: N+1 query in listing photos
```

---

## `/claude-code`

gstack を Codex の中で実行するとき、外部のレビュー担当は Claude Code が務めます。ほかの非 Claude のハーネスも、明示的な要求のためにこのスキルを公開しています。Claude Code 自身のハーネスでは、このスキルは含まれません。外部のハーネスでは `/gstack-claude-code` としてインストールされます。

**Review** は、読み取り専用で合否を判定するために、ブランチの差分を提供します。**Challenge** は、同じ差分の中で具体的な失敗ケースを見つけるよう Claude Code に依頼します。**Consult** は、読み取り専用のリポジトリの探索をサポートし、`.context/claude-session-id` に保存されたセッションを再開します。Review と Challenge は、親のワークフローから文脈を受け取り、ツールなしで実行されます。相談は、ファイルを読んだり検索したりできます。

Claude Code の CLI がインストールされ、認証されている必要があります。役割を指定しない場合、既存のモデル設定が尊重されます。明示的な `--role plan-review` は [モデルのポリシー](model-policy.md) に従います。`GSTACK_CLAUDE_BIN` / `GSTACK_CLAUDE_BIN_ARGS` の実行ファイルの上書きは引き続き有効です。エラー、タイムアウト、無効な応答は、クリーンなレビューとしてではなく、外部のカバレッジが欠けていたと報告されます。自動レビューは毎回新しく始まります。相談のセッションの継続性は明示的です。

外部レビューのルーティングは、設定されたモデルとは独立に、ハーネスに従います。一般的なセカンドオピニオンの要求は、Codex 上では `/claude-code`、それ以外では `/codex` を選びます。プロバイダーを明示した要求は、そのプロバイダーのままです。既存の `codex_reviews` の設定は、そのワークフローがすでに使っている場合に、選ばれた自動レビュー担当を制御します。既存のオプトインとスキップの制御は、オフィスアワー、デザイン、仕様のワークフローでも引き続き適用されます。

`/claude` は、エイリアスなしで `/claude-code` に改名されました。管理されているインストールを移行するには、`./setup --host <name>` を実行してください。同じチェックアウトを共有しているインストールも含まれます。セットアップは、置き換えの生成やインストールに失敗した場合、動作している古いインストールを残します。

## 安全ガードレール

どの Claude Code のセッションにも安全のための柵を加える、4 つのスキルです。Claude Code の PreToolUse フックを通じて動作します。透過的で、セッション単位で、設定は不要です。

### `/careful`

本番環境の近くで作業しているとき、破壊的なコマンドを実行するとき、あるいは安全網が欲しいときには、「be careful」と言うか `/careful` を実行してください。すべての Bash と PowerShell のコマンドが、既知の危険なパターンと照合されます。

- `rm -rf` / `rm -r`:再帰的な削除
- `DROP TABLE` / `DROP DATABASE` / `TRUNCATE`:データの消失
- `git push --force` / `git push -f`:履歴の書き換え
- `git reset --hard`:コミットの破棄
- `git checkout .` / `git restore .`:コミットされていない作業の破棄
- `kubectl delete`:本番リソースの削除
- `docker rm -f` / `docker system prune`:コンテナやイメージの消失

Windows では、同じフックが Claude Code の PowerShell ツールと、Bash から起動された `pwsh`、`powershell`、`cmd` を確認します。`-Recurse` と `-Force`(任意のパラメータの接頭辞)を伴う `Remove-Item` とその別名、cmd の `rd /s` と `del /s`、`Format-Volume`、`Clear-Disk`、`Clear-Content`、.NET の削除は確認を求めます。エンコードされた動的な PowerShell(`-EncodedCommand`、`iex`、シェルの `Start-Process`、`& $cmd`)は、検査できないため確認を求めます。PowerShell のカバレッジはベストエフォートです。確実に止めるには、`"PowerShell(Remove-Item *)"` のような Claude Code のパーミッションの拒否ルールを使ってください。

一般的なビルド成果物の後片付け(`rm -rf node_modules`、`dist`、`.next`、`__pycache__`、`build`、`coverage`)は許可リストに入っています。日常的な操作で誤警告が出ることはありません。

中程度の警告は、いずれも上書きできます。2 つの壊滅的な形は、確認ではなく、ハードに拒否されます。ファイルシステムのルートやホームディレクトリの再帰削除(`/*`、`~/`、`$HOME/` の形も含みます)と、リポジトリの既定のブランチへの強制プッシュです(`--force-with-lease` は拒否を引き起こしません。抜け道は、セッション単位の `/careful` を終了することです)。`~/.gstack/careful-patterns.txt`(グローバル)または `~/.gstack/projects/<slug>/careful-patterns.txt`(プロジェクト単位)に、独自の警告ルールを 1 行に 1 つの POSIX ERE で追加できます。カスタムのパターンが追加するのは警告だけで、組み込みのものを抑制することはありません。これらのガードレールは事故の防止であり、アクセス制御ではありません。

### `/freeze`

すべてのファイル編集を 1 つのディレクトリに制限します。請求のバグをデバッグしているとき、Claude が `src/auth/` の無関係なコードを誤って「修正」するのは避けたいものです。`/freeze src/billing` は、そのパスの外側への Edit、Write、NotebookEdit(Jupyter ノートブックの操作)をすべてブロックします。

`/investigate` は、これを自動的に有効にします。デバッグしているモジュールを検出し、そのディレクトリへの編集を凍結します。

```
You:   /freeze src/billing

Claude: Edits restricted to src/billing/. Run /unfreeze to remove.

        [Later, Claude tries to edit src/auth/middleware.ts]

Claude: BLOCKED — Edit outside freeze boundary (src/billing/).
        Skipping this change.
```

注意:これは Edit と Write のツールだけをブロックします。`sed` のような Bash のコマンドは、境界の外のファイルを依然として変更できます。事故を防ぐための仕組みであり、セキュリティのサンドボックスではありません。

### `/guard`

フルセーフティモードです。`/careful` と `/freeze` を 1 つのコマンドにまとめたものです。破壊的なコマンドの警告と、ディレクトリに限定した編集の両方が得られます。本番に触れるとき、あるいは稼働中のシステムをデバッグするときに使ってください。

### `/unfreeze`

`/freeze` の境界を取り除き、どこでも再び編集できるようにします。フックはセッションの間も登録されたままですが、すべてを許可するだけになります。新しい境界を設定するには、もう一度 `/freeze` を実行してください。

---

## `/gstack-upgrade`

gstack を最新の状態に、ワンコマンドで保ちます。インストールの種類を検出します(`~/.claude/skills/gstack` のグローバルか、`.claude/skills/gstack` のプロジェクト内へのベンダリングか)。アップグレードを実行し、二重にインストールしている場合は両方のコピーを同期し、何が変わったかを表示します。

```
You:   /gstack-upgrade

Claude: Current version: 0.7.4
        Latest version: 0.8.2

        What's new:
        - Browser skills now drive your Aside browser
        - /codex multi-AI second opinion
        - /qa always uses browser now
        - Safety skills: /careful, /freeze, /guard
        - Proactive skill suggestions

        Upgraded to 0.8.2. Both global and project installs synced.
```

`~/.gstack/config.yaml` に `auto_upgrade: true` を設定すると、確認なしで済みます。新しいバージョンがあるときは、セッションの開始時に gstack が静かにアップグレードします。

---

## Greptile 連携

[Greptile](https://greptile.com) は YC 発の企業で、PR を自動でレビューしてくれます。レースコンディション、セキュリティの問題、CI は通るのに本番で壊れるもの、といった本物のバグを捕まえます。何度も本当に助けられました。大好きなサービスです。

### セットアップ

[greptile.com](https://greptile.com) で、GitHub リポジトリに Greptile をインストールしてください。30 秒ほどで終わります。PR をレビューし始めたら、gstack が自動でそのコメントを拾います。追加の設定は不要です。

### 仕組み

自動のレビュー担当に共通する問題は、トリアージです。Greptile は優秀ですが、すべてのコメントが本物の問題とは限りません。誤検知もあります。3 コミット前にすでに直したものを指摘してくることもあります。トリアージの層がなければ、コメントは溜まっていき、やがて無視するようになります。それでは目的が台無しです。

gstack はそれを解決します。`/review` と `/ship` は、Greptile を認識します。Greptile のコメントを読み、それぞれを分類し、行動します。

- **有効な指摘**は、重大な指摘に加えられ、出荷の前に修正されます
- **すでに修正済みの指摘**には、捕捉に感謝する自動返信がつきます
- **誤検知**は押し返されます。あなたが確認すると、なぜ間違いなのかを説明する返信が送られます

結果は二層のレビューになります。Greptile が非同期で PR 上の問題を捕まえ、そのあと `/review` と `/ship` が、通常のワークフローの一部として、それらの指摘をトリアージします。取りこぼしはありません。

### 履歴から学ぶ

あなたが確認した誤検知はすべて、`~/.gstack/greptile-history.md` に保存されます。以降の実行では、そのリポジトリで既知の誤検知のパターンを自動でスキップします。さらに `/retro` は、Greptile の打率を時系列で追跡するので、シグナルとノイズの比率が改善しているかどうかを確認できます。

### 例

```
You:   /ship

Claude: [syncs main, runs tests, pre-landing review...]

        Greptile found 3 comments on this PR:

        [VALID] app/services/payment_service.rb:47 — Race condition:
        concurrent charges can double-debit. Recommend DB-level advisory
        lock around the charge block.

        [ALREADY FIXED] app/models/user.rb:12 — Missing null check
        on email before downcase.
        → Already fixed in commit abc1234. Auto-replying.

        [FALSE POSITIVE] lib/auth.rb:88 — "Token comparison should
        use constant-time comparison." We already use
        ActiveSupport::SecurityUtils.secure_compare here.

        Fixing the race condition in payment_service.rb...

        The auth token comment is a false positive.
        Options: A) Reply to Greptile explaining  B) Fix anyway  C) Ignore

You:    A

Claude: Replied to Greptile. All tests pass.
        PR: github.com/you/app/pull/42
```

3 件の Greptile のコメント。実際の修正が 1 件。自動で認識されたものが 1 件。誤検知が 1 件で、理由を説明する返信で押し返しました。追加にかかった時間は、約 30 秒です。

---

## `/ios-qa`

実機の iOS の QA です。このフォークの中核となる洞察はこうです。シミュレーターは使わない、XCTest は走らせない、WebDriverAgent も立ち上げない。テスト対象のアプリに HTTP サーバーを組み込み、USB の CoreDevice IPv6 トンネル越しに、Mac 側のデーモンから操作します。

エージェントは Swift のソースを読み、`@Snapshotable` とマークされたフィールドを持つ `@Observable` クラスを見つけ、型付きのアクセサを生成し、デバッグ用のブリッジをデプロイし、閉じた「発見→修正→検証」のループを実行します。

### 1 枚の図でわかるアーキテクチャ

```
       ┌──────────────────────┐   USB CoreDevice (IPv6)   ┌──────────────────┐
       │ gstack-ios-qa daemon │ ────────────────────────▶ │ iOS app          │
       │ (Mac, bun/TS)        │   bearer + X-Session-Id   │ StateServer      │
       │ - rotates boot token │                           │ (loopback only)  │
       │ - mints session toks │                           └──────────────────┘
       │ - capability tiers   │
       │ - audit + redact     │
       └──────────────────────┘
                ▲
                │ Tailscale (optional, --tailnet)
                │
       ┌──────────────────────┐
       │ Remote agent         │
       │ (OpenClaw, etc.)     │
       └──────────────────────┘
```

iOS アプリの `StateServer` は、ループバックのみにバインドされます(`::1` と `127.0.0.1`)。Mac 側のデーモンが、Tailnet のアイデンティティの検証、権限の階層、監査の記録を担います。リモートのエージェントがブートトークンを見ることは決してありません。見えるのは、短命のセッショントークン(既定 1 時間、ハードな上限 24 時間)だけです。これは Tailscale のアイデンティティによるゲートを通じて発行されます。

### 切り札:USB 接続 + Tailscale = どのエージェントからでもリモートの iOS QA

Mac と、すでに持っている iPhone と、Tailscale の無料プランがあれば、多くのチームが BrowserStack や Sauce Labs に払っているものを置き換えられます。Tailnet 上のどの HTTP 対応のエージェントでも、セッショントークンを発行すれば、iOS アプリを操作できます。Tailscale の ACL で、どのアイデンティティがどの権限の階層で Mac に到達できるかを定めます。

実行可能なセットアップは `ios-qa/docs/tailscale-acl-example.md` を参照してください。

### 権限の階層

| 階層 | エンドポイント |
|------|-----------|
| observe | `/screenshot`、`/elements`、`GET /state/*`、`/state/snapshot`、`/healthz` |
| interact | observe + `/tap`、`/swipe`、`/type`、`/session/*` |
| mutate | interact + `POST /state/<key>` |
| restore | mutate + `POST /state/restore` |

既定で発行されるトークンには `interact` が付きます。より高い階層は、所有者による明示的な発行が必要です。

---

## `/ios-fix`

鉄則:再現するスナップショットなしに修正しない。エージェントは `GET /state/snapshot` で、バグが起きる前の状態を取得し、修正を書き、再ビルドして再デプロイし、スナップショットを復元して、バグが消えたことを検証します。スナップショットはリグレッションテストのフィクスチャになるので、バグが静かに再発することはありません。

iOS 向けに、`/qa` の「バグの発見→修正→再検証」のループを踏襲しています。

---

## `/ios-design-review`

実機の iPhone での、デザイナーの目によるQAです。同じ `/ios-qa` のデーモンに、observe の階層のモードで接続し、すべての画面のスクリーンショットを撮ります。10 の観点をそれぞれ 0〜10 で採点します。タイポグラフィの階層、スペーシングのリズム、色の階層、タッチターゲット、読み込み中・空・エラーの状態、アクセシビリティ、アニメーションの規律、iOS のイディオムとの整合、情報の密度、AI っぽさのチェックです。

7 点未満の観点ごとに、AskUserQuestion で、推奨する修正とともに問題を提示します。

---

## `/ios-clean`

便利なラッパーです。DebugBridge を Release ビルドに出荷しないための構造的なガードは、`Package.swift`(`.when(configuration: .debug)`)と、CI の不変条件のテストにあります。`/ios-clean` は、案内付きの削除の流れがほしい開発者や、`/ios-qa` を経由せずに SPM の依存関係を手動で追加した開発者のためのものです。

---

## `/ios-sync`

gstack をアップグレードしたあとや、新しい `@Observable` クラスを追加したあとに実行します。インストールされているものを検出し、最新の上流のテンプレートに対して gen-accessors を実行し、変更された Swift ファイルを更新し、アプリが再ビルドできることを確認します。キャッシュのキーの無効化で、Swift のバージョンの変更、生成器の git のリビジョンの変更、ソースの変更に対応します。
