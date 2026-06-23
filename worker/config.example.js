// Webhook URLは wrangler secret (env.WEBHOOK_URL) で管理するため、ここには含めない
export const CONFIG = {
  BOT_NAME: '出席確認Bot',
  BOT_AVATAR_URL: '',

  MESSAGE: '📋 出席確認です。',

  // 授業ごとに追加・編集する (1=日, 2=月, 3=火, 4=水, 5=木, 6=金, 7=土)
  // 各授業の cron 式は wrangler.toml の [triggers].crons と対応させる必要がある (JST -> UTCは-9時間)
  CLASSES: [
    { name: '授業名A', url: 'https://example.com/classA', dayOfWeek: 2, hour: 9,  minute: 0  },
    { name: '授業名B', url: 'https://example.com/classB', dayOfWeek: 3, hour: 13, minute: 30 },
    { name: '授業名C', url: 'https://example.com/classC', dayOfWeek: 5, hour: 10, minute: 15 },
  ],
};
