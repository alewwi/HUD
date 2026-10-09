// hud-manager/render/combat.js
//
// Вкладка «Бой». Модель пишет один объект cb, только пока есть опасность
// (combatPrompt: 'auto' — см. hud-snapshot.js, решитьБой):
//   st — этап: угроза | схватка | пауза | погоня | кончено;
//   pt — участники через « | »: '<имя>: <своя|враг|нейтрал>; <вплотную|шаг|
//        через комнату|далеко>; <что в руках>; <цел|ранен|оглушён|вне строя>';
//   in — очередь: кто действует сейчас и дальше;
//   cv — укрытия и что можно схватить;
//   ad — адреналин: '<имя>: <0-100>' и чувствует ли боль;
//   nv — выдержка: '<имя>: <действует|дрожит|замер|паникует|бежит>';
//   ch — в погоне: 'dst: 0-100; to: куда; obs: что мешает; evt: что случилось'.
// Раны — не отдельный код: болезни и травмы (Ill) уже копятся между ходами,
// к ним добавлен подкод zn (зона), и раны ложатся на силуэт. Оружие — из
// инвентаря (I): словарь, заряд и «спрятано». Бой — срез, его не копим.
//
// Дистанции — концентрическими кольцами, а не план комнаты: четыре значения
// модель даёт надёжно, координат — нет. Кровопотеря — своей шкалой, а не
// цветом силуэта: это другая величина. Отходняк после адреналина считает HUD
// по времени сюжета, а не модель.

import { escapeHtml, flattenFieldValue, снятьЗаглушки, getSafeUserName } from '../utils.js?v=23.46.0';
import { namesLikelySame } from '../names.js?v=23.46.0';
import { getAvatarUrl, getUserAvatarUrl } from '../avatars.js?v=23.46.0';
import { медаль } from './view-icons.js?v=23.46.0';

const текст = (v) => String(снятьЗаглушки(flattenFieldValue(v)) || '').trim();
const пусто = (s) => !s || /^(empty|none|нет|—|-|null)$/i.test(String(s).trim());
const поле = (о, имя) => {
  if (!о || typeof о !== 'object') return '';
  const ключ = Object.keys(о).find(k => k.toLowerCase() === имя.toLowerCase());
  return ключ ? текст(о[ключ]) : '';
};
const имяКоротко = (имя) => String(имя || '').replace(/^.*\s{2,}/, '').trim().split(/\s+/)[0] || '';
const тот = (a, b) => a && b && namesLikelySame(имяКоротко(a), имяКоротко(b));

export const ЭТАПЫ = [
  ['threat', /угроз|threat/i, 'угроза', '⚠'], ['fight', /схватк|бой|fight/i, 'схватка', '⚔'],
  ['pause', /пауз|затиш|pause/i, 'пауза', '⏸'], ['chase', /погон|бегств|chase/i, 'погоня', '🏃'],
  ['over', /кончен|закончен|оконч|over|done/i, 'кончено', '✓'],
];
const СТОРОНЫ = [['ally', /сво|союз|ally|друг/i], ['enemy', /враг|противн|enemy|hostile/i], ['neutral', /нейтр|neutral|случайн/i]];
const ДИСТАНЦИИ = [['close', /вплотн|рядом|в упор|close/i], ['step', /шаг|step|в двух/i], ['room', /через комнат|комнат|room|на другом конце/i], ['far', /далеко|далек|far|вдали|снаружи/i]];
const СОСТОЯНИЯ = [['out', /вне строя|без сознан|мёртв|мертв|убит|out/i, 'вне строя'], ['stun', /оглуш|контуж|stun/i, 'оглушён'], ['hurt', /ранен|кровоточ|hurt|wound/i, 'ранен'], ['ok', /.*/, 'цел']];
export const ВЫДЕРЖКА = [['act', /действ|собран|хладнокр|act/i, 'действует'], ['shake', /дрож|трясёт|трясет|shak/i, 'дрожит'], ['freeze', /замер|оцепен|ступор|freez/i, 'замер'], ['panic', /паник|panic|истерик/i, 'паникует'], ['run', /беж|убега|flee|run/i, 'бежит']];

