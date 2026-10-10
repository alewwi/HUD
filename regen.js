// hud-manager/regen.js
//
// Перегенерация HUD по кнопке 🔄 / ➕ на карточке и досоздание после проверки
// полноты: собрать снимок и инструкцию, отправить отдельный запрос, вставить
// новый блок в сообщение. Вынесено из index.js и грузится через import() при
// первом нажатии (загрузитьПерегенерацию).

import { настройка, settings, defaultSettings } from './settings.js?v=23.48.3';
import { заменитьHudБлоки, extractHudBlock, hudБлоки } from './hud-block.js?v=23.48.3';
import { собратьСнимок, решитьNSFW, решитьБой, последниеТекстыЧата, строкаСнимка, HUDвКодах } from './hud-snapshot.js?v=23.48.3';
import { repairGeneratedHudBlock, parseHUDComplex } from './hud-parser.js?v=23.48.3';

// Всё нужное из index.js приходит в «основа» (геттеры — значения живые):
// buildHudLoreContext, getMessageUpdateFunction, readHudApiError, replaceHudBlockInText, safeProcessMessage, showHudToast, updateMessageDataForCurrentSwipe, генерацииHUD, загрузитьПромпт, запомнитьВерсиюHUD, отменитьГенерациюHUD, показатьИндикаторHUD, раскрытьИнструкцию, сводкаHUD, текстСообщенияЧата.
let основа = null;
export function подключить(связь) { основа = связь; }

