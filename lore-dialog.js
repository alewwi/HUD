// hud-manager/lore-dialog.js
//
// Окно «В лорбук»: из выделенного факта HUD собрать запись лорбука (сама или
// с помощью модели) и записать её через SillyTavern. Вынесено из index.js и
// грузится через import() при первом открытии окна (загрузитьЛор).

import { guardTouchSwipe, escapeHtml } from './utils.js?v=23.48.1';
import { settings } from './settings.js?v=23.48.1';
import { stripHudBlock, buildLoreGenPrompt, parseLoreGenResponse, loreAlreadyHas, buildLoreEntry } from './lore.js?v=23.48.1';

// Всё нужное из index.js приходит в «основа» (геттеры — значения живые):
// getAvailableHudLorebooks, getMainProtagonistNames, getStContextSafe, getStRequestHeadersSafe, loadHudLorebook, showHudToast.
let основа = null;
export function подключить(связь) { основа = связь; }

// Шов между index.js и events.js. Изменяемое состояние передаётся геттерами:
// cachedChatContainer переприсваивается здесь же, в initApp, а
// performanceIntersectionObserver создаётся и сбрасывается при смене
// performance-режима. settings и функции — стабильные ссылки.
// --- «Запомнить»: запись HUD → постоянная запись Lorebook ----------------
// Окно показывает ровно то, что будет записано, и в какую книгу. Ключи
// активации можно поправить руками: без них запись в World Info никогда не
// сработает, а угадать их автоматически получается не всегда.
let loreDialogOpen = false;

// Модуль World Info самого SillyTavern. Раньше мы писали файл книги напрямую
// через /api/worldinfo/edit, и это была тихая потеря данных: у ST есть свой
// кэш книг (worldInfoCache), наша запись в него не попадала, редактор
// показывал старое содержимое, а следующее сохранение со стороны ST
// возвращало файл к своей копии — вместе с исчезновением наших записей.
let worldInfoModulePromise = null;

export function getWorldInfoModule() {
  if (!worldInfoModulePromise) {
    // Без ?v=: это модуль SillyTavern, и любой хвост в пути даёт вторую его
    // копию — с собственным кэшем книг, мимо которого мы и писали.
    worldInfoModulePromise = import('../../../world-info.js').catch((e) => {
      console.debug('[TavernOS HUD] Модуль World Info недоступен, работаем через HTTP:', e);
      return null;
    });
  }
  return worldInfoModulePromise;
}

// Чтение книги: через ST, если получится, иначе прямым запросом.
export async function readLorebookForWrite(name) {
  const wi = await getWorldInfoModule();
  if (wi && typeof wi.loadWorldInfo === 'function') {
    try {
      const data = await wi.loadWorldInfo(name);
      if (data && typeof data === 'object' && data.entries) return data;
    } catch (e) { console.debug('[TavernOS HUD] loadWorldInfo не сработал:', e); }
  }
  return await основа.loadHudLorebook(name);
}

