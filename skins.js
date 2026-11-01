'use strict';

/*
 * Skins / temas visuales.
 * Cada skin = { label, colors[9], bg, grid, drawBlock(ctx, x, y, colorIndex, size, alpha) }
 *  - colors: null + 8 colores de pieza (índices 1–8). Retro usa null → COLORS de game.js.
 *  - drawBlock: null = usar el drawBlock por defecto de game.js (estilo original).
 *  - bg / grid: null = seguir las variables CSS del tema claro/oscuro;
 *               string = color fijo; { dark, light } = color según el modo.
 * Expone window.Skins; game.js delega en él el dibujado de bloques y rejilla.
 */
(function () {
  const STORAGE_KEY = 'tetris-skin';
  const DEFAULT_SKIN = 'retro';

  // Mezcla un color hex (#rrggbb) con blanco (amt > 0) o negro (amt < 0).
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const target = amt < 0 ? 0 : 255;
    const t = Math.abs(amt);
    const mix = v => Math.round(v + (target - v) * t);
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return `rgb(${r},${g},${b})`;
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- Retro: estilo original; delega en COLORS + drawBlock de game.js ----
  const retro = {
    label: 'Retro',
    colors: null,
    bg: null,
    grid: null,
    drawBlock: null,
  };

  // ---- Neon: fondo negro, brillo con shadowBlur ----
  const neonColors = [
    null,
    '#00f0ff', '#fff200', '#d000ff', '#39ff14',
    '#ff073a', '#1f8bff', '#ff8c00', '#e0e0e0',
  ];

  const neon = {
    label: 'Neon',
    colors: neonColors,
    bg: '#000000',
    grid: '#0b1622',
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      const px = x * size + 3, py = y * size + 3, s = size - 6;
      ctx.save();
      ctx.globalAlpha = alpha ?? 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, s, s);
      ctx.fillStyle = color;
      ctx.globalAlpha = (alpha ?? 1) * 0.35;
      ctx.fillRect(px, py, s, s);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = (alpha ?? 1) * 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + s * 0.3, py + s * 0.3, s * 0.4, s * 0.4);
      ctx.restore();
    },
  };

  // ---- Pastel: colores suaves, bordes redondeados (arcTo) ----
  const pastelColors = [
    null,
    '#a8e6ef', '#fff1a8', '#d7b8f3', '#b8e6b8',
    '#f7b2b2', '#b8d4f7', '#ffd3a8', '#cfcfd6',
  ];
  const pastelBorders = pastelColors.map(c => (c ? shade(c, -0.18) : null));

  const pastel = {
    label: 'Pastel',
    colors: pastelColors,
    bg: { dark: '#272333', light: '#fbf7f2' },
    grid: { dark: '#322d40', light: '#ece4da' },
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const px = x * size + 2, py = y * size + 2, s = size - 4;
      const r = size * 0.25;
      ctx.globalAlpha = alpha ?? 1;
      roundedRectPath(ctx, px, py, s, s, r);
      ctx.fillStyle = this.colors[colorIndex];
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = pastelBorders[colorIndex];
      ctx.stroke();
      // brillo suave superior
      roundedRectPath(ctx, px + s * 0.18, py + s * 0.14, s * 0.64, s * 0.22, s * 0.11);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  };

  // ---- Pixel art: relleno base + textura de píxeles (bisel + tramado) ----
  const pixelColors = [
    null,
    '#3cbcfc', '#f8d878', '#b853f8', '#58d854',
    '#f83800', '#0078f8', '#fca044', '#a4a4a4',
  ];
  const pixelLight = pixelColors.map(c => (c ? shade(c, 0.5) : null));
  const pixelDark = pixelColors.map(c => (c ? shade(c, -0.45) : null));

  const pixel = {
    label: 'Pixel art',
    colors: pixelColors,
    bg: { dark: '#12122a', light: '#d8d4bc' },
    grid: { dark: '#1d1d3a', light: '#c4bfa4' },
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const p = Math.max(2, Math.floor(size / 8)); // tamaño de "píxel"
      const n = Math.floor(size / p);               // píxeles por lado
      const ox = x * size + Math.floor((size - n * p) / 2);
      const oy = y * size + Math.floor((size - n * p) / 2);
      ctx.globalAlpha = alpha ?? 1;
      // contorno oscuro + base
      ctx.fillStyle = pixelDark[colorIndex];
      ctx.fillRect(ox, oy, n * p, n * p);
      ctx.fillStyle = this.colors[colorIndex];
      ctx.fillRect(ox + p, oy + p, (n - 2) * p, (n - 2) * p);
      // bisel claro arriba/izquierda
      ctx.fillStyle = pixelLight[colorIndex];
      ctx.fillRect(ox + p, oy + p, (n - 2) * p, p);
      ctx.fillRect(ox + p, oy + p, p, (n - 2) * p);
      // brillo de esquina
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 2 * p, oy + 2 * p, p, p);
      // tramado (dither) en la mitad inferior derecha
      ctx.fillStyle = pixelDark[colorIndex];
      for (let r = Math.floor(n / 2); r < n - 1; r++)
        for (let c = Math.floor(n / 2); c < n - 1; c++)
          if ((r + c) % 2 === 0) ctx.fillRect(ox + c * p, oy + r * p, p, p);
      ctx.globalAlpha = 1;
    },
  };

  const SKINS = { retro, neon, pastel, pixel };

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return Object.prototype.hasOwnProperty.call(SKINS, saved) ? saved : DEFAULT_SKIN;
    } catch (_) {
      return DEFAULT_SKIN;
    }
  }

  let currentName = load();
  const listeners = [];

  function byMode(value) {
    if (value == null || typeof value === 'string') return value;
    return document.body.classList.contains('light-mode') ? value.light : value.dark;
  }

  function cssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function applyBodyClass() {
    for (const name of Object.keys(SKINS)) document.body.classList.remove(`skin-${name}`);
    document.body.classList.add(`skin-${currentName}`);
  }

  function set(name) {
    if (!Object.prototype.hasOwnProperty.call(SKINS, name)) name = DEFAULT_SKIN;
    currentName = name;
    try { localStorage.setItem(STORAGE_KEY, name); } catch (_) { /* ignore */ }
    applyBodyClass();
    for (const fn of listeners) fn(SKINS[name], name);
  }

  // Selector de skin en el panel
  function initSelector() {
    const select = document.getElementById('skin-select');
    if (!select) return;
    select.value = currentName;
    select.addEventListener('change', () => {
      set(select.value);
      select.blur(); // devolver el foco al juego
    });
    // Evita que las teclas del juego cambien la opción del <select> enfocado;
    // el evento sigue burbujeando hasta el manejador del juego en document.
    const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyP', 'KeyX'];
    select.addEventListener('keydown', e => {
      if (GAME_KEYS.includes(e.code)) {
        e.preventDefault();
        select.blur();
      }
    });
  }

  applyBodyClass();
  initSelector();

  window.Skins = {
    list: () => Object.keys(SKINS).map(name => ({ name, label: SKINS[name].label })),
    current: () => SKINS[currentName],
    currentName: () => currentName,
    set,
    onChange(fn) { listeners.push(fn); },
    // Devuelve true si la skin dibujó el bloque; false = usar el dibujado por defecto.
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      const skin = SKINS[currentName];
      if (!skin.drawBlock) return false;
      skin.drawBlock(ctx, x, y, colorIndex, size, alpha);
      return true;
    },
    // Color de fondo del canvas (null = transparente, usa --canvas-bg del CSS)
    background: () => byMode(SKINS[currentName].bg),
    gridColor: () => byMode(SKINS[currentName].grid) || cssVar('--grid-line'),
  };
})();
