// ═══════════════════════════════════════════════════════
//  ENEMIES_LEVEL4.JS — Coordinador y lógica de enemigos del Nivel 4 (Castillo)
// ═══════════════════════════════════════════════════════

const EnemiesLevel4 = (() => {

  let _enemies = [];
  let _ts = 0;

  // ── Jaula de hielo — las 3 amigas NO elegidas, cautivas detrás del jefe ──
  let _cage = null;
  const _CAGE_CHARS = ['nuveciela', 'ciela', 'lunaria', 'nuve'];
  const _cageImgs = {};
  _CAGE_CHARS.forEach(id => { const im = new Image(); im.src = `img/${id}.png`; _cageImgs[id] = im; });

  // ── Sprite Animation System ──────────────────────────
  // Loads individual PNG frames and cycles through them at a given FPS.
  // Usage: SpriteAnim.get(key, frameDt) returns the correct HTMLImageElement.
  const SpriteAnim = (() => {
    const _sheets = {};  // key -> { frames:[], loaded, fps }
    const _timers  = {}; // key_instanceId -> accumulator

    function define(key, paths, fps) {
      const frames = paths.map(src => {
        const img = new Image();
        img.src = src;
        return img;
      });
      _sheets[key] = { frames, fps: fps || 10 };
    }

    // Returns current frame image for a given animation key.
    // `phase` = a monotonically increasing seconds value (unique per enemy).
    function frame(key, phase) {
      const sheet = _sheets[key];
      if (!sheet || sheet.frames.length === 0) return null;
      const idx = Math.floor(phase * sheet.fps) % sheet.frames.length;
      return sheet.frames[idx];
    }

    // Returns a specific frame index clamped to last frame (useful for death/attack hold).
    function frameAt(key, idx) {
      const sheet = _sheets[key];
      if (!sheet || sheet.frames.length === 0) return null;
      const i = Math.min(Math.max(0, idx), sheet.frames.length - 1);
      return sheet.frames[i];
    }

    function count(key) {
      return _sheets[key] ? _sheets[key].frames.length : 0;
    }

    return { define, frame, frameAt, count };
  })();

  // ── Sprite Definitions ───────────────────────────────
  // Each enemy gets its own animation keys. The `_ts` accumulator is used
  // as the global phase; each enemy uses its own internal `animTimer` for
  // state-specific animations that reset on state change.

  function preload() {
    const P = 'img/level4/';

    // ── Guardia (Caballero Helado) ──
    SpriteAnim.define('guardia_idle',     [P+'guardia_idle0.png'],                                    8);
    SpriteAnim.define('guardia_walk',     [P+'guardia_walk0.png', P+'guardia_walk1.png', P+'guardia_walk2.png'], 10);
    SpriteAnim.define('guardia_defense',  [P+'guardia_defense0.png', P+'guardia_defense1.png', P+'guardia_defense2.png', P+'guardia_defense3.png'], 10);
    SpriteAnim.define('guardia_attacked', [P+'guardia_attacked0.png', P+'guardia_attacked1.png', P+'guardia_attacked2.png', P+'guardia_attacked3.png'], 10);

    // ── Gárgola ──
    SpriteAnim.define('gargola_idle',   [P+'gargola_idle0.png', P+'gargola_idle1.png', P+'gargola_idle2.png', P+'gargola_idle3.png', P+'gargola_idle4.png'], 8);
    SpriteAnim.define('gargola_fly',    [P+'gargola_fly0.png',  P+'gargola_fly1.png',  P+'gargola_fly2.png',  P+'gargola_fly3.png',  P+'gargola_fly4.png'],  12);
    SpriteAnim.define('gargola_frozen', [P+'gargola_frozen0.png',P+'gargola_frozen1.png',P+'gargola_frozen2.png',P+'gargola_frozen3.png',P+'gargola_frozen4.png'], 8);

    // ── Gota Viviente ──
    SpriteAnim.define('gota_walk',   [P+'gota_walk0.png',  P+'gota_walk1.png',  P+'gota_walk2.png',  P+'gota_walk3.png',  P+'gota_walk4.png',  P+'gota_walk5.png'],   10);
    SpriteAnim.define('gota_frozen', [P+'gota_frozen0.png',P+'gota_frozen1.png',P+'gota_frozen2.png',P+'gota_frozen3.png',P+'gota_frozen4.png',P+'gota_frozen5.png'], 8);

    // ── Boss: Rey de Escarcha ──
    SpriteAnim.define('boss_idle',    [P+'boss_idle0.png'],                                                                                                            6);
    SpriteAnim.define('boss_walk',    [P+'boss_walk0.png',   P+'boss_walk1.png',   P+'boss_walk2.png',   P+'boss_walk3.png'],                                          10);
    SpriteAnim.define('boss_jump',    [P+'boss_jump0.png',   P+'boss_jump1.png'],                                                                                      8);
    SpriteAnim.define('boss_attack',  [P+'boss_attack0.png', P+'boss_attack1.png', P+'boss_attack2.png', P+'boss_attack3.png', P+'boss_attack4.png'],                  10);
    SpriteAnim.define('boss_frozen',  [P+'boss_frozen0.png', P+'boss_frozen1.png', P+'boss_frozen2.png'],                                                              8);
  }

  // ── Spawn ─────────────────────────────────────────────
  function spawnFromMap(map, TS) {
    _enemies = [];
    _cage = null;
    const rows = map.length, cols = map[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = map[r][c];
        const x = c * TS;
        const pL = Math.max(0, (c - 6) * TS);
        const pR = Math.min((cols - 1) * TS, (c + 6) * TS);

        if (tile === TILE.CABALLERO_HELADO) {
          _enemies.push(_spawnCaballero(x, r * TS - 12, pL, pR));
          map[r][c] = TILE.AIR;
        }
        else if (tile === TILE.GARGO_HIELO) {
          _enemies.push(_spawnGargola(x, r * TS));
          map[r][c] = TILE.AIR;
        }
        else if (tile === TILE.GOTA_VIVIENTE) {
          _enemies.push(_spawnGota(x, r * TS, pL, pR));
          map[r][c] = TILE.AIR;
        }
        else if (tile === TILE.REY_ESCARCHA) {
          const arenaL = Math.max(0, (c - 15) * TS);
          const arenaR = Math.min((cols - 1) * TS, (c + 15) * TS);
          _enemies.push(_spawnReyEscarcha(x, r * TS - 80, arenaL, arenaR));
          map[r][c] = TILE.AIR;
          _cage = _createIceCage(TS, c); // las amigas cautivas, detrás del jefe
        }
      }
    }
  }

  // ── Spawners individuales ──────────────────────────────
  function _spawnCaballero(x, y, patrolLeft, patrolRight) {
    return {
      type: 'caballero',
      x, y, w: 48, h: 60,
      vx: -70, vy: 0,
      facing: -1,
      hp: 2, maxHp: 2,
      alive: true,
      state: 'patrol', // patrol | damage | death
      stateTimer: 0,
      patrolLeft, patrolRight,
      onGround: false,
      frozenTimer: 0,
      shieldActive: true,
      shieldHitTimer: 0,
    };
  }

  function _spawnGargola(x, y) {
    return {
      type: 'gargola',
      x, y, w: 56, h: 56,
      vx: 0, vy: 0,
      startY: y,
      facing: -1,
      hp: 2, maxHp: 2,
      alive: true,
      state: 'sleep', // sleep | active | perched | falling_block | death
      stateTimer: 0,
      frozenTimer: 0,
      attackCooldown: 1.5,
      hoverTimer: 2.5,      // tiempo volando antes de posarse a descansar
      perchTimer: 0,        // tiempo restante posada (quieta y vulnerable)
      perchGroundY: null,
      icicles: [],
    };
  }

  function _spawnGota(x, y, patrolLeft, patrolRight) {
    return {
      type: 'gota',
      x, y, w: 40, h: 40,
      vx: -130, vy: 0,
      facing: -1,
      hp: 1, maxHp: 1,
      alive: true,
      state: 'run', // run | frozen_block | death
      stateTimer: 0,
      patrolLeft, patrolRight,
      onGround: false,
      frozenTimer: 0,
    };
  }

  function _spawnReyEscarcha(x, y, arenaLeft, arenaRight) {
    return {
      type: 'rey_escarcha',
      x, y, w: 96, h: 128,
      vx: 0, vy: 0,
      startY: y,
      facing: -1,
      hp: 6, maxHp: 6,
      alive: true,
      state: 'intro', // intro | fight | attack_wave | attack_blizzard | stun | death
      stateTimer: 0.0,
      arenaLeft, arenaRight,
      frozenTimer: 0,
      attackTimer: 3.0,
      waveParticles: [],
      icicles: [],
      blizzardActive: false,
      blizzardWindParticles: [],
    };
  }

  // ── Update General ────────────────────────────────────
  function update(dt, map, ps, onPlayerHit) {
    _ts += dt;

    // Resolver colisión de empuje para bloques de hielo (gotas congeladas)
    _resolveBlockPushing(ps, dt);

    for (let i = _enemies.length - 1; i >= 0; i--) {
      const e = _enemies[i];

      if (!e.alive && e.state !== 'death') {
        _enemies.splice(i, 1);
        continue;
      }

      // Procesar congelamiento general
      if (e.frozenTimer > 0) {
        e.frozenTimer -= dt;
        // Si la gota congelada termina su tiempo, vuelve a ser gota
        if (e.type === 'gota' && e.state === 'frozen_block' && e.frozenTimer <= 0) {
          e.state = 'run';
          e.w = 40; e.h = 40; // Restaurar hitbox
          e.y -= 8; // Evitar atascarse en suelo
          if (typeof Renderer !== 'undefined') {
            Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#38bdf8', 12);
            Renderer.spawnText(e.x + e.w/2, e.y - 10, '💧 Descongelado', '#38bdf8');
          }
        }
      }

      // Lógica específica
      switch (e.type) {
        case 'caballero':
          _updateCaballero(e, dt, map, ps);
          break;
        case 'gargola':
          _updateGargola(e, dt, map, ps);
          break;
        case 'gota':
          _updateGota(e, dt, map, ps);
          break;
        case 'rey_escarcha':
          _updateReyEscarcha(e, dt, map, ps);
          break;
      }

      // Gravedad para terrestres
      if (e.type === 'caballero' || e.type === 'gota' || e.state === 'falling_block') {
        _applyGravity(e, dt, map);
      }

      // Colisiones de daño con jugador
      _checkPlayerCollisions(e, ps, onPlayerHit);
    }

    // ── Jaula de hielo: se libera cuando el jefe ya no está ──────────────
    if (_cage) {
      if (!_cage.freeing) {
        const bossPresent = _enemies.some(e => e.type === 'rey_escarcha');
        if (!bossPresent) _freeCage();
      } else {
        _cage.freeTimer += dt;
        if (!_cage.freed && _cage.freeTimer > 0.45) _cage.freed = true;
        // Fiesta sostenida (~1.2s): chispas arcoíris alrededor de la jaula
        if (_cage.freeTimer < 1.2 && Math.random() < 0.7 && typeof Renderer !== 'undefined') {
          const cols = ['#f97316', '#f9c846', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6'];
          Renderer.spawnParticles(
            _cage.frame.x + Math.random() * _cage.frame.w,
            _cage.frame.y - 10 + Math.random() * (_cage.frame.h + 20),
            cols[(Math.random() * cols.length) | 0], 2
          );
        }
      }
    }
  }

  // ── Física de Empuje de Bloques ────────────────────────
  function _resolveBlockPushing(ps, dt) {
    for (const e of _enemies) {
      if (e.type === 'gota' && e.state === 'frozen_block' && e.alive) {
        // Colisión horizontal para empujar el bloque
        const overlapX = (ps.x + ps.w) > e.x && ps.x < (e.x + e.w);
        const overlapY = (ps.y + ps.h) > e.y && ps.y < (e.y + e.h - 4); // margen superior

        if (overlapX && overlapY) {
          // Si el jugador corre hacia el bloque, lo empuja
          const dx = (ps.x + ps.w/2) - (e.x + e.w/2);
          const pushForce = Math.abs(ps.vx) > 50 ? ps.vx * 0.9 : 0;
          e.vx = pushForce;
          e.x += e.vx * dt;

          // Arrastrar partículas de fricción de hielo
          if (Math.abs(e.vx) > 20 && Math.random() < 0.25 && typeof Renderer !== 'undefined') {
            Renderer.spawnParticles(e.x + (e.vx > 0 ? 0 : e.w), e.y + e.h, '#bae6fd', 2);
          }
        } else {
          // Deceleración del bloque en el hielo
          e.vx *= 0.85;
          e.x += e.vx * dt;
        }

        // Colisión superior: Sólido para el jugador (pararse arriba)
        const standX = (ps.x + ps.w - 6) > e.x && (ps.x + 6) < (e.x + e.w);
        const standY = (ps.y + ps.h) >= e.y && (ps.y + ps.h) <= e.y + 12 && ps.vy >= 0;

        if (standX && standY) {
          ps.y = e.y - ps.h;
          ps.vy = 0;
          ps.grounded = true;
          ps.onIce = true; // El bloque de hielo resbala al jugador
        }
      }
    }
  }

  // ── Lógica Caballero Helado ───────────────────────────
  function _updateCaballero(e, dt, map, ps) {
    if (!e.alive && e.state !== 'death') return;
    if (e.state === 'death') {
      e.stateTimer += dt;
      if (e.stateTimer > 0.5) {
        e.alive = false;
        e.state = 'gone'; // el bucle lo elimina y drawAll deja de dibujarlo
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#bae6fd', 14);
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#ffffff', 8);
        }
      }
      return;
    }

    if (e.shieldHitTimer > 0) e.shieldHitTimer -= dt;

    if (e.frozenTimer > 0) {
      e.vx = 0;
      return; // Congelado, no patrulla
    }

    // Patrulla básica
    e.x += e.vx * dt;
    if (e.x <= e.patrolLeft)  { e.vx = Math.abs(e.vx); e.facing = 1; }
    if (e.x >= e.patrolRight) { e.vx = -Math.abs(e.vx); e.facing = -1; }
    e.x = Math.max(e.patrolLeft, Math.min(e.patrolRight, e.x));

    // Si el jugador está muy cerca y de frente, levanta el escudo
    const dx = ps.x - e.x;
    const sameDirection = (dx > 0 && e.facing === 1) || (dx < 0 && e.facing === -1);
    e.shieldActive = sameDirection && Math.abs(dx) < 180;
  }

  // ── Lógica Gárgola ────────────────────────────────────
  function _updateGargola(e, dt, map, ps) {
    if (!e.alive && e.state !== 'death') return;
    if (e.state === 'death') {
      e.stateTimer += dt;
      if (e.stateTimer > 0.5) {
        e.alive = false;
        e.state = 'gone'; // el bucle lo elimina y drawAll deja de dibujarlo
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#bae6fd', 14);
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#ffffff', 8);
        }
      }
      return;
    }

    // Lógica para carámbanos disparados
    for (let i = e.icicles.length - 1; i >= 0; i--) {
      const ic = e.icicles[i];
      ic.y += ic.vy * dt;
      ic.vy += 350 * dt; // Gravedad del carámbano

      // Colisión con suelo
      const colTile = _getTileAt(map, ic.x, ic.y);
      if (colTile === TILE.GROUND || colTile === TILE.BLOCK || colTile === TILE.ICE) {
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(ic.x, ic.y, '#7dd3fc', 6);
        }
        e.icicles.splice(i, 1);
        continue;
      }

      // Colisión con jugador
      const px = ps.x, py = ps.y, pw = ps.w, ph = ps.h;
      if (ic.x > px && ic.x < px + pw && ic.y > py && ic.y < py + ph) {
        if (!ps.invincible) {
          Player.takeDamage(ic.x);
        }
        e.icicles.splice(i, 1);
      }
    }

    // Si está congelada y cayendo como bloque
    if (e.state === 'falling_block') {
      e.vy += 750 * dt;
      e.y += e.vy * dt;

      // Romper pinchos si los toca
      const c = Math.floor((e.x + e.w/2) / 48);
      const r = Math.floor((e.y + e.h) / 48);
      if (map[r] && (map[r][c] === TILE.SPIKES || map[r][c] === TILE.ICE_SPIKES)) {
        map[r][c] = TILE.AIR; // Romper el pincho!
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(c * 48 + 24, r * 48 + 24, '#94a3b8', 16);
          Renderer.spawnText(e.x + e.w/2, e.y, '💥 ¡Pinchos Rotos!', '#ef4444');
        }
        e.alive = false; // La gárgola se rompe al impactar pinchos
        e.state = 'death';
        e.stateTimer = 0;
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('death_enemy');
      }
      return;
    }

    if (e.frozenTimer > 0) {
      // Si congelada, cambia a estado de bloque cayendo
      e.state = 'falling_block';
      e.vy = 0;
      return;
    }

    const dx = ps.x - e.x;
    const dy = ps.y - e.y;
    const dist = Math.hypot(dx, dy);

    if (e.state === 'sleep') {
      // Despertar si el jugador está cerca
      if (dist < 260) {
        e.state = 'active';
        e.stateTimer = 0;
        e.hoverTimer = 2.5;
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnText(e.x + e.w/2, e.y - 10, '❗', '#ef4444');
        }
      }
    } else if (e.state === 'active') {
      // Volar oscilando horizontalmente arriba del jugador
      e.facing = dx > 0 ? 1 : -1;
      const targetX = ps.x + (e.facing === 1 ? -40 : 40);
      const targetY = ps.y - 120;

      e.x += (targetX - e.x) * 2.0 * dt;
      e.y += (targetY - e.y) * 1.5 * dt;

      // Ataque de carámbano
      e.attackCooldown -= dt;
      if (e.attackCooldown <= 0 && Math.abs(dx) < 60 && e.y < ps.y) {
        e.attackCooldown = 2.0;
        e.icicles.push({ x: e.x + e.w/2, y: e.y + e.h, vy: 100 });
      }

      // Cada pocos segundos se posa a descansar: queda quieta y expuesta
      // (sin esto, una gárgola siempre en vuelo errático es casi imposible
      // de golpear con pisotón, y muy difícil incluso con proyectil).
      e.hoverTimer -= dt;
      if (e.hoverTimer <= 0) {
        const groundY = _findGroundBelow(map, e.x + e.w/2, e.y);
        e.state = 'perched';
        e.stateTimer = 0;
        e.perchTimer = 2.0;
        e.perchGroundY = groundY; // null → se queda quieta en el aire (sin piso cerca, p.ej. sobre un foso)
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnText(e.x + e.w/2, e.y - 10, '💤', '#94a3b8');
        }
      }
    } else if (e.state === 'perched') {
      // Posada (o inmóvil en el aire si no hay piso cerca): quieta y vulnerable.
      if (e.perchGroundY != null) {
        const groundY = e.perchGroundY - e.h;
        e.y += (groundY - e.y) * 5 * dt;
      }
      e.perchTimer -= dt;
      if (e.perchTimer <= 0) {
        e.state = 'active';
        e.hoverTimer = 3.0 + Math.random() * 1.5;
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#bae6fd', 6);
        }
      }
    }
  }

  // Busca el tile sólido más cercano hacia abajo desde (cx, fromY).
  // Devuelve la Y (px) del tope de ese tile, o null si no hay piso cerca
  // (p.ej. la gárgola está volando sobre un foso de pinchos).
  function _findGroundBelow(map, cx, fromY, maxDropPx = 420) {
    const TS = 48;
    const c = Math.max(0, Math.min(map[0].length - 1, Math.floor(cx / TS)));
    const rStart = Math.max(0, Math.floor(fromY / TS));
    const rEnd = Math.min(map.length - 1, rStart + Math.ceil(maxDropPx / TS));
    for (let r = rStart; r <= rEnd; r++) {
      const t = map[r]?.[c];
      if (t === TILE.GROUND || t === TILE.BLOCK || t === TILE.ICE || t === TILE.PLATFORM) {
        return r * TS;
      }
    }
    return null;
  }

  // ── Lógica Gota Viviente ──────────────────────────────
  function _updateGota(e, dt, map, ps) {
    if (!e.alive && e.state !== 'death') return;
    if (e.state === 'death') {
      e.stateTimer += dt;
      if (e.stateTimer > 0.5) {
        e.alive = false;
        e.state = 'gone'; // el bucle lo elimina y drawAll deja de dibujarlo
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#bae6fd', 14);
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#ffffff', 8);
        }
      }
      return;
    }

    if (e.state === 'frozen_block') {
      // En modo bloque no se mueve sola
      return;
    }

    // Patrulla rápida
    e.x += e.vx * dt;
    if (e.x <= e.patrolLeft)  { e.vx = Math.abs(e.vx); e.facing = 1; }
    if (e.x >= e.patrolRight) { e.vx = -Math.abs(e.vx); e.facing = -1; }
    e.x = Math.max(e.patrolLeft, Math.min(e.patrolRight, e.x));
  }

  // ── Lógica Jefe: Rey de Escarcha ──────────────────────
  function _updateReyEscarcha(e, dt, map, ps) {
    if (!e.alive && e.state !== 'death') return;
    if (e.state === 'death') {
      e.stateTimer += dt;
      if (e.stateTimer > 1.5) {
        e.alive = false;
        e.state = 'gone'; // desaparece con un estallido de hielo + dorado
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#bae6fd', 34);
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#f9c846', 22);
        }
        window.dispatchEvent(new CustomEvent('bossDefeated'));
      }
      return;
    }

    // Actualizar partículas de la ola helada
    for (let i = e.waveParticles.length - 1; i >= 0; i--) {
      const p = e.waveParticles[i];
      p.x += p.vx * dt;
      p.life -= dt;

      // Colisión con jugador
      if (Math.abs(p.x - (ps.x + ps.w/2)) < 30 && Math.abs(p.y - (ps.y + ps.h/2)) < 40) {
        if (!ps.invincible) {
          Player.takeDamage(p.x);
        }
        e.waveParticles.splice(i, 1);
        continue;
      }

      if (p.life <= 0) e.waveParticles.splice(i, 1);
    }

    // Actualizar partículas de viento (Blizzard)
    if (e.blizzardActive) {
      e.stateTimer -= dt;
      // Generar partículas de nieve empujadas por el viento
      if (Math.random() < 0.4) {
        e.blizzardWindParticles.push({
          x: e.facing === 1 ? e.x : e.x + e.w,
          y: e.y + e.h - 50 + (Math.random() - 0.5) * 50,
          vx: e.facing === 1 ? 550 : -550,
          vy: (Math.random() - 0.5) * 40,
          life: 1.2
        });
      }

      // El viento hace daño si el jugador no está agachado/deslizándose
      const overlapX = ps.x > e.arenaLeft && ps.x < e.arenaRight;
      if (overlapX && !ps.sliding && !ps.invincible && Math.abs(ps.y - (e.y + e.h - 40)) < 60) {
        Player.takeDamage(e.x + e.w/2);
      }

      if (e.stateTimer <= 0) {
        e.blizzardActive = false;
        e.state = 'fight';
        e.attackTimer = 2.5;
      }

      // Actualizar partículas de viento
      for (let i = e.blizzardWindParticles.length - 1; i >= 0; i--) {
        const p = e.blizzardWindParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) e.blizzardWindParticles.splice(i, 1);
      }
    }

    // Carámbanos que invoca el jefe
    for (let i = e.icicles.length - 1; i >= 0; i--) {
      const ic = e.icicles[i];
      ic.y += ic.vy * dt;
      ic.vy += 450 * dt;

      // Colisión con suelo
      const colTile = _getTileAt(map, ic.x, ic.y);
      if (colTile === TILE.GROUND || colTile === TILE.BLOCK || colTile === TILE.ICE) {
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(ic.x, ic.y, '#7dd3fc', 6);
        }
        e.icicles.splice(i, 1);
        continue;
      }

      // Colisión con jugador
      if (ic.x > ps.x && ic.x < ps.x + ps.w && ic.y > ps.y && ic.y < ps.y + ps.h) {
        if (!ps.invincible) Player.takeDamage(ic.x);
        e.icicles.splice(i, 1);
      }
    }

    // Comportamiento por estado
    if (e.state === 'intro') {
      e.stateTimer += dt;
      // Flotación lenta de intro
      e.y = e.startY + Math.sin(_ts * 2) * 15;
      if (e.stateTimer > 2.0) {
        e.state = 'fight';
        e.attackTimer = 2.0;
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnText(e.x + e.w/2, e.y - 20, '👑 REY DE ESCARCHA', '#7dd3fc');
        }
      }
      return;
    }

    if (e.state === 'stun') {
      e.stateTimer -= dt;
      e.vx = 0;
      if (e.stateTimer <= 0) {
        e.state = 'fight';
        e.attackTimer = 2.0;
      }
      return;
    }

    // Inteligencia en pelea
    e.facing = ps.x < e.x ? -1 : 1;
    e.y = e.startY + Math.sin(_ts * 1.5) * 10; // Flota suavemente

    // Comprobar colisión con bloques de hielo (gotas congeladas)
    for (const other of _enemies) {
      if (other.type === 'gota' && other.state === 'frozen_block' && other.alive) {
        const collRey = other.x + other.w > e.x && other.x < e.x + e.w &&
                        other.y + other.h > e.y && other.y < e.y + e.h;
        if (collRey && Math.abs(other.vx) > 80) {
          // Bloque de hielo choca contra el rey a velocidad
          other.alive = false; // Romper el bloque
          other.state = 'death';
          other.stateTimer = 0;

          e.hp = Math.max(0, e.hp - 2); // 2 puntos de daño!
          e.state = 'stun';
          e.stateTimer = 2.2; // Aturdido 2.2 segundos

          if (typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss');
          if (typeof Renderer !== 'undefined') {
            Renderer.spawnParticles(other.x + 20, other.y + 20, '#38bdf8', 25);
            Renderer.spawnText(e.x + e.w/2, e.y - 15, '💥 ¡Guardia rota! -2', '#ef4444');
            Renderer.flash('rgba(56, 189, 248, 0.45)', 0.5);
          }

          if (e.hp <= 0) {
            e.state = 'death';
            e.stateTimer = 0;
            if (typeof AudioManager !== 'undefined') AudioManager.sfx('death_boss');
            if (typeof Renderer !== 'undefined') {
              Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#f9c846', 40);
              Renderer.flash('#f9c846', 0.8);
            }
          }
          break;
        }
      }
    }

    e.attackTimer -= dt;
    if (e.attackTimer <= 0) {
      const rand = Math.random();
      if (rand < 0.35) {
        // Ola helada
        e.state = 'attack_wave';
        e.attackTimer = 3.5;
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnText(e.x + e.w/2, e.y - 20, '❄️ ¡Ola Helada!', '#38bdf8');
        }
        // Invocar la ola en el suelo
        const dir = e.facing;
        e.waveParticles.push({
          x: e.x + e.w/2,
          y: e.y + e.h - 10,
          vx: dir * 290,
          life: 2.5
        });
      } else if (rand < 0.70) {
        // Blizzard
        e.state = 'attack_blizzard';
        e.blizzardActive = true;
        e.stateTimer = 2.5; // Duración ventisca
        e.blizzardWindParticles = [];
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnText(e.x + e.w/2, e.y - 20, '🌪️ ¡Ventisca! ¡Deslízate!', '#bae6fd');
        }
      } else {
        // Lluvia de carámbanos
        e.attackTimer = 3.0;
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnText(e.x + e.w/2, e.y - 20, '🌧️ Lluvia helada', '#7dd3fc');
        }
        // Invocar 4 carámbanos cayendo de arriba en la arena
        for (let j = 0; j < 4; j++) {
          const spawnX = e.arenaLeft + 60 + Math.random() * (e.arenaRight - e.arenaLeft - 120);
          e.icicles.push({ x: spawnX, y: e.y - 180, vy: 120 });
        }
      }
    }
  }

  // ── Helpers de Gravedad y Colisiones ──────────────────
  function _applyGravity(e, dt, map) {
    if (!map) return;
    const TS = 48;
    const rows = map.length, cols = map[0].length;

    if (!e.onGround) {
      e.vy = Math.min((e.vy || 0) + 950 * dt, 900);
      e.y += e.vy * dt;
    }
    e.onGround = false;

    const c0 = Math.max(0, Math.floor((e.x + 4) / TS));
    const c1 = Math.min(cols - 1, Math.floor((e.x + e.w - 4) / TS));

    const rCheckStart = Math.floor((e.y + e.h - 1) / TS);
    const rCheckEnd = Math.floor((e.y + e.h + (e.vy || 0) * dt + 4) / TS);

    for (let rCheck = rCheckStart; rCheck <= rCheckEnd && rCheck < rows; rCheck++) {
      if (rCheck < 0) continue;
      for (let c = c0; c <= c1; c++) {
        const t = map[rCheck]?.[c];
        if (t === TILE.GROUND || t === TILE.BLOCK || t === TILE.ICE) {
          if ((e.vy || 0) >= 0) {
            e.y = rCheck * TS - e.h;
            e.vy = 0;
            e.onGround = true;
          }
          break;
        }
      }
      if (e.onGround) break;
    }

    if (e.y > rows * TS + 120) {
      e.alive = false;
      e.state = 'gone';
    }
  }

  function _checkPlayerCollisions(e, ps, onPlayerHit) {
    const isTemporaryInvincible = ps.invincible && !((ps.immuneTimer || 0) > 0);
    if (!e.alive || e.state === 'death' || e.state === 'frozen_block' || isTemporaryInvincible) return;

    // Colisión de hitbox
    const overlapX = (ps.x + ps.w - 4) > e.x && ps.x < (e.x + e.w - 4);
    const overlapY = (ps.y + ps.h) > e.y && ps.y < (e.y + e.h);

    if (overlapX && overlapY) {
      const isBoss = e.type === 'rey_escarcha';
      const hasSuperImmunity = (ps.immuneTimer || 0) > 0;

      if (hasSuperImmunity && !isBoss) {
        hitEnemy(e);
        onPlayerHit && onPlayerHit('stomp', e);
        return;
      }

      const isStomping = ps.vy >= 0 && (ps.y + ps.h) < (e.y + (isBoss ? 50 : 25)) && !ps.wasGrounded;

      if (isStomping) {
        if (e.type === 'gota') {
          // La gota de agua normal hace daño al pisarse (es líquida e hirviente/inestable)
          Player.takeDamage(e.x + e.w/2);
        } else if (e.type === 'caballero') {
          // Si pisamos el caballero por arriba
          hitEnemy(e);
          onPlayerHit && onPlayerHit('stomp', e);
        } else if (e.type === 'gargola') {
          hitEnemy(e);
          onPlayerHit && onPlayerHit('stomp', e);
        } else if (e.type === 'rey_escarcha') {
          // El jefe solo recibe daño por pisotón si está aturdido (stun)
          if (e.state === 'stun') {
            hitEnemy(e);
            onPlayerHit && onPlayerHit('stomp', e);
          } else {
            Player.takeDamage(e.x + e.w/2); // Si no está stun, daña al jugador
          }
        }
      } else {
        // Colisión normal de daño al jugador
        if (e.type === 'caballero' && e.shieldActive) {
          // El caballero empuja al jugador si choca de frente con el escudo levantado
          const dx = ps.x + ps.w/2 - (e.x + e.w/2);
          ps.vx = (dx > 0 ? 1 : -1) * 350;
          ps.vy = -180;
          Player.takeDamage(e.x + e.w/2);
        } else {
          Player.takeDamage(e.x + e.w/2);
        }
      }
    }
  }

  // Daño al Rey Escarcha por golpe — se triplica mientras el Súper Árbol
  // Mágico está activo (ajuste de balance). Solo aplica mientras dura el
  // efecto; fuera de él, el daño es siempre el normal (1).
  function _bossDamage() {
    const superActive = (typeof Player !== 'undefined' && Player.getState)
      ? Player.getState().superTimer > 0
      : false;
    return superActive ? 3 : 1;
  }

  function hitEnemy(e) {
    if (!e.alive || e.state === 'death') return;

    if (e.type === 'caballero') {
      e.hp--;
      if (e.hp <= 0) {
        e.state = 'death'; e.stateTimer = 0;
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('death_enemy');
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#bae6fd', 14);
          Renderer.spawnText(e.x + e.w/2, e.y, '+150', '#bae6fd');
        }
      } else {
        e.state = 'damage'; e.stateTimer = 0;
        e.vx = -e.vx * 1.3; // rebota enfurecido
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss');
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#ef4444', 8);
          Renderer.spawnText(e.x + e.w/2, e.y - 10, '🛡️ 😡', '#ef4444');
        }
      }
    }
    else if (e.type === 'gargola') {
      e.hp--;
      if (e.hp <= 0) {
        e.state = 'death'; e.stateTimer = 0;
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('death_enemy');
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#94a3b8', 12);
        }
      } else {
        e.state = 'active'; // Se despierta al golpearla (o sale volando si estaba posada)
        e.hoverTimer = 2.5;
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss');
      }
    }
    else if (e.type === 'rey_escarcha') {
      const dmg = _bossDamage();
      e.hp = Math.max(0, e.hp - dmg);
      e.state = 'stun';
      e.stateTimer = 1.0; // Aturdido corto por golpe directo
      if (typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss');
      if (typeof Renderer !== 'undefined') {
        Renderer.spawnParticles(e.x + e.w/2, e.y + 40, dmg > 1 ? '#f9c846' : '#ef4444', dmg > 1 ? 28 : 16);
        Renderer.spawnText(e.x + e.w/2, e.y, dmg > 1 ? `🌈 -${dmg} HP` : '-1 HP', dmg > 1 ? '#f9c846' : '#ef4444');
      }

      if (e.hp <= 0) {
        e.state = 'death'; e.stateTimer = 0;
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('death_boss');
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#f9c846', 40);
          Renderer.flash('#f9c846', 0.8);
        }
      }
    }
  }

  // ── Daño por Proyectiles (Hielo, Fuego, Rayo) ──────────
  function hitByProjectile(e, pKind, pColor) {
    if (!e.alive || e.state === 'death') return false;

    // Caso Caballero Helado: Bloqueo frontal
    if (e.type === 'caballero' && e.shieldActive && (e.frozenTimer || 0) <= 0) {
      e.shieldHitTimer = 0.25;
      if (pKind === 'ice') {
        e.frozenTimer = 2.0;
        e.shieldActive = false;
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#7dd3fc', 12);
          Renderer.spawnText(e.x + e.w/2, e.y - 15, '❄️ Escudo Congelado!', '#7dd3fc');
        }
      } else {
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + (e.facing === -1 ? 0 : e.w), e.y + e.h/2, '#ffffff', 8);
          Renderer.spawnText(e.x + (e.facing === -1 ? 0 : e.w), e.y - 10, '🛡️ ¡Bloqueado!', '#ffffff');
        }
      }
      return true;
    }

    // Caso Gota: Congelación a bloque de hielo empujable
    if (e.type === 'gota' && pKind === 'ice') {
      e.state = 'frozen_block';
      e.frozenTimer = 4.0;
      e.vx = 0;
      e.w = 44; e.h = 44;
      if (typeof Renderer !== 'undefined') {
        Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#7dd3fc', 14);
        Renderer.spawnText(e.x + e.w/2, e.y - 15, '❄️ ¡Bloque de Hielo!', '#7dd3fc');
      }
      return true;
    }

    // Caso Gárgola: Congelación y caída
    if (e.type === 'gargola' && pKind === 'ice') {
      e.state = 'falling_block';
      e.frozenTimer = 5.0;
      e.vy = 0;
      if (typeof Renderer !== 'undefined') {
        Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#bae6fd', 14);
        Renderer.spawnText(e.x + e.w/2, e.y - 15, '❄️ Gargola Congelada', '#bae6fd');
      }
      return true;
    }

    // Caso General / Daño
    if (e.type === 'rey_escarcha') {
      if (pKind === 'ice') {
        e.state = 'stun';
        e.stateTimer = 1.2;
        const dmg = _bossDamage();
        e.hp = Math.max(0, e.hp - dmg);
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnText(e.x + e.w/2, e.y - 15, dmg > 1 ? `🌈❄️ -${dmg} HP` : '❄️ -1 HP (Freno)', '#7dd3fc');
        }
      } else {
        hitEnemy(e);
      }
      if (e.hp <= 0 && e.alive) {
        e.alive = false; e.state = 'death'; e.stateTimer = 0;
        window.dispatchEvent(new CustomEvent('bossDefeated'));
      }
      return true;
    }

    hitEnemy(e);
    return true;
  }

  // ══════════════════════════════════════════════════════
  //  JAULA DE HIELO — las amigas cautivas detrás del jefe
  // ══════════════════════════════════════════════════════
  function _createIceCage(TS, bossCol) {
    // La jaula se crea en _loadLevel, ANTES de Player.init(charId). Por eso
    // las cautivas se resuelven de forma diferida (en el primer dibujo, ya
    // con el personaje elegido seteado). Acá solo montamos la geometría.
    const groundTopY = 13 * TS;              // superficie del piso de la arena
    const gap        = 1.6 * TS;             // separación entre amigas
    const centerX    = (bossCol + 12) * TS;  // "detrás" del jefe (a su derecha)
    const n = 3;                             // siempre 3 (las 4 amigas menos la elegida)

    const slots = [];
    for (let i = 0; i < n; i++) {
      slots.push({
        id: null,                                 // se resuelve en _resolveCageChars
        cx:    centerX + (i - (n - 1) / 2) * gap, // centro horizontal (mundo)
        feetY: groundTopY,                        // pies sobre el piso
        shiver: Math.random() * Math.PI * 2,      // fase de tembleque distinta c/u
        hop:    Math.random() * Math.PI * 2,
      });
    }

    const charW = 46, charH = 62;
    const left  = slots[0].cx - gap * 0.6;
    const right = slots[n - 1].cx + gap * 0.6;
    const top   = groundTopY - charH - 20;
    return {
      slots, charW, charH, captured: [], resolved: false,
      frame: { x: left, y: top, w: right - left, h: groundTopY - top },
      freeing: false, freeTimer: 0, freed: false,
    };
  }

  // Resuelve qué 3 amigas están cautivas: SIEMPRE excluye a la elegida.
  // Se llama en el primer dibujo, cuando Player.getState().charId ya es correcto.
  function _resolveCageChars() {
    if (!_cage || _cage.resolved) return;
    const chosen = (typeof Player !== 'undefined' && Player.getState)
      ? Player.getState().charId : 'nuveciela';
    _cage.captured = _CAGE_CHARS.filter(id => id !== chosen).slice(0, 3);
    _cage.slots.forEach((s, i) => { s.id = _cage.captured[i]; });
    _cage.resolved = true;
  }

  function _freeCage() {
    _cage.freeing = true;
    _cage.freeTimer = 0;
    if (typeof AudioManager !== 'undefined') AudioManager.sfx('get_tree');
    if (typeof Renderer !== 'undefined') {
      Renderer.flash('rgba(147,197,253,0.5)', 0.7);
      const cx = _cage.frame.x + _cage.frame.w / 2;
      const cy = _cage.frame.y + _cage.frame.h / 2;
      const cols = ['#f97316', '#f9c846', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6', '#ffffff'];
      for (const c of cols) Renderer.spawnParticles(cx, cy, c, 10);
      Renderer.spawnText(cx, _cage.frame.y - 26, '💖 ¡Liberaste a tus amigas!', '#f9c846');
    }
    if (typeof UI !== 'undefined' && UI.showAbilityBadge) {
      UI.showAbilityBadge('💖 ¡Liberaste a tus amigas!', 4500);
    }
  }

  function _drawIceCage(ctx, camX, camY) {
    if (!_cage) return;
    _resolveCageChars();  // fija las cautivas (excluyendo a la elegida) ya con charId correcto
    const t = _cage.freeTimer;
    const breaking = _cage.freeing ? Math.min(1, t / 0.45) : 0; // 0→1 apertura de barras

    // ── Las amigas cautivas ──
    for (const s of _cage.slots) {
      const img = _cageImgs[s.id];
      const feetX = s.cx - camX;
      const feetY = s.feetY - camY;

      let dx = 0, dy = 0, alpha = 0.9, extra = 1;
      if (!_cage.freeing) {
        dx = Math.sin(_ts / 90 + s.shiver) * 1.5;  // tiritan de frío
        alpha = 0.86;
      } else {
        const hop = Math.abs(Math.sin(t * 6 + s.hop)) * Math.max(0, 1 - t / 2.5);
        dy = -hop * 14;                              // saltito de alegría
        extra = 1 + hop * 0.08;
        alpha = Math.min(1, 0.86 + t);
      }

      if (img && img.complete && img.naturalWidth > 0) {
        const ar = img.naturalWidth / img.naturalHeight;
        const dh = _cage.charH * extra;
        const dw = dh * ar;
        const dxL = feetX - dw / 2 + dx, dyT = feetY - dh + dy;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, dxL, dyT, dw, dh);
        // Tinte celeste de "congeladas" que se desvanece al liberarse
        const frost = _cage.freeing ? Math.max(0, 0.35 - t * 0.9) : 0.35;
        if (frost > 0.01) {
          ctx.globalAlpha = frost;
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = '#7dd3fc';
          ctx.fillRect(dxL, dyT, dw, dh);
        }
        ctx.restore();
      }
    }

    // ── Barras de la jaula — delante de las amigas; se abren al romperse ──
    if (breaking < 1) {
      const f = _cage.frame;
      const fx = f.x - camX, fy = f.y - camY;
      ctx.save();
      ctx.globalAlpha = (1 - breaking) * 0.9;
      ctx.fillStyle = 'rgba(186,230,253,0.14)';
      ctx.fillRect(fx, fy, f.w, f.h);
      ctx.strokeStyle = 'rgba(224,242,254,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeRect(fx, fy, f.w, f.h);
      ctx.strokeStyle = 'rgba(125,211,252,0.9)';
      ctx.lineWidth = 4;
      const bars = 6;
      for (let i = 1; i < bars; i++) {
        const px = fx + (f.w * i) / bars;
        const spread = breaking * (px - (fx + f.w / 2)) * 1.4; // se separan del centro
        ctx.beginPath();
        ctx.moveTo(px + spread, fy);
        ctx.lineTo(px + spread, fy + f.h);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ── Dibujar Todos ─────────────────────────────────────
  function drawAll(ctx, camX, camY) {
    _drawIceCage(ctx, camX, camY);  // detrás del jefe (se dibuja primero)
    for (const e of _enemies) {
      if (!e.alive && e.state !== 'death') continue;
      if (e.state === 'gone') continue;

      const sx = e.x - camX;
      const sy = e.y - camY;

      if (sx < -e.w - 100 || sx > ctx.canvas.width + 100) continue;

      switch (e.type) {
        case 'caballero':
          _drawCaballero(ctx, e, sx, sy);
          break;
        case 'gargola':
          _drawGargola(ctx, e, sx, sy);
          break;
        case 'gota':
          _drawGota(ctx, e, sx, sy);
          break;
        case 'rey_escarcha':
          _drawReyEscarcha(ctx, e, sx, sy);
          break;
      }
    }
  }

  // ── Render Guardia (Caballero Helado) — Sprite Animation ──
  function _drawCaballero(ctx, e, x, y) {
    // Select animation key based on state
    const frozen    = e.frozenTimer > 0;
    const hitShield = e.shieldHitTimer > 0;

    let animKey;
    if (frozen) {
      animKey = 'guardia_defense'; // use defense frames as frozen stand
    } else if (e.state === 'damage') {
      animKey = 'guardia_attacked';
    } else if (e.shieldActive) {
      animKey = 'guardia_defense';
    } else {
      // Idle when stopped, walk when moving
      animKey = (Math.abs(e.vx) > 5) ? 'guardia_walk' : 'guardia_idle';
    }

    // Use stateTimer as per-enemy animation phase so animations reset on state change
    const phase = (e._animPhase = (e._animPhase || 0) + 0); // initialise once
    const img = SpriteAnim.frame(animKey, _ts);

    ctx.save();
    ctx.translate(x + e.w/2, y + e.h/2);
    // Sprites face RIGHT by default; flip when moving/facing LEFT
    if (e.facing === -1) ctx.scale(-1, 1);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -e.w/2, -e.h/2, e.w, e.h);
    }

    // Frozen overlay
    if (frozen) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.40)';
      ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
    } else if (hitShield) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
    }

    ctx.restore();

    if (e.alive && e.hp < e.maxHp) _drawHpBar(ctx, x, y, e);
  }

  // ── Render Gárgola — Sprite Animation ────────────────
  function _drawGargola(ctx, e, x, y) {
    // Draw icicles (world-space, canvas primitives — unchanged)
    ctx.save();
    ctx.fillStyle = '#bae6fd';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    for (const ic of e.icicles) {
      const icx = ic.x - (e.x - x);
      const icy = ic.y - (e.y - y);
      ctx.beginPath();
      ctx.moveTo(icx - 6, icy);
      ctx.lineTo(icx + 6, icy);
      ctx.lineTo(icx, icy + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Select animation key
    const frozen     = e.frozenTimer > 0;
    const isSleeping = e.state === 'sleep';
    const isFalling  = e.state === 'falling_block';
    const isPerched  = e.state === 'perched';

    let animKey;
    if (frozen || isFalling) {
      animKey = 'gargola_frozen';
    } else if (isSleeping || isPerched) {
      animKey = 'gargola_idle';
    } else {
      animKey = 'gargola_fly';
    }

    const img = SpriteAnim.frame(animKey, _ts);

    ctx.save();
    ctx.translate(x + e.w/2, y + e.h/2);
    // Sprites face LEFT by default; flip when facing RIGHT
    if (e.facing === 1) ctx.scale(-1, 1);

    if (isSleeping) ctx.globalAlpha = 0.75;
    if (isFalling)  ctx.globalAlpha = 0.85;

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -e.w/2, -e.h/2, e.w, e.h);
    }

    // Frozen / falling overlay tint
    if (frozen || isFalling) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.40)';
      ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
    } else if (isSleeping) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
    } else if (isPerched) {
      // Posada: destello dorado pulsante = "vulnerable, atacala ahora"
      ctx.globalCompositeOperation = 'source-atop';
      const pulse = 0.25 + Math.sin(_ts / 130) * 0.18;
      ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
      ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
    }

    ctx.restore();
  }

  // ── Render Gota Viviente / Bloque — Sprite Animation ──
  function _drawGota(ctx, e, x, y) {
    const isFrozen = e.state === 'frozen_block';
    const animKey  = isFrozen ? 'gota_frozen' : 'gota_walk';
    const img = SpriteAnim.frame(animKey, _ts);

    ctx.save();
    ctx.translate(x + e.w/2, y + e.h/2);
    // Sprites face LEFT by default; flip when facing RIGHT
    if (e.facing === 1) ctx.scale(-1, 1);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -e.w/2, -e.h/2, e.w, e.h);
    }

    // Frozen overlay + timer bar
    if (isFrozen) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.40)';
      ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
      ctx.globalCompositeOperation = 'source-over';
      // Remaining freeze timer bar (white, bottom of sprite)
      const timerPct = Math.max(0, e.frozenTimer / 4.0);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillRect(-e.w/2 + 4, e.h/2 - 8, (e.w - 8) * timerPct, 3);
    }

    ctx.restore();
  }

  // ── Render Boss: Rey de Escarcha — Sprite Animation ──
  function _drawReyEscarcha(ctx, e, x, y) {
    // ── Draw icicle projectiles (canvas primitives, unchanged) ──
    ctx.save();
    ctx.fillStyle = '#bae6fd';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;
    for (const ic of e.icicles) {
      const icx = ic.x - (e.x - x);
      const icy = ic.y - (e.y - y);
      ctx.beginPath();
      ctx.moveTo(icx - 9, icy);
      ctx.lineTo(icx + 9, icy);
      ctx.lineTo(icx, icy + 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // ── Draw ice-wave particles (canvas primitives, unchanged) ──
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 2;
    for (const p of e.waveParticles) {
      const px = p.x - (e.x - x) - e.w/2;
      const py = p.y - (e.y - y);
      const hPct = Math.min(1.0, (2.5 - p.life) * 4);
      const peakH = 45 * hPct;
      ctx.beginPath();
      ctx.moveTo(px - 14, py);
      ctx.lineTo(px, py - peakH);
      ctx.lineTo(px + 14, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // ── Draw blizzard wind streaks (canvas primitives, unchanged) ──
    if (e.blizzardActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.4)';
      ctx.lineWidth = 3;
      for (const wp of e.blizzardWindParticles) {
        const wpx = wp.x - (e.x - x);
        const wpy = wp.y - (e.y - y);
        ctx.beginPath();
        ctx.moveTo(wpx, wpy);
        ctx.lineTo(wpx + (wp.vx > 0 ? -40 : 40), wpy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Select boss animation key based on state ──
    const isStun   = e.state === 'stun';
    const isDeath  = e.state === 'death';
    const isAttack = e.state === 'attack_wave' || e.state === 'attack_blizzard';
    const isFrozen = e.frozenTimer > 0;

    let animKey;
    if (isFrozen || isStun) {
      animKey = 'boss_frozen';
    } else if (isDeath) {
      animKey = 'boss_frozen'; // use frozen frames for death fade
    } else if (isAttack) {
      animKey = 'boss_attack';
    } else if (Math.abs(e.vx) > 10) {
      animKey = 'boss_walk';
    } else {
      animKey = 'boss_idle';
    }

    const img = SpriteAnim.frame(animKey, _ts);

    // ── Draw boss sprite ──
    ctx.save();
    ctx.translate(x + e.w/2, y + e.h/2);
    // Screen-shake when stunned
    if (isStun) ctx.translate((Math.random() - 0.5) * 6, 0);
    // Sprites face LEFT by default; flip when facing RIGHT
    if (e.facing === 1) ctx.scale(-1, 1);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -e.w/2, -e.h/2, e.w, e.h);
    }

    // Stun / frozen overlay tint
    if (isFrozen || isStun) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
    }

    // Orbiting ice-shard particles (canvas — decorative, kept for premium feel)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(125, 211, 252, 0.8)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    const numShards = 5;
    for (let j = 0; j < numShards; j++) {
      const angle = (_ts * 1.2) + (j * (Math.PI * 2 / numShards));
      const dist  = 60 + Math.sin(_ts * 3 + j) * 8;
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist - 15;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 7);
      ctx.lineTo(sx + 7, sy);
      ctx.lineTo(sx, sy + 7);
      ctx.lineTo(sx - 7, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    _drawBossHealthOverlay(ctx, e);
  }

  function _drawBossHealthOverlay(ctx, e) {
    const W = ctx.canvas.width;
    const barW = Math.min(500, W * 0.7);
    const barH = 14;
    const barX = (W - barW) / 2;
    const barY = 70;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();
    ctx.stroke();

    const fillPct = e.hp / e.maxHp;
    if (fillPct > 0) {
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(1, '#ef4444');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(barX + 2, barY + 2, (barW - 4) * fillPct, barH - 4, 2);
      ctx.fill();
    }

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 12px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText('Rey de Escarcha' + (e.state === 'stun' ? ' (ATURDIDO)' : ''), W/2, barY - 6);

    ctx.restore();
  }

  function _drawHpBar(ctx, sx, sy, e) {
    const bw = e.w;
    const bh = 5;
    const bx = sx;
    const by = sy - 8;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
    ctx.restore();
  }

  function _getTileAt(map, x, y) {
    if (!map) return TILE.AIR;
    const r = Math.floor(y / 48);
    const c = Math.floor(x / 48);
    return map[r]?.[c] || TILE.AIR;
  }

  function getEnemies() { return _enemies; }
  function getBoss()    { return _enemies.find(e => e.type === 'rey_escarcha'); }
  function allDefeated() { return _enemies.every(e => !e.alive); }
  function stunNearby(cx, cy, radius) {
    for (const e of _enemies) {
      if (!e.alive || e.type === 'rey_escarcha') continue;
      if (Math.hypot(e.x + e.w/2 - cx, e.y + e.h/2 - cy) < radius) {
        e.frozenTimer = 2.0;
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(e.x + e.w/2, e.y, '#7dd3fc', 10);
        }
      }
    }
  }

  // Vaciar el sistema al salir del nivel 4 (ver nota en enemies_level3.reset).
  function reset() { _enemies = []; _ts = 0; }

  return {
    preload, reset, spawnFromMap, update, drawAll,
    getEnemies, getBoss, allDefeated, stunNearby,
    hitEnemy, hitByProjectile
  };

})();