/** «Софи: своя; вплотную; нож; ранена | Громила: враг; шаг; бита; цел» → участники. */
export function участникиБоя(pt) {
  if (пусто(pt)) return [];
  return String(pt).split('|').map(ч => ч.trim()).filter(Boolean).map(ч => {
    const м = ч.match(/^([^:：]{1,40})[:：]\s*(.*)$/);
    if (!м) return null;
    const части = м[2].split(';').map(x => x.trim());
    const найти = (список, s) => (список.find(([, rx]) => rx.test(s)) || список[список.length - 1]);
    const сторона = найти(СТОРОНЫ, части[0] || '')[0];
    const дист = (ДИСТАНЦИИ.find(([, rx]) => rx.test(части[1] || '')) || ['step'])[0];
    const сост = найти(СОСТОЯНИЯ, части[3] || '');
    return { имя: м[1].trim(), сторона, дист, вРуках: пусто(части[2]) ? '' : части[2], состояние: сост[0], состояниеСлово: сост[2], текст: ч };
  }).filter(Boolean);
}
/** «Софи: 85, боли не чувствует; Тристан: 40» → [{ имя, ad, бездБоли }]. */
export function адреналин(ad) {
  if (пусто(ad)) return [];
  return String(ad).split(/[;|]/).map(ч => ч.trim()).filter(Boolean).map(ч => {
    const м = ч.match(/^([^:：]{1,40})[:：]\s*(\d{1,3})(.*)$/);
    return м ? { имя: м[1].trim(), уровень: Math.min(100, +м[2]), безБоли: /не чувств|без боли|не замеча|не ощущ/i.test(м[3]), текст: м[3].replace(/^[\s,—–-]+/, '') } : null;
  }).filter(Boolean);
}
export function выдержка(nv) {
  if (пусто(nv)) return [];
  return String(nv).split(/[;|]/).map(ч => ч.trim()).filter(Boolean).map(ч => {
    const м = ч.match(/^([^:：]{1,40})[:：]\s*(.+)$/);
    if (!м) return null;
    const i = ВЫДЕРЖКА.findIndex(([, rx]) => rx.test(м[2]));
    return { имя: м[1].trim(), ступень: i < 0 ? 0 : i, текст: м[2].trim() };
  }).filter(Boolean);
}
const погоняИз = (ch) => {
  if (пусто(ch)) return null;
  const п = {};
  String(ch).split(';').forEach(x => { const м = x.match(/^\s*(dst|to|obs|evt)\s*[:：]\s*(.+)$/i); if (м) п[м[1].toLowerCase()] = м[2].trim(); });
  const d = parseFloat(п.dst);
  return { дистанция: Number.isFinite(d) ? Math.max(0, Math.min(100, d)) : null, куда: п.to || '', мешает: п.obs || '', событие: п.evt || '' };
};
export const этапБоя = (st) => ЭТАПЫ.find(([, rx]) => rx.test(String(st || ''))) || null;

/** Есть ли что показать: этап или участники. */
export function hudHasCombat(cb) {
  return !!cb && typeof cb === 'object' && (!пусто(cb.st) || !пусто(cb.pt));
}

