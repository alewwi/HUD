// hud-manager/render/world.js
//
// Домен «Мир»: заголовки новостей, слухи, объявления и комментарии
// с голосованием. Вынесено из index.js без изменения поведения.
//
// Единственное отличие от оригинала: buildWorldHTML раньше читал
// settings.showComments напрямую из замыкания index.js. Теперь флаг
// приходит четвёртым аргументом — модуль не знает про глобальные настройки.

import { escapeHtml, hudHashSeed, commentInitials, hudHasMeaningfulValue } from '../utils.js?v=22.19.1';
import { HUD_AVATAR_COLORS } from '../avatars.js?v=22.19.1';

// --- Прогноз погоды -------------------------------------------------------
// Иконки нарисованы штрихами по currentColor: они должны читаться как в
// обычном погодном приложении, без свечения и анимации — сцену оформляет
// виджет погоды, а здесь нужна сводка, а не эффект.
const W_ICONS = {
  clear:  '<svg viewBox="0 0 24 24" class="hud-fc-ico"><circle class="ic-sun" cx="12" cy="12" r="4.6"/><path class="ic-rays" d="M12 2.6v2.4M12 19v2.4M2.6 12H5M19 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"/></svg>',
  cloudy: '<svg viewBox="0 0 24 24" class="hud-fc-ico"><path class="ic-cloud" d="M7.2 18h9.4a3.9 3.9 0 0 0 .3-7.8 5.6 5.6 0 0 0-10.8 1.2A3.4 3.4 0 0 0 7.2 18Z"/></svg>',
  rain:   '<svg viewBox="0 0 24 24" class="hud-fc-ico"><path class="ic-cloud" d="M7.4 14.4h9a3.6 3.6 0 0 0 .3-7.2 5.3 5.3 0 0 0-10.2 1.1 3.2 3.2 0 0 0 .9 6.1Z"/><path class="ic-drop d1" d="M9 17.4 8 20.4"/><path class="ic-drop d2" d="M12.4 17.4l-1 3"/><path class="ic-drop d3" d="M15.8 17.4l-1 3"/></svg>',
  storm:  '<svg viewBox="0 0 24 24" class="hud-fc-ico"><path class="ic-cloud" d="M7.4 13.6h9a3.6 3.6 0 0 0 .3-7.2 5.3 5.3 0 0 0-10.2 1.1 3.2 3.2 0 0 0 .9 6.1Z"/><path class="ic-bolt" d="m12.8 15.4-3 3.4h2.6l-1.2 3 3.4-3.8h-2.5Z"/></svg>',
  fog:    '<svg viewBox="0 0 24 24" class="hud-fc-ico"><path class="ic-cloud" d="M7.4 12.6h9a3.6 3.6 0 0 0 .3-7.2 5.3 5.3 0 0 0-10.2 1.1 3.2 3.2 0 0 0 .9 6.1Z"/><path class="ic-fogline l1" d="M4.6 16h14.8"/><path class="ic-fogline l2" d="M6.6 19h10.8"/></svg>',
  wind:   '<svg viewBox="0 0 24 24" class="hud-fc-ico"><path class="ic-gust g1" d="M3.4 9.2h9.2a2.6 2.6 0 1 0-2.6-2.6"/><path class="ic-gust g2" d="M3.4 14h13a2.6 2.6 0 1 1-2.6 2.6"/><path class="ic-gust g3" d="M3.4 11.6h6.8"/></svg>',
  snow:   '<svg viewBox="0 0 24 24" class="hud-fc-ico"><path class="ic-cloud" d="M7.4 13.8h9a3.6 3.6 0 0 0 .3-7.2 5.3 5.3 0 0 0-10.2 1.1 3.2 3.2 0 0 0 .9 6.1Z"/><g class="ic-flake f1"><path d="M9 17.6v2.8M7.8 18.4l2.4 1.2M10.2 18.4l-2.4 1.2"/></g><g class="ic-flake f2"><path d="M15 17.6v2.8M13.8 18.4l2.4 1.2M16.2 18.4l-2.4 1.2"/></g></svg>',
};

