// hud-manager/hud-expand.js
//
// Короткий HUD → полный. Чтобы модель писала меньше, ей разрешено (prompt.js,
// настройки hudNoChange, hudWorldDaily, hudMemoryDelta):
//   • «nc» (no change) вместо внешности, одежды, кинков, фетишей, «никогда» и
//     последнего секса, если они слово в слово как в прошлом HUD;
//   • мир дня (новости, слухи, прогноз, курсы, афиша, город, объявления,
//     гороскоп) — только раз в сюжетный день, комментарии — каждый ход;
//   • в памяти (факты, ружья, секреты, журнал) — только новое и изменённое.
// Сразу после ответа HUD разворачивает это обратно в полный HUD и кладёт его
// в сообщение (index.js). Карточка, архив, летопись и снимок для следующего
// хода видят полный HUD, как раньше, — экономятся только токены ответа.
//
// Чистые функции: на вход — HUD этого хода и прошлые HUD (новые первыми), всё
// в кодах (hud-snapshot.js, HUDвКодах).
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { namesLikelySame } from './names.js?v=23.88.89';

export const NC = /^\s*(?:nc|n\/c|no change|unchanged)\s*\.?\s*$/i;
export const ПОЛЯ_NC = ['Ap', 'C', 'Kn', 'Ft', 'NG', 'SxL'];
export const МИР_ДНЯ = ['nws', 'rm', 'fc', 'zd', 'fate', 'eco', 'afs', 'cty', 'ad'];
export const ПАМЯТЬ_ОБНОВЛЕНИЯМИ = ['fct', 'gun', 'sec', 'lg'];

// Сколько держим в развёрнутом списке: модель пишет только новое, и без
// предела список рос бы с каждым ходом — а с ним снимок для модели.
const ПРЕДЕЛ = { fct: 25, gun: 20, sec: 25, lg: 5 };

const объект = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ПУСТО = /^\s*(?:empty|none|null|нет|пусто)?\s*$/i;
const пусто = (v) => v === undefined || v === null || (typeof v === 'string' && ПУСТО.test(v)) || (Array.isArray(v) && !v.length);
const копия = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const люди = (h) => (h && Array.isArray(h.cs) ? h.cs : h && объект(h.cs) ? [h.cs] : []);

// --- nc -------------------------------------------------------------------------

function прежнее(прошлые, кто, поле) {
  for (const h of прошлые) {
    const з = кто === null ? (h && h.us) : люди(h).find(c => объект(c) && c.N && namesLikelySame(String(c.N), кто));
    if (!объект(з)) continue;
    const v = з[поле];
    if (пусто(v) || (typeof v === 'string' && NC.test(v))) continue;
    return v;
  }
  return undefined;
}

function развернутьNC(запись, прошлые, кто) {
  let было = false;
  for (const поле of ПОЛЯ_NC) {
    const v = запись[поле];
    if (typeof v !== 'string' || !NC.test(v)) continue;
    const старое = прежнее(прошлые, кто, поле);
    // Прежнего нет — пусто, а не «nc» на карточке.
    if (старое === undefined) delete запись[поле]; else запись[поле] = копия(старое);
    было = true;
  }
  return было;
}

// --- Мир дня ----------------------------------------------------------------------

function развернутьМир(hud, прошлые, ключи) {
  let было = false;
  for (const к of ключи) {
    const v = объект(hud.wd) ? hud.wd[к] : undefined;
    if (v !== undefined && !(typeof v === 'string' && NC.test(v))) continue;
    const откуда = прошлые.find(h => h && объект(h.wd) && !пусто(h.wd[к]));
    if (!откуда) { if (v !== undefined) { delete hud.wd[к]; было = true; } continue; }
    if (!объект(hud.wd)) hud.wd = {};
    hud.wd[к] = копия(откуда.wd[к]);
    было = true;
  }
  return было;
}

// --- Память обновлениями ---------------------------------------------------------

