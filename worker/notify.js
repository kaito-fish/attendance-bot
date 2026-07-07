const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getJstNow(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  return {
    dayOfWeek: map.weekday,
    date: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

// 'YYYY-MM-DD'同士の文字列比較で期間内(両端含む)かを判定する
function isWithinTerm(cls, date) {
  if (cls.from && date < cls.from) return false;
  if (cls.until && date > cls.until) return false;
  return true;
}

const HOLIDAYS_API_URL = 'https://holidays-jp.github.io/api/v1/date.json';

// 祝日ならその名前を返す。取得に失敗した場合はnull(=送信する側に倒す)
async function getJpHolidayName(date) {
  try {
    const response = await fetch(HOLIDAYS_API_URL);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const holidays = await response.json();
    return holidays[date] ?? null;
  } catch (err) {
    console.warn('祝日データの取得に失敗したため、祝日チェックをスキップして送信します:', err);
    return null;
  }
}

function normalizeWeekday(value) {
  const normalized = String(value).slice(0, 3).toLowerCase();
  return WEEKDAYS.find((d) => d.toLowerCase() === normalized) ?? null;
}

function buildMessage(cls, config) {
  const lines = [`**【${cls.name}】** ${config.MESSAGE}`];
  if (cls.url) lines.push(cls.url);
  return lines.join('\n');
}

function postWebhook(url, payload) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

const MAX_RETRY_AFTER_MS = 10_000;

async function getRetryAfterMs(response) {
  let seconds;
  try {
    const body = await response.json();
    seconds = body.retry_after;
  } catch {
    // ボディがJSONでない場合はヘッダにフォールバック
  }
  if (typeof seconds !== 'number') seconds = Number(response.headers?.get?.('Retry-After'));
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 2;
  return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
}

// 成功時true、最終的に失敗したらfalseを返す
async function sendNotification(cls, config, env) {
  const payload = {
    username: config.BOT_NAME,
    content: buildMessage(cls, config),
  };

  if (config.BOT_AVATAR_URL) {
    payload.avatar_url = config.BOT_AVATAR_URL;
  }

  try {
    let response = await postWebhook(env.WEBHOOK_URL, payload);

    if (response.status === 429) {
      const retryAfterMs = await getRetryAfterMs(response);
      console.warn(`Discord rate limit [${cls.name}]: ${retryAfterMs}ms後にリトライします`);
      await sleep(retryAfterMs);
      response = await postWebhook(env.WEBHOOK_URL, payload);
    }

    if (!response.ok) {
      console.error(`Discord送信エラー [${cls.name}] (status ${response.status}):`, await response.text());
      return false;
    }

    console.log(`出席確認通知を送信しました [${cls.name}]:`, new Date().toISOString());
    return true;
  } catch (err) {
    console.error(`Discord送信失敗(fetch例外) [${cls.name}]:`, err);
    return false;
  }
}

// 送信失敗を管理者向けWebhook(任意設定のsecret)に通知する
async function notifyAdminOfFailures(failedNames, config, env) {
  if (!env.ADMIN_WEBHOOK_URL || failedNames.length === 0) return;

  try {
    const response = await postWebhook(env.ADMIN_WEBHOOK_URL, {
      username: config.BOT_NAME,
      content: `⚠️ 出席確認通知の送信に失敗しました: ${failedNames.join(', ')}`,
    });
    if (!response.ok) {
      console.error(`管理者通知の送信エラー (status ${response.status}):`, await response.text());
    }
  } catch (err) {
    console.error('管理者通知の送信失敗(fetch例外):', err);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dispatchNotifications(config, env, now = new Date()) {
  const { dayOfWeek, date, hour, minute } = getJstNow(now);

  const timeMatched = config.CLASSES.filter((cls) => {
    const clsMinute = cls.minute || 0;
    return normalizeWeekday(cls.dayOfWeek) === dayOfWeek && cls.hour === hour && minute === clsMinute;
  });

  if (timeMatched.length === 0) {
    console.warn(
      `cronが発火しましたがマッチする授業がありません。config.jsとwrangler.tomlのcronsがズレている可能性があります (JST: ${dayOfWeek} ${hour}:${String(minute).padStart(2, '0')})`
    );
    return;
  }

  const matched = timeMatched.filter((cls) => {
    if (isWithinTerm(cls, date)) return true;
    console.log(`期間外(from/until)のためスキップします [${cls.name}] (${date})`);
    return false;
  });
  if (matched.length === 0) return;

  if ((config.EXCLUDE_DATES ?? []).includes(date)) {
    console.log(`除外日のため通知をスキップします (${date})`);
    return;
  }

  if (config.SKIP_JP_HOLIDAYS) {
    const holidayName = await getJpHolidayName(date);
    if (holidayName) {
      console.log(`祝日(${holidayName})のため通知をスキップします (${date})`);
      return;
    }
  }

  const failedNames = [];
  let sent = 0;
  for (const cls of matched) {
    if (sent > 0) await sleep(3000);
    const ok = await sendNotification(cls, config, env);
    if (!ok) failedNames.push(cls.name);
    sent++;
  }

  await notifyAdminOfFailures(failedNames, config, env);
}
