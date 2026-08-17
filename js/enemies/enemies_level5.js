// ═══════════════════════════════════════════════════════
//  ENEMIES_LEVEL5.JS — Enemigos del Nivel 5 (Atravesando el Lago)
//
//  Bajo el agua las reglas cambian, y por eso ninguno de estos bichos
//  reutiliza a los de tierra:
//
//    🦀 cangrejo  Camina por el fondo. BLINDADO ARRIBA: pisarlo lastima.
//                 Es el que rompe el reflejo aprendido en cuatro niveles.
//    🪼 medusa    Sube y baja. No se puede matar: se esquiva.
//    🐟 aguja     Quieto y apuntando. Si cruzás su línea, se lanza recto.
//    🦈 tiburon   No es un enemigo, es una amenaza. Tampoco se puede matar.
//    🐠 cardumen  No hace daño: te EMPUJA. El agua también te mueve.
//
//  Depende de: levels_const.js (TILE), Renderer, AudioManager, Player.
// ═══════════════════════════════════════════════════════

const EnemiesLevel5 = (() => {

  let _enemies = [];
  let _ts = 0;

  // ── Sistema de animación por cuadros ─────────────────
  // Mismo patrón que enemies_level4: cada animación es una lista de PNG que
  // se recorre a una velocidad fija.
  const SpriteAnim = (() => {
    const _sheets = {};

    function define(key, paths, fps) {
      _sheets[key] = {
        frames: paths.map(src => { const im = new Image(); im.src = src; return im; }),
        fps: fps || 10,
      };
    }

    /** Cuadro que toca según una fase en segundos. */
    function frame(key, phase) {
      const sheet = _sheets[key];
      if (!sheet || !sheet.frames.length) return null;
      return sheet.frames[Math.floor(phase * sheet.fps) % sheet.frames.length];
    }

    /** Cuadro puntual, sin ciclar: para muerte y golpe, que no deben repetir. */
    function frameAt(key, idx) {
      const sheet = _sheets[key];
      if (!sheet || !sheet.frames.length) return null;
      return sheet.frames[Math.min(Math.max(0, idx), sheet.frames.length - 1)];
    }

    function count(key) { return _sheets[key] ? _sheets[key].frames.length : 0; }

    return { define, frame, frameAt, count };
  })();

  function preload() {
    const P = 'img/level5/';

    SpriteAnim.define('cangrejo_walk',   [P+'cangrejo_walk0.png', P+'cangrejo_walk01.png', P+'cangrejo_walk02.png'], 7);
    SpriteAnim.define('cangrejo_attack', [P+'cangrejo_attack0.png', P+'cangrejo_attack01.png'], 8);
    SpriteAnim.define('cangrejo_damage', [P+'cangrejo_damage0.png'], 6);
    SpriteAnim.define('cangrejo_death',  [P+'cangrejo_death0.png', P+'cangrejo_death01.png'], 5);

    SpriteAnim.define('medusa_float', [P+'medusa_float0.png', P+'medusa_float01.png', P+'medusa_float02.png', P+'medusa_float03.png'], 5);
    SpriteAnim.define('medusa_glow',  [P+'medusa_glow0.png', P+'medusa_glow01.png'], 8);

    SpriteAnim.define('aguja_idle',  [P+'aguja_idle0.png', P+'aguja_idle01.png'], 4);
    SpriteAnim.define('aguja_dash',  [P+'aguja_dash0.png', P+'aguja_dash01.png'], 14);
    SpriteAnim.define('aguja_death', [P+'aguja_death0.png', P+'aguja_death01.png'], 5);

    SpriteAnim.define('tiburon_swim',   [P+'tiburon_swim0.png', P+'tiburon_swim01.png', P+'tiburon_swim02.png'], 6);
    SpriteAnim.define('tiburon_charge', [P+'tiburon_charge0.png', P+'tiburon_charge01.png', P+'tiburon_charge02.png'], 12);

    SpriteAnim.define('pecesito_swim', [P+'pecesito_swim0.png', P+'pecesito_swim01.png'], 9);
  }

  // ── Spawn ─────────────────────────────────────────────
  function spawnFromMap(map, TS) {
    _enemies = [];
    const rows = map.length, cols = map[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = map[r][c];
        const x = c * TS, y = r * TS;
        // Margen de patrulla: hasta dónde puede alejarse de donde nació
        const pL = Math.max(0, (c - 5) * TS);
        const pR = Math.min((cols - 1) * TS, (c + 5) * TS);

        if      (tile === TILE.CANGREJO)  _enemies.push(_spawnCangrejo(x, y, pL, pR));
        else if (tile === TILE.MEDUSA)    _enemies.push(_spawnMedusa(x, y));
        else if (tile === TILE.PEZ_AGUJA) _enemies.push(_spawnAguja(x, y));
        else if (tile === TILE.TIBURON)   _enemies.push(_spawnTiburon(x, y, (c - 14) * TS, (c + 14) * TS));
        else if (tile === TILE.CARDUMEN)  _enemies.push(_spawnCardumen(x, y, pL, pR));
        else continue;

        map[r][c] = TILE.AIR;
      }
    }
  }

  function _spawnCangrejo(x, y, patrolLeft, patrolRight) {
    return {
      type: 'cangrejo', x, y: y - 40, w: 68, h: 40,
      vx: -46, vy: 0, facing: -1,
      hp: 2, maxHp: 2, alive: true,
      state: 'walk', stateTimer: 0, frozenTimer: 0,
      onGround: false, patrolLeft, patrolRight,
      pinceTimer: 0,
    };
  }

  function _spawnMedusa(x, y) {
    return {
      type: 'medusa', x, y, w: 46, h: 56,
      vx: 0, vy: 0, facing: 1,
      hp: 999, maxHp: 999, alive: true,       // no se puede matar: se esquiva
      state: 'float', stateTimer: 0, frozenTimer: 0,
      baseY: y, fase: Math.random() * Math.PI * 2,
      rango: 70 + Math.random() * 50,
    };
  }

  function _spawnAguja(x, y) {
    return {
      type: 'aguja', x, y, w: 132, h: 26,
      vx: 0, vy: 0, facing: -1,
      hp: 1, maxHp: 1, alive: true,
      state: 'idle', stateTimer: 0, frozenTimer: 0,
      homeX: x, homeY: y, cargaTimer: 0,
    };
  }

  function _spawnTiburon(x, y, zonaL, zonaR) {
    return {
      type: 'tiburon', x, y, w: 180, h: 64,
      vx: -58, vy: 0, facing: -1,
      hp: 999, maxHp: 999, alive: true,        // no se mata: se escapa
      state: 'patrulla', stateTimer: 0, frozenTimer: 0,
      zonaL, zonaR, baseY: y, descanso: 0,
    };
  }

  function _spawnCardumen(x, y, patrolLeft, patrolRight) {
    // Un cardumen es UNA entidad con varios peces dibujados alrededor: así se
    // mueve como un solo cuerpo y no hay que sincronizar siete bichos.
    const peces = [];
    for (let i = 0; i < 7; i++) {
      peces.push({
        dx: (Math.random() - 0.5) * 120,
        dy: (Math.random() - 0.5) * 70,
        fase: Math.random() * Math.PI * 2,
      });
    }
    return {
      type: 'cardumen', x, y, w: 130, h: 80,
      vx: 52, vy: 0, facing: 1,
      hp: 999, maxHp: 999, alive: true,
      state: 'nada', stateTimer: 0, frozenTimer: 0,
      patrolLeft, patrolRight, peces, dispersion: 0,
    };
  }

  // ── Update ────────────────────────────────────────────
  function update(dt, map, ps, onPlayerHit) {
    _ts += dt;

    for (let i = _enemies.length - 1; i >= 0; i--) {
      const e = _enemies[i];

      if (!e.alive && e.state !== 'death') { _enemies.splice(i, 1); continue; }
      if (e.frozenTimer > 0) e.frozenTimer -= dt;

      e.stateTimer += dt;

      switch (e.type) {
        case 'cangrejo': _updateCangrejo(e, dt, map, ps); break;
        case 'medusa':   _updateMedusa(e, dt);            break;
        case 'aguja':    _updateAguja(e, dt, ps);         break;
        case 'tiburon':  _updateTiburon(e, dt, ps);       break;
        case 'cardumen': _updateCardumen(e, dt, ps);      break;
      }

      _checkPlayerCollisions(e, ps, onPlayerHit);
    }
  }

  /** Gravedad de agua: cae, pero como si pesara poco. */
  function _applyWaterGravity(e, dt, map) {
    if (!map) return;
    const TS = 48;
    const rows = map.length, cols = map[0].length;

    if (!e.onGround) {
      e.vy = Math.min((e.vy || 0) + 320 * dt, 250);   // igual que physics.swim del nivel
      e.y += e.vy * dt;
    }
    e.onGround = false;

    const c0 = Math.max(0, Math.floor((e.x + 4) / TS));
    const c1 = Math.min(cols - 1, Math.floor((e.x + e.w - 4) / TS));
    const rIni = Math.floor((e.y + e.h - 1) / TS);
    const rFin = Math.floor((e.y + e.h + (e.vy || 0) * dt + 4) / TS);

    for (let r = rIni; r <= rFin && r < rows; r++) {
      if (r < 0) continue;
      for (let c = c0; c <= c1; c++) {
        const t = map[r]?.[c];
        if (t === TILE.GROUND || t === TILE.BLOCK || t === TILE.PLATFORM) {
          if ((e.vy || 0) >= 0) { e.y = r * TS - e.h; e.vy = 0; e.onGround = true; }
          break;
        }
      }
      if (e.onGround) break;
    }

    if (e.y > rows * TS + 120) { e.alive = false; e.state = 'gone'; }
  }

  function _updateCangrejo(e, dt, map, ps) {
    if (e.state === 'death') return;
    _applyWaterGravity(e, dt, map);
    if (e.frozenTimer > 0) return;

    if (e.state === 'damage') {
      if (e.stateTimer > 0.35) { e.state = 'walk'; e.stateTimer = 0; }
      return;
    }

    // Levanta las pinzas cuando la tiene cerca: avisa antes de que duela.
    const cerca = Math.abs((ps.x + ps.w / 2) - (e.x + e.w / 2)) < 110 &&
                  Math.abs((ps.y + ps.h / 2) - (e.y + e.h / 2)) < 90;

    if (cerca && e.state !== 'attack') { e.state = 'attack'; e.stateTimer = 0; }
    if (!cerca && e.state === 'attack') { e.state = 'walk'; e.stateTimer = 0; }

    if (e.state === 'attack') { e.vx = 0; return; }

    // Se da vuelta en el borde del piso. Sin esto camina hasta el precipicio y
    // se cae del mapa: el fondo del lago está partido en tramos, no es continuo.
    // Sin condicionarlo a onGround: esa bandera parpadea entre frames y el
    // chequeo se salteaba justo en el borde.
    if (_esPrecipicio(e, map)) e.vx = -e.vx;

    e.x += e.vx * dt;
    if (e.x < e.patrolLeft)  { e.x = e.patrolLeft;  e.vx = Math.abs(e.vx); }
    if (e.x > e.patrolRight) { e.x = e.patrolRight; e.vx = -Math.abs(e.vx); }
    e.facing = e.vx < 0 ? -1 : 1;
  }

  /** ¿Se termina el piso justo delante? */
  function _esPrecipicio(e, map) {
    if (!map) return false;
    const TS = 48;
    const adelante = e.vx < 0 ? e.x - 6 : e.x + e.w + 6;
    const c = Math.floor(adelante / TS);
    const r = Math.floor((e.y + e.h + 6) / TS);
    if (c < 0 || c >= map[0].length) return true;
    const t = map[r]?.[c];
    return !(t === TILE.GROUND || t === TILE.BLOCK || t === TILE.PLATFORM);
  }

  function _updateMedusa(e, dt) {
    if (e.frozenTimer > 0) return;
    e.fase += dt * 0.7;
    e.y = e.baseY + Math.sin(e.fase) * e.rango;
  }

  function _updateAguja(e, dt, ps) {
    if (e.state === 'death') return;
    if (e.frozenTimer > 0) return;

    const cy = e.y + e.h / 2;
    const pcy = ps.y + ps.h / 2;

    if (e.state === 'idle') {
      // Se lanza cuando la jugadora le cruza la línea de vista
      const mismaAltura = Math.abs(pcy - cy) < 46;
      const dx = (ps.x + ps.w / 2) - (e.x + e.w / 2);
      const enRango = Math.abs(dx) < 520;

      e.facing = dx < 0 ? -1 : 1;

      if (mismaAltura && enRango) {
        e.state = 'carga'; e.stateTimer = 0;
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w / 2, cy, '#fde047', 6);
        }
      }
      return;
    }

    if (e.state === 'carga') {
      // Medio segundo de aviso: la embestida nunca es sorpresa
      if (e.stateTimer > 0.45) {
        e.state = 'dash'; e.stateTimer = 0;
        e.vx = e.facing * 620;
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('dash');
      }
      return;
    }

    if (e.state === 'dash') {
      e.x += e.vx * dt;
      if (e.stateTimer > 1.1) { e.state = 'vuelve'; e.stateTimer = 0; }
      return;
    }

    if (e.state === 'vuelve') {
      // Regresa despacio a su puesto y vuelve a acechar
      const dx = e.homeX - e.x;
      e.x += Math.sign(dx) * Math.min(Math.abs(dx), 150 * dt);
      e.facing = dx < 0 ? -1 : 1;
      if (Math.abs(dx) < 6) { e.x = e.homeX; e.state = 'idle'; e.stateTimer = 0; }
    }
  }

  function _updateTiburon(e, dt, ps) {
    if (e.frozenTimer > 0) return;

    const pcx = ps.x + ps.w / 2;
    const dentroDeZona = pcx > e.zonaL && pcx < e.zonaR;

    if (e.state === 'patrulla') {
      e.x += e.vx * dt;
      e.y = e.baseY + Math.sin(_ts * 0.6) * 18;
      if (e.x < e.zonaL) { e.x = e.zonaL; e.vx = Math.abs(e.vx); }
      if (e.x > e.zonaR) { e.x = e.zonaR; e.vx = -Math.abs(e.vx); }
      e.facing = e.vx < 0 ? -1 : 1;

      // Carga cuando la tiene a tiro y ya descansó de la anterior
      e.descanso -= dt;
      const dx = pcx - (e.x + e.w / 2);
      if (dentroDeZona && e.descanso <= 0 && Math.abs(dx) < 620) {
        e.state = 'aviso'; e.stateTimer = 0;
        e.facing = dx < 0 ? -1 : 1;
        if (typeof Renderer !== 'undefined') Renderer.shake && Renderer.shake(0.25);
      }
      return;
    }

    if (e.state === 'aviso') {
      // Se frena y apunta: el segundo de miedo antes de la embestida
      e.vx = 0;
      if (e.stateTimer > 0.7) {
        e.state = 'embiste'; e.stateTimer = 0;
        e.vx = e.facing * 520;
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('dash');
      }
      return;
    }

    if (e.state === 'embiste') {
      e.x += e.vx * dt;
      if (e.stateTimer > 1.6) {
        e.state = 'patrulla'; e.stateTimer = 0;
        e.vx = e.facing * 58;
        e.descanso = 2.6;          // no encadena embestidas: deja respirar
        e.baseY = e.y;
      }
    }
  }

  function _updateCardumen(e, dt, ps) {
    e.x += e.vx * dt;
    if (e.x < e.patrolLeft)  { e.x = e.patrolLeft;  e.vx = Math.abs(e.vx); }
    if (e.x > e.patrolRight) { e.x = e.patrolRight; e.vx = -Math.abs(e.vx); }
    e.facing = e.vx < 0 ? -1 : 1;

    // Se dispersan cuando la jugadora se acerca y se vuelven a juntar atrás
    const d = Math.hypot((ps.x + ps.w / 2) - (e.x + e.w / 2),
                         (ps.y + ps.h / 2) - (e.y + e.h / 2));
    const objetivo = d < 150 ? 1 : 0;
    e.dispersion += (objetivo - e.dispersion) * Math.min(1, dt * 3);

    for (const p of e.peces) p.fase += dt * 3;
  }

  // ── Colisión con la jugadora ──────────────────────────
  function _checkPlayerCollisions(e, ps, onPlayerHit) {
    const invencible = ps.invincible && !((ps.immuneTimer || 0) > 0);
    if (!e.alive || e.state === 'death' || invencible) return;

    const solapaX = (ps.x + ps.w - 4) > e.x && ps.x < (e.x + e.w - 4);
    const solapaY = (ps.y + ps.h) > e.y && ps.y < (e.y + e.h);
    if (!solapaX || !solapaY) return;

    // El cardumen no lastima: EMPUJA. El agua también te mueve.
    if (e.type === 'cardumen') {
      const dir = Math.sign((ps.x + ps.w / 2) - (e.x + e.w / 2)) || 1;
      ps.vx += dir * 260 * 0.016;
      ps.vy -= 24 * 0.016;
      return;
    }

    const superInmune = (ps.immuneTimer || 0) > 0;
    if (superInmune && e.type !== 'medusa' && e.type !== 'tiburon') {
      hitEnemy(e);
      onPlayerHit && onPlayerHit('stomp', e);
      return;
    }

    const pisando = ps.vy >= 0 && (ps.y + ps.h) < (e.y + 24) && !ps.wasGrounded;

    // 🦀 EL CANGREJO NO SE PISA. Tiene el caparazón blindado, y ésa es su
    // gracia: rompe el reflejo que la nena viene usando en cuatro niveles.
    if (e.type === 'cangrejo') {
      // El rebote hacia arriba ya lo hace `takeDamage` (su empujón es -260 y lo
      // reaplica cada frame mientras dura el golpe), así que acá sólo va el
      // aviso de POR QUÉ no funcionó: es lo que enseña la regla.
      Player.takeDamage(e.x + e.w / 2);
      if (pisando && typeof Renderer !== 'undefined') {
        Renderer.spawnParticles(e.x + e.w / 2, e.y, '#fed7aa', 10);
        Renderer.spawnText(e.x + e.w / 2, e.y - 10, '¡Caparazón duro!', '#fb923c');
      }
      return;
    }

    // La medusa y el tiburón no se resuelven: se esquivan.
    if (e.type === 'medusa' || e.type === 'tiburon') {
      Player.takeDamage(e.x + e.w / 2);
      return;
    }

    if (pisando) {
      hitEnemy(e);
      onPlayerHit && onPlayerHit('stomp', e);
    } else {
      Player.takeDamage(e.x + e.w / 2);
    }
  }

  // ── Daño ──────────────────────────────────────────────
  function hitEnemy(e) {
    if (!e.alive || e.state === 'death') return;

    // Los que no se matan: el golpe los aturde un momento y nada más.
    if (e.type === 'medusa' || e.type === 'tiburon' || e.type === 'cardumen') {
      if (typeof Renderer !== 'undefined') {
        Renderer.spawnText(e.x + e.w / 2, e.y - 10, '¡No se puede!', '#94a3b8');
      }
      return;
    }

    e.hp--;
    if (e.hp <= 0) {
      e.state = 'death'; e.stateTimer = 0; e.vx = 0;
      if (typeof AudioManager !== 'undefined') AudioManager.sfx('death_enemy');
      if (typeof Renderer !== 'undefined') {
        Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#fb923c', 14);
        Renderer.spawnText(e.x + e.w / 2, e.y, '+150', '#fbbf24');
      }
    } else {
      e.state = 'damage'; e.stateTimer = 0;
      e.vx = -e.vx;
      if (typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss');
      if (typeof Renderer !== 'undefined') {
        Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#ef4444', 8);
      }
    }
  }

  function hitByProjectile(e, kind) {
    if (e.type === 'medusa' || e.type === 'tiburon' || e.type === 'cardumen') {
      // El hielo sí los frena un rato: no los mata, pero da una salida.
      if (kind === 'ice') {
        e.frozenTimer = 2.2;
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#7dd3fc', 12);
        }
      }
      return true;
    }
    hitEnemy(e);
    return true;
  }

  function stunNearby(cx, cy, radius) {
    for (const e of _enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < radius) {
        e.frozenTimer = 1.8;
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w / 2, e.y, '#7dd3fc', 8);
        }
      }
    }
  }

  // ── Dibujo ────────────────────────────────────────────
  function drawAll(ctx, camX, camY) {
    for (const e of _enemies) {
      const x = e.x - camX, y = e.y - camY;
      if (x < -400 || x > ctx.canvas.width + 400) continue;

      switch (e.type) {
        case 'cangrejo': _dibujar(ctx, e, x, y, _animCangrejo(e)); break;
        case 'medusa':   _dibujarMedusa(ctx, e, x, y);             break;
        case 'aguja':    _dibujar(ctx, e, x, y, _animAguja(e));    break;
        case 'tiburon':  _dibujar(ctx, e, x, y, _animTiburon(e));  break;
        case 'cardumen': _dibujarCardumen(ctx, e, x, y);           break;
      }
    }
  }

  function _animCangrejo(e) {
    if (e.state === 'death')  return SpriteAnim.frameAt('cangrejo_death', Math.min(1, Math.floor(e.stateTimer * 4)));
    if (e.state === 'damage') return SpriteAnim.frameAt('cangrejo_damage', 0);
    if (e.state === 'attack') return SpriteAnim.frame('cangrejo_attack', _ts);
    return SpriteAnim.frame('cangrejo_walk', _ts);
  }

  function _animAguja(e) {
    if (e.state === 'death') return SpriteAnim.frameAt('aguja_death', Math.min(1, Math.floor(e.stateTimer * 4)));
    if (e.state === 'dash')  return SpriteAnim.frame('aguja_dash', _ts);
    // Durante la carga vibra entre los dos cuadros de embestida: se ve la tensión
    if (e.state === 'carga') return SpriteAnim.frame('aguja_dash', _ts * 3);
    return SpriteAnim.frame('aguja_idle', _ts);
  }

  function _animTiburon(e) {
    if (e.state === 'embiste' || e.state === 'aviso') return SpriteAnim.frame('tiburon_charge', _ts);
    return SpriteAnim.frame('tiburon_swim', _ts);
  }

  /** Dibujo común: centrado en la caja, espejado según hacia dónde mira. */
  function _dibujar(ctx, e, x, y, img) {
    ctx.save();
    ctx.translate(x + e.w / 2, y + e.h / 2);
    if (e.facing === -1) ctx.scale(-1, 1);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -e.w / 2, -e.h / 2, e.w, e.h);
    } else {
      // Todavía cargando: una silueta para que nunca haya un hueco invisible
      ctx.fillStyle = 'rgba(148,163,184,0.6)';
      ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
    }

    if (e.frozenTimer > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(56,189,248,0.42)';
      ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
    }
    ctx.restore();
  }

  function _dibujarMedusa(ctx, e, x, y) {
    // El resplandor va por código y no en el sprite: así late de verdad.
    const pulso = 0.55 + Math.sin(_ts * 2.2 + e.fase) * 0.25;
    ctx.save();
    ctx.globalAlpha = pulso * 0.5;
    const g = ctx.createRadialGradient(x + e.w/2, y + e.h/2, 4, x + e.w/2, y + e.h/2, e.w * 1.4);
    g.addColorStop(0, 'rgba(165,180,252,0.75)');
    g.addColorStop(1, 'rgba(165,180,252,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + e.w/2, y + e.h/2, e.w * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const key = e.frozenTimer > 0 ? 'medusa_float' : (pulso > 0.72 ? 'medusa_glow' : 'medusa_float');
    _dibujar(ctx, e, x, y, SpriteAnim.frame(key, _ts));
  }

  function _dibujarCardumen(ctx, e, x, y) {
    const img = SpriteAnim.frame('pecesito_swim', _ts);
    if (!img || !img.complete || !img.naturalWidth) return;

    for (const p of e.peces) {
      // Al dispersarse se abren hacia afuera y vuelven solos
      const abrir = 1 + e.dispersion * 1.6;
      const px = x + e.w / 2 + p.dx * abrir + Math.sin(p.fase) * 5;
      const py = y + e.h / 2 + p.dy * abrir + Math.cos(p.fase * 1.3) * 4;

      ctx.save();
      ctx.translate(px, py);
      if (e.facing === -1) ctx.scale(-1, 1);
      ctx.drawImage(img, -18, -14, 36, 28);
      ctx.restore();
    }
  }

  // ── API ───────────────────────────────────────────────
  function getEnemies()  { return _enemies; }
  /** El lago no tiene jefe: el tiburón no se derrota, se sobrevive. */
  function getBoss()     { return null; }
  function allDefeated() { return _enemies.every(e => !e.alive || e.hp > 900); }
  function reset()       { _enemies = []; _ts = 0; }

  return {
    preload, reset, spawnFromMap, update, drawAll,
    getEnemies, getBoss, allDefeated, stunNearby,
    hitEnemy, hitByProjectile,
  };

})();
