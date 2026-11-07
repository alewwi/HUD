// hud-manager/prompt-cache.js
//
// Кэш провайдера для Chat Completion (settings.hudPromptCache). Провайдеры
// кэшируют одинаковое НАЧАЛО запроса, а инструкция HUD стоит в самом конце,
// после истории, — и каждый ход её 9–12 тысяч токенов шли по полной цене.
// Здесь инструкция делится надвое: голова — задача, правила и схема, они от
// хода к ходу те же самые; index.js ставит её в начало запроса. Хвост — то,
// что меняется: снимок прошлого HUD, скрытые факты, заметки хода, — остаётся
// в конце, с короткой отсылкой к голове.
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

const ОТКРЫТИЕ = '<hud_instructions>';
const ЗАКРЫТИЕ = '</hud_instructions>';
const СХЕМА = '## 🧾 SCHEMA';
const КОНЕЦ_СХЕМЫ = '\n[/HUD]';
const ОТСЫЛКА = '## 🎯 NOW\nWrite your reply, then the [HUD] block exactly by the task, rules and schema in <hud_instructions> at the start of the conversation.';

/** { голова, хвост } или null, если инструкция не того вида (тогда — целиком в конец, как раньше). */
export function разрезатьИнструкцию(текст) {
  const s = String(текст || '');
  const начало = s.indexOf(ОТКРЫТИЕ), схема = s.indexOf(СХЕМА);
  if (начало < 0 || схема < 0) return null;
  const конецСхемы = s.indexOf(КОНЕЦ_СХЕМЫ, схема);
  if (конецСхемы < 0) return null;
  const разрез = конецСхемы + КОНЕЦ_СХЕМЫ.length;
  const голова = s.slice(начало, разрез) + '\n' + ЗАКРЫТИЕ;
  const остаток = s.slice(разрез).replace(/^\s+/, '');
  const хвост = '<hud_turn>\n' + ОТСЫЛКА + (остаток.startsWith(ЗАКРЫТИЕ) ? '' : '\n\n') + остаток.replace(ЗАКРЫТИЕ, '</hud_turn>');
  return { голова, хвост };
}
