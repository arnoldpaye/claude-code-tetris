'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#9e9e9e', // N - tuerca (gris metálico)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 10;
const START_LEVEL_KEY = 'tetris-start-level';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const gameoverView = document.getElementById('gameover-view');
const pauseView = document.getElementById('pause-view');
const controlsView = document.getElementById('controls-view');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const levelDownBtn = document.getElementById('level-down');
const levelUpBtn = document.getElementById('level-up');
const startLevelValue = document.getElementById('start-level-value');
const newRecordMsg = document.getElementById('new-record-msg');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('player-name');
const recordsEl = document.getElementById('records');
const recordsBody = document.getElementById('records-body');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const statCombo = document.getElementById('stat-combo');
const statLines = document.getElementById('stat-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let started = false;
let combo = 0;      // piezas consecutivas que han limpiado líneas
let gameBestCombo = 0;

// ---- Records (localStorage) ----
const RECORDS_KEY = 'tetris-records';
const NAME_KEY = 'tetris-player-name';
const MAX_RECORDS = 5;

let records = loadRecords();
let pendingRank = -1;   // puesto que ocupará la partida actual si aún no se ha guardado
let highlightRow = -1;  // fila guardada en esta partida que se resalta
let newBestCombo = false;
let newMaxLines = false;

function emptyRecords() {
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || !Array.isArray(data.scores)) return emptyRecords();
    return {
      scores: data.scores
        .filter(s => s && typeof s.name === 'string' && Number.isFinite(s.score))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECORDS),
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch {
    return emptyRecords();
  }
}

function saveRecords() {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // localStorage no disponible (modo privado, cuota llena...): se ignora
  }
}

// Puesto (0-based) que ocuparía una puntuación, o -1 si no entra en el top.
// A igual puntuación, el record más antiguo conserva su puesto.
function rankFor(value) {
  if (value <= 0) return -1;
  let idx = records.scores.findIndex(s => value > s.score);
  if (idx === -1) idx = records.scores.length;
  return idx < MAX_RECORDS ? idx : -1;
}

function playerName() {
  return nameInput.value.trim().toUpperCase().slice(0, 12) || 'JUGADOR';
}

function savePendingScore() {
  if (pendingRank < 0) return;
  const name = playerName();
  records.scores.splice(pendingRank, 0, { name, score, lines, level, date: Date.now() });
  records.scores.length = Math.min(records.scores.length, MAX_RECORDS);
  saveRecords();
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignorar */ }
  highlightRow = pendingRank;
  pendingRank = -1;
}

function renderRecords() {
  const rows = records.scores.map(s => ({ ...s }));
  let hl = highlightRow;
  if (pendingRank >= 0) {
    rows.splice(pendingRank, 0, { name: nameInput.value.trim().toUpperCase() || '???', score, lines });
    rows.length = Math.min(rows.length, MAX_RECORDS);
    hl = pendingRank;
  }

  recordsBody.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'empty';
    td.textContent = 'Sin records todavía';
    tr.appendChild(td);
    recordsBody.appendChild(tr);
  }
  rows.forEach((s, i) => {
    const tr = document.createElement('tr');
    if (i === hl) tr.className = 'highlight';
    for (const text of [i + 1, s.name, s.score.toLocaleString(), s.lines ?? '-']) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }
    recordsBody.appendChild(tr);
  });

  bestComboEl.textContent = records.bestCombo;
  maxLinesEl.textContent = records.maxLines;
  statCombo.classList.toggle('highlight', newBestCombo);
  statLines.classList.toggle('highlight', newMaxLines);
}

// mode: 'start' | 'pause' | 'gameover'
function showOverlay(mode) {
  const isPause = mode === 'pause';
  const isGameOver = mode === 'gameover';

  overlayTitle.textContent = isPause ? 'PAUSA' : isGameOver ? 'GAME OVER' : 'TETRIS';
  overlayScore.textContent = isGameOver
    ? `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo: ${gameBestCombo}`
    : mode === 'start' ? 'Pulsa Jugar o Enter para empezar' : '';
  restartBtn.textContent = mode === 'start' ? 'Jugar' : 'Reiniciar';

  const qualifies = isGameOver && pendingRank >= 0;
  newRecordMsg.classList.toggle('hidden', !qualifies);
  newRecordMsg.textContent = qualifies ? `¡Nuevo récord! Puesto #${pendingRank + 1}` : '';
  nameForm.classList.toggle('hidden', !qualifies);
  recordsEl.classList.toggle('hidden', isPause);

  if (isPause) {
    updateLevelPicker();
    showView(pauseView);
  } else {
    showView(gameoverView);
    renderRecords();
  }
  overlay.classList.remove('hidden');
  (qualifies ? nameInput : isPause ? resumeBtn : restartBtn).focus();
}

