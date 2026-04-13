// app.js – Tematy Biblijne
// Główna logika aplikacji: nawigacja, wyszukiwanie, stan, localStorage, AI

'use strict';

/* ════════════════════════════════════════════
   STAŁE
════════════════════════════════════════════ */
const AI_ENDPOINT  = 'https://api.anthropic.com/v1/messages';
const AI_MODEL     = 'claude-sonnet-4-20250514';
const AI_VERSION   = '2023-06-01';
const AI_MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `Jesteś pastorem Kościoła Adwentystów Dnia Siódmego. Odpowiadasz na pytania \
dotyczące Biblii i doktryny zgodnie z 28 Zasadami Wiary ADS. Twoje odpowiedzi \
są życzliwe, merytoryczne, poparte cytatami biblijnymi. Odpowiadasz po polsku.`;

const QUICK_CHIPS = [
  'Więcej wersetów na ten temat',
  'Co mówi Ellen White?',
  'Jak odpowiedzieć na zarzut...',
  'Wyjaśnij prościej'
];

/* ════════════════════════════════════════════
   STAN APLIKACJI
════════════════════════════════════════════ */
const state = {
  activeScreen:    'home',
  screenStack:     ['home'],
  activeFilter:    'Wszystkie',
  currentZasada:   null,    // obiekt zasady
  currentPytanie:  null,    // obiekt pytania
  currentVerseIdx: 0,
  detailVisible:   false,
  chatContext:     null,    // { zasada } gdy otwarty z tematu
  chatMessages:    [],      // { role, content }
  aiStreaming:     false,
  wakeLock:        null,
};