// --- Раны на силуэте --------------------------------------------------------
// Координаты на силуэте 60×132 спереди; «левое» — левое у человека, то есть
// справа для смотрящего.
const ЗОНЫ_РАН = [
  [/голов|лоб|висок|затыл|череп/i, [30, 9]], [/лиц|скул|губ|нос|глаз|челюст/i, [30, 12]], [/ше[яи]|горл/i, [30, 22]],
  [/лев\p{L}* плеч/iu, [42, 30]], [/прав\p{L}* плеч/iu, [18, 30]], [/(?<!пред)плеч/i, [42, 30]],
  [/грудь|груд\p{L}*|ребр|рёбр/iu, [30, 38]], [/живот|бок|печен/i, [30, 56]], [/спин|лопат|поясниц/i, [30, 46]],
  [/лев\p{L}* (?:рук|предплеч|локт)/iu, [47, 52]], [/прав\p{L}* (?:рук|предплеч|локт)/iu, [13, 52]], [/лев\p{L}* (?:кист|ладон|пальц)/iu, [50, 70]], [/прав\p{L}* (?:кист|ладон|пальц)/iu, [10, 70]], [/рук|кист|ладон/i, [47, 52]],
  [/пах|таз/i, [30, 70]], [/лев\p{L}* бедр/iu, [36, 82]], [/прав\p{L}* бедр/iu, [24, 82]], [/бедр/i, [36, 82]],
  [/лев\p{L}* (?:колен|голен)/iu, [36, 102]], [/прав\p{L}* (?:колен|голен)/iu, [24, 102]], [/колен|голен/i, [36, 102]],
  [/лев\p{L}* (?:стоп|лодыж|ног)/iu, [36, 124]], [/прав\p{L}* (?:стоп|лодыж|ног)/iu, [24, 124]], [/стоп|лодыж|ног/i, [36, 118]],
];
const ВИДЫ_РАН = [
  ['bullet', /пул|огнестр|выстрел|bullet|gunshot/i, '•', 'пуля'], ['cut', /порез|резан|нож|колот|рассеч|рван/i, '/', 'порез'],
  ['burn', /ожог|обожж/i, '≋', 'ожог'], ['fracture', /перелом|трещин/i, '⨯', 'перелом'], ['dislocation', /вывих|растяж/i, '↷', 'вывих'],
  ['bruise', /ушиб|синяк|гематом|удар/i, '◍', 'ушиб'],
];
function раныИз(люди) {
  const out = [];
  for (const c of люди) {
    const ill = поле(c, 'Болезни') || поле(c, 'Болезни и травмы');
    if (пусто(ill)) continue;
    for (const группа of ill.split('|')) {
      const п = {};
      группа.split(';').forEach(x => { const м = x.match(/^\s*([^:：]{1,20})[:：]\s*(.+)$/); if (м) п[м[1].trim().toLowerCase()] = м[2].trim(); });
      const что = п.nm || п['что это'] || '';
      const зона = п.zn || п['зона'] || '';
      if (!что) continue;
      const вид = ВИДЫ_РАН.find(([, rx]) => rx.test(что)) || null;
      if (!вид && !зона) continue; // болезнь, а не рана
      const точка = (ЗОНЫ_РАН.find(([rx]) => rx.test(зона || что)) || [null, null])[1];
      const стадия = String(п.sg || п['стадия'] || '').toLowerCase();
      const rc = parseFloat(п.rc || п['выздоровление']);
      const тяжесть = /fresh|свеж|worsen|ухудш/.test(стадия) || (Number.isFinite(rc) && rc < 30) ? 3 : (Number.isFinite(rc) && rc < 70) ? 2 : 1;
      const симпт = п.sy || п['симптомы'] || '';
      out.push({
        кто: имяКоротко(c['Имя']) || 'Вы', что, зона, точка, вид: вид ? вид[0] : 'wound', знак: вид ? вид[2] : '✚', видСлово: вид ? вид[3] : 'рана',
        тяжесть, обездвижено: /не двига|обездвиж|не может (?:ходить|наступ|поднять)|не слушается/i.test(симпт),
        кровь: /обильн\p{L}* кровотеч|сильн\p{L}* кровотеч|кровопотер|хлещ|фонтан/iu.test(симпт) ? 3 : /кровотеч|кровоточ|кровь/i.test(симпт) ? 2 : 0,
      });
    }
  }
  return out;
}
// Силуэт строго зеркален относительно x = 30: узкая шея по центру, покатые
// плечи, руки до кистей (y ≈ 72), ноги до стоп — точки ЗОНЫ_РАН ложатся на тело.
export const СИЛУЭТ = 'M30 2a8 8 0 1 1 0 16a8 8 0 1 1 0-16Z'
  + 'M27 17V21.5C22 22 17 23 15 26C13.5 28 13.5 31 13 35L9.5 70C9.3 72.5 12.5 73 13 71L17 40L17.5 52C16.5 58 16 63 17 68L18.5 126C18.5 128 20 128.5 21 128.5L28 128.5L29 80'
  + 'H31L32 128.5L39 128.5C40 128.5 41.5 128 41.5 126L43 68C44 63 43.5 58 42.5 52L43 40L47 71C47.5 73 50.7 72.5 50.5 70L47 35C46.5 31 46.5 28 45 26C43 23 38 22 33 21.5V17Z';