const нормаТекста = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'`.,;:!?()\[\]—–-]/g, ' ').replace(/\s+/g, ' ').trim();
// «Начинается теми же словами»: те же первые слова (до пяти, не меньше трёх).
export function тотЖеПункт(а, б) {
  const А = нормаТекста(а), Б = нормаТекста(б);
  if (!А || !Б) return false;
  if (А === Б) return true;
  const ка = А.split(' '), кб = Б.split(' ');
  const n = Math.min(5, ка.length, кб.length);
  return n >= 3 && ка.slice(0, n).join(' ') === кб.slice(0, n).join(' ');
}
const УБРАТЬ = /^\s*[-−–]\s+/;
const текстПункта = (поле, x) => поле === 'sec' ? (объект(x) ? String(x.f ?? '') : String(x ?? '')) : поле === 'gun' ? String(x ?? '').split('|')[0] : String(x ?? '');
const безМинуса = (поле, x) => {
  if (поле === 'sec' && объект(x)) return { ...x, f: String(x.f ?? '').replace(УБРАТЬ, '') };
  return typeof x === 'string' ? x.replace(УБРАТЬ, '') : x;
};
const сработало = (x) => /^\s*(?:fired|сработал[оа]?|выстрелил[оа]?)\b/i.test(String(x ?? '').split('|')[2] || '');
const время = (x) => { const m = String(x ?? '').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : -1; };
const списком = (v) => (Array.isArray(v) ? v.filter(x => !пусто(x)) : пусто(v) ? [] : [v]);
const деньСцены = (h) => нормаТекста(h && объект(h.sc) ? (h.sc.Dt ?? '') : '');

function развернутьПоле(поле, новое, старое, { новыйДень }) {
  const итог = (поле === 'lg' && новыйДень) ? [] : списком(старое).map(копия);
  const тронуто = new Set();
  for (const сырой of списком(новое)) {
    const убрать = УБРАТЬ.test(текстПункта(поле, сырой)) || (поле === 'sec' && объект(сырой) && УБРАТЬ.test(String(сырой.f ?? '')));
    const пункт = безМинуса(поле, сырой);
    const i = итог.findIndex(x => тотЖеПункт(текстПункта(поле, x), текстПункта(поле, пункт)));
    if (убрать) { if (i >= 0) итог.splice(i, 1); continue; }
    if (i >= 0) { итог[i] = копия(пункт); тронуто.add(итог[i]); }
    else { const к = копия(пункт); итог.push(к); тронуто.add(к); }
  }
  // Сработавшее ружьё живёт один ход, как и раньше: в следующем его уже нет.
  let out = поле === 'gun' ? итог.filter(x => тронуто.has(x) || !сработало(x)) : итог;
  if (поле === 'lg') out = out.map((x, i) => [x, i]).sort((а, б) => (время(а[0]) - время(б[0])) || (а[1] - б[1])).map(([x]) => x);
  return out.slice(-ПРЕДЕЛ[поле]);
}

function развернутьПамять(hud, прошлые, ключи) {
  const прошлый = прошлые.find(h => h && объект(h.me));
  if (!прошлый) return false;
  const новыйДень = !!деньСцены(hud) && !!деньСцены(прошлый) && деньСцены(hud) !== деньСцены(прошлый);
  let было = false;
  for (const к of ключи) {
    const новое = объект(hud.me) ? hud.me[к] : undefined;
    const старое = прошлый.me[к];
    if (новое === undefined && старое === undefined) continue;
    const итог = развернутьПоле(к, новое, старое, { новыйДень });
    if (JSON.stringify(итог) === JSON.stringify(списком(новое))) continue;
    if (!объект(hud.me)) hud.me = {};
    hud.me[к] = итог;
    было = true;
  }
  return было;
}

// --- Всё вместе ---------------------------------------------------------------------

/**
 * Разворачивает короткий HUD на месте. прошлые — HUD прошлых ходов, новые первыми.
 * мир / память — какие ключи разворачивать (то, что включено в настройках и
 * просили писать коротко); nc разворачивается всегда. true — что-то поменялось.
 */
export function развернутьКраткое(hud, прошлые, { мир = [], память = [] } = {}) {
  if (!объект(hud)) return false;
  const до = Array.isArray(прошлые) ? прошлые.filter(объект) : [];
  let было = false;
  for (const c of люди(hud)) if (объект(c) && c.N && развернутьNC(c, до, String(c.N))) было = true;
  if (объект(hud.us) && развернутьNC(hud.us, до, null)) было = true;
  if (мир.length && развернутьМир(hud, до, мир)) было = true;
  if (память.length && развернутьПамять(hud, до, память)) было = true;
  return было;
}

/** Блок [HUD] с тем же отступом JSON, что был у модели. */
export function блокHUD(hud, прежний = '') {
  const отступ = ((String(прежний).match(/\{\r?\n( +)"/) || [])[1] || ' ').length;
  return '[HUD]\n```json\n' + JSON.stringify(hud, null, отступ) + '\n```\n[/HUD]';
}