/* ════════════════════════════════════════════
   LOCALSTORAGE
════════════════════════════════════════════ */
function lsGet(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
  catch { return def; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const postep    = () => lsGet('tb_postep', {});
const ulubione  = () => lsGet('tb_ulubione', []);
const ustawienia = () => lsGet('tb_ustawienia', { pokaz_komentarz_rozmowcy: true });

function markDone(pytanieId) {
  const p = postep();
  if (!p[pytanieId]) { p[pytanieId] = true; lsSet('tb_postep', p); }
}

function loadApiKey() {
  try { const v = localStorage.getItem('tb_api_key'); return v ? atob(v) : ''; }
  catch { return ''; }
}
function storeApiKey(key) {
  try { localStorage.setItem('tb_api_key', btoa(key)); } catch {}
}

/* ════════════════════════════════════════════
   NAWIGACJA
════════════════════════════════════════════ */
function showScreen(id, opts = {}) {
  const { title = 'Tematy Biblijne', subtitle = '', backVisible = false, settingsVisible = true } = opts;

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');

  document.getElementById('top-title').textContent = title;
  document.getElementById('top-subtitle').textContent = subtitle;

  const backBtn = document.getElementById('back-btn');
  if (backVisible) backBtn.classList.add('visible');
  else backBtn.classList.remove('visible');

  const settBtn = document.getElementById('settings-btn');
  settBtn.style.display = settingsVisible ? '' : 'none';

  state.activeScreen = id;
}

function pushScreen(id, opts) {
  state.screenStack.push(id);
  showScreen(id, opts);
}

function goBack() {
  const overlay = document.getElementById('guest-overlay');
  if (!overlay.classList.contains('hidden')) { exitGuestMode(); return; }

  if (state.screenStack.length > 1) {
    state.screenStack.pop();
    const prev = state.screenStack[state.screenStack.length - 1];
    _restoreScreen(prev);
  }
}

function _restoreScreen(id) {
  switch (id) {
    case 'home':
      showScreen('home', { title: 'Tematy Biblijne', subtitle: 'Czego szuka twój rozmówca?' });
      break;
    case 'questions':
      if (state.currentZasada) _showQuestionsScreen(state.currentZasada);
      break;
    case 'verse':
      if (state.currentPytanie) _showVerseScreen(state.currentPytanie);
      break;
    case 'chat':
      showScreen('chat', { title: 'Pastor AI', backVisible: true });
      break;
    case 'settings':
      _showSettingsScreen();
      break;
    default:
      showScreen(id, { title: 'Tematy Biblijne' });
  }
}

// Tap na dolną nawigację – czyści stos do root danej sekcji
function navTo(section) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  switch (section) {
    case 'home':
      state.screenStack = ['home'];
      document.getElementById('tab-home').classList.add('active');
      showScreen('home', { title: 'Tematy Biblijne', subtitle: 'Czego szuka twój rozmówca?' });
      break;
    case 'topics':
      state.screenStack = ['home'];
      document.getElementById('tab-topics').classList.add('active');
      document.getElementById('search-input').value = '';
      state.activeFilter = 'Wszystkie';
      renderTopicsGrid(DATA);
      renderCategoryChips();
      showScreen('home', { title: 'Tematy Biblijne', subtitle: 'Wszystkie zasady wiary' });
      break;
    case 'favorites':
      state.screenStack = ['favorites'];
      document.getElementById('tab-favorites').classList.add('active');
      showScreen('favorites', { title: 'Ulubione' });
      break;
    case 'chat':
      state.screenStack = ['chat'];
      document.getElementById('tab-ai').classList.add('active');
      state.chatContext = null;
      _initChat(null);
      showScreen('chat', { title: 'Pastor AI' });
      break;
  }
}

function openSettings() {
  state.screenStack.push('settings');
  _showSettingsScreen();
}

/* ════════════════════════════════════════════
   EKRAN GŁÓWNY – renderowanie
════════════════════════════════════════════ */
function renderCategoryChips() {
  const wrap = document.getElementById('category-chips');
  wrap.innerHTML = KATEGORIE.map(k => {
    const isAll    = k === 'Wszystkie';
    const isActive = state.activeFilter === k;
    const color    = !isAll ? KATEGORIA_KOLORY[k] : null;
    const style    = isActive && color
      ? `background:${color.bg};color:${color.text};border-color:${color.text}`
      : '';
    return `<button class="chip${isActive ? ' active' : ''}" style="${style}"
      onclick="filterCategory('${k}')">${k}</button>`;
  }).join('');
}

function filterCategory(kat) {
  state.activeFilter = kat;
  renderCategoryChips();
  const list = kat === 'Wszystkie' ? DATA : DATA.filter(z => z.kategoria === kat);
  renderTopicsGrid(list);
}

function renderTopicsGrid(list, isSearch = false) {
  const grid = document.getElementById('topics-grid');
  const done = postep();

  if (list.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--muted)">Brak wyników</div>';
    return;
  }

  grid.className = isSearch ? 'topics-grid search-results' : 'topics-grid';

  grid.innerHTML = list.map(zasada => {
    const kol    = KATEGORIA_KOLORY[zasada.kategoria];
    const totalQ = zasada.pytania.length;
    const doneQ  = zasada.pytania.filter(p => done[p.id]).length;
    const pct    = totalQ ? Math.round(doneQ / totalQ * 100) : 0;

    return `<div class="topic-card" style="border-left-color:${kol.border}"
        onclick="openZasada(${zasada.id})">
      <div class="topic-card-emoji">${kol.emoji}</div>
      <div class="topic-card-num">Zasada ${zasada.id}</div>
      <div class="topic-card-title">${zasada.title}</div>
      <div class="topic-card-meta">
        <span>${totalQ} pyt.</span>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%;background:${kol.border}"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════════
   WYSZUKIWANIE
════════════════════════════════════════════ */
function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '');
}

function search(query) {
  const q = normalize(query);
  const results = [];

  DATA.forEach(zasada => {
    let score = 0;
    if (zasada.keywords.some(k => normalize(k).includes(q))) score += 3;
    if (normalize(zasada.title).includes(q))                  score += 2;
    zasada.pytania.forEach(p => {
      if (normalize(p.q).includes(q))                         score += 1;
      p.wersety.forEach(w => {
        if (normalize(w.s).includes(q))                       score += 1;
      });
    });
    if (score > 0) results.push({ zasada, score });
  });

  return results.sort((a, b) => b.score - a.score).map(r => r.zasada);
}

function onSearch(val) {
  if (val.length < 2) {
    state.activeFilter = 'Wszystkie';
    renderCategoryChips();
    renderTopicsGrid(DATA);
    return;
  }
  const results = search(val);
  renderTopicsGrid(results, true);
  // Przywróć wszystkie chipy w trybie przeszukiwania
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
}

/* ════════════════════════════════════════════
   EKRAN PYTAŃ
════════════════════════════════════════════ */
function openZasada(zasadaId) {
  const zasada = DATA.find(z => z.id === zasadaId);
  if (!zasada) return;
  state.currentZasada = zasada;
  state.screenStack.push('questions');
  _showQuestionsScreen(zasada);
}

function _showQuestionsScreen(zasada) {
  const kol = KATEGORIA_KOLORY[zasada.kategoria];
  const done = postep();

  document.getElementById('q-zasada-title').textContent = `${zasada.id}. ${zasada.title}`;
  const chipEl = document.getElementById('q-kategoria-chip');
  chipEl.textContent = zasada.kategoria;
  chipEl.style.cssText = `background:${kol.bg};color:${kol.text}`;

  const list = document.getElementById('questions-list');
  list.innerHTML = zasada.pytania.map((p, i) => {
    const isDone = !!done[p.id];
    return `<div class="question-card${isDone ? ' done' : ''}" onclick="openPytanie('${p.id}')">
      <div class="question-icon">${isDone ? '✓' : (i + 1)}</div>
      <div style="flex:1">
        <div class="question-text">${p.q}</div>
        <div class="question-meta">${p.wersety.length} ${p.wersety.length === 1 ? 'werset' : 'wersetów'}</div>
      </div>
      <span class="question-arrow">›</span>
    </div>`;
  }).join('');

  showScreen('questions', {
    title: zasada.title,
    backVisible: true,
    subtitle: zasada.kategoria
  });
}

/* ════════════════════════════════════════════
   EKRAN WERSETU (split-view)
════════════════════════════════════════════ */
function openPytanie(pytanieId) {
  let zasada = null, pytanie = null;
  for (const z of DATA) {
    const p = z.pytania.find(x => x.id === pytanieId);
    if (p) { zasada = z; pytanie = p; break; }
  }
  if (!pytanie) return;

  state.currentZasada  = zasada;
  state.currentPytanie = pytanie;
  state.currentVerseIdx = 0;
  state.detailVisible   = false;

  markDone(pytanie.id);

  state.screenStack.push('verse');
  _showVerseScreen(pytanie);
}

function _showVerseScreen(pytanie) {
  // Render verse list
  const panel = document.getElementById('verse-list-panel');
  panel.innerHTML = pytanie.wersety.map((w, i) => `
    <div class="verse-list-row${i === state.currentVerseIdx && state.detailVisible ? ' active' : ''}"
      id="vrow-${i}" onclick="selectVerse(${i})">
      <div class="verse-list-ref">${escHtml(w.r)}</div>
      <div class="verse-list-sum">${escHtml(w.s)}</div>
    </div>`).join('');

  // Hide detail pane initially
  document.getElementById('verse-empty').style.display = state.detailVisible ? 'none' : '';
  const det = document.getElementById('verse-detail');
  det.style.display = state.detailVisible ? 'flex' : 'none';

  if (state.detailVisible) _fillVerseDetail(pytanie.wersety[state.currentVerseIdx]);

  document.getElementById('guest-btn').disabled = !state.detailVisible;

  showScreen('verse', {
    title: pytanie.q.length > 38 ? pytanie.q.slice(0, 38) + '…' : pytanie.q,
    backVisible: true
  });
}

function selectVerse(idx) {
  state.currentVerseIdx = idx;
  state.detailVisible   = true;

  const pytanie = state.currentPytanie;
  const verse   = pytanie.wersety[idx];

  // Update list highlight
  document.querySelectorAll('.verse-list-row').forEach((r, i) => {
    r.classList.toggle('active', i === idx);
  });
  document.getElementById(`vrow-${idx}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Show detail
  document.getElementById('verse-empty').style.display = 'none';
  const det = document.getElementById('verse-detail');
  det.style.display = 'flex';
  _fillVerseDetail(verse);

  document.getElementById('guest-btn').disabled = false;
}

function _fillVerseDetail(verse) {
  document.getElementById('d-ref').textContent     = verse.r;
  document.getElementById('d-text').textContent    = `„${verse.t}"`;
  document.getElementById('d-comment').textContent = verse.n;

  const total = state.currentPytanie.wersety.length;
  document.getElementById('prev-btn').disabled = state.currentVerseIdx === 0;
  document.getElementById('next-btn').disabled = state.currentVerseIdx === total - 1;
}

function moveVerse(dir) {
  const n = state.currentVerseIdx + dir;
  const max = state.currentPytanie.wersety.length - 1;
  if (n >= 0 && n <= max) selectVerse(n);
}

function closeVerseDetail() {
  state.detailVisible = false;
  document.getElementById('verse-empty').style.display = '';
  document.getElementById('verse-detail').style.display = 'none';
  document.getElementById('guest-btn').disabled = true;
  document.querySelectorAll('.verse-list-row').forEach(r => r.classList.remove('active'));
}

/* ════════════════════════════════════════════
   TRYB ROZMÓWCY
════════════════════════════════════════════ */
function openGuestMode() {
  if (!state.currentPytanie) return;
  const verse = state.currentPytanie.wersety[state.currentVerseIdx];
  const sett  = ustawienia();

  document.getElementById('guest-ref').textContent     = verse.r;
  document.getElementById('guest-text').textContent    = `„${verse.t}"`;

  const commentEl = document.getElementById('guest-comment');
  if (sett.pokaz_komentarz_rozmowcy) {
    commentEl.textContent = verse.n;
    commentEl.style.display = '';
    document.querySelector('.guest-divider').style.display = '';
  } else {
    commentEl.style.display = 'none';
    document.querySelector('.guest-divider').style.display = 'none';
  }

  document.getElementById('guest-overlay').classList.remove('hidden');
  document.getElementById('bottom-nav').style.display = 'none';

  // Screen Wake Lock
  _acquireWakeLock();
}

function exitGuestMode() {
  document.getElementById('guest-overlay').classList.add('hidden');
  document.getElementById('bottom-nav').style.display = '';
  _releaseWakeLock();
}

async function _acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      state.wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {}
}

function _releaseWakeLock() {
  try { if (state.wakeLock) { state.wakeLock.release(); state.wakeLock = null; } }
  catch {}
}

/* ════════════════════════════════════════════
   PASTOR AI – CZAT
════════════════════════════════════════════ */
function openChatFromTopic() {
  state.chatContext = { zasada: state.currentZasada };
  state.screenStack.push('chat');
  _initChat(state.chatContext);
  showScreen('chat', { title: 'Pastor AI', backVisible: true });
}

function _initChat(ctx) {
  state.chatMessages = [];
  state.aiStreaming   = false;
  const box = document.getElementById('chat-messages');
  box.innerHTML = '';

  let welcome = 'Pokój Tobie! Jestem asystentem biblijnym opartym na 28 Zasadach Wiary ADS. O czym chcesz porozmawiać?';
  if (ctx && ctx.zasada) {
    welcome = `Mam otwarty temat: <strong>${ctx.zasada.title}</strong> (Zasada ${ctx.zasada.id}). O co chcesz zapytać?`;
  }

  _addMsgEl(box, 'ai', welcome);
  _renderChatChips(!!ctx);
}

function _renderChatChips(hasContext) {
  const wrap = document.getElementById('chat-chips');
  wrap.innerHTML = QUICK_CHIPS.map(c =>
    `<button class="chat-chip" onclick="sendChat('${escAttr(c)}')">${escHtml(c)}</button>`
  ).join('');
}

function _addMsgEl(box, role, html) {
  const div = document.createElement('div');
  div.className = `msg msg-${role}`;
  div.innerHTML = html;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

async function sendChat(presetText) {
  if (state.aiStreaming) return;

  const inputEl = document.getElementById('chat-input');
  const text = (presetText || inputEl.value).trim();
  if (!text) return;

  inputEl.value = '';
  const box = document.getElementById('chat-messages');

  // Add user message
  _addMsgEl(box, 'user', escHtml(text));
  state.chatMessages.push({ role: 'user', content: text });

  // Check API key
  const apiKey = loadApiKey();
  if (!apiKey) {
    _addMsgEl(box, 'error',
      'Wprowadź klucz API w <a onclick="openSettings()" style="text-decoration:underline;cursor:pointer">Ustawieniach →</a>');
    return;
  }

  // Check connectivity
  if (!navigator.onLine) {
    _addMsgEl(box, 'error', 'Brak połączenia. Pastor AI wymaga internetu.');
    return;
  }

  state.aiStreaming = true;
  document.getElementById('chat-send-btn').disabled = true;

  // Typing indicator
  const typingEl = _addMsgEl(box, 'ai msg-typing',
    '<span></span><span></span><span></span>');

  // Build messages with context
  const messages = _buildAiMessages();

  try {
    const response = await fetch(AI_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     apiKey,
        'anthropic-version': AI_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      AI_MODEL,
        max_tokens: AI_MAX_TOKENS,
        stream:     true,
        system:     SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const err = _parseHttpError(response.status);
      typingEl.remove();
      _addMsgEl(box, 'error', err);
      state.chatMessages.pop(); // remove user msg from history
      return;
    }

    // Stream response
    typingEl.className = 'msg msg-ai';
    typingEl.innerHTML = '';
    let fullText = '';

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]' || data === '') continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            fullText += evt.delta.text;
            typingEl.textContent = fullText;
            box.scrollTop = box.scrollHeight;
          }
        } catch {}
      }
    }

    state.chatMessages.push({ role: 'assistant', content: fullText });

  } catch (e) {
    typingEl.remove();
    _addMsgEl(box, 'error', 'Błąd połączenia z asystentem. Spróbuj ponownie.');
  } finally {
    state.aiStreaming = false;
    document.getElementById('chat-send-btn').disabled = false;
  }
}

