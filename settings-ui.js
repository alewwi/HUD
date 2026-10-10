// hud-manager/settings-ui.js
//
// Панель расширения в «Расширениях» SillyTavern: галочки разделов, числа,
// лорбуки, профили перегенерации и помощника, кэш. Вынесено из index.js и
// грузится через import() в конце запуска (загрузитьПанельНастроек): для
// первой отрисовки чата она не нужна.

import { settings } from './settings.js?v=23.48.1';
import { видБлока } from './render/views.js?v=23.48.1';
import { escapeHtml } from './utils.js?v=23.48.1';
import { ПРОМПТ_АССИСТЕНТА } from './render/assistant-prompt.js?v=23.48.1';
import { cacheUsage, clearCache } from './history-analyzer.js?v=23.48.1';
import { clearReactions, вернутьКарточку } from './events.js?v=23.48.1';
import { invalidateAvatarCache, refreshAvatarFaces } from './avatars.js?v=23.48.1';
import { attachHelpMarks, removeHelpMarks } from './help.js?v=23.48.1';

// Всё нужное из index.js приходит в «основа» (геттеры — значения живые):
// applyThemeColors, cachedChatContainer, enforceCardLimit, getAvailableHudLorebooks, hudVersionLabel, processAllMessages, restoreEvictedCard, safeProcessMessage, saveSettings, setupPerformanceObserver, showHudToast, updatePerformanceMode, запланироватьОблегчение, наЭкране, открытьКастомизацию, списокПрофилей.
let основа = null;
export function подключить(связь) { основа = связь; }

