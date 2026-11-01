'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// ---- Skins ----
// Cada skin define su paleta (índices 1–8) y su función de dibujo de bloque.
// drawBlock(context, px, py, size, color) recibe coordenadas en píxeles.

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

// Patrón 6×6 para pixel art: L = luz, D = sombra, S = brillo, . = color base
const PIXEL_PATTERN = [
  'LLLLLD',
  'LS...D',
  'L.S..D',
  'L....D',
  'L....D',
  'DDDDDD',
];
const PIXEL_SHADES = {
  L: 'rgba(255,255,255,0.35)',
  S: 'rgba(255,255,255,0.75)',
  D: 'rgba(0,0,0,0.35)',
};

const SKINS = {
  retro: {
    label: 'Retro',
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#90caf9', // J - pale blue
      '#ffb74d', // L - orange
      '#9e9e9e', // N - tuerca (gris metálico)
    ],
    drawBlock(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },

  neon: {
    label: 'Neon',
    colors: [
      null,
      '#00f0ff', // I
      '#fff200', // O
      '#d400ff', // T
      '#39ff14', // S
      '#ff073a', // Z
      '#2979ff', // J
      '#ff8c00', // L
      '#e0e0ff', // N
    ],
    drawBlock(context, px, py, size, color) {
      const inset = 3;
      const s = size - inset * 2;
      context.save();
      context.shadowColor = color;
      context.shadowBlur = 15;
      // relleno translúcido + borde brillante, ambos con glow
      const baseAlpha = context.globalAlpha;
      context.globalAlpha = baseAlpha * 0.3;
      context.fillStyle = color;
      context.fillRect(px + inset, py + inset, s, s);
      context.globalAlpha = baseAlpha;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + inset, py + inset, s, s);
      context.restore();
    },
  },

  pastel: {
    label: 'Pastel',
    colors: [
      null,
      '#a8e6ef', // I
      '#fdf1a7', // O
      '#d7b8f3', // T
      '#b9f0c4', // S
      '#ffb7c5', // Z
      '#b5cdfa', // J
      '#ffd3a8', // L
      '#d6d6e0', // N
    ],
    drawBlock(context, px, py, size, color) {
      const pad = 2;
      roundedRectPath(context, px + pad, py + pad, size - pad * 2, size - pad * 2, size * 0.25);
      context.fillStyle = color;
      context.fill();
      context.lineWidth = 1.5;
      context.strokeStyle = 'rgba(255,255,255,0.7)';
      context.stroke();
      // brillo suave arriba-izquierda
      context.fillStyle = 'rgba(255,255,255,0.5)';
      context.beginPath();
      context.arc(px + size * 0.32, py + size * 0.32, size * 0.1, 0, Math.PI * 2);
      context.fill();
    },
  },

  pixel: {
    label: 'Pixel art',
    colors: [
      null,
      '#3cbcfc', // I
      '#fcd800', // O
      '#b03cfc', // T
      '#58d854', // S
      '#e40058', // Z
      '#0058f8', // J
      '#fc7460', // L
      '#a0a0a0', // N
    ],
    drawBlock(context, px, py, size, color) {
      const n = PIXEL_PATTERN.length;
      const p = size / n;
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const shade = PIXEL_SHADES[PIXEL_PATTERN[r][c]];
          if (!shade) continue;
          context.fillStyle = shade;
          // floor/ceil evita huecos sub-píxel si size no es múltiplo de n
          const x0 = Math.floor(px + c * p), y0 = Math.floor(py + r * p);
          context.fillRect(x0, y0, Math.ceil(px + (c + 1) * p) - x0, Math.ceil(py + (r + 1) * p) - y0);
        }
      }
    },
  },
};

const DEFAULT_SKIN = 'retro';
let skinKey = DEFAULT_SKIN;
let skin = SKINS[DEFAULT_SKIN];
let COLORS = skin.colors;

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

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

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
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
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
  context.globalAlpha = alpha ?? 1;
  skin.drawBlock(context, x * size, y * size, size, COLORS[colorIndex]);
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
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
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

restartBtn.addEventListener('click', init);

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
  // la grilla lee --grid-line del CSS: redibujar si el juego está detenido
  if (current) draw();
});

// ---- Selector de skin ----
const skinSelect = document.getElementById('skin-select');

for (const [key, def] of Object.entries(SKINS)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = def.label;
  skinSelect.appendChild(opt);
}

function applySkin(key) {
  if (!SKINS[key]) key = DEFAULT_SKIN;
  for (const k of Object.keys(SKINS)) document.body.classList.remove(`skin-${k}`);
  document.body.classList.add(`skin-${key}`);
  skinKey = key;
  skin = SKINS[key];
  COLORS = skin.colors;
  skinSelect.value = key;
  // redibujar ya (necesario si el juego está en pausa o terminado)
  if (current) draw();
  if (next) drawNext();
}

applySkin(localStorage.getItem('tetris-skin'));

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  localStorage.setItem('tetris-skin', skinKey);
  skinSelect.blur(); // devolver el foco al juego: si no, las flechas cambian el skin
});

init();
