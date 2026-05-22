// config.js の dayOfWeek 数値 (1=日〜7=土) を ScriptApp.WeekDay 列挙型へ変換
var DAY_MAP = {
  1: ScriptApp.WeekDay.SUNDAY,
  2: ScriptApp.WeekDay.MONDAY,
  3: ScriptApp.WeekDay.TUESDAY,
  4: ScriptApp.WeekDay.WEDNESDAY,
  5: ScriptApp.WeekDay.THURSDAY,
  6: ScriptApp.WeekDay.FRIDAY,
  7: ScriptApp.WeekDay.SATURDAY,
};

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });

  var seen = {};
  CONFIG.CLASSES.forEach(function (cls) {
    var minute = cls.minute || 0;
    var key = cls.dayOfWeek + '-' + cls.hour + '-' + minute;
    if (!seen[key]) {
      seen[key] = true;
      var builder = ScriptApp.newTrigger('dispatchNotifications')
        .timeBased()
        .onWeekDay(DAY_MAP[cls.dayOfWeek])
        .atHour(cls.hour);
      if (minute !== 0) builder = builder.nearMinute(minute);
      builder.create();
    }
  });

  console.log('トリガーを設定しました (' + Object.keys(seen).length + '件)');
}

function deleteTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
  console.log('全トリガーを削除しました');
}
