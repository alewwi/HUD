// hud-manager/render/diary.js
//
// Домен «Дневник»: нормализация настроения, рендер записи, стикер автора,
// кляксы и сборка HTML вкладки. Вынесено из index.js без изменения поведения.
//
// index.js импортирует отсюда только buildDiaryHTML и hudHasMeaningfulDiary —
// остальное экспортируется для тестов и внутренних нужд домена.

import { escapeHtml, hudHasMeaningfulValue } from '../utils.js?v=22.5.8';

// Дневник: расширенный словарь эмоциональных синонимов. Все варианты
// нормализуются в существующие визуальные темы CSS: sad / angry / panic / neutral.
export function normalizeDiaryMood(value) {
  const raw = String(value ?? '')
    .toLowerCase()
    .replace(/[ё]/g, 'е')
    .trim();
  if (!raw || raw === 'empty' || raw === 'none' || raw === 'neutral' || raw === 'нейтрально') return 'neutral';

  const patterns = [
    { key: 'sad', tests: [
      // RU
      'грусть','груст','печаль','печальн','уныни','уныл','тоска','тосклив','скорб','горе','горев','слез','слеза','слезы','слезами',
      'рыдан','плакс','плачет','плач','подавлен','подавленн','разбит','разочарован','разочарование','одиночеств','одинок','меланхол','безнад','отчаяни','безысход','боль','болезн','тяжело','тяжесть','жалость','сожален','скука','скучает','скучан','ностальг','ломка','сердце разбито','разбитое сердце','обида','обижен','обиженн',
      // EN
      'sad','sadness','sorrow','sorrowful','sorrowing','grief','grieving','mourning','mourne','melancholy','melancholic','blue','downcast','downhearted','unhappy','misery','miserable','lonely','loneliness','alone','heartbroken','heartbreak','depressed','depression','despair','despairing','hopeless','hopelessness','gloom','gloomy','dreary','somber','sombre','regret','regretful','regrets','remorse','hurt','hurting','pain','painful','sulk','sullen','doleful','tearful','tears','tear','cry','crying','weeping','weep','sob','sobbing','homesick','nostalgic','nostalgia','bitter','bittersweet'
    ]},
    { key: 'angry', tests: [
      // RU
      'ярость','ярост','злость','злит','злой','злая','раздраж','раздражен','раздраженн','бесит','бешен','бешенств','гнев','гневн','злоб','агресс','агрессив','враждеб','враждебн','озлоб','возмущ','негодован','презрен','презрени','ненавист','ненавиж','ненависть','обида','обижен','оскорблен','оскорблени','фрустрац','фрустрир','напряж','напряжен','напряженн','нервн','нервнич','нервоз','стресс','стрессов','стрессир','тревожн','задет','вскип','кипит','кипение','грубо','жестко','жесток','сарказм','саркаст','разъяр','вспыльчив','взбеш','бесит',
      // EN
      'angry','anger','rage','raging','furious','fury','mad','madness','irate','ire','wrath','wrathful','annoy','annoyed','annoyance','irritat','irritated','frustrat','frustrated','frustration','agitated','agitation','hostile','hostility','resent','resentful','resentment','hatred','hate','hateful','outrage','outraged','offended','insulted','bitter','tense','tension','stressed','stress','nervous','nervousness','aggression','aggressive','hostility','snappy','snapped','furious','enraged','boiling','seething','heated','heatedly','sarcastic','sarcasm','spiteful','venomous','wrath','vexed','cross'
    ]},
    { key: 'panic', tests: [
      // RU
      'паник','паничес','страх','страш','испуг','испуган','ужас','ужасн','кошмар','тревог','тревож','беспокой','обеспоко','нервоз','нервнич','дрож','дрожит','дрожащ','растерян','растерянн','смятен','сует','спешк','спешит','тороп','торопит','срочн','аварийн','хаос','хаотич','безумн','отчаянн','в отчаяни','волнение','взволнован','взволнованн','шок','шокирован','ошелом','ошарашен','опасен','опасност','на грани','неистово','лихорадоч','срыва','срыв','страдает от тревоги','адреналин',
      // EN
      'panic','panicked','panicking','fear','fearful','afraid','scared','fright','frightened','terror','terrified','horror','horrified','nightmare','anxious','anxiety','uneasy','uneasiness','worry','worried','nervous','nervously','shaking','shaky','trembling','tremor','restless','restlessness','confused','confusion','flustered','fluster','hurry','hurried','rush','rushed','urgent','urgency','emergency','chaos','chaotic','frantic','frenzy','desperate','desperation','alarm','alarmed','alarming','shock','shocked','stunned','startled','overwhelmed','overwhelm','unsafe','danger','dangerous','edge','breakdown','meltdown','adrenaline','distress','distressed','dread','dreadful'
    ]}
  ];
  for (const entry of patterns) {
    if (entry.tests.some(test => raw.includes(test))) return entry.key;
  }
  return 'neutral';
}