// --- Оружие из инвентаря ------------------------------------------------------
const ОРУЖИЕ = /(?<![\p{L}])(?:нож|ножи|кинжал|стилет|пистолет|револьвер|винтовк|ружь[её]|ружьё|автомат|дробовик|обрез|меч|топор|кастет|дубинк|арбалет|шпаг|сабл|глок|беретт|кольт|магнум|граната|электрошок|шокер|бит[аеуы]|молот|катан|лук(?![\p{L}]))/iu;
const СКРЫТО = /спрят|скрыт|под куртк|под пиджак|под рубаш|в сапог|в ботин|за пояс|в рукав|под юбк|незаметн|в кобуре под/i;
function оружиеИз(люди) {
  const out = [];
  for (const c of люди) {
    const инв = поле(c, 'Инвентарь');
    if (пусто(инв)) continue;
    for (const пункт of инв.split(';').map(x => x.trim()).filter(Boolean)) {
      const [что, ...сост] = пункт.split(/[:：]/);
      if (!ОРУЖИЕ.test(что)) continue;
      const сс = сост.join(':').trim();
      const м = (что + ' ' + сс).match(/(\d{1,2})\s*(?:патрон|заряд|выстрел|пул)|магазин\D{0,12}(\d{1,2})|(\d{1,2})\s*\/\s*(\d{1,2})/i);
      const словами = /(?<![\p{L}])(один|два|три|четыре|пять|шесть)\s+(?:патрон|заряд)/iu.exec(сс);
      const ЧИСЛА = { один: 1, два: 2, три: 3, четыре: 4, пять: 5, шесть: 6 };
      const заряд = м ? +(м[1] || м[2] || м[3]) : словами ? ЧИСЛА[словами[1].toLowerCase()] : null;
      const из = м && м[4] ? +м[4] : null;
      out.push({ кто: имяКоротко(c['Имя']) || 'Вы', что: что.trim(), состояние: сс, заряд, из, спрятано: СКРЫТО.test(пункт) });
    }
  }
  return out;
}

function лицо(имя) {
  let url = '';
  const игрок = (() => { try { return getSafeUserName(); } catch (_) { return ''; } })();
  try { url = тот(имя, игрок) ? getUserAvatarUrl() : ((getAvatarUrl(имя) || {}).thumbUrl || ''); } catch (_) { url = ''; }
  return `<span class="hud-cb-face"${url ? ` style="background-image:url('${String(url).replace(/'/g, '%27')}')"` : ''}>${url ? '' : escapeHtml((имяКоротко(имя).match(/\p{L}/u) || ['?'])[0].toUpperCase())}</span>`;
}

// Кольца: центр — игрок (или первый «свой»), свои слева, враги справа.
function кольца(участники) {
  const R = { close: 34, step: 58, room: 82, far: 104 }, C = 112;
  const игрок = (() => { try { return getSafeUserName(); } catch (_) { return ''; } })();
  const центр = участники.find(п => тот(п.имя, игрок)) || участники.find(п => п.сторона === 'ally') || null;
  const прочие = участники.filter(п => п !== центр);
  const поСекторам = { ally: [], enemy: [], neutral: [] };
  прочие.forEach(п => поСекторам[п.сторона].push(п));
  const углы = { ally: 180, enemy: 0, neutral: 90 };
  const точки = [];
  for (const [сторона, список] of Object.entries(поСекторам)) {
    список.forEach((п, i) => {
      const разброс = список.length > 1 ? (i - (список.length - 1) / 2) * 28 : 0;
      const а = (углы[сторона] + разброс) * Math.PI / 180;
      точки.push({ п, x: C + Math.cos(а) * R[п.дист], y: C + Math.sin(а) * R[п.дист] });
    });
  }
  const svg = `<svg class="hud-cb-rings" viewBox="0 0 224 224" role="img" aria-label="Кто на какой дистанции">`
    + Object.entries(R).reverse().map(([k, r]) => `<circle class="ring r-${k}" cx="${C}" cy="${C}" r="${r}"/>`).join('')
    + `<text class="ring-label" x="${C}" y="${C - R.close + 9}">вплотную</text><text class="ring-label" x="${C}" y="${C - R.step + 9}">шаг</text><text class="ring-label" x="${C}" y="${C - R.room + 9}">комната</text><text class="ring-label" x="${C}" y="${C - R.far + 9}">далеко</text>`
    + `<circle class="me" cx="${C}" cy="${C}" r="9"/><text class="me-label" x="${C}" y="${C + 3.5}">${escapeHtml((центр ? имяКоротко(центр.имя) : 'Вы').slice(0, 1))}</text>`
    + точки.map(({ п, x, y }) => `<g class="pt s-${п.сторона} st-${п.состояние}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8"/><text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}">${escapeHtml(имяКоротко(п.имя).slice(0, 2))}</text><title>${escapeHtml(п.текст)}</title></g>`).join('')
    + `</svg>`;
  return svg;
}

