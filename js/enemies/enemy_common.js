// ═══════════════════════════════════════════════════════
//  ENEMY_COMMON.JS — Lo que todos los enemigos hacen igual
//  Sin dependencias (salvo TILE). Cargar ANTES de los enemigos.
//
//  Cada enemigo nuevo traía su propia copia de gravedad, de patrulla, del
//  chequeo de "¿la imagen ya cargó?" y de la barra de vida. Se llegó a
//  NUEVE gravedades distintas. Eso no es sólo repetición: cuando aparece un
//  bug de física (los enemigos que caían para siempre, por ejemplo) hay que
//  arreglarlo nueve veces y en la práctica se arregla en una.
//
//  Acá vive una sola versión de cada cosa, parametrizada donde los enemigos
//  REALMENTE se diferencian, no donde se diferenciaban por accidente.
// ═══════════════════════════════════════════════════════

const EnemyCommon = (() => {

  const TS = 48;

  // ── ¿Hace falta simular este enemigo? ────────────────
  //
  // En el nivel 4 hay 22 enemigos y como mucho 3 entran en pantalla.
  // El criterio es la distancia al JUGADOR, no a la cámara: la cámara va
  // anclada a él, y `ps` ya llega a todos los update() sin tocar firmas.
  //
  // El viewport más ancho que dibujamos ronda los 1300 px de mundo, con el
  // jugador al 42%: ve ~550 a la izquierda y ~750 a la derecha. 1200 deja
  // margen de sobra para que nada despierte a la vista.
  const RADIO_ACTIVO = 1200;

  function activo(e, ps) {
    if (!ps) return true;
    // Los que están muriendo nunca se duermen: su animación de muerte es la
    // que los saca del array, y congelada quedan de estatua para siempre.
    if (e.state === 'death') return true;
    return Math.abs((e.x + (e.w || 0) / 2) - (ps.x + (ps.w || 0) / 2)) < RADIO_ACTIVO;
  }


  // ── Ruido determinístico ─────────────────────────────
  //
  // Varios enemigos sorteaban su fase de oscilación con Math.random() en
  // el momento de nacer. Eso hace que el nivel sea DISTINTO en cada carga:
  // imposible de balancear, y al comparar una corrida contra otra aparecen
  // diferencias que parecen bugs y no lo son (nos pasó justo al verificar
  // el refactor de la gravedad).
  //
  // Con la posición de spawn como semilla cada enemigo sigue teniendo su
  // propia fase —no oscilan todos al unísono, que era el objetivo— pero
  // siempre la misma.
  function ruido(semilla) {
    const s = Math.sin(semilla * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  /** Fase 0..2π estable, derivada de dónde nace el enemigo. */
  function fase(x, y = 0) {
    return ruido(x * 0.7 + y * 1.3) * Math.PI * 2;
  }

  // ── Gravedad + apoyo en el suelo ─────────────────────
  //
  // Reemplaza a las copias de enemies_level3 y enemies_level4, que eran la
  // misma función salvo tres números: la gravedad (900 vs 950), si el hielo
  // cuenta como piso (sólo el castillo) y el margen de caída al vacío.
  //
  // @param {object} opts
  //   gravedad   px/s²  (900)
  //   maxCaida   px/s   (900)
  //   hielo      bool   ¿el hielo es piso? (false)
  //   plataformas bool  ¿las plataformas son piso? (false)
  //   margenVacio px    cuánto puede caer antes de darse por perdido (100)
  function aplicarGravedad(e, dt, map, opts = {}) {
    if (!map) return;
    const gravedad    = opts.gravedad    ?? 900;
    const maxCaida    = opts.maxCaida    ?? 900;
    const margenVacio = opts.margenVacio ?? 100;
    const rows = map.length, cols = map[0].length;

    if (!e.onGround) {
      e.vy = Math.min((e.vy || 0) + gravedad * dt, maxCaida);
      e.y += e.vy * dt;
    }
    e.onGround = false;

    const c0 = Math.max(0,      Math.floor((e.x + 4)       / TS));
    const c1 = Math.min(cols-1, Math.floor((e.x + e.w - 4) / TS));

    // Revisar las filas que el pie pudo atravesar en este frame, no sólo la
    // de abajo: con vy alta el enemigo se saltearía el piso de un tirón.
    const rIni = Math.floor((e.y + e.h - 1) / TS);
    const rFin = Math.floor((e.y + e.h + (e.vy || 0) * dt + 4) / TS);

    for (let r = rIni; r <= rFin && r < rows; r++) {
      if (r < 0) continue;
      for (let c = c0; c <= c1; c++) {
        const t = map[r]?.[c];
        if (esPiso(t, opts)) {
          if ((e.vy || 0) >= 0) {
            e.y = r * TS - e.h;
            e.vy = 0;
            e.onGround = true;
          }
          break;
        }
      }
      if (e.onGround) break;
    }

    if (e.y > rows * TS + margenVacio) { e.alive = false; e.state = 'gone'; }
  }

  function esPiso(t, opts = {}) {
    if (t === TILE.GROUND || t === TILE.BLOCK) return true;
    if (opts.hielo       && t === TILE.ICE)      return true;
    if (opts.plataformas && t === TILE.PLATFORM) return true;
    return false;
  }


  // ── Apoyo en el suelo, sin integrar la gravedad ──────
  //
  // Distinta de aplicarGravedad(): esta NO mueve al enemigo ni acumula vy.
  // La usan los que ya integran su propia gravedad y solo quieren resolver
  // el apoyo (walker y serpiente tenian esta misma funcion, identica).
  //
  // Mira UNA sola fila, la del pie. Alcanza para enemigos lentos; los
  // rapidos necesitan aplicarGravedad(), que barre el recorrido del frame.
  function apoyarEnPiso(e, map, opts = {}) {
    if (!map || e.vy < 0) return;
    const rows = map.length, cols = map[0].length;
    const r  = Math.floor((e.y + e.h) / TS);
    if (r < 0 || r >= rows) return;
    const cL = Math.max(0,      Math.floor((e.x + 4)       / TS));
    const cR = Math.min(cols-1, Math.floor((e.x + e.w - 4) / TS));
    for (let c = cL; c <= cR; c++) {
      if (esPiso(map[r]?.[c], opts)) {
        e.y = r * TS - e.h;
        e.vy = 0;
        e.onGround = true;
        return;
      }
    }
  }

  // ── Patrulla entre dos límites, con rebote ───────────
  function patrullar(e, dt) {
    e.x += e.vx * dt;
    if (e.x <= e.patrolLeft)  { e.vx =  Math.abs(e.vx); e.facing =  1; }
    if (e.x >= e.patrolRight) { e.vx = -Math.abs(e.vx); e.facing = -1; }
    e.x = Math.max(e.patrolLeft, Math.min(e.patrolRight, e.x));
  }

  // ── No caminar al vacío ──────────────────────────────
  function evitarBorde(e, map, opts = {}) {
    if (!e.onGround || !map) return;
    const lookX = e.vx > 0 ? e.x + e.w + 4 : e.x - 4;
    const c = Math.floor(lookX / TS);
    const r = Math.floor((e.y + e.h + 2) / TS);
    if (!esPiso(map[r]?.[c], opts)) { e.vx = -e.vx; e.facing = -e.facing; }
  }

  // ── Avance de frame de animación ─────────────────────
  function animar(e, dt, totalFrames, segPorFrame) {
    e.frameTick = (e.frameTick || 0) + dt;
    if (e.frameTick >= segPorFrame) {
      e.frameTick = 0;
      e.frameIdx = ((e.frameIdx || 0) + 1) % totalFrames;
    }
  }

  // ── ¿La imagen está lista para dibujar? ──────────────
  // Estaba copiado en una docena de archivos, siempre igual.
  function imagenLista(img) {
    return (img && img.complete && img.naturalWidth > 0) ? img : null;
  }

  // ── Barra de vida sobre el enemigo ───────────────────
  function dibujarBarraVida(ctx, sx, sy, e, color = '#ef4444') {
    if (!e.maxHp || e.hp >= e.maxHp) return;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx, sy - 8, e.w, 5);
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy - 8, e.w * Math.max(0, e.hp / e.maxHp), 5);
  }

  // ── ¿Hace falta DIBUJAR este enemigo? ────────────────
  function visible(e, camX, anchoCanvas, margen = 120) {
    const sx = e.x - camX;
    return sx > -(e.w || 0) - margen && sx < anchoCanvas + margen;
  }

  return { TS, RADIO_ACTIVO, activo, ruido, fase, aplicarGravedad, apoyarEnPiso, esPiso,
           patrullar, evitarBorde, animar, imagenLista,
           dibujarBarraVida, visible };

})();

// Alias de transición: enemy_cull.js se llamaba así cuando sólo tenía el
// culling. Se mantiene para no romper llamadas viejas.
const EnemyCull = EnemyCommon;
