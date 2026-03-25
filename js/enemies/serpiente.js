// ═══════════════════════════════════════════════════════
//  SERPIENTE.JS — Enemigo serpiente (próximamente)
//  Estados: ondulación → ataque en rango → envolver
//  Sprites: pendientes de diseño
// ═══════════════════════════════════════════════════════

const Serpiente = (() => {

  const TILE_SIZE  = 48;
  const BASE_SPEED = 80;

  const frames = {};
  function preload() {
    // Se agregan cuando estén los sprites
    // ['serpiente_idle', 'serpiente_attack'].forEach(name => { ... });
  }

  function create(x, y) {
    return {
      type:    'serpiente',
      x, y,
      w: 48, h: 32,
      vx: -BASE_SPEED,
      vy: 0,
      facing:  -1,
      hp: 2, maxHp: 2,
      stunTimer:  0,
      wavePhase:  Math.random() * Math.PI * 2,
      alive: true,
    };
  }

  function update(e, dt, map, ps) {
    if (e.stunTimer > 0) { e.stunTimer -= dt; e.vx *= 0.85; return; }

    const rows = map.length;
    const cols = map[0].length;

    // Movimiento ondulante
    e.wavePhase += dt * 2.5;
    e.x += e.vx * dt;
    e.vy += 900 * dt;
    e.y  += e.vy * dt;

    // Colisión suelo
    const r  = Math.floor((e.y + e.h) / TILE_SIZE);
    const cL = Math.floor((e.x + 4) / TILE_SIZE);
    const cR = Math.floor((e.x + e.w - 4) / TILE_SIZE);
    if (r >= 0 && r < rows) {
      for (let c = cL; c <= cR; c++) {
        if (c < 0 || c >= cols) continue;
        const t = map[r][c];
        if (t === TILE.GROUND || t === TILE.BLOCK || t === TILE.PLATFORM) {
          e.y  = r * TILE_SIZE - e.h;
          e.vy = 0;
        }
      }
    }

    // Voltear en bordes
    const frontC = Math.floor((e.x + (e.vx > 0 ? e.w + 2 : -2)) / TILE_SIZE);
    const rEdge  = Math.floor((e.y + e.h + 4) / TILE_SIZE);
    if (frontC >= 0 && frontC < cols && rEdge >= 0 && rEdge < rows) {
      const g = map[rEdge]?.[frontC];
      if (!g || (g !== TILE.GROUND && g !== TILE.BLOCK)) e.vx = -e.vx;
    }

    if (e.x < 0)                      { e.x = 0;                      e.vx =  Math.abs(e.vx); }
    if (e.x + e.w > cols * TILE_SIZE)  { e.x = cols * TILE_SIZE - e.w; e.vx = -Math.abs(e.vx); }

    e.facing = e.vx >= 0 ? 1 : -1;
  }

  function draw(ctx, e, ts) {
    const { x, y, w, h, facing, stunTimer, wavePhase } = e;
    const wave = Math.sin(wavePhase) * 6;

    ctx.save();
    ctx.globalAlpha = stunTimer > 0 ? 0.55 : 1;
    ctx.translate(x + w / 2, y + h / 2 + wave);
    if (facing === -1) ctx.scale(-1, 1);

    // Placeholder visual — reemplazar con sprites cuando estén listos
    ctx.fillStyle = stunTimer > 0 ? '#666' : '#22c55e';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.48, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(w * 0.3, -h * 0.15, w * 0.18, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ojos
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(w * 0.25, -h * 0.1, 4, 0, Math.PI * 2);
    ctx.arc(w * 0.38, -h * 0.18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return { preload, create, update, draw };

})();