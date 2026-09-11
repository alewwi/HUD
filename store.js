// Хранилище архива.
//
// Раньше отчёты лежали в localStorage. У него две беды: общий предел на весь
// сайт около пяти мегабайт на все расширения сразу, и запись синхронная — на
// большом отчёте страница подвисает. Переносим в IndexedDB: там место
// измеряется сотнями мегабайт, а запись не блокирует отрисовку.
//
// Отчёт перед укладкой сжимаем. Библиотеку тянуть неоткуда — расширение
// работает без сети, — поэтому здесь свой LZW: на JSON с повторяющимися
// именами полей он даёт трёх-пятикратное сжатие, чего с запасом хватает.
//
// Если IndexedDB недоступна (приватный режим, старый браузер), всё молча
// уезжает обратно в localStorage — так же, как было.

const БАЗА = 'tavernos-hud';
const ХРАНИЛИЩЕ = 'archive';
const ВЕРСИЯ = 1;
const ПРЕФИКС = 'hud_archive_';

/* --- Сжатие ---------------------------------------------------------------
   LZW поверх БАЙТОВ, а не символов. Это важно: если жать посимвольно, то
   кириллическая буква с кодом 1040 сталкивается с кодами словаря, которые
   тоже начинаются с 256, и распаковка выдаёт мусор. Байты же всегда 0..255,
   поэтому словарные коды с 256 ни с чем не спорят.

   Словарь обрываем на 0xD800, чтобы ни один код не попал в суррогатный
   диапазон: лоне-суррогат в строке ломается при любой сериализации. */

const ПРЕДЕЛ_СЛОВАРЯ = 0xD800;

export function compress(строка) {
  const s = String(строка == null ? '' : строка);
  if (!s) return '';
  const байты = new TextEncoder().encode(s);
  if (!байты.length) return '';
  const словарь = new Map();
  let следующий = 256;
  let out = '';
  let накоплено = String.fromCharCode(байты[0]);
  for (let i = 1; i < байты.length; i++) {
    const символ = String.fromCharCode(байты[i]);
    const кандидат = накоплено + символ;
    if (словарь.has(кандидат)) { накоплено = кандидат; continue; }
    out += String.fromCharCode(накоплено.length === 1 ? накоплено.charCodeAt(0) : словарь.get(накоплено));
    if (следующий < ПРЕДЕЛ_СЛОВАРЯ) словарь.set(кандидат, следующий++);
    накоплено = символ;
  }
  out += String.fromCharCode(накоплено.length === 1 ? накоплено.charCodeAt(0) : словарь.get(накоплено));
  return out;
}

export function decompress(упакованное) {
  const s = String(упакованное == null ? '' : упакованное);
  if (!s) return '';
  const словарь = new Map();
  let следующий = 256;
  let предыдущая = String.fromCharCode(s.charCodeAt(0));
  const куски = [предыдущая];
  for (let i = 1; i < s.length; i++) {
    const код = s.charCodeAt(i);
    let текущая;
    if (код < 256) текущая = String.fromCharCode(код);
    else if (словарь.has(код)) текущая = словарь.get(код);
    // Классический случай LZW: код ещё не в словаре, но выводится прямо сейчас.
    else текущая = предыдущая + предыдущая[0];
    куски.push(текущая);
    if (следующий < ПРЕДЕЛ_СЛОВАРЯ) словарь.set(следующий++, предыдущая + текущая[0]);
    предыдущая = текущая;
  }
  const собрано = куски.join('');
  const байты = new Uint8Array(собрано.length);
  for (let i = 0; i < собрано.length; i++) байты[i] = собрано.charCodeAt(i) & 0xFF;
  return new TextDecoder().decode(байты);
}

/* --- IndexedDB ------------------------------------------------------------ */

let открытие = null;

