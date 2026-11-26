# サードパーティのライセンス — diagram-render のバンドル

`dist/diagram-render.html` には、次のパッケージがバンドルされています(正確なバージョンは `package.json` に、推移的な依存関係は `bun.lock` で解決されています)。

| パッケージ | バージョン | ライセンス | ソース |
|---|---|---|---|
| mermaid | 11.12.2 | MIT | https://github.com/mermaid-js/mermaid |
| @excalidraw/excalidraw | 0.18.0 | MIT | https://github.com/excalidraw/excalidraw |
| @excalidraw/mermaid-to-excalidraw | 1.1.2 | MIT | https://github.com/excalidraw/mermaid-to-excalidraw |
| react | 18.3.1 | MIT | https://github.com/facebook/react |
| react-dom | 18.3.1 | MIT | https://github.com/facebook/react |

このバンドルには、@excalidraw/excalidraw に同梱されているフォント(Excalifont など)も埋め込まれています。これらは、excalidraw のリポジトリの記載に従い、SIL Open Font License 1.1 のもとでライセンスされています。

バージョンの固定を上げるときは、そのライセンスの項目を再確認し(`bun pm ls` またはパッケージの LICENSE ファイル)、同じコミットでこの表も更新してください。
