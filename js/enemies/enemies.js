// ═══════════════════════════════════════════════════════
//  ENEMIES.JS — Coordinador: spawn, update, colisiones
//  Delega lógica y render a cada módulo específico
//  Carga: walker.js → serpiente.js → boss.js → enemies.js
// ═══════════════════════════════════════════════════════

const Enemies = (() => {

  const TILE_SIZE_E = 48;
  let enemies = [];

  // Módulos registrados: tipo → { create, update, draw, preload? }
  const MODULES = {
    walker:    Walker,
    serpiente: Serpiente,
    boss:      Boss,
  };

  // Mapa tile → tipo de enemigo
  const TILE_TO_TYPE = {
    [10]: 'walker',
    [11]: 'flyer',     // flyer todavía inline hasta tener módulo
    [12]: 'boss',
    [13]: 'serpiente',
  };

  // ── Precargar sprites de todos los módulos ──
  function preloadAll() {
    Object.values(MODULES).forEach(mod => mod.preload && mod.preload());
  }

  function init() {
    enemies = [];
    preloadAll();
  }

  function getEnemies() { return enemies; }

  // ── Extraer spawns del mapa ──
  function spawnFromMap(map) {
    enemies = [];
    const rows = map.length;
    const cols = map[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = map[r][c];
        const type = TILE_TO_TYPE[tile];
        if (!type) continue;

        const spawnX = c * TILE_SIZE_E;
        const spawnY = r * TILE_SIZE_E; // cada módulo ajusta su propio offset si necesita

        let e;
        if (MODULES[type]) {
          e = MODULES[type].create(spawnX, spawnY);
        } else if (type === 'flyer') {
          e = _createFlyer(c, r);
        } else {
          continue;
        }

        enemies.push(e);
        map[r][c] = TILE.AIR;
      }
    }
  }

  // ── Flyer inline (hasta tener su propio módulo) ──
  function _createFlyer(c, r) {
    const startY = r * TILE_SIZE_E - 36 + TILE_SIZE_E;
    return {
      type: 'flyer',
      x: c * TILE_SIZE_E,
      y: startY,
      w: 44, h: 36,
      vx: 110,
      vy: 0,
      facing: 1,
      hp: 1, maxHp: 1,
      stunTimer: 0,
      alive: true,
      startY,
      flyPhase: Math.random() * Math.PI * 2,
    };
  }

  function _updateFlyer(e, dt, map, ps) {
    e.flyPhase += dt * 1.8;
    e.x += e.vx * dt;
    e.y  = e.startY + Math.sin(e.flyPhase) * 55;

    const cols = map[0].length;
    if (e.x < 0)                     { e.x = 0;                     e.vx =  Math.abs(e.vx); }
    if (e.x + e.w > cols * TILE_SIZE_E) { e.x = cols * TILE_SIZE_E - e.w; e.vx = -Math.abs(e.vx); }

    const dx = ps.x - e.x, dy = ps.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 280 && dist > 20) {
      e.x += (dx / dist) * 110 * 0.35 * dt;
      e.y += (dy / dist) * 110 * 0.25 * dt;
    }
    e.facing = e.vx > 0 ? 1 : -1;
  }

  function _drawFlyer(ctx, e, ts) {
    const { x, y, w, h, facing, stunTimer } = e;
    const flutter = Math.sin(ts / 120) * 5;
    ctx.save();
    ctx.globalAlpha = stunTimer > 0 ? 0.55 : 1;
    if (facing === -1) { ctx.translate(x + w, y + flutter); ctx.scale(-1, 1); }
    else ctx.translate(x, y + flutter);
    ctx.fillStyle = stunTimer > 0 ? '#888' : '#6b21a8';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.55, w * 0.32, h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = stunTimer > 0 ? '#666' : '#7c3aed';
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.5);
    ctx.bezierCurveTo(0, h * 0.2, -w * 0.3, h * 0.8, w * 0.2, h * 0.65);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.8, h * 0.5);
    ctx.bezierCurveTo(w, h * 0.2, w * 1.3, h * 0.8, w * 0.8, h * 0.65);
    ctx.fill();
    ctx.fillStyle = stunTimer > 0 ? '#aaa' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(w * 0.40, h * 0.52, 4, 0, Math.PI * 2);
    ctx.arc(w * 0.60, h * 0.52, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Update principal ──
  function update(dt, map, ps, onPlayerHit, onBossDefeated) {
    if (!map) return;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e.alive) { enemies.splice(i, 1); continue; }

      // Delegar update al módulo correspondiente
      if (e.type === 'walker')    Walker.update(e, dt, map, ps);
      else if (e.type === 'flyer') _updateFlyer(e, dt, map, ps);
      else if (e.type === 'boss')  Boss.update(e, dt, map, ps, onBossDefeated);
      else if (MODULES[e.type])    MODULES[e.type].update(e, dt, map, ps);

      checkPlayerCollision(e, ps, onPlayerHit);
    }
  }

  // ── Colisión jugador-enemigo ──
  function checkPlayerCollision(e, ps, onPlayerHit) {
    if (!e.alive) return;

    const overlapX = (ps.x + ps.w) > (e.x + 4) && ps.x < (e.x + e.w - 4);
    const overlapY = (ps.y + ps.h) > e.y && ps.y < (e.y + e.h);
    if (!overlapX || !overlapY) return;

    const stompThreshold = e.type === 'boss' ? 40 : 28;
    const stomping = ps.vy >= 0 && (ps.y + ps.h) < (e.y + stompThreshold) && !ps.wasGrounded;

    if (stomping) {
      hitEnemy(e);
      onPlayerHit && onPlayerHit('stomp', e);
    } else if (!ps.invincible) {
      onPlayerHit && onPlayerHit('damage', e);
    }
  }

  // ── Dibujar todos los enemigos ──
  function drawAll(ctx, camX, camY, ts) {
    for (const e of enemies) {
      const screenE = { ...e, x: e.x - camX, y: e.y - camY };

      if (e.type === 'walker')      Walker.draw(ctx, screenE, ts);
      else if (e.type === 'flyer')  _drawFlyer(ctx, screenE, ts);
      else if (e.type === 'boss')   Boss.draw(ctx, screenE, ts);
      else if (MODULES[e.type])     MODULES[e.type].draw(ctx, screenE, ts);
    }
  }

  // ── Golpear enemigo ──
  function hitEnemy(e) {
    if (!e.alive) return;
    if (e.type === 'boss') {
      e.hp       -= 1;
      e.stunTimer = 0.6;
      Renderer.spawnParticles(e.x + e.w / 2, e.y, '#ef4444', 14);
      Renderer.spawnText(e.x + e.w / 2, e.y - 10, '-1', '#ef4444');
      if (e.hp <= 0) {
        e.alive = false;
        Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#f9c846', 32);
        Renderer.flash('#f9c846', 0.6);
        // BUG FIX: hitEnemy del boss ahora también activa onBossDefeated
        // Se dispara desde engine via checkFireballs → el engine llama handleBossDefeated
        // La señal sale por el evento custom para no acoplar este módulo al engine
        window.dispatchEvent(new CustomEvent('bossDefeated'));
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

  function groundPound(cx, cy, radius) {
    let hit = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < radius) {
        if (e.type === 'boss') {
          e.stunTimer = 1.5;
          e.hp = Math.max(0, e.hp - 2);
          Renderer.spawnText(e.x + e.w / 2, e.y, '-2 💥', '#ef4444');
          if (e.hp <= 0 && e.alive) { e.alive = false; window.dispatchEvent(new CustomEvent('bossDefeated')); }
        } else {
          hitEnemy(e);
        }
        hit = true;
      }
    }
    return hit;
  }

  function isBossAlive()  { return enemies.some(e => e.type === 'boss' && e.alive); }
  function getBossEnemy() { return enemies.find(e => e.type === 'boss'); }

  return {
    init, spawnFromMap, update, drawAll, getEnemies,
    hitEnemy, stunNearby, groundPound,
    isBossAlive, getBossEnemy,
  };

})();