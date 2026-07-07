import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchNotifications } from './notify.js';

function makeConfig(classes) {
  return {
    BOT_NAME: 'テストBot',
    BOT_AVATAR_URL: '',
    MESSAGE: '📋 出席確認です。',
    CLASSES: classes,
  };
}

const env = { WEBHOOK_URL: 'https://discord.example/webhook' };

describe('dispatchNotifications', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ status: 204, ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('JSTの曜日・時刻が一致する授業に通知を送る', async () => {
    // UTC 2026-07-06(月) 00:00 = JST 月曜 09:00
    const now = new Date('2026-07-06T00:00:00Z');
    const config = makeConfig([
      { name: '授業A', url: 'https://example.com/a', dayOfWeek: 'Mon', hour: 9, minute: 0 },
    ]);

    await dispatchNotifications(config, env, now);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(env.WEBHOOK_URL);
    const payload = JSON.parse(init.body);
    expect(payload.username).toBe('テストBot');
    expect(payload.content).toContain('授業A');
    expect(payload.content).toContain('https://example.com/a');
    expect(payload.avatar_url).toBeUndefined();
  });

  it('UTCとJSTで日付をまたぐ場合もJST基準で判定する', async () => {
    // UTC 2026-07-07(火) 15:30 = JST 水曜 00:30
    const now = new Date('2026-07-07T15:30:00Z');
    const config = makeConfig([
      { name: '深夜講義', dayOfWeek: 'Wed', hour: 0, minute: 30 },
    ]);

    await dispatchNotifications(config, env, now);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('曜日・時刻が一致しない授業には送らない', async () => {
    const now = new Date('2026-07-06T00:00:00Z'); // JST 月曜 09:00
    const config = makeConfig([
      { name: '火曜の授業', dayOfWeek: 'Tue', hour: 9, minute: 0 },
      { name: '月曜10時の授業', dayOfWeek: 'Mon', hour: 10, minute: 0 },
      { name: '月曜9時30分の授業', dayOfWeek: 'Mon', hour: 9, minute: 30 },
    ]);

    await dispatchNotifications(config, env, now);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('minute省略時は0分として扱う', async () => {
    const now = new Date('2026-07-06T00:00:00Z'); // JST 月曜 09:00
    const config = makeConfig([
      { name: 'minute省略', dayOfWeek: 'Mon', hour: 9 },
    ]);

    await dispatchNotifications(config, env, now);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dayOfWeekは大文字小文字を区別しない', async () => {
    const now = new Date('2026-07-06T00:00:00Z'); // JST 月曜 09:00
    const config = makeConfig([
      { name: '大文字表記', dayOfWeek: 'MON', hour: 9, minute: 0 },
    ]);

    await dispatchNotifications(config, env, now);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('BOT_AVATAR_URL設定時はavatar_urlを含める', async () => {
    const now = new Date('2026-07-06T00:00:00Z');
    const config = {
      ...makeConfig([{ name: '授業A', dayOfWeek: 'Mon', hour: 9, minute: 0 }]),
      BOT_AVATAR_URL: 'https://example.com/avatar.png',
    };

    await dispatchNotifications(config, env, now);

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.avatar_url).toBe('https://example.com/avatar.png');
  });

  it('同時刻に複数授業がマッチした場合は間隔を空けて全件送る', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-07-06T00:00:00Z');
    const config = makeConfig([
      { name: '授業A', dayOfWeek: 'Mon', hour: 9, minute: 0 },
      { name: '授業B', dayOfWeek: 'Mon', hour: 9, minute: 0 },
    ]);

    const promise = dispatchNotifications(config, env, now);
    await vi.advanceTimersByTimeAsync(3000);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const contents = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).content);
    expect(contents[0]).toContain('授業A');
    expect(contents[1]).toContain('授業B');
  });

  it('送信失敗(fetch例外)でも他の処理を巻き込まず完了する', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error('network down'));
    const now = new Date('2026-07-06T00:00:00Z');
    const config = makeConfig([{ name: '授業A', dayOfWeek: 'Mon', hour: 9, minute: 0 }]);

    await expect(dispatchNotifications(config, env, now)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
