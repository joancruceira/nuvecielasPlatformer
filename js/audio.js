// ═══════════════════════════════════════════════════════
//  AUDIO.JS — Música de fondo + efectos de sonido
// ═══════════════════════════════════════════════════════

const AudioManager = (() => {

  // ── Música por nivel ──────────────────────────────────
  const TRACKS = {
    menu: 'audio/nuvecielas_portada.m4a',
    0:    'audio/cancion_nuve.m4a',         // FIX: el archivo real es minúsculas (servidores case-sensitive)
    1:    'audio/castillo_nuveciela.m4a',
    2:    'audio/sendero_nocturno.m4a',
    3:    'audio/castillo_nuveciela.m4a',   // Castillo de la Ciela — reutiliza tema de castillo (track propio = asset futuro)
    4:    'audio/cancion_nuve.m4a',         // Atravesando el Lago — reutiliza tema suave (track propio = asset futuro)
  };

  // ── Efectos de sonido ─────────────────────────────────
  const SFX = {
    grab_star:    'audio/grab_star.m4a',
    giftbox_open: 'audio/giftbox_open.m4a',
    get_tree:     'audio/get_tree.m4a',
    game_over:    'audio/game_over.m4a',
    lunaria_shoot:'audio/lunaria_shoot.m4a',
    death_enemy:  'audio/death_enemy.m4a',
    death_boss:   'audio/death_boss.m4a',
    hit_boss:     'audio/hit_boss.m4a',
    flag_point:   'audio/flag_point.m4a',
  };

  // Pool de efectos.
  //
  // Antes sfx() hacía `new Audio(src)` en CADA llamada: recoger veinte
  // estrellas creaba veinte elementos <audio> que el GC recogía tarde, y el
  // _sfxCache precargado no se usaba nunca para reproducir. Ahora cada efecto
  // tiene unas pocas voces que se reciclan por turnos, así que sigue pudiendo
  // solaparse consigo mismo sin crear objetos dentro del juego.
  const VOCES_POR_SFX = 4;
  const _sfxCache = {};   // key → { voces:[Audio], siguiente:int }

  function _preloadSfx() {
    for (const [key, src] of Object.entries(SFX)) {
      const voces = [];
      for (let i = 0; i < VOCES_POR_SFX; i++) {
        const a = new Audio(src);
        a.preload = 'auto';
        voces.push(a);
      }
      _sfxCache[key] = { voces, siguiente: 0 };
    }
  }
  // Cargar al primer gesto del usuario (evita bloqueo autoplay)
  let _sfxReady = false;
  function _ensureSfx() {
    if (_sfxReady) return;
    _sfxReady = true;
    _preloadSfx();
  }
  window.addEventListener('pointerdown', _ensureSfx, { once: true });
  window.addEventListener('keydown',     _ensureSfx, { once: true });

  // ── Reproducir efecto ─────────────────────────────────
  function sfx(key) {
    if (_muted) return;                 // no gastar decodificación si está silenciado
    const slot = _sfxCache[key];
    if (!slot) return;                  // todavía no se desbloqueó el audio
    const a = slot.voces[slot.siguiente];
    slot.siguiente = (slot.siguiente + 1) % slot.voces.length;
    a.volume = _sfxVolume;
    try { a.currentTime = 0; } catch (e) {}
    a.play().catch(() => {});
  }

  // ── Estado de música ──────────────────────────────────
  let _current     = null;
  let _currentKey  = null;
  let _pendingKey  = null;   // track esperando interacción del usuario
  let _unlocked    = false;  // el navegador ya permitió audio
  let _volume      = 0.50;
  let _sfxVolume   = 0.75;
  let _muted       = (() => { try { return localStorage.getItem('nuve_muted') === '1'; } catch (e) { return false; } })();

  // Al primer toque/tecla, desbloquear y arrancar el track pendiente
  function _onUnlock() {
    if (_unlocked) return;
    _unlocked = true;
    _ensureSfx();

    // Intentar resumir un AudioContext suspendido (mobile browsers)
    try {
      const testCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (testCtx.state === 'suspended') testCtx.resume().catch(() => {});
      // Cerrar el contexto de prueba para no desperdiciar recursos
      setTimeout(() => testCtx.close().catch(() => {}), 100);
    } catch(e) {}

    if (_pendingKey !== null) {
      const key = _pendingKey;
      _pendingKey = null;
      _startTrack(key);
    }

    // Limpiar todos los listeners de desbloqueo
    _unlockEvents.forEach(evt => {
      window.removeEventListener(evt, _onUnlock, true);
    });
  }

  // Registrar en múltiples eventos para máxima compatibilidad
  const _unlockEvents = ['pointerdown', 'keydown', 'click', 'touchend', 'touchstart', 'mousedown'];
  _unlockEvents.forEach(evt => {
    window.addEventListener(evt, _onUnlock, { once: false, capture: true });
  });

  // Fade-out.
  //
  // Antes el fade-in y el fade-out compartían una sola variable `_fadeTick`:
  // si se solapaban (por ejemplo playMenu() y play(0) casi juntos), uno
  // cancelaba el intervalo del otro y el <audio> viejo quedaba sonando para
  // siempre a volumen 0.x, sin pausarse nunca. Ahora cada elemento lleva su
  // propio intervalo y el fade-out SIEMPRE pausa, aunque lo cancelen.
  function _fadeOut(el, cb) {
    if (!el) { cb && cb(); return; }
    if (el._fadeId) clearInterval(el._fadeId);
    el._fadeId = setInterval(() => {
      el.volume = Math.max(0, el.volume - 0.05);
      if (el.volume <= 0) {
        clearInterval(el._fadeId); el._fadeId = null;
        el.pause();
        el.currentTime = 0;
        cb && cb();
      }
    }, 40);
  }

  function _startTrack(key) {
    const src = TRACKS[key];
    if (!src) { _current = null; _currentKey = null; return; }

    // Si el navegador aún no desbloqueó el audio, encolar para después
    if (!_unlocked) {
      _pendingKey = key;
      return;
    }

    const audio  = new Audio(src);
    audio.loop   = true;
    audio.volume = 0;
    audio.preload = 'auto';
    audio.play().catch(() => {});

    _current    = audio;
    _currentKey = key;

    // Fade in — con su propio intervalo, atado a este elemento
    if (audio._fadeId) clearInterval(audio._fadeId);
    audio._fadeId = setInterval(() => {
      const target = _muted ? 0 : _volume;
      if (_current !== audio) { clearInterval(audio._fadeId); audio._fadeId = null; return; }
      audio.volume = Math.min(target, audio.volume + 0.03);
      if (audio.volume >= target) { clearInterval(audio._fadeId); audio._fadeId = null; }
    }, 40);
  }

  // ── API pública ───────────────────────────────────────

  function playMenu() {
    if (_currentKey === 'menu' && _current && !_current.paused) return;
    if (!_unlocked) { _pendingKey = 'menu'; return; }
    _fadeOut(_current, () => _startTrack('menu'));
  }

  function play(levelIdx) {
    const key = levelIdx;
    if (_currentKey === key && _current && !_current.paused) return;
    if (!_unlocked) { _pendingKey = key; return; }
    // Si no hay track para este nivel, parar la música del menú
    if (!(key in TRACKS)) {
      if (_currentKey === 'menu') stop();
      return;
    }
    _fadeOut(_current, () => _startTrack(key));
  }

  function stop() {
    _fadeOut(_current, () => { _current = null; _currentKey = null; });
  }

  function pause()  { if (_current && !_current.paused) _current.pause(); }
  function resume() { if (_current && _current.paused)  _current.play().catch(() => {}); }

  function setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (_current && !_muted) _current.volume = _volume;
  }

  function toggleMute() {
    _muted = !_muted;
    try { localStorage.setItem('nuve_muted', _muted ? '1' : '0'); } catch (e) {}
    if (_current) _current.volume = _muted ? 0 : _volume;
    return _muted;
  }

  function isMuted() { return _muted; }

  return { play, playMenu, stop, pause, resume, setVolume, toggleMute, isMuted, sfx };

})();