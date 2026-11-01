'use strict';

// Tabla de récords local (localStorage). Expone window.HighScores.
(function () {
  const SCORES_KEY = 'tetris-highscores';
  const RECORDS_KEY = 'tetris-records';
  const MAX_ENTRIES = 5;
  const NAME_MAX = 12;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) { /* almacenamiento lleno o bloqueado */ }
  }

  function toInt(v) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function normalizeEntry(e) {
    return {
      name: String(e.name ?? '').trim().slice(0, NAME_MAX) || 'Anónimo',
      score: toInt(e.score),
      lines: toInt(e.lines),
      level: toInt(e.level) || 1,
      combo: toInt(e.combo),
      date: typeof e.date === 'string' ? e.date : '',
    };
  }

  function getScores() {
    const list = readJSON(SCORES_KEY, []);
    if (!Array.isArray(list)) return [];
    return list
      .filter(e => e && typeof e === 'object')
      .map(normalizeEntry)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
  }

  // Posición (0-based) que ocuparía `score` en `list`; >= MAX_ENTRIES si no entra.
  function positionFor(score, list) {
    const idx = list.findIndex(e => score > e.score);
    return idx === -1 ? list.length : idx;
  }

  function getRecords() {
    const r = readJSON(RECORDS_KEY, {});
    return {
      bestCombo: toInt(r && r.bestCombo),
      maxLines: toInt(r && r.maxLines),
    };
  }

  function qualifies(score) {
    if (score <= 0) return false;
    return positionFor(score, getScores()) < MAX_ENTRIES;
  }

  // Inserta la entrada y devuelve su posición (0-based) o -1 si no entra.
  function addScore(entry) {
    const list = getScores();
    const item = normalizeEntry({ ...entry, date: new Date().toISOString() });
    if (item.score <= 0) return -1;
    const idx = positionFor(item.score, list);
    if (idx >= MAX_ENTRIES) return -1;
    list.splice(idx, 0, item);
    writeJSON(SCORES_KEY, list.slice(0, MAX_ENTRIES));
    return idx;
  }

  // Actualiza mejor combo / líneas máximas. Devuelve qué récords se batieron.
  function updateRecords(combo, lines) {
    const r = getRecords();
    const result = { combo: false, lines: false };
    if (combo > r.bestCombo) { r.bestCombo = combo; result.combo = true; }
    if (lines > r.maxLines) { r.maxLines = lines; result.lines = true; }
    if (result.combo || result.lines) writeJSON(RECORDS_KEY, r);
    return result;
  }

  function reset() {
    try {
      localStorage.removeItem(SCORES_KEY);
      localStorage.removeItem(RECORDS_KEY);
    } catch (_) { /* ignore */ }
  }

  // ---------- Render (solo textContent: los nombres nunca se interpretan como HTML) ----------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderInto(container, opts) {
    const options = opts || {};
    container.replaceChildren();

    const table = el('table', 'hs-table');
    const thead = el('thead');
    const hr = el('tr');
    ['#', 'Nombre', 'Puntos', 'Líneas', 'Combo'].forEach(h => hr.appendChild(el('th', null, h)));
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = el('tbody');
    const list = getScores();
    if (!list.length) {
      const tr = el('tr', 'hs-empty');
      const td = el('td', null, 'Sin récords todavía');
      td.colSpan = 5;
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      list.forEach((e, i) => {
        const tr = el('tr', i === options.highlight ? 'hs-highlight' : null);
        tr.appendChild(el('td', null, String(i + 1)));
        tr.appendChild(el('td', 'hs-name', e.name));
        tr.appendChild(el('td', null, e.score.toLocaleString()));
        tr.appendChild(el('td', null, String(e.lines)));
        tr.appendChild(el('td', null, String(e.combo)));
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    container.appendChild(table);

    const rec = getRecords();
    const stats = el('div', 'hs-records');
    const combo = el('span', options.newCombo ? 'hs-record-new' : null, `Mejor combo: ${rec.bestCombo}`);
    const lines = el('span', options.newLines ? 'hs-record-new' : null, `Líneas máx.: ${rec.maxLines}`);
    stats.appendChild(combo);
    stats.appendChild(lines);
    container.appendChild(stats);
  }

  // ---------- UI ----------

  const startScreen = document.getElementById('start-screen');
  const startTable = document.getElementById('hs-start-table');
  const playBtn = document.getElementById('play-btn');
  const goBox = document.getElementById('hs-gameover');
  const goTable = document.getElementById('hs-gameover-table');
  const entryBox = document.getElementById('hs-entry');
  const entryMsg = document.getElementById('hs-entry-msg');
  const nameInput = document.getElementById('hs-name');
  const saveBtn = document.getElementById('hs-save-btn');
  const resetBtns = document.querySelectorAll('.hs-reset-btn');

  let startCallback = null;
  let pending = null;       // partida pendiente de guardar nombre
  let lastFlags = {};       // récords de combo/líneas batidos en la última partida
  let focusTimer = 0;

  function showStartScreen(onStart) {
    startCallback = onStart;
    renderInto(startTable);
    startScreen.classList.remove('hidden');
  }

  function startGame() {
    if (startScreen.classList.contains('hidden')) return;
    startScreen.classList.add('hidden');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (startCallback) startCallback();
  }

  function onGameStart() {
    // Reiniciar sin pulsar Guardar no descarta el récord: se guarda con el nombre escrito (o 'Anónimo').
    if (pending) addScore({ ...pending, name: nameInput.value });
    clearTimeout(focusTimer);
    pending = null;
    goBox.classList.add('hidden');
    entryBox.classList.add('hidden');
  }

  function onGameOver(stats) {
    lastFlags = updateRecords(stats.combo, stats.lines);
    goBox.classList.remove('hidden');
    if (qualifies(stats.score)) {
      pending = stats;
      updateEntryMsg();
      nameInput.value = '';
      entryBox.classList.remove('hidden');
      // Enfoque diferido: la tecla que terminó la partida (p. ej. Space mantenida) no debe escribir en el campo.
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => { if (pending) nameInput.focus(); }, 350);
    } else {
      pending = null;
      entryBox.classList.add('hidden');
    }
    renderInto(goTable, { newCombo: lastFlags.combo, newLines: lastFlags.lines });
  }

  function updateEntryMsg() {
    if (!pending) return;
    entryMsg.textContent = `¡Nuevo récord! Puesto #${positionFor(pending.score, getScores()) + 1}`;
  }

  function saveName() {
    if (!pending) return;
    const idx = addScore({ ...pending, name: nameInput.value });
    pending = null;
    clearTimeout(focusTimer);
    entryBox.classList.add('hidden');
    nameInput.blur();
    renderInto(goTable, { highlight: idx, newCombo: lastFlags.combo, newLines: lastFlags.lines });
  }

  function resetAll() {
    if (!confirm('¿Borrar todos los récords? Esta acción no se puede deshacer.')) return;
    reset();
    lastFlags = {};
    updateEntryMsg();
    renderInto(startTable);
    renderInto(goTable);
  }

  // Llamado al principio del keydown global de game.js.
  // Devuelve true si el juego NO debe procesar la tecla.
  function handleKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return true;
    if (!startScreen.classList.contains('hidden')) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        startGame();
      }
      return true;
    }
    return false;
  }

  playBtn.addEventListener('click', startGame);
  saveBtn.addEventListener('click', saveName);
  nameInput.addEventListener('keydown', e => {
    if (e.repeat) { e.preventDefault(); return; } // ignora auto-repetición de teclas mantenidas
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName();
    }
  });
  resetBtns.forEach(b => b.addEventListener('click', resetAll));

  window.HighScores = {
    getScores,
    getRecords,
    qualifies,
    addScore,
    updateRecords,
    reset,
    showStartScreen,
    onGameStart,
    onGameOver,
    handleKey,
  };
})();
