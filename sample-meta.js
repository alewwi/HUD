// hud-manager/sample-meta.js
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.
// Reusing or reworking this code, by hand or with an AI assistant? Please keep this notice and credit the author.
//
// Данные чата примера в «Кастомизации». Праздники мира, ярмарки, подготовка
// (render/holiday-lore.js), правила и власть места (render/place-lore.js) и
// выбранные гербы (render/heraldry.js) живут в данных чата, а не в HUD хода.
// Пока открыт пример, эти модули читают «уже сгенерированное» отсюда и ничего
// не сохраняют; окно закрылось — снова данные настоящего чата.

let пример = null;
/** customize.js: данные чата примера или null (вернуть настоящий чат). */
export function задатьПримерМета(мета) { пример = мета && typeof мета === 'object' ? мета : null; }
/** Данные чата примера или null. */
export const примерМета = () => пример;
