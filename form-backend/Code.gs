/**
 * AI OASIS — приём заявок с сайта.
 * Пересылает сообщение из формы в Telegram и на почту.
 * Сайт показывает «Вы сделали первый шаг» только когда этот скрипт ответил {ok:true},
 * то есть когда сообщение доставлено хотя бы в один канал.
 *
 * Настройки (Project Settings → Script properties):
 *   TG_TOKEN   — токен бота от @BotFather
 *   TG_CHAT_ID — ваш chat id (см. функцию findChatId ниже)
 *   EMAIL      — studio@kocuba-aa.ru
 */

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Ловушка для спам-ботов: настоящий посетитель это поле не видит и не заполняет.
    if (d.website) return json_({ ok: true });

    var name = clean_(d.name, 120);
    var contact = clean_(d.contact, 200);
    var channel = clean_(d.channel, 40);
    var task = clean_(d.task, 4000);
    if (!name || !contact || !task || d.consent !== true) return json_({ ok: false, error: 'validation' });

    // Не больше 40 заявок в час: защита от массовой рассылки через форму.
    var cache = CacheService.getScriptCache();
    var count = Number(cache.get('count') || 0);
    if (count >= 40) return json_({ ok: false, error: 'rate' });
    cache.put('count', String(count + 1), 3600);

    var channels = { telegram: 'Telegram', vk: 'ВКонтакте', email: 'Почта', phone: 'Звонок' };
    var time = Utilities.formatDate(new Date(), 'Europe/Moscow', 'dd.MM.yyyy HH:mm');
    var text =
      'Новая заявка с сайта AI OASIS\n\n' +
      'Имя: ' + name + '\n' +
      'Как связаться: ' + contact + '\n' +
      'Удобный способ связи: ' + (channels[channel] || channel || 'не указан') + '\n\n' +
      'Задача:\n' + task + '\n\n' +
      'Согласие на обработку персональных данных: получено\n' +
      'Время (МСК): ' + time;

    var tg = sendTelegram_(text);
    var mail = sendMail_(name, text);
    if (!tg && !mail) return json_({ ok: false, error: 'delivery' });
    return json_({ ok: true, telegram: tg, email: mail });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  }
}

function sendTelegram_(text) {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('TG_TOKEN'), chat = p.getProperty('TG_CHAT_ID');
  if (!token || !chat) return false;
  try {
    var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ chat_id: chat, text: text, disable_web_page_preview: true })
    });
    return r.getResponseCode() === 200;
  } catch (err) { console.error(err); return false; }
}

function sendMail_(name, text) {
  var to = PropertiesService.getScriptProperties().getProperty('EMAIL');
  if (!to) return false;
  try {
    MailApp.sendEmail({ to: to, subject: 'Заявка с сайта AI OASIS: ' + name, body: text, name: 'Сайт AI OASIS' });
    return true;
  } catch (err) { console.error(err); return false; }
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Запустите один раз после того, как написали своему боту любое сообщение: chat id появится в журнале. */
function findChatId() {
  var token = PropertiesService.getScriptProperties().getProperty('TG_TOKEN');
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates');
  var upd = JSON.parse(r.getContentText()).result || [];
  upd.forEach(function (u) { if (u.message) console.log('chat id: ' + u.message.chat.id + ' (' + (u.message.chat.username || '') + ')'); });
  if (!upd.length) console.log('Сообщений нет. Напишите боту /start и запустите функцию ещё раз.');
}

/** Проверка без сайта: отправляет тестовую заявку в оба канала. */
function testSend() {
  console.log(sendTelegram_('Тест формы AI OASIS: Telegram работает'));
  console.log(sendMail_('Тест', 'Тест формы AI OASIS: почта работает'));
}