// Порядок важен: гроза содержит и дождь, туман бывает «облачным».
const W_RULES = [
  [/гроз|молни|шторм|thunder|storm/i,                         'storm',  'Гроза'],
  [/снег|снеж|метел|вьюг|пург|буран|snow|blizzard/i,          'snow',   'Снег'],
  [/дожд|лив|морос|ненаст|rain|drizzle|shower/i,              'rain',   'Дождь'],
  [/туман|дымк|мгл|fog|mist|haze/i,                            'fog',    'Туман'],
  [/ветр|ветер|шквал|порыв|wind|gust|breeze/i,                 'wind',   'Ветрено'],
  [/облач|пасмур|хмур|тучи|cloud|overcast/i,                   'cloudy', 'Облачно'],
  [/ясн|солнеч|вёдр|ведр|clear|sunny|fair/i,                   'clear',  'Ясно'],
];

// Температура из строки вида «+7°C», «-3°», «9». Нужна не для показа, а
// чтобы покрасить шкалу под числом: холод синий, тепло янтарное.
export function parseTempC(raw) {
  const m = String(raw || '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// Доля тепла от 0 до 1 в диапазоне -25…+35 °C.
export function tempWarmth(t) {
  if (t === null || !isFinite(t)) return null;
  return Math.max(0, Math.min(1, (t + 25) / 60));
}

export function forecastLook(text) {
  const s = String(text || '');
  for (const [re, icon, label] of W_RULES) if (re.test(s)) return { icon, label };
  return { icon: 'cloudy', label: '' };
}

// Строка прогноза: «Период | Погода | Температура | Заметка».
// Разбор снисходительный: чего нет — того нет, блок всё равно соберётся.
export function parseForecastRow(raw) {
  const parts = String(raw || '').split('|').map(s => s.trim());
  const period = parts[0] || '';
  const weather = parts[1] || '';
  const temp = parts[2] || '';
  const note = parts.slice(3).join(' | ').trim();
  // Если разделителей не было вовсе, всю строку считаем описанием погоды.
  if (parts.length === 1) return { period: '', weather: period, temp: '', note: '' };
  return { period, weather, temp, note };
}

// --- Гороскоп -------------------------------------------------------------
// Знак — всегда первое поле строки, поэтому образцы привязаны к её началу.
// Так «Рак» не спутается с «ракетой», а «Лев» с «Левшой», и не нужен \b:
// в JS-регулярке без флага u кириллица не считается словом, границы после
// «рак» просто нет — эти два знака оставались без глифа.
const ZODIAC = [
  [/^\s*овен|aries/i, '♈︎'], [/^\s*тел[ье]ц|taurus/i, '♉︎'], [/^\s*близнец|gemini/i, '♊︎'],
  [/^\s*рак|cancer/i, '♋︎'], [/^\s*(лев|льв)|leo/i, '♌︎'], [/^\s*дев[аы]|virgo/i, '♍︎'],
  [/весы|libra/i, '♎︎'], [/скорпион|scorpio/i, '♏︎'], [/стрел[ео]ц|sagittarius/i, '♐︎'],
  [/козерог|capricorn/i, '♑︎'], [/водоле|aquarius/i, '♒︎'], [/рыб[ыа]|pisces/i, '♓︎'],
];

export function zodiacGlyph(sign) {
  const s = String(sign || '');
  for (const [re, glyph] of ZODIAC) if (re.test(s)) return glyph;
  return '✦';
}

// Тон дня: третьим полем строки либо по ключевым словам самого текста.
export function horoscopeTone(toneField, text) {
  const s = (String(toneField || '') + ' ' + String(text || '')).toLowerCase();
  if (/неудач|беда|провал|ссор|опасн|лучше остат|не выход|потер|риск|плохо|bad|unlucky/.test(s)) return 'bad';
  if (/удач|повез|везёт|везет|успех|выигр|подар|встреч|шанс|good|lucky/.test(s)) return 'luck';
  return 'flat';
}

// Подпись тона дня. Появляется на карточке только после касания —
// до него карточка остаётся спокойной.
export const TONE_LABEL = { luck: 'Повезёт', bad: 'Поберегитесь', flat: 'Ровный день' };

export function parseHoroscopeRow(raw) {
  const parts = String(raw || '').split('|').map(s => s.trim());
  const sign = parts[0] || '';
  const text = parts[1] || '';
  const tone = parts[2] || '';
  return { sign, text, tone: horoscopeTone(tone, text) };
}

const worldVoteState = Object.create(null);

export function getWorldVotes(key) {
  if (!worldVoteState[key]) {
    const seed = hudHashSeed(key);
    worldVoteState[key] = {
      up: 40 + (seed % 380),
      comments: 8 + ((seed >> 3) % 90),
      votedUp: false,
      votedC: false
    };
  }
  return worldVoteState[key];
}

export function parseWorldComment(raw) {
  const text = String(raw || '').trim();
  const m = text.match(/^([^:]{1,48}):\s*([\s\S]*)$/);
  if (m && m[2].trim()) return { name: m[1].trim(), text: m[2].trim() };
  return { name: 'Анон', text };
}

export function buildWorldHTML(worldData, uid, isChecked, showComments) {
  let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-world-container"><div class="hud-world-scroll">`;
  if (!worldData || !Object.values(worldData).some(arr => Array.isArray(arr) && arr.length > 0)) {
    return html + `<div class="hud-world-empty">🌍 В этом снимке мира пока нет записей.</div></div></div>`;
  }
  const headlineTitles = [];
  if (worldData.headlines && worldData.headlines.length > 0) {
    html += `<div class="hud-world-section hud-world-section-news"><div class="hud-world-title">📰 Главные новости</div>`;
    worldData.headlines.forEach((hl, idx) => {
      const parts = String(hl).split('|');
      const title = parts[0].trim();
      const body = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
      headlineTitles.push(title);
      const voteKey = `hl-${idx}-${hudHashSeed(title + '\n' + body)}`;
      const votes = getWorldVotes(voteKey);
      const colClass = body.length > 220 ? ' article-text-columns' : '';
      html += `<details class="hud-news-article">
        <summary><span class="hud-news-headline">${escapeHtml(title)}</span>
          <span class="hud-news-stats">
            <button type="button" class="hud-news-vote hud-news-upvote${votes.votedUp ? ' is-on' : ''}" data-vote-key="${voteKey}" data-vote-kind="up" aria-pressed="${votes.votedUp ? 'true' : 'false'}">▲ <span class="hud-news-vote-n">${votes.up}</span></button>
            <span class="hud-news-stats-sep">|</span>
            <button type="button" class="hud-news-vote hud-news-cmt${votes.votedC ? ' is-on' : ''}" data-vote-key="${voteKey}" data-vote-kind="comments" aria-pressed="${votes.votedC ? 'true' : 'false'}">💬 <span class="hud-news-vote-n">${votes.comments}</span></button>
          </span>
        </summary>
        <div class="article-text${colClass}">${escapeHtml(body)}</div>
      </details>`;
    });
    html += `</div>`;
  }
  if (worldData.rumors && worldData.rumors.length > 0) {
    html += `<div class="hud-world-section"><div class="hud-world-title">🗣️ Слухи</div><ul class="hud-world-list">`;
    worldData.rumors.forEach(r => html += `<li>${escapeHtml(r)}</li>`);
    html += `</ul></div>`;
  }
  // Прогноз погоды — после новостей и слухов, перед объявлениями.
  if (worldData.forecast && worldData.forecast.length > 0) {
    html += `<div class="hud-world-section hud-world-section-forecast" title="Нажмите для анимации"><div class="hud-world-title">🌦️ Прогноз погоды</div><div class="hud-forecast-row">`;
    const notes = [];
    worldData.forecast.forEach(row => {
      const f = parseForecastRow(row);
      const look = forecastLook(f.weather + ' ' + f.note);
      if (f.note) notes.push(f.note);
      // data-w говорит CSS, какую погоду разыгрывать в ячейке, а --t
      // задаёт цвет шкалы под числом. Оба эффекта спят до касания.
      const warmth = tempWarmth(parseTempC(f.temp));
      const styleAttr = warmth === null ? '' : ` style="--t:${warmth.toFixed(2)}"`;
      html += `<div class="hud-forecast-cell" data-w="${look.icon}"${styleAttr}>
        ${f.period ? `<span class="hud-forecast-period">${escapeHtml(f.period)}</span>` : ''}
        <span class="hud-forecast-icon w-${look.icon}">${W_ICONS[look.icon]}</span>
        ${f.temp ? `<span class="hud-forecast-temp">${escapeHtml(f.temp)}</span><span class="hud-fc-bar" aria-hidden="true"></span>` : ''}
        <span class="hud-forecast-desc">${escapeHtml(f.weather || look.label)}</span>
      </div>`;
    });
    html += `</div>`;
    if (notes.length) html += `<div class="hud-forecast-note">${escapeHtml(notes.join(' · '))}</div>`;
    html += `</div>`;
  }

  // Гороскоп — следом за прогнозом, тоже перед объявлениями.
  if ((worldData.horoscope && worldData.horoscope.length > 0) ||
      (worldData.prediction && worldData.prediction.length > 0)) {
    html += `<div class="hud-world-section hud-world-section-horo" title="Нажмите для анимации">
      <span class="hud-horo-stars" aria-hidden="true"></span>
      <div class="hud-world-title">🔮 Гороскоп на день</div>`;
    if (worldData.horoscope && worldData.horoscope.length > 0) {
      html += `<div class="hud-horo-grid">`;
      worldData.horoscope.forEach(row => {
        const h = parseHoroscopeRow(row);
        html += `<div class="hud-horo-card tone-${h.tone}">
          <span class="hud-horo-sign"><i>${zodiacGlyph(h.sign)}</i>${escapeHtml(h.sign)}</span>
          <span class="hud-horo-text">${escapeHtml(h.text)}</span>
          <span class="hud-horo-tone">${TONE_LABEL[h.tone]}</span>
        </div>`;
      });
      html += `</div>`;
    }
    if (worldData.prediction && worldData.prediction.length > 0) {
      html += `<div class="hud-horo-prediction"><span class="hud-horo-orb" aria-hidden="true"></span><span class="hud-horo-prediction-label">Предсказание дня</span>` +
        worldData.prediction.map(p => `<p>${escapeHtml(p)}</p>`).join('') + `</div>`;
    }
    html += `<div class="hud-horo-disclaimer">Развлечения ради. Звёзды ни за что не отвечают.</div></div>`;
  }

  if (worldData.ads && worldData.ads.length > 0) {
    html += `<div class="hud-world-section hud-world-section-ads"><div class="hud-world-title">📌 Доска объявлений</div><div class="hud-ads-grid">`;
    worldData.ads.forEach((ad, i) => html += `<div class="hud-ad-card hud-ad-neon n${(i % 4) + 1}">${escapeHtml(ad)}</div>`);
    html += `</div></div>`;
  }
  if (worldData.comments && worldData.comments.length > 0 && showComments) {
    html += `<div class="hud-world-section"><div class="hud-world-title">💬 Комментарии Сети</div><div class="hud-comments-list">`;
    worldData.comments.forEach(c => {
      const parsed = parseWorldComment(c);
      const color = HUD_AVATAR_COLORS[hudHashSeed(parsed.name) % HUD_AVATAR_COLORS.length];
      html += `<div class="hud-comment"><span class="hud-comment-avatar" style="background:${color}" aria-hidden="true">${escapeHtml(commentInitials(parsed.name))}</span><div class="hud-comment-body"><span class="hud-comment-name">${escapeHtml(parsed.name)}</span><span class="hud-comment-text">${escapeHtml(parsed.text)}</span></div></div>`;
    });
    html += `</div></div>`;
  }
  html += `</div>`;
  if (headlineTitles.length > 0) {
    const seq = headlineTitles.map(t => `<span class="hud-breaking-item">${escapeHtml(t)}</span>`).join('<span class="hud-breaking-dot">◆</span>');
    const loop = `<span class="hud-breaking-seq">${seq}<span class="hud-breaking-dot">◆</span></span>`;
    html += `<div class="hud-breaking-news" aria-hidden="true"><span class="hud-breaking-label">📺 BREAKING</span><div class="hud-breaking-track"><div class="hud-breaking-marquee">${loop}${loop}</div></div></div>`;
  }
  return html + `</div></div>`;
}

export function hudHasMeaningfulWorld(world) {
  return !!(world && typeof world === 'object' && Object.values(world).some(arr =>
    Array.isArray(arr) && arr.some(hudHasMeaningfulValue)
  ));
}
