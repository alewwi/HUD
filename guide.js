// hud-manager/guide.js
//
// Окно «Гайд» (Настройки → 📘 Гайд): подробное руководство по HUD.
//
// Текст — GUIDE.md и GUIDE.en.md, как у «Что нового» с чейнджлогом: правится
// как обычный документ, английский — своим файлом, без словаря. Два раздела
// собираются на месте, чтобы не отставать от кода:
//   <!-- guide:settings --> — каждая настройка из живой панели «📊 TavernOS»
//     с её пояснением (title), по группам, в том порядке, в каком они стоят;
//   <!-- guide:fields -->   — поля, которые пишет модель: каталог «Глубокой
//     настройки» (код и название) и словарь вопросиков (что это).
// Слева оглавление по разделам, сверху поиск по всему тексту.

import { английский, т } from './i18n.js?v=23.89.92';
import { escapeHtml } from './utils.js?v=23.89.92';
import { TAB_HELP, findTermHelp } from './help.js?v=23.89.92';
import { КАТАЛОГ } from './deep-fields.js?v=23.89.92';

let открыто = false;
const э = (s) => escapeHtml(String(s ?? ''));

/* --- Markdown: ровно то, что есть в GUIDE.md ------------------------------
   ## раздел, ### подраздел, абзацы, списки «-» и «1.» (вложенность — два
   пробела), «>» — заметка, ``` — код, **жирный**, *курсив*, `код`, ссылки. */
export function строкаГайда(s) {
  return э(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(«])\*([^*\s][^*]*?)\*(?=[\s).,;:!?»]|$)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/** Разбор: [{ id, заголовок, html }] по разделам «##». Метки <!-- guide:… --> — { вставка }. */
