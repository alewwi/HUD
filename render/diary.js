// hud-manager/render/diary.js
//
// Домен «Дневник»: нормализация настроения, рендер записи, стикер автора,
// кляксы и сборка HTML вкладки. Вынесено из index.js без изменения поведения.
//
// index.js импортирует отсюда только buildDiaryHTML и hudHasMeaningfulDiary —
// остальное экспортируется для тестов и внутренних нужд домена.

import { escapeHtml, hudHasMeaningfulValue } from '../utils.js?v=22.19.1';

// Дневник: словарь эмоциональных синонимов. Раньше всё сводилось к
// четырём темам (sad / angry / panic / neutral) — «скука», «презрение»,
// «подавленность» и «раздражение» выглядели одинаково с грустью или
// злостью. Сейчас тем двадцать четыре, у каждой свой вид листа в CSS
// (.hud-diary-mood-<ключ>).
//
// ПОРЯДОК СПИСКА ЗНАЧИМ: проверка идёт сверху вниз и берёт первое
// совпадение подстроки. Узкие темы («ревность», «разочарование») стоят
// выше широких («злость», «грусть»), иначе широкая перехватит их первой.
// Поэтому «стыд» живёт в shame, а не в guilt, «отвращение» — в disgust,
// а не в contempt: слово должно быть ровно в одном списке.
export function normalizeDiaryMood(value) {
  const raw = String(value ?? '')
    .toLowerCase()
    .replace(/[ё]/g, 'е')
    .trim();
  if (!raw || raw === 'empty' || raw === 'none' || raw === 'neutral' || raw === 'нейтрально') return 'neutral';

  const patterns = [
    { key: 'triumph', tests: [
      'триумф','триумфаль','победа','побед','выиграл','выиграла','ликован','ликует','торжеств','гордость','горд','горделив','превосходств','упоени','эйфор','воодушевлен','окрылен','всесил',
      'triumph','triumphant','victory','victorious','win','won','winner','elated','elation','exult','exultant','jubilant','jubilation','pride','proud','glory','glorious','euphoria','euphoric','vindicated','vindication','smug'
    ]},
    { key: 'collapse', tests: [
      'сокрушен','сокруша','крах','рухнул','рухнет','обвал','развалил','разрушен','разруха','надлом','сломлен','сломал','катастроф','провал','падени','пала','упала на дно','дно','конец всему','все кончено','всему конец','руин','пепелищ','обломк','крушени',
      'collapse','collapsed','collapsing','crumbl','ruin','ruined','ruins','wreck','wrecked','shatter','shattered','broken down','downfall','undone','crushed','devastat','catastroph','disaster','fell apart','falling apart','rock bottom','the end of everything','defeat','defeated'
    ]},
    { key: 'realization', tests: [
      'осозна','осознан','понима','поняла','понял','понял','прозрени','прозрел','озарени','озарило','дошло','догадал','догадка','стало ясно','ясност пришла','открылос','увидела правду','сообраз','раскусил','сложилас картина',
      'realiz','realis','realization','realisation','epiphany','insight','dawned','it dawned','clarity','understood','understand','understanding','comprehend','figured out','it clicked','saw the truth','revelation','recognition','recognized','recognised','sudden clarity'
    ]},
    { key: 'jealousy', tests: [
      'ревност','ревну','ревнив','ревнует','завист','завидует','завидн','собственнич',
      'jealous','jealousy','envy','envious','possessive','possessiveness','green-eyed','covet','covetous'
    ]},
    { key: 'obsession', tests: [
      'одержим','одержимост','навязчив','зациклил','зациклен','помешал','помешательств','маниакальн','мани','жажд','алчн','ненасытн','не может остановит','только о нем','только о ней','идея фикс','фиксац','преследу мысл',
      'obsess','obsessed','obsession','obsessive','fixated','fixation','compulsi','consumed by','consuming','craving','crave','craves','insatiable','ravenous','hunger for','thirst for','fanatic','mania','manic','preoccupied','can\'t stop thinking'
    ]},
    { key: 'codependency', tests: [
      'зависимост','созависим','зависима','зависим','привязанност','привязалас','привязалс','не может без','нужен как воздух','цепляетс за нег','цепляетс за не','срослас','раствор в нем','раствор в не','подчинен','подчинил','симбиоз',
      'codepend','co-depend','dependency','dependent','dependence','attachment','clingy','clinging','can\'t live without','need him','need her','enmeshed','enmeshment','symbiotic','subsumed'
    ]},
    { key: 'lust', tests: [
      'похот','вожделен','возбужд','возбужден','желани','желает','страст','страстн','влечени','влеком','томлени по','жар в тел','дрожь по кож','хочет его','хочет ее','плотск','эротич','чувственн','искушени','соблазн',
      'lust','lustful','arousal','aroused','arousing','desire','desirous','yearning','longing for','carnal','erotic','sensual','sultry','heat','wanting','want him','want her','temptation','tempted','seduce','seduction','turned on','ache for'
    ]},
    { key: 'love', tests: [
      'любов','люблю','любит','влюблен','влюблена','влюбилас','влюбилс','нежност','нежн','обожани','обожает','привязанност сердечн','трепет','сердце теплеет','родн','дорогой человек','дорога мне','люба',
      'love','loved','loving','in love','beloved','adore','adoration','adoring','fond','fondness','affection','affectionate','tender','tenderness','cherish','cherished','smitten','infatuat','sweetheart','heart flutter'
    ]},
    { key: 'devotion', tests: [
      'преданност','предан','преданно','верност','верна ему','верна ей','верен ей','верен ему','защит','защища','защищ','оберега','ограждает','опека','опекает','покровит','стоит горой','заслонит','заслонила','не даст в обиду','не отдаст','служени','присяг','клятв','на страже','прикрыл','прикрыла собой',
      'loyal','loyalty','devotion','devoted','protect','protective','protection','protector','guard','guarding','guardian','shield','shielding','defend','defender','faithful','fidelity','steadfast','unwavering','vow','sworn','stand by'
    ]},
    { key: 'cozy', tests: [
      'уют','уютн','по-домашнему','домашн тепло','тепло дома','плед','камин','у камина','чашка чая','какао','кутаетс','закуталас','свернулас клубк','гнездо','убежищ','мягк свет','ламп','шерстян','носки','тапочк','пахнет домом',
      'cozy','cosy','coziness','snug','snugly','snuggle','curled up','blanket','fireplace','hearth','warm socks','hot cocoa','cup of tea','homely','homey','hygge','safe place','nest','tucked in'
    ]},
    { key: 'shame', tests: [
      'смущен','смущ','сконфуж','неловк','неудобн','стыд','стыдно','пристыж','застенчив','робост','робе','краснеет','покраснел','залилас краск','позор','опозор','унижени','унижен','мортиф',
      'embarrass','embarrassed','embarrassment','awkward','awkwardness','flustered','sheepish','bashful','shy','shyness','timid','blush','blushing','blushed','shame','ashamed','shameful','humiliat','humiliated','humiliation','mortified','mortification','self-conscious'
    ]},
    { key: 'guilt', tests: [
      'вина','вину','виноват','виноватост','виновн','провинил','раская','раскаяни','покая','угрызен','совест','самобичев','корит себя','виню себя','моя вина',
      'guilt','guilty','guiltily','remorseful','remorse','repent','repentance','contrite','contrition','conscience','self-blame','self blame','self-loathing','my fault','to blame'
    ]},
    { key: 'disgust', tests: [
      'отвращени','отврат','брезглив','брезгу','омерзени','омерзит','гадлив','гадост','мерзост','мерзк','тошнот','тошнит','мутит','противн','гнусн','склизк','фу,','воротит',
      'disgust','disgusted','disgusting','revulsion','revolted','revolting','repulsed','repulsive','repugnant','nausea','nauseous','nauseated','sickened','sickening','queasy','squeamish','icky','vile','foul','gross','loathsome'
    ]},
    { key: 'relief', tests: [
      'облегчени','облегчен','отлегло','выдохн','с плеч','полегчал','попуст','отпустило','успокоилас','успокоилс','обошлос','пронесло','слава богу',
      'relief','relieved','reprieve','unburdened','weight lifted','lifted','eased','at last','finally over','reassured','reassurance','solace'
    ]},
    { key: 'joy', tests: [
      'радост','радуетс','рада','рад ','счасть','счастлив','весел','веселье','восторг','восхищ','восхищени','смех','смеетс','улыб','улыбаетс','приподнят','светло на душе','тепло на душе','благодарност','благодар','предвкушени','надежд','окрыл',
      'joy','joyful','joyous','happy','happiness','glad','gladness','delight','delighted','cheerful','cheer','merry','laugh','laughter','smiling','smile','bliss','blissful','excited','excitement','thrilled','warmth','grateful','gratitude','thankful','hopeful','hope'
    ]},
    { key: 'contempt', tests: [
      'презрени','презрен','презира','ненавист','ненавиж','ненавид','высокомер','надменн','снисходительн','пренебрежени','пренебрег','свысока',
      'contempt','contemptuous','disdain','disdainful','scorn','scornful','hatred','hate','hateful','loathing','loathe','sneer','sneering','condescend','condescending','haughty','arrogant','arrogance','superior','derision','derisive'
    ]},
    { key: 'irritation', tests: [
      'раздраж','бесит','бесят','досад','досадн','ворчлив','брюзж','сварлив','злит по мелоч','заеб','достал','достали','надоел','надоед','выбешив','цепляетс','огрызаетс','колюч','ершист','ворчит',
      'irritat','irritated','irritable','irritation','annoy','annoyed','annoyance','vexed','vexation','exasperat','peeved','miffed','testy','snappy','snappish','grumpy','grouchy','cranky','fed up','sick of','impatient','impatience','prickly','petty'
    ]},
    { key: 'nervous', tests: [
      'нервоз','нервнич','нервн','нервы','мандраж','волнени','взволнован','ерзает','ерзан','неусидч','беспокойств','беспокоитс','взвинчен','на взводе','дергаетс','дерган','суетлив','теребит','кусает губ','места себе не',
      'nervous','nervousness','nervy','jittery','jitters','fidget','fidgety','restless','restlessness','antsy','edgy','on edge','keyed up','wound up','apprehensive','apprehension','unsettled','uneasy','butterflies','stage fright'
    ]},
    { key: 'panic', tests: [
      'паник','паничес','страх','страш','испуг','испуган','ужас','ужасн','кошмар','тревог','тревож','обеспоко','дрож','дрожит','дрожащ','растерян','растерянн','смятен','сует','спешк','спешит','тороп','торопит','срочн','аварийн','хаос','хаотич','безумн','отчаянн','в отчаяни','шок','шокирован','ошелом','ошарашен','опасен','опасност','на грани','неистово','лихорадоч','срыва','срыв','адреналин',
      'panic','panicked','panicking','fear','fearful','afraid','scared','fright','frightened','terror','terrified','horror','horrified','nightmare','anxious','anxiety','worry','worried','shaking','shaky','trembling','tremor','confused','confusion','hurry','hurried','rush','rushed','urgent','urgency','emergency','chaos','chaotic','frantic','frenzy','desperate','desperation','alarm','alarmed','alarming','shock','shocked','stunned','startled','overwhelmed','overwhelm','unsafe','danger','dangerous','breakdown','meltdown','adrenaline','distress','distressed','dread','dreadful'
    ]},
    { key: 'angry', tests: [
      'ярост','ярость','злость','злитс','злой','злая','злоб','гнев','гневн','агресс','агрессив','враждеб','враждебн','озлоб','возмущ','негодован','фрустрац','фрустрир','напряж','напряжен','стресс','стрессов','задет','вскип','кипит','кипение','грубо','жестко','жесток','жестокост','свиреп','озверел','сарказм','саркаст','разъяр','вспыльчив','взбеш','бешен','бешенств','оскорблен','оскорблени',
      'angry','anger','rage','raging','furious','fury','mad','madness','irate','ire','wrath','wrathful','cruel','cruelty','brutal','brutality','vicious','viciousness','savage','ferocious','frustrat','frustrated','frustration','agitated','agitation','hostile','hostility','resent','resentful','resentment','outrage','outraged','offended','insulted','tense','tension','stressed','stress','aggression','aggressive','enraged','boiling','seething','heated','heatedly','sarcastic','sarcasm','spiteful','venomous','cross'
    ]},
    { key: 'disappointment', tests: [
      'разочарован','разочарова','разочарование','обманут','обманул','обманулас','не оправдал','не оправдалис','ожидания не','подвел','подвела','обещал и не','зря надеял','напрасно ждал','остыло','потускнел',
      'disappoint','disappointed','disappointing','disappointment','let down','letdown','disillusion','disillusioned','disenchant','failed expectations','fell short','anticlimax','deflated'
    ]},
    { key: 'apathy', tests: [
      'апати','апатич','подавлен','подавленн','опустошен','выгоран','выгорел','обесси','бессили','вял','вялост','безволи','безразличие ко всему','ничего не хочет','нет сил','упадок сил','оцепенени','отупени','заторможен','депресс','уныни','уныл',
      'apathy','apathetic','listless','listlessness','lethargy','lethargic','burnout','burned out','burnt out','drained','depleted','numb','numbness','empty','emptiness','hollow','sluggish','languid','torpor','despondent','despondency','depressed','depression','dejected','dejection','no energy','can\'t be bothered'
    ]},
    { key: 'bored', tests: [
      'скук','скучн','скучает','скучан','занудств','монотонн','однообраз','рутин','томитс','маетс','убивает время','нечем зан','тянетс время',
      'bored','boredom','boring','dull','dullness','tedious','tedium','monotony','monotonous','humdrum','uneventful','idle','idling','restive','killing time','nothing to do','yawn'
    ]},
    { key: 'cold', tests: [
      'равнодуш','безразлич','холодност','холодно относ','холоден','холодна','отстранен','отчужден','отчуждени','дистанц','бесстраст','безучаст','черств','ледян','замкнут','закрылас','закрылс',
      'indifferent','indifference','uncaring','unmoved','detached','detachment','aloof','aloofness','distant','withdrawn','impassive','dispassionate','unfeeling','callous','cold','coldness','icy','frosty','remote','disinterested','disengaged'
    ]},
    { key: 'sad', tests: [
      'грусть','груст','печаль','печальн','тоска','тосклив','скорб','горе','горев','слез','слеза','слезы','слезами','рыдан','плакс','плачет','плач','разбит','одиночеств','одинок','меланхол','безнад','отчаяни','безысход','больно','тяжело','тяжесть','жалость','сожален','ностальг','сердце разбито','разбитое сердце','обида','обижен','обиженн','горечь','горьк',
      'sad','sadness','sorrow','sorrowful','sorrowing','grief','grieving','mourning','mourne','melancholy','melancholic','blue','downcast','downhearted','unhappy','misery','miserable','lonely','loneliness','alone','heartbroken','heartbreak','despair','despairing','hopeless','hopelessness','gloom','gloomy','dreary','somber','sombre','regret','regretful','regrets','hurt','hurting','pain','painful','sulk','sullen','doleful','tearful','tears','tear','cry','crying','weeping','weep','sob','sobbing','homesick','nostalgic','nostalgia','bitter','bittersweet'
    ]},
    { key: 'neutral', tests: [
      'спокой','спокойн','ровн','размерен','уравновеш','тихо на душе','собран','сосредоточ','задумчив','раздумь','штил',
      'calm','calmness','composed','composure','steady','even-tempered','settled','centered','centred','collected','contemplative','pensive','thoughtful','quiet','still'
    ]},
    { key: 'peace', tests: [
      'покой','покоем','покоя','умиротвор','безмятеж','благодат','тишина','тишине','тихо и','отдых','отдохн','передышк','убаюк','дремл','полудрем','сон подступ','мир на душе','ничего не тревож','отпустило все','ровное дыхани',
      'peace','peaceful','serene','serenity','tranquil','tranquility','stillness','repose','rest','restful','at rest','quietude','lull','drowsy','drifting off','nothing troubles','bliss of quiet'
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

// Бумажные слои записи. Раньше это была одна и та же строка для всех
// записей, поэтому все листы были одинаковыми. Теперь складка, кольцо от
// чашки и наклон завитка считаются от того же seed, что и кляксы: лист
// каждой записи свой, но при перерисовке не прыгает.
export function buildDiaryPaper(seed) {
  const n = Array.from(String(seed || '')).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const creaseTop = 30 + (n % 34);
  const hasRing = (n % 3) !== 0;
  const ringLeft = 10 + ((n * 3) % 66);
  const ringTop = 10 + ((n * 7) % 54);
  const ringSize = 26 + (n % 20);
  const ringTilt = (n * 11) % 360;
  const ring = hasRing
    ? `<span class="hud-diary-ring" style="left:${ringLeft}%; top:${ringTop}%; width:${ringSize}px; height:${Math.round(ringSize * 0.62)}px; transform:rotate(${ringTilt}deg);"></span>`
    : '';
  return '<span class="hud-diary-paper"></span><span class="hud-diary-holes"></span>'
    + `<span class="hud-diary-crease" style="top:${creaseTop}%;"></span>`
    + ring
    + '<span class="hud-diary-curl"></span>';
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
    // Бумажные слои идут отдельными узлами, а не псевдоэлементами: ::before и
    // ::after у записи уже заняты полем и настроенческими кляксами.
    const paper = buildDiaryPaper(seed);

    if (typeof entry === 'string') {
      let parts = entry.split('|'); let time = parts[0].trim(); let text = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
      if (!text) { text = time; time = 'Скрытая запись'; }
      html += `<div class="hud-diary-entry hud-diary-mood-${moodKey}">${paper}${sticker}${stains}<div class="hud-diary-time">${escapeHtml(time)}</div><div class="hud-diary-text">${renderDiaryText(text)}</div></div>`;
    } else {
      const author = entry && entry.author && entry.author.toLowerCase() !== 'none' && entry.author.toLowerCase() !== 'empty' ? entry.author : '';
      const time = entry && entry.time ? entry.time : 'Скрытая запись';
      const aboutUser = entry && entry.aboutUser && entry.aboutUser.toLowerCase() !== 'none' && entry.aboutUser.toLowerCase() !== 'empty' ? entry.aboutUser : '';
      const text = entry && entry.text ? entry.text : '';
      html += `<div class="hud-diary-entry hud-diary-mood-${moodKey}">${paper}${sticker}${stains}${author ? `<div class="hud-diary-author">${escapeHtml(author)}</div>` : ''}<div class="hud-diary-time">${escapeHtml(time)}</div><div class="hud-diary-text">${renderDiaryText(text)}</div>${aboutUser ? `<div class="hud-diary-about-user"><span class="hud-diary-about-label">О ней:</span> ${renderDiaryText(aboutUser)}</div>` : ''}</div>`;
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
