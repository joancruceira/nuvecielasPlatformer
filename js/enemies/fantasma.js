// ═══════════════════════════════════════════════════════
//  FANTASMA.JS — Boss del nivel 2 (Caverna de Cristales)
//  Sprites: fantasma_idle0/1, fantasma_attack, fantasma_hit
//  Sin gravedad, persigue al jugador en cualquier dirección
// ═══════════════════════════════════════════════════════

const Fantasma = (() => {

  const BASE_SPEED  = 90;
  const TS          = 48;

  const frames = {};

  function preload() {
    ['fantasma_idle0','fantasma_idle1','fantasma_attack','fantasma_hit'].forEach(name => {
      const img = new Image();
      img.src = `img/${name}.png`;
      frames[name] = img;
    });
  }

  function create(x, y) {
    return {
      type:             'fantasma',
      x, y,
      w:                80, h: 80,
      vx: 0, vy: 0,
      facing:           -1,
      hp:               12, maxHp: 12,
      stunTimer:        0,
      frozenTimer:      0,
      attackTimer:      0,
      alive:            true,
      activated:        false,
      floatPhase:       Math.random() * Math.PI * 2,
      opacity:          0.85,
      alphaDir:         1,
      bossPhase:        1,
      bossPatternTimer: 0,
      bossPattern:      'chase',
      frameTimer:       0,
      frameIdx:         0,
    };
  }

  function update(e, dt, map, ps, onDefeated) {
    const rows = map.length;
    const cols = map[0].length;
    const dx   = (ps.x + ps.w / 2) - (e.x + e.w / 2);
    const dist = Math.abs(dx);

    if (!e.activated && dist < 550) e.activated = true;
    if (!e.activated) return;

    // Pulso de opacidad — efecto fantasmal
    e.opacity += e.alphaDir * dt * 0.55;
    if (e.opacity >= 0.92) { e.opacity = 0.92; e.alphaDir = -1; }
    if (e.opacity <= 0.42) { e.opacity = 0.42; e.alphaDir =  1; }
    e.floatPhase += dt * 1.4;

    // Fases según HP
    const ratio = e.hp / e.maxHp;
    e.bossPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;

    // Congelado por hielo
    if ((e.frozenTimer || 0) > 0) {
      e.frozenTimer -= dt;
      e.vx *= 0.88; e.vy *= 0.88;
      e.x += e.vx * dt; e.y += e.vy * dt;
    } else if (e.stunTimer > 0) {
      e.stunTimer -= dt;
      e.vx *= 0.85; e.vy *= 0.85;
      e.x += e.vx * dt; e.y += e.vy * dt;
    } else {
      _move(e, dt, ps);
    }

    // Limitar dentro del mapa con rebote suave
    if (e.x < TS)                  { e.x = TS;                  e.vx =  Math.abs(e.vx); }
    if (e.x + e.w > (cols-1) * TS) { e.x = (cols-1)*TS - e.w;  e.vx = -Math.abs(e.vx); }
    if (e.y < TS)                  { e.y = TS;                  e.vy =  Math.abs(e.vy); }
    if (e.y + e.h > (rows-3) * TS) { e.y = (rows-3)*TS - e.h;  e.vy = -Math.abs(e.vy); }

    e.facing = e.vx >= 0 ? 1 : -1;

    // Animar frame idle: alternar cada 350ms
    e.frameTimer += dt;
    if (e.frameTimer > 0.35) { e.frameTimer = 0; e.frameIdx = (e.frameIdx + 1) % 2; }

    if (e.attackTimer > 0) e.attackTimer -= dt;

    if (e.hp <= 0 && e.alive) {
      e.alive = false;
      Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#c4b5fd', 36);
      Renderer.flash('rgba(180,160,255,.7)', 0.7);
      onDefeated && onDefeated();
    }
  }

  function _move(e, dt, ps) {
    const dxF = (ps.x + ps.w/2) - (e.x + e.w/2);
    const dyF = (ps.y + ps.h/2) - (e.y + e.h/2);
    const d   = Math.hypot(dxF, dyF);
    if (d < 5) return;

    const spd = BASE_SPEED * (1 + (e.bossPhase - 1) * 0.4);

    e.bossPatternTimer += dt;
    const dur = e.bossPhase === 3 ? 1.4 : e.bossPhase === 2 ? 2.0 : 2.8;
    if (e.bossPatternTimer > dur) {
      e.bossPatternTimer = 0;
      const opts = e.bossPhase >= 2 ? ['chase','charge','circle'] : ['chase','circle'];
      e.bossPattern = opts[Math.floor(Math.random() * opts.length)];
    }

    if (e.bossPattern === 'chase') {
      e.vx += (dxF / d * spd - e.vx) * 3.5 * dt;
      e.vy += (dyF / d * spd - e.vy) * 3.5 * dt;
    } else if (e.bossPattern === 'charge') {
      e.vx += (dxF / d * spd * 2.4 - e.vx) * 5 * dt;
      e.vy += (dyF / d * spd * 2.4 - e.vy) * 5 * dt;
      e.attackTimer = 0.3;
    } else {
      // Círculo: rodear al jugador
      const perp = { x: -dyF/d, y: dxF/d };
      e.vx += (perp.x * spd * 0.9 + dxF/d * spd * 0.15 - e.vx) * 3 * dt;
      e.vy += (perp.y * spd * 0.9 + dyF/d * spd * 0.15 - e.vy) * 3 * dt;
    }

    // Ondulación adicional
    e.vy += Math.sin(e.floatPhase) * 18 * dt;
  }

  // ── Draw ──
  function draw(ctx, e, camX, camY, ts) {
    const sx = e.x - camX;
    const sy = e.y - camY;
    const { w, h, stunTimer, attackTimer, bossPhase, hp, maxHp, facing } = e;
    const frozen = (e.frozenTimer || 0) > 0;
    const bob    = Math.sin(e.floatPhase) * 8;

    ctx.save();

    // Halo de fase (fuera del bob para que no salte)
    const haloR = ['rgba(167,139,250,', 'rgba(239,68,68,', 'rgba(220,38,38,'];
    const hPulse = 0.35 + Math.sin(ts / 280) * 0.18;
    const glow   = ctx.createRadialGradient(sx+w/2, sy+h/2, 0, sx+w/2, sy+h/2, w * 1.3);
    glow.addColorStop(0,   haloR[bossPhase-1] + (hPulse * 0.55) + ')');
    glow.addColorStop(0.6, haloR[bossPhase-1] + (hPulse * 0.20) + ')');
    glow.addColorStop(1,   'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sx+w/2, sy+h/2, w*1.3, 0, Math.PI*2); ctx.fill();

    // Sprite con bob
    let frameName;
    if (stunTimer > 0 || frozen) frameName = 'fantasma_hit';
    else if (attackTimer > 0)    frameName = 'fantasma_attack';
    else frameName = e.frameIdx === 0 ? 'fantasma_idle0' : 'fantasma_idle1';

    const img = frames[frameName];

    ctx.globalAlpha = frozen ? 0.55 : stunTimer > 0 ? 0.45 : (e.opacity ?? 0.85);

    ctx.save();
    ctx.translate(sx + w/2, sy + h/2 + bob);
    // El fantasma es simétrico — espejearlo da dirección de ataque
    if (facing === 1) ctx.scale(-1, 1);

    if (img && img.complete && img.naturalWidth > 0) {
      const ar  = img.naturalWidth / img.naturalHeight;
      const dh  = h * 2.6 * (1 + (bossPhase - 1) * 0.08);
      const dw  = dh * ar;
      ctx.drawImage(img, -dw/2, -dh/2, dw, dh);

      if (frozen) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(100,180,255,0.55)';
        ctx.fillRect(-dw/2, -dh/2, dw, dh);
      } else if (stunTimer > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,60,60,0.50)';
        ctx.fillRect(-dw/2, -dh/2, dw, dh);
      }
    } else {
      // Fallback canvas
      ctx.fillStyle = frozen ? '#93c5fd' : '#c4b5fd';
      ctx.beginPath();
      ctx.arc(0, -h*0.1, w*0.42, Math.PI, 0, false);
      ctx.bezierCurveTo( w*0.42, h*0.18,  w*0.3,  h*0.42,  w*0.16, h*0.44);
      ctx.bezierCurveTo( w*0.06, h*0.46,  0,       h*0.40,  0,      h*0.42);
      ctx.bezierCurveTo(-w*0.06, h*0.40, -w*0.16, h*0.46, -w*0.3,  h*0.44);
      ctx.bezierCurveTo(-w*0.42, h*0.42, -w*0.42, h*0.18, -w*0.42, -h*0.1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(-w*0.14, -h*0.15, w*0.08, h*0.09, 0, 0, Math.PI*2);
      ctx.ellipse( w*0.14, -h*0.15, w*0.08, h*0.09, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();

    // Barra de vida
    if (maxHp) {
      const bw = w*1.35, bx = sx+w/2-bw/2, by = sy-20;
      const ratio = Math.max(0, hp/maxHp);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, 9, 4); ctx.fill();
      ctx.fillStyle = frozen ? '#60a5fa' : ratio > 0.5 ? '#c4b5fd' : ratio > 0.25 ? '#f9a8d4' : '#ef4444';
      ctx.beginPath(); ctx.roundRect(bx, by, bw*ratio, 9, 4); ctx.fill();
    }

    ctx.restore();
  }

  return { preload, create, update, draw };

})();