function buildMessage(cls) {
  var lines = ['**【' + cls.name + '】** ' + CONFIG.MESSAGE];
  if (cls.url) lines.push(cls.url);
  return lines.join('\n');
}

function sendNotification(cls) {
  var payload = {
    username: CONFIG.BOT_NAME,
    content: buildMessage(cls),
  };

  if (CONFIG.BOT_AVATAR_URL) {
    payload.avatar_url = CONFIG.BOT_AVATAR_URL;
  }

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);

  if (response.getResponseCode() !== 204) {
    console.error('Discord送信エラー [' + cls.name + ']:', response.getContentText());
  } else {
    console.log('出席確認通知を送信しました [' + cls.name + ']:', new Date());
  }
}

function dispatchNotifications() {
  var now = new Date();
  var dayOfWeek = now.getDay() + 1; // getDay()は0=日なので+1して1=日に合わせる
  var hour = now.getHours();
  var minute = now.getMinutes();

  var sent = 0;
  CONFIG.CLASSES.forEach(function (cls) {
    var clsMinute = cls.minute || 0;
    // nearMinute()は±15分の誤差があるため、設定分の前後15分以内かを確認する
    var diff = Math.abs(minute - clsMinute);
    if (cls.dayOfWeek === dayOfWeek && cls.hour === hour && diff <= 15) {
      if (sent > 0) Utilities.sleep(3000);
      sendNotification(cls);
      sent++;
    }
  });
}
