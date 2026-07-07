# attendance-bot

授業ごとに設定した曜日・時刻に、Discordへ出席確認の通知を送るBotです。
Cloudflare Workers の Cron Triggers を使って定期実行します。

## 構成

```
worker/
  index.js           # scheduledイベントのエントリポイント
  notify.js          # 通知対象の判定・Discordへの送信処理
  config.example.js  # 設定ファイルのテンプレート(コピーしてconfig.jsを作る)
wrangler.example.toml # wrangler.tomlのテンプレート
```

`worker/config.js` と `wrangler.toml` は `.gitignore` で除外されているため、各自のテンプレートからコピーして作成してください。

## セットアップ

### 1. 依存パッケージのインストール

```sh
npm install
```

### 2. 設定ファイルの作成

```sh
cp worker/config.example.js worker/config.js
cp wrangler.example.toml wrangler.toml
```

`worker/config.js` の `CLASSES` に、通知したい授業を追加・編集します。

```js
CLASSES: [
  { name: '授業名A', url: 'https://example.com/classA', dayOfWeek: 'Mon', hour: 9, minute: 0, until: '2026-08-07' },
],
```

- `dayOfWeek` は `'Sun'` `'Mon'` `'Tue'` `'Wed'` `'Thu'` `'Fri'` `'Sat'` の3文字略称 (JST、大文字小文字は不問)
- `hour` / `minute` はJSTの時刻
- `from` / `until` (任意、`'YYYY-MM-DD'`、両端含む) で学期などの有効期間を指定できる。期間外は通知されない

このほか、全体設定として以下が使えます。

- `SKIP_JP_HOLIDAYS: true` — 日本の祝日([holidays-jp](https://holidays-jp.github.io/) API)は通知をスキップする(祝日にも授業がある場合は `false` のまま)
- `EXCLUDE_DATES: ['2026-08-13']` — 休講日など、通知をスキップする日

### 3. Cron Triggers の生成

`wrangler.toml` の `[triggers].crons` は `config.js` の `CLASSES` から自動生成されます(JST→UTC変換もスクリプトが行うため、手で書く必要はありません)。

```sh
npm run generate:crons
```

`npm run deploy` の際にも自動実行されるため、通常は `config.js` を編集してデプロイするだけで同期されます。

### 4. Discord Webhook URLの設定

Webhook URLはコードに含めず、Wrangler Secretとして登録します。

```sh
npm run secret:webhook
```

送信失敗時に別チャンネルへ通知したい場合は、管理者向けWebhook URLも登録します(任意)。

```sh
npm run secret:admin-webhook
```

## 開発・デプロイ

```sh
npm run dev      # ローカルで起動 (wrangler dev)
npm run deploy   # Cloudflare Workersへデプロイ
npm run tail     # 本番ログをtail
```

ローカルでscheduledイベントを発火させて動作確認する場合は、以下のように実行します。

```sh
npx wrangler dev --test-scheduled
```