export function разобратьГайд(текст) {
  const разделы = [];
  let раздел = null, абзац = [], списки = [], код = null;
  const id = (з, i) => 'g-' + i + '-' + з.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);
  const куда = () => { if (!раздел) { раздел = { id: 'g-intro', заголовок: '', части: [] }; разделы.push(раздел); } return раздел.части; };
  const закрытьАбзац = () => { if (абзац.length) { куда().push(`<p>${строкаГайда(абзац.join(' '))}</p>`); абзац = []; } };
  const закрытьСписки = (до = 0) => { while (списки.length > до) { const с = списки.pop(); const html = `<${с.тег}>${с.пункты.map(п => `<li>${п}</li>`).join('')}</${с.тег}>`; if (списки.length) { const верх = списки[списки.length - 1]; верх.пункты[верх.пункты.length - 1] += html; } else куда().push(html); } };
  for (const сырая of String(текст || '').split(/\r?\n/)) {
    if (код) { if (/^```/.test(сырая)) { куда().push(`<pre><code>${э(код.join('\n'))}</code></pre>`); код = null; } else код.push(сырая); continue; }
    if (/^```/.test(сырая)) { закрытьАбзац(); закрытьСписки(); код = []; continue; }
    const вставка = сырая.match(/^<!--\s*guide:(\w+)\s*-->$/);
    if (вставка) { закрытьАбзац(); закрытьСписки(); куда().push({ вставка: вставка[1] }); continue; }
    if (/^#\s/.test(сырая)) continue;
    const з2 = сырая.match(/^##\s+(.+?)\s*$/);
    if (з2) { закрытьАбзац(); закрытьСписки(); раздел = { id: id(з2[1], разделы.length), заголовок: з2[1], части: [] }; разделы.push(раздел); continue; }
    const з3 = сырая.match(/^###\s+(.+?)\s*$/);
    if (з3) { закрытьАбзац(); закрытьСписки(); куда().push(`<h4>${строкаГайда(з3[1])}</h4>`); continue; }
    const пункт = сырая.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (пункт) {
      закрытьАбзац();
      const уровень = Math.floor(пункт[1].length / 2) + 1, тег = /\d/.test(пункт[2]) ? 'ol' : 'ul';
      закрытьСписки(уровень);
      while (списки.length < уровень) списки.push({ тег, пункты: [] });
      списки[списки.length - 1].пункты.push(строкаГайда(пункт[3]));
      continue;
    }
    const заметка = сырая.match(/^>\s?(.*)$/);
    if (заметка) { закрытьАбзац(); закрытьСписки(); куда().push(`<div class="hud-guide-tip">${строкаГайда(заметка[1])}</div>`); continue; }
    if (!сырая.trim()) { закрытьАбзац(); закрытьСписки(); continue; }
    // Продолжение пункта списка на следующей строке с отступом.
    if (списки.length && /^\s{2,}\S/.test(сырая)) { const с = списки[списки.length - 1]; с.пункты[с.пункты.length - 1] += ' ' + строкаГайда(сырая.trim()); continue; }
    закрытьСписки();
    абзац.push(сырая.trim());
  }
  закрытьАбзац(); закрытьСписки();
  return разделы;
}

/* --- Все настройки: из живой панели -------------------------------------- */
const чисто = (s) => String(s || '').replace(/\s+/g, ' ').trim();
function подписьЭлемента(эл) {
  const копия = эл.cloneNode(true);
  копия.querySelectorAll('select, input, textarea, option, .hud-help-mark, .hud-set-q, .hud-set-cost, .hud-qs-cost, script, style').forEach(x => x.remove());
  return чисто(копия.textContent).replace(/[:：]\s*$/, '');
}
function пунктНастройки(эл) {
  const имя = подписьЭлемента(эл);
  if (!имя) return '';
  const пояснение = чисто(эл.getAttribute('title') || эл.querySelector('[title]')?.getAttribute('title') || '');
  const варианты = [...эл.querySelectorAll('select option')].map(o => чисто(o.textContent)).filter(Boolean);
  return `<li><b>${э(имя)}</b>${пояснение ? ` — ${э(пояснение)}` : ''}${варианты.length > 1 && варианты.length <= 12 ? `<div class="hud-guide-opts">${варианты.map(в => `<span>${э(в)}</span>`).join('')}</div>` : ''}</li>`;
}
// Элементы внутри одного уровня группы: свои пункты, заметки и подгруппы; во
// вложенные группы не заходим — у них свой список.
function пунктыУровня(корень) {
  const out = [];
  const обойти = (узел) => {
    for (const ребёнок of узел.children) {
      // Списки, которые панель заполняет сама (аватарки персонажей), — это данные
      // игрока, а не настройки: в гайде без них, иначе десятки «Заменить картинку».
      if (ребёнок.matches('.hud-ava-list, [data-guide-skip]')) continue;
      if (ребёнок.matches('details.hud-set-group')) { out.push(группаНастроек(ребёнок)); continue; }
      if (ребёнок.matches('label.hud-set-check, label')) { out.push(пунктНастройки(ребёнок)); continue; }
      if (ребёнок.matches('button, .menu_button, .hud-set-tool-btn')) { const имя = подписьЭлемента(ребёнок); if (имя) out.push(`<li><b>${э(имя)}</b>${ребёнок.title ? ` — ${э(чисто(ребёнок.title))}` : ''}</li>`); continue; }
      if (ребёнок.matches('.hud-set-note, [data-guide-note]')) { const т = чисто(ребёнок.textContent); if (т) out.push(`<li class="hud-guide-note">${э(т)}</li>`); continue; }
      if (ребёнок.matches('input, select, textarea, [hidden]') || ребёнок.hidden) continue;
      обойти(ребёнок);
    }
  };
  обойти(корень);
  return out.filter(Boolean);
}
function группаНастроек(details) {
  const заголовок = чисто(details.querySelector(':scope > summary')?.textContent);
  const тело = details.querySelector(':scope > .hud-set-body') || details;
  const пункты = пунктыУровня(тело);
  if (!пункты.length) return '';
  return `<li class="hud-guide-group"><details><summary>${э(заголовок)}</summary><ul>${пункты.join('')}</ul></details></li>`;
}
export function настройкиИзПанели(корень = document.getElementById('hud-settings-wrapper')) {
  if (!корень) return `<p class="hud-guide-note">${э(т('Откройте настройки HUD в «Расширениях», и здесь появится полный список.'))}</p>`;
  const тело = корень.querySelector(':scope > div') || корень;
  const пункты = пунктыУровня(тело);
  return `<ul class="hud-guide-settings">${пункты.join('')}</ul>`;
}

/* --- Поля, которые пишет модель ----------------------------------------- */
// Пояснения полей, у которых нет своей статьи «?» (help.js): общие слова вроде
// «Вид» или «Состояние» статьёй прилипли бы к чужим строкам карточки, поэтому —
// только здесь, для гайда. [по-русски, по-английски].
export const ПОЯСНЕНИЯ_ПОЛЕЙ = {
  "Настроение сцены": ["Общее настроение сцены в паре слов — видно в шапке рядом с погодой.", "The overall mood of the scene in a few words, shown in the header next to the weather."],
  "Тело и душа": ["Что сейчас с телом и чувствами человека: поза, ощущения, эмоции — одной-двумя фразами.", "What is going on with the person’s body and feelings right now: posture, sensations, emotions, in a sentence or two."],
  "Состояние тела": ["Шкалы от 0 до 100: энергия, бодрость, сытость, жажда, стресс и другие — с коротким словом к каждой.", "Gauges from 0 to 100: energy, alertness, fullness, thirst, stress and more, each with a short word."],
  "Ключевые мысли": ["Главное, о чём человек думает сейчас, — несколько коротких пунктов.", "The main things on the person’s mind right now, as a few short points."],
  "Ожидание и реальность": ["На что человек рассчитывал в этой сцене и что получил. Интересен как раз разрыв.", "What the person counted on in this scene and what they got. The gap is the point."],
  "Разоблачение": ["Насколько у человека сползла маска при других: что выдало его и кто заметил.", "How far the person’s mask has slipped in front of others: what gave them away and who noticed."],
  "Флаги": ["Открытые нити вокруг человека: обещания, долги, угрозы, последствия, которые ещё не наступили.", "Open threads around the person: promises, debts, threats and consequences still waiting to land."],
  "Число партнёров": ["Сколько у человека было партнёров — по тому, что известно в истории.", "How many partners the person has had, as far as the story knows."],
  "Регулярность": ["Как часто сейчас бывает близость и с кем, как человек справляется в промежутках, насколько сильно влечение.", "How often they have sex these days and with whom, how they cope in between, how strong the libido is."],
  "Кинки": ["Что человеку нравится в близости — его предпочтения.", "What the person enjoys in intimacy: their preferences."],
  "Фетиши": ["Особые влечения человека, если они есть.", "The person’s particular fixations, if any."],
  "Никогда": ["Границы: чего человек в близости не допустит.", "Limits: what the person will never do in intimacy."],
  "Раунд": ["Номер раунда близости в этой сцене: 1 — первый.", "The number of the current round of intimacy in this scene, 1 for the first."],
  "Длительность": ["Сколько уже длится близость в этой сцене.", "How long the intimacy in this scene has lasted so far."],
  "Пульс и дыхание": ["Пульс, дыхание и температура во время близости и пока человек успокаивается после.", "Pulse, breathing and temperature during intimacy and while the person calms down afterwards."],
  "Подробности близости": ["Только во время близости: возбуждение, касания, реакции тела — подробно, по меткам.", "Only during intimacy: arousal, touch, the body’s reactions, in detail, by labels."],
  "Отзыв": ["Когда близость закончилась: несколько фраз от лица человека — что было хорошо, что нет, лучший и самый неловкий момент.", "Once intimacy is over: a few sentences in the person’s own voice about what worked, what didn’t, the best and the most awkward moment."],
  "События дня": ["Что случилось за день по порядку — из этого собираются летопись и архив.", "What happened during the day, in order. The chronicle and the archive are built from it."],
  "Быт хода": ["Что люди делали по хозяйству в этом ходу: еда, сон, мытьё, покупки, уборка. Из этого считается «Быт».", "Chores people did this turn: food, sleep, washing, shopping, cleaning. Daily life is counted from it."],
  "Факты": ["Важное, что стоит помнить дальше: решения, открытия, договорённости.", "Important things worth remembering later: decisions, discoveries, agreements."],
  "Время записи": ["Когда человек сделал запись в дневнике — по времени сцены.", "When the person wrote the diary entry, in scene time."],
  "Запись об игроке": ["Что персонаж пишет в дневнике о вашем герое.", "What the character writes in the diary about your character."],
  "Настроение листа": ["Настроение записи — по нему меняется оформление страницы дневника.", "The mood of the entry; the diary page changes its look by it."],
  "Толкование": ["Что сон может значить для человека — короткое толкование.", "What the dream may mean for the person, a short reading."],
  "Вид": ["Кто это: животное, фамильяр, дрон, робот.", "What it is: an animal, a familiar, a drone, a robot."],
  "Хозяин": ["Чей это спутник или к кому он привязан.", "Whose companion it is or whom it is bound to."],
  "Умения": ["Три-четыре самых заметных умения, трюка или привычки спутника.", "The companion’s three or four most telling skills, tricks or quirks."],
  "Состояние": ["Здоровье спутника: раны, усталость, заряд.", "The companion’s condition: injuries, tiredness, charge."],
  "Питание": ["Чем спутник питается или заряжается и когда в последний раз.", "What the companion eats or runs on, and when it last did."],
  "Привязанность": ["Насколько сильна связь с хозяином или с близкими, от 0 до 100.", "How strong the bond with the owner or with family is, from 0 to 100."],
  "Чем занят": ["Что спутник делает прямо сейчас.", "What the companion is doing right now."],
  "Потребности": ["Шкалы спутника от 0 до 5: сытость, энергия, чистота, настроение (у машины — заряд и исправность).", "The companion’s needs from 0 to 5: fullness, energy, cleanliness, mood (for a machine: charge and working order)."],
  "Очерёдность": ["Кто в бою действует первым, кто следом — по порядку.", "Who acts first in the fight and who next, in order."],
  "Укрытия": ["За чем можно укрыться и что схватить рядом — и насколько это защищает.", "What can be used for cover or grabbed nearby, and how well it protects."],
  "Нервы": ["Как держится каждый в бою: действует, дрожит, замер, паникует или бежит.", "How each person holds up in the fight: acting, shaking, frozen, panicking or fleeing."],
  "Кем приходится": ["Кем малыш приходится героям: сын, дочь, племянник.", "How the baby is related to the characters: son, daughter, nephew."],
  "Где сейчас": ["Где малыш в эту минуту и с кем.", "Where the baby is right now and with whom."],
  "Тело и настроение": ["Как малыш себя чувствует и в каком он настроении.", "How the baby feels and what mood it is in."],
  "Болезни": ["Чем малыш болеет и как лечат.", "What the baby is ill with and how it is treated."],
  "Отметины": ["Видимые следы на теле малыша: синяки, сыпь, царапины.", "Visible marks on the baby’s body: bruises, rash, scratches."],
  "Уход": ["Когда малыша кормили, когда он спал и когда меняли подгузник.", "When the baby was last fed, slept and had a nappy change."],
  "Режим дня": ["Распорядок малыша: кормления, сон, прогулки.", "The baby’s routine: feeds, naps, walks."],
  "Вещи": ["Вещи малыша: одежда, игрушки, коляска.", "The baby’s things: clothes, toys, a pram."],
  "Впечатления": ["Что малыш замечает и чему радуется или пугается.", "What the baby notices and what delights or scares it."],
  "Первые слова": ["Слова и звуки, которые малыш уже говорит.", "The words and sounds the baby already says."],
  "Реакции на людей": ["Как малыш ведёт себя с каждым из близких.", "How the baby behaves with each of the people around it."],
  "Новости": ["Новости мира этого дня — то, что могло бы попасть в газету.", "The day’s news of the world, the kind that could make the paper."],
  "Объявления": ["Объявления и реклама: что продают, кого ищут, что открылось.", "Classifieds and ads: what is for sale, who is wanted, what has opened."],
  "Шрамы": ["HUD напоминает модели о старой ране в доверии: раз в восемь ответов, чтобы её не забыли, но и не выпячивали.", "The HUD reminds the model of an old wound in trust, once every eight replies, so it is neither forgotten nor overplayed."],
  "Впечатление от сдвига доверия": ["Когда доверие резко изменилось, HUD просит модель показать, как человек это переживает.", "When trust changes sharply, the HUD asks the model to show how the person takes it."],
  "Соперник": ["Подсказка модели о сопернике в словесной дуэли: кто ведёт и как отвечает проигрывающий.", "A note for the model about the opponent in a verbal duel: who is ahead and how the one losing answers back."],
  "Живые детали": ["Короткие напоминания модели о теле: голод, жажда, усталость, боль, холод и жара в помещении, похмелье, фазы цикла, беременность, кормление, свежие следы — самое сильное первым и только уместное в сцене. Модель показывает примету в манере персонажа и не называет состояние.", "Short reminders to the model about the body: hunger, thirst, tiredness, pain, cold and heat indoors, a hangover, cycle phases, pregnancy, breastfeeding, fresh marks — the strongest first and only what fits the scene. The model shows the sign in the character’s own manner and never names the state."],
  "Живые детали близости": ["Приметы тела в близости: желание и влага до сцены, фетиш в кадре, тело у оргазма от 60, долгая сцена, месячные, живот, молоко, «после». Только когда часть про близость уходит модели; характер персонажа решает, как это видно.", "Body signs in intimacy: desire and wetness before the scene, a fetish in sight, the body close to orgasm from 60, a long scene, a period, a belly, milk, after. Only when the intimacy part goes to the model; the character decides how it shows."],
  "Просьба записать вес": ["HUD просит модель указать рост, вес и активность, если их нет, — без них не посчитать норму еды.", "The HUD asks the model for height, weight and activity when they are missing; the food norm cannot be counted without them."],
  "Праздники": ["Заметки модели о праздниках мира: перед праздником, в сам день и итог после.", "Notes to the model about the world’s holidays: before the day, on the day and the outcome after."],
  "Сроки": ["Когда срок ружья или плана из календаря прошёл, HUD просит модель решить: случилось или сорвалось.", "When the deadline of a gun or a calendar plan has passed, the HUD asks the model to settle whether it happened or failed."],
  "Напоминания о близости": ["Плашки для вас: после потери, родов или свежей раны близость может быть рано.", "Plates for you: after a loss, a birth or a fresh wound it may be too early for intimacy."],
  "Значки вопросов": ["Числа на вкладках: сколько вопросов ждёт вашего ответа (память, беременность, «Назревает»).", "Numbers on the tabs: how many questions are waiting for your answer (memory, pregnancy, Building up)."],
  "Разовые подсказки": ["Кнопки у важного, ружей, секретов, слухов и новостей: нажали — одна просьба уйдёт модели в следующий ответ.", "Buttons on important things, guns, secrets, rumours and news: press one and a single request goes to the model with the next reply."],
  "Осмотры": ["Плановые осмотры беременности на 12-й, 20-й и 30-й неделе — HUD предложит их сам.", "Pregnancy check-ups at weeks 12, 20 and 30; the HUD offers them itself."],
  "Кубик угрозы": ["Когда беременности что-то угрожает, исход решает бросок кубика — его делаете вы.", "When a pregnancy is threatened, the outcome is decided by a dice roll, and you make it."],
};
const ВКЛАДКА = { cs: 'character', us: 'user', me: 'memory', dy: 'diary', dr: 'dreams', pet: 'pets', cb: 'combat', bb: 'babies', wd: 'world' };
export function поляМодели() {
  return КАТАЛОГ.map(р => {
    const вкладка = TAB_HELP[ВКЛАДКА[р.код]];
    const вНастройках = /^(?:nt|ui)$/.test(р.код);
    const группы = р.группы.map(г => {
      const поля = г.поля.map(([код, имя, под]) => {
        const статья = findTermHelp(имя);
        const своё = ПОЯСНЕНИЯ_ПОЛЕЙ[имя];
        const что = статья ? т(статья.what) : своё ? своё[английский() ? 1 : 0] : '';
        return `<li><code>${э(код)}</code> <b>${э(т(имя))}</b>${что ? ` — ${э(что)}` : ''}`
          + (под && под.length ? `<div class="hud-guide-opts">${под.map(([пк, пи]) => `<span><code>${э(пк)}</code> ${э(т(пи))}</span>`).join('')}</div>` : '') + `</li>`;
      }).join('');
      return `<h5>${э(т(г.имя))}${г.код && г.код !== р.код ? ` <code>${э(г.код)}</code>` : ''}</h5><ul>${поля}</ul>`;
    }).join('');
    return `<details class="hud-guide-group"><summary>${э(т(р.имя))} ${вНастройках ? `<small>${э(т('пишет HUD, не модель'))}</small>` : `<code>${э(р.код)}</code>`}</summary>`
      + (вкладка ? `<p class="hud-guide-note">${э(т(вкладка.what))} ${э(т(вкладка.how))}</p>` : '') + группы + `</details>`;
  }).join('');
}

/* --- Окно ------------------------------------------------------------------ */
async function загрузить() {
  const файл = английский() ? 'GUIDE.en.md' : 'GUIDE.md';
  const адрес = new URL(файл, import.meta.url);
  адрес.searchParams.set('v', new URL(import.meta.url).searchParams.get('v') || String(Date.now()));
  const ответ = await fetch(адрес.href);
  if (!ответ.ok) throw new Error('HTTP ' + ответ.status);
  return разобратьГайд(await ответ.text());
}

function собрать(разделы) {
  const вставки = { settings: () => настройкиИзПанели(), fields: () => поляМодели() };
  const тело = разделы.map(р => `<section class="hud-guide-sec" id="${р.id}">${р.заголовок ? `<h3>${строкаГайда(р.заголовок)}</h3>` : ''}`
    + р.части.map(ч => (typeof ч === 'string' ? ч : `<div class="hud-guide-gen" data-gen="${ч.вставка}">${(вставки[ч.вставка] || (() => ''))()}</div>`)).join('') + `</section>`).join('');
  const оглавление = разделы.filter(р => р.заголовок).map(р => `<a href="#${р.id}" data-guide-go="${р.id}">${строкаГайда(р.заголовок)}</a>`).join('');
  return { тело, оглавление };
}

// Поиск: показываем пункты, абзацы и группы с совпадением; раздел без
// совпадений прячем целиком. Пустой запрос — всё как было.
function искать(окно, запрос) {
  const q = запрос.trim().toLowerCase().replace(/ё/g, 'е');
  const текстУзла = (у) => (у.textContent || '').toLowerCase().replace(/ё/g, 'е');
  let найдено = 0;
  for (const сек of окно.querySelectorAll('.hud-guide-sec')) {
    let есть = false;
    for (const у of сек.querySelectorAll('li, p, pre, .hud-guide-tip, h4, h5')) {
      const да = !q || текстУзла(у).includes(q);
      у.classList.toggle('is-miss', !да);
      if (да) есть = true;
    }
    // Пункт со вложенным совпадением не прячем: родители совпавшего видны.
    if (q) сек.querySelectorAll('li:not(.is-miss), p:not(.is-miss), h5:not(.is-miss)').forEach(у => { for (let р = у.parentElement; р && р !== сек; р = р.parentElement) р.classList.remove('is-miss'); });
    if (q) сек.querySelectorAll('details').forEach(д => { д.open = !!д.querySelector('li:not(.is-miss)'); });
    const з = сек.querySelector('h3');
    if (з && q && текстУзла(з).includes(q)) { сек.querySelectorAll('.is-miss').forEach(у => у.classList.remove('is-miss')); есть = true; }
    сек.hidden = !!q && !есть;
    if (!сек.hidden) найдено++;
  }
  окно.querySelector('.hud-guide-empty').hidden = найдено > 0;
}

function нарисовать(разделы) {
  const { тело, оглавление } = собрать(разделы);
  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay hud-guide-overlay';
  overlay.innerHTML = `<div class="hud-modal hud-guide" role="dialog" aria-modal="true" aria-label="${э(т('Гайд'))}">
    <div class="hud-modal-head"><span>${э(т('Гайд по TavernOS HUD'))}</span>
      <input type="search" class="hud-guide-search" placeholder="${э(т('Поиск по гайду'))}" aria-label="${э(т('Поиск по гайду'))}">
      <button type="button" class="hud-guide-x" aria-label="${э(т('Закрыть'))}">✕</button></div>
    <div class="hud-guide-main">
      <nav class="hud-guide-toc" aria-label="${э(т('Оглавление'))}"><details open><summary>${э(т('Оглавление'))}</summary>${оглавление}</details></nav>
      <div class="hud-modal-body hud-guide-body">${тело}<p class="hud-guide-empty" hidden>${э(т('Ничего не нашлось'))}</p></div>
    </div>
  </div>`;
  // Текст гайда уже на нужном языке — словарь его не трогает. Собранные
  // разделы (настройки, поля) переведены при сборке.
  overlay.querySelector('.hud-guide-body').setAttribute('data-i18n-skip', '');
  overlay.querySelector('.hud-guide-toc').setAttribute('data-i18n-skip', '');
  const закрыть = () => { открыто = false; overlay.remove(); document.removeEventListener('keydown', поКлавише, true); };
  const поКлавише = (e) => { if (e.key === 'Escape') { e.stopPropagation(); закрыть(); } };
  document.addEventListener('keydown', поКлавише, true);
  let нажатоНаФоне = false;
  overlay.addEventListener('mousedown', (e) => { нажатоНаФоне = e.target === overlay; });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && нажатоНаФоне) return закрыть();
    const ссылка = e.target.closest('[data-guide-go]');
    if (ссылка) {
      e.preventDefault();
      const цель = overlay.querySelector('#' + CSS.escape(ссылка.dataset.guideGo));
      if (цель) цель.scrollIntoView({ block: 'start', behavior: 'smooth' });
      // На телефоне оглавление сверху — сворачиваем, чтобы было видно раздел.
      if (window.matchMedia && window.matchMedia('(max-width: 700px)').matches) overlay.querySelector('.hud-guide-toc details').open = false;
    }
  });
  overlay.querySelector('.hud-guide-x').addEventListener('click', закрыть);
  const поиск = overlay.querySelector('.hud-guide-search');
  let таймер = 0;
  поиск.addEventListener('input', () => { clearTimeout(таймер); таймер = setTimeout(() => искать(overlay, поиск.value), 120); });
  if (window.matchMedia && window.matchMedia('(max-width: 700px)').matches) overlay.querySelector('.hud-guide-toc details').open = false;
  document.body.appendChild(overlay);
  поиск.focus({ preventScroll: true });
  return overlay;
}

/** Открыть гайд. Возвращает true, если окно открылось. */
export async function показатьГайд() {
  if (открыто) return false;
  открыто = true;
  try {
    нарисовать(await загрузить());
    return true;
  } catch (e) {
    открыто = false;
    console.warn('[TavernOS HUD] Гайд', e);
    return false;
  }
}
