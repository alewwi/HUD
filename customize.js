// hud-manager/customize.js
//
// Окно «Кастомизация»: слева панель темы (темы, цвета, шрифты, вид блоков),
// справа живой HUD — последний из чата или пример. Вынесено из index.js и
// грузится через import() при первом открытии окна (загрузитьКастомизацию):
// при старте ни окно, ни пример HUD не нужны.

import { presetRowHTML, paletteRowHTML, THEME_CATEGORIES } from './themes.js?v=23.48.1';
import { settings, МИНИМАЛИЗМ, КЛЮЧИ_АВТО } from './settings.js?v=23.48.1';
import { escapeHtml, getSafeUserName, guardTouchSwipe } from './utils.js?v=23.48.1';
import { ВИДЫ_БЛОКОВ, видБлока } from './render/views.js?v=23.48.1';
import { разметкаВкладок, подключитьВкладки, задатьЦены, списокВкладок } from './customize-tabs.js?v=23.48.1';
import { ВИДЫ_ЦИКЛА } from './render/intimacy.js?v=23.48.1';
import { hudБлоки } from './hud-block.js?v=23.48.1';
import { parseHUDComplex } from './hud-parser.js?v=23.48.1';
import { ПРИМЕР_HUD_ТЕКСТ, ПРИМЕР_СЕМЬИ, БАЗОВЫЙ_HUD_ТЕКСТ, ПРИМЕР_БОЯ, ПРИМЕР_БОЯ_РАНЫ, ПРИМЕР_БЫТА_ПРОШЛОЕ } from './render/sample-hud.js?v=23.48.1';
import { задатьПримерСемьи } from './render/conception.js?v=23.48.1';
import { привязатьИсторию } from './render/intimacy.js?v=23.48.1';

// Всё нужное из index.js приходит в «основа» (геттеры — значения живые):
// applyCardUiState, applyThemeColors, getStContextSafe, lastLazyThunks, readCardUiState, renderHUD, saveSettings, РАЗДЕЛИТЕЛИ, РАМКИ_ПОРТРЕТА, УГЛЫ_ШАПКИ, видыМенялись, выбор, перерисоватьКарточкиЧата, путьУзла.
let основа = null;
export function подключить(связь) { основа = связь; }

// Вспомогательная функция для генерации опций шрифтов (все поддерживают кириллицу)
export function makeFontOptions(selectedVal) {
  const groups = {
    "Базовые (System)": [
      {v:"inherit", n:"Тема Tavern"}, {v:"system-ui, sans-serif", n:"Системный (Apple/UI)"}, {v:"'Times New Roman', serif", n:"Times New Roman"}, {v:"'Courier New', monospace", n:"Courier New"}, {v:"Arial, sans-serif", n:"Arial"}
    ],
    "Современные & UI (Clean)": [
      {v:"'Roboto', sans-serif", n:"Roboto"}, {v:"'Montserrat', sans-serif", n:"Montserrat"}, {v:"'Open Sans', sans-serif", n:"Open Sans"}, {v:"'Nunito', sans-serif", n:"Nunito"}, {v:"'Comfortaa', cursive", n:"Comfortaa"}, {v:"'Oswald', sans-serif", n:"Oswald"}
    ],
    "Киберпанк & Sci-Fi": [
      {v:"'Jura', sans-serif", n:"Jura (Технический)"}, {v:"'Unbounded', sans-serif", n:"Unbounded (Неоновый)"}, {v:"'Russo One', sans-serif", n:"Russo One (Тяжелый)"}, {v:"'Exo 2', sans-serif", n:"Exo 2 (Космос)"}, {v:"'Rubik Mono One', sans-serif", n:"Rubik Mono (Блок)"}, {v:"'Press Start 2P', cursive", n:"Press Start 2P (Пиксель)"}
    ],
    "Фэнтези & Готика": [
      {v:"'Playfair Display', serif", n:"Playfair (Элегантный)"}, {v:"'Cormorant Garamond', serif", n:"Cormorant (Древний)"}, {v:"'Philosopher', sans-serif", n:"Philosopher (Эльфийский)"}, {v:"'Alice', serif", n:"Alice (Винтаж)"}, {v:"'Lora', serif", n:"Lora (Магический)"}, {v:"'Kurale', serif", n:"Kurale (Сказка)"}, {v:"'Eczar', serif", n:"Eczar (Алхимия)"}, {v:"'Kelly Slab', cursive", n:"Kelly Slab (Дизельпанк)"}
    ],
    "Рукописные & Дневник": [
      {v:"'Caveat', cursive", n:"Caveat (Быстрый)"}, {v:"'Pacifico', cursive", n:"Pacifico (Маркер)"}, {v:"'Marck Script', cursive", n:"Marck Script (Каллиграфия)"}, {v:"'Bad Script', cursive", n:"Bad Script (Почерк)"}, {v:"'Neucha', cursive", n:"Neucha (Карандаш)"}, {v:"'Pangolin', cursive", n:"Pangolin (Мягкий)"}, {v:"'Amatic SC', cursive", n:"Amatic SC (Тонкий)"}
    ]
  };
  let html = '';
  for (const [group, fonts] of Object.entries(groups)) {
    html += `<optgroup label="${group}">`;
    for (const f of fonts) {
      html += `<option value="${f.v}" ${selectedVal === f.v ? 'selected' : ''}>${f.n}</option>`;
    }
    html += `</optgroup>`;
  }
  return html;
}

