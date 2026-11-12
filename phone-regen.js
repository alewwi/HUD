// hud-manager/phone-regen.js
//
// Перегенерация одного телефона (кнопка в строке состояния телефона, regen.js).
// Модель просят прислать только "cm" (переписки) и "phn" (приложения). Если
// она прислала весь HUD или целое сообщение с прозой — отсюда берутся только
// эти два раздела, остальное выбрасывается. В HUD сообщения они встают на
// место прежних, а всё остальное в блоке остаётся как было, до символа.
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { hudБлоки } from './hud-block.js?v=23.89.12';

// Код раздела → имена, под которыми модель могла его написать.
export const РАЗДЕЛЫ_ТЕЛЕФОНА = { cm: ['cm', 'chatsMap', 'chats', 'Переписки'], phn: ['phn', 'phone', 'Телефон'] };

const безОграды = (t) => String(t || '').replace(/^\s*`{3,}\s*json\s*/i, '').replace(/^\s*`{3,}\s*/, '').replace(/\s*`{3,}\s*$/, '').trim();
// Починка блока HUD (hud-parser.js) переводит ключи в развёрнутый вид, а в HUD
// сообщения нужны коды, — поэтому чиним только мелочь: лишние запятые.
function объект(t) {
  const s = безОграды(t);
  for (const вариант of [s, s.replace(/,\s*([}\]])/g, '$1')]) {
    try { const о = JSON.parse(вариант); if (о && typeof о === 'object' && !Array.isArray(о)) return о; } catch (_) { /* следующий */ }
  }
  return null;
}

/**
 * Где в тексте JSON значение ключа-объекта: { от, до } — от «"ключ"» до
 * закрывающей «}» включительно, и где само значение. Скобки внутри строк
 * («{{char}}» в тексте сообщения) не считаются. null — ключа нет.
 */
export function местоКлюча(текст, имя, { верхний = false } = {}) {
  const s = String(текст || '');
  const re = new RegExp(`"${имя.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*[{[]`, 'g');
  // Глубина вложенности в каждой точке — вне строк: ключ верхнего уровня лежит на глубине 1.
  const глубина = (до) => { let г = 0, вСтроке = false; for (let i = 0; i < до; i++) { const c = s[i]; if (вСтроке) { if (c === '\\') i++; else if (c === '"') вСтроке = false; continue; } if (c === '"') вСтроке = true; else if (c === '{' || c === '[') г++; else if (c === '}' || c === ']') г--; } return вСтроке ? -1 : г; };
  let м;
  while ((м = re.exec(s))) {
    // Ключ, а не кусок строки: перед ним — «{», «,» или перевод строки.
    const перед = s.slice(0, м.index).replace(/\s+$/, '').slice(-1);
    if (перед && !'{,'.includes(перед)) continue;
    if (верхний && глубина(м.index) !== 1) continue;
    const начало = м.index + м[0].length - 1;
    let г = 0, вСтроке = false;
    for (let i = начало; i < s.length; i++) {
      const c = s[i];
      if (вСтроке) { if (c === '\\') i++; else if (c === '"') вСтроке = false; continue; }
      if (c === '"') вСтроке = true;
      else if (c === '{' || c === '[') г++;
      else if ((c === '}' || c === ']') && !--г) return { от: м.index, до: i + 1, значение: s.slice(начало, i + 1) };
    }
    return null;
  }
  return null;
}

function изОбъекта(о) {
  const итог = {};
  if (!о) return итог;
  for (const [код, имена] of Object.entries(РАЗДЕЛЫ_ТЕЛЕФОНА)) {
    const ключ = имена.find(и => о[и] && typeof о[и] === 'object' && !Array.isArray(о[и]));
    if (ключ) итог[код] = о[ключ];
  }
  return итог;
}

/** { cm?, phn? } из ответа модели или null, если телефона в нём нет. */
export function вырезатьТелефон(текст) {
  const s = String(текст || '');
  const кандидаты = [...hudБлоки(s).map(б => б.inner), s];
  for (const к of кандидаты) {
    const итог = изОбъекта(объект(к));
    if (!итог.cm && !итог.phn) {
      // Испорченный JSON вокруг: сами разделы могут быть целыми.
      for (const [код, имена] of Object.entries(РАЗДЕЛЫ_ТЕЛЕФОНА)) {
        for (const и of имена) {
          const м = местоКлюча(к, и);
          const о = м && объект(м.значение);
          if (о) { итог[код] = о; break; }
        }
      }
    }
    if (итог.cm || итог.phn) return итог;
  }
  return null;
}

/**
 * Блок HUD сообщения, где "cm" и "phn" заменены присланными. Остальной
 * текст блока не трогается. Раздела, которого в блоке не было, — дописывается
 * в конец JSON. null — блок не похож на HUD с JSON.
 */
export function вставитьТелефон(блок, телефон) {
  const б = hudБлоки(String(блок || ''))[0];
  if (!б || !телефон) return null;
  let inner = б.inner;
  for (const [код, имена] of Object.entries(РАЗДЕЛЫ_ТЕЛЕФОНА)) {
    if (!телефон[код]) continue;
    const новое = JSON.stringify(телефон[код], null, 2).replace(/\n/g, '\n  ');
    // Только ключ верхнего уровня: "cm" внутри другого раздела — не телефон.
    // Значение любое — и объект, и ошибочный массив: дубля ключа не будет.
    const м = имена.map(и => местоКлюча(inner, и, { верхний: true })).find(Boolean);
    if (м) { inner = inner.slice(0, м.от) + `"${код}": ` + новое + inner.slice(м.до); continue; }
    // Раздела не было: перед последней «}» JSON.
    const конец = inner.lastIndexOf('}');
    if (конец < 0) return null;
    const до = inner.slice(0, конец).replace(/\s+$/, '');
    inner = до + (до.endsWith('{') ? '' : ',') + `\n  "${код}": ` + новое + '\n' + inner.slice(конец);
  }
  return б.full.replace(б.inner, () => inner);
}
