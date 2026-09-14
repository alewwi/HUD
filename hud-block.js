// hud-manager/hud-block.js
//
// Поиск блока [HUD] в тексте сообщения. Одна регулярка на всё расширение:
// раньше она была скопирована в семь файлов, и копии начали расходиться.
// Тег узнаём и в виде HTML-сущностей (&lt;HUD&gt;, &#91;HUD&#93;) — так его
// отдаёт разметка сообщения. Незакрытый блок тянется до конца текста.

const ОТКР = String.raw`(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)`;
const ЗАКР = String.raw`(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)`;

// Регулярки отдаём новыми на каждый вызов: у глобальной lastIndex живёт
// между вызовами, и общий объект тихо пропускал совпадения.

/** Открывающий тег [HUD]. */
export const hudOpenRe = (flags = 'i') => new RegExp(ОТКР, flags);

/** Закрывающий тег [/HUD]. */
export const hudCloseRe = (flags = 'i') => new RegExp(ЗАКР, flags);

/** Весь блок от открывающего тега до закрывающего или до конца текста.
    inner — с группой содержимого между тегами. */
export const hudBlockRe = (flags = 'i', inner = false) =>
  new RegExp(`${ОТКР}${inner ? '([\\s\\S]*?)' : '[\\s\\S]*?'}(?:${ЗАКР}|$)`, flags);

/** Блок [HUD]…[/HUD] из текста; пустая строка, если блока нет. */
export function extractHudBlock(text) {
  if (typeof text !== 'string') return '';
  const m = text.match(hudBlockRe('i'));
  return m ? m[0] : '';
}