export function разметкаПанелиТемы() {
  return `
        <div class="hud-theme-presets">
          <div class="hud-theme-presets-title">Готовые темы</div>
          <div class="hud-theme-presets-row">${presetRowHTML(settings.themePreset)}</div>
          <div class="hud-theme-palettes-row">${paletteRowHTML(settings.themePreset, settings.themePalette)}</div>
          <div class="hud-theme-presets-note">Тема просто выставляет ползунки ниже — после неё всё можно править руками.</div>
          <div class="hud-theme-packs">
            ${THEME_CATEGORIES.map(c => `<label title="Показывать темы набора «${c.label}»"><input type="checkbox" data-theme-pack="${c.id}" ${(settings.themePacks && settings.themePacks[c.id] === false) ? '' : 'checked'}> ${c.label}</label>`).join('')}
          </div>
          <div class="hud-theme-acts">
            <button type="button" class="hud-theme-act" data-theme-act="save" title="Запомнить текущие ползунки для выбранной темы">💾 Запомнить правки</button>
            <button type="button" class="hud-theme-act" data-theme-act="undo" title="Отменить последнюю правку: ползунок, цвет, смену темы или откат">↶ Шаг назад</button>
            <button type="button" class="hud-theme-act" data-theme-act="revert" title="Вернуть теме её исходные значения">↺ Вернуть тему</button>
            <button type="button" class="hud-theme-act own" data-theme-act="mine" title="Сохранить текущие настройки отдельной темой «Своя»">★ Сохранить свою тему</button>
            ${settings.customTheme ? '<button type="button" class="hud-theme-act danger" data-theme-act="forget" title="Удалить сохранённую свою тему">✕ Удалить свою</button>' : ''}
            <button type="button" class="hud-theme-act" data-theme-act="export" title="Сохранить текущую тему в файл — его можно переслать">⭳ Файл темы</button>
            <button type="button" class="hud-theme-act" data-theme-act="import" title="Загрузить тему из файла">⭱ Из файла</button>
          </div>
        </div>
        <div class="hud-theme-system">
          <div class="hud-theme-presets-title">Система цветов</div>
          <div class="hud-theme-roles">
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="accentColor" value="${settings.accentColor}"><span>Основной</span></label>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="cardBgStart" value="${settings.cardBgStart}"><span>Поверхность</span></label>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="infoBlockBgStart" value="${settings.infoBlockBgStart}"><span>Стекло</span></label>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="textColor" value="${settings.textColor || '#e6e6ee'}"><span>Текст</span></label>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="textMutedColor" value="${settings.textMutedColor || '#9aa0ae'}"><span>Приглушённый</span></label>
            <button type="button" class="hud-role hud-role-clear" data-theme-act="cleartext" title="Вернуть цвет текста из темы SillyTavern"><span class="hud-role-x">⌫</span><span>Цвет текста<br>по умолчанию</span></button>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="dramaColor" value="${settings.dramaColor}"><span>Тревога</span></label>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="memoryAccent" value="${settings.memoryAccent}"><span>Память</span></label>
          </div>
          <div class="hud-theme-row hud-glass-row">
            <label>Стекло:</label>
            <select class="hud-theme-select-input" data-key="glassType">
              <option value="frosted"${settings.glassType === 'frosted' ? ' selected' : ''}>Матовое</option>
              <option value="clear"${settings.glassType === 'clear' ? ' selected' : ''}>Прозрачное</option>
              <option value="tinted"${settings.glassType === 'tinted' ? ' selected' : ''}>Тонированное</option>
              <option value="liquid"${settings.glassType === 'liquid' ? ' selected' : ''}>Жидкое</option>
              <option value="iridescent"${settings.glassType === 'iridescent' ? ' selected' : ''}>Перламутр</option>
            </select>
          </div>
        </div>
        ${разметкаВкладок()}
        <details class="hud-custom-views hud-custom-budget hud-smooth"><summary>💰 Бюджет токенов</summary>
          <div class="hud-theme-grid">${основа.выбор('tokenBudget', 'Чип в карточке', 'Число «≈4,1k» в полосе последней карточки; по нажатию — разбивка по блокам', [['chip', 'Показывать'], ['off', 'Не показывать']])}</div>
          <div class="hud-budget-panel hud-custom-budget-body"><p class="hud-budget-note">Откройте раздел — посчитаю.</p></div>
        </details>
        <details class="hud-custom-views hud-smooth"><summary>🧩 Вид блоков</summary>
          <details class="hud-custom-sub hud-smooth"><summary>Портрет</summary>
          <div class="hud-theme-grid">
            ${основа.выбор('avatarShape', 'Форма портрета', 'Аватарка в шапке персонажа. «Авто» — арка на теме «Вампир», круг на остальных.', [['auto', 'Авто'], ['circle', 'Круг'], ['arch', 'Арка']])}
            <div class="hud-theme-row" title="Пусто — цвет темы. Свой цвет — нажмите на квадрат."><label>Рамка портрета:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="avatarFrameColor" data-auto="accent" value="${settings.avatarFrameColor || settings.accentColor || '#8c5ad2'}"><button type="button" class="hud-theme-auto-btn" data-auto-key="avatarFrameColor" title="Вернуть цвет темы">как в теме</button></div></div>
            <div class="hud-theme-row"><label>Масштаб портрета:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="avatarScale" min="100" max="300" value="${settings.avatarScale ?? 100}"> <span style="font-size:0.8em;opacity:0.7">${settings.avatarScale ?? 100}%</span></div></div>
            <div class="hud-theme-row"><label>Портрет: влево-вправо</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="avatarOffsetX" min="0" max="100" value="${settings.avatarOffsetX ?? 50}"> <span style="font-size:0.8em;opacity:0.7">${settings.avatarOffsetX ?? 50}%</span></div></div>
            <div class="hud-theme-row"><label>Портрет: вверх-вниз</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="avatarOffsetY" min="0" max="100" value="${settings.avatarOffsetY ?? 50}"> <span style="font-size:0.8em;opacity:0.7">${settings.avatarOffsetY ?? 50}%</span></div></div>
            ${основа.выбор('avatarDeco', 'Украшение портрета', 'Рамка вокруг аватарки, портрет крупнее. «По теме» — у каждой темы своя; картинки перекрашены в цвет темы (или в «Рамку портрета»). С шапкой-баннером не показывается.', [['none', 'Нет'], ['theme', 'Авто (по теме)'], ...основа.РАМКИ_ПОРТРЕТА])}
          </div></details>
          <details class="hud-custom-sub hud-smooth"><summary>Шапка и имя</summary>
          <div class="hud-theme-grid">
            ${основа.выбор('headerStyle', 'Шапка персонажа', 'Баннер — аватарка растянута полосой над именем. Визитка — полоса из обоев чата, круглый портрет по центру, под именем занятие и возраст. Виджет погоды не трогает.', [['classic', 'Обычная'], ['banner', 'Баннер'], ['visit', 'Визитка']])}
            ${[['Char', 'персонажей', 'Одна картинка на всех персонажей — для баннера и визитки. Пусто — как было: аватарка у баннера, обои чата у визитки.'], ['User', 'игрока', 'Своя картинка для шапки игрока — для баннера и визитки.']].map(([к, кого, пояснение]) => {
            const ключ = 'banner' + к, v = String(settings[ключ + 'Img'] || '');
            const ползунок = (ось, подпись) => `<div class="hud-theme-row" title="Баннер ${кого}: ${подпись}"><label>Сдвиг ${подпись === 'влево-вправо' ? '↔' : '↕'}:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="${ключ}Offset${ось}" min="0" max="100" value="${settings[ключ + 'Offset' + ось] ?? (ось === 'X' ? 50 : 30)}"> <span style="font-size:0.8em;opacity:0.7">${settings[ключ + 'Offset' + ось] ?? (ось === 'X' ? 50 : 30)}%</span></div></div>`;
            return `<div class="hud-theme-row" title="${пояснение}"><label>Баннер ${кого}:</label> <div class="hud-theme-flex">`
              + `<input type="text" class="hud-theme-text-input" data-key="${ключ}Img" value="${escapeHtml(v.startsWith('data:') ? '(Локальный файл)' : v)}" placeholder="URL..." style="width: 80px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 4px; font-size: 0.9em;">`
              + `<button type="button" class="hud-img-upload-btn" data-img-key="${ключ}Img" title="Выбрать картинку из папки">📁</button><input type="file" class="hud-img-upload-file" accept="image/*" style="display:none;">`
              + `<button type="button" class="hud-img-clear-btn" data-img-key="${ключ}Img" title="Убрать свою картинку">✕</button></div></div>`
              + ползунок('X', 'влево-вправо') + ползунок('Y', 'вверх-вниз');
          }).join('')}
            ${основа.выбор('headerProfile', 'Профиль под именем', 'Как в соцсети: уровень по доверию к игроку, кем персонаж ему приходится, и три счётчика — доверие, общие воспоминания, флаги.', [['off', 'Нет'], ['on', 'Показывать']])}
            ${основа.выбор('nameStyle', 'Имя персонажа', 'Контур — буквы прозрачные, виден только контур цвета темы, свечение разгорается под курсором или по нажатию на шапку. Так же — подпись «Ключевого». Перелив — имя от цвета темы к цвету свечения, блик бежит под курсором или по нажатию.', [['plain', 'Обычное'], ['outline', 'Контур с пульсом'], ['sheen', 'Перелив'], ['foil', 'Фольга (тиснение)']])}
            ${основа.выбор('nameHanko', 'Печать-ханко у имени', 'Квадратная печать цвета темы с первой буквой имени — рядом с именем, как подпись на свитке.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('verticalName', 'Имя столбиком', 'Имя сверху вниз между портретом и строкой имени, как подпись на свитке.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('dayCount', 'Счёт дней сюжета', 'Под именем — какой сейчас день сюжета, считая от первой даты сцены в чате. У каждой темы своё слово: «Ночь 14-я» у Вампира, «Страница 14» у Академии, «Дубль 14» у Нуара.', [['off', 'Нет'], ['on', 'Показывать']])}
            ${основа.выбор('headerOrnament', 'Картинка в углу шапки', 'Украшение справа в шапке персонажа вместо значка темы. «Авто» — есть у Вампира, Японии, Океана, Каваи, Льда, Уюта, Космооперы, Вуду и Ведьмы.', [['off', 'Нет'], ['theme', 'Авто (по теме)'], ...основа.УГЛЫ_ШАПКИ])}
          </div></details>
          <details class="hud-custom-sub hud-smooth"><summary>Украшения вкладки</summary>
          <div class="hud-theme-grid">
            ${основа.выбор('hangPendant', 'Подвеска на шнуре', 'Нефритовая подвеска свисает сверху справа в шапке и качается под курсором или по нажатию на шапку.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('tabBow', 'Бант на вкладке', 'Бант цвета темы на вкладке того, чью карточку смотришь.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('groupDividers', 'Разделители групп', 'Между группами строк — подпись: Облик, Тело, Разум, Связи… Линия или картинка из тем в цвет темы.', [['off', 'Нет'], ...основа.РАЗДЕЛИТЕЛИ])}
            ${основа.выбор('bgDragon', 'Дракон за плашками', 'Тонкий рисунок дракона цвета темы по центру вкладки, еле виден за плашками.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('cardSignature', 'Подпись внизу вкладки', 'Имя персонажа с виньетками в конце его вкладки, чуть наклонно, как роспись.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('healthPlaster', 'Пластырь у здоровья', 'Сердечко-пластырь в углу «Здоровья» и полоска пластыря на подписи, цвета темы.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('trustHearts', 'Сердечки у доверия', 'Когда доверие к игроку выросло за ход — «♥ +N за ход» у строки доверия; под курсором или по нажатию вылетают сердечки цвета темы.', [['on', 'Да'], ['off', 'Нет']])}
          </div></details>
          <details class="hud-custom-sub hud-smooth"><summary>Оформление секций</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row" title="«По смыслу» — у каждой секции карточки свой цвет из тонов темы. «Один цвет» — все секции цветом акцента; NSFW и детализация остаются своими."><label>Цвета секций:</label>
              <select class="hud-theme-select-input" data-key="pillColors"><option value="smart"${settings.pillColors !== 'mono' ? ' selected' : ''}>По смыслу</option><option value="mono"${settings.pillColors === 'mono' ? ' selected' : ''}>Один цвет</option></select>
            </div>
            <div class="hud-theme-row" title="Рисунки в правом углу секций (песочные часы у возраста, молния у конфликта) и значки в подписях пилюль."><label>Значки секций:</label>
              <select class="hud-theme-select-input" data-key="pillIcons"><option value="on"${settings.pillIcons !== 'off' ? ' selected' : ''}>Показывать</option><option value="off"${settings.pillIcons === 'off' ? ' selected' : ''}>Убрать</option></select>
            </div>
            <div class="hud-theme-row" title="«Своё у каждой» — у целей стрелки, у флагов вымпелы, у ключа загнутые углы, возраст крупной цифрой. «Одинаковое» — все секции и пилюли одним видом."><label>Оформление секций:</label>
              <select class="hud-theme-select-input hud-custom-rerender" data-key="pillStyle"><option value="fields"${settings.pillStyle !== 'plain' ? ' selected' : ''}>Своё у каждой</option><option value="plain"${settings.pillStyle === 'plain' ? ' selected' : ''}>Одинаковое</option></select>
            </div>
            ${основа.выбор('sectionSkin', 'Стиль секций', 'Как выглядят рамки секций. «Стикеры» есть только на светлых темах: на тёмных они не включаются.', [['', 'Обычный'], ['stickers', 'Стикеры (светлые темы)'], ['moonglass', 'Лунное стекло'], ['ghost', 'Призрачная буква'], ['news', 'Газета'], ['win95', 'Окна 95'], ['mac', 'Ретро-Мак'], ['bujo', 'Бортовой журнал'], ['glass', 'Стекло'], ['evidence', 'Улики'], ['double', 'Двойная тонкая рамка'], ['notebook', 'Тетрадь в клетку'], ['label', 'Этикетка']])}
          </div></details>
          <details class="hud-custom-sub hud-smooth"><summary>Мысли и реплики</summary>
          <div class="hud-theme-grid">
            ${основа.выбор('thoughtBrackets', 'Скобки 「」', 'Мысли и реплики в угловых скобках цвета темы вместо курсива и «ёлочки».', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('dropCap', 'Буквица у мыслей', 'Первая буква «Мыслей» и «Ключевого» крупная, с переливом цвета темы; текст обтекает её.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('crtLines', 'Полосы старого экрана', 'Бегущие строки развёртки и подсветка изнутри на мыслях, репликах и подтексте.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('lineWave', 'Волна под репликами', 'Реплики подчёркнуты волнистой линией цвета темы, как маркером.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('lineNotes', 'Ноты у реплик', 'Нота цвета темы в углу «Реплик» и маленькие нотки у каждой фразы (со скобками 「」 — только в углу).', [['off', 'Нет'], ['on', 'Да']])}
          </div></details>
          <details class="hud-custom-sub hud-smooth"><summary>Бумага и печать</summary>
          <div class="hud-theme-grid">
            ${основа.выбор('paperAged', 'Состаренный лист', 'Тёплый свет и подпалённые края по всей вкладке.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('paperTorn', 'Рваный край плашек', 'Низ каждой плашки — как у оторванного листка. Внешнее свечение плашек при этом не видно.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('paperFolds', 'Сгибы письма', 'Линии сгиба, как у сложенного письма.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('waxSeal', 'Сургучная печать', 'Печать с розой в шапке персонажа, цвета темы (или «Рамки портрета»).', [['off', 'Нет'], ['on', 'Да']])}
          </div></details>
          <details class="hud-custom-sub hud-smooth"><summary>Сцена и скрытое</summary>
          <div class="hud-theme-grid">
            ${основа.выбор('sceneCredits', 'Титры сцены', 'Под карточкой: «конец сцены», кто в ролях, место и время.', [['off', 'Нет'], ['on', 'Показывать']])}
            ${основа.выбор('moonPhase', 'Фаза луны', 'По игровой дате: плашка в погоде и тень на луне в небе.', [['true', 'Показывать'], ['false', 'Нет']])}
            ${основа.выбор('subtextVeil', 'Скрытый подтекст', 'Под «водой»: открывается нажатием.', [['true', 'Под водой'], ['false', 'Открыто']])}
            ${основа.выбор('diaryVeil', '«О ней» в дневнике', 'Под акварелью: открывается нажатием.', [['true', 'Под акварелью'], ['false', 'Открыто']])}
          </div></details>
          <details class="hud-custom-sub hud-smooth"><summary>Интерфейс</summary>
          <div class="hud-theme-grid">
            ${основа.выбор('lightHeadings', 'Светлее тёмные заголовки', 'На тёмных темах слишком тёмные названия секций поднимаются до читаемой яркости, остальные не меняются.', [['off', 'Нет'], ['on', 'Да']])}
            ${основа.выбор('themedControls', 'Галочки и ползунки по теме', 'В настройках и «Кастомизации» у каждой темы своя галочка (звёзды у Вампира, сердечки у Каваи, соты у Биопанка…) и свой ползунок.', [['on', 'Да'], ['off', 'Обычные']])}
            ${основа.выбор('themedScroll', 'Прокрутка и выделение', 'Ползунок прокрутки в карточке и выделенный текст — цветом темы.', [['on', 'Цвет темы'], ['off', 'Как в Таверне']])}
            ${основа.выбор('genIndicator', 'Плашка «модель пишет HUD»', 'Пока HUD перегенерируется, над карточкой — круги на воде, пластинка и секундомер. Двигаются под курсором или по нажатию.', [['off', 'Нет'], ['on', 'Да']])}
          </div></details>
          ${[...new Set(ВИДЫ_БЛОКОВ.map(б => б.группа))].map(группа => `<details class="hud-custom-sub hud-smooth hud-custom-views-group"><summary>Блоки: ${группа}</summary><div class="hud-theme-grid">`
          // Цикл в карточке идёт сразу после тела — в «Теле и здоровье».
          + ВИДЫ_БЛОКОВ.filter(б => б.группа === группа).map((б, i, все) => `<div class="hud-theme-row"><label>${б.поле}:</label>`
            + `<select class="hud-theme-select-input hud-custom-rerender" data-key="${б.ключ}">${Object.entries(б.виды).map(([k, имя], i) => `<option value="${k}"${видБлока(б.ключ) === k ? ' selected' : ''}>${имя}${i || б.новый ? '' : ' (как было)'}</option>`).join('')}</select></div>`
            + (б.ключ === 'clothesView' ? основа.выбор('underwearView', 'Бельё', 'Комплект с силуэтами или слоем между кожей и одеждой (если бельё включено в настройках)', [['set', 'Комплект'], ['layer', 'Слоем']]) : '')
            + (б.ключ === 'secretsView' ? основа.выбор('secretsGrid', 'Сетка «кто что знает»', 'Над секретами: кто знает, подозревает, не знает или ошибается, и кого нельзя посвящать в сцене', [['auto', 'От трёх секретов'], ['on', 'Всегда'], ['off', 'Не показывать']])  + основа.выбор('secretsAutoRaise', 'Всплыло в споре', 'Секрет прозвучал в словесной дуэли при том, кто его не знал: спросить, отметить ли «знает / подозревает», отметить сразу или молчать. Отметка — ваша правка: модель её увидит, текст сообщения не меняется', [['ask', 'Спросить'], ['auto', 'Сразу'], ['off', 'Молчать']]): '')
            // Цикл в карточке идёт после беременности и «После родов» — последним в «Теле и здоровье».
            + (б.ключ === 'postpartumView' ? `<div class="hud-theme-row"><label>Менструальный цикл:</label><select class="hud-theme-select-input hud-custom-rerender" data-key="cycleView">${Object.entries(ВИДЫ_ЦИКЛА).map(([k, имя]) => `<option value="${k}"${(settings.cycleView || 'ring') === k ? ' selected' : ''}>${имя}</option>`).join('')}</select></div>`
              + основа.выбор('cycleLibido', 'Влечение под циклом', 'Линия — склонность по фазе, её считает HUD; точки — желание из близости, когда о нём писали', [['phase+actual', 'Фаза и как было'], ['phase', 'Только по фазе'], ['off', 'Не показывать']]) : '')).join('')
          + `</div></details>`).join('')}
          <div class="hud-theme-row hud-custom-minimal"><button type="button" class="hud-theme-act hud-custom-minimal-btn" title="Один цвет, без значков, одинаковое оформление — и без украшений из тем: рамок, картинок, разделителей, бумаги, печати, эффектов имени, мелочей, особых галочек">◻ Минимализм</button><button type="button" class="hud-theme-act hud-custom-rich-btn" title="Вернуть всё, как было до «Минимализма»: цвета по смыслу, значки, оформление полей и украшения">✦ Как было</button><button type="button" class="hud-theme-act hud-custom-auto-btn" title="Все украшения из тем — рамка, углы, разделители, бумага, имя, мелочи — на «Авто»: у каждой темы свои">✦ Всё по теме</button></div>
          <div class="hud-theme-presets-note">Вид блока цикла и секций у персонажей и у игрока. Справа видно сразу; карточки в чате перерисуются, когда закроешь окно.</div>
        </details>
        <details class="hud-smooth"><summary>🎨 Общие цвета & Фоны</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Акцент:</label> <input type="color" class="hud-theme-color-input" data-key="accentColor" value="${settings.accentColor}"></div>
            <div class="hud-theme-row"><label>Свечение:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="glowColor" value="${settings.glowColor}"><input type="range" class="hud-theme-range-input" data-key="glowAlpha" min="0" max="150" value="${settings.glowAlpha}"></div></div>
            <div class="hud-theme-row" title="Насколько далеко расходится свет: ореол карточки, часы, имя, вкладки, аватарка, полоски, плашки, телефон"><label>Размах свечения:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="glowSize" min="0" max="250" step="5" value="${settings.glowSize ?? 100}"><span>${settings.glowSize ?? 100}%</span></div></div>
            <div class="hud-theme-row" title="Свет медленно разгорается и гаснет — на часах, имени, аватарке и активной вкладке"><label>Дыхание свечения:</label> <select class="hud-theme-select-input" data-key="glowBreath"><option value="off"${!['soft', 'strong'].includes(settings.glowBreath) ? ' selected' : ''}>Нет</option><option value="soft"${settings.glowBreath === 'soft' ? ' selected' : ''}>Мягко</option><option value="strong"${settings.glowBreath === 'strong' ? ' selected' : ''}>Ярко</option></select></div>
            <div class="hud-theme-row" title="На узком экране (до 600px): «Только рамка» — светятся края, надписи и значки, без широкого ореола вокруг; так легче для слабых телефонов. «Полностью» — как на компьютере. «Выключено» — без свечения совсем."><label>Свечение на телефоне:</label> <select class="hud-theme-select-input" data-key="glowMobile"><option value="frame"${settings.glowMobile !== 'full' ? ' selected' : ''}>Только рамка</option><option value="full"${settings.glowMobile === 'full' ? ' selected' : ''}>Полностью</option><option value="off"${settings.glowMobile === 'off' ? ' selected' : ''}>Выключено</option></select></div>
            <div class="hud-theme-row"><label>Фон (Старт):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="cardBgStart" value="${settings.cardBgStart}"><input type="range" class="hud-theme-range-input" data-key="cardBgAlpha" min="0" max="100" value="${settings.cardBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон (Конец):</label> <input type="color" class="hud-theme-color-input" data-key="cardBgEnd" value="${settings.cardBgEnd}"></div>

            <!-- БЛОК БЛЮРА И ВСТРОЕННОГО "РЕДАКТОРА" ФОНА -->
            <div class="hud-theme-row"><label>Сила Блюра:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="backdropBlur" min="0" max="30" value="${settings.backdropBlur}"> <span style="font-size:0.8em;opacity:0.7">${settings.backdropBlur}px</span></div></div>
            <div class="hud-theme-row"><label>Прозрачность фона:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="bgOpacity" min="0" max="100" value="${settings.bgOpacity}"> <span style="font-size:0.8em;opacity:0.7">${settings.bgOpacity}%</span></div></div>
            <div class="hud-theme-row"><label>Масштаб картинки:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="bgScale" min="50" max="200" value="${settings.bgScale}"> <span style="font-size:0.8em;opacity:0.7">${settings.bgScale}%</span></div></div>
            <div class="hud-theme-row"><label>Сдвиг (Вверх-Вниз):</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="bgOffsetY" min="0" max="100" value="${settings.bgOffsetY}"> <span style="font-size:0.8em;opacity:0.7">${settings.bgOffsetY}%</span></div></div>
            
            <div class="hud-theme-row"><label>Фон (Картинка):</label> 
              <div class="hud-theme-flex">
                <input type="text" class="hud-theme-text-input" data-key="bgImage" value="${settings.bgImage}" placeholder="URL..." style="width: 80px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 4px; font-size: 0.9em;">
                <button type="button" class="hud-bg-upload-btn" title="Выбрать картинку из папки">📁</button>
                <input type="file" class="hud-bg-upload-file" accept="image/*" style="display:none;">
                <button type="button" class="hud-bg-clear-btn" title="Убрать фоновую картинку">✕</button>
              </div>
            </div>
            <!-- КОНЕЦ НОВОГО БЛОКА -->
            
            <div class="hud-theme-row"><label>Инфоблок (Старт):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="infoBlockBgStart" value="${settings.infoBlockBgStart}"><input type="range" class="hud-theme-range-input" data-key="infoBlockBgAlpha" min="0" max="100" value="${settings.infoBlockBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Инфоблок (Конец):</label> <input type="color" class="hud-theme-color-input" data-key="infoBlockBgEnd" value="${settings.infoBlockBgEnd}"></div>
          </div>
        </details>
        <details class="hud-smooth"><summary>🧠 Память</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Фон (Старт):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="memoryBgStart" value="${settings.memoryBgStart}"><input type="range" class="hud-theme-range-input" data-key="memoryBgAlpha" min="0" max="100" value="${settings.memoryBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон (Конец):</label> <input type="color" class="hud-theme-color-input" data-key="memoryBgEnd" value="${settings.memoryBgEnd}"></div>
            <div class="hud-theme-row"><label>Акцент:</label> <input type="color" class="hud-theme-color-input" data-key="memoryAccent" value="${settings.memoryAccent}"></div>
            <div class="hud-theme-row"><label>Свечение:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="memoryGlowAlpha" min="0" max="100" value="${settings.memoryGlowAlpha}"></div></div>
            <div class="hud-theme-row"><label>Блюр:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="memoryBlur" min="0" max="30" value="${settings.memoryBlur}"><span style="font-size:0.8em;opacity:0.7">${settings.memoryBlur}px</span></div></div>
          </div>
        </details>
        <details class="hud-smooth"><summary>📱 Телефон — настройки темы</summary>
          <div class="hud-theme-grid">
            <label class="hud-theme-row hud-phone-auto-row" style="grid-column:1/-1; display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" class="hud-phone-theme-auto" ${settings.phoneThemeAuto !== false ? "checked" : ""}>
              <span>Наследовать тему HUD</span>
            </label>
            <div style="font-size:10.5px;opacity:.55;grid-column:1/-1;margin:-4px 0 4px;">Пока включено, телефон берёт акцент, фон, блюр и шрифт у HUD. Любая правка ниже выключит наследование, чтобы её не затирало.</div>
            <div class="hud-theme-row"><label>Фон экрана:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="phoneBgStart" value="${settings.phoneBgStart}"><input type="color" class="hud-theme-color-input" data-key="phoneBgEnd" value="${settings.phoneBgEnd}"><input type="range" class="hud-theme-range-input" data-key="phoneBgAlpha" min="0" max="100" value="${settings.phoneBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Акцент:</label> <input type="color" class="hud-theme-color-input" data-key="phoneAccent" value="${settings.phoneAccent}"></div>
            <div class="hud-theme-row"><label>Блюр стекла:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneBlur" min="0" max="30" value="${settings.phoneBlur}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneBlur}px</span></div></div>
            <div class="hud-theme-row"><label>Входящие сообщения:</label><div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="msgInBg" value="${settings.msgInBg}"><input type="range" class="hud-theme-range-input" data-key="msgInAlpha" min="0" max="100" value="${settings.msgInAlpha}"></div></div>
            <div class="hud-theme-row"><label>Исходящие сообщения:</label><div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="msgOutStart" value="${settings.msgOutStart}"><input type="color" class="hud-theme-color-input" data-key="msgOutEnd" value="${settings.msgOutEnd}"><input type="range" class="hud-theme-range-input" data-key="msgOutAlpha" min="0" max="100" value="${settings.msgOutAlpha}"></div></div>
            <div class="hud-theme-row"><label>Скругление пузырей:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneBubbleRadius" min="2" max="24" value="${settings.phoneBubbleRadius}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneBubbleRadius}px</span></div></div>
            <div class="hud-theme-row"><label>Шрифт телефона:</label> <select class="hud-theme-select-input" data-key="phoneFont">${makeFontOptions(settings.phoneFont)}</select></div>
            <div class="hud-theme-row"><label>Размер шрифта:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneFontSize" min="10" max="20" value="${settings.phoneFontSize}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneFontSize}px</span></div></div>
            <div class="hud-theme-row"><label>Плотность уведомлений:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneNotifAlpha" min="40" max="100" value="${settings.phoneNotifAlpha}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneNotifAlpha}%</span></div></div>
            <div class="hud-theme-row"><label>Скругление иконок:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneIconRadius" min="6" max="26" value="${settings.phoneIconRadius}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneIconRadius}px</span></div></div>
            <div class="hud-theme-row"><label>Цвет корпуса:</label> <input type="color" class="hud-theme-color-input" data-key="phoneFrameColor" value="${settings.phoneFrameColor}"></div>
            <div class="hud-theme-row"><label>Свечение экрана:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneScreenGlow" min="0" max="100" value="${settings.phoneScreenGlow}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneScreenGlow}%</span></div></div>
            <div class="hud-theme-row" title="Свет корпуса, значков, уведомлений, пузырей и приложений — тем же цветом, что «Свечение» HUD"><label>Свечение телефона:</label> <select class="hud-theme-select-input" data-key="phoneGlow"><option value="on"${settings.phoneGlow !== 'off' ? ' selected' : ''}>Включено</option><option value="off"${settings.phoneGlow === 'off' ? ' selected' : ''}>Выключено</option></select></div>
            <div class="hud-theme-row"><label>Карточек уведомлений:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneNotifMax" min="1" max="5" value="${settings.phoneNotifMax}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneNotifMax}</span></div></div>
          </div>
        </details>
        <details class="hud-smooth"><summary>🗂️ Верхние плашки & Табы</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Верхняя панель:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="topBarBg" value="${settings.topBarBg}"><input type="range" class="hud-theme-range-input" data-key="topBarAlpha" min="0" max="100" value="${settings.topBarAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон вкладок (Табы):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="tabsBg" value="${settings.tabsBg}"><input type="range" class="hud-theme-range-input" data-key="tabsAlpha" min="0" max="100" value="${settings.tabsAlpha}"></div></div>
          </div>
        </details>
        <details class="hud-smooth"><summary>🌤️ Виджет погоды</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Оверлей (Оттенок):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="sceneOverlayColor" value="${settings.sceneOverlayColor}"><input type="range" class="hud-theme-range-input" data-key="sceneOverlayAlpha" min="0" max="100" value="${settings.sceneOverlayAlpha}"></div></div>
            <div class="hud-theme-row"><label>Цвет текста:</label> <input type="color" class="hud-theme-color-input" data-key="sceneTextColor" value="${settings.sceneTextColor}"></div>
            <div class="hud-theme-row"><label>Фон плашек:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="weatherBgColor" value="${settings.weatherBgColor}"><input type="range" class="hud-theme-range-input" data-key="weatherBgAlpha" min="0" max="100" value="${settings.weatherBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Блюр плашек:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="weatherBlur" min="0" max="30" value="${settings.weatherBlur}"> <span style="font-size:0.8em;opacity:0.7">${settings.weatherBlur}px</span></div></div>
            <div class="hud-theme-row" title="Насколько сильно вечер и ночь притемняют виджет погоды — и в покое, и после касания. 0 — не притемнять вовсе, 100 — исходная сила."><label>Затемнение сцены:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="sceneDarkness" min="0" max="150" value="${settings.sceneDarkness}"> <span style="font-size:0.8em;opacity:0.7">${settings.sceneDarkness}%</span></div></div>
          </div>
        </details>
        <details class="hud-smooth"><summary>📡 Перехваты</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Цвет Перехвата:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="interceptColor" value="${settings.interceptColor}"><input type="range" class="hud-theme-range-input" data-key="interceptBgAlpha" min="0" max="100" value="${settings.interceptBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Бейдж уведомл.:</label> <input type="color" class="hud-theme-color-input" data-key="badgeColor" value="${settings.badgeColor}"></div>
          </div>
        </details>
        <details class="hud-smooth"><summary>⚠️ Драма & NSFW</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Цвет Драмы:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="dramaColor" value="${settings.dramaColor}"><input type="range" class="hud-theme-range-input" data-key="dramaBgAlpha" min="0" max="100" value="${settings.dramaBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Цвет NSFW:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="nsfwColor" value="${settings.nsfwColor}"><input type="range" class="hud-theme-range-input" data-key="nsfwBgAlpha" min="0" max="100" value="${settings.nsfwBgAlpha}"></div></div>

          </div>
        </details>
        <details class="hud-smooth"><summary>✍️ Шрифты & Размеры</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Цвет часов:</label> <input type="color" class="hud-theme-color-input" data-key="clockColor" value="${settings.clockColor}"></div>
            <div class="hud-theme-row"><label>Шрифт часов:</label>
              <select class="hud-theme-select-input" data-key="fontClock">${makeFontOptions(settings.fontClock)}</select>
            </div>
            <div class="hud-theme-row"><label>Размер часов:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeClock" min="20" max="60" value="${settings.fontSizeClock}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeClock}px</span></div></div>
            
            <div class="hud-theme-row"><label>Основной шрифт:</label>
              <select class="hud-theme-select-input" data-key="fontMain">${makeFontOptions(settings.fontMain)}</select>
            </div>
            <div class="hud-theme-row"><label>Размер текста:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeMain" min="10" max="22" value="${settings.fontSizeMain}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeMain}px</span></div></div>
            
            <div class="hud-theme-row"><label>Шрифт заголовков:</label>
              <select class="hud-theme-select-input" data-key="fontHeaders">${makeFontOptions(settings.fontHeaders)}</select>
            </div>
            <div class="hud-theme-row"><label>Размер заголовков:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeHeaders" min="10" max="20" value="${settings.fontSizeHeaders}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeHeaders}px</span></div></div>
            
            <div class="hud-theme-row"><label>Шрифт Дневника:</label>
              <select class="hud-theme-select-input" data-key="fontDiary">${makeFontOptions(settings.fontDiary)}</select>
            </div>
          </div>
		  <div class="hud-theme-row"><label>Размер Дневника:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeDiary" min="12" max="30" value="${settings.fontSizeDiary}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeDiary}px</span></div></div>
        </details>
`;
}

