// ═══════════════════════════════════════════════════════
//  ENEMIES_LEVEL4.JS — Coordinador y lógica de enemigos del Nivel 4 (Castillo)
// ═══════════════════════════════════════════════════════

const EnemiesLevel4 = (() => {

  let _enemies = [];
  let _ts = 0;

  const IMAGES = {};

  function preload() {
    const names = ['caballero', 'gargola', 'gota', 'rey_escarcha'];
    names.forEach(n => {
      const img = new Image();
      img.src = `img/level4/${n}.png`;
      IMAGES[n] = img;
    });
  }

  // ── Spawn ─────────────────────────────────────────────
  function spawnFromMap(map, TS) {
    _enemies = [];
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
      state: 'sleep', // sleep | active | falling_block | death
      stateTimer: 0,
      frozenTimer: 0,
      attackCooldown: 1.5,
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
      if (e.stateTimer > 0.5) e.alive = false;
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
      if (e.stateTimer > 0.5) e.alive = false;
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
    }
  }

  // ── Lógica Gota Viviente ──────────────────────────────
  function _updateGota(e, dt, map, ps) {
    if (!e.alive && e.state !== 'death') return;
    if (e.state === 'death') {
      e.stateTimer += dt;
      if (e.stateTimer > 0.5) e.alive = false;
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
    if (!e.alive || e.state === 'death' || e.state === 'frozen_block' || ps.invincible) return;

    // Colisión de hitbox
    const overlapX = (ps.x + ps.w - 4) > e.x && ps.x < (e.x + e.w - 4);
    const overlapY = (ps.y + ps.h) > e.y && ps.y < (e.y + e.h);

    if (overlapX && overlapY) {
      const isStomping = ps.vy >= 0 && (ps.y + ps.h) < (e.y + (e.type === 'rey_escarcha' ? 50 : 25)) && !ps.wasGrounded;

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
        e.state = 'active'; // Se despierta al golpearla
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss');
      }
    }
    else if (e.type === 'rey_escarcha') {
      e.hp--;
      e.state = 'stun';
      e.stateTimer = 1.0; // Aturdido corto por golpe directo
      if (typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss');
      if (typeof Renderer !== 'undefined') {
        Renderer.spawnParticles(e.x + e.w/2, e.y + 40, '#ef4444', 16);
        Renderer.spawnText(e.x + e.w/2, e.y, '-1 HP', '#ef4444');
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
        e.hp = Math.max(0, e.hp - 1);
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnText(e.x + e.w/2, e.y - 15, '❄️ -1 HP (Freno)', '#7dd3fc');
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

  // ── Dibujar Todos ─────────────────────────────────────
  function drawAll(ctx, camX, camY) {
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

  // ── Render Caballero Helado ───────────────────────────
  function _drawCaballero(ctx, e, x, y) {
    ctx.save();
    ctx.translate(x + e.w/2, y + e.h/2);

    if (e.facing === 1) ctx.scale(-1, 1);

    const frozen = e.frozenTimer > 0;
    const hitShield = e.shieldHitTimer > 0;

    const img = IMAGES['caballero'];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -e.w/2, -e.h/2, e.w, e.h);
      if (frozen) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
      } else if (hitShield) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
      }
    } else {
      ctx.fillStyle = frozen ? '#60a5fa' : e.state === 'death' ? '#64748b' : '#334155';
      ctx.beginPath();
      ctx.roundRect(-16, -26, 32, 52, 6);
      ctx.fill();

      ctx.fillStyle = frozen ? '#93c5fd' : '#475569';
      ctx.beginPath();
      ctx.arc(0, -22, 12, Math.PI, 0);
      ctx.fill();

      ctx.fillStyle = frozen ? '#bae6fd' : '#38bdf8';
      ctx.fillRect(-6, -22, 12, 4);

      if (e.shieldActive || frozen) {
        ctx.fillStyle = hitShield ? '#ffffff' : (frozen ? 'rgba(125, 211, 252, 0.9)' : 'rgba(56, 189, 248, 0.85)');
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.moveTo(-24, -20);
        ctx.lineTo(-6, -20);
        ctx.lineTo(-6, 22);
        ctx.lineTo(-15, 32);
        ctx.lineTo(-24, 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(-20, -14, 3, 28);
      } else {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.fillRect(-18, -10, 8, 30);
      }

      if (frozen) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(191, 219, 254, 0.45)';
        ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
      }
    }

    ctx.restore();

    if (e.alive && e.hp < e.maxHp) _drawHpBar(ctx, x, y, e);
  }

  // ── Render Gárgola ────────────────────────────────────
  function _drawGargola(ctx, e, x, y) {
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

    ctx.save();
    ctx.translate(x + e.w/2, y + e.h/2);

    if (e.facing === 1) ctx.scale(-1, 1);

    const frozen = e.frozenTimer > 0;
    const isSleeping = e.state === 'sleep';

    const img = IMAGES['gargola'];
    if (img && img.complete && img.naturalWidth > 0) {
      if (e.state === 'falling_block') {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.75)';
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-e.w/2 + 2, -e.h/2 + 2, e.w - 4, e.h - 4, 8);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.drawImage(img, -e.w/2 + 6, -e.h/2 + 6, e.w - 12, e.h - 12);
        ctx.restore();
      } else {
        if (isSleeping) {
          ctx.save();
          ctx.globalAlpha = 0.7;
          ctx.drawImage(img, -e.w/2, -e.h/2, e.w, e.h);
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = 'rgba(100, 116, 139, 0.4)';
          ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
          ctx.restore();
        } else {
          ctx.drawImage(img, -e.w/2, -e.h/2, e.w, e.h);
          if (frozen) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
            ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
          }
        }
      }
    } else {
      if (e.state === 'falling_block') {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.75)';
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-e.w/2 + 2, -e.h/2 + 2, e.w - 4, e.h - 4, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
        ctx.beginPath();
        ctx.arc(0, -4, 14, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        return;
      }

      ctx.fillStyle = isSleeping ? '#475569' : (frozen ? '#60a5fa' : '#475569');
      ctx.beginPath();
      if (isSleeping) {
        ctx.ellipse(-12, 4, 10, 22, Math.PI*0.1, 0, Math.PI*2);
        ctx.ellipse(12, 4, 10, 22, -Math.PI*0.1, 0, Math.PI*2);
      } else {
        ctx.ellipse(-20, -10, 16, 8, -Math.PI*0.2, 0, Math.PI*2);
        ctx.ellipse(12, -4, 8, 14, Math.PI*0.1, 0, Math.PI*2);
      }
      ctx.fill();

      ctx.fillStyle = isSleeping ? '#64748b' : (frozen ? '#93c5fd' : '#64748b');
      ctx.beginPath();
      ctx.arc(0, 4, 16, 0, Math.PI*2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, -14, 10, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = frozen ? '#60a5fa' : '#334155';
      ctx.beginPath();
      ctx.moveTo(-6, -20); ctx.lineTo(-14, -30); ctx.lineTo(-2, -22);
      ctx.moveTo(6, -20); ctx.lineTo(14, -30); ctx.lineTo(2, -22);
      ctx.fill();

      ctx.fillStyle = isSleeping ? '#334155' : (frozen ? '#bae6fd' : '#38bdf8');
      ctx.beginPath();
      ctx.arc(-4, -14, 2.5, 0, Math.PI*2);
      ctx.arc(4, -14, 2.5, 0, Math.PI*2);
      ctx.fill();

      if (frozen) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(191, 219, 254, 0.45)';
        ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
      }
    }

    ctx.restore();
  }

  // ── Render Gota Viviente / Bloque ─────────────────────
  function _drawGota(ctx, e, x, y) {
    ctx.save();
    ctx.translate(x + e.w/2, y + e.h/2);

    const img = IMAGES['gota'];
    if (img && img.complete && img.naturalWidth > 0) {
      if (e.state === 'frozen_block') {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.roundRect(-e.w/2 + 2, -e.h/2 + 2, e.w - 4, e.h - 4, 6);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.drawImage(img, -e.w/2 + 4, -e.h/2 + 4, e.w - 8, e.h - 8);
        ctx.restore();

        const timerPct = e.frozenTimer / 4.0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(-e.w/2 + 6, e.h/2 - 10, (e.w - 12) * timerPct, 3);
      } else {
        const squeeze = Math.sin(_ts * 10) * 0.06;
        ctx.scale(1 + squeeze, 1 - squeeze);
        ctx.drawImage(img, -e.w/2, -e.h/2, e.w, e.h);
      }
    } else {
      if (e.state === 'frozen_block') {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.roundRect(-e.w/2 + 2, -e.h/2 + 2, e.w - 4, e.h - 4, 6);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(-12, -10);
        ctx.lineTo(8, 12);
        ctx.moveTo(-4, -14);
        ctx.lineTo(-14, -4);
        ctx.moveTo(14, 6);
        ctx.lineTo(6, 14);
        ctx.stroke();

        const timerPct = e.frozenTimer / 4.0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(-e.w/2 + 6, e.h/2 - 10, (e.w - 12) * timerPct, 3);

        ctx.restore();
        return;
      }

      const squeeze = Math.sin(_ts * 10) * 0.08;
      ctx.scale(1 + squeeze, 1 - squeeze);

      const grad = ctx.createRadialGradient(0, 4, 2, 0, 4, 20);
      grad.addColorStop(0, '#7dd3fc');
      grad.addColorStop(1, '#0284c7');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.bezierCurveTo(15, -6, 18, 18, 0, 18);
      ctx.bezierCurveTo(-18, 18, -15, -6, 0, -20);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-6, -4, 4, 8, Math.PI*0.15, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Render Boss: Rey de Escarcha ──────────────────────
  function _drawReyEscarcha(ctx, e, x, y) {
    const ts = _ts;

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

    ctx.save();
    ctx.translate(x + e.w/2, y + e.h/2);

    const isStun = e.state === 'stun';
    const shakeX = isStun ? (Math.random() - 0.5) * 6 : 0;
    ctx.translate(shakeX, 0);

    ctx.fillStyle = 'rgba(125, 211, 252, 0.8)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    const numShards = 5;
    for (let j = 0; j < numShards; j++) {
      const angle = (ts * 1.2) + (j * (Math.PI * 2 / numShards));
      const dist = 75 + Math.sin(ts * 3 + j) * 8;
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist - 15;

      ctx.beginPath();
      ctx.moveTo(sx, sy - 8);
      ctx.lineTo(sx + 8, sy);
      ctx.lineTo(sx, sy + 8);
      ctx.lineTo(sx - 8, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = isStun ? '#475569' : '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(-40, -20);
    ctx.lineTo(40, -20);
    ctx.lineTo(48, 56);
    ctx.lineTo(-48, 56);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isStun ? '#64748b' : '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-30, -32, 60, 80, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isStun ? '#475569' : 'rgba(56, 189, 248, ' + (0.55 + Math.sin(ts*5)*0.2) + ')';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(-36, -30, 16, 0, Math.PI*2);
    ctx.arc(36, -30, 16, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = isStun ? '#475569' : '#0f172a';
    ctx.beginPath();
    ctx.arc(0, -48, 18, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = isStun ? '#cbd5e1' : '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -56);
    ctx.lineTo(-14, -74);
    ctx.lineTo(-6, -60);
    ctx.lineTo(0, -82);
    ctx.lineTo(6, -60);
    ctx.lineTo(14, -74);
    ctx.lineTo(20, -56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isStun ? '#475569' : (e.state.startsWith('attack') ? '#ef4444' : '#67e8f9');
    ctx.beginPath();
    ctx.arc(-7, -46, 3.5, 0, Math.PI*2);
    ctx.arc(7, -46, 3.5, 0, Math.PI*2);
    ctx.fill();

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

  return {
    preload, spawnFromMap, update, drawAll,
    getEnemies, getBoss, allDefeated, stunNearby,
    hitEnemy, hitByProjectile
  };

})();
