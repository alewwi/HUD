/* TavernOS HUD © 2026 alewwi · AGPL-3.0 */
const поля = new Set(['Prg', 'Mns', 'Pp', 'Беременность', 'Цикл', 'Послеродовое']);
const симптомы = /беременн|менстру|послеродов|после родов|овуляц|токсикоз|лактаци|месячны|pregnan|postpartum|after childbirth|menstrua|ovulat|morning sickness|lactat|breastfeed/iu;
const клинические = new Set(['Ph', 'H', 'Ill', 'B', 'Физиология', 'Здоровье', 'Болезни и травмы', 'Тело']);
const контекст = () => globalThis.SillyTavern?.getContext?.();
const metadata = () => контекст()?.chatMetadata || контекст()?.chat_metadata;

export function ручнойПол(кто, м = metadata()) {
  return м?.tavernosHudGender?.[кто] || '';
}
export function записатьПол(кто, пол, м) {
  if (!м || !(кто === 'user' || /^char:.+/u.test(кто))) throw new Error('Не удалось определить карточку в чате');
  if (м.tavernosHudNotes?.разовые) {
    delete м.tavernosHudNotes.разовые.детали;
    delete м.tavernosHudNotes.разовые.вес;
  }
  const записи = { ...м.tavernosHudGender };
  if (пол) записи[кто] = пол;
  else delete записи[кто];
  м.tavernosHudGender = записи;
}
export function полДляМодели() {
  return Object.entries(metadata()?.tavernosHudGender || {}).map(([кто, пол]) =>
    (кто === 'user' ? '{{user}} (us)' : JSON.stringify(кто.slice(5))) + (пол === 'm' ? ' is male. Omit Mns, Prg and Pp for him.' : ' is female.')).join('\n');
}

// Only edit the selected owner's record. Unrelated clauses in health fields survive.
export function очиститьКарточку(о, кто, убранное) {
  if (!о || typeof о !== 'object') return false;
  let изменено = false;
  for (const [поле, значение] of Object.entries(о)) {
    let осталось;
    if (!поля.has(поле)) {
      if (['N', 'Имя'].includes(поле)) continue;
      if (Array.isArray(значение)) {
        const части = значение.flatMap(элемент => {
          if (typeof элемент !== 'string') return [элемент];
          const запись = { [поле]: элемент };
          очиститьКарточку(запись, кто);
          return поле in запись ? [запись[поле]] : [];
        });
        if (части.length === значение.length && части.every((v, i) => v === значение[i])) continue;
        убранное?.push({ поле, кому: кто, значение });
        if (части.length) о[поле] = части;
        else delete о[поле];
        изменено = true;
        continue;
      }
      if (typeof значение !== 'string') continue;
      const части = значение.split(/;\s*|(?<=[.!?])\s+/u);
      const оставить = части.filter(часть => {
        if (клинические.has(поле) && симптомы.test(часть)) return false;
        return !свойФакт(часть, кто, контекст()?.name1) &&
          !/(?:^|[«“"])\s*(?:я\s+беремен(?:на|ен)|I(?: am|['’]m) pregnant)(?!\p{L})/iu.test(часть);
      });
      if (части.length === оставить.length) continue;
      осталось = оставить.join('; ');
    }
    убранное?.push({ поле, кому: кто, значение });
    if (осталось) о[поле] = осталось;
    else delete о[поле];
    изменено = true;
  }
  return изменено;
}

// A name in the list of witnesses does not make that person the subject of a fact.
function свойФакт(текст, кто, имяИгрока) {
  const имя = кто === 'user' ? имяИгрока : кто?.slice(5);
  if (!имя || typeof текст !== 'string') return false;
  const строка = текст.toLocaleLowerCase();
  const субъект = имя.toLocaleLowerCase();
  for (let i = строка.indexOf(субъект); i >= 0; i = строка.indexOf(субъект, i + субъект.length)) {
    if (i && /[\p{L}\p{N}_-]/u.test(строка[i - 1])) continue;
    const после = строка.slice(i + субъект.length);
    if (/^(?:\s*[:—–]\s*|\s+)(?:(?:is|was|оказал(?:ся|ась)|снова)\s+)?(?:беремен(?:на|ен|ность|ный|ная)?(?!\p{L})|pregnant\b|жд[её]т (?:реб[её]нка|малыша)|родил(?:а)?(?!\p{L})|gave birth\b|postpartum\b)/iu.test(после) ||
        /^['’]s\s+(?:pregnancy|period|due date)\b/iu.test(после)) return true;
  }
  return false;
}

export function очиститьПамять(память, кто, имяИгрока, убранное) {
  if (!память || (кто !== 'user' && кто === 'char:' + имяИгрока)) return false;
  let изменено = false;
  for (const поле of ['sec', 'sc', 'secrets', 'gun', 'guns', 'lg', 'timeline', 'fct', 'fc', 'important', 'prm', 'promises']) {
    const исходное = память[поле];
    if (!Array.isArray(исходное) && typeof исходное !== 'string') continue;
    const список = Array.isArray(исходное) ? исходное : исходное.split(';');
    const осталось = список.filter((пункт, место) => {
      const текст = typeof пункт === 'string' ? пункт : пункт?.fact ?? пункт?.f;
      if (!свойФакт(текст, кто, имяИгрока)) return true;
      убранное?.push({ поле, кому: '@memory', значение: пункт, место });
      return false;
    });
    if (осталось.length === список.length) continue;
    память[поле] = Array.isArray(исходное) ? осталось : осталось.join(';');
    изменено = true;
  }
  return изменено;
}
export function вернутьПамять(память, запись) {
  const { поле, значение, место } = запись;
  const было = память[поле];
  const список = typeof было === 'string' ? (было ? было.split(';') : []) : [...(Array.isArray(было) ? было : [])];
  if (список.some(п => JSON.stringify(п) === JSON.stringify(значение))) return false;
  список.splice(место ?? список.length, 0, значение);
  память[поле] = typeof было === 'string' ? список.join(';') : список;
  return true;
}

export function применитьРучнойПол(hud) {
  const записи = metadata()?.tavernosHudGender;
  if (!записи || !hud) return false;
  let изменено = false;
  const персонажи = Array.isArray(hud.cs) ? hud.cs : hud.cs ? [hud.cs] : [];
  for (const [кто, пол] of Object.entries(записи)) {
    if (пол !== 'm') continue;
    const карточки = кто === 'user' ? [hud.us] : персонажи.filter(о => 'char:' + String(о?.N || '').trim() === кто);
    if (карточки.length > 1) continue;
    if (очиститьКарточку(карточки[0], кто)) изменено = true;
    const игрок = контекст()?.name1;
    if (кто === 'user' && персонажи.some(о => String(о?.N || '').trim() === игрок)) continue;
    if (очиститьПамять(hud.me, кто, игрок)) изменено = true;
  }
  return изменено;
}