// Что показать справа — по очереди: последний HUD из чата, большой
// пример, базовый пример. Если источник не разобрался или не собрался,
// берём следующий, чтобы окно открывалось и в чате без единого HUD.
function источникиПросмотра() {
  const источники = [];
  let ctx = null;
  try { ctx = основа.getStContextSafe(); } catch (_) { /* Таверна ещё не готова */ }
  const чат = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
  let найдено = 0;
  for (let i = чат.length - 1; i >= 0 && найдено < 3; i--) {
    const m = чат[i];
    if (!m || m.is_user || m.is_system || typeof m.mes !== 'string') continue;
    let блоки = [];
    try { блоки = hudБлоки(m.mes); } catch (_) { continue; }
    for (let j = блоки.length - 1; j >= 0 && найдено < 3; j--, найдено++) {
      const текст = блоки[j].inner;
      источники.push({ откуда: 'последний HUD из чата', данные: () => parseHUDComplex(текст), индекс: i });
    }
  }
  let игрок = 'Вы';
  try { игрок = getSafeUserName() || 'Вы'; } catch (_) { /* имя не критично */ }
  const подставить = (т) => т.split('{{user}}').join(игрок);
  // К примеру — пример боя с раной и оружием: иначе вид вкладки «Бой» не настроить.
  const сБоем = (данные) => {
    if (!данные || settings.enableCombat === false) return данные;
    данные.combat = { ...ПРИМЕР_БОЯ };
    const марк = (данные.characters || []).find(c => /Марк/.test(c['Имя'] || ''));
    if (марк) { марк['Болезни и травмы'] = ПРИМЕР_БОЯ_РАНЫ; марк['Инвентарь'] = 'бита: треснула у рукояти; складной нож: в кармане куртки, спрятан'; }
    return данные;
  };
  // И два прошлых хода для «Быта»: без них журнал примера из одного хода.
  const сБытом = (данные) => {
    if (данные) Object.defineProperty(данные, '__hudБытПрошлое', { value: ПРИМЕР_БЫТА_ПРОШЛОЕ.map(т => parseHUDComplex(подставить(т))), configurable: true });
    return данные;
  };
  источники.push({ откуда: 'пример — в чате ещё нет HUD', данные: () => сБытом(сБоем(parseHUDComplex(подставить(ПРИМЕР_HUD_ТЕКСТ)))), семья: ПРИМЕР_СЕМЬИ });
  источники.push({ откуда: 'базовый пример — в чате ещё нет HUD', данные: () => parseHUDComplex(подставить(БАЗОВЫЙ_HUD_ТЕКСТ)) });
  return источники;
}

