# iOS QA デーモン向け Tailscale ACL の例

Mac 側のデーモンは、`--tailnet` を渡したときにだけ Tailscale のインターフェースにバインドします。デフォルトでは、デーモンはローカル USB 専用です。この文書では、リモートのエージェントが tailnet 越しに iOS QA を安全に実行できるよう、iPhone を公開する手順を説明します。

## 脅威モデルの要点

- **iOS アプリの StateServer:** 常にループバックのみ。Mac からは CoreDevice の IPv6 トンネル経由で到達できます。tailnet に直接バインドされることはありません。
- **Mac のデーモン:** tailnet のインターフェースを持ちます。リスナーは二つあります。ループバック(全機能。転送されることはない)と、tailnet(機能ティア付きの厳格な許可リスト)です。
- **認証:** ローカルの `tailscaled` ソケット(`/var/run/tailscale.sock` の LocalAPI WhoIs)による Tailscale ID の検証。`~/.gstack/ios-qa-allowlist.json` の許可リストファイルが、誰が何をできるかの唯一の正となる情報源です。

## Step 1: Tailscale をインストールして起動する

```bash
brew install --cask tailscale
# Login + start tailscaled, then verify:
tailscale status
```

デーモンが LocalAPI のソケットを読めることを確認します:

```bash
test -S /var/run/tailscale.sock && echo "socket present" || echo "MISSING"
```

ソケットがない場合、デーモンは tailnet のリスナーを開くのを拒否します(フェイルクローズ)。

## Step 2: デーモンの ACL を設定する

デーモンは、どの Tailscale ID がどのデバイスを、どの機能ティアで操作してよいかを知る必要があります。許可リストファイルは JSON で、次の形式です:

```json
{
  "version": 1,
  "entries": [
    {
      "identity": "you@example.com",
      "capabilities": ["restore"],
      "expires_at": null,
      "note": "Owner — full access"
    },
    {
      "identity": "ci@example.com",
      "capabilities": ["mutate"],
      "expires_at": "2026-12-31T00:00:00Z",
      "note": "CI runner — can write state but not full restore"
    },
    {
      "identity": "tag:claude-readonly",
      "capabilities": ["observe"],
      "expires_at": null,
      "note": "Agents that should only read"
    }
  ]
}
```

ID は WhoIs によって正規化されます:

- **ユーザーの OAuth:** `user@example.com`(`acct:` は付けず、ドメインの書き換えもしない)。
- **タグ付きノード:** `tag:<tagname>`(小文字に変換される)。
- **ノードキー:** `node:<nodekey-hex>`(まれ。代わりにタグを使うこと)。

機能ティアは順序があります: `observe` < `interact` < `mutate` < `restore`。`restore` を付与すると、それより下のすべてのティアも含まれます。

## Step 3: リモートのエージェント向けにセッショントークンを発行する

エージェントが自分で発行することも(その ID が許可リストに入っていれば)、サーバー側で代わりに発行することもできます:

```bash
# Server-side mint (owner-only, runs locally on the Mac with the device):
gstack-ios-qa-mint --remote ci@example.com --capability mutate --ttl 1h

# Self-service mint (agent over tailnet):
curl -X POST http://<mac-tailnet-ip>:9999/auth/mint \
  -H "Content-Type: application/json" \
  -d '{"capability": "interact"}'
# → {"session_token": "...", "expires_at": "...", "capability": "interact"}
```

## Step 4: Tailscale の ACL を絞る(多層防御)

デーモンの許可リストが一次のアクセス制御です。それに加えて、tailnet の ACL を絞り、デーモンのポートに**到達できる**人を制限します。

```jsonc
// In your tailscale admin console:
{
  "acls": [
    // Allow CI runner to reach the iOS QA Mac on port 9999 only.
    {
      "action": "accept",
      "src": ["ci@example.com"],
      "dst": ["ios-qa-mac:9999"]
    },
    // Tagged Claude agents — observe tier only (enforced by daemon, not ACL).
    {
      "action": "accept",
      "src": ["tag:claude-readonly"],
      "dst": ["ios-qa-mac:9999"]
    },
    // Default deny.
    {
      "action": "drop",
      "src": ["*"],
      "dst": ["ios-qa-mac:9999"]
    }
  ]
}
```

## Step 5: 監査証跡

tailnet のリスナーを通じた、認証済みの書き込みリクエストは、それぞれ `~/.gstack/security/ios-qa-audit.jsonl` に行を書き込みます:

```jsonl
{"ts":"2026-05-18T14:23:00Z","identity":"ci@example.com","device_udid":"00008101-XXXX","endpoint":"/tap","session_id":"abc...","capability":"interact","request_id":"req_001","status":200}
```

拒否された操作(トークンがない、トークンの期限切れ、機能が不足、ID が許可リストにない、レート制限に達した)は、`~/.gstack/security/attempts.jsonl` に書き込まれます。

## レート制限

- `/auth/mint`: ID ごとに 60 秒で 10 回まで。11 回目は 429 を返します。
- tailnet のリクエストごとのボディ: 1MB のハードリミット(超えると 413)。
- スクリーンショットのレスポンス: 10MB のハードリミット(超えるとサニタイズされたエラーとともに 500)。

## トークンの有効期間

- デーモンが発行するセッショントークン: デフォルトの有効期間は 1 時間。`--tailnet-session-ttl` で最大 24 時間まで延長できます。
- `POST /session/heartbeat` で更新できます(`ttl_seconds` 分延長され、元の最大値が上限)。
- ブートトークン(iOS アプリの起動からデーモンのローテーションまでの間): 約 5 秒の寿命です。デーモンは最初のスクレイプの直後にすぐローテーションします。

## 失敗モード

| Symptom | Cause | Action |
|---|---|---|
| Daemon refuses to open tailnet listener | `/var/run/tailscale.sock` missing or permission-denied | Tailscale をインストールし、デーモンを実行しているユーザーで `tailscale status` が動くことを確認する |
| `403 identity_not_allowed` | identity missing from allowlist | 所有者による発行: `gstack-ios-qa-mint --remote <identity>` |
| `403 capability_insufficient` | token tier below endpoint requirement | より上位の `--capability` ティアで所有者が発行する |
| `429 rate_limited` | >10 mints/min from one identity | 60 秒待つ。エージェントがなぜこれほど頻繁に再発行しているのかを調べる |
| `409 schema_mismatch` on `/state/restore` | snapshot from older app build | スナップショットを破棄し、現在のアプリのビルドから取り直す |
