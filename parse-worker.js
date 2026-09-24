// hud-manager/parse-worker.js
//
// Фоновый разбор прошлых ходов. Карточке для «истории» (перенос списков,
// следы, пульс за день, кадры карты тела) нужны разобранные HUD двадцати
// прошлых сообщений. Раньше их разбирали в главном потоке прямо во время
// отрисовки — в длинном чате после загрузки это сотни миллисекунд, пока лента
// стоит. Теперь при открытии чата ходы разбираются здесь, в отдельном потоке,
// а отрисовка берёт готовое из кэша (render/carryover.js, прогретьИсторию).
//
// Модули разбора те же, что в главном потоке, — результат совпадает. Им
// нужны настройки (какие разделы включены, прозвища для сравнения имён) и
// имена из Таверны: их присылают с каждым заданием.

self.window = self;
const версия = new URL(import.meta.url).search;
const загрузка = Promise.all([
  import('./settings.js' + версия),
  import('./hud-block.js' + версия),
  import('./hud-parser.js' + версия),
  import('./schema.js' + версия),
]);

self.onmessage = async (событие) => {
  const { id, настройки, имена, тексты } = событие.data || {};
  let ответ = [];
  try {
    const [{ settings }, { extractHudBlock }, { parseHUDComplex }, { normalizeJSONData }] = await загрузка;
    Object.assign(settings, настройки || {});
    self.SillyTavern = { getContext: () => ({ name1: (имена && имена.user) || '', name2: (имена && имена.char) || '', chat: [] }) };
    ответ = (тексты || []).map(([ключ, текст]) => {
      try {
        const блок = extractHudBlock(текст);
        return [ключ, блок ? normalizeJSONData(parseHUDComplex(блок)) : null];
      } catch (_) {
        return [ключ, null];
      }
    });
  } catch (e) {
    self.postMessage({ id, ошибка: String(e && e.message || e) });
    return;
  }
  // Разбор, который не переносится между потоками (вдруг в нём окажется
  // функция), главный поток сделает сам.
  try { self.postMessage({ id, ответ }); } catch (e) { self.postMessage({ id, ошибка: String(e && e.message || e) }); }
};