// Nivel con el que empieza la próxima partida (persistido entre sesiones).
let startLevel = clampLevel(parseInt(localStorage.getItem(START_LEVEL_KEY), 10));

// Teclas físicamente pulsadas, y teclas bloqueadas hasta que se suelten.
// Al cerrar el menú, todo lo que siga pulsado queda bloqueado para que no
// se traduzca en un movimiento accidental al volver al juego.
const pressedKeys = new Set();
let blockedKeys = new Set();

function clampLevel(n) {
  if (!Number.isFinite(n)) return MIN_START_LEVEL;
  return Math.min(MAX_START_LEVEL, Math.max(MIN_START_LEVEL, n));
}

function intervalForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    gameBestCombo = Math.max(gameBestCombo, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = intervalForLevel(level);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function showView(view) {
  for (const v of [gameoverView, pauseView, controlsView])
    v.classList.toggle('hidden', v !== view);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  newBestCombo = gameBestCombo > records.bestCombo;
  newMaxLines = lines > records.maxLines;
  if (newBestCombo) records.bestCombo = gameBestCombo;
  if (newMaxLines) records.maxLines = lines;
  if (newBestCombo || newMaxLines) saveRecords();

  pendingRank = rankFor(score);
  highlightRow = -1;
  showOverlay('gameover');
}

function openPauseMenu() {
  if (!started || gameOver || paused) return;
  paused = true;
  cancelAnimationFrame(animId);
  showOverlay('pause');
}

function releaseMenuFocus() {
  // Quitar el foco del botón evita que Space/Enter lo vuelvan a activar
  // durante la partida.
  if (overlay.contains(document.activeElement)) document.activeElement.blur();
  blockedKeys = new Set(pressedKeys);
}

function resumeGame() {
  if (!paused || gameOver) return;
  paused = false;
  overlay.classList.add('hidden');
  releaseMenuFocus();
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function restartGame() {
  savePendingScore(); // si no pulsó Guardar, el record no se pierde
  releaseMenuFocus();
  init();
}

function showControls() {
  overlayTitle.textContent = 'CONTROLES';
  showView(controlsView);
  controlsBackBtn.focus();
}

function hideControls() {
  overlayTitle.textContent = 'PAUSA';
  showView(pauseView);
  controlsBtn.focus();
}

function setStartLevel(n) {
  startLevel = clampLevel(n);
  localStorage.setItem(START_LEVEL_KEY, String(startLevel));
  updateLevelPicker();
}

function updateLevelPicker() {
  startLevelValue.textContent = startLevel;
  levelDownBtn.disabled = startLevel <= MIN_START_LEVEL;
  levelUpBtn.disabled = startLevel >= MAX_START_LEVEL;
}

function visibleMenuButtons() {
  const view = [pauseView, controlsView, gameoverView].find(v => !v.classList.contains('hidden'));
  return view ? [...view.querySelectorAll('button:not(:disabled)')] : [];
}

function moveMenuFocus(delta) {
  const items = visibleMenuButtons();
  if (!items.length) return;
  const idx = items.indexOf(document.activeElement);
  const nextIdx = idx === -1 ? 0 : (idx + delta + items.length) % items.length;
  items[nextIdx].focus();
}

// Teclado mientras el overlay está abierto: ninguna tecla llega al juego.
// Enter / Space los gestiona de forma nativa el botón enfocado.
function handleMenuKey(e) {
  const inControls = !controlsView.classList.contains('hidden');
  switch (e.code) {
    case 'Enter':
      // Pantalla de inicio sin ningún botón enfocado: Enter empieza la partida.
      if (!started && !(document.activeElement instanceof HTMLButtonElement)) {
        e.preventDefault();
        restartGame();
      }
      break;
    case 'Escape':
      e.preventDefault();
      if (gameOver) return;
      if (inControls) hideControls(); else resumeGame();
      break;
    case 'KeyP':
      if (!gameOver) resumeGame();
      break;
    case 'ArrowUp':
    case 'ArrowDown':
      e.preventDefault();
      moveMenuFocus(e.code === 'ArrowDown' ? 1 : -1);
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
      e.preventDefault();
      if (!gameOver && !inControls && document.activeElement?.closest('.level-picker')) {
        setStartLevel(startLevel + (e.code === 'ArrowRight' ? 1 : -1));
        // Si el botón enfocado acaba de deshabilitarse, pasar el foco al otro.
        if (document.activeElement?.disabled || !document.activeElement?.closest('.level-picker'))
          (levelDownBtn.disabled ? levelUpBtn : levelDownBtn).focus();
      }
      break;
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  started = true;
  combo = 0;
  gameBestCombo = 0;
  pendingRank = -1;
  highlightRow = -1;
  newBestCombo = false;
  newMaxLines = false;
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalForLevel(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  showView(gameoverView);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  pressedKeys.add(e.code);
  if (e.target === nameInput) return; // escribiendo el nombre

  if (!overlay.classList.contains('hidden')) { handleMenuKey(e); return; }

  // Tecla que seguía pulsada al cerrar el menú: ignorar hasta soltarla.
  if (blockedKeys.has(e.code)) {
    if (e.code === 'Space') e.preventDefault();
    return;
  }

  if (e.code === 'KeyP' || e.code === 'Escape') { openPauseMenu(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

document.addEventListener('keyup', e => {
  pressedKeys.delete(e.code);
  blockedKeys.delete(e.code);
});

// Sin foco no llegan los keyup: limpiar para no dejar teclas "atascadas".
window.addEventListener('blur', () => {
  pressedKeys.clear();
  blockedKeys.clear();
});

restartBtn.addEventListener('click', restartGame);
pauseRestartBtn.addEventListener('click', restartGame);
resumeBtn.addEventListener('click', resumeGame);
controlsBtn.addEventListener('click', showControls);
controlsBackBtn.addEventListener('click', hideControls);
levelDownBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
levelUpBtn.addEventListener('click', () => setStartLevel(startLevel + 1));

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  savePendingScore();
  showOverlay('gameover');
  restartBtn.focus();
});

nameInput.addEventListener('input', () => {
  if (pendingRank >= 0) renderRecords();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  records = emptyRecords();
  try { localStorage.removeItem(RECORDS_KEY); } catch { /* ignorar */ }
  highlightRow = -1;
  newBestCombo = false;
  newMaxLines = false;
  if (gameOver && pendingRank >= 0) pendingRank = rankFor(score);
  showOverlay(gameOver ? 'gameover' : 'start');
});

const themeToggle = document.getElementById('theme-toggle');
const toggleIcon = themeToggle.querySelector('.toggle-icon');
const toggleLabel = themeToggle.querySelector('.toggle-label');

function applyTheme(isLight) {
  if (isLight) {
    document.body.classList.add('light-mode');
    toggleIcon.textContent = '☀';
    toggleLabel.textContent = 'DARK';
  } else {
    document.body.classList.remove('light-mode');
    toggleIcon.textContent = '☾';
    toggleLabel.textContent = 'LIGHT';
  }
}

const savedTheme = localStorage.getItem('tetris-theme');
applyTheme(savedTheme === 'light');

themeToggle.addEventListener('click', () => {
  const isLight = !document.body.classList.contains('light-mode');
  applyTheme(isLight);
  localStorage.setItem('tetris-theme', isLight ? 'light' : 'dark');
  if (!started) { ctx.clearRect(0, 0, canvas.width, canvas.height); drawGrid(); }
});

try { nameInput.value = localStorage.getItem(NAME_KEY) || ''; } catch { /* ignorar */ }

// Pantalla de inicio: tablero vacío + records
board = createBoard();
ctx.clearRect(0, 0, canvas.width, canvas.height);
drawGrid();
showOverlay('start');
