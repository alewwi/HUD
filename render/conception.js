// hud-manager/render/conception.js
//
// Скрытый исход близости: было зачатие или нет.
//
// Кубик бросается один раз на каждую близость, итог хранится в метаданных
// чата. Игрок видит только кнопку «Сделать тест» в блоке цикла, а модель
// получает итог скрытым фактом сюжета: она знает, но персонажи — нет, пока
// не сделают тест или не заметят признаков.
//
// Одну и ту же близость модель из хода в ход пишет по-разному («этой ночью,
// ~01:10», «прошлой ночью около 01:10»). Если бы ключом был весь текст, каждая
// переформулировка давала бы новый бросок — лишний шанс. Поэтому ключ —
// время близости и партнёр, а первый бросок по этому ключу запоминается.

import { namesLikelySame } from '../names.js?v=23.3.4';

const КЛЮЧ = 'tavernosHudConception';

function контекстST() {
  try { return window.SillyTavern?.getContext?.() || null; } catch (_) { return null; }
}
function хранилище() {
  const ctx = контекстST();
  const мета = ctx && (ctx.chatMetadata || ctx.chat_metadata);
  if (!мета) return null;
  if (!мета[КЛЮЧ] || typeof мета[КЛЮЧ] !== 'object') мета[КЛЮЧ] = { броски: {}, зачатие: {} };
  мета[КЛЮЧ].броски ||= {};
  мета[КЛЮЧ].зачатие ||= {};
  return мета[КЛЮЧ];
}
function сохранить() {
  const ctx = контекстST();
  try { (ctx?.saveMetadataDebounced || ctx?.saveMetadata)?.call(ctx); } catch (_) {}
}

// Ключ близости: время из поля «Последний секс» и первое слово партнёра.
// Времени нет — весь текст без пробелов и знаков.
export function ключБлизости(секс) {
  const s = String(секс || '');
  const время = (s.match(/\b(\d{1,2}):(\d{2})\b/) || [])[0];
  const партнёр = ((s.match(/(?:^|[;|])\s*pr\s*:\s*([^;|]+)/i) || [])[1] || '').trim().split(/\s+/)[0] || '';
  return время ? (время + '|' + партнёр.toLowerCase()) : s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 60);
}

// Имя персонажа модель пишет по-разному («Seraphina», «Серафина»): ищем уже
// заведённую запись по нечёткому совпадению, чтобы не завести вторую.
function своёИмя(х, кто) {
  if (!х || кто === 'user' || !String(кто).startsWith('char:')) return кто;
  const имя = String(кто).slice(5);
  const все = new Set([...Object.keys(х.зачатие || {}), ...Object.values(х.броски || {}).map(б => б && б.кто)].filter(Boolean));
  for (const к of все) if (String(к).startsWith('char:') && namesLikelySame(String(к).slice(5), имя)) return к;
  return кто;
}

/**
 * Итог близости для человека.
 * кто — стабильный идентификатор («char:Серафина», «user»); риск — результат
 * рискЗачатия() (render/intimacy.js) для этой близости; секс — текст поля.
 * Возвращает { беременна, когда, этаБлизость } — беременность «липкая»:
 * если зачатие уже было, новые близости её не отменяют.
 */
export function исходЗачатия(кто, риск, секс) {
  const х = хранилище();
  кто = своёИмя(х, кто);
  const был = String(секс || '').trim() && !/^(empty|none|нет|не было)$/i.test(String(секс).trim());
  let этаБлизость = null;
  if (был && риск && риск.бросок) {
    const к = кто + '|' + ключБлизости(секс);
    if (х) {
      if (!х.броски[к]) {
        const порог = Math.max(1, Math.round(риск.шанс * 100));
        х.броски[к] = { бросок: риск.бросок, порог, итог: риск.бросок <= порог, когда: String(секс).slice(0, 160), кто };
        if (х.броски[к].итог && !х.зачатие[кто]) х.зачатие[кто] = { когда: х.броски[к].когда };
        сохранить();
      }
      этаБлизость = х.броски[к];
    } else {
      // Нет метаданных (стенд, старая Таверна) — считаем на лету.
      const порог = Math.max(1, Math.round(риск.шанс * 100));
      этаБлизость = { бросок: риск.бросок, порог, итог: риск.бросок <= порог, когда: String(секс).slice(0, 160), кто };
    }
  }
  const зачатие = х ? х.зачатие[кто] : (этаБлизость && этаБлизость.итог ? { когда: этаБлизость.когда } : null);
  return { беременна: !!зачатие, когда: зачатие ? зачатие.когда : '', этаБлизость };
}

/**
 * Скрытые факты для инструкции модели. Знает автор, персонажи — нет.
 * Кого касается: всё, что лежит в метаданных чата.
 */
export function скрытыеФактыЗачатия() {
  const х = хранилище();
  if (!х) return '';
  const имя = (кто) => кто === 'user' ? '{{user}}' : String(кто).replace(/^char:/, '');
  const строки = [];
  for (const [кто, з] of Object.entries(х.зачатие || {})) {
    строки.push(`${имя(кто)} CONCEIVED during the encounter «${з.когда}». Nobody in the story knows it. Let it unfold on its real schedule: no signs for about two weeks, then a late period, nausea, tender breasts, tiredness; only a pregnancy test or a doctor confirms it. Never hint at it in narration or thoughts before the characters find out. From the moment a test or a doctor confirms it, track it in Prg.`);
  }
  // Последняя близость без зачатия у тех, кто не беременен: чтобы модель не
  // выдумала беременность сама.
  const последние = {};
  for (const б of Object.values(х.броски || {})) if (б && !б.итог && !(х.зачатие || {})[б.кто]) последние[б.кто] = б;
  for (const б of Object.values(последние)) {
    строки.push(`The encounter «${б.когда}» did NOT make ${имя(б.кто)} pregnant: if anyone worries, the period comes on time and a test is negative.`);
  }
  if (!строки.length) return '';
  return `\n\n## 🔒 HIDDEN STORY FACTS — for you as the author only
These were decided by a dice roll and are final. The characters do NOT know them.
- ${строки.join('\n- ')}`;
}