export function addSettingsUI() {
  if (document.getElementById('hud-settings-wrapper')) return;
  const container = document.getElementById('extensions_settings') || document.getElementById('rm_extensions_block') || document.body;
  if (!container) return;
  const wrapper = document.createElement('details');
  wrapper.id = 'hud-settings-wrapper';
  wrapper.className = 'hud-settings-block';
  // Разметка строится из мелких кирпичиков: одна строка на галочку и одна
  // на числовое поле. Идентификаторы прежние — обработчики ниже их и ищут.
  const галка = (id, включено, текст, пояснение = '') =>
    '<label class="hud-set-check"' + (пояснение ? ' title="' + пояснение + '"' : '') + '><input type="checkbox" id="' + id + '" ' + (включено ? 'checked' : '') + '><span>' + текст + '</span></label>';
  const число = (id, мин, макс, значение, ширина = 52, шаг = '') =>
    '<input type="number" id="' + id + '" min="' + мин + '" max="' + макс + '"' + (шаг ? ' step="' + шаг + '"' : '') + ' value="' + значение + '" class="hud-set-num" style="width:' + ширина + 'px">';
  const группа = (заголовок, тело) => '<details class="hud-set-group"><summary>' + заголовок + '</summary><div class="hud-set-body">' + тело + '</div></details>';
  const подгруппа = (заголовок, тело) => '<details class="hud-set-group hud-set-sub"><summary>' + заголовок + '</summary><div class="hud-set-body">' + тело + '</div></details>';
  const заметка = (текст) => '<div class="hud-set-note">' + текст + '</div>';

  wrapper.innerHTML = `
      <summary style="font-weight:bold; cursor:pointer; color:var(--hud-accent); outline: none;">📊 TavernOS v${основа.hudVersionLabel()}</summary>
      <div style="padding-top: 12px; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">

      <div class="hud-set-tools">
        <button type="button" id="hud-open-custom" class="hud-set-tool-btn">🎨 Кастомизация</button>
        <button type="button" id="hud-open-archive" class="hud-set-tool-btn">🗄 Архив HUD</button>
        <span class="hud-set-tool-note">Сводка по всей истории чата: как менялись секреты и отношения, сколько прошло дней, где что происходило.</span>
      </div>

      ${группа('🧩 Блоки HUD', `
        ${галка('hud-auto-inject', settings.autoInject, '🔌 Сетевой перехват (инжект промпта)', 'Схема HUD добавляется в каждый запрос к модели. Без этого модель HUD не пишет.')}
        ${галка('hud-enable-user', settings.enableUserBlock, '👤 {{user}} — блок игрока', 'Отдельный блок {{user}}: одежда, внешность, здоровье, отношения, локация.')}

        ${подгруппа('🕰 Эпоха: телефон или шкатулка', `
          <label class="hud-set-check">Эпоха сеттинга:
            <select id="hud-era" class="hud-theme-select-input">
              <option value="modern" ${settings.era !== 'medieval' ? 'selected' : ''}>📱 Современность — телефон и перехваты</option>
              <option value="medieval" ${settings.era === 'medieval' ? 'selected' : ''}>🗝️ Средневековье — шкатулка и подслушанное</option>
            </select>
          </label>
          ${заметка('Работает только одна пара. В средневековье (любой век до телефонов) вместо телефона — шкатулка с письмами, святцами, кошелём, записями, картой, грамотами и памятками, а вместо перехватов — подслушанные разговоры и вскрытые чужие письма.')}
          <div class="hud-era-block" data-era="medieval" ${settings.era === 'medieval' ? '' : 'hidden'}>
          ${галка('hud-enable-casket', settings.enableCasket !== false, '🗝️ Шкатулка персонажа')}
          <div class="hud-set-apps">
            ${[['castAppLetters','✉️ Письма'],['castAppCalendar','📅 Святцы'],['castAppPurse','💰 Кошель'],
             ['castAppNotes','🪶 Записи'],['castAppMap','🗺️ Карта'],['castAppDocs','📜 Грамоты'],['castAppKeeps','🎀 Памятки']]
            .map(([k, label]) => `<label><input type="checkbox" data-phone-app-key="${k}" ${settings[k] !== false ? 'checked' : ''}> ${label}</label>`).join('')}
          </div>
          ${галка('hud-enable-overheard', settings.enableOverheard !== false, '👂 Подслушанное (чужие разговоры и письма)')}
          </div>
          <div class="hud-era-block" data-era="modern" ${settings.era === 'medieval' ? 'hidden' : ''}>
          ${галка('hud-enable-phone', settings.enablePhone, '📱 Личный телефон')}
          ${заметка('Экраны телефона можно включать по одному. Выключенный не просится у модели и не занимает места в запросе — весь телефон целиком стоит около 800 токенов на каждый ход, и половина из них уходит на экраны, которыми вы, возможно, не пользуетесь.')}
          <div class="hud-set-apps">
            ${[['phoneAppMessages','💬 Сообщения'],['phoneAppContacts','👤 Контакты'],['phoneAppWallet','💳 Кошелёк'],
             ['phoneAppCalendar','📅 Календарь'],['phoneAppGallery','🖼️ Галерея'],['phoneAppNotes','📝 Заметки'],
             ['phoneAppMaps','🗺️ Карты'],['phoneAppSearch','🔍 Поиск'],['phoneAppCalls','📞 Звонки'],['phoneAppWeather','🌦️ Погода'],['phoneAppHealth','❤️ Здоровье']]
            .map(([k, label]) => `<label><input type="checkbox" data-phone-app-key="${k}" ${settings[k] !== false ? 'checked' : ''}> ${label}</label>`).join('')}
          </div>
          ${галка('hud-enable-intercepts', settings.enableIntercepts, '📡 Перехваты (чужие телефоны)')}
          </div>
        `)}

        ${подгруппа('🧠 Память', `
          ${галка('hud-enable-memory', settings.enableMemory, '🧠 Память (события, настроение, маршрут, секреты)', 'Таймлайн, настроение двух главных персонажей, маршруты и секреты')}
          ${галка('hud-enable-guns', settings.enableGuns !== false, '🔫 Ружья Чехова', 'Незакрытые сюжетные нити во вкладке памяти: обещания, угрозы, намёки, загадки. Просится у модели.')}
          <label class="hud-set-check">📏 Максимальная высота Памяти: ${число('hud-memory-max-height', 200, 600, settings.memoryMaxHeight, 70)} px</label>
        `)}

        ${подгруппа('👤 Персонажи', `
          ${галка('hud-enable-illness', settings.enableIllness !== false, '🩹 Болезни и травмы', 'Болезни и травмы со стадией, симптомами, лечением и шкалой выздоровления — у персонажей и у игрока. Просится у модели, пишется только когда есть.')}
          ${галка('hud-enable-pregnancy', settings.enablePregnancy !== false, '🤰 Беременность', 'Срок, триместр, симптомы и дата родов у того, кто беременен. Просится у модели, пишется только когда есть.')}
          ${галка('hud-enable-babies', settings.enableBabies !== false, '🍼 Роды и малыши', 'После родов промт беременности уходит, вместо него — послеродовой период (кормление, молоко) и вкладка «Детская»: вехи развития, нормы ухода и карточка каждого малыша.')}
          <label class="hud-set-check" title="Когда ребёнок старше — он уходит из «Детской» в обычные карточки персонажей, с тем же промтом">🎓 Из «Детской» в карточки с ${число('hud-baby-years', 1, 12, Math.max(1, Number(settings.babyGraduateYears) || 3), 52)} лет</label>
          <label class="hud-set-check" title="Число малышей и их пол (кубик или «изменить судьбу»): скрытым фактом для модели или только для тебя">👶 Число и пол малышей → модели: <select id="hud-baby-facts" class="hud-set-select"><option value="hidden"${settings.babyFactsToModel !== 'off' ? ' selected' : ''}>скрытым фактом</option><option value="off"${settings.babyFactsToModel === 'off' ? ' selected' : ''}>не отправлять — только для меня</option></select></label>
          ${галка('hud-enable-menstruation', settings.enableMenstruation !== false, '🌸 Менструальный цикл', 'День цикла, фаза, ожидаемые месячные, окно ПМС и задержка — кольцом, с советами по фазе. Только у тех, у кого есть матка, в том числе у игрока.')}
          ${галка('hud-enable-perception', settings.enablePerception !== false, '👁 Что о тебе думают', 'Как к вам относится каждый персонаж и насколько доверяет. Считается из карточек, модель ничего не дописывает.')}
          ${галка('hud-enable-familytree', settings.enableFamilyTree !== false, '🌳 Генеалогическое дерево', 'Вторым видом в графе отношений: родители, дети, супруги, братья и сёстры по родству из «Отношений». Появляется, только когда родство есть.')}
          ${галка('hud-enable-bodystate', settings.enableBodyState !== false, '🔋 Состояние тела', 'Энергия, бодрость, сытость, стресс, сон и дела на завтра у каждого персонажа. Батарейки, колбы или строка — в «Вид блоков».')}
          ${галка('hud-enable-twists', settings.enableTwists !== false, '🎟️ Повороты сюжета', 'Когда в сцене случается настоящий поворот, над вкладками появляется карточка: что случилось и куда может повести.')}
          ${галка('hud-enable-companions', settings.enableCompanions !== false, '🐾 Спутники', 'Животные, фамильяры, дроны: настроение, состояние, рацион, привязанность. Своя вкладка, появляется, только когда спутники есть.')}
        `)}

        ${подгруппа('🔞 Близость', `
          ${галка('hud-enable-intimacy-extras', settings.enableIntimacyExtras !== false, '🔞 Подробности сцены', 'Поза, раунд, длительность, защита, готовность к оргазму, пульс, дыхание и температура, звуки, следы на теле с таймером. Просится у модели только во время близости.')}
          ${галка('hud-enable-tempo', settings.enableTempo !== false, '💓 Темп и X-ray', 'Под полосой сцены: темп толчков, ритм и X-ray в разрезе. Выключите — блока не будет совсем, ни в одном виде. Модель ничего для него не пишет, промт не меняется.')}
          ${галка('hud-enable-sceneclock', settings.enableSceneClock !== false, '🕰 Часы сцены', 'Под полосой сцены: сколько шла близость по времени сюжета и что за это время пропустили по расписанию — ужин, звонок, кто-то ждал. Считает HUD, у модели ничего не просится.')}
          ${галка('hud-enable-underwear', settings.enableUnderwear === true, '🩲 Бельё', 'В близости: какой комплект, кто выбирал и для кого, на месте ли. Просится у модели только в сцене; в карточке — под покрывалом, открывается нажатием.')}
          ${галка('hud-enable-duel', settings.enableVerbalDuel !== false, '💬 Словесная дуэль', 'Пока идёт спор: кто ведёт и насколько, кто что уступил, градус — и запись памяти, которая всплыла в споре. Просится у модели только в ходы со спором.')}
          ${галка('hud-enable-combat', settings.enableCombat !== false, '⚔️ Бой', 'Вкладка «Бой»: этап, очередь, дистанции, раны на силуэте, оружие, адреналин, выдержка, погоня. Просится у модели только когда есть опасность.')}
          <label class="hud-set-check" title="Когда просить бой у модели: «Сам решает» — если бой ещё идёт, в последних сообщениях опасность или свежая рана.">⚔️ Бой в промпте: <select id="hud-combat-prompt" class="hud-set-num" style="width:auto"><option value="auto"${(settings.combatPrompt || 'auto') === 'auto' ? ' selected' : ''}>сам решает</option><option value="always"${settings.combatPrompt === 'always' ? ' selected' : ''}>всегда</option><option value="never"${settings.combatPrompt === 'never' ? ' selected' : ''}>никогда</option></select></label>
          ${галка('hud-enable-life', settings.enableLife !== false, '🧺 Быт', 'Вкладка «Быт»: еда, сон, душ, стирка, одежда, деньги и дом по всем прошлым ходам. Модель добавляет короткий код быта только в ходы, где что-то такое было.')}
          <label class="hud-set-check" title="Видит ли модель итог быта и часов сцены («не ели 7 ч; долг сна 6 ч; ужин 19:00 пропущен»). Журнал в запрос не уходит никогда — только одна-две строки итога.">🧺 Быт → модели: <select id="hud-life-to-model" class="hud-set-num" style="width:auto"><option value="off"${['snapshot', 'macro', 'keys'].includes(settings.lifeToModel) ? '' : ' selected'}>только мне</option><option value="snapshot"${settings.lifeToModel === 'snapshot' ? ' selected' : ''}>строкой при снимке</option><option value="keys"${settings.lifeToModel === 'keys' ? ' selected' : ''}>при снимке, только по теме</option><option value="macro"${settings.lifeToModel === 'macro' ? ' selected' : ''}>макрос &#123;&#123;hudByt&#125;&#125;</option></select></label>
          <label class="hud-set-check" title="Норма сна для долга сна, часов">😴 Норма сна: ${число('hud-sleep-norm', 4, 12, settings.sleepNorm ?? 8, 52)} ч</label>
          ${галка('hud-enable-heatmap', видБлока('bodyMapView') !== 'list', '🫦 Карта тела картинкой', 'Чувствительность зон — картинкой (вид выбирается в «Кастомизации» → «Вид блоков»: силуэт, точки, блоки, созвездие). Выключено — прежний список зон со шкалами.')}
        `)}

        ${подгруппа('📖 Дневник, сны и мир', `
          ${галка('hud-enable-diary', settings.enableDiary, '📖 Дневник')}
          ${галка('hud-enable-dreams', settings.enableDreams, '🌙 Сновидения')}
          ${галка('hud-enable-world', settings.enableWorld, '🌍 Мир (новости, слухи)')}
          ${галка('hud-enable-economy', settings.enableEconomy !== false, '💹 Экономика', 'Курсы валют, цены и зарплаты мира — по строке на каждое.')}
          ${галка('hud-enable-events', settings.enableEvents !== false, '🎭 Афиша', 'Что идёт в кино, театре, на концертах и на улице — готовые зацепки для сцены.')}
          ${галка('hud-enable-city', settings.enableCity !== false, '🏛 Городские службы', 'Пробки, дороги, транспорт, коммунальные службы и ЧП.')}
          ${галка('hud-enable-horoscope', settings.enableHoroscope !== false, '🔮 Гороскоп', 'Знаки зодиака на день и общая удача. Чистое развлечение — прогноз погоды остаётся и без него.')}
        `)}
      `)}

      ${группа('✨ Отображение', `
        ${галка('hud-show-hints', settings.showHints !== false, '❔ Показывать пояснения', 'Рядом с названием вкладки и рядом со знакомыми полями появляется маленький вопросик. По нажатию разворачивается объяснение: за что отвечает, почему показалось и как читать.')}


        ${подгруппа('🧷 Списки из прошлых ходов', `
          ${галка('hud-carry-over', settings.carryOver !== false, '🧷 Держать списки из прошлых ходов', 'Переписки, секреты, важное, заметки, календарь и новости из прошлых ходов остаются на экране, даже если модель перестала их повторять. Работает только на отрисовке: в запрос к модели не уходит ни одного лишнего символа.')}
          <div class="hud-set-apps">
            <label title="Сколько предыдущих ходов просматривать. Больше — дольше собирается карточка.">Ходов назад: ${число('hud-carry-turns', 0, 200, settings.carryTurns)}</label>
            <label title="Предел длины каждого списка: секретов, заметок, событий календаря и прочего.">Записей в списке: ${число('hud-carry-items', 1, 200, settings.carryMaxItems)}</label>
            <label title="Предел длины одной переписки в телефоне и в перехватах.">Сообщений в чате: ${число('hud-carry-msgs', 1, 500, settings.carryMaxMessages)}</label>
          </div>
        `)}
      `)}

      ${группа('⚡ Производительность', `
        ${галка('hud-lighten-old', settings.lightenOldCards !== false, '🪶 Облегчать старые свёрнутые карточки', 'У старой свёрнутой карточки в странице остаётся только заголовок. Панель темы и содержимое откладываются и возвращаются при первом касании карточки. Заметно легче в длинных чатах, особенно на телефоне.')}
        ${галка('hud-lazy-tabs', settings.lazyTabs !== false, '🗂️ Ленивая загрузка вкладок', 'Собирается только открытая вкладка. Остальные (Телефон, Память, Мир и так далее) строятся в тот момент, когда вы на них переключаетесь, и дальше остаются готовыми. Заметно легче на карточках с большим HUD.')}

        ${подгруппа('📜 Длинные чаты (200+ сообщений)', `
          ${галка('hud-performance-mode', settings.performanceMode, '⚡ Performance Mode', 'При 200+ сообщениях отключает тяжёлую повторную обработку старых сообщений, замораживает их анимации/эффекты и обрабатывает HUD по мере прокрутки.')}
          ${галка('hud-virtualize', settings.virtualizeCards !== false, '🪟 Держать в DOM только карточки рядом с экраном', 'Внутри Performance Mode: карточка, уехавшая дальше полутора экранов от края, разбирается обратно в текст, а на её месте остаётся заглушка той же высоты. При возвращении карточка собирается заново.')}
          ${заметка('Включается само только в чатах от 200 сообщений на странице. Старые блоки остаются рабочими и догружаются при прокрутке.')}
        `)}

        ${подгруппа('🧹 Лимит карточек', `
          ${заметка('Каждая собранная карточка HUD — это сотни элементов страницы. Если вписать число, в памяти останутся только последние N карточек, а <b>самые старые</b> свернутся до тонкой полоски. Текст сообщения никуда не денется: долистаете до него — карточка соберётся заново.<br>0 — ограничение выключено.')}
          <label class="hud-set-check">🧹 Держать в памяти карточек: ${число('hud-card-limit', 0, 2000, settings.hudCardLimit || 0, 80, 10)} шт.</label>
          ${галка('hud-hide-old-cards', settings.hideOldCards === true, '🙈 Прятать старые карточки совсем', 'Карточки сверх лимита пропадают без следа: без полоски «HUD свёрнут», и при прокрутке они не собираются. Прячется только HUD — текст сообщения на месте, а сам блок [HUD] в сообщении не трогается, модель его по-прежнему видит. Работает, когда лимит больше нуля.')}
          ${заметка('🙈 Со включённой галкой старые карточки сверх лимита исчезают целиком — остаётся только текст сообщения. Сам HUD в сообщении не удаляется: модель его видит, а выключив галку, карточки можно вернуть.')}
        `)}
      `)}

      ${группа('🖼️ Аватарки персонажей', `
        <div style="font-size:12px; opacity:.78;">Одна картинка — на любое число имён: впишите их через запятую, вместе с английским написанием. Аватарка встанет всюду, где сейчас кружок с инициалами: блок персонажей, чаты телефона, перехваты. Заодно HUD запомнит, что это один человек: перечисленные вместе написания сливаются в графе отношений, в шапках чатов и при выборе стороны сообщений, а имена из разных списков считаются разными людьми.</div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button type="button" id="hud-ava-add" style="cursor:pointer;">➕ Добавить изображение</button>
          <span id="hud-ava-status" style="font-size:11px; opacity:.75;"></span>
        </div>
        <div id="hud-ava-list" class="hud-ava-list"></div>
        <div style="font-size:12px; opacity:.78; margin-top:2px;">Закреплённые аватарки — страховка на случай, когда картинка из чата достаётся не тому: если у {{char}} указаны имена, никто, кроме них, его фото уже не получит.</div>
        <div id="hud-ava-pinned" class="hud-ava-list"></div>
        <input type="file" id="hud-ava-file" accept="image/*" style="display:none">
      `)}

      ${группа('📚 Лорбуки', `
        <div style="font-size:12px; opacity:.78;">Выбери один или несколько. Их записи + описание карточки чара + Persona добавляются только в отдельный запрос создания/регенерации HUD. Обычный HUD-инжект не меняется.</div>
        <select id="hud-lorebooks" multiple size="6" style="width:100%; min-height:110px; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:4px; border-radius:5px;"></select>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button type="button" id="hud-lorebooks-refresh" style="cursor:pointer;">🔄 Обновить список</button>
          <button type="button" id="hud-lorebooks-clear" style="cursor:pointer;">Очистить выбор</button>
          <span id="hud-lorebooks-status" style="font-size:11px; opacity:.75;"></span>
        </div>
        <label class="hud-set-check" title="Сколько последних сообщений чата уходит модели, когда она пишет запись лорбука по кнопке «Написать моделью» в окне «Запомнить». Больше сообщений — точнее контекст, но дороже запрос. 0 = без контекста сцены, только сам факт.">📚 В запись лорбука слать последние ${число('hud-lore-context', 0, 50, settings.loreContextMessages, 40)} сообщ.</label>
      `)}

      ${группа('🤖 Генерация', `
        <label class="hud-set-check" title="Отдельный лимит токенов только для запроса создания/регенерации HUD.">🧠 Лимит токенов HUD: ${число('hud-max-tokens', 256, 32768, settings.hudMaxTokens, 70)}</label>
        ${галка('hud-prompt-separate', settings.hudPromptSeparate !== false, '🧩 Инструкция HUD отдельным сообщением', 'Задача, правила, схема и снимок уходят последним сообщением — после пресета, карточки, лорбуков и истории. Выключите, если бэкенд не принимает системное сообщение в конце: тогда инструкция дописывается к последнему сообщению, как раньше.')}
        ${галка('hud-snapshot', settings.hudSnapshot !== false, '📸 Снимок последнего HUD в конце инструкции', 'Последний HUD в коротких кодах, без пустых полей: модель обновляет его под новый ответ, а не собирает мир заново. Последний HUD не дублируется: из истории он вырезается и переезжает в снимок. Снимок считается одним из развёрнутых HUD.')}
        <label class="hud-set-check" title="После ответа HUD проверяется на поля, которые схема требует каждый ход: мысли и «ожидание и реальность» каждого персонажа, дневник и гороскоп, если они включены. Условные поля (сны, дневник тела, подтекст, комментарии) не проверяются. Одна попытка на ответ; если вы сами остановили генерацию, проверки нет.">🩺 Неполный HUD:
          <select id="hud-complete-check" style="flex:1; min-width:0; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;">
            <option value="regen"${(settings.hudCompleteCheck || 'regen') === 'regen' ? ' selected' : ''}>Досоздавать перегенерацией</option>
            <option value="warn"${settings.hudCompleteCheck === 'warn' ? ' selected' : ''}>Только предупреждать</option>
            <option value="off"${settings.hudCompleteCheck === 'off' ? ' selected' : ''}>Не проверять</option>
          </select>
        </label>
        ${галка('hud-fill-gaps', settings.hudFillGaps !== false, '🧩 Дописывать пропущенное', 'С инструкцией нового ответа — короткая просьба: если в прошлом HUD не было обязательного (мысли, дневник, гороскоп), включить это сейчас; если в быте еда без подробностей («поели», «семейный ужин»), дописать в таймлайн, что ели, с прежним временем. Это не перегенерация: просьба едет вместе с обычным запросом.')}
        ${галка('hud-consistency-check', settings.hudConsistencyCheck === true, '🧮 Противоречия с бытом', 'Вдобавок к полноте: сытость высокая, а по журналу не ели 7 часов и больше и в этом ходе о еде ни слова; баланс сдвинулся без единой транзакции. Тогда HUD считается неполным — так же досоздаётся или предупреждает, как выбрано выше. Нужна вкладка «Быт».')}
        <label class="hud-set-check" title="Правила и поля близости — самая тяжёлая часть промта. «Авто»: только когда сцена идёт по последнему HUD или начинается по словам последних сообщений. Кинки, фетиши и история секса на экране не пропадают — HUD берёт их из прошлых ходов.">🔞 Часть про близость:
        ${галка('hud-adapt-prompt', settings.hudAdaptPrompt !== false, '🎯 Усиления', 'Если модель в этом чате регулярно оставляет пустыми мысли, дневник или гороскоп (больше трети ходов из последних 50, минимум 12), — короткая строка-напоминание в инструкции. Не больше трёх полей; счёт отдельный для каждой модели. Видно в бюджете токенов.')}
          <select id="hud-nsfw-prompt" style="flex:1; min-width:0; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;">
            <option value="auto"${(settings.nsfwPrompt || 'auto') === 'auto' ? ' selected' : ''}>Авто — когда сцена идёт</option>
            <option value="always"${settings.nsfwPrompt === 'always' ? ' selected' : ''}>Всегда</option>
            <option value="never"${settings.nsfwPrompt === 'never' ? ' selected' : ''}>Никогда</option>
          </select>
        </label>
        <label class="hud-set-check" title="Сколько последних HUD модель видит полностью, остальные сжимаются в сводку [HUD_SUMMARY]. Снимок в конце инструкции считается одним из них: при 1 (рекомендуется) — только снимок, при 2 — снимок и один полный HUD в истории (+тысячи токенов). 0 = все HUD сжаты в сводку, снимка нет. Сводки работают и при выключенном сетевом перехвате.">💾 Сколько развернутых HUD оставлять: ${число('hud-keep-count', 0, 10, settings.hudsToKeep, 40)}</label>
        <label class="hud-set-check" title="Сколько последних сообщений отправлять модели при нажатии на 🔄 (регенерация HUD). 0 = отправлять всю историю чата до этого сообщения.">⚡ При регене HUD слать последние ${число('hud-regen-context', 0, 50, settings.regenContextMessages, 40)} сообщ.</label>
        <label class="hud-set-check" title="Позволяет перегенерировать HUD (🔄) через ДРУГОЙ сохранённый профиль подключения">
          🧠 Профиль для регена HUD:
          <select id="hud-regen-profile" style="flex:1; min-width:0; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;">
            <option value="">Основной (текущий активный)</option>
          </select>
          <span id="hud-regen-profile-refresh" title="Обновить список профилей" style="cursor:pointer;">🔄</span>
        </label>
      `)}

      ${группа('❓ Ассистент', `
        ${галка('hud-enable-assistant', settings.enableAssistant !== false, '❓ Кнопка «Спросить про сюжет»', 'Кнопка ❓ на карточке открывает окно вопросов о сюжете. Каждый вопрос — отдельный запрос к модели; в чат ничего не пишется.')}
        ${заметка('Помощник к истории и HUD: объясняет, почему персонажи ведут себя так, что скрывают и что может случиться дальше. Отвечает по тому, что вы ему дадите ниже: больше контекста — точнее ответ, но дороже запрос.')}

        ${подгруппа('📥 Что видит ассистент', `
          <label class="hud-set-check">💬 Последних сообщений: ${число('hud-ask-messages', 0, 60, settings.assistantContextMessages ?? 12, 52)}</label>
          ${галка('hud-ask-hud', settings.assistantIncludeHud !== false, '📊 HUD сообщения', 'Снимок состояния истории: мысли, скрытый подтекст, отношения, доверие, страхи, секреты, ружья Чехова.')}
          ${галка('hud-ask-note', settings.assistantIncludeNote !== false, '📝 Заметки автора', 'То, что вписано в Author’s Note этого чата.')}
          ${галка('hud-ask-card', settings.assistantIncludeCard !== false, '🎭 Карточка персонажа', 'Описание, характер и сценарий из карточки.')}
          ${галка('hud-ask-persona', settings.assistantIncludePersona !== false, '👤 Персона игрока', 'Описание вашей персоны.')}
          ${заметка('Лорбуки ассистента — отдельно от лорбуков перегенерации HUD. Можно выбрать несколько.')}
          <select id="hud-ask-lorebooks" multiple size="5" style="width:100%; min-height:96px; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:4px; border-radius:5px;"></select>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <button type="button" id="hud-ask-refresh" style="cursor:pointer;">🔄 Обновить списки</button>
            <span id="hud-ask-lorebooks-status" style="font-size:11px; opacity:.75;"></span>
          </div>
          ${галка('hud-ask-lore-all', settings.assistantLoreAll === true, '📚 Все записи выбранных лорбуков', 'Выключено — только записи, чьи ключи встречаются в вопросе и в последних сообщениях, как в самой таверне.')}
        `)}

        ${подгруппа('🧠 Модель и промпт', `
          <label class="hud-set-check" title="Через какой профиль подключения задавать вопросы. Можно взять модель подешевле, чем для самой истории.">🧠 Профиль:
            <select id="hud-ask-profile" style="flex:1; min-width:0; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;"><option value="">Модель чата (текущее подключение)</option></select>
          </label>
          <label class="hud-set-check">📏 Лимит ответа: ${число('hud-ask-tokens', 256, 16000, settings.assistantMaxTokens ?? 1500, 70)} токенов</label>
          ${заметка('Системный промпт ассистента. Правьте под себя; кнопка ниже возвращает встроенный.')}
          <textarea id="hud-ask-system" rows="8" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:6px; border-radius:5px; font-size:12px; resize:vertical;">${escapeHtml(settings.assistantSystemPrompt || ПРОМПТ_АССИСТЕНТА)}</textarea>
          <button type="button" id="hud-ask-system-reset" class="hud-theme-act" style="align-self:flex-start;">↺ Вернуть встроенный</button>
        `)}
      `)}

      ${группа('🧹 Обслуживание', `
        <div style="font-size:12px; opacity:.78;">Отчёты «Архива HUD» лежат в браузере и разбираются заново только после изменения чата. Если их накопилось много или они начали мешать — уберите.</div>
        <div class="hud-set-apps" style="align-items:center;">
          <span id="hud-cache-usage" style="font-size:12px; opacity:.78;">считаю…</span>
          <button type="button" id="hud-clear-cache" class="hud-theme-act danger" title="Убрать отчёты архива и пометки-реакции. Настройки, темы и аватарки останутся.">🧹 Почистить кэш</button>
        </div>
      `)}

      </div>`;
  container.appendChild(wrapper);

  // --- Обслуживание -------------------------------------------------------
  // Размер считаем лениво: лезть в IndexedDB на каждой отрисовке настроек
  // незачем, а пока считается — показываем «считаю…».
  const показатьОбъём = () => {
    const метка = document.getElementById('hud-cache-usage');
    if (!метка) return;
    cacheUsage().then(({ записей, байт }) => {
      if (!метка.isConnected) return;
      метка.textContent = записей
        ? `отчётов: ${записей} · примерно ${(байт / 1048576).toFixed(байт > 1048576 ? 1 : 2)} МБ`
        : 'кэш пуст';
    }).catch(() => { метка.textContent = 'размер посчитать не удалось'; });
  };
  показатьОбъём();
  document.getElementById('hud-clear-cache').addEventListener('click', async (e) => {
    const кнопка = e.currentTarget;
    кнопка.disabled = true;
    try {
      const убрано = await clearCache();
      clearReactions();
      основа.showHudToast('success', 'Кэш очищен', убрано ? `Убрано отчётов: ${убрано}. Пометки-реакции тоже сняты.` : 'Отчётов не было. Пометки-реакции сняты.');
    } catch (err) {
      console.error('[TavernOS HUD] очистка кэша не удалась:', err);
      основа.showHudToast('error', 'Очистить не вышло', 'Подробности в консоли.');
    } finally {
      кнопка.disabled = false;
      показатьОбъём();
    }
  });

  // --- Ручные аватарки ---------------------------------------------------
  // Картинку ужимаем до квадрата 128px и кладём как JPEG data-URL. Настройки
  // SillyTavern хранятся одним JSON-файлом, поэтому оригинал на несколько
  // мегабайт туда класть нельзя — а для кружка аватарки 128px хватает с
  // запасом (выходит около 6-10 КБ на картинку).
  function hudShrinkImage(file, max = 128) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Это не изображение'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('Файл больше 8 МБ'));
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Не удалось прочитать файл'));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Не удалось открыть картинку'));
        img.onload = () => {
          try {
            const side = Math.min(img.width, img.height);
            const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
            const c = document.createElement('canvas');
            c.width = c.height = max;
            c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, max, max);
            // WebP при том же качестве весит примерно на треть меньше
            // JPEG, а настройки SillyTavern — один общий JSON-файл, и
            // каждая аватарка лежит в нём как data-URL. Если браузер WebP
            // не умеет, toDataURL молча отдаёт PNG — это видно по началу
            // строки, и тогда откатываемся на JPEG.
            const webp = c.toDataURL('image/webp', 0.82);
            resolve(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.82));
          } catch (err) { reject(new Error('Не удалось обработать картинку')); }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  // Аватарки участвуют в уже отрисованных HUD, поэтому после правки
  // сбрасываем кэш и просим перерисовать блоки заново.
  function refreshHudAvatars() {
    invalidateAvatarCache();
    refreshAvatarFaces();
  }

  function avaRow(entry, role) {
    const img = role === 'char' ? settings.avatarCharImg : role === 'user' ? settings.avatarUserImg : entry.img;
    const names = role === 'char' ? settings.avatarCharNames
      : role === 'user' ? settings.avatarUserNames
      : role === 'npc' ? entry.names : '';
    const label = role === 'char' ? '{{char}}' : role === 'user' ? '{{user}}' : '';
    const thumb = img
      ? `<span class="hud-ava-thumb" style="background-image:url('${img}')"></span>`
      : '<span class="hud-ava-thumb is-empty">?</span>';
    const placeholder = role === 'char' ? 'Имена {{char}} через запятую'
      : role === 'user' ? 'Имена {{user}} через запятую'
      : 'Арес Бомонт, Ares Beaumont';
    const nameField = `<input type="text" class="hud-ava-names" value="${escapeHtml(names || '')}" placeholder="${placeholder}">`;
    return `<div class="hud-ava-row" data-ava-role="${role}" data-ava-id="${entry && entry.id ? escapeHtml(entry.id) : ''}">
        ${label ? `<span class="hud-ava-tag">${label}</span>` : ''}
        ${thumb}${nameField}
        <button type="button" class="hud-ava-btn hud-ava-replace" title="Заменить картинку">🔄</button>
        <button type="button" class="hud-ava-btn hud-ava-del" title="${role === 'npc' ? 'Удалить запись' : 'Убрать картинку'}">🗑️</button>
      </div>`;
  }

  function renderAvatarRows() {
    const list = document.getElementById('hud-ava-list');
    const pinned = document.getElementById('hud-ava-pinned');
    if (!list || !pinned) return;
    const rows = Array.isArray(settings.avatarOverrides) ? settings.avatarOverrides : [];
    list.innerHTML = rows.length
      ? rows.map(e => avaRow(e, 'npc')).join('')
      : '<div class="hud-ava-empty">Пока ни одной. Нажмите «Добавить изображение».</div>';
    pinned.innerHTML = avaRow(null, 'char') + avaRow(null, 'user');
  }

  // Какую запись сейчас правим: null — создаём новую.
  let avaTarget = null;
  const avaFile = document.getElementById('hud-ava-file');
  const avaStatus = document.getElementById('hud-ava-status');
  const avaSay = (msg) => { if (avaStatus) avaStatus.textContent = msg || ''; };

  if (avaFile) {
    document.getElementById('hud-ava-add').addEventListener('click', () => {
      avaTarget = { mode: 'new' };
      avaFile.value = ''; avaFile.click();
    });

    avaFile.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !avaTarget) return;
      avaSay('Обрабатываю…');
      try {
        const dataUrl = await hudShrinkImage(file);
        if (avaTarget.mode === 'new') {
          if (!Array.isArray(settings.avatarOverrides)) settings.avatarOverrides = [];
          settings.avatarOverrides.push({ id: 'ava' + Date.now().toString(36), img: dataUrl, names: '' });
        } else if (avaTarget.role === 'char') settings.avatarCharImg = dataUrl;
        else if (avaTarget.role === 'user') settings.avatarUserImg = dataUrl;
        else {
          const row = (settings.avatarOverrides || []).find(r => r.id === avaTarget.id);
          if (row) row.img = dataUrl;
        }
        основа.saveSettings(); renderAvatarRows(); refreshHudAvatars();
        avaSay('Готово, ' + Math.round(dataUrl.length / 1024) + ' КБ');
      } catch (err) {
        avaSay('');
        основа.showHudToast('error', 'Картинка не подошла', err.message || 'Не удалось обработать файл.');
      }
      avaTarget = null;
    });
  }

  const avaHost = document.getElementById('hud-settings-wrapper');
  if (avaHost) {
    avaHost.addEventListener('click', (e) => {
      const row = e.target.closest('.hud-ava-row');
      if (!row) return;
      const role = row.dataset.avaRole, id = row.dataset.avaId;
      if (e.target.closest('.hud-ava-replace')) {
        avaTarget = { mode: 'edit', role, id };
        avaFile.value = ''; avaFile.click();
        return;
      }
      if (e.target.closest('.hud-ava-del')) {
        if (role === 'char') { settings.avatarCharImg = ''; settings.avatarCharNames = ''; }
        else if (role === 'user') { settings.avatarUserImg = ''; settings.avatarUserNames = ''; }
        else settings.avatarOverrides = (settings.avatarOverrides || []).filter(r => r.id !== id);
        основа.saveSettings(); renderAvatarRows(); refreshHudAvatars();
        avaSay('');
      }
    });
    avaHost.addEventListener('input', (e) => {
      const field = e.target.closest('.hud-ava-names');
      if (!field) return;
      const row = field.closest('.hud-ava-row');
      if (row.dataset.avaRole === 'char') settings.avatarCharNames = field.value;
      else if (row.dataset.avaRole === 'user') settings.avatarUserNames = field.value;
      else {
        const entry = (settings.avatarOverrides || []).find(r => r.id === row.dataset.avaId);
        if (entry) entry.names = field.value;
      }
      основа.saveSettings(); refreshHudAvatars();
    });
  }
  renderAvatarRows();

  document.getElementById('hud-auto-inject').addEventListener('change', (e) => { settings.autoInject = e.target.checked; основа.saveSettings(); });
  document.getElementById('hud-enable-phone').addEventListener('change', (e) => { settings.enablePhone = e.target.checked; основа.saveSettings(); });
  document.getElementById('hud-enable-intercepts').addEventListener('change', (e) => { settings.enableIntercepts = e.target.checked; основа.saveSettings(); });
  document.getElementById('hud-enable-casket').addEventListener('change', (e) => { settings.enableCasket = e.target.checked; основа.saveSettings(); });
  document.getElementById('hud-enable-overheard').addEventListener('change', (e) => { settings.enableOverheard = e.target.checked; основа.saveSettings(); });
  // Эпоха: показываем переключатели только своей пары.
  document.getElementById('hud-era').addEventListener('change', (e) => {
    settings.era = e.target.value === 'medieval' ? 'medieval' : 'modern';
    document.querySelectorAll('.hud-era-block').forEach(b => { b.hidden = b.dataset.era !== settings.era; });
    основа.saveSettings();
  });
  document.getElementById('hud-combat-prompt')?.addEventListener('change', (e) => { settings.combatPrompt = e.target.value; основа.saveSettings(); });
  document.getElementById('hud-life-to-model')?.addEventListener('change', (e) => { settings.lifeToModel = e.target.value; основа.saveSettings(); });
  document.getElementById('hud-sleep-norm')?.addEventListener('change', (e) => { let v = parseFloat(e.target.value); if (!Number.isFinite(v)) v = 8; settings.sleepNorm = Math.max(4, Math.min(12, v)); e.target.value = settings.sleepNorm; основа.saveSettings(); });
  document.getElementById('hud-enable-diary').addEventListener('change', (e) => { settings.enableDiary = e.target.checked; основа.saveSettings(); });
  document.getElementById('hud-enable-dreams').addEventListener('change', (e) => { settings.enableDreams = e.target.checked; основа.saveSettings(); });
  document.getElementById('hud-enable-world').addEventListener('change', (e) => { settings.enableWorld = e.target.checked; основа.saveSettings(); });
  [['hud-enable-guns', 'enableGuns'], ['hud-enable-illness', 'enableIllness'], ['hud-enable-pregnancy', 'enablePregnancy'], ['hud-enable-babies', 'enableBabies'],
   ['hud-enable-companions', 'enableCompanions'], ['hud-enable-bodystate', 'enableBodyState'], ['hud-enable-twists', 'enableTwists'], ['hud-enable-perception', 'enablePerception'], ['hud-enable-familytree', 'enableFamilyTree'], ['hud-enable-assistant', 'enableAssistant'],
   ['hud-enable-menstruation', 'enableMenstruation'], ['hud-enable-sceneclock', 'enableSceneClock'], ['hud-enable-tempo', 'enableTempo'], ['hud-enable-underwear', 'enableUnderwear'], ['hud-enable-duel', 'enableVerbalDuel'], ['hud-enable-combat', 'enableCombat'], ['hud-enable-life', 'enableLife'], ['hud-enable-intimacy-extras', 'enableIntimacyExtras'], ['hud-enable-heatmap', 'enableHeatMap'],
   ['hud-enable-economy', 'enableEconomy'], ['hud-enable-events', 'enableEvents'], ['hud-enable-city', 'enableCity'], ['hud-enable-horoscope', 'enableHoroscope'],
   ['hud-prompt-separate', 'hudPromptSeparate'], ['hud-snapshot', 'hudSnapshot'], ['hud-consistency-check', 'hudConsistencyCheck'], ['hud-fill-gaps', 'hudFillGaps'], ['hud-adapt-prompt', 'hudAdaptPrompt']].forEach(([id, ключ]) => {
    const поле = document.getElementById(id);
    if (поле) поле.addEventListener('change', (e) => {
      settings[ключ] = e.target.checked;
      // Галка карты тела и вид блока — одна настройка с двух сторон.
      if (ключ === 'enableHeatMap') settings.bodyMapView = e.target.checked ? (видБлока('bodyMapView') === 'list' ? 'both' : видБлока('bodyMapView')) : 'list';
      основа.saveSettings();
    });
  });
  document.getElementById('hud-nsfw-prompt')?.addEventListener('change', (e) => {
    settings.nsfwPrompt = ['auto', 'always', 'never'].includes(e.target.value) ? e.target.value : 'auto';
    основа.saveSettings();
  });
  document.getElementById('hud-complete-check')?.addEventListener('change', (e) => {
    settings.hudCompleteCheck = ['regen', 'warn', 'off'].includes(e.target.value) ? e.target.value : 'regen';
    основа.saveSettings();
  });
  document.getElementById('hud-enable-user').addEventListener('change', (e) => { settings.enableUserBlock = e.target.checked; основа.saveSettings(); });
  
  // === ВОТ СЮДА ВСТАВЛЯЕМ НАШУ НОВУЮ ГАЛОЧКУ ===
  document.getElementById('hud-enable-memory').addEventListener('change', (e) => { settings.enableMemory = e.target.checked; основа.saveSettings(); });
  document.getElementById('hud-performance-mode').addEventListener('change', (e) => {
    settings.performanceMode = e.target.checked;
    основа.saveSettings();
    основа.updatePerformanceMode();
    основа.setupPerformanceObserver();
    основа.processAllMessages();
  });
  document.getElementById('hud-open-custom').addEventListener('click', () => основа.открытьКастомизацию());
  document.getElementById('hud-open-archive').addEventListener('click', async () => {
    // Модуль архива грузим по требованию: он нужен раз в сессию, а тянет
    // за собой окно и вёрстку отчёта. Версию пишем литералом — её
    // подменяет bump-version.cjs, как и во всех остальных импортах.
    try {
      const mod = await import('./render/archive.js?v=23.48.1');
      mod.openArchiveDialog();
    } catch (e) {
      console.error('[TavernOS HUD] Архив не открылся:', e);
      alert('Не удалось открыть архив: ' + (e && e.message ? e.message : e));
    }
  });
  document.querySelectorAll('[data-phone-app-key]').forEach(box => {
    box.addEventListener('change', (e) => {
      settings[e.target.dataset.phoneAppKey] = e.target.checked;
      основа.saveSettings();
    });
  });
  document.getElementById('hud-lazy-tabs').addEventListener('change', (e) => { settings.lazyTabs = e.target.checked; основа.saveSettings(); });
  // Выключили облегчение — возвращаем содержимое всем карточкам сразу,
  // включили — облегчаем старые, как после обычной отрисовки.
  document.getElementById('hud-lighten-old').addEventListener('change', (e) => {
    settings.lightenOldCards = e.target.checked;
    основа.saveSettings();
    const scope = основа.cachedChatContainer || document;
    if (e.target.checked) основа.запланироватьОблегчение();
    else scope.querySelectorAll('.hud-os-card').forEach(card => вернутьКарточку(card));
  });
  document.getElementById('hud-card-limit').addEventListener('change', (e) => {
    let v = parseInt(e.target.value, 10); if (isNaN(v) || v < 0) v = 0;
    v = Math.min(2000, v);
    // Слишком маленький лимит свернул бы карточку прямо под курсором.
    if (v > 0 && v < 5) v = 5;
    settings.hudCardLimit = v; e.target.value = v; основа.saveSettings(); основа.enforceCardLimit();
  });
  document.getElementById('hud-hide-old-cards').addEventListener('change', (e) => {
    settings.hideOldCards = e.target.checked;
    основа.saveSettings();
    document.documentElement.classList.toggle('hud-hide-old-cards', settings.hideOldCards);
    if (settings.hideOldCards) { основа.enforceCardLimit(); return; }
    // Выключили — спрятанные карточки снова обычные свёрнутые: полоска
    // видна, при прокрутке собираются, а те, что на экране, — сразу.
    if (!основа.cachedChatContainer) return;
    основа.cachedChatContainer.querySelectorAll('.mes[data-hud-evicted="hidden"]').forEach(mes => {
      mes.dataset.hudEvicted = '1';
      if (основа.наЭкране(mes) && основа.restoreEvictedCard(mes)) основа.safeProcessMessage(mes);
    });
  });
  document.getElementById('hud-baby-years')?.addEventListener('change', (e) => { let v = parseInt(e.target.value, 10); if (isNaN(v)) v = 3; v = Math.max(1, Math.min(12, v)); settings.babyGraduateYears = v; e.target.value = v; основа.saveSettings(); });
  document.getElementById('hud-baby-facts')?.addEventListener('change', (e) => { settings.babyFactsToModel = e.target.value === 'off' ? 'off' : 'hidden'; основа.saveSettings(); });
  document.getElementById('hud-memory-max-height').addEventListener('change', (e) => { let v=parseInt(e.target.value,10); if(isNaN(v)) v=300; v=Math.max(200,Math.min(600,v)); settings.memoryMaxHeight=v; e.target.value=v; основа.saveSettings(); основа.applyThemeColors(); });
  

  populateHudLorebookSelect();
  document.getElementById('hud-lorebooks-refresh').addEventListener('click', populateHudLorebookSelect);
  document.getElementById('hud-lorebooks-clear').addEventListener('click', () => {
    const select = document.getElementById('hud-lorebooks');
    if (select) Array.from(select.options).forEach(o => { o.selected = false; });
    settings.hudLorebooks = []; основа.saveSettings(); updateHudLorebookStatus();
  });
  document.getElementById('hud-lorebooks').addEventListener('change', (e) => {
    settings.hudLorebooks = Array.from(e.target.selectedOptions).map(o => o.value);
    основа.saveSettings(); updateHudLorebookStatus();
  });
  document.getElementById('hud-max-tokens').addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 256) val = 256; if (val > 32768) val = 32768;
    settings.hudMaxTokens = val; e.target.value = val; основа.saveSettings();
  });

  document.getElementById('hud-keep-count').addEventListener('change', (e) => { 
    let val = parseInt(e.target.value);
    if (isNaN(val) || val < 0) val = 0; if (val > 10) val = 10;
    settings.hudsToKeep = val; e.target.value = val; основа.saveSettings(); 
  });
  document.getElementById('hud-regen-context').addEventListener('change', (e) => {
    let val = parseInt(e.target.value);
    if (isNaN(val) || val < 0) val = 0; if (val > 50) val = 50;
    settings.regenContextMessages = val; e.target.value = val; основа.saveSettings();
  });

  // Пояснения включаются и выключаются на лету: перерисовывать карточки
  // ради галочки незачем, вопросики навешиваются и снимаются по месту.
  document.getElementById('hud-show-hints').addEventListener('change', (e) => {
    settings.showHints = e.target.checked;
    основа.saveSettings();
    const чат = основа.cachedChatContainer || document.getElementById('chat') || document;
    if (settings.showHints) {
      чат.querySelectorAll('.mes_text').forEach(t => attachHelpMarks(t));
      // Вопросики вкладок живут в разметке, поэтому их вернёт только
      // пересборка. Просим разобрать заново.
      чат.querySelectorAll('.mes').forEach(m => { if (m.__hudSource && !m.querySelector('.hud-help-mark[data-tab-help]')) {
        const t = m.querySelector('.mes_text');
        if (t) { t.innerHTML = m.__hudSource; основа.safeProcessMessage(m); }
      } });
    } else {
      чат.querySelectorAll('.mes_text').forEach(t => removeHelpMarks(t));
      чат.querySelectorAll('.hud-help-mark[data-tab-help]').forEach(з => з.remove());
      чат.querySelectorAll('.hud-tab-hint').forEach(п => { п.hidden = true; п.classList.remove('is-open'); });
    }
  });
  document.getElementById('hud-carry-over').addEventListener('change', (e) => {
    settings.carryOver = e.target.checked;
    основа.saveSettings();
    основа.processAllMessages();
  });
  const числоваяНастройка = (id, ключ, мин, макс) => {
    document.getElementById(id).addEventListener('change', (e) => {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v) || v < мин) v = мин; if (v > макс) v = макс;
      settings[ключ] = v; e.target.value = v; основа.saveSettings();
      основа.processAllMessages();
    });
  };
  числоваяНастройка('hud-carry-turns', 'carryTurns', 0, 200);
  числоваяНастройка('hud-carry-items', 'carryMaxItems', 1, 200);
  числоваяНастройка('hud-carry-msgs', 'carryMaxMessages', 1, 500);
  document.getElementById('hud-virtualize').addEventListener('change', (e) => {
    settings.virtualizeCards = e.target.checked;
    основа.saveSettings();
    // Выключили — возвращаем всё свёрнутое обратно, иначе заглушки останутся
    // висеть до перезагрузки страницы.
    if (!e.target.checked && основа.cachedChatContainer) {
      основа.cachedChatContainer.querySelectorAll('.mes[data-hud-evicted]').forEach(mes => {
        if (основа.restoreEvictedCard(mes)) основа.safeProcessMessage(mes);
      });
    }
  });
  document.getElementById('hud-lore-context').addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 0) val = 0; if (val > 50) val = 50;
    settings.loreContextMessages = val; e.target.value = val; основа.saveSettings();
  });

  populateRegenProfileSelect();
  document.getElementById('hud-regen-profile-refresh').addEventListener('click', populateRegenProfileSelect);
  document.getElementById('hud-regen-profile').addEventListener('change', (e) => {
    settings.regenProfileId = e.target.value || '';
    основа.saveSettings();
  });

  // --- Ассистент ---------------------------------------------------------
  populateAssistantSelects();
  document.getElementById('hud-ask-refresh').addEventListener('click', populateAssistantSelects);
  [['hud-ask-hud', 'assistantIncludeHud'], ['hud-ask-note', 'assistantIncludeNote'], ['hud-ask-card', 'assistantIncludeCard'],
   ['hud-ask-persona', 'assistantIncludePersona'], ['hud-ask-lore-all', 'assistantLoreAll']].forEach(([id, ключ]) => {
    document.getElementById(id).addEventListener('change', (e) => { settings[ключ] = e.target.checked; основа.saveSettings(); });
  });
  [['hud-ask-messages', 'assistantContextMessages', 0, 60], ['hud-ask-tokens', 'assistantMaxTokens', 256, 16000]].forEach(([id, ключ, мин, макс]) => {
    document.getElementById(id).addEventListener('change', (e) => {
      let v = parseInt(e.target.value, 10);
      if (!Number.isFinite(v) || v < мин) v = мин; if (v > макс) v = макс;
      settings[ключ] = v; e.target.value = v; основа.saveSettings();
    });
  });
  document.getElementById('hud-ask-lorebooks').addEventListener('change', (e) => {
    settings.assistantLorebooks = Array.from(e.target.selectedOptions).map(o => o.value);
    основа.saveSettings(); статусЛорбуковАссистента();
  });
  document.getElementById('hud-ask-profile').addEventListener('change', (e) => { settings.assistantProfileId = e.target.value || ''; основа.saveSettings(); });
  const системныйПромпт = document.getElementById('hud-ask-system');
  // Совпадает со встроенным — храним пустым: обновление расширения тогда
  // подтянет новый встроенный промпт, а не застрянет на старой копии.
  системныйПромпт.addEventListener('change', () => {
    settings.assistantSystemPrompt = системныйПромпт.value.trim() === ПРОМПТ_АССИСТЕНТА.trim() ? '' : системныйПромпт.value;
    основа.saveSettings();
  });
  document.getElementById('hud-ask-system-reset').addEventListener('click', () => {
    системныйПромпт.value = ПРОМПТ_АССИСТЕНТА; settings.assistantSystemPrompt = ''; основа.saveSettings();
  });
}