function _buildAiMessages() {
  const msgs = [...state.chatMessages];

  // Prepend context if available
  if (state.chatContext && state.chatContext.zasada) {
    const z = state.chatContext.zasada;
    let ctx = `Kontekst rozmowy – Zasada ${z.id}: ${z.title}\n\n`;
    ctx += 'Pytania dotyczące tej zasady:\n';
    z.pytania.forEach(p => { ctx += `- ${p.q}\n`; });

    if (state.currentPytanie && state.currentPytanie.id.startsWith(`${z.id}-`)) {
      const wp = state.currentPytanie.wersety[state.currentVerseIdx];
      ctx += `\nAktywny werset: ${wp.r} – ${wp.s}\n„${wp.t}"`;
    }

    // Insert as system-like first user message (prepend to copy)
    msgs[0] = { role: 'user', content: ctx + '\n\n' + msgs[0].content };
  }

  return msgs;
}

function _parseHttpError(status) {
  if (status === 401 || status === 403) return 'Nieprawidłowy klucz API. Sprawdź <a onclick="openSettings()" style="text-decoration:underline;cursor:pointer">Ustawienia →</a>';
  if (status === 429) return 'Przekroczono limit zapytań. Spróbuj za chwilę.';
  return `Błąd połączenia z asystentem (${status}). Spróbuj ponownie.`;
}

