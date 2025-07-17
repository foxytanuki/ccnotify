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

## 📋 必要な画像リスト

以下の画像が必要です：

### Discord関連
1. Discordサーバーメニューからサーバー設定を選択している画面
2. サーバー設定の左メニューで「連携サービス」を選択している画面
3. 連携サービス画面でウェブフックセクションと作成ボタンが表示されている画面
4. ウェブフック設定画面で名前とチャンネルを設定している画面
5. ウェブフックURL欄とコピーボタンが表示されている画面（URLは部分的にぼかす）
6. Discord Webhook設定画面で、Webhookが有効になっていることを確認する画面

### ntfy関連
1. Google PlayストアまたはApp Storeでntfyアプリを検索している画面
2. ntfyアプリでトピックを追加する画面
3. ntfy.sh Webサイトでトピックを購読する画面
4. ntfy.shのサインアップ画面
5. アクセストークン生成画面（トークンは部分的にぼかす）
6. ntfyアプリの設定画面で通知が有効になっていることを確認する画面

### macOS関連
1. Script Editorアプリのアイコンと起動画面
2. Script Editorにコードを入力した画面
3. Script Editorの実行ボタンと、通知許可のダイアログ
4. システム環境設定の通知とフォーカスでScript Editorが表示されている画面
5. Script Editorの通知設定画面
6. 実際のmacOS通知の表示例
7. macOSシステム環境設定 > 通知とフォーカス > ターミナル.appの通知設定画面

## 🔗 関連リンク

- [GitHub リポジトリ](https://github.com/foxytanuki/ccnotify)
- [npm パッケージ](https://www.npmjs.com/package/ccnotify)
- [問題報告](https://github.com/foxytanuki/ccnotify/issues)