export function renderDiaryText(value) {
  return escapeHtml(String(value ?? '')).replace(/~~(.*?)~~/g, '<s>$1</s>');
}

export function getDiaryStickerText(author) {
  const safe = String(author ?? '').trim();
  if (!safe || safe === 'empty' || safe === 'none') return 'N';
  const parts = safe.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'N';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function buildDiaryStains(seed) {
  const stableSeed = Array.from(String(seed || '')).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return Array.from({ length: 3 }, (_, i) => {
    const left = 6 + ((stableSeed + i * 23) % 76);
    const top = 12 + ((stableSeed * 7 + i * 41) % 62);
    const size = 10 + ((stableSeed + i * 17) % 16);
    const opacity = 0.07 + ((stableSeed + i * 13) % 12) / 100;
    const rotation = (stableSeed + i * 29) % 360;
    return `<span class="hud-diary-stain" style="left:${left}%; top:${top}%; width:${size}px; height:${size}px; opacity:${opacity}; transform:rotate(${rotation}deg);"></span>`;
  }).join('');
}

export function buildDiaryHTML(diaryData, uid, isChecked) {
  let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-diary-container">`;
  if (!diaryData || diaryData.length === 0) {
    return html + `<div class="hud-diary-empty">📖 Записей дневника пока нет.</div></div></div>`;
  }
  diaryData.forEach(entry => {
    const seed = typeof entry === 'object' && entry !== null ? `${entry.author || ''}|${entry.time || ''}|${entry.text || ''}` : String(entry || '');
    const moodKey = typeof entry === 'string' ? 'neutral' : normalizeDiaryMood(entry.mood || entry.emotion || '');
    const sticker = (typeof entry === 'object' && entry !== null && entry.author && entry.author.toLowerCase() !== 'none' && entry.author.toLowerCase() !== 'empty')
      ? `<span class="hud-diary-sticker">${escapeHtml(getDiaryStickerText(entry.author))}</span>`
      : '';
    const stains = buildDiaryStains(seed);

    if (typeof entry === 'string') {
      let parts = entry.split('|'); let time = parts[0].trim(); let text = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
      if (!text) { text = time; time = 'Скрытая запись'; }
      html += `<div class="hud-diary-entry hud-diary-mood-${moodKey}">${sticker}${stains}<div class="hud-diary-time">${escapeHtml(time)}</div><div class="hud-diary-text">${renderDiaryText(text)}</div></div>`;
    } else {
      const author = entry && entry.author && entry.author.toLowerCase() !== 'none' && entry.author.toLowerCase() !== 'empty' ? entry.author : '';
      const time = entry && entry.time ? entry.time : 'Скрытая запись';
      const aboutUser = entry && entry.aboutUser && entry.aboutUser.toLowerCase() !== 'none' && entry.aboutUser.toLowerCase() !== 'empty' ? entry.aboutUser : '';
      const text = entry && entry.text ? entry.text : '';
      html += `<div class="hud-diary-entry hud-diary-mood-${moodKey}">${sticker}${stains}${author ? `<div class="hud-diary-author">${escapeHtml(author)}</div>` : ''}<div class="hud-diary-time">${escapeHtml(time)}</div><div class="hud-diary-text">${renderDiaryText(text)}</div>${aboutUser ? `<div class="hud-diary-about-user"><span class="hud-diary-about-label">О ней:</span> ${renderDiaryText(aboutUser)}</div>` : ''}</div>`;
    }
  });
  return html + `</div></div>`;
}

export function hudHasMeaningfulDiary(items) {
  return Array.isArray(items) && items.some(i => {
    if (typeof i === 'string') return hudHasMeaningfulValue(i);
    if (!i || typeof i !== 'object') return false;
    return hudHasMeaningfulValue(i.text) || hudHasMeaningfulValue(i.aboutUser);
  });
}
