// hud-manager/history-maps.js
//
// Три сводки архива за один проход по чату (history-analyzer.js зовёт учесть
// на каждом ходе с HUD):
//  · календарь настроения — у каждого человека дни сюжета и настроения за день
//    (трекер настроения игрока и главного персонажа, настроение записей дневника);
//  · атлас мест — все места чата: сколько раз туда приходили, кто бывает чаще,
//    кто там, похоже, живёт (ночью) или работает (днём в будни), последний визит;
//  · карта отношений — кто часто вместе (в одном месте в одном ходу), как идёт
//    доверие каждой пары, давно ли они пересекались.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { getSafeUserName, имяБезПриставки } from './utils.js?v=23.89.28';
import { namesLikelySame } from './names.js?v=23.89.28';

const текст = (v) => (v === null || v === undefined ? '' : typeof v === 'string' ? v : Array.isArray(v) ? v.map(текст).join('; ') : typeof v === 'object' ? Object.values(v).map(текст).join('; ') : String(v)).trim();
const значимо = (s) => !!s && !/^(?:empty|none|null|—|-|n\/a|nc)$/i.test(String(s).trim());
const чистоеИмя = (s) => имяБезПриставки(String(s || '').trim()) || String(s || '').trim();

// Место «квартира Мари, гостиная, у окна» → «квартира Мари»: первая часть адреса.
// Адрес «от широкого к узкому» («Массачусетс, Бостон, особняк Кингсли, гостиная»)
// начинается с географии — части из одного-двух имён собственных (штат, город,
// район) пропускаем, пока за ними есть уточнение. Но первое слово по-русски
// пишут с заглавной и у обычного места («Поместье Кингсли, первый этаж»,
// «Кухня, у плиты»): часть со словом-местом — уже место, не география.
const ГЕОГРАФИЯ = /^(?:[\p{Lu}][\p{L}'’-]*)(?:\s+[\p{Lu}][\p{L}'’-]*)?$/u;
const СЛОВО_МЕСТА = /^(?:квартир|дом|домик|особняк|поместь|усадьб|пентхаус|кампус|университет|академи|колледж|институт|школ|общежит|офис|кабинет|комнат|спальн|кухн|гостин|столов|ванн|прихож|коридор|холл|зал|лестниц|балкон|террас|веранд|крыльц|подвал|чердак|гараж|паркинг|лифт|бар|клуб|кафе|кофейн|ресторан|отел|гостиниц|номер|больниц|клиник|палат|парк|сад|двор|лес|пляж|берег|озер|рек|улиц|площад|переул|шоссе|дорог|обочин|трасс|мост|набережн|башн|замок|замк|двор[её]ц|храм|церк|собор|магазин|рын|склад|серверн|лаборатор|библиотек|вилл|коттедж|дач|лофт|студи|салон|спортзал|стадион|бассейн|полици|участок|участк|тюрьм|вокзал|станци|аэропорт|порт|причал|яхт|корабл|машин|автомобил|поезд|самол[её]т|таверн|трактир|корчм|кузниц|конюшн|лагер|пещер|house|home|apartment|flat|mansion|manor|estate|penthouse|campus|university|college|academy|school|dorm|office|study|room|bedroom|kitchen|hall|bar|club|caf[eé]|restaurant|hotel|hospital|clinic|park|garden|yard|forest|beach|street|road|highway|tower|castle|palace|church|temple|shop|store|warehouse|basement|attic|garage|lab|library|villa|cottage|studio|gym|station|airport|harbou?r|ship|car|tavern|inn|camp|cave)/i;
const география = (часть) => ГЕОГРАФИЯ.test(часть) && !часть.split(/\s+/).some(с => СЛОВО_МЕСТА.test(с));
export function ключМеста(место) {
  const части = String(место || '').split(/[,;(—]/).map(ч => ч.trim()).filter(Boolean);
  let i = 0;
  while (i < части.length - 1 && география(части[i])) i++;
  const главное = части[i] || '';
  return главное.length > 1 ? главное : '';
}
const норма = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

// Признаки работы для атласа: в самом месте — смена, пост, стойка; по роли —
// прислуга и охрана, что работают в чужом доме.
const РАБОТА_В_МЕСТЕ = /(?:^|[^\p{L}])(?:на смене|на работе|на посту|на дежурстве|на службе|дежурит|за стойкой|за прилавком|за кассой|at work|on shift|on duty|behind the (?:bar|counter))/iu;
const ПРИСЛУГА = /(?:^|[^\p{L}])(?:горничн|няня|няней|нянечк|кухарк|повар|гувернант|дворецк|садовник|экономк|прислуг|домработниц|сиделк|шофёр|шофер|личн\p{L}* водител|охранник|телохранител|секретар|ассистент|помощни|housekeeper|maid|nanny|cook|chef|governess|butler|gardener|caretaker|chauffeur|bodyguard|security guard|secretary|assistant)/iu;
const ЖИЛЬЁ = /(?:^|[^\p{L}])(?:квартир|дом(?![\p{L}])|дома(?![\p{L}])|домик|особняк|поместь|усадьб|вилл|пентхаус|таунхаус|коттедж|дач|лофт|спальн|гостин|общежит|apartment|flat|house|home|mansion|manor|estate|villa|penthouse|townhouse|cottage|bedroom|dorm)/iu;
// Основы слов от пяти букв: «кофейни» и «кофейня» → «кофей». У места — только
// нарицательные (со строчной): «наследник Кингсли» не работает в «пентхаусе Кингсли».
const основы = (s) => [...new Set((норма(s).match(/\p{L}{5,}/gu) || []).map(с => с.slice(0, 5)))];
const основыМеста = (s) => [...new Set((String(s || '').match(/(?<![\p{L}«"])\p{Ll}{5,}/gu) || []).map(с => норма(с).slice(0, 5)))];

function главныйПерсонаж(data) {
  try { const c = window.SillyTavern?.getContext?.(); if (c && c.name2) return чистоеИмя(c.name2); } catch (_) { /* нет Таверны */ }
  return чистоеИмя(Array.isArray(data.characters) && data.characters[0] && data.characters[0]['Имя']);
}

export function создатьКарты() {
  const люди = new Map(); // ключ → отображаемое имя
  const кто = (имя) => {
    const и = чистоеИмя(имя);
    if (!и) return '';
    for (const [к, показ] of люди) if (namesLikelySame(показ, и)) return к;
    const к = норма(и);
    люди.set(к, и);
    return к;
  };
  const настроения = new Map(); // человек → Map(день → [настроения])
  const места = new Map(); // ключ места → запись
  const гдеБыл = new Map(); // человек → ключ места в прошлом ходу
  const пары = new Map(); // «a|b» → запись
  const доверие = new Map(); // «a>b» → [{ at, n }]
  let последнийДень = '';

  function учесть(data, at, день) {
    if (!data || typeof data !== 'object') return;
    if (день) последнийДень = день;
    const d = день || последнийДень;
    const scene = data.scene && typeof data.scene === 'object' ? data.scene : {};
    const час = (() => { const м = текст(scene['Время']).match(/\b(\d{1,2}):\d{2}\b/); return м ? +м[1] : null; })();

    // --- Настроения ---
    const отметить = (имя, настроение) => {
      const к = кто(имя);
      if (!к || !значимо(настроение) || !d) return;
      if (!настроения.has(к)) настроения.set(к, new Map());
      const дни = настроения.get(к);
      if (!дни.has(d)) дни.set(d, []);
      дни.get(d).push(String(настроение).trim());
    };
    const трекер = data.memory && data.memory.mood && typeof data.memory.mood === 'object' ? data.memory.mood : {};
    const сейчас = (x) => текст(x && (x.current ?? x.nw));
    if (значимо(сейчас(трекер.user))) отметить(текст(data.user && data.user['Имя']) || getSafeUserName(), сейчас(трекер.user));
    if (значимо(сейчас(трекер.char))) отметить(главныйПерсонаж(data), сейчас(трекер.char));
    for (const з of Array.isArray(data.diary) ? data.diary : []) if (з && typeof з === 'object') отметить(з.author ?? з['Автор'], з.mood ?? з['Настроение']);

    // --- Места и кто где ---
    const присутствие = [];
    // «Пентхаус Тристана» и «пентхаус Тристана в центре города» — одно место:
    // длинное название, что продолжает уже известное (от двух слов), идёт к нему;
    // известное длинное, когда появилось короткое, переезжает под короткое.
    const канон = (м, показ) => {
      for (const к of места.keys()) if (к.includes(' ') && м.startsWith(к + ' ')) return к;
      if (м.includes(' ')) for (const к of [...места.keys()]) if (к.startsWith(м + ' ')) {
        const з = места.get(к);
        места.delete(к);
        if (!места.has(м)) { з.place = показ; места.set(м, з); }
        for (const [ч, г] of гдеБыл) if (г === к) гдеБыл.set(ч, м);
      }
      return м;
    };
    // «Работает» — только по признаку, не «бывает днём»: гости виллы днём там
    // же, где прислуга. Признак — в месте («на смене», «за стойкой»), прислуга
    // по роли (горничная, охранник, повар) или роль называет само место
    // («бариста кофейни «Переплёт»» в «кофейня «Переплёт»»).
    // В жилом доме роль, что называет дом («владелец поместья»), — хозяин, не работник.
    const наРаботе = (место, роль, ключ) => РАБОТА_В_МЕСТЕ.test(место) || ПРИСЛУГА.test(роль)
      || (!ЖИЛЬЁ.test(ключ) && основыМеста(ключ).some(о => основы(роль).includes(о)));
    const добавить = (имя, место, роль = '') => {
      const к = кто(имя), м = ключМеста(текст(место));
      if (!к || !значимо(м)) return;
      присутствие.push({ к, м: канон(норма(м), м), показ: м, работа: наРаботе(текст(место), текст(роль), м) });
    };
    for (const c of Array.isArray(data.characters) ? data.characters : []) if (c) добавить(c['Имя'], c['Место'], c['Роль']);
    if (data.user && typeof data.user === 'object') добавить(текст(data.user['Имя']) || getSafeUserName(), data.user['Место']);
    for (const { к, м, показ, работа } of присутствие) {
      let з = места.get(м);
      if (!з) { з = { place: показ, visits: 0, turns: 0, people: {}, nights: {}, days: {}, firstAt: at, lastAt: at, lastDate: d }; места.set(м, з); }
      з.turns++;
      з.people[к] = (з.people[к] || 0) + 1;
      if (час !== null && (час >= 22 || час < 7)) з.nights[к] = (з.nights[к] || 0) + 1;
      if (работа) з.days[к] = (з.days[к] || 0) + 1;
      if (гдеБыл.get(к) !== м) з.visits++;
      з.lastAt = at; з.lastDate = d || з.lastDate;
      гдеБыл.set(к, м);
    }

    // --- Пары: вместе в одном месте ---
    for (let i = 0; i < присутствие.length; i++) for (let j = i + 1; j < присутствие.length; j++) {
      const а = присутствие[i], б = присутствие[j];
      if (а.к === б.к || а.м !== б.м) continue;
      const ключ = [а.к, б.к].sort().join('|');
      let п = пары.get(ключ);
      if (!п) { п = { together: 0, firstAt: at, lastAt: at, lastDate: d }; пары.set(ключ, п); }
      п.together++; п.lastAt = at; п.lastDate = d || п.lastDate;
    }

    // --- Доверие: «Имя: 80; ...» у каждого персонажа ---
    for (const c of Array.isArray(data.characters) ? data.characters : []) {
      const от = c && кто(c['Имя']);
      if (!от) continue;
      for (const кусок of текст(c['Доверие']).split(';')) {
        const м = кусок.match(/^\s*([^:]+):\s*([+\-−]?\d{1,3})/);
        if (!м) continue;
        const к = кто(м[1]);
        if (!к || к === от) continue;
        const ключ = от + '>' + к;
        if (!доверие.has(ключ)) доверие.set(ключ, []);
        const ряд = доверие.get(ключ);
        const n = parseInt(м[2].replace('−', '-'), 10);
        if (!ряд.length || ряд[ряд.length - 1].n !== n) ряд.push({ at, n });
      }
    }
  }

  function итог() {
    const имя = (к) => люди.get(к) || к;
    const moodDays = [...настроения.entries()].map(([к, дни]) => ({ name: имя(к), days: [...дни.entries()].map(([date, moods]) => ({ date, moods })) }))
      .filter(x => x.days.length).sort((а, б) => б.days.length - а.days.length);
    const atlas = [...места.values()].map(з => {
      const чаще = Object.entries(з.people).sort((а, б) => б[1] - а[1]).slice(0, 4).map(([к, n]) => ({ name: имя(к), turns: n }));
      const живёт = Object.entries(з.nights).filter(([, n]) => n >= 3).sort((а, б) => б[1] - а[1]).slice(0, 3).map(([к]) => имя(к));
      const работает = Object.entries(з.days).filter(([, n]) => n >= 2).sort((а, б) => б[1] - а[1]).slice(0, 3).map(([к]) => имя(к));
      return { place: з.place, visits: з.visits, turns: з.turns, people: чаще, lives: живёт, works: работает, firstAt: з.firstAt, lastAt: з.lastAt, lastDate: з.lastDate };
    }).sort((а, б) => б.visits - а.visits || б.turns - а.turns);
    const ключиПар = new Set([...пары.keys()]);
    for (const к of доверие.keys()) { const [а, б] = к.split('>'); ключиПар.add([а, б].sort().join('|')); }
    const pairs = [...ключиПар].map(ключ => {
      const [а, б] = ключ.split('|');
      const п = пары.get(ключ) || { together: 0, lastAt: null, lastDate: '' };
      const ряд = (x, y) => (доверие.get(x + '>' + y) || []).map(т => т.n);
      return { a: имя(а), b: имя(б), together: п.together, lastAt: п.lastAt, lastDate: п.lastDate, trustAB: ряд(а, б), trustBA: ряд(б, а) };
    });
    const встречаются = new Map();
    for (const p of pairs) for (const и of [p.a, p.b]) встречаются.set(и, (встречаются.get(и) || 0) + p.together + (p.trustAB.length || p.trustBA.length ? 1 : 0));
    const people = [...встречаются.entries()].sort((а, б) => б[1] - а[1]).slice(0, 12).map(([и]) => и);
    return { moodDays, atlas, heat: { people, pairs: pairs.filter(p => people.includes(p.a) && people.includes(p.b)) } };
  }
  return { учесть, итог };
}