/**
 * cb — объект боя хода; data — весь ход (персонажи, игрок); сейчас и история —
 * для отходняка: { момент, ходы: [{ момент, combat }] } от нового к старому.
 */
export function buildCombatHTML(cb, data, uid, active, время = {}) {
  const этап = этапБоя(cb.st);
  const участники = участникиБоя(cb.pt);
  const очередь = пусто(cb.in) ? [] : String(cb.in).split(/[;,→>|]/).map(x => x.trim()).filter(Boolean);
  const люди = [...(Array.isArray(data && data.characters) ? data.characters : []), ...(data && data.user ? [data.user] : [])].filter(Boolean);
  const раны = раныИз(люди);
  const оружие = оружиеИз(люди);
  const ад = адреналин(cb.ad), нв = выдержка(cb.nv), погоня = погоняИз(cb.ch);
  // Строка боя: этап и очередь, действующий — первым.
  // Значки этапов — линейные (view-icons.js), цвет этапа — акцентом карточки.
  const ИКОНКА_ЭТАПА = { threat: 'alert', fight: 'swords', pause: 'pause', chase: 'run', over: 'check' };
  const строка = `<div class="hud-cb-line">${этап ? `<span class="hud-cb-stage is-${этап[0]}">${медаль(ИКОНКА_ЭТАПА[этап[0]] || 'swords')}<span><small>сейчас</small>${этап[2]}</span></span>` : ''}`
    + (очередь.length ? `<span class="hud-cb-queue" aria-label="Очередь">${очередь.map((к, i) => `<span class="${i === 0 ? 'is-now' : ''}">${i === 0 ? '▶ ' : ''}${escapeHtml(к)}</span>`).join('<i aria-hidden="true">›</i>')}</span>` : '') + `</div>`;
  const список = участники.map(п => `<li class="s-${п.сторона} st-${п.состояние}">${лицо(п.имя)}<b>${escapeHtml(имяКоротко(п.имя))}</b><small>${{ ally: 'свой', enemy: 'враг', neutral: 'нейтрал' }[п.сторона]} · ${{ close: 'вплотную', step: 'шаг', room: 'через комнату', far: 'далеко' }[п.дист]}${п.вРуках ? ' · ' + escapeHtml(п.вРуках) : ''}</small><em>${п.состояниеСлово}</em></li>`).join('');
  const схема = участники.length ? `<div class="hud-cb-map">${кольца(участники)}<ul class="hud-cb-people">${список}</ul></div>` : '';
  // Силуэт с ранами — у каждого, у кого раны.
  const поЛюдям = [...new Set(раны.map(р => р.кто))];
  const силуэты = поЛюдям.map(кто => {
    const мои = раны.filter(р => р.кто === кто);
    const кровь = Math.max(0, ...мои.map(р => р.кровь));
    const метки = мои.filter(р => р.точка).map(р => `<g class="w w-${р.вид} t${р.тяжесть}${р.обездвижено ? ' is-immobile' : ''}"><circle cx="${р.точка[0]}" cy="${р.точка[1]}" r="${2.4 + р.тяжесть * 1.3}"/>${р.обездвижено ? `<path d="M${р.точка[0] - 6} ${р.точка[1] - 6}l12 12m0-12l-12 12"/>` : ''}<title>${escapeHtml(р.видСлово + ': ' + р.что + (р.зона ? ' (' + р.зона + ')' : ''))}</title></g>`).join('');
    const подписи = мои.map(р => `<li class="t${р.тяжесть}"><i aria-hidden="true">${р.знак}</i>${escapeHtml(р.что)}${р.зона ? `<small>${escapeHtml(р.зона)}</small>` : ''}${р.обездвижено ? '<small>обездвижено</small>' : ''}</li>`).join('');
    return `<div class="hud-cb-body"><b>${escapeHtml(кто)}</b><div class="hud-cb-body-row"><svg class="hud-cb-sil" viewBox="0 0 60 132" aria-hidden="true"><path class="sil" d="${СИЛУЭТ}"/>${метки}</svg><ul>${подписи}</ul></div>`
      + (кровь ? `<div class="hud-cb-blood" aria-label="Кровопотеря"><span>Кровопотеря</span><i class="b${кровь}" style="--b:${кровь / 3}"></i><small>${кровь >= 3 ? 'опасная' : 'есть'}</small></div>` : '') + `</div>`;
  }).join('');
  // Оружие: заряд точками, «спрятано» — перечёркнутым глазом.
  const стволы = оружие.map(о => {
    const точек = о.из || (о.заряд !== null ? Math.max(о.заряд, Math.min(12, о.заряд)) : 0);
    const заряд = о.заряд !== null ? `<span class="hud-cb-ammo" aria-label="Заряд ${о.заряд}${о.из ? ' из ' + о.из : ''}">${Array.from({ length: Math.min(12, точек) }, (_, i) => `<i class="${i < о.заряд ? 'on' : ''}"></i>`).join('')}</span>` : '';
    return `<div class="hud-cb-weapon${о.спрятано ? ' is-hidden' : ''}"><b>${escapeHtml(о.что)}</b><small>${escapeHtml(о.кто)}${о.состояние ? ' · ' + escapeHtml(о.состояние) : ''}</small>${заряд}${о.спрятано ? '<span class="hud-cb-hidden" title="Спрятано"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20L20 4"/></svg>спрятано</span>' : ''}</div>`;
  }).join('');
  // Адреналин и отходняк.
  const конченоМин = этап && этап[0] === 'over' ? время.конченоМинут : null;
  const адреналинHtml = ад.map(а => {
    const позже = а.уровень >= 70 && а.безБоли ? '<small class="hud-cb-later">боль придёт позже</small>' : '';
    let откат = '';
    if (конченоМин !== null && конченоМин !== undefined && а.уровень >= 50) {
      const осталось = Math.round(20 - конченоМин);
      откат = осталось > 0 ? `<small class="hud-cb-later">отпустит примерно через ${осталось} мин</small>` : '<small class="hud-cb-later is-crash">откат: слабость, дрожь, тошнота</small>';
    }
    return `<div class="hud-cb-ad"><b>${escapeHtml(имяКоротко(а.имя))}</b><span class="hud-cb-adbar"><i style="width:${а.уровень}%"></i></span><em>${а.уровень}</em>${позже}${откат}</div>`;
  }).join('');
  const выдержкаHtml = нв.map(н => `<div class="hud-cb-nerve"><b>${escapeHtml(имяКоротко(н.имя))}</b><span>${ВЫДЕРЖКА.map(([к, , слово], i) => `<i class="n-${к}${i === н.ступень ? ' is-now' : ''}" title="${слово}">${i === н.ступень ? слово : ''}</i>`).join('')}</span></div>`).join('');
  const укрытия = пусто(cb.cv) ? '' : `<ul class="hud-cb-cover">${String(cb.cv).split(';').map(x => x.trim()).filter(Boolean).map(x => { const [что, ...как] = x.split(/[:：]/); return `<li><b>${escapeHtml(что.trim())}</b>${как.length ? `<small>${escapeHtml(как.join(':').trim())}</small>` : ''}</li>`; }).join('')}</ul>`;
  const погоняHtml = погоня ? `<div class="hud-cb-chase">${погоня.дистанция !== null ? `<div class="hud-cb-track" aria-label="Дистанция ${погоня.дистанция} из 100"><span>догнали</span><i class="hud-cb-runner" style="left:${погоня.дистанция}%"></i>${(время.событияПогони || []).map(е => `<i class="hud-cb-evt" style="left:${е.д}%" title="${escapeHtml(е.текст)}"></i>`).join('')}<span>оторвались</span></div>` : ''}`
    + `<p>${погоня.куда ? `Куда: ${escapeHtml(погоня.куда)}` : ''}${погоня.мешает ? ` · мешает: ${escapeHtml(погоня.мешает)}` : ''}${погоня.событие ? ` · ${escapeHtml(погоня.событие)}` : ''}</p></div>` : '';
  const раздел = (з, т, тело) => тело ? `<section class="hud-v-card hud-cb-sec"><div class="hud-v-head"><b>${медаль(з)}${т}</b></div>${тело}</section>` : '';
  return `<div class="hud-tab-content${active ? ' active' : ''}" id="content-${uid}"><div class="hud-body hud-cb hud-v${этап ? ' is-' + этап[0] : ''}">${строка}`
    + раздел('run', 'Погоня', погоняHtml) + раздел('target', 'Кто где', схема) + раздел('drop', 'Раны', силуэты) + раздел('dagger', 'Оружие', стволы)
    + раздел('bolt', 'Адреналин', адреналинHtml) + раздел('head', 'Выдержка', выдержкаHtml) + раздел('shield', 'Укрытия и что под рукой', укрытия)
    + `</div></div>`;
}
