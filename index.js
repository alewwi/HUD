// hud-manager/index.js (v21.5.5)
import { hexToRgba, settings, defaultSettings, настройка, КЛЮЧИ_АВТО } from './settings.js?v=23.48.3';
import { escapeHtml, getSafeUserName, hudHasMeaningfulValue, имяДляВкладки, имяБезПриставки, убратьПриставкуКарточки } from './utils.js?v=23.48.3';
import { parseHUDComplex, scoreHudJsonCandidate } from './hud-parser.js?v=23.48.3';
import { initGlobalEvents, initObserver, initTavernOSEvents, refreshReactions, облегчитьКарточку, вернутьКарточку, плавноПоказать } from './events.js?v=23.48.3';
import { buildUserHTML, buildCharacterHTML, buildPerceptionHTML } from './render/character.js?v=23.48.3';
import { buildCompanionsHTML, hudHasMeaningfulCompanions } from './render/companions.js?v=23.48.3';
import { mergeCarryOver, вернутьЧерты, сдвигиДоверия, ключБлокаСводки, достатьРазборыСводки, запомнитьРазборСводки } from './render/carryover.js?v=23.48.3';
import { привязатьИсторию } from './render/intimacy.js?v=23.48.3';
import { журналБыта, buildLifeHTML, естьБыт, строкаБыта, темыБыта, пробелыБыта } from './render/life.js?v=23.48.3';
import { строкаЧасовСцены } from './render/scene-clock.js?v=23.48.3';
import { buildCombatHTML, hudHasCombat } from './render/combat.js?v=23.48.3';
import { прогнозыЗаживления } from './render/life-combat.js?v=23.48.3';
import { состояниеСцены } from './render/character.js?v=23.48.3';
import { buildDiaryHTML, hudHasMeaningfulDiary, buildBodyDiaryHTML, hudHasMeaningfulBodyDiary } from './render/diary.js?v=23.48.3';
import { buildDreamHTML, hudHasMeaningfulDreams } from './render/dreams.js?v=23.48.3';
import { buildInterceptsHTML, hudHasMeaningfulIntercepts } from './render/intercepts.js?v=23.48.3';
import { buildMemoryHTML } from './render/memory.js?v=23.48.3';
import { buildPhoneTabsHTML } from './render/phone.js?v=23.48.3';
import { праздникиСцены } from './render/holidays.js?v=23.48.3';
import { изменитьСудьбу, откатитьСудьбу, отметитьТест, узнатьПол, изменитьПлоды, откатитьПлоды, зарегистрироватьРоды, роды, поправитьРоды } from './render/conception.js?v=23.48.3';
import { buildBabiesHTML, hudHasBabies, днейИзТекста } from './render/babies.js?v=23.48.3';
import { buildCasketHTML, hudHasCasket, buildOverheardHTML, hudHasMeaningfulOverheard } from './render/medieval.js?v=23.48.3';
import { hudHasRelations } from './render/relations-graph.js?v=23.48.3';
import { buildLightningSvg, buildSeasonSceneHtml } from './render/scene.js?v=23.48.3';
import { чипЛуны, теньЛуны, титрыСцены, карточкаПоворота } from './render/extras.js?v=23.48.3';
import { buildWorldHTML, hudHasMeaningfulWorld } from './render/world.js?v=23.48.3';
import { applyThemeClass } from './themes.js?v=23.48.3';
import { упорядочитьВкладки } from './tabs-order.js?v=23.48.3';
import { подключитьСтили } from './css-loader.js?v=23.48.3';
import { бюджетИнструкции, подписьБюджета, медианаОтвета, оценкаТокенов, точноТокенов, разметкаБюджета, коротко } from './token-budget.js?v=23.48.3';
import { наблюденияПолей, учестьОтвет, профильМодели, строкаУсиления, слабыеПоля } from './adapt-prompt.js?v=23.48.3';
import { правитьСнимок, снятьПравку } from './snapshot-edits.js?v=23.48.3';
import { TAB_HELP, findTermHelp, buildHintHTML, attachHelpMarks, removeHelpMarks, centerFieldIcons } from './help.js?v=23.48.3';
import { getChatMessages, parseSceneDate } from './history-analyzer.js?v=23.48.3';
import { extractHudBlock, hudOpenRe, hudCloseRe, последнийHudБлок, меткаСДанными, естьHudБлок, hudБлоки, маскаРассуждений, ТЕГИ_РАССУЖДЕНИЙ, заменитьHudБлоки } from './hud-block.js?v=23.48.3';
import { собратьСнимок, строкаСнимка, решитьNSFW, решитьБой, последниеТекстыЧата, легендаСнимка } from './hud-snapshot.js?v=23.48.3';
import { создатьПроверкуПолноты, чегоНеХватает } from './hud-check.js?v=23.48.3';
import { обновитьПалитруГрупп, следитьЗаТемой } from './palette.js?v=23.48.3';
(function() {
  window.HUD = window.HUD || {};
  window.HUD.bootstrap = true;
  'use strict';


  let lastSceneWeather = '';
  // renderHUD отдаёт разметку строкой, повесить на неё замыкания нельзя.
  // Кладём их сюда, а processMessage сразу после вставки переносит на элемент
  // карточки. Между этими двумя шагами ничего не происходит.
  let lastLazyThunks = null;
  // baseId последней собранной карточки: нужен, чтобы подпись разметки не
  // зависела от случайных идентификаторов.
  let lastRenderBaseId = null;
  // Сообщение, для которого сейчас собирается HUD. Нужно, чтобы дотянуться
  // до предыдущего и узнать, какая там была погода.
  let renderTargetMes = null;

  // Погода ближайшего сообщения выше по чату, у которого она записана.
  function previousMessageWeather() {
    let el = renderTargetMes && renderTargetMes.previousElementSibling;
    while (el) {
      if (el.classList && el.classList.contains('mes') && el.dataset.hudWeather) return el.dataset.hudWeather;
      el = el.previousElementSibling;
    }
    // Мы внутри сообщения, а выше по чату дождя никто не записал — значит его
    // и не было. Глобальный lastSceneWeather здесь брать нельзя: он хранит
    // погоду последней отрисовки в любом месте чата, и от него лужа
    // «прилипала» к сухим ходам навсегда.
    return renderTargetMes ? '' : lastSceneWeather;
  }
  let cachedChatContainer = null;

  // Типы генераций SillyTavern, для которых HUD-инструкции инжектить НЕЛЬЗЯ:
  // 'quiet'       — фоновая "тихая" генерация (саммари, автоперевод, генерация промпта для
  //                 картинки, и т.д. — то, что не идёт в чат и не должно видеть пользователь);
  // 'impersonate' — генерация СООБЩЕНИЯ ЗА ПОЛЬЗОВАТЕЛЯ ("Impersonate" кнопка). Если сюда
  //                 просочится наш системный промпт "generate a [HUD] JSON block", модель начнёт
  //                 примешивать HUD-инструкции в текст, который должен звучать от лица юзера.
  // Всё остальное (обычная генерация, regenerate, swipe, continue, групповые чаты) — это
  // нормальный ответ персонажа в чат, туда HUD инжектить можно и нужно.
  const HUD_BLOCKED_GEN_TYPES = ['quiet', 'impersonate'];

  // Официальный SillyTavern Prompt Interceptor: вызывается ПЕРЕД каждым реальным запросом на
  // генерацию (не при dry run) и сообщает точный тип генерации через параметр `type`.
  // См. manifest.json -> "generate_interceptor". Это единственный официальный (не эвристический)
  // способ узнать "это обычное сообщение в чат или фоновая/чужая генерация" ДО того, как уйдёт
  // сетевой запрос — поэтому используем его как источник истины для window.fetch-патча ниже,
  // а не парсинг URL/тела запроса (который легко спутать с саммари/другими расширениями).
  let lastGenType = null;
  const pendingGenTypes = [];
  window.tavernOSGenerateInterceptor = async function(chat, contextSize, abort, type) {
    lastGenType = type;
    pendingGenTypes.push({ type, at: Date.now() });
    if (pendingGenTypes.length > 20) pendingGenTypes.splice(0, pendingGenTypes.length - 20);
  };


  // Инструкция HUD для модели (prompt.js) — самый большой кусок index.js, а
  // нужна она только к генерации. Грузится заранее, когда страница затихнет, и
  // в любом случае до первой отправки (обёртка fetch ждёт её).
  let загрузитьПромптОбещание = null;
  const загрузитьПромпт = () => (загрузитьПромптОбещание ||= import('./prompt.js?v=23.48.3').then(м => { м.подключить(связьПромпта); return м; }));
  const связьПромпта = {
    get последнийСнимокОбъект() { return последнийСнимокОбъект; },
    get сверитьРоды() { return сверитьРоды; },
  };

  /* Сводка старого HUD для истории в запросе: [HUD_SUMMARY] … [/HUD_SUMMARY].
     Регулярка находит у старых сообщений весь блок HUD и ставит на его место
     эту строку — модель помнит, когда, где и что было, не читая полный JSON.
     Одна функция и для ответа, и для перегенерации HUD. Игрок — по имени персоны.
     Что внутри:
       дата · время · погода (температура и первая фраза, без поэзии);
       кто где — одинаковые места вместе;
       Событие — последняя строка лога, если за ход она новая;
       Новое — что сдвинулось с прошлого HUD: секрет сменил огласку, ружьё
       выстрелило, появился факт. Не больше двух пунктов, каждый обрезан.
     Возраст не пишем: он не меняется, а повторялся в каждой сводке.
     прошлыйHud — текст предыдущего блока истории; без него «Нового» нет. */
  // Разборы для сводок: в памяти и в IndexedDB (render/carryover.js), так что
  // после перезагрузки страницы история запроса не разбирается заново. Старые
  // уходят по одному, а не всем кэшем сразу: в длинном чате HUD в запросе
  // больше, чем помещалось раньше, и кэш вычищал сам себя на каждом запросе.
  const разборыСводки = new Map();
  const ПРЕДЕЛ_РАЗБОРОВ_СВОДКИ = 400;
  function положитьРазборСводки(текст, итог) {
    разборыСводки.delete(текст);
    разборыСводки.set(текст, итог);
    while (разборыСводки.size > ПРЕДЕЛ_РАЗБОРОВ_СВОДКИ) разборыСводки.delete(разборыСводки.keys().next().value);
  }
  function разборДляСводки(текст) {
    if (разборыСводки.has(текст)) return разборыСводки.get(текст);
    let итог;
    try { итог = { данные: parseHUDComplex(текст) }; } catch (ошибка) { итог = { ошибка }; }
    положитьРазборСводки(текст, итог);
    if (итог.данные) запомнитьРазборСводки(ключБлокаСводки(текст), итог.данные);
    return итог;
  }
  // Перед сводками запроса: достать из базы разборы всех его блоков одним
  // чтением. Нет базы или не вышло — разберём как обычно.
  async function прогретьРазборыСводки(тексты) {
    try {
      const нужны = [...new Set(тексты)].filter(т => т && !разборыСводки.has(т));
      if (!нужны.length) return;
      const ключи = нужны.map(ключБлокаСводки);
      const найдено = await достатьРазборыСводки(ключи);
      нужны.forEach((т, i) => { const d = найдено.get(ключи[i]); if (d) положитьРазборСводки(т, { данные: d }); });
    } catch (_) {}
  }

  function сводкаHUD(hudText, прошлыйHud = '') {
    const разбор = разборДляСводки(hudText);
    if (разбор.ошибка) throw разбор.ошибка;
    const d = разбор.данные || {};
    const прошлый = прошлыйHud ? (разборДляСводки(прошлыйHud).данные || null) : null;
    const есть = (v) => v !== undefined && v !== null && String(v).trim() !== '' && !/^(empty|none|нет|—|-)$/i.test(String(v).trim());
    const обрезать = (s, n) => {
      const t = String(s).replace(/\s+/g, ' ').trim();
      if (t.length <= n) return t;
      const срез = t.slice(0, n);
      const пробел = срез.lastIndexOf(' ');
      return (пробел > n * 0.6 ? срез.slice(0, пробел) : срез).replace(/[\s,.;:—-]+$/, '') + '…';
    };
    const список = (v) => (Array.isArray(v) ? v : []).map(x => String(x ?? '')).filter(есть);
    const имяИгрока = getSafeUserName() || 'User';

    const части = [];
    const сцена = d.scene || {};
    const погода = есть(сцена['Погода'])
      ? обрезать(String(сцена['Погода']).split(/[,;.]/).map(s => s.trim()).filter(Boolean).slice(0, 2).join(', '), 48)
      : '';
    const шапка = [сцена['Дата'], сцена['Время']].filter(есть).map(String).concat(погода ? [погода] : []).join(' · ');
    if (шапка) части.push(шапка);

    // Кто где. Места модель пишет от города вглубь: «Кембридж, усадьба Кейнов,
    // спальня 3B у двери». Общее начало выносим один раз, у людей остаётся
    // только своя точка: «Кембридж, усадьба Кейнов: Брэндон (коридор), Софи (ванная)».
    const люди = [];
    const безМеста = [];
    const добавить = (имя, место) => {
      if (!есть(имя)) return;
      if (!есть(место)) { безМеста.push(String(имя)); return; }
      const куски = String(место).split(/,\s*/).map(s => s.trim()).filter(Boolean);
      const общее = куски.length > 2 ? куски.slice(0, 2).join(', ') : (куски.length === 2 ? куски[0] : '');
      const своё = куски.slice(общее ? общее.split(', ').length : 0).join(', ');
      люди.push({ имя: String(имя), общее, своё, целиком: куски.join(', ') });
    };
    (Array.isArray(d.characters) ? d.characters : []).forEach(c => { if (c) добавить(c['Имя'], c['Место']); });
    if (d.user && Object.values(d.user).some(есть)) добавить(имяИгрока, d.user['Место']);
    const группы = new Map();
    люди.forEach(ч => { const k = ч.общее || ч.целиком; группы.set(k, [...(группы.get(k) || []), ч]); });
    const кто = [...группы].map(([общее, состав]) => {
      if (состав.length === 1) return `${состав[0].имя} — ${обрезать(состав[0].целиком, 60)}`;
      const одинаково = состав.every(ч => ч.своё === состав[0].своё);
      if (одинаково) return `${состав.map(ч => ч.имя).join(', ')} — ${обрезать(состав[0].целиком, 60)}`;
      return `${обрезать(общее, 40)}: ${состав.map(ч => ч.своё ? `${ч.имя} (${обрезать(ч.своё, 30)})` : ч.имя).join(', ')}`;
    }).concat(безМеста);
    if (кто.length) части.push(кто.join('; '));

    // Событие хода: последняя строка лога, если её не было в прошлом HUD.
    const лог = список(d.memory?.timeline);
    const прошлыйЛог = new Set(список(прошлый?.memory?.timeline));
    const событие = лог.length ? лог[лог.length - 1] : '';
    if (событие && !прошлыйЛог.has(событие)) части.push(`Событие: ${обрезать(событие, 140)}`);

    // Новое с прошлого HUD. Без прошлого не с чем сравнивать — пропускаем,
    // иначе первая сводка перечислила бы все факты истории разом.
    if (прошлый) {
      const новое = [];
      const статусы = new Map((Array.isArray(прошлый.memory?.secrets) ? прошлый.memory.secrets : [])
        .filter(с => с && есть(с.fact)).map(с => [String(с.fact).trim(), String(с.status ?? '').trim()]));
      (Array.isArray(d.memory?.secrets) ? d.memory.secrets : []).forEach(с => {
        if (!с || !есть(с.fact) || !есть(с.status)) return;
        const было = статусы.get(String(с.fact).trim());
        if (было !== undefined && было !== String(с.status).trim()) новое.push(`секрет «${обрезать(с.fact, 60)}» → ${String(с.status).trim()}`);
      });
      const выстрелил = (g) => /fired|сработал|выстрел/i.test(String(g).split('|')[2] || '');
      const прошлыеВыстрелы = new Set(список(прошлый.memory?.guns).filter(выстрелил).map(g => g.split('|')[0].trim()));
      список(d.memory?.guns).filter(выстрелил).map(g => g.split('|')[0].trim())
        .filter(g => g && !прошлыеВыстрелы.has(g))
        .forEach(g => новое.push(`сработало: ${обрезать(g, 70)}`));
      // Факты сюда не берём: модель переписывает их каждый ход, и в сводку
      // попадали мелочи вроде «манжета в чернилах».
      if (новое.length) части.push(`Новое: ${новое.slice(0, 2).join('; ')}`);
    }

    return `[HUD_SUMMARY] ${части.join(' | ')} [/HUD_SUMMARY]`;
  }

  /* Макрос {{hudLast}} — снимок последнего HUD.
     Во время нашей инструкции значение подставляет перехват запроса: он знает,
     какой HUD последний именно в этом запросе (при свайпе заменяемый ответ в
     запрос не попадает). В пресете или в своём промте макрос берёт последний
     HUD чата — и при свайпе или перегенерации пропускает заменяемый ответ. */
  let значениеМакросаHUD = null;
  function значениеHudLast() {
    if (значениеМакросаHUD !== null) return значениеМакросаHUD;
    try {
      const ctx = window.SillyTavern?.getContext?.();
      const чат = Array.isArray(ctx?.chat) ? ctx.chat : [];
      let конец = чат.length;
      if (['swipe', 'regenerate'].includes(lastGenType) && конец && !чат[конец - 1]?.is_user) конец--;
      for (let j = конец - 1; j >= 0; j--) {
        const m = чат[j];
        if (!m || m.is_user || m.is_system) continue;
        const текстХода = m.swipes && m.swipes[m.swipe_id] !== undefined ? m.swipes[m.swipe_id] : m.mes;
        const блок = extractHudBlock(String(текстХода || ''));
        if (!блок) continue;
        const объект = собратьСнимок(блок);
        if (объект) return строкаСнимка(объект, решитьNSFW(объект, последниеТекстыЧата(чат, конец)));
      }
    } catch (_) {}
    return '';
  }

  // Для отладки и стенда: собрать инструкцию HUD без генерации.
  // Возвращает обещание: сама инструкция живёт в prompt.js.
  try { window.__tavernosHudPrompt = (o) => загрузитьПромпт().then(м => м.buildDynamicPrompt(o)); } catch (_) {}

  // Прошлый HUD объектом (коды как в снимке) — для решений о составе промта.
  function последнийСнимокОбъект() {
    try {
      const ctx = window.SillyTavern?.getContext?.();
      const чат = Array.isArray(ctx?.chat) ? ctx.chat : [];
      for (let j = чат.length - 1; j >= 0; j--) {
        const m = чат[j];
        if (!m || m.is_user || m.is_system) continue;
        const текстХода = m.swipes && m.swipes[m.swipe_id] !== undefined ? m.swipes[m.swipe_id] : m.mes;
        const блок = extractHudBlock(String(текстХода || ''));
        if (блок) return собратьСнимок(блок);
      }
    } catch (_) {}
    return null;
  }

  /* «Дописывать пропущенное» (settings.hudFillGaps): строки для инструкции.
     Прошлый HUD без обязательных полей (hud-check.js, чегоНеХватает) — «включи
     их в этот раз»; еда в быте без подробностей (life.js, пробелыБыта) —
     «допиши в lg с прежним временем». Не перегенерация: просьба едет с
     обычной инструкцией нового ответа. */
  function дописатьПропущенное(прошлыйHUD) {
    if (settings.hudFillGaps === false || !settings.autoInject) return '';
    const строки = [];
    try {
      if (прошлыйHUD) {
        const нет = чегоНеХватает(прошлыйHUD).filter(x => !/^весь HUD/.test(x));
        if (нет.length) строки.push('Last HUD missed: ' + нет.slice(0, 5).join(', ') + ' — include them in this HUD.');
      }
      if (settings.enableLife !== false && settings.enableMemory !== false) {
        const ctx = window.SillyTavern?.getContext?.();
        const чат = Array.isArray(ctx?.chat) ? ctx.chat : [];
        // Журнал — до сообщения с тем HUD, что ушёл в запрос: при свайпе
        // перегенерируемый ответ в него не входит.
        let конец = чат.length;
        if (прошлыйHUD) for (let i = чат.length - 1; i >= 0; i--) { const m = чат[i]; const т = m && (m.swipes && m.swipes[m.swipe_id] !== undefined ? m.swipes[m.swipe_id] : m.mes); if (т && String(т).includes(прошлыйHUD)) { конец = i + 1; break; } }
        const пробел = пробелыБыта(журналБыта(чат, конец));
        if (пробел) строки.push(пробел);
      }
    } catch (e) { console.warn('[TavernOS HUD] дописать пропущенное', e); }
    return строки.join('\n');
  }

  // --- Учёт пропусков по полям (adapt-prompt.js) -------------------------
  // Один раз на ответ: тот же ход при повторной отрисовке не считаем.
  const учтено = new Set();
  function учестьПоляОтвета(messageId, type) {
    try {
      if (!settings.autoInject || settings.hudAdaptPrompt === false) return;
      if (type && !['normal', 'swipe', 'regenerate', 'continue', undefined].includes(type)) return;
      const ctx = window.SillyTavern?.getContext?.();
      const m = ctx?.chat?.[Number(messageId)];
      if (!m || m.is_user || m.is_system) return;
      const ключ = String(ctx.getCurrentChatId?.() ?? '') + '|' + messageId + '|' + (m.swipe_id ?? 0);
      if (учтено.has(ключ)) return;
      учтено.add(ключ);
      const т = m.swipes && m.swipes[m.swipe_id] !== undefined ? m.swipes[m.swipe_id] : m.mes;
      if (учестьОтвет(ctx.chatMetadata, профильМодели(), наблюденияПолей(т))) {
        try { (ctx.saveMetadataDebounced || ctx.saveMetadata)?.call(ctx); } catch (_) { /* сохранит со следующим */ }
      }
    } catch (e) { console.warn('[TavernOS HUD] учёт полей', e); }
  }

  // --- Бюджет токенов (token-budget.js) -----------------------------------
  // Как пойдёт СЛЕДУЮЩИЙ запрос: близость и бой — по последнему HUD, как
  // решает перехват запроса; снимок, сейф и усиления — те же строки.
  let кэшБюджета = null;
  // Что Таверна сама кладёт в запрос: размер последнего запроса до нашей
  // инструкции и записи лорбука, которые она активировала.
  let запросТаверны = null, лорбукТаверны = null;
  // Карточка и персона — тем же чтением, что и для перегенерации HUD.
  function текстКарточки() {
    const ctx = getStContextSafe();
    const части = [];
    try {
      const id = ctx?.characterId;
      const ch = id !== undefined && id !== null && id >= 0 ? ctx?.characters?.[id] : null;
      const d = ch?.data || ch || {};
      части.push(d.description || ch?.description || '', d.personality || ch?.personality || '', d.scenario || ch?.scenario || '', d.mes_example || ch?.mes_example || '');
    } catch (_) { /* нет карточки */ }
    try { части.push((typeof window.power_user !== 'undefined' && window.power_user?.persona_description) || ctx?.persona?.description || ''); } catch (_) { /* нет персоны */ }
    return части.filter(x => String(x).trim()).join('\n');
  }
  async function посчитатьБюджет() {
    const { buildDynamicPrompt } = await загрузитьПромпт();
    const ctx = window.SillyTavern?.getContext?.();
    const чат = Array.isArray(ctx?.chat) ? ctx.chat : [];
    let блок = '', объект = null;
    for (let j = чат.length - 1; j >= 0 && !блок; j--) {
      const m = чат[j];
      if (!m || m.is_user || m.is_system) continue;
      const т = m.swipes && m.swipes[m.swipe_id] !== undefined ? m.swipes[m.swipe_id] : m.mes;
      блок = extractHudBlock(String(т || '')) || '';
    }
    if (блок) { try { объект = собратьСнимок(блок); } catch (_) { объект = null; } }
    const тексты = последниеТекстыЧата(чат);
    const nsfw = решитьNSFW(объект, тексты), бой = решитьБой(объект, тексты);
    const подпись = подписьБюджета({ nsfw, бой, ход: чат.length, снимок: settings.hudSnapshot, модель: профильМодели() });
    if (кэшБюджета && кэшБюджета.подпись === подпись) return кэшБюджета.итог;
    const снимок = объект && settings.hudSnapshot !== false ? строкаСнимка(объект, nsfw) : '';
    const сейф = дописатьПропущенное(блок);
    const усиление = строкаУсиления(ctx?.chatMetadata, профильМодели());
    const инструкция = бюджетИнструкции(buildDynamicPrompt, { nsfw, бой });
    // Родной счётчик Таверны — по целому; разделы масштабируем той же долей.
    const целое = buildDynamicPrompt({ nsfw, бой }) + снимок + сейф + усиление;
    const оценка = оценкаТокенов(целое);
    const точно = await точноТокенов(целое);
    const k = оценка > 0 && точно > 0 ? точно / оценка : 1;
    const масштаб = (n) => Math.round(n * k);
    инструкция.всего = масштаб(инструкция.всего); инструкция.основа = масштаб(инструкция.основа);
    инструкция.разделы.forEach(р => { р.цена = масштаб(р.цена); });
    const итог = { инструкция, снимок: масштаб(оценкаТокенов(снимок)), сейф: масштаб(оценкаТокенов(сейф)), усиление: масштаб(оценкаТокенов(усиление)), ответ: медианаОтвета(чат), слабые: слабыеПоля(ctx?.chatMetadata, профильМодели()), nsfw, бой };
    итог.запрос = инструкция.всего + итог.снимок + итог.сейф + итог.усиление;
    // Обычный ответ целиком: Таверна шлёт пресет, карточку, лорбук и историю,
    // HUD добавляет своё. Пока запроса не было — хотя бы карточка и лорбук.
    const карточка = масштаб(оценкаТокенов(текстКарточки()));
    const лорбук = лорбукТаверны ? масштаб(лорбукТаверны.токены) : null;
    итог.ответ_целиком = запросТаверны
      ? { таверна: масштаб(запросТаверны.токены), карточка, лорбук, всего: масштаб(запросТаверны.токены) + итог.запрос, точно: true }
      : { таверна: null, карточка, лорбук, всего: итог.запрос + карточка + (лорбук || 0), точно: false };
    // Перегенерация HUD (regen.js): последние N сообщений без старых HUD,
    // инструкция в режиме regen, снимок и HUD_EXTERNAL_CONTEXT — карточка,
    // персона и лорбуки, выбранные для HUD.
    try {
      const n = Math.min(50, Math.max(1, parseInt(settings.regenContextMessages, 10) || defaultSettings.regenContextMessages || 6));
      const история = чат.slice(-n).map(m => { const т = m && (m.swipes && m.swipes[m.swipe_id] !== undefined ? m.swipes[m.swipe_id] : m.mes); return заменитьHudБлоки(String(т || ''), '').trim(); }).filter(Boolean).join('\n');
      const лор = await buildHudLoreContext(история);
      const i = лор.indexOf('LOREBOOK —');
      const р = {
        история: масштаб(оценкаТокенов(история)), сообщений: n,
        инструкция: масштаб(оценкаТокенов(buildDynamicPrompt({ nsfw, режим: 'regen', бой }))),
        снимок: итог.снимок,
        карточка: масштаб(оценкаТокенов(i >= 0 ? лор.slice(0, i) : лор)),
        лорбук: масштаб(оценкаТокенов(i >= 0 ? лор.slice(i) : '')),
      };
      р.всего = р.история + р.инструкция + р.снимок + р.карточка + р.лорбук;
      итог.перегенерация = р;
    } catch (e) { console.warn('[TavernOS HUD] бюджет перегенерации', e); }
    кэшБюджета = { подпись, итог };
    return итог;
  }
  let таймерЧипов = 0;
  function обновитьЧипыБюджетаПозже(мс = 1500) { clearTimeout(таймерЧипов); таймерЧипов = setTimeout(обновитьЧипыБюджета, мс); }
  async function обновитьЧипыБюджета() {
    if (settings.tokenBudget === 'off') return;
    const чипы = [...document.querySelectorAll('.hud-os-card:not(.hud-historical) .hud-budget-chip')].filter(ч => !ч.closest('.hud-custom-preview-body'));
    if (!чипы.length) return;
    try {
      const итог = await посчитатьБюджет();
      const всего = (итог.ответ_целиком && итог.ответ_целиком.всего) || итог.запрос;
      for (const ч of чипы) { ч.textContent = '≈' + коротко(всего); ч.title = `≈${всего} токенов в следующем ответе: HUD ≈${итог.запрос}, остальное — карточка, лорбук, пресет и история. Нажмите — разбивка.`; }
      document.querySelectorAll('.hud-budget-panel:not([hidden])').forEach(п => { п.innerHTML = разметкаБюджета(итог); });
    } catch (e) { console.warn('[TavernOS HUD] бюджет', e); }
  }
  // Чип в полосе — внутри <label> сворачивания: клик по нему не должен
  // сворачивать карточку. Панель — внутри карточки, под полосой.
  document.addEventListener('click', (e) => {
    const чип = e.target.closest && e.target.closest('.hud-budget-chip');
    const выкл = !чип && e.target.closest && e.target.closest('.hud-budget-off');
    if (!чип && !выкл) return;
    e.preventDefault(); e.stopPropagation();
    if (выкл) {
      let значение = false;
      try { значение = JSON.parse(выкл.dataset.value); } catch (_) { значение = false; }
      settings[выкл.dataset.key] = значение;
      saveSettings();
      кэшБюджета = null;
      выкл.closest('li')?.classList.add('is-off');
      выкл.textContent = 'выключено';
      выкл.disabled = true;
      обновитьЧипыБюджетаПозже(300);
      return;
    }
    const card = чип.closest('.hud-os-card');
    const обёртка = card && card.querySelector(':scope > .hud-os-wrapper');
    if (!обёртка) return;
    const свёртка = card.querySelector(':scope > .hud-toggle-input');
    if (свёртка && !свёртка.checked) свёртка.checked = true;
    let панель = обёртка.querySelector(':scope > .hud-budget-panel');
    if (панель && !панель.hidden) { плавноПоказать(панель, false); чип.setAttribute('aria-expanded', 'false'); return; }
    if (!панель) { панель = document.createElement('div'); панель.className = 'hud-budget-panel'; панель.setAttribute('role', 'region'); панель.setAttribute('aria-label', 'Бюджет токенов'); обёртка.prepend(панель); }
    панель.innerHTML = разметкаБюджета(кэшБюджета && кэшБюджета.итог);
    панель.hidden = true;
    плавноПоказать(панель, true);
    чип.setAttribute('aria-expanded', 'true');
    посчитатьБюджет().then(итог => { if (!панель.hidden) панель.innerHTML = разметкаБюджета(итог); чип.textContent = '≈' + коротко((итог.ответ_целиком && итог.ответ_целиком.всего) || итог.запрос); }).catch(err => { панель.innerHTML = `<p class="hud-budget-note">Не посчиталось: ${escapeHtml(err && err.message || String(err))}</p>`; });
  }, true);
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('.hud-budget-chip')) { e.preventDefault(); e.target.click(); }
  });

  /* Итог быта и часов сцены для модели — одной-двумя строками: то, что HUD
     посчитал, а модель сама не выведет («не ели 7 ч», «ужин 19:00 пропущен»).
     Журнал в запрос не идёт никогда. Куда — по settings.lifeToModel. */

  function итогБытаДляМодели() {
    if (settings.enableLife === false || !settings.lifeToModel || settings.lifeToModel === 'off') return '';
    try {
      const ctx = window.SillyTavern?.getContext?.();
      const чат = Array.isArray(ctx?.chat) ? ctx.chat : [];
      // «По ключам» — только темы последних сообщений; не о чем — и строки нет.
      const темы = settings.lifeToModel === 'keys' ? темыБыта(последниеТекстыЧата(чат)) : null;
      const строки = [темы && !темы.length ? '' : строкаБыта(журналБыта(чат, чат.length), темы)];
      for (let j = чат.length - 1; j >= 0; j--) {
        const m = чат[j];
        if (!m || m.is_user || m.is_system) continue;
        const текстХода = m.swipes && m.swipes[m.swipe_id] !== undefined ? m.swipes[m.swipe_id] : m.mes;
        if (!extractHudBlock(String(текстХода || ''))) continue;
        const данные = parseHUDComplex(String(текстХода));
        привязатьИсторию(данные, j);
        const главный = Array.isArray(данные?.characters) ? данные.characters[0] : null;
        if (главный) строки.push(строкаЧасовСцены(главный, состояниеСцены));
        break;
      }
      return строки.filter(Boolean).join('\n');
    } catch (_) { return ''; }
  }

  let макросHUDЗарегистрирован = false;
  function зарегистрироватьМакросHUD() {
    if (макросHUDЗарегистрирован) return;
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx) return;
    const описание = 'TavernOS HUD: the last HUD of the chat as compact JSON with short codes — empty and switched-off fields left out, fresh-every-turn texts (Th, Ex, D, diary, dreams…) marked "<new this turn>".';
    try {
      // Новый движок макросов (SillyTavern 1.13+) — с поддержкой {{if hudLast}}.
      if (ctx.macros?.register && !ctx.macros.registry?.hasMacro?.('hudLast')) {
        ctx.macros.register('hudLast', { category: ctx.macros.category?.CHAT, description: описание, handler: () => значениеHudLast() });
        макросHUDЗарегистрирован = true;
      }
    } catch (e) { console.warn('[TavernOS HUD] Макрос hudLast: новый движок', e); }
    try {
      // Старый движок — на случай, если новый выключен в настройках ST.
      if (typeof ctx.registerMacro === 'function' && !ctx.powerUserSettings?.experimental_macro_engine) {
        ctx.registerMacro('hudLast', () => значениеHudLast(), описание);
        макросHUDЗарегистрирован = true;
      }
    } catch (e) { console.warn('[TavernOS HUD] Макрос hudLast: старый движок', e); }
    // {{hudByt}} — итог быта и часов сцены, если в настройке выбран макрос.
    const описаниеБыта = 'TavernOS HUD: household summary the HUD computed (hours since food, sleep debt, laundry, money, missed plans), one or two lines; empty unless «Быт → модели: макрос» is chosen';
    const значениеБыта = () => settings.lifeToModel === 'macro' ? итогБытаДляМодели() : '';
    try { if (ctx.macros?.register && !ctx.macros.registry?.hasMacro?.('hudByt')) ctx.macros.register('hudByt', { category: ctx.macros.category?.CHAT, description: описаниеБыта, handler: значениеБыта }); } catch (_) {}
    try { if (typeof ctx.registerMacro === 'function' && !ctx.powerUserSettings?.experimental_macro_engine) ctx.registerMacro('hudByt', значениеБыта, описаниеБыта); } catch (_) {}
  }

  /* Раскрывает макросы инструкции: {{if hudLast}}…{{/if}}, {{hudLast}},
     {{user}}, {{char}}. Сначала движком SillyTavern — так в тексте появляются
     настоящие имена, — а если его нет или он вернул нераскрытое, своим
     разбором по тем же правилам. */
  function раскрытьИнструкцию(шаблон, снимок) {
    const значение = снимок || '';
    // Легенду кодов подставляем сами, до движка ST: она зависит от снимка
    // именно этого запроса и вне нашей инструкции не нужна.
    шаблон = шаблон.replace(/\{\{hudLastKeys\}\}/g, () => (значение ? легендаСнимка(значение) : ''));
    try {
      зарегистрироватьМакросHUD();
      const ctx = window.SillyTavern?.getContext?.();
      if (макросHUDЗарегистрирован && typeof ctx?.substituteParams === 'function') {
        значениеМакросаHUD = значение;
        const готово = ctx.substituteParams(шаблон);
        if (typeof готово === 'string' && готово.includes('<hud_instructions>') && !/\{\{\s*(?:\/?if\b|hudLast\s*\}\})/.test(готово.replace(значение, ''))) return готово;
      }
    } catch (e) {
      console.warn('[TavernOS HUD] Движок макросов не раскрыл инструкцию — свой разбор', e);
    } finally {
      значениеМакросаHUD = null;
    }
    return шаблон
      .replace(/\{\{if hudLast\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, тело) => (значение ? тело.trim() : ''))
      .replace(/\{\{hudLast\}\}/g, () => значение);
  }

  if (!window.__tavernOSFetchPatched) {
      window.__tavernOSFetchPatched = true;

      const originalFetch = window.fetch;
      window.fetch = async function(resource, options) {
    // Сводки старых HUD делаем и без «Сетевого перехвата»: полные HUD в истории
    // стоят тысячи токенов, даже когда модель новых уже не пишет. Сама
    // инструкция и снимок — только при включённом перехвате.
    if (options && options.method === 'POST' && options.body && typeof options.body === 'string') {
      const urlStr = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : '');
      const isImageRequest = /image|sdapi|draw|vision|dall-e/i.test(urlStr);
      // Инструкция HUD в запросе уже есть — это наш собственный запрос
      // (перегенерация HUD, прямым fetch или через профиль Connection Manager)
      // или запрос, прошедший перехват дважды. Отпускаем как есть: вторая
      // инструкция дублировала бы всю схему, а её пример [HUD]…[/HUD] сканировался
      // бы как блок истории. Проверка стоит ДО очереди типов генерации: чужой
      // тип, записанный интерцептором для запроса SillyTavern, забирать нельзя.
      // Раньше перегенерация ставила глобальный флаг на всё время ожидания
      // ответа — и любая генерация ST в эти секунды уходила без инструкции.
      // В JSON-теле угловые скобки не экранируются, так что ищем прямо в строке.
      if (options.body.includes('<hud_instructions>')) return originalFetch.apply(window, arguments);
      // Свои служебные запросы (вопрос про сюжет, запись лорбука) HUD-инструкцию
      // не получают: иначе модель ответит HUD-блоком вместо ответа.
      if (window.__tavernOSHudSkipInject > 0) return originalFetch.apply(window, arguments);

      // Достоверная проверка типа генерации: если interceptor успел сообщить нам, что это
      // 'quiet' (саммари/автоперевод/фоновая генерация) или 'impersonate' (генерация ЗА юзера),
      // не трогаем запрос вообще — пусть уходит как есть, без наших HUD-инструкций.
      // lastGenType === null означает "interceptor ещё не отработал в этой сессии" (например,
      // очень старый клиент SillyTavern без поддержки generate_interceptor) — в этом случае
      // не блокируем, чтобы не сломать инъекцию на старых версиях (fail-open).
      const isHudGenerationEndpoint = !isImageRequest && urlStr.includes('/api/') && (urlStr.includes('generate') || urlStr.includes('completions') || urlStr.includes('chat'));
      // Correlate the official generate_interceptor entry only with an actual text-generation
      // request. Other POSTs (settings, lorebooks, avatars, etc.) must never consume a queued
      // generation type, otherwise a quiet/impersonate classification can leak into the next chat.
      let effectiveGenType = null;
      if (isHudGenerationEndpoint) {
        const now = Date.now();
        while (pendingGenTypes.length && now - pendingGenTypes[0].at > 10000) pendingGenTypes.shift();
        const queued = pendingGenTypes.length ? pendingGenTypes.shift() : null;
        effectiveGenType = queued ? queued.type : lastGenType;
        lastGenType = pendingGenTypes.length ? pendingGenTypes[pendingGenTypes.length - 1].type : null;
      }
      const isBlockedGenType = effectiveGenType !== null && HUD_BLOCKED_GEN_TYPES.includes(effectiveGenType);

      if (isHudGenerationEndpoint && !isBlockedGenType) {
        try {
          let parsedBody = JSON.parse(options.body);
          let modified = false;

          const hasImageParams = parsedBody.negative_prompt !== undefined || parsedBody.width !== undefined || parsedBody.height !== undefined || parsedBody.size !== undefined || parsedBody.steps !== undefined || parsedBody.sampler_name !== undefined;
          const hasTextParams = parsedBody.messages !== undefined || parsedBody.max_tokens !== undefined || parsedBody.max_new_tokens !== undefined || parsedBody.temperature !== undefined;

          // ВОЗВРАЩАЕМ ЗАЩИТУ ОТ ИНЖЕКТА В КАРТИНКИ
          if (hasImageParams || !hasTextParams) return originalFetch.apply(window, arguments);

          let hudsToKeep = parseInt(settings.hudsToKeep, 10);
          if (isNaN(hudsToKeep) || hudsToKeep < 0) hudsToKeep = defaultSettings.hudsToKeep ?? 1;
          // Снимок последнего HUD уходит в конец инструкции и считается одним
          // из развёрнутых: полными в истории остаётся на один меньше, а сам
          // последний блок из истории вырезается — он переезжает в снимок и не
          // повторяется. Более старые блоки сжимаются в [HUD_SUMMARY], как раньше.
          const инжект = !!settings.autoInject;
          const снимокВключён = инжект && settings.hudSnapshot !== false && hudsToKeep > 0;
          let объектСнимка = null;
          // Текст прошлого HUD (последний блок в запросе) — для «Дописывать пропущенное».
          let прошлыйHUD = '';


          // Какие блоки сжать в сводку. Без снимка — всё, кроме последних
          // hudsToKeep, как раньше. Со снимком последний блок тоже сжимается
          // (он уходит в снимок), а полными остаются hudsToKeep − 1 перед ним.
          const выбратьДляСводки = (найденные) => {
            const естьСнимок = !!объектСнимка;
            const конец = естьСнимок ? найденные.length - 1 : найденные.length;
            const полных = естьСнимок ? hudsToKeep - 1 : hudsToKeep;
            const начало = Math.max(0, конец - полных);
            return найденные.filter((_, i) => i < начало || i >= конец);
          };
          // Сводка не должна ронять весь запрос: блок, который не разобрался,
          // остаётся в истории как есть.
          const вСводку = (hudText, прошлый = '') => { try { return '\n' + сводкаHUD(hudText, прошлый) + '\n'; } catch (_) { return null; } };
          // Последний HUD уходит в снимок целиком — в истории на его месте не
          // остаётся ничего, даже сводки: он не дублируется, а переезжает.
          // Сообщение, от которого без HUD ничего бы не осталось, получает
          // сводку: пустое сообщение часть бэкендов отвергает.
          // Между текстом до и после остаётся тот же разделитель, что стоял
          // после блока: в Text Completions перевод строки — часть шаблона.
          const вырезать = (content, index, length) => {
            const хвостДо = content.slice(0, index).match(/\s*$/)[0];
            const головаПосле = content.slice(index + length).match(/^\s*/)[0];
            const до = content.slice(0, index - хвостДо.length);
            const после = content.slice(index + length + головаПосле.length);
            const итог = до && после ? до + (головаПосле || хвостДо) + после : (до || после);
            return итог.trim() ? итог : null;
          };

          // Разборы старых HUD для сводок — из IndexedDB, одним чтением.
          await прогретьРазборыСводки(parsedBody.messages && Array.isArray(parsedBody.messages)
            ? parsedBody.messages.flatMap(msg => typeof msg.content === 'string' ? hudБлоки(msg.content).map(б => msg.content.substring(б.index, б.index + б.length)) : [])
            : typeof parsedBody.prompt === 'string' ? hudБлоки(parsedBody.prompt).map(б => parsedBody.prompt.substring(б.index, б.index + б.length)) : []);

          // 1. Формат Chat Completions (учитываем массив messages)
          if (parsedBody.messages && Array.isArray(parsedBody.messages)) {
            let allMatches = [];
            parsedBody.messages.forEach((msg, mIdx) => {
              if (typeof msg.content === 'string') {
                // Блоки внутри <plan>/<thinking> не трогаем: это рассуждения модели.
                for (const б of hudБлоки(msg.content)) allMatches.push({ mIdx, index: б.index, length: б.length });
              }
            });

            if (allMatches.length) { const посл = allMatches[allMatches.length - 1]; прошлыйHUD = parsedBody.messages[посл.mIdx].content.substring(посл.index, посл.index + посл.length); }
            if (снимокВключён && allMatches.length) {
              const посл = allMatches[allMatches.length - 1];
              объектСнимка = собратьСнимок(parsedBody.messages[посл.mIdx].content.substring(посл.index, посл.index + посл.length));
            }
            const toSummarize = выбратьДляСводки(allMatches);
            toSummarize.sort((a, b) => (a.mIdx !== b.mIdx ? b.mIdx - a.mIdx : b.index - a.index));
            // Прошлый блок читаем до замены: обходим с конца, и всё, что раньше
            // текущего, ещё на месте.
            const текстБлока = (m) => (m ? parsedBody.messages[m.mIdx].content.substring(m.index, m.index + m.length) : '');
            const вСнимке = объектСнимка ? allMatches[allMatches.length - 1] : null;
            toSummarize.forEach(rm => {
              let content = parsedBody.messages[rm.mIdx].content;
              if (rm === вСнимке) {
                const без = вырезать(content, rm.index, rm.length);
                if (без !== null) { parsedBody.messages[rm.mIdx].content = без; modified = true; return; }
              }
              const сводка = вСводку(content.substring(rm.index, rm.index + rm.length), текстБлока(allMatches[allMatches.indexOf(rm) - 1]));
              if (сводка === null) return;
              parsedBody.messages[rm.mIdx].content = content.slice(0, rm.index) + сводка + content.slice(rm.index + rm.length);
              modified = true;
            });
          }
          // 2. Формат Text Completions (учитываем единую строку prompt)
          else if (parsedBody.prompt && typeof parsedBody.prompt === 'string') {
            let allMatches = [];
            for (const б of hudБлоки(parsedBody.prompt)) allMatches.push({ index: б.index, length: б.length });
            if (allMatches.length) { const посл = allMatches[allMatches.length - 1]; прошлыйHUD = parsedBody.prompt.substring(посл.index, посл.index + посл.length); }
            if (снимокВключён && allMatches.length) {
              const посл = allMatches[allMatches.length - 1];
              объектСнимка = собратьСнимок(parsedBody.prompt.substring(посл.index, посл.index + посл.length));
            }
            const toSummarize = выбратьДляСводки(allMatches);
            toSummarize.sort((a, b) => b.index - a.index);
            const вСнимке = объектСнимка ? allMatches[allMatches.length - 1] : null;
            toSummarize.forEach(rm => {
              let content = parsedBody.prompt;
              if (rm === вСнимке) {
                const без = вырезать(content, rm.index, rm.length);
                if (без !== null) { parsedBody.prompt = без; modified = true; return; }
              }
              const прошлый = allMatches[allMatches.indexOf(rm) - 1];
              const сводка = вСводку(content.substring(rm.index, rm.index + rm.length), прошлый ? content.substring(прошлый.index, прошлый.index + прошлый.length) : '');
              if (сводка === null) return;
              parsedBody.prompt = content.slice(0, rm.index) + сводка + content.slice(rm.index + rm.length);
              modified = true;
            });
          }

          // Нужна ли часть про близость: идёт ли сцена по последнему HUD или
          // начинается по словам последних сообщений чата. Тексты — из самого
          // чата, а не из запроса: там же лежат вставки пресета.
          if (инжект) {
          let чатДляРешения = [];
          try { const ctx = window.SillyTavern?.getContext?.(); чатДляРешения = Array.isArray(ctx?.chat) ? ctx.chat : []; } catch (_) { чатДляРешения = []; }
          const nsfw = решитьNSFW(объектСнимка, последниеТекстыЧата(чатДляРешения));
          let снимок = объектСнимка ? строкаСнимка(объектСнимка, nsfw) : '';
          // Итог быта — строкой после снимка, если так выбрано в настройках.
          if (снимок && (settings.lifeToModel === 'snapshot' || settings.lifeToModel === 'keys')) { const быт = итогБытаДляМодели(); if (быт) снимок += '\n' + быт; }
          const { buildDynamicPrompt } = await загрузитьПромпт();
          // Бой — только когда он нужен (hud-snapshot.js, решитьБой).
          const бой = решитьБой(объектСнимка, последниеТекстыЧата(чатДляРешения));
          // Бюджет: что прислала Таверна сама (пресет, карточка, лорбук, история;
          // старые HUD уже свёрнуты в сводки) — до нашей инструкции.
          try {
            const весьТекст = Array.isArray(parsedBody.messages)
              ? parsedBody.messages.map(m => typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map(x => (x && x.text) || '').join('') : '').join('\n')
              : String(parsedBody.prompt || '');
            запросТаверны = { токены: оценкаТокенов(весьТекст), t: Date.now() };
            кэшБюджета = null;
          } catch (_) { /* бюджет — не повод ломать запрос */ }
          let dynamicPrompt = раскрытьИнструкцию(buildDynamicPrompt({ nsfw, бой }), снимок);
          // Сейф: чего не было в прошлом HUD и что быт знает без подробностей —
          // просим дописать в этом же ответе, короткой строкой в инструкции.
          const дописать = дописатьПропущенное(прошлыйHUD);
          if (дописать) dynamicPrompt += '\n\n' + дописать;
          // Усиления (adapt-prompt.js): поля, которые эта модель в этом чате
          // регулярно оставляет пустыми, — одной строкой, не больше трёх полей.
          const усиление = строкаУсиления(window.SillyTavern?.getContext?.()?.chatMetadata, профильМодели());
          if (усиление) dynamicPrompt += '\n\n' + усиление;
          window.__tavernOSHudPrompt = { nsfw, бой, снимок: снимок.length, символов: dynamicPrompt.length, отдельно: settings.hudPromptSeparate !== false };
          console.info('[TavernOS HUD] Инструкция HUD', window.__tavernOSHudPrompt);

          if (parsedBody.messages && Array.isArray(parsedBody.messages) && parsedBody.messages.length > 0) {
            const lastMsgIndex = parsedBody.messages.length - 1;
            const lastMsg = parsedBody.messages[lastMsgIndex];
            const lastRole = String(lastMsg?.role || '').toLowerCase();
            const ответПоследним = lastRole === 'assistant' || lastRole === 'model';
            if (settings.hudPromptSeparate !== false) {
              // Отдельное сообщение после всего, что собрал SillyTavern. Если
              // последним стоит ответ ассистента (продолжение, префилл), он
              // должен остаться последним — инструкция встаёт перед ним.
              // Системная роль посреди диалога безопасна: сервер ST сам
              // переводит её в пользовательскую для Claude, Gemini и других.
              const инструкция = { role: 'system', content: dynamicPrompt };
              if (ответПоследним) parsedBody.messages.splice(lastMsgIndex, 0, инструкция);
              else parsedBody.messages.push(инструкция);
            } else if (ответПоследним) {
              // Прежний способ — дописать к последнему сообщению игрока. Ответ
              // ассистента не трогаем: у DeepSeek и части OpenAI-совместимых
              // бэкендов такой запрос становился недопустимым.
              parsedBody.messages.push({ role: 'user', content: dynamicPrompt });
            } else if (typeof lastMsg.content === 'string') {
              lastMsg.content += '\n\n' + dynamicPrompt;
            } else {
              parsedBody.messages.push({ role: 'user', content: dynamicPrompt });
            }
            modified = true;
          } else if (parsedBody.prompt && typeof parsedBody.prompt === 'string') {
            parsedBody.prompt += '\n\n' + dynamicPrompt;
            modified = true;
          }
          } // инжект

          if (modified) {
            options.body = JSON.stringify(parsedBody);
          }

          // Для «Создать HUD» нужен шаблон последнего запроса даже если
          // TavernOS не менял исходный запрос.
          if (hasTextParams) {
            let headersCopy = {};
            if (options.headers) {
              if (typeof options.headers.forEach === 'function') {
                options.headers.forEach((v, k) => { headersCopy[k] = v; });
              } else { headersCopy = JSON.parse(JSON.stringify(options.headers)); }
            }
            window.lastTavernRequest = { url: urlStr, headers: headersCopy, body: JSON.parse(JSON.stringify(parsedBody)) };
            persistLastTavernRequest(window.lastTavernRequest);
          }
        } catch (e) { console.error("HUD API Error", e); }
      }
    }
    return originalFetch.apply(window, arguments);
  };
  } // <--- ВОТ ЭТА СКОБКА СПАСЕТ НАМ ЖИЗНЬ (закрывает if)

 // Украшения из присланных тем (css/deco.css). Рамки портрета — по id,
 // «По теме» берёт рамку и картинку угла, подходящие выбранной теме.
 const РАМКИ_ПОРТРЕТА = [['polaroid', 'Полароид со скотчем'], ['stamp', 'Почтовая марка'], ['archive', 'Архивное фото со скрепкой'],
   ['clip', 'Зажим и звёздочка'], ['wreath', 'Венок из кораллов'], ['orbit', 'Орбиты'], ['lattice', 'Окно-решётка'],
   ['octagon', 'Восьмиугольное окно'], ['film', 'Кадр плёнки'], ['rings', 'Двойное кольцо'], ['aero', 'Стекло «нулевых»'],
   ['vinyl', 'Пластинка'], ['moon', 'Лунная дуга'], ['badge', 'Значок-молния'], ['fan', 'Веер'], ['lotus', 'Лотос'], ['roses', 'Розы и клинок']];
 const РАМКА_ТЕМЫ = { kawaii: 'rings', cottage: 'polaroid', academia: 'stamp', noir: 'film', mafia: 'archive', ocean: 'wreath',
   spaceopera: 'orbit', spacehorror: 'orbit', japan: 'lattice', web1: 'aero', cyberpunk: 'vinyl', witch: 'moon', fantasy: 'badge',
   vamp: 'roses', ice: 'lotus', steampunk: 'archive', dieselpunk: 'film', western: 'archive', pirate: 'stamp', egypt: 'lotus', voodoo: 'fan' };
 const УГЛЫ_ШАПКИ = [['roses', 'Розы и клинок'], ['redbranch', 'Ветка красных цветов'], ['plum', 'Арка со сливой'], ['bridge', 'Мостик и лотосы'], ['cat', 'Котик-наклейка'], ['saturn', 'Сатурн и звезда'], ['oni', 'Маска они в цветах'], ['hat', 'Ведьмина шляпа с луной']];
 const УГОЛ_ТЕМЫ = { vamp: 'redbranch', japan: 'plum', ocean: 'bridge', kawaii: 'cat', ice: 'bridge', cottage: 'cat', spaceopera: 'saturn', spacehorror: 'saturn', voodoo: 'oni', witch: 'hat' };
 const РАЗДЕЛИТЕЛИ = [['line', 'Линия'], ['butterfly', 'Бабочки'], ['mountain', 'Горы'], ['ripple', 'Круги на воде'], ['medallion', 'Медальоны с иероглифами']];
 // Что включается простым классом на <html> (css/deco.css): ключ → класс.
 const КЛАССЫ_НАХОДОК = { healthPlaster: 'hud-plaster', tabBow: 'hud-tab-bow', lineNotes: 'hud-line-notes', dropCap: 'hud-drop-cap',
   trustHearts: 'hud-trust-hearts', themedScroll: 'hud-themed-scroll', hangPendant: 'hud-hang-pendant', lineWave: 'hud-line-wave',
   bgDragon: 'hud-bg-dragon', themedControls: 'hud-themed-controls' };

 // День сюжета: сколько дней прошло от первой даты сцены в чате. Ищем с
 // начала чата первый HUD с разборчивой датой и запоминаем, пока чат тот
 // же (по первому сообщению и длине, если даты ещё не нашлось).
 let первыйДеньЧата = { ключ: null, ms: null };
 function деньСюжета(сейчасСырое) {
   const сейчас = parseSceneDate(сейчасСырое);
   if (сейчас == null) return 0;
   const чат = getChatMessages();
   const ключ = чат[0] || null;
   if (первыйДеньЧата.ключ !== ключ || (первыйДеньЧата.ms == null && первыйДеньЧата.длина !== чат.length)) {
     let ms = null;
     for (const m of чат) {
       const блок = extractHudBlock(String((m && (m.mes ?? m.message)) || ''));
       if (!блок) continue;
       const д = блок.match(/(?:^|[\s;|{,"'])(?:dt|дата|date)["']?\s*[:：=]\s*["']?([^\n;|"}]+)/i);
       const v = д ? parseSceneDate(д[1]) : null;
       if (v != null) { ms = v; break; }
     }
     первыйДеньЧата = { ключ, ms, длина: чат.length };
   }
   if (первыйДеньЧата.ms == null) return 0;
   return Math.max(1, Math.round((сейчас - первыйДеньЧата.ms) / 864e5) + 1);
 }

 // Плашка «модель пишет HUD» над карточкой, пока идёт перегенерация:
 // круги на воде, пластинка и секундомер. Движение — под курсором или по
 // нажатию (css/deco.css). Возвращает функцию, которая плашку убирает.
 function показатьИндикаторHUD(mes) {
   const место = mes && mes.querySelector('.mes_text');
   if (!место) return null;
   const узел = document.createElement('div');
   узел.className = 'hud-gen-ind';
   узел.innerHTML = '<i class="hud-gen-ripple" aria-hidden="true"></i><i class="hud-gen-vinyl" aria-hidden="true"></i><span>Модель пишет HUD… <b>0</b> с</span>';
   const карта = место.querySelector('.hud-os-card');
   if (карта) карта.before(узел); else место.appendChild(узел);
   const начало = Date.now(), счёт = узел.querySelector('b');
   const таймер = setInterval(() => { счёт.textContent = String(Math.round((Date.now() - начало) / 1000)); }, 1000);
   return () => { clearInterval(таймер); узел.remove(); };
 }

 function applyThemeColors() {
    const root = document.documentElement;
    // Цвет текста: пустое значение снимает переопределение, и HUD снова
    // наследует цвет темы SillyTavern.
    if (settings.textColor) root.style.setProperty('--hud-text', settings.textColor);
    else root.style.removeProperty('--hud-text');
    if (settings.textMutedColor) root.style.setProperty('--hud-text-muted', settings.textMutedColor);
    else root.style.removeProperty('--hud-text-muted');

    // Тип стекла живёт классом на <html>, как и тема.
    ['frosted','clear','tinted','liquid','iridescent'].forEach(g => root.classList.remove('hud-glass-' + g));
    root.classList.add('hud-glass-' + (settings.glassType || 'frosted'));
    // Старые карточки сверх лимита можно прятать совсем — без полоски «HUD свёрнут».
    root.classList.toggle('hud-hide-old-cards', settings.hideOldCards === true);

    // Класс темы — источник украшений и цвета текста для светлых тем.
    // Ставим его первым: остальные переменные пишутся инлайново в style
    // элемента <html> и всё равно окажутся сильнее.
    applyThemeClass(settings.themePreset);
    if (settings.accentColor) root.style.setProperty('--hud-accent', settings.accentColor);
    if (settings.glowColor) root.style.setProperty('--hud-purple-glow', hexToRgba(settings.glowColor, Math.min(100, settings.glowAlpha !== undefined ? settings.glowAlpha : 40)));
    // Свечение карточки. Цвет и сила — «Свечение», размах — «Размах
    // свечения»: радиусы всех ореолов умножаются на --hud-glow-r. Мягкий и
    // яркий оттенки — от той же силы, чтобы один ползунок вёл всё сразу.
    {
      const цвет = settings.glowColor || '#8c5ad2';
      const сила = Math.max(0, Math.min(150, Number(settings.glowAlpha ?? 40)));
      // Выше 100 прозрачность уже полная — остаток силы идёт в ширину
      // ореолов: на 150 свет в полтора раза шире и гуще.
      const добавка = 1 + Math.max(0, сила - 100) / 100;
      const размах = Math.max(0, Math.min(3, Number(settings.glowSize ?? 100) / 100)) * добавка;
      root.style.setProperty('--hud-glow', hexToRgba(цвет, Math.min(100, сила)));
      root.style.setProperty('--hud-glow-soft', hexToRgba(цвет, Math.min(100, сила * 0.55)));
      root.style.setProperty('--hud-glow-strong', hexToRgba(цвет, Math.min(100, сила * 1.6)));
      root.style.setProperty('--hud-glow-r', размах.toFixed(3));
      // Для надписей: сам цвет свечения (без прозрачности) и сила в долях
      // от обычной (40 = 1) — заголовки светятся смесью своего цвета и этого.
      root.style.setProperty('--hud-glow-solid', цвет);
      root.style.setProperty('--hud-glow-i', (сила / 40).toFixed(3));
      // Ореол карточки и --hud-shadow собираются в CSS (misc.css, «СВЕЧЕНИЕ»)
      // из этих же переменных: так режим телефона может снять широкий свет.
      root.style.removeProperty('--hud-glow-card');
      root.style.removeProperty('--hud-shadow');
      const дыхание = ['soft', 'strong'].includes(settings.glowBreath) ? settings.glowBreath : '';
      root.classList.toggle('hud-glow-breath', !!дыхание);
      root.classList.toggle('hud-glow-breath-strong', дыхание === 'strong');
      // На телефоне: «Полностью» — как на компьютере, иначе только рамки.
      root.classList.toggle('hud-glow-mobile-full', settings.glowMobile === 'full');
      root.classList.toggle('hud-glow-mobile-off', settings.glowMobile === 'off');
      // Свечение внутри эмулятора телефона — свой выключатель.
      root.classList.toggle('hud-phone-noglow', settings.phoneGlow === 'off');
    }
    // Вид секций карточки (Кастомизация → Вид блоков): один цвет вместо
    // цветов по смыслу, без угловых значков, одинаковый крой. Последнее
    // меняет и разметку (render/character.js), класс — для остатков в CSS.
    root.classList.toggle('hud-pills-mono', settings.pillColors === 'mono');
    root.classList.toggle('hud-pills-noicons', settings.pillIcons === 'off');
    root.classList.toggle('hud-pills-plain', settings.pillStyle === 'plain');
    // Стиль секций, форма портрета, шапка-баннер (css/extras.css).
    ['stickers', 'moonglass', 'ghost', 'news', 'win95', 'mac', 'bujo', 'glass', 'evidence', 'double', 'notebook', 'label'].forEach(s => root.classList.toggle('hud-skin-' + s, настройка('sectionSkin') === s));
    // Имя контуром, скобки 「」, полосы экрана, светлые заголовки, подпись (css/deco.css).
    root.classList.toggle('hud-name-outline', настройка('nameStyle') === 'outline');
    root.classList.toggle('hud-brackets', настройка('thoughtBrackets') === 'on');
    root.classList.toggle('hud-crt', настройка('crtLines') === 'on');
    root.classList.toggle('hud-light-heads', настройка('lightHeadings') === 'on');
    root.classList.toggle('hud-signature', настройка('cardSignature') === 'on');
    root.classList.toggle('hud-name-sheen', настройка('nameStyle') === 'sheen');
    root.classList.toggle('hud-name-foil', настройка('nameStyle') === 'foil');
    for (const [ключ, класс] of Object.entries(КЛАССЫ_НАХОДОК)) root.classList.toggle(класс, настройка(ключ) === 'on');
    // Своя картинка баннера и визитки: у персонажей одна, у игрока своя.
    // Сдвиг — позиция картинки в полосе, как у обоев.
    for (const [кто, ключ] of [['char', 'bannerChar'], ['user', 'bannerUser']]) {
      const картинка = String(settings[ключ + 'Img'] || '').trim();
      const свой = !!картинка && !/^\(/.test(картинка);
      root.style.setProperty(`--hud-banner-${кто}`, свой ? `url("${картинка.replace(/"/g, '%22')}")` : 'none');
      root.classList.toggle(`hud-banner-${кто}-own`, свой);
      const доля = (v, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : d; };
      root.style.setProperty(`--hud-banner-${кто}-pos`, `${доля(settings[ключ + 'OffsetX'], 50)}% ${доля(settings[ключ + 'OffsetY'], 30)}%`);
    }
    root.classList.toggle('hud-ava-arch', settings.avatarShape === 'arch' || ((settings.avatarShape || 'auto') === 'auto' && settings.themePreset === 'vamp'));
    root.classList.toggle('hud-head-banner', настройка('headerStyle') === 'banner');
    // Рамка портрета, картинка в углу шапки, разделители групп, бумага и
    // сургуч — классами на <html>: узлы под них в карточке есть всегда.
    {
      const изСписка = (список, v) => список.some(([id]) => id === v) ? v : '';
      const рамка = settings.avatarDeco === 'theme' ? (РАМКА_ТЕМЫ[settings.themePreset] || '') : изСписка(РАМКИ_ПОРТРЕТА, settings.avatarDeco);
      РАМКИ_ПОРТРЕТА.forEach(([id]) => root.classList.toggle('hud-deco-' + id, id === рамка));
      root.classList.toggle('hud-ava-framed', !!рамка);
      const угол = settings.headerOrnament === 'theme' ? (УГОЛ_ТЕМЫ[settings.themePreset] || '') : изСписка(УГЛЫ_ШАПКИ, settings.headerOrnament);
      УГЛЫ_ШАПКИ.forEach(([id]) => root.classList.toggle('hud-orn-' + id, id === угол));
      root.classList.toggle('hud-orn-on', !!угол);
      РАЗДЕЛИТЕЛИ.forEach(([id]) => root.classList.toggle('hud-div-' + id, настройка('groupDividers') === id));
      root.classList.toggle('hud-paper-aged', настройка('paperAged') === 'on');
      root.classList.toggle('hud-paper-torn', настройка('paperTorn') === 'on');
      root.classList.toggle('hud-paper-folds', настройка('paperFolds') === 'on');
      root.classList.toggle('hud-wax-seal', настройка('waxSeal') === 'on');
    }
    // Рамка и кадр портрета. Масштаб — через object-view-box (Chrome, Edge,
    // Android); где его нет, работает только сдвиг (object-position).
    const цветРамки = /^#[0-9a-f]{3,8}$/i.test(String(settings.avatarFrameColor || '')) ? settings.avatarFrameColor : '';
    if (цветРамки) root.style.setProperty('--hud-ava-frame', цветРамки); else root.style.removeProperty('--hud-ava-frame');
    root.classList.toggle('hud-ava-custom', !!цветРамки);
    {
      const ч = (v, d, a, b) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
      const x = ч(settings.avatarOffsetX, 50, 0, 100), y = ч(settings.avatarOffsetY, 50, 0, 100), z = ч(settings.avatarScale, 100, 100, 400);
      const k = 1 - 100 / z;
      root.style.setProperty('--hud-ava-pos', `${x}% ${y}%`);
      root.style.setProperty('--hud-ava-view', k > 0 ? `inset(${(k * y).toFixed(2)}% ${(k * (100 - x)).toFixed(2)}% ${(k * (100 - y)).toFixed(2)}% ${(k * x).toFixed(2)}%)` : 'none');
    }
    // Фильтр рваного края для «Газеты» — один на страницу.
    if (настройка('sectionSkin') === 'news' && !document.getElementById('hud-torn-filter')) {
      document.body.insertAdjacentHTML('beforeend', '<svg id="hud-torn-filter" width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="hud-torn" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="4" seed="7"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter></svg>');
    }
    
    if (settings.cardBgStart && settings.cardBgEnd) root.style.setProperty('--hud-bg', `linear-gradient(135deg, ${hexToRgba(settings.cardBgStart, settings.cardBgAlpha)}, ${hexToRgba(settings.cardBgEnd, settings.cardBgAlpha)})`);
    if (settings.infoBlockBgStart && settings.infoBlockBgEnd) root.style.setProperty('--hud-card-inner-bg', `linear-gradient(135deg, ${hexToRgba(settings.infoBlockBgStart, settings.infoBlockBgAlpha)}, ${hexToRgba(settings.infoBlockBgEnd, settings.infoBlockBgAlpha)})`);
    if (settings.topBarBg) root.style.setProperty('--hud-header-bg', hexToRgba(settings.topBarBg, settings.topBarAlpha));
    if (settings.tabsBg) root.style.setProperty('--hud-tab-bg', hexToRgba(settings.tabsBg, settings.tabsAlpha));

    // ТЕЛЕФОН. Панель настроек существовала, значения сохранялись — но их
    // никто не применял, поэтому ни одна телефонная настройка не работала.
    // Пишем в *-user переменные: сами --hud-phone-* объявлены на эмуляторе и
    // подхватывают их как переопределение (см. style.css).
    // Фон, акцент, блюр, шрифт и его размер телефон берёт у HUD, пока стоит
    // «Наследовать тему HUD» (phoneThemeAuto): так правка темы сразу видна и
    // в телефоне. Правка любого из этих полей снимает галочку (events.js),
    // и дальше действуют свои значения. Раньше свои значения писались
    // всегда, а унаследованные — в переменные, которые эмулятор перекрывал:
    // галочка ничего не делала.
    const pAuto = settings.phoneThemeAuto !== false;
    const pBgStart = pAuto ? (settings.cardBgStart || '#0a0a0f') : (settings.phoneBgStart || '#0a0a0f');
    const pBgEnd   = pAuto ? (settings.cardBgEnd   || '#12121a') : (settings.phoneBgEnd   || '#12121a');
    const pBgAlpha = pAuto ? 92 : (settings.phoneBgAlpha !== undefined ? settings.phoneBgAlpha : 92);
    const pAccent  = pAuto ? (settings.accentColor || '#de859f') : (settings.phoneAccent || '#de859f');
    const pBlur    = pAuto ? (settings.backdropBlur !== undefined ? Number(settings.backdropBlur) + 6 : 14)
                           : (settings.phoneBlur !== undefined ? settings.phoneBlur : 14);
    const pFont    = pAuto ? (settings.fontMain || 'inherit') : (settings.phoneFont || 'inherit');
    const pFontSz  = pAuto ? (settings.fontSizeMain !== undefined ? Number(settings.fontSizeMain) - 1 : 13)
                           : (settings.phoneFontSize !== undefined ? settings.phoneFontSize : 13);
    root.style.setProperty('--hud-phone-bg-user', `linear-gradient(160deg, ${hexToRgba(pBgStart, pBgAlpha)}, ${hexToRgba(pBgEnd, pBgAlpha)})`);
    root.style.setProperty('--hud-phone-accent-user', pAccent);
    root.style.setProperty('--hud-phone-blur-user', pBlur + 'px');
    root.style.setProperty('--hud-phone-font-user', pFont);
    root.style.setProperty('--hud-phone-font-size-user', pFontSz + 'px');
    root.classList.toggle('hud-phone-inherit', pAuto);
    // Те же значения — и на корне: их читают элементы вне эмулятора.
    root.style.setProperty('--hud-phone-bg', `linear-gradient(160deg, ${hexToRgba(pBgStart, pBgAlpha)}, ${hexToRgba(pBgEnd, pBgAlpha)})`);
    root.style.setProperty('--hud-phone-accent', pAccent);
    root.style.setProperty('--hud-phone-blur', pBlur + 'px');
    root.style.setProperty('--hud-phone-font', pFont);
    root.style.setProperty('--hud-phone-font-size', pFontSz + 'px');
    root.style.setProperty('--hud-phone-radius', (settings.phoneBubbleRadius !== undefined ? settings.phoneBubbleRadius : 15) + 'px');
    root.style.setProperty('--hud-phone-notif-alpha', String((settings.phoneNotifAlpha !== undefined ? settings.phoneNotifAlpha : 94) / 100));
    if (settings.phoneBubbleRadius !== undefined) root.style.setProperty('--hud-phone-radius-user', settings.phoneBubbleRadius + 'px');
    if (settings.phoneNotifAlpha !== undefined) root.style.setProperty('--hud-phone-notif-alpha-user', (settings.phoneNotifAlpha / 100).toFixed(2));
    if (settings.phoneIconRadius !== undefined) root.style.setProperty('--hud-phone-icon-radius-user', settings.phoneIconRadius + 'px');
    if (settings.phoneFrameColor) root.style.setProperty('--hud-phone-frame-user', settings.phoneFrameColor);
    if (settings.phoneScreenGlow !== undefined) root.style.setProperty('--hud-phone-screen-glow-user', (settings.phoneScreenGlow / 100).toFixed(2));
    
    if (settings.sceneOverlayColor) root.style.setProperty('--hud-scene-overlay', hexToRgba(settings.sceneOverlayColor, settings.sceneOverlayAlpha));
    if (settings.sceneTextColor) root.style.setProperty('--hud-scene-text', settings.sceneTextColor);
    
    // Новые настройки погоды
    if (settings.weatherBgColor) root.style.setProperty('--hud-weather-bg', hexToRgba(settings.weatherBgColor, settings.weatherBgAlpha !== undefined ? settings.weatherBgAlpha : 40));
    if (settings.weatherBlur !== undefined) root.style.setProperty('--hud-weather-blur', settings.weatherBlur + 'px');
    // Множитель для всех слоёв ночного затемнения сцены.
    if (settings.sceneDarkness !== undefined) {
      root.style.setProperty('--scene-dark-k', (Number(settings.sceneDarkness) / 100).toFixed(2));
    }

    if (settings.nsfwColor) {
        root.style.setProperty('--hud-nsfw-border', settings.nsfwColor);
        root.style.setProperty('--hud-nsfw-bg', hexToRgba(settings.nsfwColor, settings.nsfwBgAlpha !== undefined ? settings.nsfwBgAlpha : 20));
        // Тот же цвет, но пригодный для смешивания: стили закрытой части
        // строят из него и кромку, и свечение, и подпись.
        root.style.setProperty('--hud-nsfw-color', settings.nsfwColor);
    }
    if (settings.dramaColor) {
        root.style.setProperty('--hud-drama-border', settings.dramaColor);
        root.style.setProperty('--hud-drama-bg', hexToRgba(settings.dramaColor, settings.dramaBgAlpha !== undefined ? settings.dramaBgAlpha : 15));
    }
    if (settings.interceptColor) {
        root.style.setProperty('--hud-intercept-color', settings.interceptColor);
        root.style.setProperty('--hud-intercept-bg', hexToRgba(settings.interceptColor, settings.interceptBgAlpha !== undefined ? settings.interceptBgAlpha : 15));
    }
    if (settings.memoryBgStart && settings.memoryBgEnd) root.style.setProperty('--hud-memory-bg', `linear-gradient(135deg, ${hexToRgba(settings.memoryBgStart, settings.memoryBgAlpha)}, ${hexToRgba(settings.memoryBgEnd, settings.memoryBgAlpha)})`);
    if (settings.memoryAccent) root.style.setProperty('--hud-memory-accent', settings.memoryAccent);
    if (settings.memoryGlowAlpha !== undefined) root.style.setProperty('--hud-memory-glow', hexToRgba(settings.memoryAccent || '#8c5ad2', settings.memoryGlowAlpha));
    if (settings.memoryBlur !== undefined) root.style.setProperty('--hud-memory-blur', settings.memoryBlur + 'px');
    if (settings.memoryMaxHeight !== undefined) root.style.setProperty('--hud-memory-max-height', Math.max(200, Number(settings.memoryMaxHeight) || 300) + 'px');
    if (settings.msgInBg) root.style.setProperty('--hud-msg-in', hexToRgba(settings.msgInBg, settings.msgInAlpha !== undefined ? settings.msgInAlpha : 15));
    if (settings.msgOutStart && settings.msgOutEnd) {
        root.style.setProperty('--hud-msg-out-start', settings.msgOutStart);
        root.style.setProperty('--hud-msg-out-end', hexToRgba(settings.msgOutEnd, settings.msgOutAlpha !== undefined ? settings.msgOutAlpha : 80));
    }

    if (settings.badgeColor) root.style.setProperty('--hud-badge-bg', settings.badgeColor);
    if (settings.clockColor) root.style.setProperty('--hud-clock-color', settings.clockColor);
    
    if (settings.fontSizeMain) root.style.setProperty('--hud-font-size-main', settings.fontSizeMain + 'px');
    if (settings.fontSizeHeaders) root.style.setProperty('--hud-font-size-headers', settings.fontSizeHeaders + 'px');
    if (settings.fontSizeClock) root.style.setProperty('--hud-font-size-clock', settings.fontSizeClock + 'px');
    if (settings.fontSizeDiary !== undefined) root.style.setProperty('--hud-font-size-diary', settings.fontSizeDiary + 'px'); // Размер дневника
    
    if (settings.fontMain) root.style.setProperty('--hud-font-main', settings.fontMain);
    if (settings.fontHeaders) root.style.setProperty('--hud-font-headers', settings.fontHeaders);
    if (settings.fontClock) root.style.setProperty('--hud-font-clock', settings.fontClock);
    if (settings.fontDiary) root.style.setProperty('--hud-font-diary', settings.fontDiary);

    if (settings.backdropBlur !== undefined) root.style.setProperty('--hud-blur-intensity', settings.backdropBlur + 'px');
    if (settings.bgImage && settings.bgImage.trim() !== '') {
        root.style.setProperty('--hud-custom-bg', `url("${settings.bgImage.trim()}")`);
    } else {
        root.style.setProperty('--hud-custom-bg', 'none');
    }
    if (settings.bgScale !== undefined) root.style.setProperty('--hud-bg-scale', settings.bgScale + '%');
    if (settings.bgOffsetY !== undefined) root.style.setProperty('--hud-bg-y', settings.bgOffsetY + '%');
    if (settings.bgOpacity !== undefined) root.style.setProperty('--hud-bg-opacity', settings.bgOpacity / 100);
  }

  function loadSettings() { 
    const saved = localStorage.getItem('hud_settings'); 
    if (saved) { try { Object.assign(settings, JSON.parse(saved)); } catch (e) {} }
    // Разовый переход: прежнее значение по умолчанию 2 → 1 (снимок заменяет
    // полный HUD в истории). Своё значение, отличное от 2, не трогаем.
    if (settings.hudsToKeepMigration !== 1) {
      if (saved && Number(settings.hudsToKeep) === 2) settings.hudsToKeep = 1;
      settings.hudsToKeepMigration = 1;
      if (saved) { try { localStorage.setItem('hud_settings', JSON.stringify(settings)); } catch (_) {} }
    }
    applyThemeColors(); обновитьПалитруГрупп(); следитьЗаТемой(); 
  }
  // Версию берём из ?v= собственного скрипта: раньше она была вписана в
  // заголовок настроек руками и отставала на десяток выпусков.
  function hudVersionLabel() {
    try {
      const tag = document.querySelector('script[src*="HUD/index.js"]');
      const m = tag && tag.src.match(/[?&]v=([\d.]+)/);
      if (m) return m[1];
    } catch (e) {}
    return '22+';
  }

  function saveSettings() {
    обновитьЧипыБюджетаПозже(800);
    // Включили фичу — её стили встают на своё место в цепочке.
    try { подключитьСтили(settings); } catch (_) { /* стили — не повод не сохранить */ }
    try {
      localStorage.setItem('hud_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('HUD: не удалось сохранить настройки', e);
      showHudToast('error', 'Настройки не сохранены', 'localStorage недоступен (приватный режим / нет места): ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // HUD EXTERNAL CONTEXT: selected Lorebooks + character card + Persona.
  // Used ONLY by the explicit HUD create/regenerate path. The normal network
  // injection/buildDynamicPrompt path is intentionally untouched.
  // ---------------------------------------------------------------------------
  function getStContextSafe() {
    try {
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') return window.SillyTavern.getContext();
      if (typeof getContext === 'function') return getContext();
      if (typeof window.getContext === 'function') return window.getContext();
    } catch (_) {}
    return null;
  }

  function getMainProtagonistNames(stContext = null) {
    let ctx = stContext;
    if (!ctx) { try { ctx = getStContextSafe(); } catch (_) {} }
    const userName = String(ctx?.name1 || window.name1 || ctx?.userName || '').trim();
    const charName = String(ctx?.name2 || window.name2 || ctx?.charName || '').trim();
    return {
      user: userName && !/^\{\{user\}\}$/i.test(userName) ? userName : 'Player',
      char: charName && !/^\{\{char\}\}$/i.test(charName) ? charName : 'Character'
    };
  }

  function getStRequestHeadersSafe() {
    try {
      const stContext = getStContextSafe();
      if (stContext && typeof stContext.getRequestHeaders === 'function') {
        const headers = stContext.getRequestHeaders();
        if (headers && typeof headers === 'object') return headers;
      }
    } catch (_) {}
    try { if (typeof getRequestHeaders === 'function') return getRequestHeaders(); } catch (_) {}
    return { 'Content-Type': 'application/json' };
  }

  async function getAvailableHudLorebooks() {
    try {
      const stContext = getStContextSafe();
      if (stContext && typeof stContext.getWorldInfoNames === 'function') {
        const names = await stContext.getWorldInfoNames();
        if (Array.isArray(names)) return names.filter(Boolean);
      }
    } catch (e) { console.debug('[TavernOS HUD] getWorldInfoNames() недоступен:', e); }
    try { if (Array.isArray(window.world_names)) return window.world_names.filter(Boolean); } catch (_) {}
    for (const url of ['/api/worldinfo/list', '/api/settings/get', '/getsettings']) {
      try {
        const response = await fetch(url, { method:'POST', headers:getStRequestHeadersSafe(), body:JSON.stringify({}), cache:'no-cache' });
        if (!response.ok) continue;
        const data = await response.json();
        const names = Array.isArray(data.world_names) ? data.world_names
          : Array.isArray(data.worlds) ? data.worlds
          : Array.isArray(data) ? data : [];
        if (Array.isArray(names)) return names.map(x => typeof x === 'string' ? x : (x?.name || x?.filename)).filter(Boolean);
      } catch (_) {}
    }
    console.warn('[TavernOS HUD] Не удалось получить список Lorebooks.');
    return [];
  }

  async function loadHudLorebook(name) {
    if (!name) return null;
    try {
      const response = await fetch('/api/worldinfo/get', { method:'POST', headers:getStRequestHeadersSafe(), body:JSON.stringify({name}), cache:'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (e) {
      try {
        const legacy = await fetch('/getworldinfo', { method:'POST', headers:getStRequestHeadersSafe(), body:JSON.stringify({name}), cache:'no-cache' });
        if (legacy.ok) return await legacy.json();
      } catch (_) {}
      console.warn(`[TavernOS HUD] Не удалось загрузить Lorebook "${name}":`, e);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // HUD Lorebook activation: mirror SillyTavern World Info's key mechanics for
  // the explicitly selected books. Constant entries are always included;
  // keyed entries are activated against the same conversation context.
  // ---------------------------------------------------------------------------
  function substituteHudLoreMacros(value, stContext) {
    const text = String(value ?? '');
    const protagonistNames = getMainProtagonistNames(stContext);
    const userName = protagonistNames.user;
    const charName = protagonistNames.char;
    return text
      .replace(/\{\{\s*user\s*\}\}/gi, userName)
      .replace(/\{\{\s*char\s*\}\}/gi, charName);
  }

  function hudLoreKeyMatches(text, key, entry, stContext) {
    const substituted = substituteHudLoreMacros(key, stContext).trim();
    if (!substituted) return false;

    const caseSensitive = entry?.extensions?.case_sensitive ?? entry?.caseSensitive;
    const wholeWords = entry?.extensions?.match_whole_words ?? entry?.matchWholeWords;
    const flags = caseSensitive ? 'g' : 'gi';

    // ST treats WI keys as regular expressions. Keep that behavior, with a
    // safe fallback to literal matching if a malformed regex is encountered.
    try {
      let pattern = substituted;
      if (wholeWords) pattern = `(?<!\\w)(?:${pattern})(?!\\w)`;
      return new RegExp(pattern, flags).test(text);
    } catch (_) {
      const hay = caseSensitive ? text : text.toLowerCase();
      const needle = caseSensitive ? substituted : substituted.toLowerCase();
      return wholeWords
        ? new RegExp(`(?<!\\w)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\w)`, caseSensitive ? '' : 'i').test(text)
        : hay.includes(needle);
    }
  }

  function hudLoreEntryActivates(entry, scanText, stContext) {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.disable === true || entry.disabled === true || entry.enabled === false) return false;

    const isConstant = entry.constant === true || entry.alwaysActive === true;
    if (isConstant) return true;

    const primary = Array.isArray(entry.key) ? entry.key.filter(Boolean) :
      Array.isArray(entry.keys) ? entry.keys.filter(Boolean) :
      typeof entry.key === 'string' ? entry.key.split(',').map(x => x.trim()).filter(Boolean) :
      typeof entry.keys === 'string' ? entry.keys.split(',').map(x => x.trim()).filter(Boolean) : [];
    if (!primary.length) return false;

    const primaryMatch = primary.some(key => hudLoreKeyMatches(scanText, key, entry, stContext));
    if (!primaryMatch) return false;

    const secondary = Array.isArray(entry.keysecondary) ? entry.keysecondary.filter(Boolean) :
      Array.isArray(entry.secondary_keys) ? entry.secondary_keys.filter(Boolean) :
      typeof entry.keysecondary === 'string' ? entry.keysecondary.split(',').map(x => x.trim()).filter(Boolean) :
      typeof entry.secondary_keys === 'string' ? entry.secondary_keys.split(',').map(x => x.trim()).filter(Boolean) : [];

    let logicActivated = true;
    // Modern ST entries are selective by default. If there are no secondary
    // keys, a primary-key hit is sufficient.
    if (secondary.length && (entry.selective !== false)) {
      const matches = secondary.map(key => hudLoreKeyMatches(scanText, key, entry, stContext));
      const any = matches.some(Boolean);
      const all = matches.every(Boolean);
      const logic = Number(entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? 0);
      // ST world_info_logic: AND_ANY=0, NOT_ALL=1, NOT_ANY=2, AND_ALL=3.
      if (logic === 1) logicActivated = !all;
      else if (logic === 2) logicActivated = !any;
      else if (logic === 3) logicActivated = all;
      else logicActivated = any;
    }
    if (!logicActivated) return false;

    // Respect the same probability gate used by World Info entries.
    const useProbability = entry.useProbability ?? entry.extensions?.useProbability ?? true;
    const probability = Number(entry.probability ?? entry.extensions?.probability ?? 100);
    if (useProbability && Number.isFinite(probability) && probability < 100) {
      if (Math.random() * 100 >= Math.max(0, probability)) return false;
    }
    return true;
  }

  function normalizeHudLoreEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    if (entry.disable === true || entry.disabled === true || entry.enabled === false) return null;
    const content = typeof entry.content === 'string' ? entry.content.trim() : '';
    return content || null;
  }

  async function buildHudLoreContext(scanText = '') {
    const selected = Array.isArray(settings.hudLorebooks) ? settings.hudLorebooks.filter(Boolean) : [];
    const stContext = getStContextSafe();
    const sections = [];
    try {
      const characterId = stContext?.characterId;
      const character = characterId !== undefined && characterId !== null && characterId >= 0 ? stContext?.characters?.[characterId] : null;
      const charData = character?.data || character || {};
      const charName = character?.name || charData?.name || window.name2 || '{{char}}';
      const description = charData?.description || character?.description || '';
      const personality = charData?.personality || character?.personality || '';
      const scenario = charData?.scenario || character?.scenario || '';
      if (String(description).trim() || String(personality).trim() || String(scenario).trim()) {
        sections.push(`CHARACTER CARD — ${charName}\nDescription:\n${String(description).trim()}${String(personality).trim() ? `\nPersonality:\n${String(personality).trim()}` : ''}${String(scenario).trim() ? `\nScenario:\n${String(scenario).trim()}` : ''}`);
      }
    } catch (e) { console.debug('[TavernOS HUD] Не удалось прочитать карточку персонажа:', e); }
    try {
      let personaDescription = '';
      if (typeof window.power_user !== 'undefined') personaDescription = window.power_user?.persona_description || '';
      if (!personaDescription) personaDescription = document.querySelector('#persona_description')?.value || '';
      if (!personaDescription && stContext?.persona?.description) personaDescription = stContext.persona.description;
      if (String(personaDescription).trim()) sections.push(`USER PERSONA — ${window.name1 || '{{user}}'}\n${String(personaDescription).trim()}`);
    } catch (e) { console.debug('[TavernOS HUD] Не удалось прочитать Persona:', e); }

    const effectiveScanText = [String(scanText || ''), ...sections].filter(Boolean).join('\n\n');
    for (const name of selected) {
      const data = await loadHudLorebook(name);
      const entries = data && Array.isArray(data.entries) ? data.entries
        : (data && data.entries && typeof data.entries === 'object' ? Object.values(data.entries) : []);
      const activated = entries
        .filter(entry => hudLoreEntryActivates(entry, effectiveScanText, stContext))
        .map(normalizeHudLoreEntry)
        .filter(Boolean);
      if (activated.length) {
        sections.push(`LOREBOOK — ${name}\n${activated.map((x, i) => `Entry ${i + 1}:\n${x}`).join('\n\n')}`);
      }
    }
    if (!sections.length) return '';
    return `\n\n<HUD_EXTERNAL_CONTEXT>\nThe following material is reference context for generating/updating the HUD. Use it to keep names, facts, relationships, locations, and world details consistent. Do not reproduce this section outside the HUD JSON.\n\n${sections.join('\n\n====================\n\n')}\n</HUD_EXTERNAL_CONTEXT>`;
  }

  // window.lastTavernRequest живёт только в памяти вкладки и теряется при перезагрузке страницы
  // или выгрузке вкладки из памяти (частая ситуация на телефоне). Дублируем последний запрос
  // в sessionStorage, чтобы 🔄/➕ работали сразу после открытия чата, до первой обычной генерации.
  const LAST_REQUEST_CACHE_KEY = 'hud_last_tavern_request';
  function persistLastTavernRequest(reqData) {
    try { sessionStorage.setItem(LAST_REQUEST_CACHE_KEY, JSON.stringify(reqData)); } catch (e) {}
  }
  function restoreLastTavernRequest() {
    if (window.lastTavernRequest) return;
    try {
      const cached = sessionStorage.getItem(LAST_REQUEST_CACHE_KEY);
      if (cached) window.lastTavernRequest = JSON.parse(cached);
    } catch (e) {}
  }

  function showHudToast(type, title, message) {
    let container = document.getElementById('hud-toast-container');
    if (!container) {
      container = document.createElement('div'); container.id = 'hud-toast-container'; container.className = 'hud-toast-container'; document.body.appendChild(container);
    }
    const toast = document.createElement('div'); toast.className = `hud-toast ${type}`;
    let iconSvg = type === 'loading' ? `<svg class="hud-toast-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>` : (type === 'success' ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`);
    toast.innerHTML = `<div class="hud-toast-icon">${iconSvg}</div><div class="hud-toast-content"><div class="hud-toast-title">${escapeHtml(title)}</div><div class="hud-toast-msg">${escapeHtml(message)}</div></div>`;
    container.appendChild(toast);
    if (type !== 'loading') { setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 400); }, 4000); }
    return toast;
  }


  // Окно «Кастомизация» и его панель темы (customize.js) вместе с примером HUD
  // грузятся при первом открытии: при старте они не нужны.
  let загрузитьКастомизациюОбещание = null;
  const загрузитьКастомизацию = () => (загрузитьКастомизациюОбещание ||= import('./customize.js?v=23.48.3').then(м => { м.подключить(связьКастомизации); return м; }));
  const связьКастомизации = {
    get applyCardUiState() { return applyCardUiState; },
    get applyThemeColors() { return applyThemeColors; },
    get getStContextSafe() { return getStContextSafe; },
    get lastLazyThunks() { return lastLazyThunks; }, set lastLazyThunks(v) { lastLazyThunks = v; },
    get readCardUiState() { return readCardUiState; },
    get renderHUD() { return renderHUD; },
    get saveSettings() { return saveSettings; },
    get РАЗДЕЛИТЕЛИ() { return РАЗДЕЛИТЕЛИ; },
    get РАМКИ_ПОРТРЕТА() { return РАМКИ_ПОРТРЕТА; },
    get УГЛЫ_ШАПКИ() { return УГЛЫ_ШАПКИ; },
    get видыМенялись() { return видыМенялись; }, set видыМенялись(v) { видыМенялись = v; },
    get выбор() { return выбор; },
    get перерисоватьКарточкиЧата() { return перерисоватьКарточкиЧата; },
    get путьУзла() { return путьУзла; },
    get посчитатьБюджет() { return посчитатьБюджет; },
    get разметкаБюджета() { return разметкаБюджета; },
  };
  function собратьПросмотр(...аргументы) { return загрузитьКастомизацию().then(м => м.собратьПросмотр(...аргументы)); }
  function открытьКастомизацию(...аргументы) { return загрузитьКастомизацию().then(м => м.открытьКастомизацию(...аргументы)); }

  // Словарь справки и вся её разметка живут в help.js.

  // Значок справки внутри вкладки. Отдельная кнопка, а не подсказка
  // браузера: подсказки браузера не открываются пальцем.
  function значокСправки(вид) {
    if (settings.showHints === false || !TAB_HELP[вид]) return '';
    return `<span class="hud-help-mark" data-tab-help="${вид}" role="button" tabindex="0"`
      + ` aria-label="Что это за вкладка" title="Что это за вкладка"></span>`;
  }


  // Панель кастомизации: темы, цвета, шрифты и вид блоков. Живёт в окне
  // «Кастомизация» (настройки расширения или 🎨 на карточке), а не в каждой
  // карточке: там она была скрытой копией на тысячу узлов в каждом ходе.
  // Строка-выпадашка кастомизации для одной настройки. Значения 'true' и
  // 'false' записываются булевыми (events.js, hud-theme-select-input).
  function выбор(ключ, подпись, пояснение, варианты) {
    // Украшения из тем получают «Авто (по теме)» вторым пунктом (settings.js, КЛЮЧИ_АВТО).
    if (КЛЮЧИ_АВТО.includes(ключ) && !варианты.some(([v]) => v === 'auto')) варианты = [варианты[0], ['auto', 'Авто (по теме)'], ...варианты.slice(1)];
    const сейчас = String(settings[ключ] ?? варианты[0][0]);
    return `<div class="hud-theme-row" title="${пояснение}"><label>${подпись}:</label><select class="hud-theme-select-input hud-custom-rerender" data-key="${ключ}">`
      + варианты.map(([v, имя]) => `<option value="${v}"${сейчас === v ? ' selected' : ''}>${имя}</option>`).join('') + '</select></div>';
  }


  // Дата родов по сюжету. Роды отмечаются на том свайпе, что был на экране;
  // если его потом заменили другим (с другой датой), запись «уезжала» — и
  // новорождённым показывало «4 дня». Сверяем с первым сообщением, где в
  // текущих свайпах есть малыши или послеродовое: дата сцены минус возраст.
  var подписьСверкиРодов = '';
  function сверитьРоды() {
    try {
      if (!роды().length) return false;
      const ctx = getStContextSafe();
      const чат = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
      const подпись = чат.length + ':' + чат.map(м => м && м.swipe_id || 0).join('');
      if (подпись === подписьСверкиРодов) return false;
      подписьСверкиРодов = подпись;
      for (const м of чат) {
        if (!м || м.is_user || typeof м.mes !== 'string' || !/"(?:bb|Pp)"\s*:/.test(м.mes)) continue;
        const блоки = hudБлоки(м.mes);
        if (!блоки.length) continue;
        const данные = parseHUDComplex(блоки[блоки.length - 1].inner);
        const сцена = parseSceneDate(((данные && данные.scene) || {})['Дата']);
        if (сцена === null) return false;
        const дни = ((данные && данные.babies) || []).map(b => днейИзТекста(String((b && b['Возраст']) || ''))).filter(Number.isFinite);
        return поправитьРоды(сцена - (дни.length ? Math.min(...дни) : 0) * 864e5);
      }
    } catch (e) { console.warn('[HUD] сверка даты родов:', e); }
    return false;
  }

  function renderHUD(data) {
    if (!data || Object.keys(data).length === 0) return '';
    сверитьРоды();
    const hasMemory = Boolean(data.memory && (
      (Array.isArray(data.memory.timeline) && data.memory.timeline.length) ||
      (Array.isArray(data.memory.important) && data.memory.important.length) ||
      (Array.isArray(data.memory.secrets) && data.memory.secrets.length) ||
      (Array.isArray(data.memory.guns) && data.memory.guns.length) ||
      (data.memory.mood && ((data.memory.mood.user?.current || data.memory.mood.user?.history?.length) || (data.memory.mood.char?.current || data.memory.mood.char?.history?.length))) ||
      (data.memory.route && ((data.memory.route.user?.length || 0) + (data.memory.route.char?.length || 0) > 0))
    )) || hudHasRelations(data);
    // Телефон показывается, если есть переписки ИЛИ любое содержимое ОС
    // (контакты, галерея, заметки, карты, история поиска).
    const phoneOsFilled = Boolean(data.phone && ['contacts','gallery','notes','maps','search']
      .some(k => Array.isArray(data.phone[k]) && data.phone[k].length > 0));
    const средневековье = settings.era === 'medieval';
    const hasPhone = Boolean(!средневековье && settings.enablePhone && ((data.chatsMap && Object.keys(data.chatsMap).length > 0) || phoneOsFilled));
    if (data.characters.length === 0 && (!data.intercepts || data.intercepts.length === 0) && data.diary.length === 0 && data.dreams.length === 0 && Object.values(data.world || {}).every(v => !v || !v.length) && Object.keys(data.scene).length === 0 && Object.keys(data.user || {}).length === 0 && !hasMemory && !hasPhone && !hudHasCasket(data.satchel, data.letters) && !hudHasMeaningfulOverheard(data.overheard)) return '';

    const baseId = Date.now() + '-' + Math.random().toString(36).slice(2);
    // Идентификаторы у каждой сборки свои. Чтобы можно было сравнить две
    // разметки по существу, запоминаем, каким был baseId в этот раз.
    lastRenderBaseId = baseId;
    let osSubtitleHtml = '';

    let tRaw = data.scene['Время'] || '', wRaw = data.scene['Погода'] || '', dRaw = data.scene['Дата'] || '';
    // Дата сцены нужна блоку цикла (календарь, лунный диск): кладём её
    // персонажам и игроку скрытым полем — в JSON и в сравнения оно не попадает.
    const датаДляЦикла = (о) => { if (о && typeof о === 'object') { Object.defineProperty(о, '__датаСцены', { value: dRaw, configurable: true, writable: true, enumerable: false }); Object.defineProperty(о, '__времяСцены', { value: tRaw, configurable: true, writable: true, enumerable: false }); } };
    (Array.isArray(data.characters) ? data.characters : []).forEach(датаДляЦикла);
    датаДляЦикла(data.user);
    // День сюжета — для «Счёта дней» под именем (считаем, только когда он включён).
    if (настройка('dayCount') === 'on') {
      const день = деньСюжета(dRaw);
      [...(Array.isArray(data.characters) ? data.characters : []), data.user].forEach(о => { if (о && typeof о === 'object') Object.defineProperty(о, '__деньСюжета', { value: день, configurable: true, writable: true, enumerable: false }); });
    }
    // Соседи по сцене — для шанса зачатия у партнёра в «Модификаторах сцены».
    {
      const люди = [...(Array.isArray(data.characters) ? data.characters : []).map(c => ({ имя: c && c['Имя'], данные: c })),
        ...(data.user && typeof data.user === 'object' ? [{ имя: getSafeUserName(), данные: data.user }] : [])].filter(п => п.данные && typeof п.данные === 'object');
      люди.forEach(п => Object.defineProperty(п.данные, '__соседи', { value: люди, configurable: true, writable: true, enumerable: false }));
    }
    let phaseClass = 'phase-night';
    let phaseLow = (tRaw || '').toLowerCase();

    // Месяц сцены — прежде всего по дате. Нужен и сезону (ниже), и солнцу:
    // восход и закат зависят от месяца.
    const месяцИзДаты = (() => {
      const d = String(dRaw || '').toLowerCase();
      let m = d.match(/(?<!\d)(\d{1,2})[./](\d{1,2})[./]\d{2,4}(?!\d)/);
      if (m && +m[2] >= 1 && +m[2] <= 12) return +m[2];
      m = d.match(/(?<!\d)\d{4}-(\d{1,2})-\d{1,2}(?!\d)/);
      if (m && +m[1] >= 1 && +m[1] <= 12) return +m[1];
      const имена = [/январ|(?<![\p{L}])jan/u, /феврал|(?<![\p{L}])feb/u, /(?<![\p{L}])март|(?<![\p{L}])mar(?:ch)?(?![\p{L}])/u, /апрел|(?<![\p{L}])apr/u,
        /(?<![\p{L}])ма[йя](?![\p{L}])|(?<![\p{L}])may(?![\p{L}])/u, /июн|(?<![\p{L}])jun/u, /июл|(?<![\p{L}])jul/u, /август|(?<![\p{L}])aug/u,
        /сентябр|(?<![\p{L}])sep/u, /октябр|(?<![\p{L}])oct/u, /ноябр|(?<![\p{L}])nov/u, /декабр|(?<![\p{L}])dec/u];
      const i = имена.findIndex(rx => rx.test(d));
      return i >= 0 ? i + 1 : null;
    })();
    // Восход и закат по месяцу — средние широты (~50° с. ш.), в минутах от
    // полуночи. Раньше солнце всегда вставало в 6:00 и садилось в 20:00:
    // 15 января в 18:40 оно ещё висело над горизонтом. Без месяца — прежние
    // 6:00–20:00. Фазы суток считаются в долях светового дня, поэтому при
    // 6:00–20:00 границы совпадают с прежними: утро до 10:00, день до 17:00,
    // золотой час до 18:30, закат до 20:00, вечер до 22:00.
    const ВОСХОД = [480, 450, 400, 345, 300, 280, 290, 330, 375, 420, 460, 485];
    const ЗАКАТ  = [990, 1040, 1090, 1145, 1190, 1215, 1210, 1165, 1105, 1045, 990, 970];
    // Число месяца — нужно только для праздников: с 28 декабря по 13 января
    // во дворе стоит наряженная ёлка.
    const числоИзДаты = (() => {
      const d = String(dRaw || '').toLowerCase();
      let m = d.match(/(?<!\d)(\d{1,2})[./](\d{1,2})[./]\d{2,4}(?!\d)/);
      if (m && +m[1] >= 1 && +m[1] <= 31) return +m[1];
      m = d.match(/(?<!\d)\d{4}-\d{1,2}-(\d{1,2})(?!\d)/);
      if (m && +m[1] >= 1 && +m[1] <= 31) return +m[1];
      m = d.match(/(?<!\d)(\d{1,2})\s*(?:-?го)?\s+[\p{L}]{3,}/u);
      if (m && +m[1] >= 1 && +m[1] <= 31) return +m[1];
      return null;
    })();
    // Год — для Пасхи: её дата каждый год своя. Нет года — текущий.
    const годИзДаты = (() => {
      const d = String(dRaw || '');
      const m = d.match(/(?<!\d)\d{1,2}[./]\d{1,2}[./](\d{4})(?!\d)/) || d.match(/(?<!\d)(\d{4})-\d{1,2}-\d{1,2}(?!\d)/) || d.match(/(?<!\d)(\d{4})(?!\d)/);
      return m ? +m[1] : null;
    })();
    const новогодниеДни = !!месяцИзДаты && !!числоИзДаты
      && ((месяцИзДаты === 12 && числоИзДаты >= 28) || (месяцИзДаты === 1 && числоИзДаты <= 13));

    let DAY_START = месяцИзДаты ? ВОСХОД[месяцИзДаты - 1] : 360;
    let DAY_END = месяцИзДаты ? ЗАКАТ[месяцИзДаты - 1] : 1200;
    let DAY_LEN = DAY_END - DAY_START;

    // Часть суток словом («день», «вечер») — модель знает, где идёт сцена:
    // таблица восходов выше — для ~50° с. ш., а в тропиках в ноябре в 16:55
    // ещё светло. Если слово и часы спорят о том, над горизонтом ли солнце,
    // сначала берём обычные 6:00–20:00, а если и это не помогает — слово.
    const фазаСловом = (() => {
      if (/(?<![\p{L}])предрассвет|\bpredawn|\bdawn\b/u.test(phaseLow)) return 'phase-predawn';
      if (/(?<![\p{L}])утр|\bmorn/u.test(phaseLow)) return 'phase-morning';
      if (/(?<![\p{L}])(?:день|дн[ёе]м|полдень|полдн)(?![\p{L}])|\bday\b|\bnoon\b/u.test(phaseLow)) return 'phase-day';
      if (/(?<![\p{L}])золот|\bgolden\b/u.test(phaseLow)) return 'phase-golden';
      if (/(?<![\p{L}])(?:закат|солнц\p{L}*\s*за)|\bsunset/u.test(phaseLow)) return 'phase-sunset';
      if (/(?<![\p{L}])вечер|\beven|\bnightfall\b/u.test(phaseLow)) return 'phase-evening';
      if (/(?<![\p{L}])глубок\p{L}*\s*ноч|\bdeep\s*night\b/u.test(phaseLow)) return 'phase-deep-night';
      if (/(?<![\p{L}])ноч|\bnight\b/u.test(phaseLow)) return 'phase-night';
      return '';
    })();
    const солнцеВидно = (ф) => /phase-(?:morning|day|golden|sunset)/.test(ф);

    let hourMatch = tRaw.match(/(\d{1,2}):(\d{2})/);
    if (hourMatch) {
      const hour = parseInt(hourMatch[1], 10);
      const minute = parseInt(hourMatch[2], 10) || 0;
      const totalMinutes = hour * 60 + minute;
      const поЧасам = () => {
      if (totalMinutes < 120) phaseClass = 'phase-deep-night';
      else if (totalMinutes < DAY_START - 60) phaseClass = 'phase-night';
      else if (totalMinutes < DAY_START) phaseClass = 'phase-predawn';
      else if (totalMinutes < DAY_START + DAY_LEN * 0.286) phaseClass = 'phase-morning';
      else if (totalMinutes < DAY_START + DAY_LEN * 0.786) phaseClass = 'phase-day';
      else if (totalMinutes < DAY_START + DAY_LEN * 0.893) phaseClass = 'phase-golden';
      else if (totalMinutes < DAY_END) phaseClass = 'phase-sunset';
      else if (totalMinutes < DAY_END + 120) phaseClass = 'phase-evening';
      else phaseClass = 'phase-night';
      };
      поЧасам();
      if (фазаСловом && солнцеВидно(фазаСловом) !== солнцеВидно(phaseClass)) {
        DAY_START = 360; DAY_END = 1200; DAY_LEN = DAY_END - DAY_START;
        поЧасам();
        if (солнцеВидно(фазаСловом) !== солнцеВидно(phaseClass)) phaseClass = фазаСловом;
      }
    } else if (/(?<![\p{L}])предрассвет|\bpredawn|\bdawn\b/u.test(phaseLow)) phaseClass = 'phase-predawn';
    // Русские слова ищем с начала слова через (?<![\p{L}]): \b в JS знает только
    // латиницу, и «утро», «вечер», «ночь» без часов не распознавались.
    else if (/(?<![\p{L}])утр|\bmorn/u.test(phaseLow)) phaseClass = 'phase-morning';
    else if (/(?<![\p{L}])(?:день|дн[ёе]м|полдень|полдн)(?![\p{L}])|\bday\b|\bnoon\b/u.test(phaseLow)) phaseClass = 'phase-day';
    else if (/(?<![\p{L}])золот|\bgolden\b/u.test(phaseLow)) phaseClass = 'phase-golden';
    else if (/(?<![\p{L}])(?:закат|солнц\p{L}*\s*за)|\bsunset/u.test(phaseLow)) phaseClass = 'phase-sunset';
    else if (/(?<![\p{L}])вечер|\beven|\bnightfall\b/u.test(phaseLow)) phaseClass = 'phase-evening';
    else if (/(?<![\p{L}])глубок\p{L}*\s*ноч|\bdeep\s*night\b/u.test(phaseLow)) phaseClass = 'phase-deep-night';
    else if (/(?<![\p{L}])ноч|\bnight\b/u.test(phaseLow)) phaseClass = 'phase-night';

    let wClass = 'weather-clear', wLow = wRaw.toLowerCase(), wIntensity = '';
    // СИЛА явления — отдельная ось, общая для всей погоды: «сильный»
    // одинаково повышает и снегопад, и дождь, и ветер. Какое именно
    // явление идёт, решают списки ниже; сила только сдвигает уровень
    // внутри него. Раньше усилители были вписаны прямо в списки явлений,
    // и «сильная метель» подменялась метелью вместо того, чтобы стать
    // на ступень выше.
    // Слова ищем с начала слова: иначе «дик» ловился в «медике», «густ» —
    // в «августовском», «лют» — в «абсолютном», «лив» — в «заливе».
    const сНачала = (s) => new RegExp('(?<![\\p{L}])(?:' + s + ')', 'u');
    const wStrong = сНачала('сильн|мощн|свиреп|яростн|беш|лют|дик|жутк|страшн|густ|плотн|валит|стеной|обильн|интенсивн|непрогляд|heavy|strong|intense|fierce');
    const wWeak   = сНачала('слаб|лёгк|легк|небольш|редк|порош|мелк|изредка|чуть|перв|light|flurr');

    // Описание погоды — перечисление: «Сильный снегопад, −7°C, лёгкий ветер».
    // Модификатор относится к СВОЕЙ части, а не ко всей строке. Пока мы
    // искали усилители по всей фразе, «лёгкий ветер» делал лёгким снегопад,
    // а «сильный ветер» — усиливал его. Поэтому режем на части и каждую
    // смотрим отдельно.
    const wParts = wLow.split(/[,;.|]+|\s+[—–-]\s+/).map(s => s.trim()).filter(Boolean);
    const partsWith = re => wParts.filter(p => re.test(p));
    const anyOf = (parts, re) => parts.some(p => re.test(p));

    // ВЕТЕР — ещё одна независимая ось. Он не меняет само явление (снегопад
    // остаётся снегопадом), но подгоняет снег: тот же наклон и та же
    // плотность, только быстрее. Слабый ветер не подгоняет ничего, поэтому
    // «лёгкий ветер», «ветер утих», штиль и прямо указанная скорость до
    // 3 м/с сюда не попадают.
    const windRe   = сНачала('ветер|ветр|шквал|порыв|сквозняк|дует|wind|gust|squall|breeze');
    const windCalm = сНачала('слаб|лёгк|легк|тих|утих|стих|ул[её]гся|безветр|штил|едва|слегка|чуть|light|calm');
    const windHard = сНачала('сильн|шквал|штормов|порыв|ураган|бешен|рв[ёе]т|завыва|воет|гуд|strong|gust|squall|gale');
    const windParts = partsWith(windRe);
    let windSpeed = null;
    for (const part of windParts) {
      const m = part.match(/(\d+(?:[.,]\d+)?)\s*м\/?\s*с|(\d+(?:[.,]\d+)?)\s*m\/s/);
      if (m) { windSpeed = parseFloat((m[1] || m[2]).replace(',', '.')); break; }
    }
    let windClass = '';
    if (windParts.length && !anyOf(windParts, windCalm) && !(windSpeed !== null && windSpeed <= 3)) {
      windClass = (anyOf(windParts, windHard) || (windSpeed !== null && windSpeed >= 10))
        ? 'weather-windy-strong' : 'weather-windy';
    }
    
    // «штормовой ветер» — ветер, «snowstorm» — снег; грозой они не считаются.
    if (сНачала('гроз|молни|шторм(?!ов)|thunder|storm').test(wLow)) {
      wClass = 'weather-storm';
    } else if (сНачала('град(?!ус)|hail').test(wLow)) {
      wClass = 'weather-hail';
    } else if (сНачала('снег|снеж|snow|метел|вьюг|blizzard|буран|пург|мет[её]т|позёмк|поземк|порош|flurr').test(wLow)) {
      wClass = 'weather-snow';
      // «Метель» и «снежная буря» — разные по ощущению вещи, не синонимы:
      // метель — это ветер несёт снег, буря/буран — уже совсем плохая
      // видимость. Раньше оба слова ловились одним и тем же «бур», и
      // выглядели визуально одинаково.
      // Здесь две независимые вещи, и раньше они были свалены в одну.
      // ЯВЛЕНИЕ — что происходит: снегопад (снег валит сверху вниз) или
      // метель/буря (снег несёт ветром). СИЛА — насколько густо.
      // Слово «сильный» задаёт силу, а не явление, но стояло в одном ряду
      // с «метелью», из-за чего «сильный снегопад» и «сильная метель»
      // получали один и тот же класс и выглядели одинаково.
      // Теперь ветровые явления проверяются первыми и «сильн» их не
      // трогает, а густой снегопад получил собственный уровень: крупные
      // хлопья валят почти отвесно, без ветровой позёмки.
      // Силу снегопада берём только из тех частей, где вообще говорится о
      // снеге: иначе «лёгкий ветер» из соседней части опускает снегопад
      // до слабого.
      const snowRe = /снег|снеж|метел|вьюг|буран|пург|позёмк|поземк|порош|snow|blizzard|flurr/;
      const snowParts = partsWith(snowRe);
      const sp = snowParts.length ? snowParts : wParts;
      const snowStrong = anyOf(sp, wStrong), snowWeak = anyOf(sp, wWeak);
      if (wLow.match(/буря|буран|пург|snowstorm|whiteout|белая мгла/)) {
        wIntensity = 'weather-intensity-extreme';
      } else if (wLow.match(/метел|вьюг|мет[её]т|позёмк|поземк|заряд|blizzard/)) {
        // Ветровой снег. Усилитель поднимает метель на одну ступень — до
        // сильной метели, но НЕ до бури: буря это отдельное явление со
        // своей подписью (горизонтальные штрихи и белая мгла), и если
        // отдавать её сильной метели, обе снова выглядят одинаково.
        wIntensity = snowStrong ? 'weather-intensity-gale' : 'weather-intensity-high';
      } else if (snowWeak) {
        wIntensity = 'weather-intensity-low';
      } else if (snowStrong) {
        // Снег валит сверху вниз, ветра нет — густой снегопад, не метель.
        wIntensity = 'weather-intensity-heavy';
      }
    } else if (сНачала('дожд|лив|проливн|rain|shower|морос|drizzle').test(wLow.replace(/после\s+дожд\p{L}*|дожд\p{L}*\s+(?:прош|законч|стих|кончил|перестал)\p{L}*|after\s+(?:the\s+)?rain/giu, ' '))) {
      wClass = 'weather-rain';
      // Сила дождя — только из частей про дождь, как у снега: «сильный ветер,
      // мелкий дождь» раньше давал ливень из-за чужого «сильный».
      const rainParts = partsWith(сНачала('дожд|лив|проливн|rain|shower|морос|drizzle'));
      const rp = rainParts.length ? rainParts : wParts;
      if (anyOf(rp, сНачала('лив|проливн')) || anyOf(rp, wStrong)) wIntensity = 'weather-intensity-high';
      else if (anyOf(rp, сНачала('морос|drizzle')) || anyOf(rp, wWeak)) wIntensity = 'weather-intensity-low';
    } else if (wLow.match(/облач|пасмур|cloud|overcast/)) {
      wClass = 'weather-cloudy';
    } else if (сНачала('ветер|ветр|шквал|wind|squall|ураган|бур').test(wLow)) {
      wClass = 'weather-wind';
      // «Шквалистый» и «шквал» раньше не ловились ни здесь, ни в силе:
      // фраза попадала в ветер только из-за слова «ветер» и оставалась
      // обычной, поэтому шквалистый ветер выглядел как штиль.
      const wp = windParts.length ? windParts : wParts;
      if (anyOf(wp, сНачала('штормов|шквал|порыв|ураган|бур|gust|squall')) || anyOf(wp, wStrong)) wIntensity = 'weather-intensity-high';
    } else if (сНачала('туман|fog|дымк').test(wLow)) {
      wClass = 'weather-fog';
    } else if (сНачала('ясн|солнеч|clear|sunny').test(wLow)) {
      wClass = 'weather-clear';
    }

    // Температура — число при «°» или «градус»; первое число строки могло
    // оказаться скоростью ветра («ветер 5 м/с, +20°C»).
    let tempClass = '', freezeClass = '', tempMatch = wRaw.match(/([-+\u2212]?\d+)(?:[.,]\d+)?\s*(?:°|℃|градус)/i) || wRaw.match(/([-+\u2212]?\d+)/);
    if (tempMatch) {
      let tempStr = tempMatch[1].replace('\u2212', '-');
      let tempVal = parseInt(tempStr, 10);
      if (tempVal <= 0) tempClass = 'temp-cold';
      if (tempVal <= -10) freezeClass = 'temp-freezing'; 
      if (tempVal >= 20) tempClass = 'temp-hot temp-drops'; 
    }

    let seasonClass = '';
    // Сезон — прежде всего по месяцу в дате. Слова погоды («шум майского
    // ливня» при дате 01.06) раньше перебивали месяц, и летняя сцена
    // рисовалась весенней. По словам решаем, только если месяца в дате нет.
    // Месяц (месяцИзДаты) определён выше — вместе с восходом и закатом.
    if (месяцИзДаты) seasonClass = ['season-winter', 'season-winter', 'season-spring', 'season-spring', 'season-spring', 'season-summer',
      'season-summer', 'season-summer', 'season-autumn', 'season-autumn', 'season-autumn', 'season-winter'][месяцИзДаты - 1];
    let dLow = (dRaw + ' ' + wRaw + ' ' + tRaw).toLowerCase(); 
    if (seasonClass) { /* сезон уже взят из даты */ }
    else if (dLow.match(/зим|декабр|январ|феврал|dec|jan|feb|\.12\.|\.01\.|\.02\.|снег|снеж|метел|вьюг|мороз|буран/)) seasonClass = 'season-winter';
    // «мая» — родительный падеж, в датах он почти всегда: «3 мая». Раньше
    // искали только «май», и весь май оставался без пейзажа.
    else if (dLow.match(/весн|март|апрел|ма[йя]|mar|apr|may|\.03\.|\.04\.|\.05\./)) seasonClass = 'season-spring';
    // «Лето» — отдельным словом: голое «лет» ловило «20 лет», «полетели».
    else if (dLow.match(/(?:^|[^а-яё])лет(?:о|а|ом|е|н)|июн|июл|август|jun|jul|aug|\.06\.|\.07\.|\.08\./)) seasonClass = 'season-summer';
    else if (dLow.match(/осен|сентябр|октябр|ноябр|sep|oct|nov|\.09\.|\.10\.|\.11\./)) seasonClass = 'season-autumn';

    // Пыль: жаркий летний ветер — или прямо названная пыльная/песчаная буря,
    // самум, суховей (раньше они рисовались обычным ветром при любом сезоне).
    let dustyClass = (сНачала('песчан|пыльн|пыль|sand|dust|самум|хамсин|сирокко|суховей').test(wLow)
      || (tempClass.split(' ').includes('temp-hot') && seasonClass === 'season-summer' && (wClass === 'weather-clear' || wClass === 'weather-wind'))) ? 'weather-dusty' : '';
    const prevWeather = previousMessageWeather();
    // Радуга: дождь закончился — по прошлому ходу или прямо по словам погоды
    // («после дождя», «дождь прошёл», «слепой дождь», «проясняется»).
    const послеДождя = /после\s+дожд|дожд\p{L}*\s+(?:прош|законч|стих|кончил)|слеп\p{L}*\s+дожд|проясня|радуг|after\s+(?:the\s+)?rain|rainbow/iu.test(String(wRaw || ''));
    let rainbowClass = ((wClass === 'weather-clear' || wClass === 'weather-cloudy') && (prevWeather === 'weather-rain' || prevWeather === 'weather-storm' || послеДождя)
      || (послеДождя && wClass !== 'weather-storm')) ? 'weather-rainbow' : '';
    // Месяц — для весны: март, апрель и май выглядят по-разному (проталины,
    // цветение, сирень и пух). Конец месяца — с 20-го числа.
    const monthClass = месяцИзДаты ? `month-${месяцИзДаты}${числоИзДаты && числоИзДаты >= 20 ? ' month-late' : ''}` : '';
    // Мокрая земля: дождь идёт сейчас либо шёл в прошлом сообщении. Лужа
    // держится ровно один ход и высыхает — отсюда и «после дождя».
    const isWet = (w) => w === 'weather-rain' || w === 'weather-storm';
    const wetClass = (isWet(wClass) || isWet(prevWeather) || послеДождя) ? 'scene-wet' : '';
    if (wRaw) {
      lastSceneWeather = wClass;
      if (renderTargetMes) renderTargetMes.dataset.hudWeather = wClass;
    }

    let dewActive = phaseClass === 'phase-morning' && (wClass === 'weather-clear' || wClass === 'weather-cloudy') && (seasonClass === 'season-spring' || seasonClass === 'season-summer');

    let celestialStyle = '', sunVarsStyle = '', sceneStyle = '';
    if (hourMatch) {
      let hh = parseInt(hourMatch[1], 10), mmMatch = tRaw.match(/\d{1,2}:(\d{2})/), mm = mmMatch ? parseInt(mmMatch[1], 10) : 0, minutesOfDay = hh * 60 + mm;
      // DAY_START и DAY_END — восход и закат этого месяца (см. выше).
      let p, cx, cy;
      if (minutesOfDay >= DAY_START && minutesOfDay <= DAY_END) p = (minutesOfDay - DAY_START) / (DAY_END - DAY_START);
      else p = (minutesOfDay > DAY_END ? (minutesOfDay - DAY_END) : (minutesOfDay + (1440 - DAY_END))) / (1440 - (DAY_END - DAY_START));
      cx = 6 + p * 84; cy = 76 - Math.sin(p * Math.PI) * 60;
      const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
      const smoothStep = (value, edge0, edge1) => {
        if (value <= edge0) return 0;
        if (value >= edge1) return 1;
        return (value - edge0) / (edge1 - edge0);
      };
      // Ночь уходит к 08:00 и приходит с 19:30 до 22:00. Раньше вечерняя
      // граница шла до полуночи: в 21:00 (фаза «вечер», тёмное небо) сила
      // ночи была 0.25, и море с песком оставались дневными. А утром в 07:00
      // она была 0.67 — вода темнела под светлым утренним небом.
      // Все границы — от восхода и заката месяца; при 6:00–20:00 они те же,
      // что были в часах: ночь 5:00–8:00 и 19:30–22:00, золото в 17:00,
      // закат в 18:00, звёзды гаснут к 12:00 и зажигаются с 20:00.
      const nightStrength = clamp(1 - smoothStep(minutesOfDay, DAY_START - 60, DAY_START + 120) + smoothStep(minutesOfDay, DAY_END - 30, DAY_END + 120), 0, 1);
      const goldenStrength = clamp(1 - Math.abs(minutesOfDay - (DAY_END - 180)) / 90, 0, 1);
      const sunsetStrength = clamp(1 - Math.abs(minutesOfDay - (DAY_END - 120)) / 90, 0, 1);
      const starStrength = clamp(1 - smoothStep(minutesOfDay, DAY_START - 30, DAY_START + 360) + smoothStep(minutesOfDay, DAY_END, DAY_END + 240), 0, 1);

      // Светило всегда ЗА пейзажем, на любой высоте. Небесное тело физически
      // дальше любого дерева, поэтому пересечение должно его скрывать, а не
      // наоборот. Раньше слой переключался только у горизонта (cy > 62), и
      // днём солнце рисовалось поверх крон.
      // На телефоне плашки стоят столбиком по центру, и светило посреди неба
      // всегда пряталось за часами. Там оно идёт по боковым полосам: до
      // полудня слева (8–16%), после — справа (84–92%). Шире нельзя: у края
      // полосы светило уходит за рамку сцены, у середины — под часы.
      const cxm = cx < 50 ? 8 + (cx - 6) / 44 * 8 : 84 + (cx - 50) / 40 * 8;
      celestialStyle = ` style="--cel-x:${cx.toFixed(1)}%;--cel-xm:${cxm.toFixed(1)}%;--cel-y:${cy.toFixed(1)}%;--cel-layer:1;--scene-layer:2;"`;
      sunVarsStyle = ` style="--sun-h:${p.toFixed(3)};--sun-alt:${Math.max(0, Math.sin(p * Math.PI)).toFixed(3)};"`;
      // --cel-x/--cel-y дублируем на виджет: лунная дорожка и солнечные блики
      // на воде — потомки .hud-fx-season-scene, а не светила, и до его
      // собственных переменных не дотягиваются.
      // --cel-xm (положение светила на телефоне) тоже здесь: по нему на
      // телефоне идут лунная дорожка и блики на воде.
      sceneStyle = ` style="--cel-x:${cx.toFixed(1)}%;--cel-xm:${cxm.toFixed(1)}%;--cel-y:${cy.toFixed(1)}%;--scene-day-progress:${p.toFixed(3)};--scene-night-strength:${nightStrength.toFixed(3)};--scene-golden-strength:${goldenStrength.toFixed(3)};--scene-sunset-strength:${sunsetStrength.toFixed(3)};--scene-star-strength:${starStrength.toFixed(3)};"`;
    }

    // Фаза луны по игровой дате: тёмный серп на луне в небе сцены.
    {
      const тень = теньЛуны(dRaw);
      if (тень) sceneStyle = sceneStyle ? sceneStyle.replace(/"$/, тень + '"') : ` style="${тень}"`;
    }

    if (Object.keys(data.scene).length > 0) {
      let subTags = [];
      // «empty» в свёрнутой шапке — не значение: пустые поля не показываем.
      if (hudHasMeaningfulValue(tRaw)) subTags.push(`<span class="hud-preview-tag">🕒 ${escapeHtml(tRaw.split('|')[0].trim())}</span>`);
      if (hudHasMeaningfulValue(wRaw)) subTags.push(`<span class="hud-preview-tag">🌤️ ${escapeHtml(wRaw)}</span>`);
      if (hudHasMeaningfulValue(dRaw)) subTags.push(`<span class="hud-preview-tag">📅 ${escapeHtml(dRaw)}</span>`);
      osSubtitleHtml = `<div class="hud-os-subtitle">${subTags.join('')}</div>`;
    }

    // МЕГА-ПАНЕЛЬ НАСТРОЕК С НОВЫМИ ШРИФТАМИ И ВЕРТИКАЛЬНОЙ СЕТКОЙ
    // Строка «дата · время» для шапок персонажей (газета, журнал, баннер):
    // переменная карточки, её читает content: var(--hud-dateline) в CSS.
    const строкаДаты = [hudHasMeaningfulValue(dRaw) ? dRaw : '', hudHasMeaningfulValue(tRaw) ? String(tRaw).split('|')[0].trim() : ''].filter(Boolean).join(' · ').replace(/[\\'"<>\n]/g, ' ');
    let html = `<div class="hud-os-card no-swipe"${строкаДаты ? ` style="--hud-dateline:'${строкаДаты}'"` : ''}>
      <input type="checkbox" class="hud-toggle-input" id="os-toggle-${baseId}">
      <label class="hud-os-topbar" for="os-toggle-${baseId}">
        <div class="hud-os-topbar-left"><span class="hud-os-logo">TavernOS</span>${osSubtitleHtml}</div>
        <div class="hud-os-topbar-right">
            ${settings.tokenBudget !== 'off' ? '<span class="hud-budget-chip" role="button" tabindex="0" aria-expanded="false" title="Сколько HUD стоит токенов: нажмите — разбивка по блокам">≈…</span>' : ''}
            ${settings.enableAssistant !== false ? '<span class="hud-ask-btn" role="button" tabindex="0" title="Спросить про сюжет: модель ответит по HUD и последним сообщениям, в чат ничего не попадёт">❓</span>' : ''}
            <span class="hud-regen-btn" title="Перегенерировать только HUD">🔄</span>
            <span class="hud-toggle-indicator">▼</span>
        </div>
      </label>
      <div class="hud-os-wrapper">`;

    if (Object.keys(data.scene).length > 0) {
      let tParts = tRaw.split('|').map(s => s.trim());
      let timeHHMM = tParts[0] || '--:--';
      let timePhase = tParts.length > 1 ? tParts[1].toUpperCase() : '';
      let timeDisplay = escapeHtml(timeHHMM).replace(':', '<span class="hud-time-colon">:</span>');
       
      let dateStr = escapeHtml(dRaw);
      if (dateStr && timePhase) dateStr += ` • ${timePhase}`;
      else if (!dateStr && timePhase) dateStr = timePhase;

      // Схема подставляет 'empty' всему, чего модель не прислала: такое
      // значение — не текст, плашку с ним не показываем.
      let atmStr = hudHasMeaningfulValue(data.scene['Атмосфера']) ? `«${escapeHtml(data.scene['Атмосфера'])}»` : '';

      let stars = '';
      const starDot = (cls, l, t, sz, dur, delay) => `<span class="hud-star2 dot ${cls}" style="left:${l}%;top:${t}%;width:${sz}px;height:${sz}px;animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
      const starDiamond = (cls, l, t, sz, dur, delay) => `<span class="hud-star2 diamond ${cls}" style="left:${l}%;top:${t}%;width:${sz}px;height:${sz}px;animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
      stars += starDot('', 12, 22, 2, 2.2, 0);
      stars += starDiamond('', 24, 12, 3, 2.6, 0.4);
      stars += starDot('', 38, 30, 2, 1.9, 0.9);
      stars += starDot('', 50, 10, 2.4, 2.4, 0.2);
      stars += starDiamond('', 62, 26, 3, 3, 1.2);
      stars += starDot('', 74, 14, 2, 2.1, 0.6);
      stars += starDot('', 84, 32, 2.6, 2.8, 1.5);
      stars += starDiamond('', 92, 20, 2.5, 2.3, 0.3);
      stars += starDot('', 6, 38, 1.8, 2, 1.8);

      let fireflies = '';
      for (let i = 1; i <= 6; i++) fireflies += `<span class="hud-firefly ff${i}"></span>`;

      // Погоду можно свернуть в строку «время · дата · погода». Выбор помнится
      // на устройстве и действует на все карточки, поэтому читаем его при сборке.
      let сценаСвёрнута = false;
      try { сценаСвёрнута = localStorage.getItem('hud-scene-compact') === '1'; } catch (e) { /* хранилище недоступно */ }
      html += `
      <div class="hud-scene-widget ${phaseClass} ${wClass} ${wIntensity} ${windClass} ${tempClass} ${freezeClass} ${seasonClass} ${dustyClass} ${rainbowClass} ${wetClass} ${monthClass}${settings.era === 'medieval' ? ' era-medieval' : ''}${сценаСвёрнута ? ' is-compact' : ''}"${sceneStyle} title="Нажмите для анимации">
        <div class="hud-fx-bg"></div>
        <div class="hud-fx-stars">${stars}</div>
        <div class="hud-fx-fireflies">${fireflies}</div>
        <div class="hud-fx-storm-flash"></div>
        <div class="hud-fx-lightning">${buildLightningSvg()}</div>
        <div class="hud-fx-rainbow"></div>
        <div class="hud-fx-celestial"${celestialStyle}></div>
        <div class="hud-fx-cloud-cover"></div>
        <div class="hud-fx-season-scene"${sunVarsStyle}>${buildSeasonSceneHtml(seasonClass, { dew: dewActive, deepFreeze: !!freezeClass, month: месяцИзДаты, day: числоИзДаты,
          ...праздникиСцены({ число: числоИзДаты, месяц: месяцИзДаты, год: годИзДаты, ночь: /phase-(?:evening|night|deep-night|predawn)/.test(phaseClass) }), newYear: новогодниеДни })}</div>
        <div class="hud-fx-weather"><span class="hud-snow-layer snow-far"></span><span class="hud-snow-layer snow-mid"></span><span class="hud-snow-layer snow-near"></span></div>
        <div class="hud-fx-frost"></div>
        <div class="hud-fx-temp"></div>
        <div class="hud-fx-daylight"></div>
        <div class="hud-fx-overlay"></div>
        <div class="hud-scene-top">
          <div class="hud-scene-time-group">
            <div class="hud-time-display">${timeDisplay}</div>
            ${dateStr ? `<div class="hud-date-display">${dateStr}</div>` : ''}
          </div>
          ${чипЛуны(dRaw)}
          <div class="hud-scene-weather-group">
            ${hudHasMeaningfulValue(data.scene['Погода']) ? `<div class="hud-weather-item">${escapeHtml(data.scene['Погода'])}</div>` : ''}
            ${hudHasMeaningfulValue(data.scene['Настроение']) ? `<div class="hud-mood-item">${escapeHtml(data.scene['Настроение'])}</div>` : ''}
          </div>
        </div>
        ${atmStr ? `<div class="hud-scene-atm">${atmStr}</div>` : ''}
        <div class="hud-fx-clouds" aria-hidden="true"><span class="hud-rain-cloud rc-back"></span><span class="hud-rain-cloud rc-front"></span></div>
        <button type="button" class="hud-scene-fold" title="${сценаСвёрнута ? 'Развернуть погоду' : 'Свернуть погоду'}" aria-label="${сценаСвёрнута ? 'Развернуть погоду' : 'Свернуть погоду'}" aria-expanded="${сценаСвёрнута ? 'false' : 'true'}"><i aria-hidden="true"></i></button>
      </div>`;
    }
     
    // Поворот сюжета — над вкладками: он про всю сцену, а не про одного.
    html += карточкаПоворота(data.scene && data.scene['Поворот сюжета']);
    html += `<div class="hud-tabs-header" role="tablist" aria-label="Вкладки HUD">`;

    let tabsHtml = '', contentHtml = '';

    // Складываем сюда способ собрать каждую отложенную вкладку. Объект уедет
    // на элемент карточки сразу после вставки разметки в сообщение.
    const lazyThunks = Object.create(null);
    const lazyOn = settings.lazyTabs !== false;

    // Единая точка добавления вкладки. build(active) отдаёт готовый блок
    // .hud-tab-content с нужным id; открытую вкладку строим сразу, остальные
    // откладываем и ставим пустышку с тем же id.
    // Имена карточек с приставкой («THE REGENTS  Tristan Kingsley») в тексте
    // вкладок — без неё, как в шапке.
    const сПриставкой = [...new Set([(getStContextSafe() || {}).name2, ...(Array.isArray(data.characters) ? data.characters.map(c => c && c['Имя']) : [])]
      .filter(н => typeof н === 'string' && н.trim() && имяБезПриставки(н) !== н.trim()))];
    const чисто = (h) => сПриставкой.reduce((acc, н) => убратьПриставкуКарточки(acc, н), h);
    // Сперва только собираем: порядок, скрытые и закреплённые вкладки
    // (tabs-order.js, настройки tabOrder / tabHidden / tabPinned) применяются
    // ниже, перед выводом. id стабильный: у всех персонажей один — 'character'.
    const вкладки = [];
    const addTab = (id, cls, ярлык, uid, build) => { вкладки.push({ id, cls, ярлык, uid, build }); };

    data.characters.forEach((char, index) => {
      const uid = `char-${index}-${baseId}`;
      const name = char['Имя'] || `NPC ${index+1}`;
      addTab('character', '', `👤 ${escapeHtml(имяДляВкладки(name))}${значокСправки('character')}`,
        uid, (active) => buildCharacterHTML(char, uid, active, index === 0));
    });

    // Сводка «что о тебе думают» идёт во вкладку игрока, а без неё — в память.
    let сводкаУИгрока = false;
    if (settings.enableUserBlock && data.user && Object.keys(data.user).length > 0) {
      const uid = `user-${baseId}`;
      // Блок игрока может оказаться пустым — узнаём это только собрав его,
      // поэтому строим сразу и откладываем уже готовую строку.
      const userTabHtml = buildUserHTML(data.user, uid, false, data.characters);
      if (userTabHtml) {
        сводкаУИгрока = true;
        const personaName = getSafeUserName();
        addTab('user', 'hud-user-tab', `👤 ${escapeHtml(имяДляВкладки(personaName))}${значокСправки('user')}`,
          uid, (active) => buildUserHTML(data.user, uid, active, data.characters));
      }
    }

    // Бой (render/combat.js): вкладка только при живом cb; срез хода, не копится.
    if (settings.enableCombat !== false && hudHasCombat(data.combat)) {
      const uid = `combat-${baseId}`;
      addTab('combat', 'hud-combat-tab', `⚔️ Бой${значокСправки('combat')}`, uid, (active) => {
        // Отходняк считаем по времени сюжета: сколько минут прошло с хода,
        // где бой стал «кончено»; события погони — из прошлых ходов.
        const главный = Array.isArray(data.characters) ? data.characters[0] : null;
        let история = [];
        try { история = главный && typeof главный.__hudИстория === 'function' ? главный.__hudИстория() : []; } catch (_) { история = []; }
        const сейчас = главный && typeof главный.__hudМомент === 'function' ? главный.__hudМомент() : null;
        let конченоС = сейчас;
        for (const х of история) { const cb = х.ход && х.ход.combat; if (!cb || !/кончен|закончен|over/i.test(String(cb.st || '')) || !х.момент) break; конченоС = х.момент; }
        const событияПогони = история.map(х => х.ход && х.ход.combat && х.ход.combat.ch).filter(Boolean)
          .map(ch => ({ д: parseFloat((String(ch).match(/dst\s*:\s*(\d{1,3})/i) || [])[1]), текст: (String(ch).match(/evt\s*:\s*([^;]+)/i) || [])[1] || '' }))
          .filter(е => Number.isFinite(е.д) && е.текст).slice(0, 8);
        let заживление = [];
        try { заживление = прогнозыЗаживления([...история.map(х => ({ момент: х.момент, ход: х.ход })), { момент: сейчас, ход: data }], сейчас); } catch (_) { заживление = []; }
        return buildCombatHTML(data.combat, data, uid, active, { конченоМинут: сейчас && конченоС ? (сейчас - конченоС) / 60000 : null, событияПогони, заживление });
      });
    }

    if (settings.enableBabies !== false && hudHasBabies(data.babies)) {
      const uid = `babies-${baseId}`;
      addTab('babies', 'hud-kids-tab', `🍼 Детская`,
        uid, (active) => buildBabiesHTML(data.babies, uid, active, data.scene || {}));
    }

    // Средневековье: шкатулка на месте телефона.
    if (средневековье && settings.enableCasket !== false && hudHasCasket(data.satchel, data.letters)) {
      const uid = `casket-${baseId}`;
      addTab('casket', '', `🗝️ Шкатулка${значокСправки('casket')}`,
        uid, (active) => buildCasketHTML(data.satchel, data.letters, uid, active, (Array.isArray(data.characters) && data.characters[0] && data.characters[0]['Имя']) || getMainProtagonistNames().char, data.scene && data.scene['Дата'], data.characters));
    }

    if (hasPhone) {
      const uid = `phone-${baseId}`;
      addTab('phone', '', `📱 Телефон${значокСправки('phone')}`,
        // Последний запасной владелец телефона — персонаж, а не персона игрока:
        // телефон по схеме всегда принадлежит персонажу.
        uid, (active) => buildPhoneTabsHTML(data.chatsMap, uid, active, (Array.isArray(data.characters) && data.characters[0] && data.characters[0]['Имя']) || getMainProtagonistNames().char, data.phone, data.scene && data.scene['Дата'], tRaw, data.characters, { scene: data.scene, world: data.world }));
    }

    // === ВСТАВЛЯЕМ ВКЛАДКУ ПАМЯТИ СЮДА ===
    if (settings.enableMemory && hasMemory) {
      const uid = `memory-${baseId}`;
      addTab('memory', '', `🧠 Память${значокСправки('memory')}`, uid, (active) => {
        try {
          const сводка = !сводкаУИгрока && settings.enablePerception !== false ? buildPerceptionHTML(data.characters) : '';
          return buildMemoryHTML(data.memory || {}, uid, active, data, { perception: сводка });
        } catch (e) {
          console.error('[TavernOS HUD] Memory renderer failed; keeping later tabs available:', e);
          return `<div class="hud-tab-content ${active ? 'active' : ''}" id="content-${uid}"><div class="hud-memory-error">🧠 Не удалось отобразить один из блоков памяти. Остальные вкладки HUD доступны.</div></div>`;
        }
      });
    }


    // Быт (render/life.js): журнал по прошлым ходам. Считается лениво, по
    // открытию вкладки, — иначе каждая из полусотни карточек чата прошла бы
    // по сотням ходов. Без ленивых вкладок — только у последнего ответа.
    // Пример «Кастомизации» сообщения в чате не имеет — быт по одному его ходу.
    if (settings.enableLife !== false) {
      const индексБыта = renderTargetMes ? Number(renderTargetMes.getAttribute('mesid')) : NaN;
      const чатБыта = getStContextSafe()?.chat;
      const пример = !renderTargetMes;
      const последний = Array.isArray(чатБыта) && индексБыта >= чатБыта.length - 2;
      if (пример || (Number.isInteger(индексБыта) && Array.isArray(чатБыта) && (lazyOn || последний))) {
        const uid = `life-${baseId}`;
        addTab('life', '', `🧺 Быт${значокСправки('life')}`, uid, (active) => {
          try {
            const ж = пример ? журналБыта(null, 0, [...(Array.isArray(data.__hudБытПрошлое) ? data.__hudБытПрошлое : []), data]) : журналБыта(чатБыта, индексБыта + 1);
            return естьБыт(ж) ? buildLifeHTML(ж, uid, active)
              : `<div class="hud-tab-content ${active ? 'active' : ''}" id="content-${uid}"><div class="hud-body hud-life"><p class="hud-life-empty">Пока нечего показать: быт копится из таймлайна, сытости и сна, одежды и кошелька за прошлые ходы.</p></div></div>`;
          } catch (e) {
            console.error('[TavernOS HUD] Быт не собрался:', e);
            return `<div class="hud-tab-content ${active ? 'active' : ''}" id="content-${uid}"><div class="hud-memory-error">🧺 Быт не собрался: ${escapeHtml(e && e.message || String(e))}</div></div>`;
          }
        });
      }
    }

    // Preserve the original visibility contract: a top-level tab appears only
    // when its section actually contains renderable data. Values such as
    // "empty", "none" and "пусто" must not create an otherwise blank tab.
    if (средневековье && settings.enableOverheard !== false && hudHasMeaningfulOverheard(data.overheard)) {
      const uid = `overheard-${baseId}`;
      addTab('overheard', 'intercept-tab', `👂 Подслушанное${значокСправки('overheard')}`,
        uid, (active) => buildOverheardHTML(data.overheard, uid, active));
    }

    if (!средневековье && hudHasMeaningfulIntercepts(data.intercepts) && settings.enableIntercepts) {
      const uid = `intercept-${baseId}`;
      addTab('intercepts', 'intercept-tab', `📡 Перехваты${значокСправки('intercepts')}`,
        uid, (active) => buildInterceptsHTML(data.intercepts, uid, active, data.scene && data.scene['Дата']));
    }

    if (hudHasMeaningfulDiary(data.diary) && settings.enableDiary) {
      const uid = `diary-${baseId}`;
      addTab('diary', '', `📖 Дневник${значокСправки('diary')}`,
        uid, (active) => buildDiaryHTML(data.diary, uid, active));
    }

    // Дневник тела появляется сам, когда в нём есть записи: модель пишет их
    // только во время близости и сразу после, вне сцены вкладки просто нет.
    if (hudHasMeaningfulBodyDiary(data.bodyDiary) && settings.enableDiary) {
      const uid = `bodydiary-${baseId}`;
      addTab('bodydiary', 'hud-body-tab', `🕯 Дневник тела${значокСправки('bodyDiary')}`,
        uid, (active) => buildBodyDiaryHTML(data.bodyDiary, uid, active));
    }

    if (hudHasMeaningfulDreams(data.dreams) && settings.enableDreams) {
      const uid = `dream-${baseId}`;
      addTab('dreams', '', `🌙 Сны${значокСправки('dreams')}`,
        uid, (active) => buildDreamHTML(data.dreams, uid, active));
    }

    if (settings.enableCompanions !== false && hudHasMeaningfulCompanions(data.companions)) {
      const uid = `pets-${baseId}`;
      addTab('pets', '', `🐾 Спутники`,
        uid, (active) => buildCompanionsHTML(data.companions, uid, active));
    }

    if (hudHasMeaningfulWorld(data.world) && settings.enableWorld) {
      const uid = `world-${baseId}`;
      addTab('world', '', `🌍 Мир${значокСправки('world')}`,
        uid, (active) => buildWorldHTML(data.world, uid, active, settings.showComments));
    }

    const персонажи = Array.isArray(data.characters) ? data.characters : [];
    const титры = титрыСцены({ имена: персонажи.map(c => c && c['Имя']), место: (персонажи[0] || {})['Место'] || '', время: hudHasMeaningfulValue(tRaw) ? String(tRaw).split('|')[0].trim() : '', дата: hudHasMeaningfulValue(dRaw) ? dRaw : '', игрок: data.user && Object.keys(data.user).length ? getSafeUserName() : '' });
    // Порядок и скрытие — из настроек; активна первая из видимых.
    const панель = (h) => String(h || '').replace(/<div(\s+class="hud-tab-content)/, '<div role="tabpanel"$1');
    упорядочитьВкладки(вкладки, settings).forEach((т, i) => {
      const активна = i === 0;
      tabsHtml += `<div class="hud-tab${т.cls ? ' ' + т.cls : ''}${активна ? ' active' : ''}" role="tab" tabindex="${активна ? 0 : -1}" aria-selected="${активна}" aria-controls="content-${т.uid}" data-tab-id="${т.id}" data-target="content-${т.uid}">${т.ярлык}</div>`;
      if (активна || !lazyOn) {
        contentHtml += панель(чисто(т.build(активна)));
      } else {
        lazyThunks['content-' + т.uid] = () => панель(чисто(т.build(false)));
        contentHtml += `<div class="hud-tab-content hud-tab-lazy" role="tabpanel" id="content-${т.uid}"></div>`;
      }
    });
    html += tabsHtml + `</div><div class="hud-tab-hint" hidden></div><div class="hud-tabs-body">` + contentHtml + `</div>` + титры + `</div></div>`;
    // Заберёт processMessage сразу после вставки разметки: см. lastLazyThunks.
    lastLazyThunks = Object.keys(lazyThunks).length ? lazyThunks : null;
    return html;
  }

  function freezeOldHUDs() {
    const scope = cachedChatContainer || document;
    // Живой просмотр в панели тем — такая же карточка по разметке, но не
    // сообщение. Если считать и её, настоящая карточка перестаёт быть
    // последней и каждый раз сворачивается как «старая».
    const allCards = Array.from(scope.querySelectorAll('.hud-os-card'))
      .filter(card => !card.closest('.hud-theme-preview'));
    if (allCards.length > 0) {
      for (let i = 0; i < allCards.length - 1; i++) {
        if (allCards[i].dataset.userExpanded === 'true') continue; // пользователь сам раскрыл — не трогаем
        if (!allCards[i].classList.contains('hud-historical')) {
          allCards[i].classList.add('hud-historical');
          const checkbox = allCards[i].querySelector('.hud-toggle-input');
          if (checkbox) checkbox.checked = false; 
        }
      }
      const текущая = allCards[allCards.length - 1];
      текущая.classList.remove('hud-historical');
      // Карточка снова стала последней (например, удалили ответ) — ей нужно
      // всё содержимое.
      вернутьКарточку(текущая);
    }
    запланироватьОблегчение();
  }

  // Облегчаем не сразу: сразу после сборки на карточку ещё возвращают
  // открытую вкладку и навешивают пояснения — им нужно содержимое на месте.
  // Одна отложенная пачка на все карточки, в свободную минуту браузера.
  let облегчениеТаймер = 0;
  function запланироватьОблегчение() {
    if (settings.lightenOldCards === false) return;
    clearTimeout(облегчениеТаймер);
    облегчениеТаймер = setTimeout(() => {
      const пачка = () => {
        const scope = cachedChatContainer || document;
        scope.querySelectorAll('.hud-os-card.hud-historical').forEach(облегчитьКарточку);
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(пачка, { timeout: 2000 });
      else пачка();
    }, 1500);
  }

  function maybeInjectMissingHudButton(messageElement, textElement) {
    if (messageElement.getAttribute('is_user') === 'true') return;
    if (messageElement.getAttribute('is_system') === 'true') return;

    if (textElement.querySelector('.hud-missing-placeholder')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'hud-missing-placeholder';
    wrapper.innerHTML = `<span class="hud-regen-btn hud-create-btn" title="В этом сообщении нет HUD-блока — сгенерировать и вшить с нуля">➕ Создать HUD</span>`;
    textElement.appendChild(wrapper);
    bindHudRegenButton(wrapper.querySelector('.hud-create-btn'));
  }

  function getHudChatContextSafe() {
    try {
      if (typeof window.SillyTavern !== 'undefined' && typeof window.SillyTavern.getContext === 'function') {
        return window.SillyTavern.getContext();
      }
      if (typeof getContext === 'function') return getContext();
      if (typeof window.getContext === 'function') return window.getContext();
    } catch (e) {
      console.debug('[TavernOS HUD] chat context unavailable during HUD recovery:', e);
    }
    return null;
  }

  function findChatMessageForElement(messageElement) {
    const id = messageElement?.getAttribute?.('mesid');
    if (id == null) return null;
    const ctx = getHudChatContextSafe();
    const chatData = ctx && Array.isArray(ctx.chat) ? ctx.chat : (Array.isArray(window.chat) ? window.chat : null);
    if (!chatData) return null;
    const numericId = parseInt(id, 10);
    const byMeta = chatData.find(m => String(m?._id) === String(id) || String(m?.mesId) === String(id));
    if (byMeta) return byMeta;
    return Number.isInteger(numericId) && numericId >= 0 && numericId < chatData.length ? chatData[numericId] : null;
  }

  function recoverHudFromActiveSwipe(messageElement, textElement) {
    if (!messageElement || !textElement) return false;
    const message = findChatMessageForElement(messageElement);
    if (!message || !Array.isArray(message.swipes) || message.swipe_id === undefined) return false;
    const activeIndex = Number(message.swipe_id);
    if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= message.swipes.length) return false;
    const activeSwipe = message.swipes[activeIndex];
    if (typeof activeSwipe !== 'string') return false;
    const hudBlock = extractHudBlock(activeSwipe);
    if (!hudBlock || !hudOpenRe('i').test(hudBlock)) return false;

    // ST иногда после saveReply держит HUD в swipes[current] раньше, чем он
    // попадает в message.mes/DOM. Восстанавливаем только отображаемый текст:
    // саму механику вставки/обновления HUD не меняем.
    const currentHtml = textElement.innerHTML || '';
    if (естьHudБлок(currentHtml)) return false;

    const node = document.createTextNode('\n\n' + hudBlock);
    textElement.appendChild(node);
    console.debug('[TavernOS HUD] Recovered HUD from active swipe', {
      swipeId: activeIndex,
      messageId: messageElement.getAttribute('mesid')
    });
    return true;
  }

  // Исходный текст сообщения из чата (то, что написала модель), без правок
  // отображения. Пусто, если сообщение не нашлось.
  function исходныйТекстСообщения(messageElement) {
    try {
      const id = Number(messageElement && messageElement.getAttribute('mesid'));
      const ctx = getStContextSafe();
      const m = ctx && Array.isArray(ctx.chat) && Number.isInteger(id) ? ctx.chat[id] : null;
      if (!m) return '';
      if (typeof m.mes === 'string' && m.mes) return m.mes;
      const свайп = Array.isArray(m.swipes) ? m.swipes[m.swipe_id] : undefined;
      return typeof свайп === 'string' ? свайп : '';
    } catch (_) { return ''; }
  }

  /* Границы блоков [HUD]…[/HUD] в строке.
     Каждую закрывающую метку соединяем с БЛИЖАЙШЕЙ открывающей перед ней,
     а не с первой в тексте. Иначе упоминание [HUD] в <thinking> или <plan>
     утаскивает в блок всю прозу до настоящего блока — карточка выходит
     правильной, а текст ответа исчезает.
     Незакрытую метку считаем блоком только когда закрытых нет вовсе: это
     значит, что модель ещё печатает и закрывающая просто не дошла. */
  const HUD_ОТКР = hudOpenRe('ig');
  const HUD_ЗАКР = hudCloseRe('ig');

  function найтиБлокиHud(текст, разрешитьНезакрытый = true) {
    // Индексы — по маске рассуждений: метки внутри <plan>/<thinking> не видны.
    const s = маскаРассуждений(String(текст || ''));
    const откр = [], закр = [];
    HUD_ОТКР.lastIndex = 0; HUD_ЗАКР.lastIndex = 0;
    for (let m; (m = HUD_ОТКР.exec(s)) !== null; ) откр.push({ от: m.index, до: m.index + m[0].length });
    for (let m; (m = HUD_ЗАКР.exec(s)) !== null; ) закр.push({ от: m.index, до: m.index + m[0].length });

    const блоки = [];
    let занятоДо = -1;
    for (const з of закр) {
      let о = null;
      for (const k of откр) {
        if (k.до > з.от) break;
        if (k.от > занятоДо) о = k;
      }
      if (!о) continue;
      блоки.push({ from: о.от, to: з.до, contentFrom: о.до, contentTo: з.от, closed: true });
      занятоДо = з.до;
    }
    // Незакрытая метка — блок, только если за ней сразу идут данные (код-блок,
    // JSON). Одинокое упоминание в <plan> блоком не считаем: иначе от него до
    // конца сообщения всё уходило в «карточку» и текст ответа пропадал.
    if (!блоки.length && разрешитьНезакрытый && откр.length) {
      const о = откр.slice().reverse().find(k => меткаСДанными(s.slice(k.до)));
      if (о) блоки.push({ from: о.от, to: s.length, contentFrom: о.до, contentTo: s.length, closed: false });
    }
    return блоки;
  }

  const ОБЁРТКИ_MARKDOWN = /^(?:OL|UL|LI|CODE|PRE|BLOCKQUOTE|P|EM|STRONG|B|I|U|S|DEL)$/;
  function поднятьИзОбёрток(textElement, card) {
    let верх = card;
    while (верх.parentElement && верх.parentElement !== textElement && ОБЁРТКИ_MARKDOWN.test(верх.parentElement.tagName)) верх = верх.parentElement;
    if (верх === card) return;
    const откуда = card.parentElement;
    верх.after(card);
    // Пустые после переноса обёртки (остались только пробелы) — прочь.
    for (let p = откуда; p && p !== textElement && p !== верх.parentElement; ) {
      const выше = p.parentElement;
      if (!p.textContent.trim() && !p.querySelector('img, video, iframe, svg, .hud-os-card')) p.remove();
      p = выше;
    }
  }

  async function processMessage(messageElement) {
    const textElement = messageElement.querySelector('.mes_text');
    if (!textElement) { return; }

    // Кнопку «Создать HUD» убираем, только когда HUD в сообщении правда
    // появился. Раньше она снималась на каждом проходе и тут же вставлялась
    // обратно ниже: обе правки будили наблюдатель, тот снова звал разбор, и
    // каждое сообщение без HUD крутилось по кругу несколько раз в секунду.
    // В длинном чате это десятки разборов больших сообщений в секунду
    // в полном покое — на телефоне лента вставала колом.
    const убратьКнопкуСоздания = () => {
      const кнопка = textElement.querySelector('.hud-missing-placeholder');
      if (кнопка) кнопка.remove();
    };
    // Упоминание «[HUD]» в <plan> блоком не считается — кнопка остаётся.
    if (textElement.querySelector('.hud-os-card') || естьHudБлок(textElement.textContent || '')) {
      убратьКнопкуСоздания();
    }

    // Пометка о свёрнутой карточке стоит на сообщении, а заглушка лежит
    // внутри текста. Другое расширение перерисовывает текст целиком —
    // заглушка пропадает, пометка остаётся, и возврат карточки потом
    // затирает весь текст снимком, снятым до чужой дописки.
    if (messageElement.dataset.hudEvicted && !textElement.querySelector('.hud-evicted')) {
      delete messageElement.dataset.hudEvicted;
    }
    // Обратный случай: карточку уже собрали заново, а заглушка осталась
    // рядом — в сообщении висят и «HUD свёрнут», и живая карточка.
    убратьЛишниеЗаглушки(messageElement, textElement);
    // Карточка свёрнута в заглушку — разбирать нечего. Без этого разбор не
    // находил [HUD] в разметке, доставал блок из свайпа и собирал карточку
    // обратно, а спрятанная старая карточка возвращалась на экран. Вернуть
    // карточку — дело заглушки и наблюдателя прокрутки: они снимают пометку.
    if (messageElement.dataset.hudEvicted && textElement.querySelector('.hud-evicted')) return;

    // Сторож идёт до всех ранних выходов: сломанная карточка живёт как раз
    // в состоянии «карточка есть, сырого блока нет», из которого разбор
    // выходит сразу.
    if (проверитьКарточку(messageElement, textElement)) return;

    let innerHtml = textElement.innerHTML;

    // Если карточка уже есть и исходного [HUD] в DOM больше нет — всё уже обработано.
    // Если ST снова дорисовал исходный [HUD] рядом с карточкой, НЕ выходим:
    // нормализатор ниже должен удалить сырой блок и оставить одну карточку.
    const hasRenderedCard = innerHtml.includes('hud-os-card');
    const hasRawHudSource = естьHudБлок(innerHtml);
    if (hasRenderedCard && !hasRawHudSource) return;

    // Recovery path for ST swipe/save timing:
    if (!естьHudБлок(innerHtml)) {
      if (recoverHudFromActiveSwipe(messageElement, textElement)) {
        убратьКнопкуСоздания();
        innerHtml = textElement.innerHTML;
      }
    }

    const openTagRegex = hudOpenRe('i');
    const closeTagRegex = hudCloseRe('i');

    // Метки внутри рассуждений (<plan>, <thinking>) не в счёт.
    const маскаHtml = маскаРассуждений(innerHtml);
    if (!openTagRegex.test(маскаHtml)) {
      maybeInjectMissingHudButton(messageElement, textElement);
      return;
    }

    const hasCloseTag = closeTagRegex.test(маскаHtml);

    // Метки ищем по отдельности и соединяем в пары сами. Регулярка «от
    // открывающей до ближайшей закрывающей» берёт открывающую первую по
    // тексту, а она вполне может оказаться упоминанием внутри <thinking>
    // или <plan> — и тогда в блок попадает вся проза между упоминанием и
    // настоящим блоком. Ближайшая пара такого не допускает.
    const hudBlocks = найтиБлокиHud(innerHtml).map(б => ({
      full: innerHtml.slice(б.from, б.to),
      content: innerHtml.slice(б.contentFrom, б.contentTo),
      index: б.from,
      closed: б.closed,
    }));
    const естьЗакрытый = hudBlocks.some(б => б.closed);
    if (!hudBlocks.length) {
      maybeInjectMissingHudButton(messageElement, textElement);
      return;
    }

    // Карточка уже собрана, а в тексте нашёлся только незакрытый обрывок —
    // значит это упоминание метки в чужой дописке, а не блок. Настоящий
    // блок давно заменён карточкой, и закрывающей метки в тексте уже нет.
    // Пересобирать по такому обрывку нельзя: карточка выйдет пустой.
    const живаяКарточка = Array.from(textElement.querySelectorAll('.hud-os-card'))
      .filter(c => !c.closest('.hud-theme-preview'))[0];
    if (живаяКарточка && !естьЗакрытый) {
      lastLazyThunks = null;
      return;
    }

    // Данные HUD берём из исходного текста сообщения в чате, а не из
    // отрисованной разметки: её уже переписали регексы «только разметка» и
    // чужие расширения — на телефоне в блок попадал <style>.pk-h{…}, и CSS
    // оказывался в пузыре перехвата. Разметка — только запасной источник.
    const исходные = hudБлоки(исходныйТекстСообщения(messageElement));
    const изИсходника = (i) => {
      if (!исходные.length) return null;
      if (исходные.length === hudBlocks.length) return исходные[i].inner;
      return i === hudBlocks.length - 1 ? исходные[исходные.length - 1].inner : null;
    };
    const parsedHudBlocks = [];
    for (let index = 0; index < hudBlocks.length; index++) {
      const block = hudBlocks[index];
      try {
        let data = null;
        const исходник = изИсходника(index);
        if (исходник) { try { data = parseHUDComplex(исходник); } catch (_) { data = null; } }
        if (!data) data = parseHUDComplex(block.content);
        parsedHudBlocks.push({
          index,
          data,
          score: scoreHudJsonCandidate(data),
        });
      } catch (e) {
        console.debug('[TavernOS HUD] HUD block candidate failed', {
          blockIndex: index,
          error: e?.message || String(e),
        });
      }
    }

    let hasChanges = false;
    // Возврат состояния ждёт, пока на карточку лягут заготовки вкладок.
    let возвращатьПослеСборки = false;
    // Какой из блоков пошёл в карточку: его же вернём после сворачивания.
    let selectedIndexForRestore = -1;
    let newHtml = innerHtml;
    let rendered = '';
    // Подпись нужна и ниже, за пределами разбора блоков, — объявляем здесь.
    let подпись = '';
    if (parsedHudBlocks.length) {
      parsedHudBlocks.sort((a, b) => b.score - a.score || a.index - b.index);
      const selected = parsedHudBlocks[0];
      renderTargetMes = messageElement;
      // Списки из прошлых ходов возвращаем на экран перед отрисовкой:
      // модель роняет их каждый ход, а пользователю нужна цельная картина.
      // В сохранённый текст и в запрос к модели это не попадает.
      // Вне сцены модель не пишет кинки и историю секса — черты берём из прошлых ходов.
      const данныеХода = сдвигиДоверия(вернутьЧерты(mergeCarryOver(selected.data, messageElement), messageElement), messageElement);
      // Таймеры следов и графики пульса смотрят в прошлые ходы — лениво,
      // только когда вкладка с ними действительно собирается.
      привязатьИсторию(данныеХода, Number(messageElement.getAttribute('mesid')));
      rendered = renderHUD(данныеХода);
      renderTargetMes = null;

      // Если карточка на месте и разметка вышла ровно та же, пересобирать
      // нечего: убираем сырой блок, который ST вернул в текст, и оставляем
      // живую карточку со всем её состоянием.
      const прежняяКарточка = textElement.querySelector('.hud-os-card');
      selectedIndexForRestore = selected.index;
      подпись = hudRenderSignature(rendered, lastRenderBaseId, данныеХода);
      const разметкаТаЖе = !!прежняяКарточка && hasCloseTag
        && !!messageElement.__hudRenderSig
        && messageElement.__hudRenderSig === подпись;

      if (rendered && разметкаТаЖе) {
        // Заготовки отложенных вкладок принадлежат новой разметке, а она не
        // понадобилась: у живой карточки свои, снятые при её сборке.
        lastLazyThunks = null;
        stripRawHudKeepCard(textElement);
        messageElement.__hudSource = innerHtml;
      } else if (rendered) {
        for (let i = hudBlocks.length - 1; i >= 0; i--) {
          const block = hudBlocks[i];
          const replacement = i === selected.index ? rendered : '';
          newHtml = newHtml.slice(0, block.index) + replacement + newHtml.slice(block.index + block.full.length);
        }
        hasChanges = newHtml !== innerHtml;

      }
    }

    if (hasChanges) {
      // Исходный текст с блоком [HUD] нужен, чтобы карточку можно было
      // выбросить из DOM и собрать заново, когда до неё снова долистают.
      // Исходник сообщения нужен виртуализации: свёрнутую карточку она
      // собирает заново именно из него. Раньше он записывался один раз и
      // после смены варианта ответа (свайпа) оставался от прежнего варианта —
      // прокрутил ленту туда-обратно и получил чужой HUD. Обновляем каждый
      // раз: сюда попадают только проходы, где в тексте есть сырой [HUD].
      messageElement.__hudSource = innerHtml;
      // Сам блок, из которого собрана карточка. Нужен, чтобы вернуть её
      // на место после сворачивания, не трогая остальной текст.
      messageElement.__hudBlock = (hudBlocks[selectedIndexForRestore] || {}).full || '';
      // Подпись разметки: по ней следующий проход поймёт, что пересобирать
      // нечего и карточку можно оставить в покое.
      messageElement.__hudRenderSig = подпись;
      const normalized = normalizeHudDisplayDom(messageElement, textElement, rendered, естьЗакрытый);
      if (!normalized) textElement.innerHTML = newHtml;
      // Карточка новая, а открыта в ней должна остаться та же вкладка, что
      // и до пересборки. Но не прямо сейчас: возврат открывает вкладку
      // кликом, а отложенные вкладки собираются из заготовок, которые лягут
      // на карточку несколькими строками ниже.
      возвращатьПослеСборки = true;
      textElement.querySelectorAll('.hud-regen-btn').forEach(bindHudRegenButton);
    кнопкаВерсийHUD(messageElement, textElement);
      freezeOldHUDs();

    }

    textElement.querySelectorAll('.hud-regen-btn').forEach(bindHudRegenButton);

    // Способы собрать отложенные вкладки живут на самой карточке: исчезнет
    // она — исчезнут и они, без всякой уборки.
    if (lastLazyThunks) {
      const fresh = textElement.querySelector('.hud-os-card');
      if (fresh) fresh.__hudLazy = lastLazyThunks;
      lastLazyThunks = null;
    }
    // Чип бюджета в новой карточке — заполнить, когда карточки чата встанут.
    if (settings.tokenBudget !== 'off' && textElement.querySelector('.hud-budget-chip')) обновитьЧипыБюджетаПозже(1500);

    // Модель иногда кладёт блок HUD в markdown-список или `код`: каждый
    // уровень отступа съедает ширину, и на телефоне карточка сжималась до
    // 160px. Поднимаем её на уровень текста сообщения — сразу после внешней
    // обёртки; опустевшие обёртки убираем. Чужие div других расширений не трогаем.
    textElement.querySelectorAll('.hud-os-card').forEach(card => поднятьИзОбёрток(textElement, card));

    // Теперь заготовки на месте — можно открывать ту вкладку, что была
    // открыта до пересборки: её содержимое соберётся как надо.
    if (возвращатьПослеСборки) applyCardUiState(messageElement);

    // Пометки-реакции живут отдельно от текста сообщения и в разметке не
    // сохраняются: возвращаем их на пузыри после каждой сборки.
    if (hasChanges) refreshReactions(textElement);

    // Вопросики у полей навешиваем по готовому дереву: так словарь можно
    // пополнять, не трогая полтора десятка сборщиков разметки.
    if (hasChanges) {
      if (settings.showHints === false) removeHelpMarks(textElement);
      else attachHelpMarks(textElement);
      // Эмодзи в медальонах центрируем по чернилам — независимо от пояснений.
      centerFieldIcons(textElement);
    }

    // Защита от свайпа стоит только на самой карточке. Раньше она
    // закрывала сообщение целиком, и смена варианта ответа переставала
    // работать на обычной прозе, где мешать было нечему. Карточке защита
    // нужна — по ней листают вкладки и переписки, — а тексту нет.

    textElement.querySelectorAll('.hud-os-card').forEach(card => {
        if (!card.dataset.touchFixed) {
            card.addEventListener('touchstart', e => e.stopPropagation(), {passive: true});
            card.addEventListener('touchmove', e => e.stopPropagation(), {passive: true});
            card.addEventListener('touchend', e => e.stopPropagation(), {passive: true});
            card.dataset.touchFixed = 'true';
        }

        // Tab bars need their own guard so horizontal swipes scroll the HUD tabs
        // instead of being interpreted by SillyTavern as a message swipe.
        card.querySelectorAll('.hud-tabs-header, .hud-phone-subtabs').forEach(bar => {
            if (bar.dataset.swipeGuardBound === 'true') return;
            ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(type => {
                bar.addEventListener(type, e => e.stopPropagation(), { passive: true });
            });
            bar.dataset.swipeGuardBound = 'true';
        });
    });
  }

  /* Сторож пустой карточки.
     Карточка на месте, а внутри ни вкладок, ни строк — либо вкладки есть,
     а заготовок к ним не осталось, и при переключении они откроются
     пустыми. Раньше это лечил только свайп. Собираем заново из блока,
     который запомнили при первой сборке. Две неудачные попытки подряд —
     и отступаем: значит, дело не в пересборке, и крутиться по кругу
     незачем. Удачная сборка счётчик обнуляет. */
  const ПОТОЛОК_ПОЧИНОК = 2;
  function проверитьКарточку(messageElement, textElement) {
    const card = Array.from(textElement.querySelectorAll('.hud-os-card'))
      .filter(c => !c.closest('.hud-theme-preview'))[0];
    if (!card) return false;
    // Облегчённая карточка пуста нарочно: её содержимое лежит на ней самой.
    if (card.__hudLight) return false;
    const пусто = !card.querySelector('.hud-tab, .hud-row, .hud-scene-widget');
    const вкладкиБезЗаготовок = !!card.querySelector('.hud-tab-lazy') && !card.__hudLazy;
    // Карточка целая — забываем прошлые починки: следующая поломка
    // должна лечиться с чистого листа.
    if (!пусто && !вкладкиБезЗаготовок) { messageElement.__hudRepaired = 0; return false; }
    if ((messageElement.__hudRepaired || 0) >= ПОТОЛОК_ПОЧИНОК) return false;
    const блок = messageElement.__hudBlock;
    if (!блок) return false;
    console.warn('[TavernOS HUD] карточка вышла пустой — собираю заново', {
      messageId: messageElement.getAttribute('mesid'),
      пусто, вкладкиБезЗаготовок,
    });
    messageElement.__hudRepaired = (messageElement.__hudRepaired || 0) + 1;
    card.outerHTML = блок;
    delete messageElement.__hudRenderSig;
    safeProcessMessage(messageElement);
    return true;
  }

  /* ---------------------------------------------------------------------
     СОСТОЯНИЕ КАРТОЧКИ ПЕРЕЖИВАЕТ ПЕРЕСБОРКУ
     ---------------------------------------------------------------------
     Читаем и возвращаем по видимым признакам, а не по внутренним
     идентификаторам: те при пересборке выдаются заново и никуда не ведут.
     Вкладку узнаём по подписи, секрет — по заголовку, экран телефона — по
     имени приложения. */

  // У тестов на беременность подпись одна на всех («Сделать тест») — ключ
  // дополняем владельцем, иначе раскрытый тест {{user}} раскрывал бы после
  // перерисовки и тест персонажа.
  const надписьУзла = (el) => {
    if (!el) return '';
    const чей = el.closest && el.closest('details[data-kto]');
    return (чей ? чей.dataset.kto + '|' : '') + (el.textContent || '').trim().replace(/\s+/g, ' ');
  };

  // Пока возвращаем состояние, собственные клики в запись попадать не
  // должны: иначе восстановление перезапишет то, что восстанавливает.
  let возвращаемСостояние = false;

  // Подпись разметки: та же карточка, собранная дважды, отличается только
  // идентификаторами. Вычёркиваем их — остаётся содержимое.
  // Подпись разметки без случайных идентификаторов сборки: две сборки одних
  // данных дают одну подпись. Идентификатор заменяем только если его нет в
  // самих данных: иначе совпавший кусок имени или текста тоже превратился бы
  // в «#», и разные карточки могли бы получить одну подпись. Тогда подписи
  // нет вовсе, и карточка просто пересобирается.
  function hudRenderSignature(html, baseId, данные) {
    if (typeof html !== 'string' || !baseId) return '';
    let вДанных = true;
    try { вДанных = JSON.stringify(данные ?? '').includes(baseId); } catch (_) { вДанных = true; }
    if (вДанных) return '';
    return html.split(baseId).join('#');
  }

  function readCardUiState(mes) {
    const card = mes && mes.querySelector('.hud-os-card');
    if (!card) return null;
    вернутьКарточку(card);
    const активная = card.querySelector('.hud-tab.active');
    const свёртка = card.querySelector('.hud-toggle-input');
    const экран = card.querySelector('.hud-phone-app-view.active');
    const подвкладка = card.querySelector('.hud-phone-subtab.active');
    return {
      вкладка: активная ? надписьУзла(активная) : null,
      свёрнута: свёртка ? !!свёртка.checked : null,
      раскрыты: Array.from(card.querySelectorAll('details[open]'))
        .map(d => надписьУзла(d.querySelector('summary'))).filter(Boolean),
      секреты: Array.from(card.querySelectorAll('.hud-memory-secret.is-open'))
        .map(sec => надписьУзла(sec.querySelector('[data-secret-toggle]'))).filter(Boolean),
      экран: экран ? экран.getAttribute('data-phone-view') : null,
      подвкладка: подвкладка ? надписьУзла(подвкладка) : null,
    };
  }

  function applyCardUiState(mes) {
    const состояние = mes && mes.__hudUiState;
    const card = mes && mes.querySelector('.hud-os-card');
    if (!состояние || !card) return;
    вернутьКарточку(card);
    возвращаемСостояние = true;
    try {
      if (состояние.свёрнута !== null) {
        const свёртка = card.querySelector('.hud-toggle-input');
        if (свёртка) свёртка.checked = состояние.свёрнута;
      }
      // Вкладку возвращаем кликом: отложенные вкладки собираются именно при
      // открытии, руками класс ставить нельзя — содержимое останется пустым.
      if (состояние.вкладка) {
        const цель = Array.from(card.querySelectorAll('.hud-tab'))
          .find(t => надписьУзла(t) === состояние.вкладка);
        if (цель && !цель.classList.contains('active')) цель.click();
      }
      if (состояние.раскрыты.length) {
        card.querySelectorAll('details').forEach(d => {
          if (состояние.раскрыты.includes(надписьУзла(d.querySelector('summary')))) d.open = true;
        });
      }
      if (состояние.секреты.length) {
        card.querySelectorAll('[data-secret-toggle]').forEach(btn => {
          if (!состояние.секреты.includes(надписьУзла(btn))) return;
          const тело = document.getElementById(btn.getAttribute('data-secret-toggle'));
          if (тело && тело.hidden) btn.click();
        });
      }
      // Телефон лежит внутри своей вкладки, поэтому только после неё.
      if (состояние.экран) {
        const иконка = card.querySelector('.hud-phone-app[data-phone-app="' + cssEscapeValue(состояние.экран) + '"]');
        if (иконка) иконка.click();
      }
      if (состояние.подвкладка) {
        const п = Array.from(card.querySelectorAll('.hud-phone-subtab'))
          .find(t => надписьУзла(t) === состояние.подвкладка);
        if (п && !п.classList.contains('active')) п.click();
      }
    } catch (err) {
      console.debug('[TavernOS HUD] состояние карточки вернуть не удалось:', err);
    } finally {
      возвращаемСостояние = false;
    }
  }

  function cssEscapeValue(v) {
    if (window.CSS && CSS.escape) return CSS.escape(v);
    // Запасная ветка на случай очень старого браузера: экранируем то, что
    // ломает селектор по атрибуту.
    return String(v).replace(/['"\]\\]/g, (знак) => '\\' + знак);
  }

  // «Изменить судьбу» в тесте на беременность: меняем исход в метаданных
  // чата и перерисовываем все карточки — тест раскрыт и там, где нажали.
  document.addEventListener('click', (e) => {
    const кнопка = e.target && e.target.closest && e.target.closest('.hud-fate-btn[data-hud-fate]');
    if (!кнопка) return;
    e.preventDefault(); e.stopPropagation();
    const { kto, key, hudFate } = кнопка.dataset;
    const вышло = hudFate === 'undo' ? откатитьСудьбу(kto) : изменитьСудьбу(kto, key, hudFate === 'pos');
    if (!вышло) return;
    const mes = кнопка.closest('.mes');
    if (mes) mes.__hudUiState = readCardUiState(mes);
    перерисоватьКарточкиЧата();
  });
  // Правки снимка из сетки секретов: «отметить», «нет», «снять».
  document.addEventListener('click', (e) => {
    const кн = e.target && e.target.closest && e.target.closest('[data-sec-edit]');
    if (!кн || !кн.closest('.hud-os-card')) return;
    e.preventDefault(); e.stopPropagation();
    const путь = кн.dataset.secEdit, значение = кн.dataset.value || '';
    const mes = кн.closest('.mes');
    const вышло = значение ? правитьСнимок(путь, значение, mes ? Number(mes.getAttribute('mesid')) : null) : снятьПравку(путь);
    if (!вышло) return;
    if (mes) mes.__hudUiState = readCardUiState(mes);
    перерисоватьКарточкиЧата();
  });
  // Малыши в животе: «Узнать пол», «Изменить судьбу» (число, пол), «Откатить».
  // Роды: «Роды состоялись». Вкладки детей в «Детской» — без перерисовки.
  document.addEventListener('click', (e) => {
    const цель = e.target && e.target.closest && e.target.closest('[data-hud-fetus], [data-hud-birth], .hud-kid-tab, .hud-kid-chip');
    if (!цель || !цель.closest('.hud-os-card')) return;
    e.preventDefault(); e.stopPropagation();
    if (цель.matches('.hud-kid-tab, .hud-kid-chip')) {
      const комната = цель.closest('.hud-kids');
      const i = цель.dataset.kid;
      комната.querySelectorAll('.hud-kid-tab, .hud-kid-chip').forEach(к => к.classList.toggle('is-on', к.dataset.kid === i));
      комната.querySelectorAll('.hud-kid-card').forEach(к => к.classList.toggle('is-on', к.dataset.kidCard === i));
      return;
    }
    const кто = цель.dataset.kto;
    let вышло = false;
    if (цель.dataset.hudBirth) {
      const сцена = (() => { try { const ctx = getStContextSafe(); const чат = ctx && ctx.chat || []; for (let j = чат.length - 1; j >= 0; j--) { const м = чат[j]; if (м && !м.is_user) { const b = extractHudBlock(String(м.mes || '')); if (b) { const о = собратьСнимок(b); return о && о.sc && о.sc.Dt; } } } } catch (_) {} return ''; })();
      вышло = зарегистрироватьРоды(кто, { когда: String(сцена || ''), дата: parseSceneDate(сцена) });
    } else {
      const д = цель.dataset.hudFetus;
      вышло = д === 'roll' ? узнатьПол(кто) : д === 'undo' ? откатитьПлоды(кто) : изменитьПлоды(кто, д, цель.dataset.val);
    }
    if (!вышло) return;
    const mes = цель.closest('.mes');
    if (mes) mes.__hudUiState = readCardUiState(mes);
    перерисоватьКарточкиЧата();
  });

  // Игрок сам нажал «Сделать тест» — узнал итог. Только теперь беременность
  // уходит модели, а у {{user}} появляется плашка-напоминание. Ловим именно
  // клик: раскрытие при восстановлении состояния тестом не считается.
  document.addEventListener('click', (e) => {
    const надпись = e.target && e.target.closest && e.target.closest('details.hud-preg-test[data-kto] > summary');
    if (!надпись) return;
    const тест = надпись.parentElement;
    setTimeout(() => {
      if (!тест.open || !отметитьТест(тест.dataset.kto)) return;
      const mes = тест.closest('.mes');
      if (mes) mes.__hudUiState = readCardUiState(mes);
      перерисоватьКарточкиЧата();
    }, 0);
  });

  // Одна запись на все действия внутри карточки: снимаем состояние после
  // того, как отработали обработчики вкладок, секретов и телефона.
  document.addEventListener('click', (e) => {
    if (возвращаемСостояние) return;
    const card = e.target && e.target.closest && e.target.closest('.hud-os-card');
    if (!card) return;
    const mes = card.closest('.mes');
    if (!mes) return;
    setTimeout(() => { if (mes.isConnected) mes.__hudUiState = readCardUiState(mes); }, 0);
  });
  // Раскрытие <details> бывает и с клавиатуры — клика там может не быть.
  document.addEventListener('toggle', (e) => {
    if (возвращаемСостояние) return;
    const card = e.target && e.target.closest && e.target.closest('.hud-os-card');
    if (!card) return;
    const mes = card.closest('.mes');
    if (mes) mes.__hudUiState = readCardUiState(mes);
  }, true);

  // Убирает сырой блок [HUD] из текста, не трогая уже собранную карточку.
  // Только при наличии закрывающего тега: без него регулярка ест всё до
  // конца строки и унесла бы карточку вместе с блоком.
  function stripRawHudKeepCard(textElement) {
    let убрано = false;
    // Блоков может оказаться несколько; потолок — чтобы неудачная разметка
    // не увела в бесконечный круг.
    for (let попытка = 0; попытка < 4; попытка++) {
      if (!вырезатьОдинСыройБлок(textElement)) break;
      убрано = true;
    }
    return убрано;
  }

  // Ищет [HUD]…[/HUD] среди текста ВНЕ карточки и удаляет ровно этот кусок.
  // Внутрь карточки не заглядываем: там разметка, а не исходник, и любые
  // совпадения были бы ложными.
  function вырезатьОдинСыройБлок(textElement) {
    const обход = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement && node.parentElement.closest
        && node.parentElement.closest('.hud-os-card, ' + ТЕГИ_РАССУЖДЕНИЙ.join(', ')))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const куски = [];
    let позиция = 0;
    let узел;
    while ((узел = обход.nextNode())) {
      const значение = узел.nodeValue || '';
      куски.push({ узел, начало: позиция, конец: позиция + значение.length });
      позиция += значение.length;
    }
    if (!куски.length) return false;

    const текст = маскаРассуждений(куски.map(k => k.узел.nodeValue || '').join(''));
    // Пара — ближайшая: первая закрывающая и последняя открывающая перед ней.
    // Первая открывающая в тексте бывает упоминанием в <plan> («except the
    // [HUD] JSON block»), и тогда под нож шла вся проза до настоящего блока.
    const закрыт = текст.match(/(?:\[|<)\s*\/\s*HUD\s*(?:\]|>)/i);
    if (!закрыт) return false;
    let открыт = null;
    for (const m of текст.matchAll(/(?:\[|<)\s*HUD\s*(?:\]|>)/ig)) {
      if (m.index + m[0].length > закрыт.index) break;
      открыт = m;
    }
    if (!открыт) return false;
    const от = открыт.index;
    const до = закрыт.index + закрыт[0].length;

    const найти = (поз) => куски.find(k => поз >= k.начало && поз <= k.конец) || куски[куски.length - 1];
    const а = найти(от);
    const б = найти(до);
    if (!а || !б) return false;

    const отрезок = document.createRange();
    отрезок.setStart(а.узел, Math.max(0, от - а.начало));
    отрезок.setEnd(б.узел, Math.max(0, до - б.начало));

    // Ради этого всё и затевалось: карточка не должна попасть под нож.
    const карточки = textElement.querySelectorAll('.hud-os-card');
    for (const карточка of карточки) {
      if (отрезок.intersectsNode(карточка)) { отрезок.detach && отрезок.detach(); return false; }
    }

    отрезок.deleteContents();
    return true;
  }

  // Remove duplicate HUD cards/raw HUD markup from the *displayed DOM only*.
  // The saved message/swipe data is intentionally untouched. This is a safety
  // net for ST re-renders where the same active swipe can briefly be painted
  // twice (or once as a rendered card and once as the original fenced JSON).
  function normalizeHudDisplayDom(messageElement, textElement, renderedHtml, толькоЗакрытые) {
    if (!messageElement || !textElement) return false;

    // A previous pass may already have produced a card while ST subsequently
    // restored the source HUD text. Remove cards from this message first, then
    // paint exactly one fresh card at the source HUD position. Other messages
    // are untouched.
    textElement.querySelectorAll('.hud-os-card').forEach(card => card.remove());

    let html = textElement.innerHTML || '';
    // Тот же поиск пар, что и при разборе: первая открывающая в тексте
    // вполне может оказаться упоминанием внутри <plan>, и замена «от неё до
    // ближайшей закрывающей» унесла бы всю прозу между ними.
    const matches = найтиБлокиHud(html, !толькоЗакрытые)
      .map(б => ({ index: б.from, length: б.to - б.from }));

    // If the HTML-level regex sees raw HUD blocks, replace ALL of them with
    // exactly one rendered card. This is deliberately independent of parsing
    // and therefore also cleans up a malformed/duplicate second block.
    if (matches.length) {
      let out = html;
      for (let i = matches.length - 1; i >= 0; i--) {
        const r = matches[i];
        out = out.slice(0, r.index) + (i === 0 ? renderedHtml : '') + out.slice(r.index + r.length);
      }
      if (out !== html) {
        textElement.innerHTML = out;
        return true;
      }
    }

    // If the raw HUD survived because a markdown/highlight renderer split the
    // markers across DOM text nodes, use a DOM Range fallback. It removes the
    // entire marker-to-marker region without touching surrounding prose.
    // Текст внутри элементов-рассуждений (<plan>, <thinking>) не смотрим.
    const walker = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest && n.parentElement.closest(ТЕГИ_РАССУЖДЕНИЙ.join(', ')))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    const flat = [];
    for (const n of nodes) {
      const value = n.nodeValue || '';
      flat.push({ node: n, start: flat.length ? flat[flat.length - 1].end : 0, end: (flat.length ? flat[flat.length - 1].end : 0) + value.length });
    }
    const fullText = маскаРассуждений(flat.map(x => x.node.nodeValue || '').join(''));
    // И здесь пара должна быть ближайшей: закрывающую берём первую, а
    // открывающую — последнюю перед ней.
    const close = /(?:\[|<)\s*\/\s*HUD\s*(?:\]|>)/i;
    const closeMatch = fullText.match(close);
    const openAll = /(?:\[|<)\s*HUD\s*(?:\]|>)/ig;
    let openMatch = null;
    if (closeMatch) {
      for (let m2; (m2 = openAll.exec(fullText)) !== null; ) {
        if (m2.index + m2[0].length > closeMatch.index) break;
        openMatch = m2;
      }
    }
    if (openMatch) {
      {
        const startPos = openMatch.index;
        const endPos = closeMatch.index + closeMatch[0].length;
        const locate = (pos) => flat.find(x => pos >= x.start && pos <= x.end) || flat[flat.length - 1];
        const a = locate(startPos);
        const b = locate(endPos);
        if (a && b) {
          const range = document.createRange();
          range.setStart(a.node, Math.max(0, startPos - a.start));
          range.setEnd(b.node, Math.max(0, endPos - b.start));
          range.deleteContents();
          const holder = document.createElement('div');
          holder.innerHTML = renderedHtml;
          const frag = document.createDocumentFragment();
          while (holder.firstChild) frag.appendChild(holder.firstChild);
          range.insertNode(frag);
          return true;
        }
      }
    }

    return false;
  }

  // SillyTavern uses .edit_textarea while a message is being edited.
  // TavernOS must not touch the message DOM during editing, otherwise its
  // normal HUD re-render can overwrite the editor contents.
  function isMessageBeingEdited(messageElement) {
    if (!messageElement) return false;
    return !!messageElement.querySelector(
      '.edit_textarea, textarea#curEditTextarea, .mes_edit_textarea'
    );
  }

  const PERFORMANCE_MESSAGE_THRESHOLD = 200;
  const PERFORMANCE_ACTIVE_WINDOW = 80;
  let performanceIntersectionObserver = null;
  let performanceScrollRaf = 0;
  let застрявшиеТаймер = 0;

  function isPerformanceModeActive(container = cachedChatContainer) {
    if (!settings.performanceMode || !container) return false;
    // Живая коллекция: браузер держит её сам, а querySelectorAll на каждый
    // кадр прокрутки и на каждую запись наблюдателя собирал сотни узлов заново.
    return container.getElementsByClassName('mes').length >= PERFORMANCE_MESSAGE_THRESHOLD;
  }

  function updatePerformanceMode() {
    const container = cachedChatContainer || document.querySelector('#chat') || document.querySelector('#chat-container');
    if (!container) return false;
    const active = isPerformanceModeActive(container);
    container.classList.toggle('hud-performance-mode', active);
    if (!active) {
      container.querySelectorAll('.mes.hud-perf-older, .mes.hud-perf-visible').forEach(el => {
        el.classList.remove('hud-perf-older', 'hud-perf-visible');
      });
    }
    return active;
  }

  function refreshPerformanceMessageClasses() {
    const container = cachedChatContainer;
    if (!container || !isPerformanceModeActive(container)) return;
    const messages = Array.from(container.querySelectorAll('.mes'));
    const start = Math.max(0, messages.length - PERFORMANCE_ACTIVE_WINDOW);
    messages.forEach((mes, index) => {
      if (index < start && !mes.classList.contains('hud-perf-visible')) mes.classList.add('hud-perf-older');
      else mes.classList.remove('hud-perf-older');
    });
  }

  function setupPerformanceObserver() {
    const container = cachedChatContainer;
    if (!container) return;
    if (performanceIntersectionObserver) performanceIntersectionObserver.disconnect();
    performanceIntersectionObserver = null;
    if (!isPerformanceModeActive(container) || typeof IntersectionObserver === 'undefined') return;

    performanceIntersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const mes = entry.target;
        if (!mes.isConnected) continue;
        if (entry.isIntersecting) {
          mes.classList.add('hud-perf-visible');
          mes.classList.remove('hud-perf-older');
          restoreEvictedCard(mes);
          safeProcessMessage(mes);
          // Пока карточка на экране, её высота настоящая — запоминаем на
          // будущее, для заглушки. Меряем в следующем кадре: сразу после
          // разбора вёрстка ещё не устоялась.
          // Двойной кадр: первый отдаёт вёрстку браузеру, и только после
          // отрисовки content-visibility перестаёт отдавать заявленную высоту
          // вместо настоящей.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const text = mes.querySelector('.mes_text');
            const card = mes.querySelector('.hud-os-card');
            if (!text || !card) return;
            // У карточки, отрисовку которой браузер пропустил по
            // content-visibility, высота не настоящая, а заявленная в
            // contain-intrinsic-size. Такую запоминать нельзя: заглушка выходит
            // втрое выше карточки и раздувает прокрутку. Отличаем по самой
            // высоте — она совпадает с заявленной с точностью до рамки.
            // checkVisibility здесь бесполезен: он отвечает про «нужна ли
            // пользователю», а не про «пересчитана ли вёрстка», и говорит «да»
            // ещё до пересчёта.
            const карточка = card.getBoundingClientRect();
            // Только когда карточка по-настоящему в окне: наблюдатель зовёт
            // нас за полтора экрана до края, а там высота ещё заявленная.
            if (карточка.bottom <= 0 || карточка.top >= (window.innerHeight || 0)) return;
            const заявлено = parseFloat((getComputedStyle(card).containIntrinsicSize || '').split(/\s+/).pop()) || 0;
            if (заявлено && Math.abs(карточка.height - заявлено) <= 3) return;
            const h = Math.round(text.getBoundingClientRect().height);
            if (h > 40) {
              mes.__hudCardHeight = h;
              // Типовую высоту знают и заглушки без своего замера, и ещё не
              // отрисованные карточки — через переменную на контейнере чата.
              // Зашитое число не годится: карточки в разных чатах разной
              // высоты, и промах в триста пикселей на две сотни свёрнутых
              // сообщений раздувал ленту и рвал прокрутку.
              const box = mes.closest('#chat') || cachedChatContainer;
              // Переменная стоит на всём чате: каждая её смена пересчитывает
              // стили всей ленты. На телефоне это было по пересчёту на каждую
              // карточку, въехавшую в кадр, — меняем только при заметной разнице.
              if (box && Math.abs(h - заявленнаяВысота) > 60) {
                заявленнаяВысота = h;
                box.style.setProperty('--hud-card-h', h + 'px');
              }
            }
          }));
        } else {
          mes.classList.remove('hud-perf-visible');
          if (isPerformanceModeActive(container)) {
            mes.classList.add('hud-perf-older');
            // Виртуализация: карточка уехала дальше полутора экранов (столько
            // даёт rootMargin) — разбираем её обратно в исходный текст. В DOM
            // остаётся заглушка той же высоты, и при возврате карточка
            // собирается заново из mes.__hudSource.
            if (settings.virtualizeCards !== false) collapseCard(mes, true);
          }
        }
      }
    }, {
      root: null,
      // Полтора экрана вперёд и назад вместо жёстких 900px: на телефоне это
      // перестало быть тремя экранами лишней работы, на большом мониторе —
      // меньше одного экрана запаса.
      rootMargin: Math.round((window.innerHeight || 800) * 1.5) + 'px 0px',
      // Ноль в списке — сообщение считается видимым, едва коснувшись края.
      threshold: [0, 0.01],
    });

    container.querySelectorAll('.mes').forEach(mes => performanceIntersectionObserver.observe(mes));
    refreshPerformanceMessageClasses();
  }

  // Оставляем в DOM только N последних карточек. Лишние — самые старые, то
  // есть первые сверху — сворачиваем до тонкой полоски. Текст сообщения при
  // этом не теряется: он лежит на элементе и вернётся при следующем показе.
  // Последнее значение, записанное в --hud-card-h: типовая высота карточки
  // в этом чате для заглушек без своего замера. Старт — то же, что в
  // contain-intrinsic-size, поэтому свёртка выходит нейтральной по высоте.
  let заявленнаяВысота = 480;

  function живаяКарточка(textElement) {
    return Array.from(textElement.querySelectorAll('.hud-os-card'))
      .find(c => !c.closest('.hud-theme-preview')) || null;
  }

  // Заглушка рядом с живой карточкой лишняя: убираем её и снимаем пометку.
  function убратьЛишниеЗаглушки(mes, textElement) {
    const заглушки = textElement.querySelectorAll('.hud-evicted');
    if (!заглушки.length || !живаяКарточка(textElement)) return false;
    заглушки.forEach(з => з.remove());
    delete mes.dataset.hudEvicted;
    return true;
  }

  // Элемент касается окна (с запасом в пикселях сверху и снизу).
  function наЭкране(el, запас = 0) {
    const r = el.getBoundingClientRect();
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    return r.height > 0 && r.bottom > -запас && r.top < h + запас;
  }

  // Самолечение: сообщение на экране, а карточка в нём свёрнута. Сотни
  // сообщений на каждой прокрутке не меряем — берём те, что лежат под
  // несколькими точками по высоте окна.
  function вернутьЗастрявшие() {
    const box = cachedChatContainer;
    if (!box || !box.querySelector('.mes[data-hud-evicted]')) return;
    const r = box.getBoundingClientRect();
    const h = window.innerHeight || 0;
    const верх = Math.max(r.top, 0), низ = Math.min(r.bottom, h);
    if (низ <= верх) return;
    const x = Math.round(r.left + r.width / 2);
    const найдены = new Set();
    for (let i = 1; i <= 7; i++) {
      const точка = document.elementFromPoint(x, Math.round(верх + (низ - верх) * i / 8));
      const mes = точка && точка.closest ? точка.closest('.mes') : null;
      if (mes && box.contains(mes)) найдены.add(mes);
    }
    найдены.forEach(mes => {
      if (!mes.dataset.hudEvicted) return;
      mes.classList.add('hud-perf-visible');
      mes.classList.remove('hud-perf-older');
      restoreEvictedCard(mes);
      safeProcessMessage(mes);
    });
  }

  // Свернуть карточку в заглушку. Высоту заглушки задаём по фактической
  // высоте карточки: при прокрутке вверх без этого лента схлопывается под
  // курсором и уезжает на сотни пикселей.
  function collapseCard(mes, keepHeight, спрятать = false) {
    if (!mes || mes.dataset.hudEvicted) return false;
    if (isMessageBeingEdited(mes)) return false;
    // Видимую карточку не сворачиваем никогда: обратно она бы не собралась,
    // потому что сообщение не покидает экран и наблюдателю не о чем сообщать.
    // Спрятанная карточка обратно не собирается, поэтому видимость ей не помеха.
    if (!спрятать && наЭкране(mes)) return false;
    const textElement = mes.querySelector('.mes_text');
    if (!textElement || !mes.__hudSource || !mes.querySelector('.hud-os-card')) return false;
    // Высоту берём запомненную — ту, что была у карточки, пока она была на
    // экране. Мерить прямо сейчас нельзя: сворачиваем мы именно ушедшую за
    // край карточку, а у неё из-за content-visibility работает не настоящая
    // высота, а заявленная contain-intrinsic-size. Заглушка тогда выходила
    // втрое выше самой карточки и раздувала прокрутку.
    // Без своего замера высоту заглушке даёт переменная --hud-card-h из CSS:
    // так уже расставленные заглушки поправятся, как только чат сообщит
    // настоящую высоту карточки.
    const height = keepHeight ? Number(mes.__hudCardHeight || 0) : 0;
    // Сворачиваем саму карточку, а не весь текст сообщения. Раньше заглушка
    // занимала место всего .mes_text, и проза вокруг карточки исчезала
    // вместе с ней — в старых сообщениях от ответа оставалась одна строчка
    // «HUD свёрнут».
    const карточка = Array.from(textElement.querySelectorAll('.hud-os-card'))
      .filter(c => !c.closest('.hud-theme-preview'))[0];
    if (!карточка) return false;
    const заглушка = document.createElement('div');
    заглушка.className = 'hud-evicted';
    заглушка.title = 'Карточка свёрнута ради скорости. Нажмите — соберётся заново.';
    заглушка.textContent = 'HUD свёрнут';
    заглушка.setAttribute('role', 'button');
    заглушка.tabIndex = 0;
    const развернуть = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      restoreEvictedCard(mes);
      safeProcessMessage(mes);
    };
    заглушка.addEventListener('click', развернуть);
    заглушка.addEventListener('keydown', развернуть);
    if (height > 40) заглушка.style.minHeight = height + 'px';
    карточка.replaceWith(заглушка);
    mes.dataset.hudEvicted = спрятать ? 'hidden' : '1';
    return true;
  }

  function enforceCardLimit() {
    const limit = Number(settings.hudCardLimit) || 0;
    if (limit <= 0) return;
    const container = cachedChatContainer;
    if (!container) return;
    const live = Array.from(container.querySelectorAll('.mes')).filter(
      mes => !mes.dataset.hudEvicted && mes.querySelector('.hud-os-card'));
    const extra = live.length - limit;
    if (extra <= 0) return;
    // Лимит срезает самые старые карточки — они далеко вверху, и держать их
    // высоту незачем: прокрутку это только удлинит.
    // Кандидаты — только вдали от экрана: листая вверх, читают как раз самые
    // старые карточки, и свернуть их на глазах нельзя.
    const запас = Math.round((window.innerHeight || 800) * 1.5);
    // «Прятать совсем»: старые карточки убираем сразу, даже на экране, —
    // они не возвращаются, и заглушки не видно. Живыми остаются последние N.
    const спрятать = settings.hideOldCards === true;
    const кандидаты = спрятать ? live : live.filter(mes => !наЭкране(mes, запас));
    for (let i = 0; i < extra && i < кандидаты.length; i++) collapseCard(кандидаты[i], false, спрятать);
  }

  // Обратная операция: вернуть исходник и собрать карточку заново.
  function restoreEvictedCard(mes) {
    if (!mes || !mes.dataset.hudEvicted) return false;
    // Спрятанную старую карточку не возвращаем, пока включено «прятать совсем».
    if (mes.dataset.hudEvicted === 'hidden' && settings.hideOldCards === true) return false;
    const textElement = mes.querySelector('.mes_text');
    if (!textElement) { delete mes.dataset.hudEvicted; return false; }
    if (убратьЛишниеЗаглушки(mes, textElement)) return false;
    const заглушка = textElement.querySelector('.hud-evicted');
    // Обычный путь: на месте заглушки возвращаем сам блок, а весь текст
    // вокруг остаётся нетронутым — вместе со всем, что дописали другие
    // расширения после нашей отрисовки.
    if (заглушка && mes.__hudBlock) {
      заглушка.outerHTML = mes.__hudBlock;
      delete mes.dataset.hudEvicted;
      return true;
    }
    // Запасной путь для сообщений, свёрнутых прошлыми версиями: у них
    // отдельного блока не запомнено, только исходник целиком.
    if (!mes.__hudSource) {
      // Вернуть нечего — хотя бы не оставляем вечную надпись «HUD свёрнут»:
      // разбор попробует достать блок из текущего свайпа.
      if (заглушка) заглушка.remove();
      delete mes.dataset.hudEvicted;
      return false;
    }
    textElement.innerHTML = mes.__hudSource;
    delete mes.dataset.hudEvicted;
    return true;
  }

  function schedulePerformanceRefresh() {
    if (performanceScrollRaf) return;
    performanceScrollRaf = requestAnimationFrame(() => {
      performanceScrollRaf = 0;
      enforceCardLimit();
      // Семь проб elementFromPoint на каждый кадр прокрутки заставляли
      // телефон пересчитывать вёрстку посреди инерции. Застрявшая карточка
      // никуда не денется — проверяем, когда палец отпустил ленту.
      clearTimeout(застрявшиеТаймер);
      застрявшиеТаймер = setTimeout(вернутьЗастрявшие, 200);
      const wasActive = cachedChatContainer?.classList.contains('hud-performance-mode');
      const active = updatePerformanceMode();
      if (active && !wasActive) setupPerformanceObserver();
      if (!active && wasActive && performanceIntersectionObserver) {
        performanceIntersectionObserver.disconnect();
        performanceIntersectionObserver = null;
      }
    });
  }

  function processAllMessages() {
    const container = cachedChatContainer || document.querySelector('#chat') || document.querySelector('#chat-container');
    if (!container) return;
    const messages = Array.from(container.querySelectorAll('.mes'));
    const performanceActive = isPerformanceModeActive(container);
    if (performanceActive) {
      // На старте длинного чата рендерим только последние сообщения. Старые HUD
      // будут обработаны автоматически, когда попадут в область видимости.
      messages.slice(-PERFORMANCE_ACTIVE_WINDOW).forEach(el => safeProcessMessage(el));
      refreshPerformanceMessageClasses();
      setupPerformanceObserver();
    } else {
      messages.forEach(el => safeProcessMessage(el));
    }
  }

  const processingMessages = new WeakSet();
  function safeProcessMessage(messageElement) {
    if (!messageElement || isMessageBeingEdited(messageElement)) return;
    // Пока сообщение разбирается, повторный вызов раньше просто пропадал. Это
    // и ломало возврат свёрнутой карточки: IntersectionObserver возвращал
    // исходник и просил собрать карточку, а разбор в этот момент ещё шёл с
    // прошлого раза — просьба терялась, и сообщение оставалось голым текстом.
    // Запоминаем её и повторяем один раз, когда текущий разбор закончится.
    if (processingMessages.has(messageElement)) {
      messageElement.__hudReprocess = true;
      return;
    }
    processingMessages.add(messageElement);
    Promise.resolve(processMessage(messageElement))
      .catch(error => console.error('HUD Manager: processMessage failed', error))
      .finally(() => {
        processingMessages.delete(messageElement);
        if (messageElement.__hudReprocess) {
          delete messageElement.__hudReprocess;
          if (messageElement.isConnected) safeProcessMessage(messageElement);
        }
      });
  }

  function replaceHudBlockInText(source, newHudText) {
    if (typeof source !== 'string') return source;
    // Первый настоящий блок вне рассуждений; упоминание в <plan> не трогаем.
    const блок = hudБлоки(source)[0];
    if (блок) return source.slice(0, блок.index) + newHudText + source.slice(блок.index + блок.length);
    return source.trimEnd() + '\n\n' + newHudText;
  }

  function updateMessageDataForCurrentSwipe(message, newText) {
    message.mes = newText;
    // Номер свайпа за концом списка (бывает в импортированных чатах) не
    // трогаем: запись по нему завела бы лишний свайп без swipe_info.
    if (Array.isArray(message.swipes) && Number.isInteger(message.swipe_id)
        && message.swipe_id >= 0 && message.swipe_id < message.swipes.length) {
      message.swipes[message.swipe_id] = newText;
    }

    // SillyTavern/другие расширения могут рендерить extra.display_text вместо message.mes.
    // Если display_text уже содержит HUD — заменяем только его.
    // Если HUD создаётся впервые, добавляем его к сохранённому display_text,
    // чтобы updateMessageBlock() не вернул старую версию без HUD.
    if (message.extra && typeof message.extra.display_text === 'string') {
      const displayText = message.extra.display_text;
      const newHud = extractHudBlock(newText);

      if (естьHudБлок(displayText)) {
        message.extra.display_text = replaceHudBlockInText(displayText, newHud);
      } else if (newHud) {
        message.extra.display_text = displayText.trimEnd() + '\n\n' + newHud;
      }
    }
  }

  function getMessageUpdateFunction(stContext) {
    if (stContext && typeof stContext.updateMessageBlock === 'function') {
      return stContext.updateMessageBlock.bind(stContext);
    }
    if (typeof updateMessageBlock === 'function') return updateMessageBlock;
    if (typeof window.updateMessageBlock === 'function') return window.updateMessageBlock;
    return null;
  }

  async function readHudApiError(response) {
    let payload = null;
    let raw = '';
    try { raw = await response.text(); } catch (_) {}
    if (raw) {
      try { payload = JSON.parse(raw); } catch (_) { payload = null; }
    }
    const message = payload?.error?.message || payload?.message || payload?.error || (typeof payload === 'string' ? payload : '') || raw;
    const clean = String(message || '').replace(/\s+/g, ' ').trim();
    const safe = clean.length > 500 ? clean.slice(0, 500) + '…' : clean;
    const info = { status: response.status, statusText: response.statusText || '', message: safe || `HTTP ${response.status}` };
    window.__tavernOSLastHudApiError = { ...info, timestamp: Date.now() };
    return info;
  }

  // Идущие генерации HUD: по номеру сообщения — чем их отменить.
  const генерацииHUD = new Map();
  function отменитьГенерациюHUD(mesId) {
    const к = генерацииHUD.get(String(mesId));
    if (к && !к.signal.aborted) к.abort();
  }

  // Перегенерация HUD по 🔄 / ➕ и досоздание после проверки полноты
  // (regen.js) — грузится при первом нажатии.
  let загрузитьПерегенерациюОбещание = null;
  const загрузитьПерегенерацию = () => (загрузитьПерегенерациюОбещание ||= import('./regen.js?v=23.48.3').then(м => { м.подключить(связьПерегенерации); return м; }));
  const связьПерегенерации = {
    get buildHudLoreContext() { return buildHudLoreContext; },
    get getMessageUpdateFunction() { return getMessageUpdateFunction; },
    get readHudApiError() { return readHudApiError; },
    get replaceHudBlockInText() { return replaceHudBlockInText; },
    get safeProcessMessage() { return safeProcessMessage; },
    get showHudToast() { return showHudToast; },
    get updateMessageDataForCurrentSwipe() { return updateMessageDataForCurrentSwipe; },
    get генерацииHUD() { return генерацииHUD; },
    get загрузитьПромпт() { return загрузитьПромпт; },
    get запомнитьВерсиюHUD() { return запомнитьВерсиюHUD; },
    get отменитьГенерациюHUD() { return отменитьГенерациюHUD; },
    get показатьИндикаторHUD() { return показатьИндикаторHUD; },
    get раскрытьИнструкцию() { return раскрытьИнструкцию; },
    get сводкаHUD() { return сводкаHUD; },
    get текстСообщенияЧата() { return текстСообщенияЧата; },
  };
  function handleHudRegenButton(...аргументы) { return загрузитьПерегенерацию().then(м => м.handleHudRegenButton(...аргументы)); }

  // Кнопка «❓»: окно вопросов о сюжете. Ответ модели в чат не пишется.
  // Лорбуки для ассистента: записи, сработавшие по ключам на вопросе и
  // последних сообщениях, либо книги целиком — как выбрано в настройках.
  async function лорбукиДляАссистента(names, scanText, все) {
    const stContext = getStContextSafe();
    const out = [];
    for (const name of (Array.isArray(names) ? names : []).filter(Boolean)) {
      const data = await loadHudLorebook(name);
      const entries = data && Array.isArray(data.entries) ? data.entries
        : (data && data.entries && typeof data.entries === 'object' ? Object.values(data.entries) : []);
      const тексты = entries
        .filter(entry => все ? true : hudLoreEntryActivates(entry, scanText, stContext))
        .map(normalizeHudLoreEntry)
        .filter(Boolean);
      if (тексты.length) out.push({ name, entries: тексты });
    }
    return out;
  }

  // Профили подключения: сначала те, что Connection Manager умеет
  // использовать, иначе весь сохранённый список.
  function списокПрофилей() {
    const ctx = getStContextSafe();
    const служба = ctx && ctx.ConnectionManagerRequestService;
    try {
      if (служба && typeof служба.getSupportedProfiles === 'function') {
        const p = служба.getSupportedProfiles();
        if (Array.isArray(p) && p.length) return p;
      }
    } catch (_) { /* ниже запасной путь */ }
    const cm = ctx && ctx.extensionSettings && ctx.extensionSettings.connectionManager;
    return cm && Array.isArray(cm.profiles) ? cm.profiles : [];
  }

  function bindHudAskButton(btn) {
    if (!btn || btn.dataset.hudClickBound === 'true') return;
    btn.dataset.hudClickBound = 'true';
    const открыть = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      const mes = btn.closest('.mes');
      const id = mes ? Number(mes.getAttribute('mesid')) : NaN;
      // Помощник (render/assistant.js) грузится по первому вопросу.
      import('./render/assistant.js?v=23.48.3').then(({ openAssistantDialog }) => openAssistantDialog({ mesId: Number.isInteger(id) ? id : null, лорбуки: лорбукиДляАссистента, сохранить: saveSettings, профили: списокПрофилей }))
        .catch(e => { console.error('[TavernOS HUD] помощник не загрузился:', e); showHudToast('error', 'Помощник', 'Не загрузился: ' + (e && e.message || e)); });
    };
    btn.addEventListener('click', открыть, true);
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') открыть(e); });
  }

  // --- Прошлые версии HUD ------------------------------------------------------
  // Перегенерация кладёт прежний HUD в message.extra.hud_versions. extra у
  // SillyTavern своё у каждого свайпа (при смене свайпа он переносится в
  // swipe_info и обратно), так что и версии у каждого свайпа свои, и они
  // сохраняются в файле чата. Возврат меняет местами: текущий HUD встаёт в
  // версии, выбранный — в сообщение, так что вернуться можно и обратно.
  const ВЕРСИЙ_HUD = 10;
  function текстСообщенияЧата(message) {
    const свайп = message && Array.isArray(message.swipes) ? message.swipes[message.swipe_id] : undefined;
    return typeof свайп === 'string' ? свайп : String((message && message.mes) || '');
  }
  function версииHUD(message) {
    const e = message && message.extra;
    return e && Array.isArray(e.hud_versions) ? e.hud_versions.filter(v => v && typeof v.hud === 'string') : [];
  }
  function сохранитьВерсииHUD(message, список) {
    if (!message) return;
    if (!message.extra || typeof message.extra !== 'object') message.extra = {};
    message.extra.hud_versions = список.slice(-ВЕРСИЙ_HUD);
    const свайп = Array.isArray(message.swipe_info) && Number.isInteger(message.swipe_id) ? message.swipe_info[message.swipe_id] : null;
    if (свайп && typeof свайп === 'object') {
      if (!свайп.extra || typeof свайп.extra !== 'object') свайп.extra = {};
      свайп.extra.hud_versions = message.extra.hud_versions;
    }
  }
  function запомнитьВерсиюHUD(message, hud, подпись = '') {
    if (!message || !hud) return;
    const список = версииHUD(message).filter(v => v.hud !== hud);
    список.push({ hud, when: Date.now(), note: подпись });
    сохранитьВерсииHUD(message, список);
  }
  // Подпись версии: время и дата сцены из самого HUD.
  function подписьВерсии(v) {
    let сцена = '';
    try {
      const д = parseHUDComplex((hudБлоки(v.hud)[0] || {}).inner || v.hud);
      const время = String((д.scene && д.scene['Время']) || '').split('|')[0].trim();
      const дата = String((д.scene && д.scene['Дата']) || '').trim();
      сцена = [время, дата].filter(Boolean).join(' · ');
    } catch (_) { /* битый блок — без подписи сцены */ }
    const t = new Date(v.when || 0);
    const когда = isNaN(t) ? '' : String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    return { сцена: сцена || 'сцена не названа', когда, заметка: v.note || '' };
  }

  async function вернутьВерсиюHUD(messageElement, индекс) {
    const ctx = getStContextSafe();
    const id = Number(messageElement && messageElement.getAttribute('mesid'));
    const message = ctx && Array.isArray(ctx.chat) && Number.isInteger(id) ? ctx.chat[id] : null;
    if (!message) return;
    const список = версииHUD(message);
    const выбранная = список[индекс];
    if (!выбранная) return;
    const текст = текстСообщенияЧата(message);
    const текущий = extractHudBlock(текст);
    список.splice(индекс, 1);
    if (текущий) список.push({ hud: текущий, when: Date.now(), note: 'до возврата' });
    сохранитьВерсииHUD(message, список);
    updateMessageDataForCurrentSwipe(message, replaceHudBlockInText(текст, выбранная.hud));
    const обновить = getMessageUpdateFunction(ctx);
    if (обновить) await Promise.resolve(обновить(id, message, { rerenderMessage: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fresh = document.querySelector(`.mes[mesid="${id}"]`);
      if (fresh && fresh.isConnected) safeProcessMessage(fresh);
    }));
    const сохранить = (typeof ctx.saveChatConditional === 'function') ? ctx.saveChatConditional.bind(ctx)
      : (typeof ctx.saveChat === 'function') ? ctx.saveChat.bind(ctx) : null;
    if (сохранить) Promise.resolve(сохранить()).catch(e => showHudToast('error', 'Не сохранено', 'HUD возвращён, но не записан: ' + e.message));
    showHudToast('success', 'HUD возвращён', 'Прежний HUD снова в сообщении. Текущий — в списке «↶», его тоже можно вернуть.');
  }

  // Кнопка «↶ N» в шапке карточки — только если версии есть.
  function кнопкаВерсийHUD(messageElement, textElement) {
    const ctx = getStContextSafe();
    const id = Number(messageElement && messageElement.getAttribute('mesid'));
    const message = ctx && Array.isArray(ctx.chat) && Number.isInteger(id) ? ctx.chat[id] : null;
    const список = версииHUD(message);
    textElement.querySelectorAll('.hud-os-card').forEach(card => {
      if (card.closest('.hud-theme-preview')) return;
      const место = card.querySelector(':scope > .hud-os-topbar .hud-os-topbar-right');
      if (!место) return;
      const было = место.querySelector('.hud-versions-btn');
      if (!список.length) { if (было) было.remove(); return; }
      if (было) { было.querySelector('small').textContent = список.length; return; }
      const кнопка = document.createElement('span');
      кнопка.className = 'hud-versions-btn';
      кнопка.setAttribute('role', 'button');
      кнопка.tabIndex = 0;
      кнопка.title = 'Прошлые версии HUD — вернуть одну из них';
      кнопка.innerHTML = '↶<small>' + список.length + '</small>';
      const регенерация = место.querySelector('.hud-regen-btn');
      место.insertBefore(кнопка, регенерация || место.firstChild);
      const открыть = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        // Список живёт в body с фиксированной позицией: карточка обрезает всё,
        // что выходит за её край, и выпадающий список внутри шапки не был виден.
        const открытое = document.querySelector('.hud-versions-pop');
        if (открытое) { const тот = открытое.dataset.mes === String(id); открытое.remove(); if (тот) return; }
        const свежие = версииHUD((getStContextSafe() || {}).chat ? getStContextSafe().chat[id] : null);
        const окно = document.createElement('div');
        окно.className = 'hud-versions-pop';
        окно.dataset.mes = String(id);
        окно.setAttribute('role', 'menu');
        окно.innerHTML = '<b>Прошлые версии HUD</b>' + свежие.map((v, i) => ({ v, i })).reverse().map(({ v, i }) => {
          const п = подписьВерсии(v);
          return `<button type="button" role="menuitem" data-version="${i}"><span>${escapeHtml(п.сцена)}</span><small>${escapeHtml([п.когда, п.заметка].filter(Boolean).join(' · '))}</small></button>`;
        }).join('');
        окно.addEventListener('click', (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          const пункт = ev.target.closest('[data-version]');
          if (!пункт) return;
          окно.remove();
          void вернутьВерсиюHUD(messageElement, Number(пункт.dataset.version));
        }, true);
        document.body.appendChild(окно);
        const р = кнопка.getBoundingClientRect();
        окно.style.top = Math.min(р.bottom + 6, window.innerHeight - окно.offsetHeight - 8) + 'px';
        окно.style.right = Math.max(8, window.innerWidth - р.right) + 'px';
        // Клик мимо — закрыть.
        setTimeout(() => document.addEventListener('click', function мимо(ev) {
          if (!окно.contains(ev.target) && ev.target !== кнопка) { окно.remove(); document.removeEventListener('click', мимо, true); }
        }, true), 0);
      };
      кнопка.addEventListener('click', открыть, true);
      кнопка.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') открыть(e); });
    });
  }

  function bindHudRegenButton(regenBtn) {
    if (!regenBtn || regenBtn.dataset.hudClickBound === 'true') return;
    regenBtn.dataset.hudClickBound = 'true';
    // Соседняя кнопка «❓» живёт в той же панели и собирается вместе с ней.
    const спросить = regenBtn.parentElement && regenBtn.parentElement.querySelector('.hud-ask-btn');
    if (спросить) bindHudAskButton(спросить);

    const invoke = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      void handleHudRegenButton(regenBtn);
    };

    // Direct listener remains useful when ST does not intercept the event.
    regenBtn.addEventListener('click', invoke, true);
    regenBtn.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      invoke(e);
    }, true);
  }


  // --- Окно «Кастомизация» --------------------------------------------------
  // Само окно — в customize.js. Слева — панель темы, справа — живой HUD: последний
  // из чата, а если его ещё нет — пример. Цвета и шрифты ложатся на всю
  // страницу сразу (переменные на <html>), а смена вида блоков пересобирает
  // правую карточку; карточки в чате перерисовываются, когда окно закрыто.
  let видыМенялись = false;
  // Сменилась тема (events.js): у украшений на «Авто» разметка зависит от
  // темы — визитка, профиль, разделители, ханко, счёт дней. Окно открыто —
  // пересобираем просмотр, а чат — когда окно закроют; окна нет — сразу.
  const РАЗМЕТКА_ПО_ТЕМЕ = ['headerStyle', 'headerProfile', 'groupDividers', 'nameHanko', 'verticalName', 'dayCount', 'trustHearts'];
  document.addEventListener('hud-theme-changed', () => {
    if (!РАЗМЕТКА_ПО_ТЕМЕ.some(к => settings[к] === 'auto')) return;
    const окно = document.getElementById('hud-custom-modal');
    if (окно && окно.classList.contains('is-open')) { видыМенялись = true; собратьПросмотр(окно); }
    else перерисоватьКарточкиЧата();
  });


  // Прокрутка блоков карточки по их месту в разметке: id при пересборке
  // новые, а путь из классов и порядковых номеров остаётся тем же.
  function путьУзла(узел, корень) {
    const классы = (эл) => Array.from(эл.classList).filter(к => !/^(active|is-|fx-|hud-swap)/.test(к)).sort().join('.');
    const части = [];
    for (let у = узел; у && у !== корень; у = у.parentElement) {
      const род = у.parentElement;
      if (!род) break;
      const свои = классы(у);
      const братья = Array.from(род.children).filter(эл => эл.tagName === у.tagName && классы(эл) === свои);
      части.unshift(у.tagName + '.' + свои + ':' + братья.indexOf(у));
    }
    return части.join('>');
  }


  function перерисоватьКарточкиЧата() {
    const ctx = getStContextSafe();
    const обновить = getMessageUpdateFunction(ctx);
    if (!ctx || !Array.isArray(ctx.chat) || !обновить) return;
    document.querySelectorAll('#chat .mes').forEach(mes => {
      if (!mes.querySelector('.hud-os-card')) return;
      const id = Number(mes.getAttribute('mesid'));
      if (!Number.isInteger(id) || !ctx.chat[id]) return;
      try { обновить(id, ctx.chat[id]); } catch (_) { /* сообщение уже ушло из чата */ }
    });
  }


  // 🎨 на любой карточке открывает это же окно (events.js шлёт событие).
  document.addEventListener('hud:customize', () => открытьКастомизацию());

  // Панель расширения в «Расширениях» Таверны (settings-ui.js). Она нужна не
  // для первой отрисовки чата — грузится после запуска.
  let загрузитьПанельНастроекОбещание = null;
  const загрузитьПанельНастроек = () => (загрузитьПанельНастроекОбещание ||= import('./settings-ui.js?v=23.48.3').then(м => { м.подключить(связьНастроек); return м; }));
  const связьНастроек = {
    get applyThemeColors() { return applyThemeColors; },
    get cachedChatContainer() { return cachedChatContainer; },
    get enforceCardLimit() { return enforceCardLimit; },
    get getAvailableHudLorebooks() { return getAvailableHudLorebooks; },
    get hudVersionLabel() { return hudVersionLabel; },
    get processAllMessages() { return processAllMessages; },
    get restoreEvictedCard() { return restoreEvictedCard; },
    get safeProcessMessage() { return safeProcessMessage; },
    get saveSettings() { return saveSettings; },
    get setupPerformanceObserver() { return setupPerformanceObserver; },
    get showHudToast() { return showHudToast; },
    get updatePerformanceMode() { return updatePerformanceMode; },
    get запланироватьОблегчение() { return запланироватьОблегчение; },
    get наЭкране() { return наЭкране; },
    get открытьКастомизацию() { return открытьКастомизацию; },
    get списокПрофилей() { return списокПрофилей; },
  };
  function addSettingsUI(...аргументы) { return загрузитьПанельНастроек().then(м => м.addSettingsUI(...аргументы)); }


  
    function initWandButton() {
    function attachWandButton() {
        const wandMenu = document.getElementById('extensionsMenu');
        if (!wandMenu) return false;
        
        if (document.getElementById('hud-fix-wand-btn')) return true;

        const btn = document.createElement('div');
        btn.id = 'hud-fix-wand-btn';
        btn.className = 'list-group-item flex-container flexGapSm justifyCenter interactable';
        btn.innerHTML = `<span style="font-size:1.1em; opacity:0.8;">✂️</span><span>Fix HUD (Cut & Regen)</span>`;
        btn.style.cursor = 'pointer';

        btn.addEventListener('click', async () => {
            // Кнопка находится внутри уже открытого extensionsMenu.
            // Не переключаем extensions_button здесь: это могло закрыть меню
            // прямо в момент запуска операции.
            let stContext = typeof SillyTavern !== 'undefined' && SillyTavern.getContext ? SillyTavern.getContext() : (typeof window.getContext === 'function' ? window.getContext() : null);
            let chatData = stContext && stContext.chat ? stContext.chat : window.chat;
            if (!chatData || chatData.length === 0) return;
            
            let lastMesIndex = chatData.length - 1;
            let targetMessage = chatData[lastMesIndex];
            if (targetMessage.is_user || targetMessage.is_system) {
                 showHudToast('error', 'Ошибка', 'Последнее сообщение не от персонажа.');
                 return;
            }

            // Номер свайпа бывает за концом списка (импортированный чат, удалённый
            // свайп) — тогда текст свайпа пустой, а показывается mes.
            const текстСвайпа = Array.isArray(targetMessage.swipes) ? targetMessage.swipes[targetMessage.swipe_id] : undefined;
            let oldText = typeof текстСвайпа === 'string' ? текстСвайпа : String(targetMessage.mes || '');

            // Вырезаем только сам последний настоящий блок [HUD]…[/HUD]. Упоминание
            // метки в <plan> блоком не считается, а текст после блока (сводка
            // [HUD_SUMMARY], комментарии, заметки) остаётся на месте. Блока нет —
            // резать нечего: сразу создаём HUD, сообщение не трогаем.
            const блокHud = последнийHudБлок(oldText);
            if (блокHud) {
                const до = oldText.slice(0, блокHud.index).trimEnd();
                const после = oldText.slice(блокHud.index + блокHud.length).trimStart();
                const newText = до && после ? до + '\n\n' + после : (до || после);
                updateMessageDataForCurrentSwipe(targetMessage, newText);

                const updateFn = getMessageUpdateFunction(stContext);
                if (updateFn) {
                    await Promise.resolve(updateFn(lastMesIndex, targetMessage, { rerenderMessage: true }));
                }

                const saveFn = (stContext && typeof stContext.saveChatConditional === 'function') ? stContext.saveChatConditional.bind(stContext) : window.saveChatConditional;
                if (saveFn) await saveFn();

                showHudToast('success', 'Обрезано', 'Сломанный HUD удалён, текст ответа на месте. Запускаем регенерацию...');
            } else {
                showHudToast('success', 'HUD не найден', 'В сообщении нет блока [HUD] — текст не трогаем, создаём HUD.');
            }

            // HUD только что удалён, поэтому кнопки 🔄 Regen больше нет.
            // После штатного updateMessageBlock() заново обрабатываем сообщение
            // и запускаем именно ➕ Создать HUD.
            const startCreate = () => {
                try {
                    const freshMesEl =
                        document.querySelector(`.mes[mesid="${lastMesIndex}"]`) ||
                        document.querySelector('.mes:last-child');

                    if (!freshMesEl) {
                        showHudToast('error', 'Ошибка', 'Сообщение не найдено после очистки HUD.');
                        return;
                    }

                    safeProcessMessage(freshMesEl);

                    const createBtn = freshMesEl.querySelector('.hud-create-btn');
                    if (createBtn) createBtn.click();
                    else showHudToast('error', 'Ошибка', 'Кнопка «Создать HUD» не найдена.');
                } catch (createErr) {
                    showHudToast('error', 'Ошибка', 'Не удалось запустить создание HUD: ' + createErr.message);
                }
            };

            requestAnimationFrame(() => requestAnimationFrame(startCreate));
        });

        // ВАЖНО: кнопку нужно добавить в меню сразу после создания.
        // Ранее appendChild оказался внутри click-handler, поэтому кнопка
        // физически никогда не появлялась в меню.
        wandMenu.appendChild(btn);
        return true;
    }

    if (!attachWandButton()) {
        let tries = 0;
        const iv = setInterval(() => { 
            if (attachWandButton() || ++tries > 40) clearInterval(iv); 
        }, 250);
    }
  }
  

  // Окно «В лорбук» (lore-dialog.js) — грузится при первом открытии.
  let загрузитьЛорОбещание = null;
  const загрузитьЛор = () => (загрузитьЛорОбещание ||= import('./lore-dialog.js?v=23.48.3').then(м => { м.подключить(связьЛора); return м; }));
  const связьЛора = {
    get getAvailableHudLorebooks() { return getAvailableHudLorebooks; },
    get getMainProtagonistNames() { return getMainProtagonistNames; },
    get getStContextSafe() { return getStContextSafe; },
    get getStRequestHeadersSafe() { return getStRequestHeadersSafe; },
    get loadHudLorebook() { return loadHudLorebook; },
    get showHudToast() { return showHudToast; },
  };
  function openLoreDialog(...аргументы) { return загрузитьЛор().then(м => м.openLoreDialog(...аргументы)); }


  // Собирает отложенную вкладку при первом переключении на неё. Пустышка
  // заменяется настоящим блоком с тем же id, поэтому переключение вкладок
  // дальше работает как обычно и повторно ничего не считает.
  function renderLazyTab(placeholder) {
    if (!placeholder || !placeholder.classList.contains('hud-tab-lazy')) return placeholder;
    const card = placeholder.closest('.hud-os-card');
    // Заготовки кладутся на карточку сразу после вставки разметки. Если их
    // ещё нет вовсе, значит нас позвали слишком рано: признак отложенности
    // не снимаем, иначе вкладка останется пустой навсегда.
    if (!card || !card.__hudLazy) return placeholder;
    const thunk = card.__hudLazy[placeholder.id];
    if (!thunk) { placeholder.classList.remove('hud-tab-lazy'); return placeholder; }
    try {
      const box = document.createElement('div');
      box.innerHTML = thunk();
      const built = box.firstElementChild;
      if (!built) { placeholder.classList.remove('hud-tab-lazy'); return placeholder; }
      placeholder.replaceWith(built);
      delete card.__hudLazy[placeholder.id];
      return built;
    } catch (e) {
      console.error('[TavernOS HUD] Ленивая вкладка не собралась:', e);
      placeholder.classList.remove('hud-tab-lazy');
      placeholder.innerHTML = '<div class="hud-memory-error">Не удалось собрать вкладку.</div>';
      return placeholder;
    }
  }

  // Точка входа в окно «Запомнить» снаружи карточки: удобно дёрнуть из
  // консоли и проверить окно, не дожидаясь подходящего сообщения в чате.
  window.HUD.openLoreDialog = (text, keys) => openLoreDialog(text, keys);

  const eventsCtx = {
    openLoreDialog,
    renderLazyTab,
    enforceCardLimit,
    restoreEvictedCard,
    getChatContainer: () => cachedChatContainer,
    getPerformanceObserver: () => performanceIntersectionObserver,
    saveSettings,
    applyThemeColors,
    showHudToast,
    safeProcessMessage,
    // Мини-гайд: словари и сборка разметки лежат в help.js.
    tabHelp: TAB_HELP,
    findTermHelp,
    buildHintHTML,
    attachHelpMarks: (корень) => { if (settings.showHints !== false) attachHelpMarks(корень); centerFieldIcons(корень); },
    isPerformanceModeActive,
    refreshPerformanceMessageClasses,
    schedulePerformanceRefresh,
  };

  /* Проверка полноты HUD после ответа (hud-check.js). Досоздание идёт через
     ту же кнопку 🔄 / ➕, что и вручную: ждём, пока ST дорисует сообщение и
     HUD соберёт кнопку, и нажимаем её обработчик. */
  async function перегенерироватьHUDСообщения(id) {
    for (let i = 0; i < 30; i++) {
      const mes = document.querySelector(`.mes[mesid="${id}"]`);
      if (mes) {
        if (!mes.querySelector('.hud-regen-btn')) safeProcessMessage(mes);
        const кнопка = mes.querySelector('.hud-regen-btn');
        if (кнопка && !кнопка.classList.contains('hud-spinning')) {
          await handleHudRegenButton(кнопка);
          return true;
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }

  let проверкаПолноты = null;
  function подключитьПроверкуПолноты() {
    if (проверкаПолноты) return;
    const ctx = window.SillyTavern?.getContext?.();
    const es = ctx?.eventSource, et = ctx?.event_types;
    if (!es || !et?.MESSAGE_RECEIVED) return;
    проверкаПолноты = создатьПроверкуПолноты({
      чат: () => window.SillyTavern?.getContext?.()?.chat || [],
      ключЧата: () => { const c = window.SillyTavern?.getContext?.(); return String(c?.getCurrentChatId?.() ?? c?.chatId ?? ''); },
      перегенерировать: перегенерироватьHUDСообщения,
      сообщить: showHudToast,
    });
    if (et.GENERATION_STOPPED) es.on(et.GENERATION_STOPPED, () => проверкаПолноты.остановлено());
    // Не ждём внутри обработчика: ST ждёт своих слушателей, прежде чем сохранить чат.
    es.on(et.MESSAGE_RECEIVED, (messageId, type) => {
      setTimeout(() => { проверкаПолноты.послеОтвета(messageId, type).catch(e => console.warn('[TavernOS HUD] Проверка полноты', e)); }, 800);
      setTimeout(() => учестьПоляОтвета(messageId, type), 400);
      обновитьЧипыБюджетаПозже(2500);
    });
    if (et.CHAT_CHANGED) es.on(et.CHAT_CHANGED, () => { кэшБюджета = null; запросТаверны = null; лорбукТаверны = null; обновитьЧипыБюджетаПозже(3000); });
    // Лорбук, который Таверна вставила в последний запрос: его записи.
    if (et.WORLD_INFO_ACTIVATED) es.on(et.WORLD_INFO_ACTIVATED, (записи) => {
      try { const сп = Array.isArray(записи) ? записи : []; лорбукТаверны = { токены: оценкаТокенов(сп.map(з => (з && з.content) || '').join('\n')), записей: сп.length }; кэшБюджета = null; } catch (_) { /* нет — нет */ }
    });
  }

  let initRetries = 0;
  function initApp() {
    const chatContainer = document.querySelector('#chat') || document.querySelector('#chat-container');
    if (!chatContainer) {
      if (initRetries < 40) { initRetries++; setTimeout(initApp, 500); }
      return;
    }
    cachedChatContainer = chatContainer;
    loadSettings(); 
    // Стили — сразу по загрузке настроек и до первой карточки: параллельно и
    // по включённости фич (css-loader.js).
    try { подключитьСтили(settings); } catch (e) { console.error('[TavernOS HUD] стили', e); }
    restoreLastTavernRequest();
    // Макрос {{hudLast}} — и для нашей инструкции, и для пресетов.
    зарегистрироватьМакросHUD();
    подключитьПроверкуПолноты();
    initGlobalEvents(eventsCtx);
    initTavernOSEvents(eventsCtx);	
    initWandButton(); // Наша новая кнопка!
    updatePerformanceMode();
    processAllMessages(); 
    обновитьЧипыБюджетаПозже(4000);
    initObserver(eventsCtx, chatContainer);
    if (isPerformanceModeActive(chatContainer)) setupPerformanceObserver();
    chatContainer.addEventListener('scroll', schedulePerformanceRefresh, { passive: true });
    addSettingsUI();
    // Инструкция HUD нужна к первой генерации — подтягиваем, когда страница затихнет.
    (window.requestIdleCallback || ((f) => setTimeout(f, 2000)))(() => { загрузитьПромпт().catch(() => {}); });
  }
  setTimeout(initApp, 500);
})();
