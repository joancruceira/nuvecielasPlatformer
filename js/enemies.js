// ═══════════════════════════════════════════════════════
//  ENEMIES.JS — IA de enemigos, jefes y colisiones
// ═══════════════════════════════════════════════════════

const Enemies = (() => {

  const TILE_SIZE_E = 48;
  let enemies = [];

  // ── Tamaños por tipo ──
  const SIZES = {
    walker: { w: 40, h: 44 },
    flyer:  { w: 44, h: 36 },
    boss:   { w: 96, h: 96 },
  };

  const SPEEDS = {
    walker: 95,
    flyer:  110,
    boss:   70,
  };

  const HP = {
    walker: 1,
    flyer:  1,
    boss:   12,
  };

  function init() { enemies = []; }

  function getEnemies() { return enemies; }

  // ── Extraer spawns del mapa ──
  function spawnFromMap(map) {
    enemies = [];
    const rows = map.length;
    const cols = map[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = map[r][c];
        let type = null;
        if (tile === TILE.WALKER) type = 'walker';
        if (tile === TILE.FLYER)  type = 'flyer';
        if (tile === TILE.BOSS)   type = 'boss';
        if (!type) continue;

        const sz = SIZES[type];
        enemies.push({
          type,
          x: c * TILE_SIZE_E,
          y: r * TILE_SIZE_E - sz.h + TILE_SIZE_E,
          w: sz.w,
          h: sz.h,
          vx: type === 'flyer' ? SPEEDS[type] : -SPEEDS[type],
          vy: 0,
          facing: -1,
          hp: HP[type],
          maxHp: HP[type],
          stunTimer: 0,
          alive: true,
          // para flyers
          startY: r * TILE_SIZE_E - sz.h + TILE_SIZE_E,
          flyPhase: Math.random() * Math.PI * 2,
          // para boss
          bossPhase: 1,
          bossTimer: 0,
          bossJumpTimer: 0,
          bossPatternTimer: 0,
          bossPattern: 'patrol',
          activated: false,
        });

        // limpiar tile spawn del mapa
        map[r][c] = TILE.AIR;
      }
    }
  }

  // ── Update ──
  function update(dt, map, playerState, onPlayerHit, onBossDefeated) {
    if (!map) return;

    // BUG FIX: Iterar hacia atrás con copia local para evitar skip al hacer splice
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e.alive) { enemies.splice(i, 1); continue; }

      // stun
      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        e.vx *= 0.85;
        continue;
      }

      if (e.type === 'walker') updateWalker(e, dt, map);
      if (e.type === 'flyer')  updateFlyer(e, dt, map, playerState);
      if (e.type === 'boss')   updateBoss(e, dt, map, playerState, onBossDefeated);

      // colisión con jugador
      checkPlayerCollision(e, playerState, onPlayerHit);
    }
  }

  // ── Walker ──
  function updateWalker(e, dt, map) {
    e.x += e.vx * dt;

    // gravedad
    e.vy += 900 * dt;
    e.y += e.vy * dt;

    const rows = map.length;
    const cols = map[0].length;

    // BUG FIX: Verificar límites de fila antes de acceder a map[r][c]
    const r  = Math.floor((e.y + e.h) / TILE_SIZE_E);
    const cL = Math.floor((e.x + 4)       / TILE_SIZE_E);
    const cR = Math.floor((e.x + e.w - 4) / TILE_SIZE_E);

    let onGround = false;

    if (r >= 0 && r < rows) {
      for (let c = cL; c <= cR; c++) {
        if (c >= 0 && c < cols) {
          const t = map[r][c];
          if (t === TILE.GROUND || t === TILE.BLOCK || t === TILE.PLATFORM) {
            e.y = r * TILE_SIZE_E - e.h;
            e.vy = 0;
            onGround = true;
          }
        }
      }
    }

    // voltear al llegar al borde o pared
    const frontC = Math.floor((e.x + (e.vx > 0 ? e.w + 2 : -2)) / TILE_SIZE_E);
    const rMid   = Math.floor((e.y + e.h / 2)  / TILE_SIZE_E);
    const rEdge  = Math.floor((e.y + e.h + 4)  / TILE_SIZE_E);

    // BUG FIX: Verificar todos los rangos antes de acceder al mapa
    if (frontC >= 0 && frontC < cols) {
      // pared
      if (rMid >= 0 && rMid < rows) {
        const wallT = map[rMid][frontC];
        if (wallT === TILE.GROUND || wallT === TILE.BLOCK) {
          e.vx = -e.vx;
          e.facing = e.vx > 0 ? 1 : -1;
        }
      }
      // borde (no hay suelo adelante): solo evaluar si rEdge es válido
      if (rEdge >= 0 && rEdge < rows) {
        const groundAhead = map[rEdge][frontC];
        if (!groundAhead || (groundAhead !== TILE.GROUND && groundAhead !== TILE.BLOCK)) {
          e.vx = -e.vx;
          e.facing = e.vx > 0 ? 1 : -1;
        }
      }
    }

    // límite del mapa
    if (e.x < 0) { e.x = 0; e.vx = Math.abs(e.vx); e.facing = 1; }
    if (e.x + e.w > cols * TILE_SIZE_E) { e.x = cols * TILE_SIZE_E - e.w; e.vx = -Math.abs(e.vx); e.facing = -1; }

    e.facing = e.vx > 0 ? 1 : -1;
  }

  // ── Flyer ──
  function updateFlyer(e, dt, map, playerState) {
    e.flyPhase += dt * 1.8;
    e.x += e.vx * dt;
    e.y = e.startY + Math.sin(e.flyPhase) * 55;

    const cols = map[0].length;
    if (e.x < 0) { e.x = 0; e.vx = Math.abs(e.vx); }
    if (e.x + e.w > cols * TILE_SIZE_E) { e.x = cols * TILE_SIZE_E - e.w; e.vx = -Math.abs(e.vx); }

    // agresivo: si el jugador está cerca, volar hacia él
    const dx = playerState.x - e.x;
    const dy = playerState.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 280 && dist > 20) {
      e.x += (dx / dist) * SPEEDS.flyer * 0.35 * dt;
      e.y += (dy / dist) * SPEEDS.flyer * 0.25 * dt;
    }

    e.facing = e.vx > 0 ? 1 : -1;
  }

  // ── Boss ──
  function updateBoss(e, dt, map, playerState, onDefeated) {
    const dx = playerState.x - e.x;
    const dist = Math.abs(dx);

    if (!e.activated && dist < 600) e.activated = true;
    if (!e.activated) return;

    e.bossTimer += dt;
    e.bossPatternTimer += dt;

    const ratio = e.hp / e.maxHp;
    if (ratio > 0.66) e.bossPhase = 1;
    else if (ratio > 0.33) e.bossPhase = 2;
    else e.bossPhase = 3;

    const speed = SPEEDS.boss * (1 + (e.bossPhase - 1) * 0.45);
    const patternDuration = e.bossPhase === 3 ? 1.8 : e.bossPhase === 2 ? 2.4 : 3.0;

    if (e.bossPatternTimer > patternDuration) {
      e.bossPatternTimer = 0;
      const patterns = ['patrol', 'chase', 'charge'];
      const available = e.bossPhase >= 2 ? patterns : ['patrol', 'chase'];
      e.bossPattern = available[Math.floor(Math.random() * available.length)];
    }

    if (e.bossPattern === 'patrol') {
      e.vx = e.facing * speed;
    } else if (e.bossPattern === 'chase') {
      e.vx = dx > 0 ? speed : -speed;
    } else if (e.bossPattern === 'charge') {
      e.vx = dx > 0 ? speed * 2.2 : -speed * 2.2;
    }

    // gravedad
    e.vy += 900 * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // colisión suelo — chequea el tile central bajo el boss
    const rows = map.length;
    const cols = map[0].length;
    const rFloor = Math.floor((e.y + e.h) / TILE_SIZE_E);
    const cMid   = Math.floor((e.x + e.w / 2) / TILE_SIZE_E);

    if (rFloor >= 0 && rFloor < rows && cMid >= 0 && cMid < cols) {
      const t = map[rFloor][cMid];
      if (t === TILE.GROUND || t === TILE.BLOCK) {
        e.y = rFloor * TILE_SIZE_E - e.h;
        e.vy = 0;

        e.bossJumpTimer += dt;
        const jumpInterval = e.bossPhase === 3 ? 1.2 : e.bossPhase === 2 ? 1.8 : 2.5;
        if (e.bossJumpTimer > jumpInterval) {
          e.vy = -580 - (e.bossPhase - 1) * 80;
          e.bossJumpTimer = 0;
        }
      }
    }

    // Si el boss cae fuera del mapa → cuenta como derrota
    if (e.y > rows * TILE_SIZE_E + 80) {
      e.alive = false;
      Renderer.spawnText(e.x + e.w / 2, rows * TILE_SIZE_E - 40, '¡AL FOSO! 😱', '#f9c846');
      Renderer.flash('#f9c846', 0.75);
      onDefeated && onDefeated();
    }

    // paredes laterales del mapa
    if (e.x < 0) { e.x = 0; e.facing = 1; }
    if (e.x + e.w > cols * TILE_SIZE_E) { e.x = cols * TILE_SIZE_E - e.w; e.facing = -1; }
    e.facing = e.vx >= 0 ? 1 : -1;

    // BUG FIX: Llamar onDefeated cuando el boss muere (faltaba este callback)
    if (e.hp <= 0 && e.alive) {
      e.alive = false;
      onDefeated && onDefeated();
    }
  }

  // ── Colisión con el jugador ──
  function checkPlayerCollision(e, ps, onPlayerHit) {
    if (!e.alive) return; // BUG FIX: salir si el enemigo ya murió en este mismo frame

    const eLeft = e.x, eRight = e.x + e.w;
    const eTop = e.y,  eBot = e.y + e.h;
    const pLeft = ps.x, pRight = ps.x + ps.w;
    const pTop = ps.y,  pBot = ps.y + ps.h;

    const overlapX = pRight > eLeft + 4 && pLeft < eRight - 4;
    const overlapY = pBot > eTop && pTop < eBot;

    if (!overlapX || !overlapY) return;

    // pisada: jugador cae desde arriba
    // Usar wasGrounded en lugar de grounded: en el mismo frame que se aterriza,
    // grounded ya es true pero la colisión todavía no fue procesada → falso negativo.
    // La ventana vertical es generosa (40px para boss, 28px para normales).
    const stompThreshold = e.type === 'boss' ? 40 : 28;
    const stomping = ps.vy >= 0 && pBot < eTop + stompThreshold && !ps.wasGrounded;
    if (stomping) {
      hitEnemy(e);
      onPlayerHit && onPlayerHit('stomp', e);
    } else {
      if (!ps.invincible) {
        onPlayerHit && onPlayerHit('damage', e);
      }
    }
  }

  // ── Golpe de tierra (Nuve) ──
  function groundPound(cx, cy, radius) {
    let hit = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h / 2;
      if (Math.hypot(ex - cx, ey - cy) < radius) {
        if (e.type === 'boss') {
          e.stunTimer = 1.5;
          e.hp = Math.max(0, e.hp - 2);
          Renderer.spawnText(ex, e.y, '-2 💥', '#ef4444');
          if (e.hp <= 0 && e.alive) {
            e.alive = false;
          }
        } else {
          hitEnemy(e);
        }
        hit = true;
      }
    }
    return hit;
  }

  function hitEnemy(e) {
    if (!e.alive) return; // BUG FIX: evitar procesar enemigos ya muertos
    if (e.type === 'boss') {
      e.hp -= 1;
      e.stunTimer = 0.6;
      Renderer.spawnParticles(e.x + e.w / 2, e.y, '#ef4444', 14);
      Renderer.spawnText(e.x + e.w / 2, e.y - 10, '-1', '#ef4444');
      if (e.hp <= 0) {
        e.alive = false;
        Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#f9c846', 32);
        Renderer.flash('#f9c846', 0.6);
      }
    } else {
      e.alive = false;
      Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#f9c846', 14);
      Renderer.spawnText(e.x + e.w / 2, e.y, '+100', '#f9c846');
    }
  }

  function stunNearby(cx, cy, radius) {
    for (const e of enemies) {
      if (!e.alive || e.type === 'boss') continue;
      if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < radius) {
        e.stunTimer = 2.0;
        Renderer.spawnParticles(e.x + e.w / 2, e.y, '#fbbf24', 10);
      }
    }
  }

  function isBossAlive() {
    return enemies.some(e => e.type === 'boss' && e.alive);
  }

  function getBossEnemy() {
    return enemies.find(e => e.type === 'boss');
  }

  return {
    init, spawnFromMap, update, getEnemies,
    groundPound, stunNearby, hitEnemy,
    isBossAlive, getBossEnemy,
  };

})();
