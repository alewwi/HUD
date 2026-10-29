// hud-manager/render/music-radio.js
//
// Радио для музыки в сцене (render/music.js): в машине, в баре, в клубе
// играет живой эфир. Модель к музыке в сцене пишет теги станции на
// английском («russian pop», «80s», «lo-fi», «jazz») и страну сцены — по ним
// здесь подбираются станции.
//
// Два источника, оба открываются из России и играются обычным <audio>:
//   • «Радио Рекорд» — 117 жанровых станций (render/music-stations.js):
//     поп, рок, рэп, фонк, 80-е, 90-е, lo-fi, чилл, «Медляк FM», «Гоп FM»…
//     Первым — для сцены в России и для русских жанров;
//   • radio-browser.info — открытый каталог станций мира по жанру и стране
//     (отдаёт данные браузеру, без ключа).
// Свободных библиотек (Jamendo, Internet Archive, FMA, ccMixter) здесь нет:
// из России первые два закрыты, у FMA API больше нет, ccMixter не отдаёт
// данные браузеру.

import { СТАНЦИИ_РЕКОРДА, ПОТОК_РЕКОРДА } from './music-stations.js?v=23.88.1';

const нижн = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');

// Тег модели → признаки станции Рекорда (в названии или жанрах).
const ПРИЗНАКИ = [
  [/russian|русск|\brus\b|soviet|советск|росси/, ['russian']],
  [/\bpop\b|поп/, ['pop']],
  [/\b80s?\b|80'?s|eighties|1980|80-х/, ['80']],
  [/\b90s?\b|90'?s|nineties|1990|90-х/, ['90']],
  [/\b70s?\b|70'?s|seventies|1970/, ['70']],
  [/\b60s?\b|60'?s|sixties|1960/, ['60']],
  [/2000s|\b00s\b|noughties|00-х/, ['00']],
  [/2010s|\b10s\b|10'?s/, ['10']],
  [/lo-?fi/, ['lo-fi']],
  [/chill|lounge|relax|calm|downtempo|easy listening/, ['chill']],
  [/ambient|drone/, ['ambient']],
  [/\brock\b|рок/, ['rock']],
  [/\brap\b|hip.?hop|рэп/, ['rap/urban']],
  [/phonk/, ['phonk']],
  [/\btrap\b/, ['trap']],
  [/house|club|dance|edm|party|disco(?!.*funk)|клуб/, ['house', 'dance']],
  [/techno/, ['techno']],
  [/trance/, ['trance']],
  [/drum|dnb|d'n'b|jungle|neurofunk/, ['drum']],
  [/dubstep|\bbass\b/, ['bass']],
  [/synthwave|retrowave|outrun/, ['synthwave']],
  [/funk|disco/, ['disco/funk']],
  [/reggae/, ['reggae']],
  [/latin|latina|salsa|reggaeton/, ['latina']],
  [/christmas|new year|xmas|новогод|рождеств/, ['новый год', 'christmas']],
  [/slow|ballad|romantic|love songs|медляк/, ['медляк']],
  [/chanson|шансон|blatnoy|блатн|\bgop\b|гоп/, ['гоп']],
  [/eurodance/, ['eurodance']],
  [/\bhits?\b|\btop\b|chart|хит/, ['hits', 'хит']],
  [/classical|symphon|orchestra|классик/, ['симфония']],
  [/sleep|lullaby|dream|сон/, ['сон', 'dream']],
  [/oldschool|old school|retro|ретро|oldies/, ['oldschool', 'gold', 'хиты всех времен']],
];
// Чего у Рекорда нет — за этим только в каталог мира.
const НЕТ_У_РЕКОРДА = /jazz|blues|soul|country|folk|metal|punk|indie|classical|opera|bossa|swing|celtic|gospel|bluegrass|world/;
// Страны, где «своё» радио — Рекорд.
const СТРАНЫ_РЕКОРДА = new Set(['RU', 'BY', 'KZ', 'UA', 'KG', 'UZ', 'AM', 'GE', 'MD', 'AZ', 'TJ', 'TM', 'LV', 'LT', 'EE']);

const признакиТегов = (теги) => {
  const t = нижн(теги);
  const out = [];
  for (const [rx, слова] of ПРИЗНАКИ) if (rx.test(t)) out.push(слова);
  return out;
};

/** Станции Рекорда под теги, лучшие первыми: [{ name, url, src, жанры }]. */
export function станцииРекорда(теги, предел = 8) {
  const признаки = признакиТегов(теги);
  if (!признаки.length) return [];
  const оценки = СТАНЦИИ_РЕКОРДА.map(([название, жанры, поток], k) => {
    const где = нижн(название + ' ' + жанры);
    let очки = 0;
    for (const слова of признаки) if (слова.some(с => где.includes(с))) очки += 1;
    // Радиошоу одного диджея — не эфир «из приёмника».
    if (/радиошоу/.test(где)) очки -= 0.5;
    return { очки, k, name: название, url: ПОТОК_РЕКОРДА + поток, src: 'record', жанры };
  }).filter(с => с.очки >= 1);
  // Совпало больше признаков — выше; при равенстве — порядок сайта (популярные первыми).
  оценки.sort((a, b) => b.очки - a.очки || a.k - b.k);
  return оценки.slice(0, предел).map(({ name, url, src, жанры }) => ({ name, url, src, жанры }));
}

// --- radio-browser.info ---------------------------------------------------------
const ЗЕРКАЛА_КАТАЛОГА = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://fi1.api.radio-browser.info'];
const кэш = new Map();
const ждать = (мс) => { const c = new AbortController(); setTimeout(() => c.abort(), мс); return c.signal; };

/** Станция из каталога годится: есть поток, не битая, на https-странице — https. */
export function годнаяСтанция(с, наHttps = typeof location !== 'undefined' && location.protocol === 'https:') {
  const u = String(с && с.url_resolved || '');
  if (!/^https?:\/\//.test(u)) return false;
  if (наHttps && !/^https:/.test(u)) return false;
  if (с.lastcheckok === 0) return false;
  if (/\.m3u8?(\?|$)|\.pls(\?|$)/i.test(u)) return false;
  return true;
}

async function каталог(путь) {
  if (кэш.has(путь)) return кэш.get(путь);
  for (const зеркало of ЗЕРКАЛА_КАТАЛОГА) {
    try {
      const r = await fetch(зеркало + путь, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ждать(7000) });
      if (!r.ok) continue;
      const j = await r.json();
      const список = Array.isArray(j) ? j : [];
      кэш.set(путь, список);
      return список;
    } catch (_) { /* следующее зеркало */ }
  }
  return [];
}

/** Станции мира под тег и страну, популярные первыми. */
export async function станцииКаталога(теги, страна = '', предел = 8) {
  const тег = нижн(теги).split(/[,;/]/)[0].trim();
  if (!тег) return [];
  const запрос = (доп) => '/json/stations/search?' + new URLSearchParams({ tag: тег, hidebroken: 'true', order: 'clickcount', reverse: 'true', limit: '30', ...доп });
  let сырые = страна ? await каталог(запрос({ countrycode: страна })) : [];
  if (сырые.filter(с => годнаяСтанция(с)).length < 2) сырые = [...сырые, ...await каталог(запрос({}))];
  // Тег из нескольких слов («russian pop») каталог может не знать — тогда по первому слову.
  if (!сырые.length && тег.includes(' ')) сырые = await каталог('/json/stations/search?' + new URLSearchParams({ tag: тег.split(' ').pop(), hidebroken: 'true', order: 'clickcount', reverse: 'true', limit: '30' }));
  const видели = new Set();
  return сырые.filter(с => годнаяСтанция(с)).filter(с => { const k = нижн(с.name).trim(); if (видели.has(k)) return false; видели.add(k); return true; })
    .slice(0, предел).map(с => ({ name: String(с.name || 'Радио').trim().slice(0, 60), url: String(с.url_resolved), src: 'world', жанры: String(с.tags || '').split(',').slice(0, 3).join(', '), страна: String(с.countrycode || '') }));
}

/**
 * Станции для сцены по тегам модели и стране: Рекорд — для «своих» стран и
 * русских жанров, мир — для остального и про запас. Пусто — радио не нашлось.
 */
export async function станцииСцены(теги, страна = '') {
  const t = нижн(теги);
  if (!t) return [];
  const наш = СТРАНЫ_РЕКОРДА.has(String(страна || '').toUpperCase()) || /russian|русск|soviet|советск|шансон|chanson|гоп|медляк/.test(t);
  const рекорд = НЕТ_У_РЕКОРДА.test(t) && !наш ? [] : станцииРекорда(t);
  if (наш && рекорд.length) return [...рекорд, ...(await станцииКаталога(t, страна, 4))];
  const мир = await станцииКаталога(t, страна);
  return [...мир, ...рекорд].slice(0, 10);
}