/* ════════════════════════════════════════════
   USTAWIENIA
════════════════════════════════════════════ */
function _showSettingsScreen() {
  const key  = loadApiKey();
  const sett = ustawienia();

  const inp = document.getElementById('api-key-input');
  inp.value = key ? '••••••••••••••••' : '';
  inp.placeholder = key ? 'Klucz zapisany' : 'sk-ant-api03-…';

  const clearBtn = document.getElementById('clear-api-btn');
  clearBtn.style.display = key ? '' : 'none';

  const status = document.getElementById('api-key-status');
  status.textContent = key ? `Klucz aktywny (${key.slice(0, 10)}…)` : 'Brak klucza API';

  const toggle = document.getElementById('comment-toggle');
  toggle.classList.toggle('on', !!sett.pokaz_komentarz_rozmowcy);

  showScreen('settings', { title: 'Ustawienia', backVisible: true, settingsVisible: false });
}

function saveApiKey() {
  const inp = document.getElementById('api-key-input');
  const val = inp.value.trim();
  if (!val || val.startsWith('•')) {
    alert('Wprowadź poprawny klucz API.');
    return;
  }
  storeApiKey(val);
  inp.value = '••••••••••••••••';
  document.getElementById('clear-api-btn').style.display = '';
  document.getElementById('api-key-status').textContent = `Klucz aktywny (${val.slice(0, 10)}…)`;
}

