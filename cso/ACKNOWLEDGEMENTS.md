# CSO の調査と参照バージョン

CSO v3 は、裏付けのある静的な証拠、再現、修正候補、現行ソースでのクローズを分けて扱います。この設計は、[Mozilla による Firefox の強化の舞台裏](https://hacks.mozilla.org/2026/05/behind-the-scenes-hardening-firefox/) と [Codex Security のリサーチプレビューの説明](https://openai.com/index/codex-security-now-in-research-preview/) を参考にしています。アプリケーションの文脈と再現可能な検証によってワークフローを補強します。ただし、これらの結果は CSO の測定値ではありません。

`sections/audit-phases.md.tmpl` のドメイン別の指示は、使用するバージョンを明記しています:

- [OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/)。例外的な状況と、改訂されたサプライチェーンのカテゴリを含みます。
- [OWASP API Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)。
- [ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/) から選んだコントロール。要件 ID にはバージョンを必ず付けます。
- [OWASP LLM Top 10 2026](https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/) と [Agentic Applications Top 10 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)。2026年9月9日に確認しています。監査では、リリースの発表から内容を推測するのではなく、実際に使った成果物とバージョンを記録します。
- [2026-07-28 付けの MCP セキュリティガイダンス](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)。

実行の詳細は一次資料に従います。[Bun のコンパイル済み実行ファイル](https://bun.com/docs/bundler/executables)、[Docker のコンテキスト](https://docs.docker.com/engine/manage-resources/contexts/)、[コンテナのネットワーク](https://docs.docker.com/engine/network/)、[Docker のログ](https://docs.docker.com/engine/logging/configure/)、[npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/)、[uv CLI](https://docs.astral.sh/uv/reference/cli/)、[RubyGems のコマンド](https://guides.rubygems.org/command-reference/#gem-fetch) です。コンパイルしただけでは、Bun の設定や実行時に注入される変数は抑制されません。オフラインの依存関係の準備では、取得の段階でローカルの Python ビルドを除外し、Gemfile の評価はオフラインでの実行まで遅らせる必要があります。

以前の CSO の作業では、コンテキストの構築とバリアント分析に [Trail of Bits のスキル](https://github.com/trailofbits/skills) を、報告前の調査に [Sentry のスキル](https://github.com/getsentry/skills) を参考にしました。また、コミュニティ全体のセキュリティスキルのレビューにも助けられました。v3 では、継承していた一律の誤検知除外と数値の信頼度のしきい値を、明示的な攻撃者・コントロール・影響の証拠と、独立した異議申し立てに置き換えました。

CSO の正確性、再現率、セットアップの成功率、修正の正しさは、リリース時の測定値であり、ベンダーのベンチマークを引き継いだものではありません。認定には、モデルと予算をそろえること、保留された検証用のアサーションを使うこと、サポートされているセットアップの失敗を見逃しとして数えること、そして誤って認定された修正がゼロであることが必要です。ドキュメントやアダプターが存在することは、そのランタイムイメージやリリースゲートが通過したことを意味しません。
