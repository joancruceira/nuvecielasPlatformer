// ═══════════════════════════════════════════════════════
//  AUDIO.JS — Música de fondo por nivel
//  Cargá este archivo antes de engine.js.
//
//  Uso:
//    Audio.play(levelIdx)  → inicia música del nivel
//    Audio.stop()          → para la música
//    Audio.pause()         → pausa
//    Audio.resume()        → reanuda
//    Audio.setVolume(0-1)  → cambia volumen
// ═══════════════════════════════════════════════════════

const AudioManager = (() => {

  // ── Tracks por nivel ─────────────────────────────────
  // Agregá más tracks acá cuando tengas música para otros niveles
  const TRACKS = {
    0: 'audio/cancion_nuve.mp3',   // Nivel 1 — Bosque Mágico
    // 1: 'audio/castillo.mp3',    // Nivel 2 (futuro)
    // 2: 'audio/sendero.mp3',     // Nivel 3 (futuro)
  };

  let _current   = null;   // HTMLAudioElement activo
  let _levelIdx  = -1;
  let _volume    = 0.55;
  let _muted     = false;
  let _fadeTick  = null;

  // ── Fade out y luego callback ─────────────────────────
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

  // ── Play ──────────────────────────────────────────────
  function play(levelIdx) {
    const src = TRACKS[levelIdx];

    // Mismo nivel ya sonando — no reiniciar
    if (_levelIdx === levelIdx && _current && !_current.paused) return;

    _fadeOut(_current, () => {
      if (!src) { _current = null; _levelIdx = -1; return; }

      const audio      = new Audio(src);
      audio.loop       = true;
      audio.volume     = 0;        // arranca en 0 para fade in
      audio.preload    = 'auto';

      audio.play().catch(() => {
        // Autoplay bloqueado — esperar interacción del usuario
        const unlock = () => {
          audio.play().catch(() => {});
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown',     unlock);
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown',     unlock, { once: true });
      });

      _current  = audio;
      _levelIdx = levelIdx;

      // Fade in
      clearInterval(_fadeTick);
      _fadeTick = setInterval(() => {
        const target = _muted ? 0 : _volume;
        _current.volume = Math.min(target, _current.volume + 0.03);
        if (_current.volume >= target) clearInterval(_fadeTick);
      }, 40);
    });
  }

  function stop() {
    _fadeOut(_current, () => { _current = null; _levelIdx = -1; });
  }

  function pause() {
    if (_current && !_current.paused) _current.pause();
  }

  function resume() {
    if (_current && _current.paused) _current.play().catch(() => {});
  }

  function setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (_current && !_muted) _current.volume = _volume;
  }

  function toggleMute() {
    _muted = !_muted;
    if (_current) _current.volume = _muted ? 0 : _volume;
    return _muted;
  }

  function isMuted() { return _muted; }

  return { play, stop, pause, resume, setVolume, toggleMute, isMuted };

})();