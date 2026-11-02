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

const RECORDS_KEY = 'tetris-records';
const LAST_NAME_KEY = 'tetris-last-name';
const MAX_RECORDS = 5;

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
const newRecordEl = document.getElementById('new-record');
const newRecordRank = document.getElementById('new-record-rank');
const playerNameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const recordsEl = document.getElementById('records');
const recordsBody = document.getElementById('records-body');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let started = false;
let combo = 0, maxCombo = 0;           // combo = piezas consecutivas que limpian líneas
let records = loadRecords();
let pendingRecord = null;              // partida que entra en el top y aún no tiene nombre
let highlightIndex = -1;               // fila recién guardada a resaltar

// ---- Records (localStorage) ----

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && Array.isArray(data.scores)) {
      return {
        scores: data.scores.slice(0, MAX_RECORDS),
        bestCombo: data.bestCombo || 0,
        maxLines: data.maxLines || 0,
      };
    }
  } catch (_) { /* datos corruptos: se ignoran */ }
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function saveRecords() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

// Posición (0-based) que ocuparía `value` en el top, o -1 si no entra.
function rankFor(value) {
  if (value <= 0) return -1;
  const i = records.scores.findIndex(r => value > r.score);
  const idx = i === -1 ? records.scores.length : i;
  return idx < MAX_RECORDS ? idx : -1;
}

function renderRecords() {
  let rows = records.scores.map(r => ({ ...r }));
  let hl = highlightIndex;

  if (pendingRecord) {
    const idx = rankFor(pendingRecord.score);
    const name = playerNameInput.value.trim().toUpperCase() || '???';
    rows.splice(idx, 0, { ...pendingRecord, name, pending: true });
    rows = rows.slice(0, MAX_RECORDS);
    hl = idx;
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
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === hl) tr.classList.add('highlight');
    if (r.pending) tr.classList.add('pending');
    for (const text of [i + 1, r.name, r.score.toLocaleString(), r.lines]) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }
    recordsBody.appendChild(tr);
  });

  bestComboEl.textContent = records.bestCombo;
  maxLinesEl.textContent = records.maxLines;
}

function commitPendingRecord() {
  if (!pendingRecord) return;
  const name = playerNameInput.value.trim().toUpperCase() || 'ANÓNIMO';
  const idx = rankFor(pendingRecord.score);
  records.scores.splice(idx, 0, { ...pendingRecord, name, date: Date.now() });
  records.scores = records.scores.slice(0, MAX_RECORDS);
  saveRecords();
  localStorage.setItem(LAST_NAME_KEY, name);
  pendingRecord = null;
  highlightIndex = idx;
  newRecordEl.classList.add('hidden');
  renderRecords();
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  records = { scores: [], bestCombo: 0, maxLines: 0 };
  localStorage.removeItem(RECORDS_KEY);
  highlightIndex = -1;
  renderRecords();
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
    maxCombo = Math.max(maxCombo, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
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

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  saveRecords();

  highlightIndex = -1;
  const rank = rankFor(score);
  pendingRecord = rank >= 0 ? { score, lines, level, combo: maxCombo } : null;

  overlayTitle.textContent = 'GAME OVER';
  overlayTitle.className = '';
  overlayScore.textContent =
    `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo: ${maxCombo}`;
  restartBtn.textContent = 'Reiniciar';
  recordsEl.classList.remove('hidden');

  if (pendingRecord) {
    newRecordRank.textContent = rank + 1;
    playerNameInput.value = localStorage.getItem(LAST_NAME_KEY) || '';
    newRecordEl.classList.remove('hidden');
  } else {
    newRecordEl.classList.add('hidden');
  }
  renderRecords();
  overlay.classList.remove('hidden');
  if (pendingRecord) {
    playerNameInput.focus();
    playerNameInput.select();
  }
}

function showStartScreen() {
  started = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  overlayTitle.textContent = 'TETRIS';
  overlayTitle.className = 'title-start';
  overlayScore.textContent = 'Pulsa JUGAR o Enter para empezar';
  newRecordEl.classList.add('hidden');
  recordsEl.classList.remove('hidden');
  restartBtn.textContent = 'Jugar';
  renderRecords();
  overlay.classList.remove('hidden');
}

// Inicia (o reinicia) una partida; guarda antes el record pendiente si lo hay.
function startGame() {
  commitPendingRecord();
  highlightIndex = -1;
  started = true;
  init();
}

function togglePause() {
  if (gameOver || !started) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayTitle.className = 'title-pause';
    overlayScore.textContent = '';
    newRecordEl.classList.add('hidden');
    recordsEl.classList.add('hidden');
    restartBtn.textContent = 'Reiniciar';
    overlay.classList.remove('hidden');
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
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === playerNameInput) {
    if (e.key === 'Enter') commitPendingRecord();
    return;
  }
  if (!started) {
    if (e.key === 'Enter') startGame();
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
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

restartBtn.addEventListener('click', startGame);
saveRecordBtn.addEventListener('click', commitPendingRecord);
playerNameInput.addEventListener('input', renderRecords);
resetRecordsBtn.addEventListener('click', resetRecords);

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
});

showStartScreen();
