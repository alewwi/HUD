// hud-manager/chat-stats.js
//
// Дашборд архива: «здоровье» самого чата, а не только его HUD-блоков.
//
// Считается в том же проходе, что и архив (history-analyzer.js): модуль
// отдаёт накопитель, в который архив кладёт каждое сообщение вместе с уже
// разобранным HUD. Второго разбора чата нет.
//
// Текст сообщения здесь только считается, на экран не выводится, поэтому
// разметку режем регуляркой — DOM на тысячу сообщений не нужен.

import { hudFilled } from './utils.js?v=22.99.76';

import { hudBlockRe } from './hud-block.js?v=22.99.76';
const HUD_БЛОК = hudBlockRe('gi');
// Служебные вставки других расширений и размышления модели — не проза.
const СЛУЖЕБНОЕ = /<(think|thinking|plan|comics|img|script|style|details|summary)\b[^>]*>[\s\S]*?<\/\1>/gi;

export function чистыйТекст(raw) {
  return String(raw || '')
    .replace(HUD_БЛОК, ' ')
    .replace(СЛУЖЕБНОЕ, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// Служебные слова, которые заняли бы весь топ и ничего не сказали бы.
const СТОП = new Set((
  'этот эта это эти этого этой этим этом того тому тот чтобы когда потом теперь только очень может можно будет было были была быть есть ' +
  'него неё нее ними своей свой свою своё свое свои себя себе тебя тебе меня мной нами вами даже если чем как так там тут где кто что его её ее ' +
  'они она оно для при без над под через после перед между ещё еще уже всё все всех всем весь вся лишь хотя ведь вот или либо также тоже снова ' +
  'опять сейчас здесь которые который которая которое которых просто чуть немного наконец свою своих твой твоя твои мой моя мои наш ваш будто ' +
  'словно почти совсем вдруг ничего никто нибудь чего чему кого кому зачем почему пока тоже этих этими этому самый самая самое сама сам сами ' +
  'that this with have from they them their there what when your will would could should been were into then than just like about more some ' +
  'only over also very which while where because after before still even back down each other such here does doing said ' +
  // Короткие служебные слова. В пары идут слова от трёх букв, и «and the»,
  // «she was», «она его» занимали весь топ частых фраз. Обрывки сокращений
  // (didn, wasn) остаются от разбиения «didn't» на слова.
  'the and you for but not her his she him was are had has can all out one our who get got did yes how its may say see too now off own why let way any new two ' +
  'know going something really want think right look make says tell much many those these being having again around through against without ' +
  'between under upon every never always maybe yeah okay well might must shall cannot didn doesn isn wasn aren weren won wouldn couldn shouldn haven hasn hadn ' +
  'был мне нас вас ему ней них том тем раз нет для как это при про над под без ним нём нем его всё она они мой моя наш ваш тот той там тут вот уже ещё'
).split(/\s+/));

const МЕСЯЦЫ_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Время отправки. SillyTavern пишет «September 12, 2026 8:57pm», старые
// версии — число или «2026-09-12@20h57m28s». Не разобрали — null.
export function времяОтправки(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v > 1e12 ? v : v * 1000;
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (m) {
    const месяц = МЕСЯЦЫ_EN.indexOf(m[1].slice(0, 3).toLowerCase());
    let час = Number(m[4]);
    if (m[6]) час = (час % 12) + (m[6].toLowerCase() === 'pm' ? 12 : 0);
    if (месяц >= 0) return new Date(Number(m[3]), месяц, Number(m[2]), час, Number(m[5])).getTime();
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})@(\d{2})h(\d{2})m/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

const заполнено = (v) => hudFilled(v) && !/^(empty|none|нет|n\/a|-|—)$/i.test(String(v).trim());
const минутыИз = (s) => {
  const m = String(s || '').match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  return m && Number(m[1]) < 24 ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const ключМеста = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').split(/[,;(]/)[0]
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const тотЖеМесто = (a, b) => a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)));
const экранRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const медиана = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
const топ = (карта, n, минимум = 1) => [...карта.entries()].filter(([, c]) => c >= минимум)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);

