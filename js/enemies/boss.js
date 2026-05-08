// ═══════════════════════════════════════════════════════
//  BOSS.JS — Alien (Jefe del nivel 1) 
//  Usa alien.png como sprite
//  Tres fases, puede caer al foso (derrota alternativa)
// ═══════════════════════════════════════════════════════

const Boss = (() => {

  const TS         = 48;
  const BASE_SPEED = 70;

  const frames = {};
  function preload() {
    const img = new Image();
    img.src = 'img/alien.png';
    frames['alien'] = img;
  }

  function create(x, y) {
    return {
      type:    'boss',
      x, y,
      w: 96, h: 96,
      vx: 0, vy: 0,
      facing: -1,
      hp: 12, maxHp: 12,
      stunTimer:        0,
      bossPhase:        1,
      bossTimer:        0,
      bossJumpTimer:    0,
      bossPatternTimer: 0,
      bossPattern:      'patrol',
      activated:        false,
      alive:            true,
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
      e.vy += 900 * dt;
      e.y  += e.vy * dt;
      _resolveFloor(e, dt, map);
      _checkFall(e, map, onDefeated);
      return;
    }

    const ratio = e.hp / e.maxHp;
    e.bossPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;

    const speed = BASE_SPEED * (1 + (e.bossPhase - 1) * 0.45);
    const dur   = e.bossPhase === 3 ? 1.8 : e.bossPhase === 2 ? 2.4 : 3.0;

    e.bossPatternTimer += dt;
    if (e.bossPatternTimer > dur) {
      e.bossPatternTimer = 0;
      const opts = e.bossPhase >= 2 ? ['patrol','chase','charge'] : ['patrol','chase'];
      e.bossPattern = opts[Math.floor(Math.random() * opts.length)];
    }

    if (e.bossPattern === 'patrol')      e.vx = e.facing * speed;
    else if (e.bossPattern === 'chase')  e.vx = dx > 0 ? speed : -speed;
    else if (e.bossPattern === 'charge') e.vx = dx > 0 ? speed * 2.2 : -speed * 2.2;

    e.vy += 900 * dt;
    e.x  += e.vx * dt;
    e.y  += e.vy * dt;

    _resolveFloor(e, dt, map);
    _checkFall(e, map, onDefeated);

    const cols = map[0].length;
    if (e.x < 0)                { e.x = 0;              e.facing =  1; }
    if (e.x + e.w > cols * TS)  { e.x = cols * TS - e.w; e.facing = -1; }
    e.facing = e.vx >= 0 ? 1 : -1;

    if (e.hp <= 0 && e.alive) {
      e.alive = false;
      Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#86efac', 32);
      Renderer.flash('#86efac', 0.6);
      onDefeated && onDefeated();
    }
  }

  function _resolveFloor(e, dt, map) {
    const rows = map.length, cols = map[0].length;
    const rFloor = Math.floor((e.y + e.h) / TS);
    const cL = Math.max(0,        Math.floor((e.x + 4)        / TS));
    const cR = Math.min(cols - 1, Math.floor((e.x + e.w - 4) / TS));

    let onGround = false;
    if (rFloor >= 0 && rFloor < rows) {
      for (let c = cL; c <= cR; c++) {
        const t = map[rFloor]?.[c];
        if (t === TILE.GROUND || t === TILE.BLOCK) {
          e.y  = rFloor * TS - e.h;
          e.vy = 0;
          onGround = true;
          e.bossJumpTimer += dt;
          const ji = e.bossPhase === 3 ? 1.2 : e.bossPhase === 2 ? 1.8 : 2.5;
          if (e.bossJumpTimer > ji) {
            e.vy = -580 - (e.bossPhase - 1) * 80;
            e.bossJumpTimer = 0;
          }
          break;
        }
      }
    }
    // Voltear en borde de foso
    if (onGround && Math.abs(e.vx) > 5) {
      const lookX  = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
      const cFront = Math.floor(lookX / TS);
      const rFoot  = Math.floor((e.y + e.h + 2) / TS);
      if (cFront >= 0 && cFront < cols && rFoot >= 0 && rFoot < rows) {
        const tF = map[rFoot]?.[cFront];
        if (tF !== TILE.GROUND && tF !== TILE.BLOCK) {
          e.vx = -e.vx;
          e.facing = e.vx >= 0 ? 1 : -1;
        }
      }
    }
  }

  function _checkFall(e, map, onDefeated) {
    if (e.y > map.length * TS + 80 && e.alive) {
      e.alive = false;
      Renderer.spawnText(e.x + e.w/2, map.length * TS - 40, '¡AL FOSO! 😱', '#86efac');
      Renderer.flash('#86efac', 0.75);
      onDefeated && onDefeated();
    }
  }

  function draw(ctx, e, camX, camY, ts) {
    const x = e.x - camX, y = e.y - camY;
    const { w, h, bossPhase = 1, stunTimer, hp, maxHp } = e;
    const bob = Math.sin(ts / 300) * 4;

    ctx.save();
    ctx.globalAlpha = stunTimer > 0 ? 0.6 : 1;
    ctx.translate(x + w/2, y + h/2 + bob);

    const scale = 1 + (bossPhase - 1) * 0.08;
    ctx.scale(scale, scale);

    // Aura verde alienígena
    const pulse = 0.4 + Math.sin(ts / 220) * 0.18;
    const aura  = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.9);
    aura.addColorStop(0, `rgba(132,232,130,${pulse * 0.5})`);
    aura.addColorStop(0.5, `rgba(74,222,128,${pulse * 0.25})`);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, 0, w * 0.9, 0, Math.PI*2); ctx.fill();

    const img = frames['alien'];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -w/2, -h/2, w, h);
      if (stunTimer > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,60,60,0.5)';
        ctx.fillRect(-w/2, -h/2, w, h);
      }
    } else {
      // Fallback
      ctx.fillStyle = bossPhase === 3 ? '#4ade80' : bossPhase === 2 ? '#22c55e' : '#86efac';
      ctx.beginPath(); ctx.ellipse(0, 0, w*0.42, h*0.38, 0, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();

    // Barra de vida
    if (maxHp) {
      const bw = w*1.2, bx = x+w/2-bw/2, by = y-18;
      const ratio = Math.max(0, hp/maxHp);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, 8, 4); ctx.fill();
      ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#ef4444';
      ctx.beginPath(); ctx.roundRect(bx, by, bw*ratio, 8, 4); ctx.fill();
      ctx.restore();
    }
  }

  return { preload, create, update, draw };

})();
