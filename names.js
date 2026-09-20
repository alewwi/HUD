// hud-manager/names.js
//
// Нечёткое сопоставление имён: транслитерация кириллицы и приведение к
// фонетической латинице. Нужно графу отношений, чтобы «Michael», «Майкл» и
// «Майкл Смит» схлопывались в один узел. Вынесено из index.js без изменения
// поведения.

// ========= SMART NAME / RELATION PARSER =========
// Один и тот же персонаж может приходить как "Michael", "Майкл", "Mайкл",
// "Майкл Смит", "Michael Smith" и т.п. Граф сначала собирает все реальные
// имена, затем пытается сопоставить каждую ссылку с уже существующим узлом,
// и только после этого создаёт новый узел.
export function normalizeNameText(name) {
  return String(name ?? '')
    .normalize('NFKC')
    .replace(/[’'`]/g, '')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е');
}

export function transliterateCyrillic(name) {
  const src = normalizeNameText(name);
  const table = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  return Array.from(src).map(ch => table[ch] ?? ch).join('');
}

export function nameLettersOnly(name) {
  return transliterateCyrillic(name).replace(/[^a-z0-9]+/g, '');
}

export function namePhoneticLatin(name) {
  let s = nameLettersOnly(name);
  if (!s) return '';
  // Сводим распространённые варианты английского написания к близкой
  // фонетической форме, чтобы Michael/Mайкл, Sergei/Сергей и т.п. сближались.
  s = s
    .replace(/michael/g, 'maykl')
    .replace(/alexander/g, 'aleksandr')
    .replace(/alexandra/g, 'aleksandra')
    .replace(/catherine/g, 'katrin')
    .replace(/katherine/g, 'katrin')
    .replace(/caitlin/g, 'keytlin')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/th/g, 't')
    .replace(/wh/g, 'w')
    .replace(/gh/g, 'g')
    .replace(/ee/g, 'i')
    .replace(/ea/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/ou/g, 'u')
    .replace(/au/g, 'o')
    .replace(/ow/g, 'o')
    .replace(/ay/g, 'ey')
    .replace(/ai/g, 'ey')
    .replace(/ei/g, 'ey')
    .replace(/ie/g, 'i')
    .replace(/j/g, 'y')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/w/g, 'v');
  return s;
}

function nameConsonantSignature(name) {
  const s = namePhoneticLatin(name);
  return s.replace(/[aeiouy]+/g, '');
}