export function createDashboard({ userName = '' } = {}) {
  let всего = 0, отИгрока = 0, знаков = 0, слов = 0;
  const говорящие = new Map();
  const слова = new Map(), пары = new Map();
  const часы = new Array(24).fill(0);
  let сВременем = 0;
  const длины = [];
  const времена = [];
  const свайпы = [];
  const повторы = [];
  let прошлыйИИ = null, сходствоСумма = 0, сходствоПар = 0;
  let диалог = 0, описание = 0;
  const сцены = [];
  let сцена = null;
  let hudХодов = 0, nsfwХодов = 0, nsfwСерий = 0, nsfwБыл = false;
  const имена = new Map();
  const тексты = [];

  const запомнитьИмя = (имя) => {
    const полное = String(имя || '').trim();
    const ключ = полное.toLowerCase().split(/\s+/)[0];
    if (ключ && ключ.length >= 2 && !имена.has(ключ)) имена.set(ключ, полное);
  };

  function add(mes, data, at) {
    if (!mes || mes.is_system) return;
    const текст = чистыйТекст(mes.mes);
    if (!текст && !data) return;
    const игрок = !!mes.is_user;
    const имя = String(mes.name || (игрок ? userName : '') || '?').trim();
    const токены = текст.match(/[\p{L}\p{N}]+/gu) || [];
    всего++; if (игрок) отИгрока++;
    знаков += текст.length; слов += токены.length;
    const g = говорящие.get(имя) || { name: имя, count: 0, chars: 0, isUser: игрок };
    g.count++; g.chars += текст.length; говорящие.set(имя, g);
    запомнитьИмя(имя);

    const t = времяОтправки(mes.send_date);
    if (t !== null) времена.push(t);

    const низ = токены.map(x => x.toLowerCase());
    for (let i = 0; i < низ.length; i++) {
      const w = низ[i];
      if (w.length >= 4 && !СТОП.has(w) && !/^\d+$/.test(w)) слова.set(w, (слова.get(w) || 0) + 1);
      const v = низ[i + 1];
      if (v && w.length >= 3 && v.length >= 3 && !СТОП.has(w) && !СТОП.has(v) && !/\d/.test(w + v)) {
        const пара = w + ' ' + v;
        пары.set(пара, (пары.get(пара) || 0) + 1);
      }
    }
    if (текст) тексты.push({ говорит: имя.toLowerCase().split(/\s+/)[0], текст: текст.slice(0, 6000) });

    if (!игрок && текст) {
      длины.push({ at, len: текст.length });
      свайпы.push({ at, n: Array.isArray(mes.swipes) && mes.swipes.length ? mes.swipes.length : 1 });
      // Повторы: доля общих троек слов с прошлым ответом модели. Мерим от
      // меньшего из двух — короткий ответ, целиком списанный с длинного, это
      // тоже повтор.
      const тройки = new Set();
      for (let i = 0; i + 2 < низ.length; i++) тройки.add(низ[i] + ' ' + низ[i + 1] + ' ' + низ[i + 2]);
      if (прошлыйИИ && тройки.size >= 5 && прошлыйИИ.тройки.size >= 5) {
        let общих = 0, пример = '';
        for (const x of тройки) {
          if (!прошлыйИИ.тройки.has(x)) continue;
          общих++;
          if (!пример && x.split(' ').filter(w => !СТОП.has(w) && w.length >= 3).length >= 2) пример = x;
        }
        const доля = общих / Math.min(тройки.size, прошлыйИИ.тройки.size);
        сходствоСумма += доля; сходствоПар++;
        if (доля >= 0.12) повторы.push({ at, prev: прошлыйИИ.at, similarity: Math.round(доля * 100), phrase: пример });
      }
      прошлыйИИ = { at, тройки };
      // Диалог — всё в кавычках и строки, начатые тире.
      const вКавычках = (текст.match(/«[^»]*»|“[^”]*”|„[^“”]*[“”]|"[^"\n]*"/g) || []).join('').length;
      const реплики = (текст.match(/(?:^|\n)\s*[—–]\s[^\n]*/g) || []).join('').length;
      const д = Math.min(текст.length, вКавычках + реплики);
      диалог += д; описание += текст.length - д;
    }

    if (data) {
      hudХодов++;
      const мин = минутыИз(data.scene && data.scene['Время']);
      if (мин !== null) { часы[Math.floor(мин / 60)]++; сВременем++; }
      (Array.isArray(data.characters) ? data.characters : []).forEach(c => c && заполнено(c['Имя']) && запомнитьИмя(c['Имя']));
      const персонажи = Array.isArray(data.characters) ? data.characters : [];
      const nsfw = персонажи.some(c => c && (заполнено(c['Фаза близости']) || заполнено(c['NSFW'])))
        || !!(data.user && заполнено(data.user['NSFW (Юзер)']));
      if (nsfw) { nsfwХодов++; if (!nsfwБыл) nsfwСерий++; }
      nsfwБыл = nsfw;
      const место = (персонажи[0] && персонажи[0]['Место']) || (data.user && data.user['Место']) || '';
      if (заполнено(место)) {
        const ключ = ключМеста(место);
        if (!сцена || !тотЖеМесто(сцена.ключ, ключ)) {
          сцена = { place: String(место).split(/[,;(]/)[0].trim(), ключ, from: at, to: at, turns: 1, start: мин, end: мин };
          сцены.push(сцена);
        } else {
          сцена.to = at; сцена.turns++;
          if (мин !== null) { if (сцена.start === null) сцена.start = мин; сцена.end = мин; }
        }
      }
    }
  }

  function finish() {
    // Темп: паузы больше двух часов делят чат на сессии и в медиану не идут.
    const t = [...времена].sort((a, b) => a - b);
    const паузы = [];
    let сессий = t.length ? 1 : 0;
    for (let i = 1; i < t.length; i++) {
      const мин = (t[i] - t[i - 1]) / 60000;
      if (мин > 120) сессий++; else паузы.push(мин);
    }
    const дней = t.length >= 2 ? Math.max(1, Math.round((t[t.length - 1] - t[0]) / 86400000) + 1) : null;

    const списокГоворящих = [...говорящие.values()].sort((a, b) => b.count - a.count);
    const главные = списокГоворящих.slice(0, 7).map(g => ({ ...g, share: всего ? Math.round(g.count / всего * 1000) / 10 : 0 }));
    const прочие = списокГоворящих.slice(7);
    if (прочие.length) {
      const count = прочие.reduce((s, g) => s + g.count, 0);
      главные.push({ name: 'Остальные', count, chars: прочие.reduce((s, g) => s + g.chars, 0), isUser: false, share: всего ? Math.round(count / всего * 1000) / 10 : 0, other: true });
    }

    // Длина: не больше 48 точек, иначе линия на телефоне превращается в шум.
    const шаг = Math.max(1, Math.ceil(длины.length / 48));
    const точки = [];
    for (let i = 0; i < длины.length; i += шаг) {
      const кусок = длины.slice(i, i + шаг);
      точки.push({ at: кусок[Math.floor(кусок.length / 2)].at, len: Math.round(кусок.reduce((s, x) => s + x.len, 0) / кусок.length) });
    }
    const треть = Math.floor(длины.length / 3);
    const среднее = (xs) => xs.length ? xs.reduce((s, x) => s + x.len, 0) / xs.length : null;
    const первая = треть >= 2 ? среднее(длины.slice(0, треть)) : null;
    const последняя = треть >= 2 ? среднее(длины.slice(-треть)) : null;

    const сСвайпами = свайпы.filter(s => s.n > 1);

    // Упоминания: имя узнаём по основе — «Софи», «Софией», «Софию».
    const образцы = [...имена.entries()].map(([ключ, полное]) => {
      const основа = ключ.length >= 5 ? ключ.slice(0, -1) : ключ;
      return { ключ, полное, rx: new RegExp('(?<![\\p{L}])' + экранRx(основа) + '\\p{L}{0,3}(?![\\p{L}])', 'iu') };
    });
    const упоминания = new Map();
    for (const { говорит, текст } of тексты) {
      const кто = образцы.find(o => o.ключ === говорит);
      if (!кто) continue;
      for (const o of образцы) {
        if (o.ключ === говорит || !o.rx.test(текст)) continue;
        const k = кто.полное + ' ' + o.полное;
        упоминания.set(k, (упоминания.get(k) || 0) + 1);
      }
    }

    const длиннаяСцена = сцены.reduce((лучшая, s) => (!лучшая || s.turns > лучшая.turns ? s : лучшая), null);
    const минутыСцены = (s) => (s.start !== null && s.end !== null ? (s.end - s.start + 1440) % 1440 : null);
    const сценаНаружу = (s) => ({ place: s.place, from: s.from, to: s.to, turns: s.turns, minutes: минутыСцены(s) });

    return {
      health: {
        messages: всего, user: отИгрока, ai: всего - отИгрока,
        avgChars: всего ? Math.round(знаков / всего) : 0,
        avgWords: всего ? Math.round(слов / всего) : 0,
        days: дней, perDay: дней ? Math.round(t.length / дней * 10) / 10 : null,
        medianGapMin: паузы.length ? Math.round(медиана(паузы) * 10) / 10 : null,
        sessions: сессий, timed: t.length,
      },
      speakers: главные,
      heatmap: { hours: часы, total: сВременем },
      words: топ(слова, 10).map(([word, count]) => ({ word, count })),
      phrases: топ(пары, 10, 2).map(([phrase, count]) => ({ phrase, count })),
      length: {
        points: точки,
        firstAvg: первая === null ? null : Math.round(первая),
        lastAvg: последняя === null ? null : Math.round(последняя),
        changePct: первая && последняя ? Math.round((последняя - первая) / первая * 100) : null,
      },
      engagement: {
        aiMessages: свайпы.length, swiped: сСвайпами.length,
        extraSwipes: свайпы.reduce((s, x) => s + x.n - 1, 0),
        top: [...сСвайпами].sort((a, b) => b.n - a.n || a.at - b.at).slice(0, 5).map(s => ({ at: s.at, swipes: s.n })),
      },
      boring: {
        avgSimilarity: сходствоПар ? Math.round(сходствоСумма / сходствоПар * 100) : null,
        zones: [...повторы].sort((a, b) => b.similarity - a.similarity || a.at - b.at).slice(0, 5),
      },
      scenes: {
        count: сцены.length,
        avgTurns: сцены.length ? Math.round(сцены.reduce((s, x) => s + x.turns, 0) / сцены.length * 10) / 10 : null,
        longest: длиннаяСцена ? сценаНаружу(длиннаяСцена) : null,
        list: сцены.slice(-12).map(сценаНаружу),
      },
      dialogue: {
        dialogueChars: диалог, descriptionChars: описание,
        share: диалог + описание ? Math.round(диалог / (диалог + описание) * 100) : null,
      },
      nsfw: { hudTurns: hudХодов, nsfwTurns: nsfwХодов, scenes: nsfwСерий, share: hudХодов ? Math.round(nsfwХодов / hudХодов * 100) : 0 },
      mentions: топ(упоминания, 15).map(([k, count]) => { const [from, to] = k.split(' '); return { from, to, count }; }),
    };
  }

  return { add, finish };
}