function clearApiKey() {
  if (!confirm('Czy na pewno chcesz usunąć klucz API?')) return;
  localStorage.removeItem('tb_api_key');
  document.getElementById('api-key-input').value = '';
  document.getElementById('api-key-input').placeholder = 'sk-ant-api03-…';
  document.getElementById('clear-api-btn').style.display = 'none';
  document.getElementById('api-key-status').textContent = 'Brak klucza API';
}

function toggleCommentSetting() {
  const sett = ustawienia();
  sett.pokaz_komentarz_rozmowcy = !sett.pokaz_komentarz_rozmowcy;
  lsSet('tb_ustawienia', sett);
  document.getElementById('comment-toggle').classList.toggle('on', sett.pokaz_komentarz_rozmowcy);
}

/* ════════════════════════════════════════════
   POMOCNICZE
════════════════════════════════════════════ */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escAttr(str) {
  return String(str).replace(/'/g, "\\'");
}

/* ════════════════════════════════════════════
   ANDROID BACK BUTTON (Capacitor)
════════════════════════════════════════════ */
document.addEventListener('backbutton', goBack, false);

/* ════════════════════════════════════════════
   SERVICE WORKER
════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          document.getElementById('sw-toast').classList.remove('hidden');
        }
      });
    });
  }).catch(() => {});
}

/* ════════════════════════════════════════════
   INICJALIZACJA
════════════════════════════════════════════ */
function init() {
  renderCategoryChips();
  renderTopicsGrid(DATA);
  showScreen('home', { title: 'Tematy Biblijne', subtitle: 'Czego szuka twój rozmówca?' });
}

document.addEventListener('DOMContentLoaded', init);
