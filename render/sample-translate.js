// hud-manager/render/sample-translate.js
//
// Пример «Кастомизации» на языке из таблицы переводчика. Английский пример
// (sample-hud-en.js) режется на куски текста: строка — по «; » и « | », у
// куска отрезается короткий код «xx: ». Куски попадают в таблицу
// (translations/build.mjs), а здесь заменяются переводом. Ключи JSON, коды,
// числа, даты и одиночные английские слова (значения-коды вроде fresh, high,
// open, по которым HUD разбирает блок) не трогаются.

const РАЗДЕЛ = /(;\s+|\s\|\s)/;
const КОД = /^([A-Za-z][A-Za-z0-9_]{0,5}):\s*/;
const БЛОК = /^\[HUD\]\n```json\n([\s\S]*)\n```\n\[\/HUD\]$/;

/** Кусок стоит переводить: в нём есть слово, и это не код, не число, не дата. */
export function кусокДляПеревода(s) {
  const т = String(s || '').trim();
  if (!/\p{L}{2}/u.test(т)) return false;
  if (/^[a-z][a-z_-]*$/.test(т)) return false;            // fresh, healing, high, open…
  if (/^[A-Z0-9_]{1,6}$/.test(т)) return false;            // VISA, SS, W…
  if (/^\{\{\w+\}\}$/.test(т)) return false;               // {{user}}
  if (/[А-Яа-яЁё]/.test(т)) return false;                  // служебные метки примера (id)
  // Только слова с заглавной — имена и списки имён («Lilian Grey», «Mark Grey,
  // Anna Grey», «Artyom Wolf: 80»): по ним HUD связывает людей между вкладками.
  const слова = т.match(/\p{L}[\p{L}'’-]*/gu) || [];
  if (слова.every(w => /^\p{Lu}/u.test(w))) return false;
  return true;
}

/** Строка с заменой каждого куска текста через f(кусок) → новый кусок (или тот же). */
export function отобразитьСтроку(s, f) {
  if (typeof s !== 'string' || !s) return s;
  const блок = s.match(БЛОК);
  if (блок) {
    try {
      const данные = JSON.parse(блок[1]);
      const отступ = /\n "/.test(блок[1]) ? 1 : 0;
      return '[HUD]\n```json\n' + JSON.stringify(отобразитьЗначение(данные, f), null, отступ || undefined) + '\n```\n[/HUD]';
    } catch (_) { return s; }
  }
  return s.split(РАЗДЕЛ).map((часть, i) => {
    if (i % 2) return часть;                                  // разделитель
    const код = (часть.match(КОД) || [''])[0];
    const остаток = часть.slice(код.length);
    const м = остаток.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!м || !кусокДляПеревода(м[2])) return часть;
    const новый = f(м[2]);
    return код + м[1] + (typeof новый === 'string' && новый ? новый : м[2]) + м[3];
  }).join('');
}

/** Объект, массив или строка примера с переведёнными кусками; ключи — как были. */
export function отобразитьЗначение(v, f) {
  if (typeof v === 'string') return отобразитьСтроку(v, f);
  if (Array.isArray(v)) return v.map(x => отобразитьЗначение(x, f));
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const out = {};
    for (const [к, x] of Object.entries(v)) out[к] = отобразитьЗначение(x, f);
    return out;
  }
  return v;
}

/** Все куски текста модуля примера — для таблицы переводчика. */
export function кускиПримера(модуль) {
  const все = new Set();
  const собрать = (к) => { все.add(к); return к; };
  for (const v of Object.values(модуль)) {
    const значение = typeof v === 'function' ? v('') : v;
    отобразитьЗначение(значение, собрать);
  }
  return [...все];
}

/** Модуль примера на языке перевода: те же экспорты, тексты через перевод(кусок). */
export function перевестиМодуль(модуль, перевод) {
  const f = (к) => перевод(к) || к;
  const out = {};
  for (const [имя, v] of Object.entries(модуль)) {
    out[имя] = typeof v === 'function' ? (...а) => отобразитьЗначение(v(...а), f) : отобразитьЗначение(v, f);
  }
  return out;
}