function открыть() {
  if (открытие) return открытие;
  открытие = new Promise((готово, беда) => {
    if (typeof indexedDB === 'undefined') { беда(new Error('IndexedDB недоступна')); return; }
    const запрос = indexedDB.open(БАЗА, ВЕРСИЯ);
    запрос.onupgradeneeded = () => {
      const db = запрос.result;
      if (!db.objectStoreNames.contains(ХРАНИЛИЩЕ)) db.createObjectStore(ХРАНИЛИЩЕ);
    };
    запрос.onsuccess = () => готово(запрос.result);
    запрос.onerror = () => беда(запрос.error || new Error('IndexedDB не открылась'));
    запрос.onblocked = () => беда(new Error('IndexedDB заблокирована другой вкладкой'));
  }).catch((err) => {
    console.debug('[TavernOS HUD] IndexedDB недоступна, остаёмся на localStorage:', err && err.message);
    return null;
  });
  return открытие;
}

function сделка(режим) {
  return открыть().then((db) => {
    if (!db) return null;
    return db.transaction(ХРАНИЛИЩЕ, режим).objectStore(ХРАНИЛИЩЕ);
  });
}

function обещание(запрос) {
  return new Promise((готово, беда) => {
    запрос.onsuccess = () => готово(запрос.result);
    запрос.onerror = () => беда(запрос.error);
  });
}

/* --- Публичное ------------------------------------------------------------ */

/**
 * Достать запись. Сначала IndexedDB, потом — на случай архивов, отложенных
 * прошлыми версиями, — localStorage; найденное оттуда сразу переносим.
 */
export async function readEntry(ключ) {
  try {
    const хранилище = await сделка('readonly');
    if (хранилище) {
      const запись = await обещание(хранилище.get(ключ));
      if (запись) {
        return typeof запись.packed === 'string'
          ? { ...запись, report: JSON.parse(decompress(запись.packed)), packed: undefined }
          : запись;
      }
    }
  } catch (err) {
    console.debug('[TavernOS HUD] чтение архива из IndexedDB не удалось:', err && err.message);
  }
  // Наследство: то, что успели положить прошлые версии.
  try {
    const raw = localStorage.getItem(ключ);
    if (!raw) return null;
    const запись = JSON.parse(raw);
    if (!запись || !запись.report) return null;
    // Переносим и убираем из localStorage: место там дороже.
    writeEntry(ключ, запись).then(() => {
      try { localStorage.removeItem(ключ); } catch (_) {}
    });
    return запись;
  } catch (_) { return null; }
}

/** Положить запись. Возвращает true, если получилось хоть куда-то. */
export async function writeEntry(ключ, запись) {
  const упакованная = {
    signature: запись.signature,
    savedAt: запись.savedAt,
    packed: compress(JSON.stringify(запись.report)),
  };
  try {
    const хранилище = await сделка('readwrite');
    if (хранилище) {
      await обещание(хранилище.put(упакованная, ключ));
      return true;
    }
  } catch (err) {
    console.debug('[TavernOS HUD] запись архива в IndexedDB не удалась:', err && err.message);
  }
  // Запасной путь — как было раньше.
  try {
    localStorage.setItem(ключ, JSON.stringify(запись));
    return true;
  } catch (_) { return false; }
}

/** Убрать весь архив из обоих хранилищ. Возвращает, сколько записей убрано. */
export async function clearAll() {
  let убрано = 0;
  try {
    const хранилище = await сделка('readwrite');
    if (хранилище) {
      const ключи = await обещание(хранилище.getAllKeys());
      убрано += ключи.length;
      await обещание(хранилище.clear());
    }
  } catch (err) {
    console.debug('[TavernOS HUD] очистка IndexedDB не удалась:', err && err.message);
  }
  const убрать = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(ПРЕФИКС)) убрать.push(k);
  }
  убрать.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
  return убрано + убрать.length;
}

/** Сколько места занято: записей и примерный объём в байтах. */
export async function usage() {
  let записей = 0, байт = 0;
  try {
    const хранилище = await сделка('readonly');
    if (хранилище) {
      const всё = await обещание(хранилище.getAll());
      записей += всё.length;
      // Строка UTF-16: два байта на символ — оценка сверху, но честная.
      for (const з of всё) байт += (з && з.packed ? з.packed.length : 0) * 2;
    }
  } catch (_) {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(ПРЕФИКС)) continue;
    записей++;
    байт += (localStorage.getItem(k) || '').length * 2;
  }
  return { записей, байт };
}