export function снятьПрокрутки(корень) {
  return [корень, ...корень.querySelectorAll('*')]
    .filter(эл => эл.scrollTop > 0 || эл.scrollLeft > 0)
    .map(эл => [основа.путьУзла(эл, корень), эл.scrollTop, эл.scrollLeft, эл.scrollHeight - эл.clientHeight]);
}

export function вернутьПрокрутки(корень, снимок) {
  if (!снимок || !снимок.length) return;
  const нужно = new Map(снимок.map(([путь, сверху, слева, было]) => [путь, [сверху, слева, было]]));
  for (const эл of [корень, ...корень.querySelectorAll('*')]) {
    if (эл.scrollHeight <= эл.clientHeight && эл.scrollWidth <= эл.clientWidth) continue;
    const з = нужно.get(основа.путьУзла(эл, корень));
    if (!з) continue;
    // Высота изменилась (другое оформление секций) — держим ту же долю:
    // была середина — остаётся середина.
    const стало = эл.scrollHeight - эл.clientHeight;
    эл.scrollTop = з[2] > 0 && Math.abs(стало - з[2]) > 2 ? Math.round(з[0] / з[2] * стало) : з[0];
    эл.scrollLeft = з[1];
  }
}

export function собратьПросмотр(окно) {
  const место = окно.querySelector('.hud-custom-preview-body');
  const ошибки = [];
  let html = '', откуда = '';
  for (const источник of источникиПросмотра()) {
    try {
      // У примера свои роды и беременность — до закрытия окна (conception.js).
      задатьПримерСемьи(источник.семья ? источник.семья() : null);
      const данные = источник.данные();
      if (!данные) throw new Error('пустой разбор');
      // Момент хода и прошлые ходы — для часов сцены, следов и графиков, как в чате.
      привязатьИсторию(данные, источник.индекс);
      основа.lastLazyThunks = null;
      const готово = основа.renderHUD(данные);
      if (!готово || !/hud-os-card/.test(готово)) throw new Error('карточка не собралась');
      html = готово; откуда = источник.откуда;
      break;
    } catch (e) {
      ошибки.push(источник.откуда + ': ' + (e && e.message || String(e)));
      console.warn('[HUD] просмотр в «Кастомизации»:', источник.откуда, e);
    }
  }
  if (!html) {
    html = `<div class="hud-custom-error">Не удалось собрать HUD для просмотра. Настройки слева всё равно работают.<br><small>${escapeHtml(ошибки.join(' · '))}</small></div>`;
    откуда = 'просмотр недоступен';
  }
  // Вид до пересборки: открытая вкладка, экран телефона, раскрытое и
  // прокрутка — и окна, и каждого листающегося блока внутри карточки
  // (у тела карточки своя прокрутка). Смена вида цикла или секций не
  // должна отбрасывать к первой вкладке и к началу.
  const прежняя = место.querySelector('.hud-os-card');
  const состояние = прежняя ? основа.readCardUiState(место) : null;
  const внутри = прежняя ? снятьПрокрутки(прежняя) : [];
  const снаружи = ['.hud-custom-preview', '.hud-custom-body', '.hud-custom-dialog', '.hud-custom-preview-body']
    .map(с => окно.querySelector(с)).filter(Boolean).map(узел => [узел, узел.scrollTop]);
  // Старая разметка остаётся поверх новой и растворяется: перекрёстный
  // переход без «провала» яркости и без скачка высоты. Узлы не переносим —
  // перенос сбросил бы их прокрутку, и старая карточка мигнула бы началом.
  const старые = прежняя ? Array.from(место.children) : [];
  старые.forEach(узел => {
    узел.classList.add('hud-swap-old');
    узел.setAttribute('aria-hidden', 'true');
    узел.inert = true;
  });
  // Отложенные вкладки собираются по клику — способы их собрать живут на
  // самой карточке, как и в чате.
  const лень = основа.lastLazyThunks;
  основа.lastLazyThunks = null;
  if (старые.length) место.insertAdjacentHTML('afterbegin', html);
  else место.innerHTML = html;
  const карточка = место.querySelector('.hud-os-card:not(.hud-swap-old)');
  if (карточка) {
    if (лень) карточка.__hudLazy = лень;
    const свёртка = карточка.querySelector(':scope > .hud-toggle-input');
    if (свёртка) свёртка.checked = true;
    if (состояние) {
      место.__hudUiState = { ...состояние, свёрнута: true };
      основа.applyCardUiState(место);
    }
  }
  const вернуть = () => {
    if (карточка && карточка.isConnected) вернутьПрокрутки(карточка, внутри);
    снаружи.forEach(([узел, сверху]) => { узел.scrollTop = сверху; });
  };
  вернуть();
  if (старые.length) {
    // Отложенные рисунки и шрифты меняют высоту в первые кадры —
    // прокрутку ставим ещё раз, пока старая карточка растворяется.
    requestAnimationFrame(() => {
      вернуть();
      старые.forEach(узел => узел.classList.add('is-leaving'));
    });
    setTimeout(вернуть, 180);
    setTimeout(() => { старые.forEach(узел => узел.remove()); вернуть(); }, 420);
  }
  окно.querySelector('.hud-custom-source').textContent = откуда;
}

