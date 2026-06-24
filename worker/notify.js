const WEEKDAY_MAP = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };

function getJstNow(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  return {
    dayOfWeek: WEEKDAY_MAP[map.weekday],
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function buildMessage(cls, config) {
  const lines = [`**【${cls.name}】** ${config.MESSAGE}`];
  if (cls.url) lines.push(cls.url);
  return lines.join('\n');
}

async function sendNotification(cls, config, env) {
  const payload = {
    username: config.BOT_NAME,
    content: buildMessage(cls, config),
  };

  if (config.BOT_AVATAR_URL) {
    payload.avatar_url = config.BOT_AVATAR_URL;
  }

  const response = await fetch(env.WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.status !== 204) {
    console.error(`Discord送信エラー [${cls.name}]:`, await response.text());
  } else {
    console.log(`出席確認通知を送信しました [${cls.name}]:`, new Date().toISOString());
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dispatchNotifications(config, env, now = new Date()) {
  const { dayOfWeek, hour, minute } = getJstNow(now);

  const matched = config.CLASSES.filter((cls) => {
    const clsMinute = cls.minute || 0;
    return cls.dayOfWeek === dayOfWeek && cls.hour === hour && minute === clsMinute;
  });

  let sent = 0;
  for (const cls of matched) {
    if (sent > 0) await sleep(3000);
    await sendNotification(cls, config, env);
    sent++;
  }
}
