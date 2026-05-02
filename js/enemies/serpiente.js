// ═══════════════════════════════════════════════════════
//  SERPIENTE.JS — Enemigo serpiente del bosque
//  Fila superior (enroscada): idle0, idle1, attack
//  Fila inferior (deslizándose): walk0, walk1, walk2
// ═══════════════════════════════════════════════════════

const Serpiente = (() => {

  const TS           = 48;
  const BASE_SPEED   = 75;
  const CHASE_RANGE  = 260;
  const ATTACK_RANGE = 55;

  const frames = {};

  function preload() {
    ['serpiente_idle0','serpiente_idle1','serpiente_attack',
     'serpiente_walk0','serpiente_walk1','serpiente_walk2'].forEach(name => {
      const img = new Image();
      img.src = `img/${name}.png`;
      frames[name] = img;
    });
  }

  function create(x, y) {
    return {
      type:        'serpiente',
      x,
      y:           y - 52,
      w:           56, h: 52,
      vx:          -BASE_SPEED,
      vy:          0,
      facing:      -1,
      hp:          2, maxHp: 2,
      stunTimer:   0,
      frozenTimer: 0,
      attackTimer: 0,
      walkFrame:   0,
      walkTick:    0,
      alive:       true,
      onGround:    false,
    };
  }

  function update(e, dt, map, ps) {
    const rows = map.length;
    const cols = map[0].length;

    if ((e.frozenTimer || 0) > 0) {
      e.frozenTimer -= dt;
      e.vx = 0;
      e.vy      += 900 * dt;
      e.y       += e.vy * dt;
      e.onGround = false;
      _resolveFloor(e, map, rows, cols);
      return;
    }

    if (e.stunTimer > 0) {
      e.stunTimer -= dt;
      e.vx *= 0.80;
    } else {
      _decideSpeed(e, dt, ps);
    }

    e.x += e.vx * dt;
    _resolveWalls(e, map, rows, cols);
    _applyGravity(e, dt, map, rows, cols);
    if (e.onGround) _checkEdge(e, map, rows, cols);

    if (e.x < 0)               { e.x = 0;               e.vx =  Math.abs(e.vx); }
    if (e.x + e.w > cols * TS) { e.x = cols * TS - e.w; e.vx = -Math.abs(e.vx); }
    if (e.y > rows * TS + 60)  e.alive = false;

    e.facing = e.vx >= 0 ? 1 : -1;

    // Animar frames de caminata a ~6fps
    e.walkTick += dt;
    if (e.walkTick > 0.16) { e.walkTick = 0; e.walkFrame = (e.walkFrame + 1) % 3; }
  }

  function _decideSpeed(e, dt, ps) {
    const dx    = (ps.x + ps.w / 2) - (e.x + e.w / 2);
    const dy    = (ps.y + ps.h / 2) - (e.y + e.h / 2);
    const distH = Math.abs(dx);
    const distV = Math.abs(dy);
    if (e.attackTimer > 0) e.attackTimer -= dt;
    const sameLevel = distV < 144;
    if (sameLevel && distH < ATTACK_RANGE) {
      e.vx = dx > 0 ? BASE_SPEED * 2.2 : -BASE_SPEED * 2.2;
      if (e.attackTimer <= 0) e.attackTimer = 0.4;
    } else if (sameLevel && distH < CHASE_RANGE) {
      const spd = BASE_SPEED * (1 + (1 - distH / CHASE_RANGE) * 0.6);
      e.vx = dx > 0 ? spd : -spd;
    }
    if (Math.abs(e.vx) < 5) e.vx = BASE_SPEED * (e.facing || -1);
  }

  function _applyGravity(e, dt, map, rows, cols) {
    e.vy      += 900 * dt;
    e.y       += e.vy * dt;
    e.onGround = false;
    _resolveFloor(e, map, rows, cols);
  }

  function _resolveFloor(e, map, rows, cols) {
    if (e.vy < 0) return;
    const rFloor = Math.floor((e.y + e.h) / TS);
    const cL     = Math.max(0,        Math.floor((e.x + 4)        / TS));
    const cR     = Math.min(cols - 1, Math.floor((e.x + e.w - 4) / TS));
    if (rFloor < 0 || rFloor >= rows) return;
    for (let c = cL; c <= cR; c++) {
      const t = map[rFloor]?.[c];
      if (t === TILE.GROUND || t === TILE.BLOCK || t === TILE.PLATFORM) {
        e.y = rFloor * TS - e.h; e.vy = 0; e.onGround = true; return;
      }
    }
  }

  function _resolveWalls(e, map, rows, cols) {
    const rTop = Math.max(0,        Math.floor((e.y + 4)        / TS));
    const rBot = Math.min(rows - 1, Math.floor((e.y + e.h - 4) / TS));
    if (e.vx > 0) {
      const cR = Math.floor((e.x + e.w) / TS);
      if (cR >= 0 && cR < cols) {
        for (let r = rTop; r <= rBot; r++) {
          const t = map[r]?.[cR];
          if (t === TILE.GROUND || t === TILE.BLOCK) { e.x = cR * TS - e.w; e.vx = -Math.abs(e.vx); return; }
        }
      }
    } else if (e.vx < 0) {
      const cL = Math.floor(e.x / TS);
      if (cL >= 0 && cL < cols) {
        for (let r = rTop; r <= rBot; r++) {
          const t = map[r]?.[cL];
          if (t === TILE.GROUND || t === TILE.BLOCK) { e.x = (cL + 1) * TS; e.vx = Math.abs(e.vx); return; }
        }
      }
    }
  }

  function _checkEdge(e, map, rows, cols) {
    const lookX  = e.vx > 0 ? e.x + e.w + 4 : e.x - 4;
    const cFront = Math.floor(lookX / TS);
    const rFoot  = Math.floor((e.y + e.h + 2) / TS);
    if (cFront < 0 || cFront >= cols || rFoot < 0 || rFoot >= rows) { e.vx = -e.vx; return; }
    const t = map[rFoot]?.[cFront];
    if (t !== TILE.GROUND && t !== TILE.BLOCK) e.vx = -e.vx;
  }

  // ── Draw ──
  function draw(ctx, e, camX, camY, ts) {
    const sx = e.x - camX;
    const sy = e.y - camY;
    const { w, h, facing, stunTimer, frozenTimer, attackTimer, walkFrame } = e;
    const frozen = (frozenTimer || 0) > 0;

    // Sombra
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx + w / 2, sy + h + 3, w * 0.6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Seleccionar frame
    let frameName;
    if (frozen)              frameName = 'serpiente_idle0';
    else if (stunTimer > 0)  frameName = 'serpiente_idle1';
    else if (attackTimer > 0) frameName = 'serpiente_attack';
    else frameName = ['serpiente_walk0','serpiente_walk1','serpiente_walk2'][walkFrame || 0];

    const img = frames[frameName];
    const bob = frozen || stunTimer > 0 ? 0 : Math.sin(ts / 280) * 1.8;

    ctx.save();
    // Centrar sprite en la hitbox
    ctx.translate(sx + w / 2, sy + h / 2 + bob);
    // El sprite de la serpiente mira a la izquierda por defecto
    if (facing === 1) ctx.scale(-1, 1);

    ctx.globalAlpha = frozen ? 0.8 : stunTimer > 0 ? 0.65 : 1.0;

    if (img && img.complete && img.naturalWidth > 0) {
      // Aspect ratio del sprite recortado
      const ar   = img.naturalWidth / img.naturalHeight;
      // Dibujar más grande para que se vea bien — la hitbox w×h es más pequeña que el sprite visual
      const dh   = h * 2.8;
      const dw   = dh * ar;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

      // Tinte
      if (frozen) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(100,180,255,0.52)';
        ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
      } else if (stunTimer > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,60,60,0.42)';
        ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
      }
    } else {
      // Fallback
      ctx.fillStyle = frozen ? '#60a5fa' : '#22c55e';
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.46, h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = frozen ? '#3b82f6' : '#15803d';
      ctx.beginPath();
      ctx.arc(w * 0.28, -h * 0.12, w * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Barra de HP (2 puntos)
    if (e.maxHp > 1) {
      const bw = w * 1.1, bx = sx + w / 2 - bw / 2, by = sy - 10;
      const ratio = Math.max(0, e.hp / e.maxHp);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, 5, 2); ctx.fill();
      ctx.fillStyle = frozen ? '#60a5fa' : '#22c55e';
      ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, 5, 2); ctx.fill();
      ctx.restore();
    }
  }

  return { preload, create, update, draw };

})();