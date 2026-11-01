'use strict';

// Menú de pausa: Reanudar, Reiniciar, Ver controles y Nivel inicial.
// Se carga antes de game.js y expone window.PauseMenu.
window.PauseMenu = (function () {
  const STORAGE_KEY = 'tetris-start-level';
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;

  let menuEl, itemEls, controlsEl, controlsBtn, levelValueEl;
  let handlers = { onResume() {}, onRestart() {} };
  let open = false;
  let selected = 0;
  // Tras reanudar, ignorar autorrepetición de teclas mantenidas hasta soltarlas.
  let suppressRepeat = false;

  function clampLevel(n) {
    n = parseInt(n, 10);
    if (!Number.isFinite(n)) return MIN_LEVEL;
    return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, n));
  }

  function getStartLevel() {
    try {
      return clampLevel(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return MIN_LEVEL;
    }
  }

  function setStartLevel(n) {
    const lvl = clampLevel(n);
    try { localStorage.setItem(STORAGE_KEY, String(lvl)); } catch (_) { /* sin almacenamiento */ }
    if (levelValueEl) levelValueEl.textContent = lvl;
    return lvl;
  }

  function changeLevel(delta) {
    let lvl = getStartLevel() + delta;
    if (lvl > MAX_LEVEL) lvl = MIN_LEVEL;
    if (lvl < MIN_LEVEL) lvl = MAX_LEVEL;
    setStartLevel(lvl);
  }

  function select(i) {
    selected = (i + itemEls.length) % itemEls.length;
    itemEls.forEach((el, idx) => el.classList.toggle('selected', idx === selected));
    itemEls[selected].focus({ preventScroll: true });
  }

  function toggleControls(force) {
    const show = typeof force === 'boolean' ? force : controlsEl.hidden;
    controlsEl.hidden = !show;
    controlsBtn.setAttribute('aria-expanded', String(show));
  }

  function activate(action) {
    switch (action) {
      case 'resume': handlers.onResume(); break;
      case 'restart': handlers.onRestart(); break;
      case 'controls': toggleControls(); break;
      case 'level': changeLevel(1); break;
    }
  }

  function show() {
    if (!menuEl) return;
    open = true;
    toggleControls(false);
    levelValueEl.textContent = getStartLevel();
    menuEl.classList.remove('hidden');
    select(0);
  }

  function hide() {
    if (!menuEl) return;
    const wasOpen = open;
    open = false;
    menuEl.classList.add('hidden');
    if (menuEl.contains(document.activeElement)) document.activeElement.blur();
    if (wasOpen) suppressRepeat = true;
  }

  // Maneja una tecla mientras el menú está abierto. Siempre la consume.
  function handleKey(e) {
    switch (e.code) {
      case 'ArrowUp':
        select(selected - 1);
        break;
      case 'ArrowDown':
        select(selected + 1);
        break;
      case 'ArrowLeft':
        if (itemEls[selected].dataset.action === 'level') changeLevel(-1);
        break;
      case 'ArrowRight':
        if (itemEls[selected].dataset.action === 'level') changeLevel(1);
        break;
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        if (!e.repeat) activate(itemEls[selected].dataset.action);
        break;
      case 'Tab':
        select(selected + (e.shiftKey ? -1 : 1));
        break;
      default:
        return true;
    }
    e.preventDefault();
    return true;
  }

  // ¿Debe ignorarse esta tecla para el juego? (autorrepetición tras reanudar)
  function shouldSuppress(e) {
    return suppressRepeat && e.repeat;
  }

  function setup(opts) {
    handlers = Object.assign(handlers, opts || {});
    menuEl = document.getElementById('pause-menu');
    if (!menuEl) return;
    itemEls = Array.from(menuEl.querySelectorAll('.pm-item'));
    controlsEl = document.getElementById('pm-controls');
    controlsBtn = menuEl.querySelector('[data-action="controls"]');
    levelValueEl = document.getElementById('pm-level-value');
    levelValueEl.textContent = getStartLevel();

    itemEls.forEach((el, idx) => {
      el.addEventListener('mouseenter', () => select(idx));
      el.addEventListener('click', e => {
        if (e.target.closest('.pm-level-btn')) return;
        select(idx);
        activate(el.dataset.action);
      });
    });
    menuEl.querySelectorAll('.pm-level-btn').forEach(btn => {
      btn.addEventListener('click', () => changeLevel(Number(btn.dataset.delta)));
    });
    document.addEventListener('keyup', () => { suppressRepeat = false; });
  }

  return {
    setup,
    show,
    hide,
    isOpen: () => open,
    handleKey,
    shouldSuppress,
    getStartLevel,
    setStartLevel,
  };
})();
