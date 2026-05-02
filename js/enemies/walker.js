// ═══════════════════════════════════════════════════════
//  WALKER.JS — Enemigo corazón malvado
//  Estados: patrulla → persecución → ataque
//  Sprites: walker_idle0/1, walker_attack, walker_hit
// ═══════════════════════════════════════════════════════

const Walker = (() => {

  const TS           = 48;
  const BASE_SPEED   = 90;
  const CHASE_RANGE  = 300;
  const ATTACK_RANGE = 60;

  // ── Sprites ──
  const frames = {};
  function preload() {
    ['walker_idle0', 'walker_idle1', 'walker_hit', 'walker_attack'].forEach(name => {
      const img = new Image();
      img.src   = `img/${name}.png`;
      frames[name] = img;
    });
  }

  // ── Crear instancia ──
  function create(x, y) {
    return {
      type:        'walker',
      x,
      y:           y - 44,   // quedar parado sobre el tile de spawn
      w:           44,
      h:           44,
      vx:          -BASE_SPEED,
      vy:          0,
      facing:      -1,
      hp:          1, maxHp: 1,
      stunTimer:   0,
      attackTimer: 0,
      frozenTimer: 0,
      alive:       true,
      onGround:    false,
    };
  }

  // ────────────────────────────────────────────────────
  //  UPDATE
  // ────────────────────────────────────────────────────
  function update(e, dt, map, ps) {
    const rows = map.length;
    const cols = map[0].length;

    // Congelado por hielo de Ciela
    if ((e.frozenTimer || 0) > 0) {
      e.frozenTimer -= dt;
      e.vx = 0;
      // Aún aplicar gravedad
      e.vy      += 900 * dt;
      e.y       += e.vy * dt;
      e.onGround = false;
      _resolveFloor(e, map, rows, cols);
      if (e.x < 0)               { e.x = 0; }
      if (e.x + e.w > cols * TS) { e.x = cols * TS - e.w; }
      return;
    }

    // Stun: frenar; al salir retomar patrulla con vx base
    if (e.stunTimer > 0) {
      e.stunTimer -= dt;
      e.vx *= 0.75;
      if (Math.abs(e.vx) < 5) e.vx = 0;
    } else {
      _decideSpeed(e, dt, ps);
    }

    // 1) Mover X y resolver paredes
    e.x += e.vx * dt;
    _resolveWalls(e, map, rows, cols);

    // 2) Gravedad + mover Y + resolver suelo
    e.vy      += 900 * dt;
    e.y       += e.vy * dt;
    e.onGround = false;
    _resolveFloor(e, map, rows, cols);

    // 3) Voltear en borde siempre que esté en el suelo
    if (e.onGround) _checkEdge(e, map, rows, cols);

    // 4) Límites del mapa
    if (e.x < 0)               { e.x = 0;               e.vx =  Math.abs(e.vx); }
    if (e.x + e.w > cols * TS) { e.x = cols * TS - e.w; e.vx = -Math.abs(e.vx); }

    // 5) Caída al vacío
    if (e.y > rows * TS + 60) e.alive = false;

    e.facing = e.vx >= 0 ? 1 : -1;
  }

  function _decideSpeed(e, dt, ps) {
    const dx    = (ps.x + ps.w / 2) - (e.x + e.w / 2);
    const dy    = (ps.y + ps.h / 2) - (e.y + e.h / 2);
    const distH = Math.abs(dx);
    const distV = Math.abs(dy);

    if (e.attackTimer > 0) e.attackTimer -= dt;

    // Solo perseguir si el jugador está en el mismo plano vertical (±3 tiles)
    // Evita que el walker persiga al jugador cuando está sobre él y caiga al vacío
    const sameLevel = distV < 144;

    if (sameLevel && distH < ATTACK_RANGE) {
      e.vx = dx > 0 ? BASE_SPEED * 2.0 : -BASE_SPEED * 2.0;
      if (e.attackTimer <= 0) e.attackTimer = 0.35;
    } else if (sameLevel && distH < CHASE_RANGE) {
      const spd = BASE_SPEED * (1 + (1 - distH / CHASE_RANGE) * 0.7);
      e.vx = dx > 0 ? spd : -spd;
    }
    // Fuera de rango o jugador muy arriba: patrulla normal
    if (Math.abs(e.vx) < 5) e.vx = BASE_SPEED * (e.facing || -1);
  }

  // Colisión horizontal: separar en derecha e izquierda para evitar doble inversión
  function _resolveWalls(e, map, rows, cols) {
    const rTop = Math.max(0,        Math.floor((e.y + 4)        / TS));
    const rBot = Math.min(rows - 1, Math.floor((e.y + e.h - 4) / TS));

    if (e.vx > 0) {
      const cRight = Math.floor((e.x + e.w) / TS);
      if (cRight >= 0 && cRight < cols) {
        for (let r = rTop; r <= rBot; r++) {
          const t = map[r]?.[cRight];
          if (t === TILE.GROUND || t === TILE.BLOCK) {
            e.x  = cRight * TS - e.w;
            e.vx = -Math.abs(e.vx);
            return;
          }
        }
      }
    } else if (e.vx < 0) {
      const cLeft = Math.floor(e.x / TS);
      if (cLeft >= 0 && cLeft < cols) {
        for (let r = rTop; r <= rBot; r++) {
          const t = map[r]?.[cLeft];
          if (t === TILE.GROUND || t === TILE.BLOCK) {
            e.x  = (cLeft + 1) * TS;
            e.vx =  Math.abs(e.vx);
            return;
          }
        }
      }
    }
  }

  // Colisión vertical: suelo y plataformas
  function _resolveFloor(e, map, rows, cols) {
    if (e.vy < 0) return;
    const rFloor = Math.floor((e.y + e.h) / TS);
    const cL     = Math.max(0,        Math.floor((e.x + 4)        / TS));
    const cR     = Math.min(cols - 1, Math.floor((e.x + e.w - 4) / TS));
    if (rFloor < 0 || rFloor >= rows) return;
    for (let c = cL; c <= cR; c++) {
      const t = map[rFloor]?.[c];
      if (t === TILE.GROUND || t === TILE.BLOCK || t === TILE.PLATFORM) {
        e.y        = rFloor * TS - e.h;
        e.vy       = 0;
        e.onGround = true;
        return;
      }
    }
  }

  // Voltear en borde — se aplica SIEMPRE (patrulla Y persecución)
  // El corazón nunca se tira al vacío voluntariamente
  function _checkEdge(e, map, rows, cols) {
    const lookX  = e.vx > 0 ? e.x + e.w + 4 : e.x - 4;
    const cFront = Math.floor(lookX / TS);
    const rFoot  = Math.floor((e.y + e.h + 2) / TS);

    if (cFront < 0 || cFront >= cols || rFoot < 0 || rFoot >= rows) {
      e.vx = -e.vx;
      return;
    }

    const t = map[rFoot]?.[cFront];
    if (t !== TILE.GROUND && t !== TILE.BLOCK) {
      e.vx = -e.vx;
    }
  }

  // ── Draw ──
  function draw(ctx, e, camX, camY, ts) {
    const x = e.x - camX, y = e.y - camY;
    const { w, h, facing, stunTimer, attackTimer } = e;

    // Sombra
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 3, w * 0.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Frame
    let frameName;
    if (stunTimer > 0)        frameName = 'walker_hit';
    else if (attackTimer > 0) frameName = 'walker_attack';
    else frameName = Math.floor(ts / 250) % 2 === 0 ? 'walker_idle0' : 'walker_idle1';

    const frozen = (e.frozenTimer || 0) > 0;
    const img = frames[frozen ? 'walker_hit' : frameName];
    const bob = (stunTimer > 0 || frozen) ? 0 : Math.sin(ts / 220) * 2;

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2 + bob);
    if (facing === -1) ctx.scale(-1, 1);

    if (img && img.complete && img.naturalWidth > 0) {
      const dw = w * 1.9;
      const dh = h * 1.9;
      ctx.globalAlpha = stunTimer > 0 ? 0.65 : 1.0;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      if (frozen) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(100,180,255,0.55)';
        ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
      } else if (stunTimer > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,60,60,0.45)';
        ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
      }
    } else {
      ctx.fillStyle = stunTimer > 0 ? '#888' : '#e85d7a';
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.42, h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return { preload, create, update, draw };

})();