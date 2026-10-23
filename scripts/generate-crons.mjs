// worker/config.js の CLASSES から wrangler.toml の [triggers].crons を生成する。
// JST -> UTC の変換(-9時間、日付またぎを含む)をここで行い、手動同期のミスをなくす。
// npm run deploy の前に自動実行される。

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const CRON_WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function normalizeWeekdayIndex(value) {
  const normalized = String(value).slice(0, 3).toUpperCase();
  return CRON_WEEKDAYS.indexOf(normalized);
}

// JSTの曜日・時刻をUTCのcron式に変換する
export function toUtcCron(cls) {
  const dayIndex = normalizeWeekdayIndex(cls.dayOfWeek);
  if (dayIndex === -1) {
    throw new Error(`不正なdayOfWeekです [${cls.name}]: ${cls.dayOfWeek} ('Sun'〜'Sat'で指定)`);
  }
  if (!Number.isInteger(cls.hour) || cls.hour < 0 || cls.hour > 23) {
    throw new Error(`不正なhourです [${cls.name}]: ${cls.hour}`);
  }
  const minute = cls.minute ?? 0;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`不正なminuteです [${cls.name}]: ${cls.minute}`);
  }

  let utcHour = cls.hour - 9;
  let utcDayIndex = dayIndex;
  if (utcHour < 0) {
    utcHour += 24;
    utcDayIndex = (dayIndex + 6) % 7; // 前日にずれる
  }

  return `${minute} ${utcHour} * * ${CRON_WEEKDAYS[utcDayIndex]}`;
}

// crons配列の行(コメント付き)を生成する。同一時刻の授業は1つのcronにまとめる
export function buildCronLines(classes) {
  const byCron = new Map();
  for (const cls of classes) {
    const cron = toUtcCron(cls);
    const jst = `${String(cls.dayOfWeek).slice(0, 3)} ${cls.hour}:${String(cls.minute ?? 0).padStart(2, '0')} JST`;
    const entry = byCron.get(cron) ?? { names: [], jst };
    entry.names.push(cls.name);
    byCron.set(cron, entry);
  }

  return [...byCron.entries()].map(
    ([cron, { names, jst }]) => `  "${cron}", # ${names.join(' / ')} ${jst}`
  );
}

// JSTの日付+時刻を-9時間してUTCの日付+時刻にする(日付・月またぎを含む)
function toUtcDateTime(date, hour, minute) {
  const [year, month, day] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute) - 9 * 60 * 60 * 1000);
  return { month: utc.getUTCMonth() + 1, day: utc.getUTCDate(), hour: utc.getUTCHours(), minute: utc.getUTCMinutes() };
}

// 振替授業(SUBSTITUTE_DATES)用に、特定の日付だけ発火するcronの行を生成する
// (曜日ではなく日付を指定するため、対象の授業がある曜日以外の週には影響しない)
export function buildSubstituteCronLines(classes, substituteDates) {
  const byCron = new Map();
  for (const sub of substituteDates) {
    const followedDayIndex = normalizeWeekdayIndex(sub.dayOfWeek);
    if (followedDayIndex === -1) {
      throw new Error(`不正なdayOfWeekです [SUBSTITUTE_DATES ${sub.date}]: ${sub.dayOfWeek} ('Sun'〜'Sat'で指定)`);
    }

    const followedClasses = classes.filter((cls) => normalizeWeekdayIndex(cls.dayOfWeek) === followedDayIndex);
    for (const cls of followedClasses) {
      const minute = cls.minute ?? 0;
      const { month, day, hour: utcHour, minute: utcMinute } = toUtcDateTime(sub.date, cls.hour, minute);
      const cron = `${utcMinute} ${utcHour} ${day} ${month} *`;
      const jst = `${sub.date}(${CRON_WEEKDAYS[followedDayIndex]}の時間割) ${cls.hour}:${String(minute).padStart(2, '0')} JST`;
      const entry = byCron.get(cron) ?? { names: [], jst };
      entry.names.push(cls.name);
      byCron.set(cron, entry);
    }
  }

  return [...byCron.entries()].map(
    ([cron, { names, jst }]) => `  "${cron}", # ${names.join(' / ')} ${jst} [振替]`
  );
}

export function renderTriggersBlock(classes, substituteDates = []) {
  return [
    '# このブロックは scripts/generate-crons.mjs が worker/config.js から自動生成する。手で編集しない。',
    '[triggers]',
    'crons = [',
    ...buildCronLines(classes),
    ...buildSubstituteCronLines(classes, substituteDates),
    ']',
  ].join('\n');
}

// wrangler.toml の [triggers] ブロックを生成結果で置き換える
export function replaceTriggersBlock(toml, classes, substituteDates = []) {
  const block = renderTriggersBlock(classes, substituteDates);
  // [triggers] の直前のコメント行〜次のセクションまたは末尾までを置き換える
  const pattern = /(?:^#[^\n]*\n)*^\[triggers\][\s\S]*?(?=^\[|(?![\s\S]))/m;
  if (!pattern.test(toml)) {
    return `${toml.trimEnd()}\n\n${block}\n`;
  }
  return toml.replace(pattern, `${block}\n`);
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const tomlPath = join(root, 'wrangler.toml');
  const { CONFIG } = await import(join(root, 'worker', 'config.js'));

  const toml = readFileSync(tomlPath, 'utf8');
  const updated = replaceTriggersBlock(toml, CONFIG.CLASSES, CONFIG.SUBSTITUTE_DATES ?? []);

  if (updated === toml) {
    console.log('wrangler.toml のcronsは既に最新です');
    return;
  }
  writeFileSync(tomlPath, updated);
  console.log(`wrangler.toml のcronsを更新しました (${CONFIG.CLASSES.length}授業):`);
  buildCronLines(CONFIG.CLASSES).forEach((line) => console.log(line.trim()));
  buildSubstituteCronLines(CONFIG.CLASSES, CONFIG.SUBSTITUTE_DATES ?? []).forEach((line) => console.log(line.trim()));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