function nameVariants(name) {
  const raw = normalizeNameText(name);
  if (!raw) return new Set();
  const translit = nameLettersOnly(raw);
  const phonetic = namePhoneticLatin(raw);
  const consonants = nameConsonantSignature(raw);
  const squashed = raw.replace(/[^a-zа-я0-9]+/gi, '');
  const tokens = raw.split(/\s+/).filter(Boolean);
  const tokenTranslit = tokens.map(x => nameLettersOnly(x)).join('');
  return new Set([raw.replace(/[^a-zа-я0-9]+/gi, ''), translit, phonetic, consonants, squashed, tokenTranslit].filter(Boolean));
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let prev = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const cur = [i + 1];
    for (let j = 0; j < b.length; j++) {
      cur.push(Math.min(
        cur[j] + 1,
        prev[j + 1] + 1,
        prev[j] + (a[i] === b[j] ? 0 : 1)
      ));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Общее сравнение имён для всего HUD: транслитерация, фонетика, опечатка в одну
// букву. Уменьшительных форм здесь нет намеренно: «Лиза» и «Elizabeth» в одном
// сюжете могут оказаться разными людьми, и граф, аватарки и сводка их бы слили.
export function namesLikelySame(a, b) {
  const A = normalizeNameText(a), B = normalizeNameText(b);
  if (!A || !B) return false;
  if (A === B) return true;
  if (nameVariants(A).has(nameVariants(B).values().next().value)) return true;

  const va = nameVariants(A), vb = nameVariants(B);
  for (const x of va) if (vb.has(x)) return true;

  const ta = A.split(/\s+/), tb = B.split(/\s+/);
  // "Анна" и "Anna Smith" должны ссылаться на одного человека, если
  // совпадает первый/единственный идентифицирующий токен.
  const aFirst = namePhoneticLatin(ta[0] || A);
  const bFirst = namePhoneticLatin(tb[0] || B);
  if (aFirst && bFirst && (aFirst === bFirst || levenshtein(aFirst, bFirst) <= 1)) return true;

  const ca = nameConsonantSignature(A), cb = nameConsonantSignature(B);
  if (ca && cb) {
    const dist = levenshtein(ca, cb);
    // Две правки прощаем только длинным подписям, и меряем по короткой из
    // двух: у «утренний» (trnn) и «Тристан» (trstn) расстояние 2, и по
    // длинной они сходили за одного человека — чужой чат подписывался
    // именем владельца, а чужие реплики вставали справа.
    const minLen = Math.min(ca.length, cb.length);
    // Согласных мало, и по ним одному человеку легко сойти за другого:
    // «Тристан» (trstn) и «Кристина» (krstn) отличаются одной буквой.
    // Поэтому спрашиваем ещё и полное звучание: «Изольда» и «Isolde» по нему
    // рядом (izolda / isolde), а Тристан с Кристиной — нет.
    const полное = levenshtein(namePhoneticLatin(A), namePhoneticLatin(B));
    if (полное > 2) return false;
    if (dist <= 1 || (minLen >= 6 && dist <= 2)) return true;
  }
  return false;
}

// --- Уменьшительные формы ----------------------------------------------------
// «Миша» и «Michael». Транслитерация сама этого не видит: у «Миши» и «Майкла»
// разные согласные. Используются ТОЛЬКО в найтиПоИмени и только как самое
// слабое совпадение — в общее сравнение имён не входят.
const ПОЛНЫЕ_ФОРМЫ = {
  'миша': ['михаил'], 'мишка': ['михаил'], 'саша': ['александр', 'александра'], 'шура': ['александр', 'александра'],
  'женя': ['евгений', 'евгения'], 'леша': ['алексей'], 'алеша': ['алексей'], 'дима': ['дмитрий'], 'митя': ['дмитрий'],
  'коля': ['николай'], 'катя': ['екатерина'], 'настя': ['анастасия'], 'маша': ['мария'], 'таня': ['татьяна'],
  'лена': ['елена'], 'оля': ['ольга'], 'юля': ['юлия'], 'ваня': ['иван'], 'вова': ['владимир'], 'володя': ['владимир'],
  'петя': ['петр'], 'сережа': ['сергей'], 'паша': ['павел'], 'костя': ['константин'], 'наташа': ['наталья'],
  'света': ['светлана'], 'аня': ['анна'], 'даша': ['дарья'], 'соня': ['софья', 'софия'], 'лиза': ['елизавета'],
  'леня': ['леонид'], 'гоша': ['георгий'], 'ира': ['ирина'], 'вика': ['виктория'], 'витя': ['виктор'],
  'гриша': ['григорий'], 'рома': ['роман'], 'толя': ['анатолий'], 'слава': ['вячеслав', 'ярослав'], 'галя': ['галина'],
  'mike': ['michael'], 'mikey': ['michael'], 'mick': ['michael'], 'alex': ['alexander', 'alexandra'],
  'kate': ['catherine', 'katherine'], 'katie': ['catherine', 'katherine'], 'liz': ['elizabeth'], 'lizzy': ['elizabeth'],
  'beth': ['elizabeth'], 'bob': ['robert'], 'rob': ['robert'], 'bobby': ['robert'], 'bill': ['william'], 'will': ['william'],
  'dick': ['richard'], 'rick': ['richard'], 'richie': ['richard'], 'tom': ['thomas'], 'tommy': ['thomas'],
  'jim': ['james'], 'jimmy': ['james'], 'jack': ['john'], 'johnny': ['john'], 'tony': ['anthony'], 'sam': ['samuel', 'samantha'],
  'chris': ['christopher', 'christina'], 'nick': ['nicholas'], 'dan': ['daniel'], 'danny': ['daniel'], 'ben': ['benjamin'],
  'matt': ['matthew'], 'andy': ['andrew'], 'jen': ['jennifer'], 'jenny': ['jennifer'], 'sophie': ['sophia'],
  'maggie': ['margaret'], 'meg': ['margaret'], 'eddie': ['edward'], 'ed': ['edward'], 'ted': ['edward'],
};

function полныеФормы(слово) {
  const s = String(слово || '').toLowerCase().replace(/ё/g, 'е');
  return [s, ...(ПОЛНЫЕ_ФОРМЫ[s] || [])];
}

// Совпадение через полную форму: первое слово каждого имени пробуем в полной
// форме («Миша» → «Михаил»), остальное — как есть.
function совпадаютЧерезПолнуюФорму(a, b) {
  const A = String(a ?? '').trim().split(/\s+/), B = String(b ?? '').trim().split(/\s+/);
  if (!A[0] || !B[0]) return false;
  const низA = A[0].toLowerCase().replace(/ё/g, 'е'), низB = B[0].toLowerCase().replace(/ё/g, 'е');
  for (const fa of полныеФормы(A[0])) for (const fb of полныеФормы(B[0])) {
    if (fa === низA && fb === низB) continue;
    if (namesLikelySame([fa, ...A.slice(1)].join(' '), [fb, ...B.slice(1)].join(' '))) return true;
  }
  return false;
}

// --- Падежи ------------------------------------------------------------------
// «сестра Брэндона», «мать Софии», «жена Тристана Кингсли»: имя стоит в
// косвенном падеже. Отдаём возможные именительные формы — от них уже
// работает обычное сравнение. Латиница остаётся как есть.
const ОКОНЧАНИЯ = [
  ['ами', ''], ['ями', ''], ['ого', ''], ['его', ''], ['ому', ''], ['ему', ''],
  ['ией', 'ия'], ['ии', 'ия'], ['ии', 'и'], ['ию', 'ия'], ['ой', 'а'], ['ей', 'я'], ['ей', 'и'], ['ом', ''], ['ем', ''], ['ым', ''], ['им', ''],
  ['а', ''], ['я', 'й'], ['я', 'ь'], ['у', 'а'], ['ю', 'я'], ['ы', 'а'], ['и', 'а'], ['и', 'я'], ['е', 'а'], ['е', 'я'], ['е', ''], ['у', ''], ['ю', 'й'],
];
function формыСлова(слово) {
  const s = String(слово || '').replace(/ё/g, 'е').replace(/Ё/g, 'Е');
  const out = [s];
  if (!/[а-яё]/i.test(s)) return out;
  const низ = s.toLowerCase();
  for (const [конец, замена] of ОКОНЧАНИЯ) {
    if (низ.length >= конец.length + 3 && низ.endsWith(конец)) {
      const форма = s.slice(0, s.length - конец.length) + замена;
      if (!out.includes(форма)) out.push(форма);
    }
  }
  return out;
}
export function формыИмени(имя) {
  const слова = String(имя || '').trim().split(/\s+/).filter(Boolean);
  if (!слова.length) return [];
  const первые = формыСлова(слова[0]);
  const хвосты = слова.length > 1 ? [...new Set([слова.slice(1).join(' '), слова.slice(1).map(w => формыСлова(w)[1] || w).join(' ')])] : [''];
  const out = [];
  for (const п of первые) for (const х of хвосты) out.push((п + ' ' + х).trim());
  return out;
}

// Кто из списка имён назван в тексте. Три ступени, сильная главнее слабой:
//   3 — звучит один в один («Тристана» → Tristan);
//   2 — похоже по общему сравнению (опечатка, другое написание);
//   1 — только через уменьшительную форму («Миши» → Michael).
// Побеждает высшая ступень. Если на ней двое — не угадываем: -1.
export function найтиПоИмени(имя, имена) {
  const формы = формыИмени(имя);
  if (!формы.length) return -1;
  const звук = (w) => namePhoneticLatin(w);
  let лучший = -1, лучшийСчёт = 0, спор = false;
  (имена || []).forEach((другое, i) => {
    const первоеДругого = String(другое || '').trim().split(/\s+/)[0] || '';
    let счёт = 0;
    for (const ф of формы) {
      const первое = ф.split(/\s+/)[0];
      if (звук(первое) && звук(первое) === звук(первоеДругого)) { счёт = 3; break; }
      if (namesLikelySame(ф, другое)) счёт = Math.max(счёт, 2);
      else if (совпадаютЧерезПолнуюФорму(ф, другое)) счёт = Math.max(счёт, 1);
    }
    if (!счёт) return;
    if (счёт > лучшийСчёт) { лучший = i; лучшийСчёт = счёт; спор = false; }
    else if (счёт === лучшийСчёт) спор = true;
  });
  return спор ? -1 : лучший;
}