export async function populateHudLorebookSelect() {
  const select = document.getElementById('hud-lorebooks');
  const status = document.getElementById('hud-lorebooks-status');
  if (!select) return;
  const previous = new Set(Array.isArray(settings.hudLorebooks) ? settings.hudLorebooks : []);
  if (status) status.textContent = 'Загрузка...';
  const names = await основа.getAvailableHudLorebooks();
  select.innerHTML = '';
  names.forEach(name => {
    const option = document.createElement('option');
    option.value = name; option.textContent = name; option.selected = previous.has(name);
    select.appendChild(option);
  });
  settings.hudLorebooks = names.filter(name => previous.has(name));
  основа.saveSettings(); updateHudLorebookStatus();
}

export function updateHudLorebookStatus() {
  const status = document.getElementById('hud-lorebooks-status');
  if (!status) return;
  const count = Array.isArray(settings.hudLorebooks) ? settings.hudLorebooks.length : 0;
  status.textContent = count ? `Выбрано: ${count}` : 'Ничего не выбрано';
}

// Выпадающие списки ассистента: свой профиль подключения и свои лорбуки.
export async function populateAssistantSelects() {
  const профиль = document.getElementById('hud-ask-profile');
  if (профиль) {
    const профили = основа.списокПрофилей();
    const было = settings.assistantProfileId || '';
    профиль.innerHTML = '<option value="">Модель чата (текущее подключение)</option>';
    профили.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name || p.id; профиль.appendChild(o); });
    профиль.value = профили.some(p => p.id === было) ? было : '';
    if (профиль.value !== было) { settings.assistantProfileId = профиль.value; основа.saveSettings(); }
  }
  const книги = document.getElementById('hud-ask-lorebooks');
  if (книги) {
    const было = new Set(Array.isArray(settings.assistantLorebooks) ? settings.assistantLorebooks : []);
    const имена = await основа.getAvailableHudLorebooks();
    книги.innerHTML = '';
    имена.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; o.selected = было.has(n); книги.appendChild(o); });
    settings.assistantLorebooks = имена.filter(n => было.has(n));
    основа.saveSettings();
    статусЛорбуковАссистента();
  }
}

