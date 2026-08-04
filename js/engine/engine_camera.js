// ═══════════════════════════════════════════════════════
//  ENGINE_CAMERA.JS — Cámara del juego principal
//  Sin dependencias. Cargar ANTES del renderer.
//
//  Sustituye al viejo bloque de 10 líneas del engine, que tenía
//  cuatro problemas de sensación:
//    · sin dead zone   → cada micro-corrección movía la imagen (mareo)
//    · sin look-ahead  → corriendo veías lo mismo adelante que atrás
//    · `v += (t-v)*k*dt` → NO es independiente del frame-rate: a 144 Hz
//      la cámara iba más rápida que a 60 Hz
//    · sin redondeo    → los tiles usaban Math.floor y los sprites no,
//      así que el mundo temblaba medio píxel contra sí mismo (shimmer)
//
//  El estado público `cam` expone SIEMPRE valores enteros listos para
//  dibujar (posición + shake). La posición real vive en _x/_y.
// ═══════════════════════════════════════════════════════

const EngineCamera = (() => {

  const CFG = {
    // La dead zone sólo tiene que matar el micro-temblor: si es grande, la
    // cámara queda permanentemente retrasada y se come el look-ahead
    // (con 90 px el adelanto neto quedaba en 60 de los 150 pedidos).
    deadZoneX:    32,
    deadZoneY:    56,
    anchorX:      0.42,  // dónde vive el jugador en pantalla
    anchorY:      0.55,
    lookAhead:    180,   // px de adelanto a velocidad de crucero
    lookAheadRef: 280,   // velocidad a la que el adelanto es máximo
    lookAheadK:   2.6,   // suavizado del propio adelanto (evita latigazos al girar)
    smoothX:      7,
    smoothY:      6,
    smoothYFall:  12,    // cayendo, la cámara se pega para ver dónde aterrizás
    fallVy:       420,   // vy a partir del cual "está cayendo"
    fallBias:     70,    // px que baja el foco al caer
    maxShake:     28,
  };

  // Posición real (float) y estado del shake
  let _x = 0, _y = 0, _ahead = 0;
  let _shakeMag = 0, _shakeTime = 0, _shakeDur = 0, _shakeX = 0, _shakeY = 0;

  // Lo que lee el renderer: enteros, con shake ya sumado
  const cam = { x: 0, y: 0 };

  // Suavizado exponencial: da EL MISMO resultado a 30, 60 o 144 Hz.
  const damp = (cur, target, k, dt) => target + (cur - target) * Math.exp(-k * dt);

  function _focus(ps, W, H, dt) {
    // Adelanto proporcional a la velocidad, suavizado aparte
    const ratio = Math.max(-1, Math.min(1, ps.vx / CFG.lookAheadRef));
    _ahead = damp(_ahead, ratio * CFG.lookAhead, CFG.lookAheadK, dt);

    const falling = ps.vy > CFG.fallVy;
    return {
      x: ps.x + ps.w / 2 + _ahead - W * CFG.anchorX,
      y: ps.y + ps.h / 2 + (falling ? CFG.fallBias : 0) - H * CFG.anchorY,
      falling,
    };
  }

  // Dead zone: la cámara sólo empieza a seguir cuando el objetivo
  // se aleja más de `dz` de donde está.
  function _applyDeadZone(actual, deseado, dz) {
    const d = deseado - actual;
    if (d >  dz) return deseado - dz;
    if (d < -dz) return deseado + dz;
    return actual;
  }

  function _clampToMap(W, H, mapW, mapH) {
    _x = Math.max(0, Math.min(_x, Math.max(0, mapW - W)));
    _y = Math.max(0, Math.min(_y, Math.max(0, mapH - H)));
  }

  function _publish() {
    cam.x = Math.round(_x + _shakeX);
    cam.y = Math.round(_y + _shakeY);
  }

  // ── API ───────────────────────────────────────────────

  function update(dt, ps, W, H, mapW, mapH) {
    if (!W || !H) return;

    const f  = _focus(ps, W, H, dt);
    const tx = _applyDeadZone(_x, f.x, CFG.deadZoneX);
    const ty = _applyDeadZone(_y, f.y, CFG.deadZoneY);

    _x = damp(_x, tx, CFG.smoothX, dt);
    _y = damp(_y, ty, f.falling ? CFG.smoothYFall : CFG.smoothY, dt);

    _clampToMap(W, H, mapW, mapH);
    _updateShake(dt);
    _publish();
  }

  /** Coloca la cámara sobre el jugador sin interpolar (carga de nivel, respawn). */
  function snapTo(ps, W, H, mapW, mapH) {
    _ahead = 0;
    _shakeMag = _shakeTime = _shakeX = _shakeY = 0;
    if (W && H) {
      _x = ps.x + ps.w / 2 - W * CFG.anchorX;
      _y = ps.y + ps.h / 2 - H * CFG.anchorY;
      _clampToMap(W, H, mapW, mapH);
    } else {
      _x = 0; _y = 0;
    }
    _publish();
  }

  function reset() { _x = 0; _y = 0; _ahead = 0; _shakeMag = _shakeTime = _shakeX = _shakeY = 0; _publish(); }

  /**
   * Sacudida de pantalla. Se aplica SÓLO al render: no toca la física
   * ni las colisiones.
   * @param {number} mag amplitud en px
   * @param {number} dur duración en segundos
   */
  function shake(mag, dur = 0.2) {
    mag = Math.min(mag, CFG.maxShake);
    // Una sacudida nueva no corta a una más fuerte que siga viva
    if (_shakeTime > 0 && mag < _shakeMag * (_shakeTime / _shakeDur)) return;
    _shakeMag = mag; _shakeTime = dur; _shakeDur = dur;

    // En el teléfono, el golpe además se siente. La duración sale de la
    // intensidad del shake, así que pisar un enemigo (5) hace un toquecito
    // y el jefe derrotado (18) una vibración clara. Sin API disponible o en
    // desktop, esto no hace nada.
    if (navigator.vibrate) navigator.vibrate(Math.round(6 + mag * 1.6));
  }

  function _updateShake(dt) {
    if (_shakeTime <= 0) { _shakeX = _shakeY = 0; return; }
    _shakeTime -= dt;
    const t = Math.max(0, _shakeTime / _shakeDur);
    const m = _shakeMag * t * t;                 // ease-out cuadrático
    _shakeX = (Math.random() * 2 - 1) * m;
    _shakeY = (Math.random() * 2 - 1) * m;
  }

  return { cam, update, snapTo, reset, shake, CFG };

})();