export function закрытьКастомизацию() {
  const окно = document.getElementById('hud-custom-modal');
  if (!окно || !окно.classList.contains('is-open')) return;
  окно.classList.remove('is-open');
  document.documentElement.classList.remove('hud-custom-open');
  задатьПримерСемьи(null);
  // Раскрытый граф из примера живёт в body — убираем его вместе с окном.
  document.querySelectorAll('.hud-rel-graph.is-expanded').forEach(г => {
    const дом = г._hudRelHome && г._hudRelHome.parent;
    if (дом && окно.contains(дом)) {
      г.remove();
      document.querySelectorAll('.hud-rel-graph-backdrop').forEach(ф => ф.classList.remove('visible'));
    }
  });
  // Правую карточку убираем: в ней тысяча узлов, а окно закрыто.
  окно.querySelector('.hud-custom-preview-body').innerHTML = '';
  if (основа.видыМенялись) { основа.видыМенялись = false; основа.перерисоватьКарточкиЧата(); }
}

export function открытьКастомизацию() {
  let окно = document.getElementById('hud-custom-modal');
  if (!окно) {
    окно = document.createElement('div');
    окно.id = 'hud-custom-modal';
    окно.className = 'hud-custom-overlay';
    окно.innerHTML = `<div class="hud-custom-dialog" role="dialog" aria-modal="true" aria-labelledby="hud-custom-title">
        <header class="hud-custom-head">
          <b id="hud-custom-title">🎨 Кастомизация HUD</b>
          <span class="hud-custom-source"></span>
          <button type="button" class="hud-custom-refresh" title="Взять свежий HUD из чата">↻</button>
          <button type="button" class="hud-custom-close" aria-label="Закрыть">✕</button>
        </header>
        <div class="hud-custom-body">
          <aside class="hud-custom-settings" aria-label="Настройки вида"><div class="hud-theme-panel active"></div></aside>
          <section class="hud-custom-preview" aria-label="Просмотр HUD"><div class="hud-custom-preview-body mes_text"></div></section>
        </div>
      </div>`;
    document.body.appendChild(окно);
    // Свайп по ползунку или просмотру не должен листать варианты ответа
    // Таверны: она ловит касания на всём документе.
    guardTouchSwipe(окно);
    // Вкладки: порядок, закрепление, скрытие (customize-tabs.js).
    подключитьВкладки(окно, основа, () => собратьПросмотр(окно));
    // Бюджет считаем, когда раздел открыли: двадцать с лишним сборок
    // инструкции незачем делать при каждом открытии окна.
    окно.addEventListener('toggle', (e) => {
      const d = e.target;
      if (!d || !d.matches || !d.open) return;
      if (!d.matches('.hud-custom-budget, .hud-custom-tabs')) return;
      const тело = окно.querySelector('.hud-custom-budget-body');
      Promise.resolve(основа.посчитатьБюджет && основа.посчитатьБюджет()).then(итог => {
        if (!итог) return;
        if (тело) тело.innerHTML = основа.разметкаБюджета(итог);
        задатьЦены(итог);
        const сп = окно.querySelector('.hud-ct-list'); if (сп) сп.innerHTML = списокВкладок();
      }).catch(err => { if (тело) тело.textContent = 'Не посчиталось: ' + (err && err.message || err); });
    }, true);
    окно.addEventListener('click', (e) => {
      if (e.target === окно || e.target.closest('.hud-custom-close')) { закрытьКастомизацию(); return; }
      if (e.target.closest('.hud-custom-refresh')) собратьПросмотр(окно);
      // «Минимализм»: один цвет, без значков, одинаковый крой и ни одного
      // украшения из тем. Что стояло до него, запоминаем (minimalBackup) —
      // «Как было» возвращает именно это, а не заводские значения.
      const минимализм = !!e.target.closest('.hud-custom-minimal-btn');
      if (минимализм && !settings.minimalBackup) settings.minimalBackup = Object.fromEntries(Object.keys(МИНИМАЛИЗМ).map(к => [к, settings[к]]));
      const как_было = e.target.closest('.hud-custom-rich-btn')
        ? { pillColors: 'smart', pillIcons: 'on', pillStyle: 'fields', ...(settings.minimalBackup || {}) } : null;
      if (как_было) delete settings.minimalBackup;
      const набор = минимализм ? { ...МИНИМАЛИЗМ }
        : как_было ? как_было
        : e.target.closest('.hud-custom-auto-btn') ? { ...Object.fromEntries(КЛЮЧИ_АВТО.map(к => [к, 'auto'])), avatarDeco: 'theme', headerOrnament: 'theme' } : null;
      if (набор) {
        Object.assign(settings, набор);
        for (const [ключ, значение] of Object.entries(набор)) окно.querySelectorAll(`[data-key="${ключ}"]`).forEach(поле => { поле.value = значение; });
        основа.saveSettings(); основа.applyThemeColors();
        основа.видыМенялись = true;
        собратьПросмотр(окно);
      }
    });
    // Вид блоков меняет саму разметку — правую карточку собираем заново.
    // Значение в настройки к этому моменту уже записал общий обработчик
    // полей темы (events.js: событие input приходит раньше change).
    окно.addEventListener('change', (e) => {
      if (!e.target.closest('.hud-custom-rerender')) return;
      основа.видыМенялись = true;
      собратьПросмотр(окно);
    });
    // Escape сперва закрывает то, что открыто поверх окна: граф, снимок, вопрос.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.querySelector('.hud-rel-graph.is-expanded, .hud-modal-overlay')) закрытьКастомизацию();
    });
  }
  окно.classList.add('is-open');
  document.documentElement.classList.add('hud-custom-open');
  // Панель пересобираем при каждом открытии: значения — из текущих настроек.
  // Окно уже открыто: сбой панели или просмотра не делает кнопку «мёртвой».
  const панель = окно.querySelector('.hud-custom-settings .hud-theme-panel');
  try { панель.innerHTML = разметкаПанелиТемы(); } catch (e) {
    console.error('[HUD] панель кастомизации:', e);
    панель.innerHTML = `<div class="hud-custom-error">Панель не собралась: ${escapeHtml(e && e.message || String(e))}</div>`;
  }
  try { собратьПросмотр(окно); } catch (e) {
    console.error('[HUD] просмотр кастомизации:', e);
    окно.querySelector('.hud-custom-preview-body').innerHTML = `<div class="hud-custom-error">Просмотр не собрался: ${escapeHtml(e && e.message || String(e))}</div>`;
  }
  окно.querySelector('.hud-custom-close').focus();
}
