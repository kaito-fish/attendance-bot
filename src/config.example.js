const CONFIG = {
  WEBHOOK_URL: 'https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN',
  BOT_NAME: '出席確認Bot',
  BOT_AVATAR_URL: '',

  MESSAGE: '📋 出席確認です。',

  // 授業ごとに追加・編集する (1=日, 2=月, 3=火, 4=水, 5=木, 6=金, 7=土)
  CLASSES: [
    { name: '授業名A', url: 'https://zoom.us/j/xxxxx', dayOfWeek: 2, hour: 9,  minute: 0  },
    { name: '授業名B', url: 'https://zoom.us/j/yyyyy', dayOfWeek: 3, hour: 13, minute: 30 },
    { name: '授業名C', url: '',                         dayOfWeek: 5, hour: 10, minute: 15 },
  ],
};
