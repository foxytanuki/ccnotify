# ccnotify ドキュメント

ccnotifyのドキュメントへようこそ。このツールは、Claude Code Stop Hooksを簡単に設定できるCLIツールです。

## 📚 ドキュメント一覧

### セットアップガイド

- **[Discord Webhook設定ガイド](./discord-webhook-setup.md)**
  Discord通知を使用するためのWebhook URL取得方法を画像付きで解説

- **[ntfy設定ガイド](./ntfy-setup.md)**
  ntfy.shを使用したプッシュ通知の設定方法とトピックの作成手順

- **[macOS通知設定ガイド](./macos.md)**
  macOS通知の初回設定手順とScript Editorでのテスト方法

### トラブルシューティング

- **[トラブルシューティングガイド](./troubleshooting.md)**
  よくある問題と解決方法、エラーメッセージの対処法

## 🚀 クイックスタート

### 1. インストール

```bash
# npxを使用（推奨）
npx ccnotify discord https://discord.com/api/webhooks/...

# またはグローバルインストール
npm install -g ccnotify
```

### 2. 基本的な使い方

```bash
# Discord通知
ccnotify discord https://discord.com/api/webhooks/123/abc

# ntfy通知
ccnotify ntfy my-topic

# macOS通知
ccnotify macos "通知タイトル"

# グローバル設定
ccnotify discord https://discord.com/api/webhooks/123/abc --global
```

## 🔗 関連リンク

- [GitHub リポジトリ](https://github.com/foxytanuki/ccnotify)
- [npm パッケージ](https://www.npmjs.com/package/ccnotify)
- [問題報告](https://github.com/foxytanuki/ccnotify/issues)