export function статусЛорбуковАссистента() {
  const метка = document.getElementById('hud-ask-lorebooks-status');
  if (!метка) return;
  const n = Array.isArray(settings.assistantLorebooks) ? settings.assistantLorebooks.length : 0;
  метка.textContent = n ? `Выбрано: ${n}` : 'Не выбрано';
}

export function populateRegenProfileSelect() {
  const select = document.getElementById('hud-regen-profile');
  if (!select) return;
  let stContext = null;
  if (typeof window.SillyTavern !== 'undefined' && typeof window.SillyTavern.getContext === 'function') {
    stContext = window.SillyTavern.getContext();
  } else if (typeof getContext === 'function') {
    stContext = getContext();
  } else if (typeof window.getContext === 'function') {
    stContext = window.getContext();
  }
  const profiles = stContext && stContext.extensionSettings && stContext.extensionSettings.connectionManager
    ? (stContext.extensionSettings.connectionManager.profiles || [])
    : [];

  const prevValue = settings.regenProfileId || '';
  select.innerHTML = `<option value="">Основной (текущий активный)</option>`;
  profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name || p.id;
    select.appendChild(opt);
  });
  select.value = profiles.some(p => p.id === prevValue) ? prevValue : '';
  if (select.value !== prevValue) { settings.regenProfileId = select.value; основа.saveSettings(); }

  if (!profiles.length) {
    const opt = document.createElement('option');
    opt.value = ''; opt.disabled = true;
    opt.textContent = '(Connection Manager не найден или профилей нет)';
    select.appendChild(opt); // раньше опция создавалась, но не добавлялась в select — была мёртвым кодом
  }
}
