# トラブルシューティングガイド

## 目次

- [インストール関連](#インストール関連)
- [Discord通知の問題](#discord通知の問題)
- [ntfy通知の問題](#ntfy通知の問題)
- [macOS通知の問題](#macos通知の問題)
- [設定ファイルの問題](#設定ファイルの問題)
- [権限エラー](#権限エラー)
- [通知ログの確認](#通知ログの確認)
- [その他の一般的な問題](#その他の一般的な問題)

## インストール関連

### npm install -g ccnotifyが失敗する

**症状**: パッケージのグローバルインストールが失敗する

**解決方法**:

1. Node.jsのバージョンを確認
```bash
node --version  # v20.0.0以上が必要
```

2. npmの権限を修正
```bash
# npmのグローバルディレクトリを変更
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

3. npxを使用（推奨）
```bash
npx ccnotify discord https://discord.com/api/webhooks/...
```

### command not found: ccnotify

**症状**: インストール後もコマンドが見つからない

**解決方法**:

1. PATHを確認
```bash
echo $PATH
npm bin -g  # グローバルbinディレクトリを確認
```

2. シェルの設定を再読み込み
```bash
source ~/.bashrc  # または ~/.zshrc
```

## Discord通知の問題

### Invalid webhook URL

**症状**: `❌ Invalid Discord webhook URL format`エラー

**解決方法**:

1. URLフォーマットを確認
```
正しい形式: https://discord.com/api/webhooks/123456789/abcdefg...
```

2. URLをクォートで囲む
```bash
ccnotify discord "https://discord.com/api/webhooks/123456789/token"
```

### 通知が届かない

**症状**: エラーは出ないが通知が来ない

**確認事項**:

1. Webhook URLが正しいか再確認
2. Discordチャンネルの権限設定を確認
3. Claude Codeの操作が正常に完了しているか確認

<!-- スクリーンショット: Discord Webhook設定画面で、Webhookが有効になっていることを確認 -->

**デバッグ方法**:

```bash
# 手動でWebhookをテスト
curl -H "Content-Type: application/json" \
     -d '{"content":"Test message"}' \
     "YOUR_WEBHOOK_URL"
```

### Webhook deleted or invalid

**症状**: 以前は動いていたが急に動かなくなった

**解決方法**:

1. Discordで新しいWebhookを作成
2. ccnotifyを再設定
```bash
ccnotify discord "新しいWebhook URL"
```

## ntfy通知の問題

### Invalid topic name

**症状**: `❌ Invalid ntfy topic name`エラー

**解決方法**:

有効な文字のみを使用:
- 英数字（a-z, A-Z, 0-9）
- ハイフン（-）
- アンダースコア（_）

```bash
# 良い例
ccnotify ntfy my-project-notifications
ccnotify ntfy dev_alerts_2024

# 悪い例
ccnotify ntfy "my project"  # スペースは無効
ccnotify ntfy my.project    # ドットは無効
```

### 通知が届かない

**確認事項**:

1. トピック名が正確に一致しているか（大文字小文字も含む）
2. ntfyアプリで該当トピックを購読しているか
3. デバイスの通知設定が有効か

<!-- スクリーンショット: ntfyアプリの設定画面で通知が有効になっていることを確認 -->

**テスト方法**:

```bash
# 通知テスト
curl -d "Test notification" ntfy.sh/your-topic-name
```

## macOS通知の問題

### 通知が表示されない

**症状**: macOSで通知が表示されない

**解決方法**:

1. システム環境設定で通知を確認

<!-- スクリーンショット: macOSシステム環境設定 > 通知とフォーカス > ターミナル.appの通知設定 -->

2. ターミナルアプリの通知権限を有効化
   - システム環境設定 > 通知とフォーカス
   - ターミナル.app（またはiTerm2など）を探す
   - 「通知を許可」をオン

3. おやすみモードを確認
   - コントロールセンターでおやすみモードがオフになっているか確認

### 音が鳴らない

**症状**: 通知は表示されるが音が鳴らない

**解決方法**:

1. システムサウンドを確認
```bash
# サウンドファイルの存在確認
ls /System/Library/Sounds/Pop.aiff
```

2. ボリュームとミュート設定を確認

## 設定ファイルの問題

### JSON parse error

**症状**: `Failed to parse existing configuration`エラー

**解決方法**:

1. 設定ファイルの構文を確認
```bash
# ローカル設定
cat .claude/settings.json | jq .

# グローバル設定
cat ~/.claude/settings.json | jq .
```

2. バックアップから復元
```bash
# バックアップファイルを探す
ls .claude/settings.json.backup.*

# 復元
cp .claude/settings.json.backup.2024-01-01T12-00-00-000Z .claude/settings.json
```

3. 設定ファイルを削除して再作成
```bash
rm .claude/settings.json
ccnotify discord "YOUR_WEBHOOK_URL"
```

### 設定が反映されない

**症状**: ccnotifyで設定したがClaude Codeで動作しない

**確認事項**:

1. 正しいディレクトリで実行したか
```bash
pwd  # 現在のディレクトリを確認
ls -la .claude/settings.json  # ローカル設定の存在確認
```

2. グローバルとローカルの設定を確認
```bash
# ローカル設定
cat .claude/settings.json | jq .

# グローバル設定
cat ~/.claude/settings.json | jq .
```

## 権限エラー

### Permission denied

**症状**: ファイルの作成・更新時に権限エラー

**解決方法**:

1. ディレクトリの権限を確認
```bash
ls -la .claude/
```

2. 権限を修正
```bash
chmod 755 .claude
chmod 644 .claude/settings.json
```

3. 所有者を確認
```bash
# 必要に応じて所有者を変更
sudo chown $USER:$USER .claude/settings.json
```

## 通知ログの確認

### 通知が届かない場合の原因究明

通知が届かない問題を調査するために、ccnotifyには詳細なログ機能が組み込まれています。

#### ログの確認方法

1. **最近のログを確認**
```bash
ccnotify logs
```

2. **失敗した通知のみを確認**
```bash
ccnotify logs --failed
```

3. **特定の通知タイプのログを確認**
```bash
# Discord通知のログ
ccnotify logs --type discord

# ntfy通知のログ
ccnotify logs --type ntfy

# macOS通知のログ
ccnotify logs --type macos
```

4. **通知統計を確認**
```bash
ccnotify logs --stats
```

5. **ログをファイルにエクスポート**
```bash
ccnotify logs --export notification-logs.json
```

#### ログに記録される情報

- **通知の実行時刻**
- **通知タイプ** (discord, ntfy, macos)
- **実行結果** (success, failed, timeout, skipped)
- **HTTPレスポンスコード** (Discord, ntfy)
- **実行時間**
- **エラーメッセージ** (失敗時)
- **Webhook URL** (マスク済み)
- **トピック名** (ntfy)
- **通知タイトル** (macOS)

#### ログファイルの場所

ログは以下の場所に保存されます：
```
$XDG_DATA_HOME/ccnotify/notifications.log
```

デフォルトでは：
```
~/.local/share/ccnotify/notifications.log
```

XDG Base Directory Specificationに従って、`$XDG_DATA_HOME`環境変数で場所を変更できます。

#### ログレベルの設定

環境変数でログレベルを設定できます：
```bash
# デバッグ情報を含む詳細ログ
export CCNOTIFY_LOG_LEVEL=DEBUG

# エラーのみ
export CCNOTIFY_LOG_LEVEL=ERROR
```

#### よくあるログパターン

**Discord通知の失敗例**:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "ERROR",
  "type": "discord",
  "result": "failed",
  "message": "discord notification failed: HTTP 404",
  "details": {
    "webhookUrl": "https://discord.com/api/webhooks/123/***",
    "responseCode": 404,
    "error": "HTTP 404"
  }
}
```

**ntfy通知の成功例**:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "type": "ntfy",
  "result": "success",
  "message": "ntfy notification sent successfully",
  "details": {
    "topicName": "my-topic",
    "responseCode": 200,
    "executionTime": 1
  }
}
```

#### ログ設定の管理

```bash
# 現在の設定を確認
ccnotify config --show

# ログレベルをDEBUGに設定
ccnotify config --log-level DEBUG

# トランスクリプト内容をログに含める
ccnotify config --include-transcripts
```

## その他の一般的な問題

### Claude Codeが停止しない

**症状**: 通知は来るがClaude Codeの処理が続行される

**注意**: Stop Hooksは通知のみを行い、処理を停止するものではありません

### 複数の通知が重複する

**症状**: 同じ通知が複数回送信される

**確認事項**:

1. 設定ファイルに重複したフックがないか確認
```bash
cat .claude/settings.json | jq '.hooks.Stop'
```

2. 重複を削除して設定を修正

### デバッグ情報の確認

詳細なエラー情報が必要な場合:

1. Claude Codeのログを確認
2. 環境変数でデバッグモードを有効化（将来の機能）

## サポート

問題が解決しない場合:

1. [GitHubのIssues](https://github.com/foxytanuki/ccnotify/issues)で既知の問題を確認
2. 新しいIssueを作成して報告
3. 以下の情報を含める:
   - ccnotifyのバージョン: `ccnotify --version`
   - Node.jsのバージョン: `node --version`
   - OS情報
   - エラーメッセージの全文
   - 実行したコマンド

## 関連リンク

- [Discord Webhook設定ガイド](./discord-webhook-setup.md)
- [ntfy設定ガイド](./ntfy-setup.md)
- [ccnotify README](../README.md)
