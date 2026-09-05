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
    const maxLen = Math.max(ca.length, cb.length);
    if (dist <= 1 || (maxLen >= 5 && dist <= 2)) return true;
  }
  return false;
}

