// ═══════════════════════════════════════════════════════
//  BOSS.JS — Jefe final con 3 fases
//  Puede caer al foso (derrota alternativa)
// ═══════════════════════════════════════════════════════

const Boss = (() => {

  const TILE_SIZE  = 48;
  const BASE_SPEED = 70;

  function create(x, y) {
    return {
      type:    'boss',
      x, y,
      w: 96, h: 96,
      vx: 0, vy: 0,
      facing: -1,
      hp: 12, maxHp: 12,
      stunTimer:       0,
      bossPhase:       1,
      bossTimer:       0,
      bossJumpTimer:   0,
      bossPatternTimer:0,
      bossPattern:     'patrol',
      activated:       false,
      alive:           true,
    };
  }

  function update(e, dt, map, ps, onDefeated) {
    const dx   = ps.x - e.x;
    const dist = Math.abs(dx);

    if (!e.activated && dist < 600) e.activated = true;
    if (!e.activated) return;

    if (e.stunTimer > 0) {
      e.stunTimer -= dt;
      e.vx *= 0.85;
      // Aún aplicar gravedad para que no flote
      e.vy += 900 * dt;
      e.y  += e.vy * dt;
      _resolveFloor(e, map);
      _checkFall(e, map, onDefeated);
      return;
    }

    // Fases según HP
    const ratio = e.hp / e.maxHp;
    e.bossPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;

    const speed           = BASE_SPEED * (1 + (e.bossPhase - 1) * 0.45);
    const patternDuration = e.bossPhase === 3 ? 1.8 : e.bossPhase === 2 ? 2.4 : 3.0;

    e.bossPatternTimer += dt;
    if (e.bossPatternTimer > patternDuration) {
      e.bossPatternTimer = 0;
      const patterns  = ['patrol', 'chase', 'charge'];
      const available = e.bossPhase >= 2 ? patterns : ['patrol', 'chase'];
      e.bossPattern   = available[Math.floor(Math.random() * available.length)];
    }

    if (e.bossPattern === 'patrol')       e.vx = e.facing * speed;
    else if (e.bossPattern === 'chase')   e.vx = dx > 0 ? speed : -speed;
    else if (e.bossPattern === 'charge')  e.vx = dx > 0 ? speed * 2.2 : -speed * 2.2;

    e.vy += 900 * dt;
    e.x  += e.vx * dt;
    e.y  += e.vy * dt;

    _resolveFloor(e, map);
    _checkFall(e, map, onDefeated);

    const cols = map[0].length;
    if (e.x < 0)                      { e.x = 0;                      e.facing =  1; }
    if (e.x + e.w > cols * TILE_SIZE)  { e.x = cols * TILE_SIZE - e.w; e.facing = -1; }
    e.facing = e.vx >= 0 ? 1 : -1;

    if (e.hp <= 0 && e.alive) {
      e.alive = false;
      Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#f9c846', 32);
      Renderer.flash('#f9c846', 0.6);
      onDefeated && onDefeated();
    }
  }

  function _resolveFloor(e, map) {
    const rows   = map.length;
    const cols   = map[0].length;
    const rFloor = Math.floor((e.y + e.h) / TILE_SIZE);
    const cMid   = Math.floor((e.x + e.w / 2) / TILE_SIZE);

    if (rFloor >= 0 && rFloor < rows && cMid >= 0 && cMid < cols) {
      const t = map[rFloor][cMid];
      if (t === TILE.GROUND || t === TILE.BLOCK) {
        e.y  = rFloor * TILE_SIZE - e.h;
        e.vy = 0;
        e.bossJumpTimer += 1 / 60; // aproximación
        const jumpInterval = e.bossPhase === 3 ? 1.2 : e.bossPhase === 2 ? 1.8 : 2.5;
        if (e.bossJumpTimer > jumpInterval) {
          e.vy           = -580 - (e.bossPhase - 1) * 80;
          e.bossJumpTimer = 0;
        }
      }
    }
  }

  function _checkFall(e, map, onDefeated) {
    if (e.y > map.length * TILE_SIZE + 80 && e.alive) {
      e.alive = false;
      Renderer.spawnText(e.x + e.w / 2, map.length * TILE_SIZE - 40, '¡AL FOSO! 😱', '#f9c846');
      Renderer.flash('#f9c846', 0.75);
      onDefeated && onDefeated();
    }
  }

  function draw(ctx, e, ts) {
    const { x, y, w, h, bossPhase = 1, stunTimer, hp, maxHp } = e;
    const bob = Math.sin(ts / 300) * 4;

    ctx.save();
    ctx.globalAlpha = stunTimer > 0 ? 0.65 : 1;
    ctx.translate(x, y + bob);

    const scale = 1 + (bossPhase - 1) * 0.08;
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);

    // Aura
    const pulse = 0.5 + Math.sin(ts / 200) * 0.18;
    const aura  = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.9);
    aura.addColorStop(0, `rgba(239,68,68,${pulse * 0.4})`);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bossPhase === 3 ? '#ef4444' : bossPhase === 2 ? '#f97316' : '#e85d7a';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.58, w * 0.44, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bossPhase === 3 ? '#b91c1c' : bossPhase === 2 ? '#c2410c' : '#be185d';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.28, w * 0.52, h * 0.34, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w * 0.36, h * 0.55, 7, 0, Math.PI * 2);
    ctx.arc(w * 0.64, h * 0.55, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0000';
    ctx.beginPath();
    ctx.arc(w * 0.38, h * 0.56, 4, 0, Math.PI * 2);
    ctx.arc(w * 0.66, h * 0.56, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.47); ctx.lineTo(w * 0.46, h * 0.50);
    ctx.moveTo(w * 0.54, h * 0.50); ctx.lineTo(w * 0.72, h * 0.47);
    ctx.stroke();
    ctx.restore();

    // Barra de vida (fuera del save/restore con bob)
    if (maxHp) {
      const bw    = w * 1.2;
      const bx    = x + w / 2 - bw / 2;
      const by    = y - 18;
      const ratio = Math.max(0, hp / maxHp);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, 8, 4); ctx.fill();
      ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#ef4444';
      ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, 8, 4); ctx.fill();
      ctx.restore();
    }
  }

  return { create, update, draw };

})();