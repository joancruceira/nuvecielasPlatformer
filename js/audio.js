// ═══════════════════════════════════════════════════════
//  AUDIO.JS — Música de fondo + efectos de sonido
// ═══════════════════════════════════════════════════════

const AudioManager = (() => {

  // ── Música por nivel ──────────────────────────────────
  const TRACKS = {
    menu: 'audio/nuvecielas_portada.mp3',
    0:    'audio/CANCION_NUVE.mp3',
    2:    'audio/sendero_nocturno.mp3',
  };

  // ── Efectos de sonido ─────────────────────────────────
  const SFX = {
    grab_star:    'audio/grab_star.mp3',
    giftbox_open: 'audio/giftbox_open.mp3',
    get_tree:     'audio/get_tree.mp3',
    game_over:    'audio/game_over.mp3',
    lunaria_shoot:'audio/lunaria_shoot.mp3',
    death_enemy:  'audio/death_enemy.mp3',
    death_boss:   'audio/death_boss.mp3',
    hit_boss:     'audio/hit_boss.mp3',
    flag_point:   'audio/flag_point.mp3',
  };

  // Pre-cargar efectos en cache
  const _sfxCache = {};
  function _preloadSfx() {
    for (const [key, src] of Object.entries(SFX)) {
      const a = new Audio(src);
      a.preload = 'auto';
      _sfxCache[key] = a;
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
    const src = SFX[key];
    if (!src) return;
    // Clonar para poder solapar sonidos iguales
    const a = new Audio(src);
    a.volume = _sfxVolume;
    a.play().catch(() => {});
  }

  // ── Estado de música ──────────────────────────────────
  let _current     = null;
  let _currentKey  = null;
  let _volume      = 0.50;
  let _sfxVolume   = 0.75;
  let _muted       = false;
  let _fadeTick    = null;

  function _fadeOut(el, cb) {
    if (!el) { cb && cb(); return; }
    clearInterval(_fadeTick);
    _fadeTick = setInterval(() => {
      el.volume = Math.max(0, el.volume - 0.05);
      if (el.volume <= 0) {
        clearInterval(_fadeTick);
        el.pause();
        el.currentTime = 0;
        cb && cb();
      }
    }, 40);
  }

  function _startTrack(key) {
    const src = TRACKS[key];
    if (!src) { _current = null; _currentKey = null; return; }

    const audio      = new Audio(src);
    audio.loop       = true;
    audio.volume     = 0;
    audio.preload    = 'auto';

    audio.play().catch(() => {
      const unlock = () => {
        audio.play().catch(() => {});
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown',     unlock);
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown',     unlock, { once: true });
    });

    _current    = audio;
    _currentKey = key;

    // Fade in
    clearInterval(_fadeTick);
    _fadeTick = setInterval(() => {
      const target = _muted ? 0 : _volume;
      if (!_current) { clearInterval(_fadeTick); return; }
      _current.volume = Math.min(target, _current.volume + 0.03);
      if (_current.volume >= target) clearInterval(_fadeTick);
    }, 40);
  }

  // ── API pública ───────────────────────────────────────

  function playMenu() {
    if (_currentKey === 'menu') return;
    _fadeOut(_current, () => _startTrack('menu'));
  }

  function play(levelIdx) {
    const key = levelIdx;
    if (_currentKey === key && _current && !_current.paused) return;
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
    if (_current) _current.volume = _muted ? 0 : _volume;
    return _muted;
  }

  return { play, playMenu, stop, pause, resume, setVolume, toggleMute, sfx };

})();