import { describe, expect, it } from 'vitest';
import { toUtcCron, buildCronLines, buildSubstituteCronLines, replaceTriggersBlock } from './generate-crons.mjs';

describe('toUtcCron', () => {
  it('JSTの時刻を-9時間してUTCのcron式にする', () => {
    expect(toUtcCron({ name: 'A', dayOfWeek: 'Mon', hour: 9, minute: 0 })).toBe('0 0 * * MON');
    expect(toUtcCron({ name: 'B', dayOfWeek: 'Wed', hour: 14, minute: 50 })).toBe('50 5 * * WED');
  });

  it('JST 9時未満は前日にずれる(日曜は土曜へ)', () => {
    expect(toUtcCron({ name: 'A', dayOfWeek: 'Mon', hour: 8, minute: 30 })).toBe('30 23 * * SUN');
    expect(toUtcCron({ name: 'B', dayOfWeek: 'Sun', hour: 0, minute: 0 })).toBe('0 15 * * SAT');
  });

  it('minute省略時は0分として扱う', () => {
    expect(toUtcCron({ name: 'A', dayOfWeek: 'Fri', hour: 10 })).toBe('0 1 * * FRI');
  });

  it('不正な値はエラーにする', () => {
    expect(() => toUtcCron({ name: 'A', dayOfWeek: 8, hour: 9 })).toThrow(/dayOfWeek/);
    expect(() => toUtcCron({ name: 'A', dayOfWeek: 'Mon', hour: 24 })).toThrow(/hour/);
    expect(() => toUtcCron({ name: 'A', dayOfWeek: 'Mon', hour: 9, minute: 60 })).toThrow(/minute/);
  });
});

describe('buildCronLines', () => {
  it('授業名コメント付きの行を生成する', () => {
    const lines = buildCronLines([
      { name: '授業A', dayOfWeek: 'Mon', hour: 9, minute: 0 },
    ]);
    expect(lines).toEqual(['  "0 0 * * MON", # 授業A Mon 9:00 JST']);
  });

  it('同一時刻の授業は1つのcronにまとめる', () => {
    const lines = buildCronLines([
      { name: '授業A', dayOfWeek: 'Mon', hour: 9, minute: 0 },
      { name: '授業B', dayOfWeek: 'Mon', hour: 9, minute: 0 },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('授業A / 授業B');
  });
});

describe('buildSubstituteCronLines', () => {
  const classes = [
    { name: '月曜授業', dayOfWeek: 'Mon', hour: 9, minute: 0 },
    { name: '水曜授業', dayOfWeek: 'Wed', hour: 14, minute: 50 },
  ];

  it('振替先の曜日の授業から、指定日だけ発火するcronを生成する', () => {
    const lines = buildSubstituteCronLines(classes, [{ date: '2026-11-04', dayOfWeek: 'Mon' }]);
    expect(lines).toEqual(['  "0 0 4 11 *", # 月曜授業 2026-11-04(MONの時間割) 9:00 JST [振替]']);
  });

  it('JST 9時未満は前日にずれる', () => {
    const lines = buildSubstituteCronLines(
      [{ name: '早朝授業', dayOfWeek: 'Mon', hour: 8, minute: 30 }],
      [{ date: '2026-11-04', dayOfWeek: 'Mon' }]
    );
    expect(lines).toEqual(['  "30 23 3 11 *", # 早朝授業 2026-11-04(MONの時間割) 8:30 JST [振替]']);
  });

  it('振替先の曜日に該当する授業がなければ何も生成しない', () => {
    const lines = buildSubstituteCronLines(classes, [{ date: '2026-11-04', dayOfWeek: 'Tue' }]);
    expect(lines).toEqual([]);
  });

  it('不正なdayOfWeekはエラーにする', () => {
    expect(() => buildSubstituteCronLines(classes, [{ date: '2026-11-04', dayOfWeek: 'XYZ' }])).toThrow(
      /dayOfWeek/
    );
  });
});

describe('replaceTriggersBlock', () => {
  const classes = [{ name: '授業A', dayOfWeek: 'Mon', hour: 9, minute: 0 }];

  it('既存の[triggers]ブロックを直前のコメントごと置き換える', () => {
    const toml = [
      'name = "attendance-bot"',
      '',
      '[observability]',
      'enabled = true',
      '',
      '# 古いコメント',
      '[triggers]',
      'crons = [',
      '  "0 0 * * FRI", # 古いエントリ',
      ']',
    ].join('\n');

    const result = replaceTriggersBlock(toml, classes);

    expect(result).toContain('"0 0 * * MON", # 授業A Mon 9:00 JST');
    expect(result).not.toContain('古いエントリ');
    expect(result).not.toContain('古いコメント');
    expect(result).toContain('[observability]');
  });

  it('[triggers]の後に別セクションがあっても巻き込まない', () => {
    const toml = [
      '[triggers]',
      'crons = [',
      '  "0 0 * * FRI",',
      ']',
      '',
      '[observability]',
      'enabled = true',
    ].join('\n');

    const result = replaceTriggersBlock(toml, classes);

    expect(result).toContain('[observability]');
    expect(result).toContain('enabled = true');
    expect(result).toContain('"0 0 * * MON"');
  });

  it('[triggers]がなければ末尾に追記する', () => {
    const toml = 'name = "attendance-bot"\n';

    const result = replaceTriggersBlock(toml, classes);

    expect(result).toContain('name = "attendance-bot"');
    expect(result).toContain('[triggers]');
    expect(result).toContain('"0 0 * * MON"');
  });
});