// Запись книги. saveWorldInfo обновляет и файл, и кэш ST, а reloadEditor
// перерисовывает открытую панель World Info — иначе новая запись появлялась
// только после перезагрузки страницы.
async function writeLorebook(name, book) {
  const wi = await getWorldInfoModule();
  if (wi && typeof wi.saveWorldInfo === 'function') {
    await wi.saveWorldInfo(name, book, true);
    try { if (typeof wi.reloadEditor === 'function') wi.reloadEditor(name); } catch (_) {}
    return 'st';
  }
  const res = await fetch('/api/worldinfo/edit', {
    method: 'POST', headers: основа.getStRequestHeadersSafe(),
    body: JSON.stringify({ name, data: book }), cache: 'no-cache',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return 'http';
}

export async function openLoreDialog(text, keys) {
  if (loreDialogOpen) return;
  loreDialogOpen = true;

  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay';
  overlay.innerHTML = `
      <div class="hud-modal hud-lore-modal" role="dialog" aria-modal="true" aria-label="Запомнить в Lorebook">
        <div class="hud-modal-head">✚ Запомнить навсегда</div>
        <div class="hud-modal-body">
          <label class="hud-modal-label">Заголовок <i>под ним запись видно в списке World Info</i></label>
          <input type="text" class="hud-modal-title">
          <label class="hud-modal-label">Что записываем</label>
          <textarea class="hud-modal-text" rows="5"></textarea>
          <label class="hud-modal-label">Ключи активации <i>через запятую — по ним запись всплывёт в контексте</i></label>
          <input type="text" class="hud-modal-keys">
          <label class="hud-modal-label">В какую книгу</label>
          <select class="hud-modal-book"><option value="">Загружаю список…</option></select>
          <div class="hud-modal-note">Сейчас в полях — сухая выжимка из HUD. Можно записать как есть, а можно попросить модель дописать связный текст с контекстом сцены, заголовок и ключи — она прочитает последние сообщения чата.</div>
          <div class="hud-modal-note hud-lore-genstate" hidden></div>
        </div>
        <div class="hud-modal-foot">
          <button type="button" class="hud-modal-btn gen">✎ Написать моделью</button>
          <button type="button" class="hud-modal-btn cancel">Отмена</button>
          <button type="button" class="hud-modal-btn save" disabled>Записать</button>
        </div>
      </div>`;
  document.body.appendChild(overlay);
  guardTouchSwipe(overlay);

  const $ = (s) => overlay.querySelector(s);
  const close = () => { loreDialogOpen = false; overlay.remove(); document.removeEventListener('keydown', поКлавише); };
  const поКлавише = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', поКлавише);

  $('.hud-modal-text').value = String(text || '');
  $('.hud-modal-keys').value = String(keys || '');
  // Заголовок по умолчанию — первый ключ: это почти всегда имя, о ком запись.
  $('.hud-modal-title').value = String(keys || '').split(',')[0].trim();

  const select = $('.hud-modal-book');
  const saveBtn = $('.hud-modal-btn.save');
  const genBtn = $('.hud-modal-btn.gen');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  $('.hud-modal-btn.cancel').addEventListener('click', close);

  // --- Написать моделью ---
  genBtn.addEventListener('click', async () => {
    const факт = $('.hud-modal-text').value.trim();
    if (!факт) { основа.showHudToast('error', 'Нечего описывать', 'Сначала впишите факт.'); return; }
    const ctx = основа.getStContextSafe();
    if (!ctx || typeof ctx.generateRaw !== 'function') {
      основа.showHudToast('error', 'Модель недоступна', 'SillyTavern не отдал функцию генерации.');
      return;
    }
    const состояние = $('.hud-lore-genstate');
    genBtn.disabled = true; saveBtn.disabled = true;
    const прежде = genBtn.textContent;
    genBtn.textContent = 'Пишу…';
    состояние.hidden = false;
    // Счётчик секунд — не украшение: запрос уходит на чужой сервер и может
    // висеть минутами, а окно без признаков жизни выглядит зависшим.
    let секунд = 0;
    состояние.textContent = 'Запрос ушёл модели. Ответ подставится в поля — его можно править перед записью.';
    const тик = setInterval(() => {
      секунд++;
      состояние.textContent = 'Модель пишет… ' + секунд + ' с. Ответ подставится в поля — его можно будет править.';
    }, 1000);
    let безHud = false;
    try {
      const сколько = Math.max(0, Math.min(50, Number(settings.loreContextMessages ?? 10)));
      const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
      const хвост = сколько ? chat.slice(-сколько) : [];
      const сообщения = хвост.map(m => ({
        name: String(m && m.name || ''),
        text: stripHudBlock(String(m && m.mes || '')),
      })).filter(m => m.text);
      const имена = основа.getMainProtagonistNames(ctx);
      const prompt = buildLoreGenPrompt({
        fact: факт,
        keys: $('.hud-modal-keys').value.split(',').map(k => k.trim()).filter(Boolean),
        messages: сообщения,
        userName: имена.user, charName: имена.char,
      });
      // ST не даёт отменить свой запрос, но ждать его вечно тоже нельзя:
      // без ограничения окно навсегда остаётся с заблокированными кнопками.
      const ЖДЁМ_МС = 180000;
      // Без флага перехват вшил бы в этот запрос HUD-инструкцию.
      window.__tavernOSHudSkipInject = (window.__tavernOSHudSkipInject || 0) + 1;
      безHud = true;
      const raw = await Promise.race([
        ctx.generateRaw({
          prompt,
          systemPrompt: 'You are a precise assistant maintaining a lorebook for an ongoing story. Mature fictional content is expected. Answer only in the requested format.',
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('модель молчит дольше ' + (ЖДЁМ_МС / 1000) + ' с')), ЖДЁМ_МС)),
      ]);
      const ответ = parseLoreGenResponse(raw, {
        fact: факт,
        names: [имена.user, имена.char],
        keys: $('.hud-modal-keys').value.split(',').map(k => k.trim()).filter(Boolean),
      });
      if (!ответ) throw new Error('модель ответила не JSON-ом');
      const поле = $('.hud-modal-text');
      поле.value = ответ.content;
      // Ответ модели длиннее исходной выжимки: растягиваем поле под него,
      // но не выше половины окна — иначе кнопки уезжают за край экрана.
      поле.style.height = 'auto';
      поле.style.height = Math.min(поле.scrollHeight, Math.round(window.innerHeight * 0.5)) + 'px';
      if (ответ.title) $('.hud-modal-title').value = ответ.title;
      if (ответ.keys.length) $('.hud-modal-keys').value = ответ.keys.join(', ');
      // Показываем начало записи: после генерации взгляд должен падать
      // на текст, а не на строку состояния под ним.
      поле.scrollTop = 0;
      поле.scrollIntoView({ block: 'nearest' });
      состояние.textContent = 'Готово. Проверьте текст и ключи — записывается то, что в полях.';
    } catch (e) {
      console.error('[TavernOS HUD] Генерация записи не удалась:', e);
      состояние.textContent = 'Модель не ответила как надо: ' + (e && e.message ? e.message : e) + '. Поля не тронуты — можно записать как есть.';
      основа.showHudToast('error', 'Не сгенерировалось', 'Поля остались прежними.');
    } finally {
      if (безHud) window.__tavernOSHudSkipInject = Math.max(0, (window.__tavernOSHudSkipInject || 1) - 1);
      clearInterval(тик);
      genBtn.disabled = false; genBtn.textContent = прежде;
      saveBtn.disabled = !select.value;
    }
  });

  let books = [];
  try { books = await основа.getAvailableHudLorebooks(); } catch (_) {}
  if (!books.length) {
    select.innerHTML = '<option value="">Ни одной книги не найдено</option>';
    $('.hud-modal-note').textContent = 'SillyTavern не отдал список Lorebook. Создайте книгу в World Info и откройте окно заново.';
    return;
  }
  select.innerHTML = books.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
  saveBtn.disabled = false;

  saveBtn.addEventListener('click', async () => {
    const bookName = select.value;
    const content = $('.hud-modal-text').value.trim();
    const title = $('.hud-modal-title').value.trim();
    const keyList = $('.hud-modal-keys').value.split(',').map(k => k.trim()).filter(Boolean);
    if (!bookName || !content) { основа.showHudToast('error', 'Нечего записывать', 'Заполните текст и выберите книгу.'); return; }
    if (!keyList.length) { основа.showHudToast('error', 'Нет ключей активации', 'Без ключей запись никогда не сработает.'); return; }

    saveBtn.disabled = true; genBtn.disabled = true; saveBtn.textContent = 'Записываю…';
    try {
      // 1. Читаем книгу целиком. Не прочитали — не пишем.
      const book = await readLorebookForWrite(bookName);
      if (!book || typeof book !== 'object' || !book.entries || typeof book.entries !== 'object') {
        throw new Error('книга не прочиталась');
      }
      if (loreAlreadyHas(book, content)) {
        основа.showHudToast('info', 'Уже записано', 'Такая запись в этой книге уже есть.');
        close(); return;
      }
      // 2. Дописываем запись, ничего не трогая вокруг. uid ищем не только
      // среди значений, но и среди ключей: у книг, правленных руками, они
      // расходятся, а совпавший uid затирает чужую запись.
      const числа = [];
      for (const [k, e] of Object.entries(book.entries)) {
        const a = Number(k), b = Number(e && e.uid);
        if (Number.isFinite(a)) числа.push(a);
        if (Number.isFinite(b)) числа.push(b);
      }
      const uid = числа.length ? Math.max(...числа) + 1 : 0;
      const idxs = Object.values(book.entries).map(e => Number(e && e.displayIndex)).filter(v => Number.isFinite(v));
      const displayIndex = idxs.length ? Math.max(...idxs) + 1 : 0;
      book.entries[String(uid)] = buildLoreEntry(uid, displayIndex, keyList, content, title || ('HUD: ' + keyList[0]));

      // 3. Сохраняем через ST, чтобы книга и её кэш остались в согласии.
      const как = await writeLorebook(bookName, book);
      основа.showHudToast('success', 'Записано в Lorebook', `«${bookName}» — ключи: ${keyList.join(', ')}`
        + (как === 'http' ? ' (обновите страницу, чтобы увидеть в World Info)' : ''));
      close();
    } catch (e) {
      console.error('[TavernOS HUD] Запись в Lorebook не удалась:', e);
      основа.showHudToast('error', 'Не записалось', 'Книга осталась нетронутой. Подробности в консоли.');
      saveBtn.disabled = false; genBtn.disabled = false; saveBtn.textContent = 'Записать';
    }
  });
}
