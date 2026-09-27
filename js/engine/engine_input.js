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

    // ── Cruceta como ZONA, no como botones sueltos ────────
    //
    // Antes cada botón hacía setPointerCapture(pointerId): una vez que
    // apoyabas el dedo, TODOS los eventos iban a ese botón hasta levantarlo.
    // Si deslizabas el pulgar de ◀ a ▶ sin levantarlo —que es lo que hace
    // cualquiera, y más un chico— el botón de destino nunca recibía
    // pointerdown y el personaje se quedaba clavado.
    //
    // Ahora la captura la toma la ZONA y en cada pointermove se resuelve qué
    // botón está debajo del dedo. El Map por pointerId mantiene intacto el
    // multitáctil: podés estar yendo a la derecha con un pulgar y saltando
    // con el otro.
    function _setupCruceta() {
      const zona = document.querySelector('.mc-left');
      if (!zona) return;

      const BOTONES = [
        { id: 'mcLeft',  campo: 'left'  },
        { id: 'mcRight', campo: 'right' },
        { id: 'mcDown',  campo: 'down'  },
      ].map(b => ({ ...b, el: document.getElementById(b.id) })).filter(b => b.el);

      const activos = new Map();   // pointerId → botón

      // Radio generoso: el dedo tapa el botón, no lo ve.
      function bajoElDedo(x, y) {
        let mejor = null, mejorD = Infinity;
        for (const b of BOTONES) {
          const r = b.el.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const d = Math.hypot(x - cx, y - cy);
          if (d < r.width * 0.95 && d < mejorD) { mejor = b; mejorD = d; }
        }
        return mejor;
      }

      function aplicar(b, activo) {
        if (!b) return;
        b.el.classList.toggle('pressed', activo);
        _input[b.campo] = activo;
      }

      // Si dos dedos comparten un botón, no lo apagues hasta que se vayan los dos
      function sigueTocado(b) {
        for (const otro of activos.values()) if (otro === b) return true;
        return false;
      }

      zona.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        try { zona.setPointerCapture(ev.pointerId); } catch (e) {}
        const b = bajoElDedo(ev.clientX, ev.clientY);
        activos.set(ev.pointerId, b);
        aplicar(b, true);
      }, { passive: false });

      zona.addEventListener('pointermove', ev => {
        if (!activos.has(ev.pointerId)) return;
        const antes = activos.get(ev.pointerId);
        const ahora = bajoElDedo(ev.clientX, ev.clientY);
        if (antes === ahora) return;
        activos.set(ev.pointerId, ahora);
        if (antes && !sigueTocado(antes)) aplicar(antes, false);
        aplicar(ahora, true);
      }, { passive: false });

      function soltar(ev) {
        if (!activos.has(ev.pointerId)) return;
        const b = activos.get(ev.pointerId);
        activos.delete(ev.pointerId);
        if (b && !sigueTocado(b)) aplicar(b, false);
      }
      zona.addEventListener('pointerup',     soltar, { passive: false });
      zona.addEventListener('pointercancel', soltar);
      zona.addEventListener('lostpointercapture', soltar);
    }
    _setupCruceta();

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

  // ── Ciclo de vida en móvil ────────────────────────────
  // Bloquear el teléfono, atender una llamada o cambiar de app dejaba el juego
  // corriendo: volvías y te habían matado, o la música seguía sonando de fondo.
  // Ahora se pausa solo y suelta todas las teclas (que si no quedan "pegadas").
  function _setupLifecycle() {
    const pausarSiHaceFalta = () => {
      if (!document.hidden) return;
      reset();
      if (EngineState.running && !EngineState.paused) EngineActions.togglePause();
      else if (typeof AudioManager !== 'undefined') AudioManager.pause();
    };
    document.addEventListener('visibilitychange', pausarSiHaceFalta);
    window.addEventListener('pagehide', pausarSiHaceFalta);
    // Perder el foco (notificación, barra de tareas) también suelta las teclas
    window.addEventListener('blur', () => reset());
  }

  // ── API pública ───────────────────────────────────────
  function setup(inputRef) {
    _input = inputRef;
    _setupKeyboard();
    _setupMobileControls();
    _setupCanvasTouch();
    _setupOrientationHandler();
    _setupLifecycle();
  }

  function reset() {
    if (!_input) return;
    _input.left = _input.right = _input.down = false;
    _input.jumpPressed = 0;
    _input.jumpHeld    = false;
  }

  return { setup, reset };

})();