// ═══════════════════════════════════════════════════════
//  ENGINE_INPUT.JS — Input del juego principal
//  Depende de: engine.js (usa EngineState y EngineActions)
//
//  Responsabilidades:
//  - Teclado (keydown / keyup)
//  - Controles móviles (botones HUD)
//  - Canvas touch (doble tap para saltar, tap para moverse)
//  - Doble tap de dirección → disparo
//  - Orientación / resize
//
//  Expone: EngineInput.setup(input)
//  El objeto `input` es el mismo que usa engine.js internamente.
// ═══════════════════════════════════════════════════════

const EngineInput = (() => {

  const _keys   = {};
  const _dirTap = { dir: '', time: 0 };
  const DIR_TAP_MS = 320;

  let _input = null;   // referencia al objeto input del engine

  // ── Doble tap de dirección → disparo ─────────────────
  function _handleDirTap(dir) {
    const now = performance.now();
    if (_dirTap.dir === dir && now - _dirTap.time < DIR_TAP_MS) {
      const cid = Player.getState().charId;
      if (cid === 'nuveciela') Player.tryFireball();
      else                     Player.tryProjectile();
      _dirTap.dir  = '';
      _dirTap.time = 0;
    } else {
      _dirTap.dir  = dir;
      _dirTap.time = now;
    }
  }

  // ── Teclado ───────────────────────────────────────────

  // ¿Hay una submisión en curso? Mientras la haya, el input del juego
  // principal debe callarse por completo: el subnivel tiene sus propios
  // listeners. Si no, ↓/↑ pulsados dentro del subnivel quedan "pegados" en
  // `_input` y al volver el jugador salta solo o re-entra a la puerta.
  function _subLevelActive() {
    return SubMision.isActive() ||
           (typeof SubMisionNatan !== 'undefined' && SubMisionNatan.isActive());
  }

  function _setupKeyboard() {
    window.addEventListener('keydown', e => {
      // SubMisión captura sus propias teclas primero
      if (SubMision.isActive()) {
        SubMision.handleKeyForSubMision(e.key);
        return;
      }
      // SubMisión Natan gestiona su propio teclado (document-level).
      // No consumir el evento acá ni tocar `_input`, ni pausar el engine.
      if (typeof SubMisionNatan !== 'undefined' && SubMisionNatan.isActive()) return;

      if (e.repeat) return;
      _keys[e.key] = true;

      const { running, paused } = EngineState;

      // Pausa — funciona aunque el juego no esté activo
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (running) EngineActions.togglePause();
        return;
      }
      if (!running || paused) return;

      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') { _input.left  = true; _handleDirTap('left');  }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { _input.right = true; _handleDirTap('right'); }
      if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') { _input.down  = true; }
      if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W' ||
          e.key === 'z'          || e.key === 'Z' || e.key === ' ') {
        // Cap: sin esto, machacar el botón acumula saltos que se ejecutan
        // uno por frame más tarde y el personaje salta solo.
        _input.jumpPressed = Math.min(_input.jumpPressed + 1, 2);
        _input.jumpHeld    = true;
      }
    });

    window.addEventListener('keyup', e => {
      if (_subLevelActive()) return;
      _keys[e.key] = false;
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') _input.left  = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') _input.right = false;
      if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') _input.down  = false;
      if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W' ||
          e.key === 'z'          || e.key === 'Z' || e.key === ' ') {
        _input.jumpHeld = false;
      }
    });
  }

  // ── Controles móviles (botones HUD) ───────────────────
  function _setupMobileControls() {

    // Buffer anti-miss del doble salto
    let _jumpBuffer     = 0;
    let _jumpBufferUsed = false;
    const JUMP_BUFFER_MS = 140;

    function bindBtn(id, onDown, onUp) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        btn.setPointerCapture(ev.pointerId);
        btn.classList.add('pressed');
        onDown();
      }, { passive: false });
      btn.addEventListener('pointerup', ev => {
        ev.preventDefault();
        btn.classList.remove('pressed');
        onUp();
      }, { passive: false });
      btn.addEventListener('pointercancel', () => {
        btn.classList.remove('pressed');
        onUp();
      });
    }

    bindBtn('mcLeft',  () => _input.left  = true,  () => _input.left  = false);
    bindBtn('mcRight', () => _input.right = true,  () => _input.right = false);
    bindBtn('mcDown',  () => _input.down  = true,  () => _input.down  = false);

    // ── Botón salto ───────────────────────────────────────
    // Cada pointerdown = un salto. Simple y confiable.
    // El engine consume jumpPressed en el frame, lo resetea,
    // y el siguiente toque del dedo genera otro jumpPressed.
    const jumpBtn = document.getElementById('mcJump');
    if (jumpBtn) {
      jumpBtn.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        jumpBtn.setPointerCapture(ev.pointerId);
        jumpBtn.classList.add('pressed');
        // Cada toque es un salto — el engine decide si es primero o doble
        // Cap: sin esto, machacar el botón acumula saltos que se ejecutan
        // uno por frame más tarde y el personaje salta solo.
        _input.jumpPressed = Math.min(_input.jumpPressed + 1, 2);
        _input.jumpHeld    = true;
      }, { passive: false });

      jumpBtn.addEventListener('pointerup', ev => {
        ev.preventDefault();
        jumpBtn.classList.remove('pressed');
        _input.jumpHeld = false;
      }, { passive: false });

      jumpBtn.addEventListener('pointercancel', () => {
        jumpBtn.classList.remove('pressed');
        _input.jumpHeld = false;
      });
    }

    // Botón de fuego — dispara según el personaje
    const fireBtn = document.getElementById('mcFire');
    if (fireBtn) {
      fireBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        fireBtn.setPointerCapture(e.pointerId);
        fireBtn.classList.add('pressed');
        const cid = Player.getState().charId;
        if (cid === 'nuveciela') Player.tryFireball();
        else                     Player.tryProjectile();
      }, { passive: false });
      fireBtn.addEventListener('pointerup',     () => fireBtn.classList.remove('pressed'));
      fireBtn.addEventListener('pointercancel', () => fireBtn.classList.remove('pressed'));
    }
  }

  // ── Canvas touch (sin botones HUD) ────────────────────
  // Tap izquierda/derecha → moverse
  // Doble tap mismo lado → saltar
  function _setupCanvasTouch() {
    const canvasEl = document.getElementById('gameCanvas');
    if (!canvasEl) return;

    let lastTapTime = 0, lastTapSide = '';

    canvasEl.addEventListener('pointerdown', ev => {
      if (!EngineState.running || EngineState.paused) return;
      // Si los controles HUD están visibles, no usar canvas touch
      const controls = document.getElementById('mobileControls');
      if (controls && getComputedStyle(controls).display !== 'none') return;

      const side = ev.clientX < window.innerWidth / 2 ? 'left' : 'right';
      const now  = performance.now();

      if (side === lastTapSide && now - lastTapTime < 300) {
        // Doble tap → saltar
        _input.jumpPressed = true;
        _input.jumpHeld    = true;
        setTimeout(() => { _input.jumpHeld = false; }, 200);
        lastTapTime = 0;
      } else {
        // Tap simple → mover
        if (side === 'left') {
          _input.left = true;
          canvasEl.addEventListener('pointerup', () => { _input.left = false; }, { once: true });
        } else {
          _input.right = true;
          canvasEl.addEventListener('pointerup', () => { _input.right = false; }, { once: true });
        }
        lastTapTime = now;
        lastTapSide = side;
      }
    }, { passive: true });
  }

  // ── Resize / orientación ──────────────────────────────
  function _setupOrientationHandler() {
    const handleResize = () => Renderer.resize();
    window.addEventListener('resize', handleResize);
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleResize);
    } else {
      window.addEventListener('orientationchange', () => setTimeout(handleResize, 120));
    }
  }

  // ── API pública ───────────────────────────────────────
  function setup(inputRef) {
    _input = inputRef;
    _setupKeyboard();
    _setupMobileControls();
    _setupCanvasTouch();
    _setupOrientationHandler();
  }

  function reset() {
    if (!_input) return;
    _input.left = _input.right = _input.down = false;
    _input.jumpPressed = 0;
    _input.jumpHeld    = false;
  }

  return { setup, reset };

})();