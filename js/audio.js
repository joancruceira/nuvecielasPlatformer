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

  // ── Efectos: Web Audio, no elementos <audio> ──────────
  //
  // Historia de este bloque, porque importa:
  //   1) Al principio sfx() hacía `new Audio(src)` en CADA llamada. Veinte
  //      estrellas = veinte elementos que el GC recogía tarde.
  //   2) Lo cambié por un pool de 4 voces por efecto. Peor: pasó de 11 a 38
  //      elementos <audio>, TODOS creados de golpe en el primer toque, justo
  //      cuando arranca la música. Eso satura el pipeline de medios del
  //      navegador y produce cortes audibles.
  //   3) Esto: un solo AudioContext y un AudioBuffer decodificado por efecto.
  //      Cero elementos <audio>, cero contención de decodificadores, latencia
  //      mínima y polifonía ilimitada. Es como se hace el audio de un juego.
  //
  // Si el navegador no tiene Web Audio, cae al método viejo.

  let _ctx        = null;   // AudioContext compartido (música incluida)
  const _buffers  = {};     // key → AudioBuffer
  let _sfxReady   = false;

  function _getCtx() {
    if (_ctx) return _ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { _ctx = new AC(); } catch (e) { _ctx = null; }
    return _ctx;
  }

  async function _preloadSfx() {
    const ctx = _getCtx();
    if (!ctx) return;
    // En serie a propósito: nueve descargas de pocos KB no justifican
    // saturar la red ni el decodificador mientras arranca la música.
    for (const [key, src] of Object.entries(SFX)) {
      try {
        const datos = await (await fetch(src)).arrayBuffer();
        _buffers[key] = await ctx.decodeAudioData(datos);
      } catch (e) { /* si uno falla, el resto sigue */ }
    }
  }

  // Cargar al primer gesto del usuario (evita bloqueo autoplay)
  function _ensureSfx() {
    if (_sfxReady) return;
    _sfxReady = true;
    const ctx = _getCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    _preloadSfx();
  }
  window.addEventListener('pointerdown', _ensureSfx, { once: true });
  window.addEventListener('keydown',     _ensureSfx, { once: true });

  // ── Reproducir efecto ─────────────────────────────────
  function sfx(key) {
    if (_muted) return;
    const ctx = _ctx;
    const buf = _buffers[key];

    if (ctx && buf) {
      // BufferSource es de un solo uso y el navegador lo libera al terminar.
      const fuente = ctx.createBufferSource();
      const gan    = ctx.createGain();
      fuente.buffer = buf;
      gan.gain.value = _sfxVolume;
      fuente.connect(gan).connect(ctx.destination);
      fuente.start();
      return;
    }

    // Respaldo para navegadores sin Web Audio
    const src = SFX[key];
    if (!src) return;
    const a = new Audio(src);
    a.volume = _sfxVolume;
    a.play().catch(() => {});
  }

  // ── Estado de música ──────────────────────────────────
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

    // Resumir el AudioContext compartido (los navegadores móviles lo crean
    // suspendido). Antes acá se creaba un contexto de PRUEBA sólo para
    // resumirlo y cerrarlo 100 ms después: no servía de nada, porque el que
    // hacía falta resumir era el que realmente reproduce.
    const ctx = _getCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});

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

  // ── Reproductor de música: UN SOLO elemento reutilizado ──
  //
  // Antes cada cambio de track hacía `new Audio(src)`. En el escritorio no se
  // nota, pero en el teléfono es el origen del "la canción del inicio se cuela
  // en el nivel 1": el elemento del menú nace durante el toque del usuario y
  // queda habilitado, mientras que el del nivel nace 400 ms después dentro de
  // un setInterval, sin gesto detrás. El navegador lo trata distinto, y con
  // dos elementos en juego cualquier fallo deja al viejo sonando.
  //
  // Ahora hay un único <audio> creado en el primer gesto —y por lo tanto
  // habilitado para siempre—: cambiar de tema es cambiarle el `src`. Es
  // imposible que suenen dos temas a la vez porque hay uno solo.
  let _el       = null;    // el único elemento de música
  let _fadeId   = null;
  let _guardaId = null;

  function _getEl() {
    if (_el) return _el;
    _el = new Audio();
    _el.loop = true;
    _el.preload = 'auto';
    _el.volume = 0;
    return _el;
  }

  function _pararFades() {
    if (_fadeId)   { clearInterval(_fadeId);  _fadeId = null; }
    if (_guardaId) { clearTimeout(_guardaId); _guardaId = null; }
  }

  function _fadeA(destino, alTerminar) {
    _pararFades();
    const el = _getEl();
    const paso = destino > el.volume ? 0.05 : 0.07;
    _fadeId = setInterval(() => {
      const v = el.volume;
      el.volume = destino > v ? Math.min(destino, v + paso) : Math.max(destino, v - paso);
      if (Math.abs(el.volume - destino) < 0.001) {
        _pararFades();
        alTerminar && alTerminar();
      }
    }, 40);
    // Red de seguridad: si el intervalo se queda sin correr (pestaña de fondo,
    // carga pesada, throttling del móvil), forzamos el final igual. Sin esto
    // una transición a medias deja música sonando donde no corresponde.
    _guardaId = setTimeout(() => {
      _pararFades();
      el.volume = destino;
      alTerminar && alTerminar();
    }, 900);
  }

  function _startTrack(key) {
    const src = TRACKS[key];
    if (!src) { _currentKey = null; return; }

    // Si el navegador aún no desbloqueó el audio, encolar para después
    if (!_unlocked) { _pendingKey = key; return; }

    const el = _getEl();
    _currentKey = key;


    const arrancar = () => {
      // Ruta absoluta para comparar sin sorpresas de base URL
      const abs = new URL(src, location.href).href;
      if (el.src !== abs) { el.src = abs; }
      el.currentTime = 0;
      el.volume = 0;
      el.play().catch(() => {});
      _fadeA(_muted ? 0 : _volume);
    };

    // Si ya venía sonando otro tema, bajarlo antes de cambiar el src
    if (!el.paused && el.volume > 0.01) _fadeA(0, arrancar);
    else arrancar();
  }

  // ── API pública ───────────────────────────────────────

  // Un único punto de entrada: pedir un tema. Si ya es el que suena, no hace
  // nada; si no, cambia. Al haber un solo elemento no existe el estado
  // "dos temas a la vez".
  function _pedirTema(key) {
    if (_currentKey === key && _el && !_el.paused) return;
    if (!_unlocked) { _pendingKey = key; return; }
    if (!(key in TRACKS)) { stop(); return; }
    _startTrack(key);
  }

  function playMenu()        { _pedirTema('menu'); }
  function play(levelIdx)    { _pedirTema(levelIdx); }

  function stop() {
    _pararFades();
    _currentKey = null;
    _pendingKey = null;
    if (_el) { _el.pause(); _el.volume = 0; try { _el.currentTime = 0; } catch (e) {} }
  }

  function pause()  { if (_el && !_el.paused) _el.pause(); }
  function resume() {
    if (_el && _el.paused && _currentKey !== null) _el.play().catch(() => {});
  }

  function setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (_el && !_muted) _el.volume = _volume;
  }

  function toggleMute() {
    _muted = !_muted;
    try { localStorage.setItem('nuve_muted', _muted ? '1' : '0'); } catch (e) {}
    _pararFades();
    if (_el) _el.volume = _muted ? 0 : _volume;
    return _muted;
  }

  function isMuted() { return _muted; }

  return { play, playMenu, stop, pause, resume, setVolume, toggleMute, isMuted, sfx };

})();