export async function handleHudRegenButton(regenBtn) {
  if (!regenBtn) return;
  if (regenBtn.classList.contains('hud-spinning')) {
    // Повторное нажатие отменяет. Одно касание мышью приходит дважды
    // (pointerup и click) — первые 0,8 с второе событие не считаем отменой.
    const начато = Number(regenBtn.dataset.hudStartedAt || 0);
    if (Date.now() - начато > 800) {
      const mes = regenBtn.closest('.mes');
      if (mes) основа.отменитьГенерациюHUD(mes.getAttribute('mesid'));
    }
    return;
  }

      const isCreateBtn = regenBtn.classList.contains('hud-create-btn');
      const originalBtnContent = regenBtn.innerHTML;
      
      regenBtn.innerHTML = isCreateBtn 
          ? `<div style="display:flex; align-items:center; gap:6px;"><div class="hud-stars"><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></div> Создаю...</div>`
          : `<div class="hud-stars"><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></div>`;
      regenBtn.classList.add('hud-spinning');
      regenBtn.dataset.hudStartedAt = String(Date.now());
      regenBtn.title = 'HUD генерируется — нажми ещё раз, чтобы отменить';

      let mesEl = regenBtn.closest('.mes');
      const отмена = new AbortController();
      const ключГенерации = String(mesEl && mesEl.getAttribute('mesid'));
      основа.генерацииHUD.set(ключГенерации, отмена);
      const отменено = () => отмена.signal.aborted;
      let loadingToast = основа.showHudToast('loading', 'Загрузка', 'HUD генерируется. Подождите.');
      const убратьИндикатор = настройка('genIndicator') === 'on' ? основа.показатьИндикаторHUD(mesEl) : null;
      if (loadingToast) {
        const место = loadingToast.querySelector('.hud-toast-content') || loadingToast;
        место.insertAdjacentHTML('beforeend', '<button type="button" class="hud-toast-cancel">Отменить</button>');
        место.querySelector('.hud-toast-cancel').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); отмена.abort(); });
      }

      try {
          const mesId = mesEl.getAttribute('mesid');
          const textElement = mesEl.querySelector('.mes_text');
          
          let stContext = null;
          if (typeof window.SillyTavern !== 'undefined' && typeof window.SillyTavern.getContext === 'function') {
              stContext = window.SillyTavern.getContext();
          } else if (typeof getContext === 'function') {
              stContext = getContext();
          } else if (typeof window.getContext === 'function') {
              stContext = window.getContext();
          }

          let chatData = null;
          if (stContext && Array.isArray(stContext.chat)) {
              chatData = stContext.chat;
          } else if (typeof chat !== 'undefined' && Array.isArray(chat)) {
              chatData = chat;
          } else if (typeof window.chat !== 'undefined' && Array.isArray(window.chat)) {
              chatData = window.chat;
          }

          let targetMessage = null;
          let mesIdNum = parseInt(mesId, 10);
          
          if (chatData) {
              let foundIndex = chatData.findIndex(m => String(m._id) === String(mesId) || String(m.mesId) === String(mesId));
              if (foundIndex !== -1) {
                  mesIdNum = foundIndex;
                  targetMessage = chatData[foundIndex];
              } else if (!isNaN(mesIdNum) && mesIdNum >= 0 && mesIdNum < chatData.length) {
                  targetMessage = chatData[mesIdNum];
              }
          }

          if (!targetMessage) throw new Error('Не найдено сообщение в chat[].');

          let oldText = '';
          if (targetMessage) {
              if (targetMessage.swipes && targetMessage.swipe_id !== undefined && targetMessage.swipes[targetMessage.swipe_id]) {
                  oldText = targetMessage.swipes[targetMessage.swipe_id];
              } else {
                  oldText = targetMessage.mes || '';
              }
          }
          oldText = заменитьHudБлоки(oldText, '').trim();

          // Для старых сообщений в текущей вкладке может не существовать lastTavernRequest.
          // В таком случае берём живые настройки Chat Completion из ST вместо обращения
          // к несуществующим переменным currentModel/currentSource/etc.
          const liveOpenAISettings =
              (typeof window !== 'undefined' && window.oai_settings && typeof window.oai_settings === 'object')
                  ? window.oai_settings
                  : {};
          const liveChatCompletionSettings =
              (stContext && stContext.chatCompletionSettings && typeof stContext.chatCompletionSettings === 'object')
                  ? stContext.chatCompletionSettings
                  : {};
          const liveExtensionOpenAI =
              (stContext?.extensionSettings?.openai && typeof stContext.extensionSettings.openai === 'object')
                  ? stContext.extensionSettings.openai
                  : {};

          // HUD regeneration must use the current SillyTavern Chat Completions
          // backend, not the legacy /api/chat/completions route captured from an
          // older request. The latter is not the generation endpoint in current ST
          // and can return 403. The captured request is still useful as a source of
          // provider/model/token settings, but its URL is deliberately NOT reused.
          const sourceBody = window.lastTavernRequest?.body;
          const reqBody = sourceBody && typeof sourceBody === 'object' ? sourceBody : {};
          const requestUrl = '/api/backends/chat-completions/generate';
          const requestHeaders =
              (typeof window.getRequestHeaders === 'function' ? window.getRequestHeaders() : null) ||
              { 'Content-Type': 'application/json' };

          // SillyTavern stores provider/model selections in source-specific fields.
          // See the default Chat Completion preset: chat_completion_source plus
          // openai_model / google_model / vertexai_model / custom_model, etc.
          const currentSource = String(
              reqBody.chat_completion_source ||
              liveChatCompletionSettings.chat_completion_source ||
              liveExtensionOpenAI.chat_completion_source ||
              liveOpenAISettings.chat_completion_source ||
              ''
          );
          const currentModel = String(
              reqBody.model ||
              liveChatCompletionSettings.model ||
              liveChatCompletionSettings.openai_model ||
              liveChatCompletionSettings.google_model ||
              liveChatCompletionSettings.vertexai_model ||
              liveChatCompletionSettings.openrouter_model ||
              liveChatCompletionSettings.custom_model ||
              liveExtensionOpenAI.model ||
              liveExtensionOpenAI.openai_model ||
              liveExtensionOpenAI.google_model ||
              liveExtensionOpenAI.vertexai_model ||
              liveExtensionOpenAI.openrouter_model ||
              liveExtensionOpenAI.custom_model ||
              liveOpenAISettings.model ||
              liveOpenAISettings.openai_model ||
              liveOpenAISettings.google_model ||
              liveOpenAISettings.vertexai_model ||
              liveOpenAISettings.openrouter_model ||
              liveOpenAISettings.custom_model ||
              ''
          );
          const currentChatSettings = liveChatCompletionSettings;
          const currentOpenAISettings = liveExtensionOpenAI;
          const globalOpenAISettings = liveOpenAISettings;

          let freshMessages = [];
          // Only real chat-history messages are eligible for HUD summarization.
          // Injected HUD instructions contain a literal [HUD] schema example, which
          // must NEVER be mistaken for an actual historical HUD block.
          const hudSummaryEligibleMessages = new Set();

          // Сколько сообщений истории уходит в регенерацию. Раньше при 0 или
          // нечитаемом значении startIndex обнулялся и в запрос улетал ВЕСЬ чат.
          const parsedKeep = parseInt(settings.regenContextMessages, 10);
          const keepN = Number.isFinite(parsedKeep) && parsedKeep > 0
              ? Math.min(parsedKeep, 50)
              : (defaultSettings.regenContextMessages || 6);
          const startIndex = Math.max(0, mesIdNum - keepN + 1);

          function getHudConnectionProfile(profileId) {
              try {
                  const cm = stContext?.extensionSettings?.connectionManager;
                  const profiles = Array.isArray(cm?.profiles) ? cm.profiles : [];
                  return profileId ? (profiles.find(p => String(p.id) === String(profileId)) || null) : null;
              } catch (_) { return null; }
          }

          function metadataLooksLikeGemini(value, depth = 0) {
              if (!value || typeof value !== 'object' || depth > 2) return false;
              const keys = ['api_type', 'api-type', 'apiType', 'type', 'source', 'provider', 'api', 'name', 'model'];
              for (const key of keys) {
                  const field = value[key];
                  if (typeof field === 'string') {
                      const lower = field.toLowerCase();
                      if (lower.includes('gemini') || lower.includes('makersuite') || lower.includes('google')) return true;
                  } else if (field && typeof field === 'object' && metadataLooksLikeGemini(field, depth + 1)) {
                      return true;
                  }
              }
              return false;
          }

          const selectedProfile = getHudConnectionProfile(settings.regenProfileId);
          const backendMetadata = [
              selectedProfile,
              reqBody,
              stContext?.chatCompletionSettings,
              stContext?.extensionSettings?.connectionManager,
              stContext?.extensionSettings?.openai,
              stContext?.extensionSettings?.gemini,
              currentChatSettings,
              currentOpenAISettings,
              globalOpenAISettings,
          ];
          const requestModel = String(reqBody?.model || selectedProfile?.model || currentModel || '');
          const modelName = requestModel.toLowerCase();
          const requestUrlLower = String(requestUrl || '').toLowerCase();
          const isGeminiBackend = backendMetadata.some(metadataLooksLikeGemini)
              || modelName.includes('gemini')
              || requestUrlLower.includes('generativelanguage.googleapis.com')
              || requestUrlLower.includes('/gemini');
          const regenRoleForBackend = (role) => {
              if (role === 'system') return isGeminiBackend ? 'user' : 'system';
              if (role === 'assistant') return isGeminiBackend ? 'model' : 'assistant';
              return 'user';
          };
          // НЕ подмешиваем системное сообщение из захваченного запроса ST.
          // Раньше сюда уезжал весь пресет SillyTavern вместе с его World Info,
          // и он заглушал наш HUD-контракт и лорбук, выбранный в настройках.
          // Регенерации нужен только strictBasePrompt + hudExternalContext ниже.
          // IMPORTANT: HUD Regen must receive the FULL HUD contract, not only a short
          // command. The previous version sent only strictBasePrompt, which left the
          // model without the complete schema/field definitions and caused it to return
          // an all-empty HUD. Reuse the exact same dynamic HUD prompt as normal chat
          // generation, then add the Regen-specific instruction.
          // Снимок — последний HUD до перегенерируемого сообщения; решение о
          // близости — по нему и по самому сообщению, для которого пишем HUD.
          let объектСнимкаРеген = null;
          // Число развёрнутых читаем так же, как перехват запроса: нечитаемое
          // значение — это значение по умолчанию, а не 0. Раньше здесь пустое поле
          // выключало снимок, а в обычном ответе снимок был.
          const развёрнутыхРеген = (() => { const n = parseInt(settings.hudsToKeep, 10); return isNaN(n) || n < 0 ? (defaultSettings.hudsToKeep ?? 1) : n; })();
          if (settings.hudSnapshot !== false && развёрнутыхРеген > 0) {
              for (let j = mesIdNum - 1; j >= 0 && !объектСнимкаРеген; j--) {
                  const m = chatData[j];
                  if (!m || m.is_user || m.is_system) continue;
                  const текстХода = m.swipes && m.swipes[m.swipe_id] !== undefined ? m.swipes[m.swipe_id] : m.mes;
                  const блок = extractHudBlock(String(текстХода || ''));
                  if (блок) объектСнимкаРеген = собратьСнимок(блок);
              }
          }
          const nsfwРеген = решитьNSFW(объектСнимкаРеген, последниеТекстыЧата(chatData, mesIdNum + 1));
          const { buildDynamicPrompt } = await основа.загрузитьПромпт();
          const strictBasePrompt = основа.раскрытьИнструкцию(buildDynamicPrompt({ nsfw: nsfwРеген, режим: 'regen', бой: решитьБой(объектСнимкаРеген, последниеТекстыЧата(chatData, mesIdNum + 1)) }), объектСнимкаРеген ? строкаСнимка(объектСнимкаРеген, nsfwРеген) : '');

          for (let i = startIndex; i <= mesIdNum; i++) {
          let msg = chatData[i];
          if (!msg) continue;
          let role = regenRoleForBackend(msg.is_user ? 'user' : 'assistant');
          let content = msg.swipes && msg.swipes[msg.swipe_id] !== undefined ? msg.swipes[msg.swipe_id] : msg.mes;
          
          if (i === mesIdNum) {
              // У текущего сообщения вырезаем старый HUD полностью, так как будем генерировать новый
              content = заменитьHudБлоки(content, '').trim();
              if (content.length > 0) {
                  const message = { role: regenRoleForBackend('assistant'), content: content };
                  freshMessages.push(message);
                  hudSummaryEligibleMessages.add(message);
              }
              // strictPrompt ещё не существует на этой стадии: Lorebook-контекст
              // рассчитывается после сборки истории. Ставим базовый маркер, а ниже
              // он будет заменён на полный strictPrompt + HUD lore context.
              freshMessages.push({ role: regenRoleForBackend('user'), content: strictBasePrompt });
          } else {
              // В старых сообщениях оставляем текст как есть, чтобы скрипт ниже смог найти и сжать HUD
              if (content.trim().length > 0) {
                  const message = { role: role, content: content.trim() };
                  freshMessages.push(message);
                  hudSummaryEligibleMessages.add(message);
              }
          }
      }

      const loreScanText = freshMessages.map(m => typeof m.content === 'string' ? m.content : '').join('\n');
      const hudExternalContext = await основа.buildHudLoreContext(loreScanText);
      const strictPrompt = strictBasePrompt + hudExternalContext;
      let strictPromptMessage = null;
      for (let i = freshMessages.length - 1; i >= 0; i--) {
          const candidate = freshMessages[i];
          if (candidate && candidate.role === regenRoleForBackend('user') && candidate.content === strictBasePrompt) {
              strictPromptMessage = candidate;
              break;
          }
      }
      if (strictPromptMessage) strictPromptMessage.content = strictPrompt;
      else freshMessages.push({ role: regenRoleForBackend('user'), content: strictPrompt });


      let allMatchesRegen = [];
      freshMessages.forEach((msg, mIdx) => {
          // Do not scan injected system/HUD instructions. buildDynamicPrompt()
          // intentionally contains a literal [HUD] schema example. Scanning it here
          // makes the regen code try to parse its own instructions as an old HUD,
          // which can fail BEFORE the API request is even sent.
          if (!hudSummaryEligibleMessages.has(msg)) return;
          if (typeof msg.content === 'string') {
              for (const б of hudБлоки(msg.content)) allMatchesRegen.push({ mIdx, index: б.index, length: б.length });
          }
      });

      let hudsToKeep = parseInt(settings.hudsToKeep, 10);
      if (isNaN(hudsToKeep) || hudsToKeep < 0) hudsToKeep = defaultSettings.hudsToKeep ?? 1;
      
      {
          // Со снимком последний блок истории вырезается (он уже в снимке),
          // полными остаются hudsToKeep − 1 перед ним, старше — сводки. Без
          // снимка — полными последние hudsToKeep, как раньше.
          const естьСнимок = !!объектСнимкаРеген && allMatchesRegen.length > 0;
          const конец = естьСнимок ? allMatchesRegen.length - 1 : allMatchesRegen.length;
          const начало = Math.max(0, конец - (естьСнимок ? hudsToKeep - 1 : hudsToKeep));
          const toSummarize = allMatchesRegen.filter((_, i) => i < начало || i >= конец);
          // Сортируем с конца в начало, чтобы не сбить индексы при замене текста
          toSummarize.sort((a, b) => (a.mIdx !== b.mIdx ? b.mIdx - a.mIdx : b.index - a.index));

          // Последний блок истории уходит в снимок — из истории вырезаем целиком.
          const вСнимке = естьСнимок ? allMatchesRegen[allMatchesRegen.length - 1] : null;
          toSummarize.forEach(rm => {
              let content = freshMessages[rm.mIdx].content;
              if (rm === вСнимке) {
                  const хвостДо = content.slice(0, rm.index).match(/\s*$/)[0];
                  const головаПосле = content.slice(rm.index + rm.length).match(/^\s*/)[0];
                  const до = content.slice(0, rm.index - хвостДо.length);
                  const после = content.slice(rm.index + rm.length + головаПосле.length);
                  const без = до && после ? до + (головаПосле || хвостДо) + после : (до || после);
                  if (без.trim()) { freshMessages[rm.mIdx].content = без; return; }
              }
              let hudBlockText = content.substring(rm.index, rm.index + rm.length);
              const прошлый = allMatchesRegen[allMatchesRegen.indexOf(rm) - 1];
              const прошлыйТекст = прошлый ? freshMessages[прошлый.mIdx].content.substring(прошлый.index, прошлый.index + прошлый.length) : '';
              let сводка;
              try { сводка = основа.сводкаHUD(hudBlockText, прошлыйТекст); } catch (_) { return; }
              freshMessages[rm.mIdx].content = content.slice(0, rm.index) + '\n' + сводка + '\n' + content.slice(rm.index + rm.length);
          });
      }

      let aiText = '';
      const hudMaxTokens = Math.max(256, Math.min(32768, parseInt(settings.hudMaxTokens, 10) || 8192));

      // Тело переиспользуем от последнего рабочего запроса ST: провайдер-специфичные
      // поля (ключи, прокси, семплеры) нужны, иначе часть бэкендов отвергает запрос.
      // НО из клона вычищаем всё, что несёт ТЕКСТ промпта: иначе вместе с настройками
      // соединения уезжает весь пресет SillyTavern, его World Info и карточка,
      // и наш HUD-контракт с выбранным лорбуком тонет в этом объёме.
      const HUD_PROMPT_FIELDS = [
          'prompt', 'prompts', 'prompt_order', 'system_prompt', 'main_prompt',
          'nsfw_prompt', 'jailbreak_prompt', 'impersonation_prompt', 'new_chat_prompt',
          'new_group_chat_prompt', 'new_example_chat_prompt', 'continue_nudge_prompt',
          'group_nudge_prompt', 'negative_prompt', 'assistant_prefill',
          'assistant_impersonation', 'human_sysprompt_message',
          'char_name', 'user_name', 'char_description', 'char_personality',
          'scenario', 'persona_description', 'world_info', 'worldInfoBefore',
          'worldInfoAfter', 'wi_format', 'scenario_format', 'personality_format',
          'bias_preset_selected', 'extensions',
      ];
      const capturedBody = (window.lastTavernRequest?.body && typeof window.lastTavernRequest.body === 'object')
          ? window.lastTavernRequest.body : null;
      const hudRequestBody = capturedBody ? JSON.parse(JSON.stringify(capturedBody)) : {};
      HUD_PROMPT_FIELDS.forEach(k => { delete hudRequestBody[k]; });
      hudRequestBody.messages = freshMessages;
      hudRequestBody.stream = false;
      if (requestModel) hudRequestBody.model = requestModel;
      const hudSource = String(reqBody?.chat_completion_source || currentSource || '');
      if (hudSource) hudRequestBody.chat_completion_source = hudSource;
      if (Object.prototype.hasOwnProperty.call(hudRequestBody, 'max_new_tokens')) hudRequestBody.max_new_tokens = hudMaxTokens;
      else hudRequestBody.max_tokens = hudMaxTokens;

      // Страховка от НЕИЗВЕСТНЫХ текстовых полей. Список HUD_PROMPT_FIELDS
      // перечисляет то, что мы знаем сегодня; завтра ST или провайдер могут
      // добавить своё поле с текстом промпта, и оно снова уедет в регенерацию.
      // Настройки соединения — это имена моделей, URL, числа и флаги; длинных
      // строк среди них не бывает. Поэтому всё, что длиннее порога и не входит
      // в белый список, из клона вычищаем.
      const HUD_ALLOWED_LONG_FIELDS = new Set(['messages', 'reverse_proxy', 'proxy_password', 'custom_url']);
      const HUD_LONG_FIELD_LIMIT = 400;
      Object.keys(hudRequestBody).forEach(key => {
          if (HUD_ALLOWED_LONG_FIELDS.has(key)) return;
          const value = hudRequestBody[key];
          if (typeof value === 'string' && value.length > HUD_LONG_FIELD_LIMIT) delete hudRequestBody[key];
      });

      // Размер запроса — единственный честный ответ на вопрос «а не уехал ли
      // туда пресет?». Считаем то, что реально уходит на провайдер.
      const hudPromptChars = freshMessages.reduce(
          (sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
      const hudPayloadStats = {
          сообщений: freshMessages.length,
          символов: hudPromptChars,
          'полей в теле': Object.keys(hudRequestBody).join(', '),
      };
      console.info('[TavernOS HUD] Регенерация: что уходит на провайдер', hudPayloadStats);

      if (settings.regenProfileId && stContext && stContext.ConnectionManagerRequestService && typeof stContext.ConnectionManagerRequestService.sendRequest === 'function') {
          // ConnectionManagerRequestService accepts a ChatMessage[] as its prompt.
          // Disable preset/instruct injection so the selected profile supplies only
          // the connection details; our HUD messages remain the actual prompt.
          const profileResult = await stContext.ConnectionManagerRequestService.sendRequest(
              settings.regenProfileId,
              freshMessages,
              hudMaxTokens,
              { stream: false, includePreset: false, includeInstruct: false, signal: отмена.signal }
          );
          if (typeof profileResult === 'string') aiText = profileResult;
          else if (profileResult && profileResult.choices && profileResult.choices[0]) aiText = profileResult.choices[0].message ? profileResult.choices[0].message.content : profileResult.choices[0].text;
          else if (profileResult && Array.isArray(profileResult.content)) aiText = profileResult.content.map(c => c.text).join('');
          else if (profileResult && typeof profileResult.content === 'string') aiText = profileResult.content;
          else if (profileResult && profileResult.text) aiText = profileResult.text;
          else aiText = JSON.stringify(profileResult);
      } else {
          // Перехват узнаёт этот запрос по <hud_instructions> в теле и
          // пропускает — глобальный флаг здесь больше не нужен.
          const res = await fetch(requestUrl, { method: 'POST', headers: requestHeaders, cache: 'no-cache', body: JSON.stringify(hudRequestBody), signal: отмена.signal });
          if (!res.ok) {
              const apiError = await основа.readHudApiError(res);
              throw new Error(`API Error ${apiError.status}: ${apiError.message}`);
          }
          const data = await res.json();
          if (data.choices && data.choices[0]) aiText = data.choices[0].message ? data.choices[0].message.content : data.choices[0].text;
          else if (data.content && Array.isArray(data.content)) aiText = data.content.map(c => c.text).join('');
          else if (data.text) aiText = data.text;
          else if (data.candidates && data.candidates[0] && data.candidates[0].content) aiText = data.candidates[0].content.parts.map(p => p.text).join('');
          else aiText = JSON.stringify(data);
      }

          if (отменено()) throw new DOMException('Отменено', 'AbortError');
          let newHudText = repairGeneratedHudBlock(aiText);
          // Сохраняем HUD в кодах — тем же форматом, каким его пишет модель.
          // Развёрнутые русские ключи в истории противоречили правилу «только
          // коды» и учили модель обратному. Страховка: если разбор кодовой
          // версии хоть в чём-то расходится с исправленной, оставляем её.
          try {
            const внутри = (hudБлоки(String(aiText))[0] || {}).inner;
            const вКодах = внутри ? HUDвКодах(внутри) : null;
            if (вКодах && Object.keys(вКодах).length) {
              const кодами = '[HUD]\n```json\n' + JSON.stringify(вКодах, null, 2) + '\n```\n[/HUD]';
              if (JSON.stringify(parseHUDComplex(кодами)) === JSON.stringify(parseHUDComplex(newHudText))) newHudText = кодами;
            }
          } catch (_) { /* остаётся исправленный блок */ }

          let updatedFullText = основа.replaceHudBlockInText(oldText, newHudText);

          // Прошлый HUD не теряется: он уходит в версии этого свайпа, и его
          // можно вернуть кнопкой «↶» на карточке.
          основа.запомнитьВерсиюHUD(targetMessage, extractHudBlock(основа.текстСообщенияЧата(targetMessage)), 'до перегенерации');
          основа.updateMessageDataForCurrentSwipe(targetMessage, updatedFullText);

          const saveFn =
              (stContext && typeof stContext.saveChatConditional === 'function') ? stContext.saveChatConditional.bind(stContext) :
              (stContext && typeof stContext.saveChat === 'function') ? stContext.saveChat.bind(stContext) :
              (typeof saveChatConditional === 'function') ? saveChatConditional :
              (typeof window.saveChatConditional === 'function') ? window.saveChatConditional :
              (typeof window.saveChat === 'function') ? window.saveChat : null;

          const updateFn = основа.getMessageUpdateFunction(stContext);

          if (updateFn) {
              await Promise.resolve(updateFn(mesIdNum, targetMessage, { rerenderMessage: true }));
          } else {
              textElement.innerHTML = updatedFullText;
          }

          // После штатного обновления ST повторно обрабатываем только HUD.
          // Сам message DOM SillyTavern не пересоздаём.
          requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                  const freshMesEl = document.querySelector(`.mes[mesid="${mesId}"]`) || mesEl;
                  if (freshMesEl && freshMesEl.isConnected) {
                      основа.safeProcessMessage(freshMesEl);
                  }
              });
          });

          if (loadingToast) {
              loadingToast.classList.add('hide');
              setTimeout(() => loadingToast.remove(), 400);
          }

          основа.showHudToast('success', 'Успех',
              `HUD вшит в сообщение. В запрос ушло ${freshMessages.length} сообщ., ${Math.round(hudPromptChars / 1000)} тыс. символов — пресет SillyTavern не отправляется.`);

          if (saveFn) {
              saveFn().catch(saveErr => основа.showHudToast('error', 'Не сохранено', 'HUD показан, но не записан: ' + saveErr.message));
          } else {
              основа.showHudToast('error', 'Не сохранено', 'Функция сохранения чата не найдена.');
          }

      } catch (err) {
          if (loadingToast) {
              loadingToast.classList.add('hide');
              setTimeout(() => loadingToast.remove(), 400);
          }
          if (отменено() || (err && err.name === 'AbortError')) основа.showHudToast('success', 'Отменено', 'Генерация HUD остановлена, сообщение не изменилось.');
          else основа.showHudToast('error', 'Ошибка', 'Не удалось обновить HUD: ' + err.message);
      } finally {
          if (основа.генерацииHUD.get(ключГенерации) === отмена) основа.генерацииHUD.delete(ключГенерации);
          if (убратьИндикатор) убратьИндикатор();
          regenBtn.removeAttribute('title');
          if (regenBtn.isConnected) {
              regenBtn.innerHTML = originalBtnContent;
              regenBtn.classList.remove('hud-spinning');
          } else {
              const strandedBtn = mesEl && mesEl.querySelector('.hud-regen-btn.hud-spinning');
              if (strandedBtn) strandedBtn.classList.remove('hud-spinning');
          }
      }
      return;
}
