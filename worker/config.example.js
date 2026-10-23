// Webhook URLは wrangler secret (env.WEBHOOK_URL) で管理するため、ここには含めない
// 送信失敗時の管理者向け通知先も同様にsecret (env.ADMIN_WEBHOOK_URL、任意) で管理する
export const CONFIG = {
  BOT_NAME: '出席確認Bot',
  BOT_AVATAR_URL: '',

  MESSAGE: '📋 出席確認です。',

  // trueにすると日本の祝日(holidays-jp API)は通知をスキップする
  // (祝日にも授業がある学校はfalseのままにする)
  SKIP_JP_HOLIDAYS: false,

  // 休講日など、通知をスキップする日 ('YYYY-MM-DD'、JST)
  // 期間でまとめて止める場合は { from, until } (両端含む) で指定できる
  EXCLUDE_DATES: [
    // '2026-08-13',
    // { from: '2026-12-26', until: '2027-01-07' },
  ],

  // 振替授業: 特定の日付だけ別の曜日の時間割を適用する(例: 水曜日が月曜授業になる)
  // dayOfWeekに指定した曜日のCLASSESが、dateの実際の曜日の代わりに発火する
  // (date自体の通常授業がある場合は、別途EXCLUDE_DATESで除外するか判断する)
  SUBSTITUTE_DATES: [
    // { date: '2026-11-04', dayOfWeek: 'Mon' },
  ],

  // 授業ごとに追加・編集する。dayOfWeekは 'Sun'〜'Sat' の3文字略称(JST)
  // from/until ('YYYY-MM-DD'、両端含む) で学期などの有効期間を指定できる(省略可)
  // wrangler.toml のcron式は scripts/generate-crons.mjs がここから自動生成する
  CLASSES: [
    { name: '授業名A', url: 'https://example.com/classA', dayOfWeek: 'Mon', hour: 9,  minute: 0 },
    { name: '授業名B', url: 'https://example.com/classB', dayOfWeek: 'Tue', hour: 13, minute: 30, until: '2026-08-07' },
    { name: '授業名C', url: 'https://example.com/classC', dayOfWeek: 'Thu', hour: 10, minute: 15, from: '2026-10-01', until: '2027-02-06' },
  ],
};
