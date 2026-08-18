// ═══════════════════════════════════════════════════════
//  FANTASMA.JS — Boss del nivel 2
//  Reescritura completa — sin bugs acumulados
// ═══════════════════════════════════════════════════════

const Fantasma = (() => {

  const TS = 48;

  // ── Sprites ──
  const frames = {};
  function preload() {
    ['fantasma_idle0','fantasma_idle1','fantasma_attack','fantasma_hit'].forEach(n => {
      const img = new Image();
      img.src = `img/${n}.png`;
      frames[n] = img;
    });
  }


  // ── Teñir sin manchar el fondo ────────────────────────
  //
  //  'source-atop' tiñe lo que YA está pintado en el canvas, y abajo del bicho
  //  está el nivel entero: pintando ahí, el tinte salía como un rectángulo de
  //  color alrededor. Se dibuja en un lienzo aparte —que sí está vacío— y se
  //  pega el resultado. El lienzo es uno solo y se reusa, así que no cuesta.
  const _lienzoTinte = document.createElement('canvas');
  const _ctxTinte    = _lienzoTinte.getContext('2d');

  function _dibujarConTinte(ctx, img, dx, dy, dw, dh, color) {
    const w = Math.max(1, Math.ceil(dw)), h = Math.max(1, Math.ceil(dh));
    if (_lienzoTinte.width < w)  _lienzoTinte.width  = w;
    if (_lienzoTinte.height < h) _lienzoTinte.height = h;
    _ctxTinte.globalCompositeOperation = 'source-over';
    _ctxTinte.clearRect(0, 0, _lienzoTinte.width, _lienzoTinte.height);
    _ctxTinte.drawImage(img, 0, 0, w, h);
    if (color) {
      _ctxTinte.globalCompositeOperation = 'source-atop';
      _ctxTinte.fillStyle = color;
      _ctxTinte.fillRect(0, 0, w, h);
    }
    ctx.drawImage(_lienzoTinte, 0, 0, w, h, dx, dy, dw, dh);
  }

  // ── Crear instancia ──
  function create(x, y) {
    return {
      type:        'fantasma',
      x, y,
      w:            72,
      h:            80,
      vx:          0,
      vy:          0,
      facing:      -1,
      hp:          12,
      maxHp:       12,
      stunTimer:   0,
      frozenTimer: 0,
      attackTimer: 0,
      alive:       true,
      activated:   false,
      x_spawn:     x,

      // Movimiento
      bossPhase:        1,
      bossPattern:      'chase',
      bossPatternTimer: 0,
      floatPhase:       Math.random() * Math.PI * 2,

      // Visual
      opacity:   0.85,
      alphaDir:  1,
      frameIdx:  0,
      frameTimer:0,
    };
  }

  // ── Update ──
  function update(e, dt, map, ps, onDefeated) {
    if (!e.alive) return;

    // ── Activación por distancia ──
    const dx   = (ps.x + ps.w / 2) - (e.x + e.w / 2);
    const dy   = (ps.y + ps.h / 2) - (e.y + e.h / 2);
    const dist = Math.hypot(dx, dy);

    if (!e.activated && dist < 800) {
      e.activated = true;
    }
    if (!e.activated) return;

    // ── Animación visual ──
    e.opacity += e.alphaDir * dt * 0.55;
    if (e.opacity >= 0.92) { e.opacity = 0.92; e.alphaDir = -1; }
    if (e.opacity <= 0.42) { e.opacity = 0.42; e.alphaDir =  1; }
    e.floatPhase += dt * 1.4;

    if (e.frameTimer >= 0.35) { e.frameTimer = 0; e.frameIdx = (e.frameIdx + 1) % 2; }
    e.frameTimer += dt;
    if (e.attackTimer > 0) e.attackTimer -= dt;

    // ── Fase según HP ──
    const ratio = e.hp / e.maxHp;
    e.bossPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;

    // ── Congelado ──
    if ((e.frozenTimer || 0) > 0) {
      e.frozenTimer -= dt;
      e.vx *= 0.88;
      e.vy *= 0.88;
      e.x  += e.vx * dt;
      e.y  += e.vy * dt;
      _clamp(e, map);
      return;
    }

    // ── Aturdido ──
    if (e.stunTimer > 0) {
      e.stunTimer -= dt;
      e.vx *= 0.85;
      e.vy *= 0.85;
      e.x  += e.vx * dt;
      e.y  += e.vy * dt;
      _clamp(e, map);
      return;
    }

    // ── Movimiento normal ──
    const spd = 70 * (1 + (e.bossPhase - 1) * 0.3); // más lento y predecible

    // Cambiar patrón periódicamente
    e.bossPatternTimer += dt;
    const dur = e.bossPhase === 3 ? 2.5 : e.bossPhase === 2 ? 3.5 : 5.0; // patrones más largos
    if (e.bossPatternTimer >= dur) {
      e.bossPatternTimer = 0;
      const opts = e.bossPhase >= 2
        ? ['chase', 'charge', 'circle']
        : ['chase', 'circle'];
      e.bossPattern = opts[Math.floor(Math.random() * opts.length)];
    }

    const d = dist < 1 ? 1 : dist;

    if (e.bossPattern === 'chase') {
      // Perseguir directamente al jugador en X e Y
      e.vx += (dx / d * spd - e.vx) * 2.5 * dt;
      e.vy += (dy / d * spd - e.vy) * 2.5 * dt;
    } else if (e.bossPattern === 'charge') {
      // Embestida rápida
      e.vx += (dx / d * spd * 2.0 - e.vx) * 4.0 * dt;
      e.vy += (dy / d * spd * 2.0 - e.vy) * 4.0 * dt;
      e.attackTimer = 0.5;
    } else {
      // Circular: moverse en círculo ALREDEDOR del jugador (no alejarse)
      const px = -dy / d;
      const py =  dx / d;
      // Mantener una distancia de ~150px del jugador mientras gira
      const targetDist = 150;
      const pushIn = (dist - targetDist) / targetDist;
      e.vx += (px * spd + dx / d * spd * pushIn - e.vx) * 2.0 * dt;
      e.vy += (py * spd + dy / d * spd * pushIn - e.vy) * 2.0 * dt;
    }

    // Sin ondulación vertical — causaba que se fuera para arriba

    // Limitar velocidad máxima para evitar movimiento errático
    const MAX_SPD = spd * 1.8;
    if (Math.abs(e.vx) > MAX_SPD) e.vx = Math.sign(e.vx) * MAX_SPD;
    if (Math.abs(e.vy) > MAX_SPD) e.vy = Math.sign(e.vy) * MAX_SPD;

    // ── APLICAR POSICIÓN ──
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    e.facing = e.vx >= 0 ? 1 : -1;

    _clamp(e, map);

    // ── Muerte ──
    if (e.hp <= 0 && e.alive) {
      e.alive = false;
      Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#c4b5fd', 40);
      Renderer.flash('rgba(180,160,255,.7)', 0.8);
      onDefeated && onDefeated();
    }
  }

  // Mantener dentro del mapa — sin forzar dirección incorrecta
  function _clamp(e, map) {
    const rows = map.length;
    const cols = map[0].length;

    // Límites del mapa completo (no del spawn)
    const minX = TS;
    const maxX = (cols - 1) * TS;
    const minY = TS * 3;           // fila 3 — debajo del techo
    const maxY = (rows - 5) * TS; // fila 11 — sobre el suelo

    // Solo rebotar en los bordes del mapa, no forzar dirección
    if (e.x < minX)       { e.x = minX;        e.vx = Math.abs(e.vx);  }
    if (e.x+e.w > maxX)   { e.x = maxX - e.w;  e.vx = -Math.abs(e.vx); }
    if (e.y < minY)       { e.y = minY;         e.vy = Math.abs(e.vy) * 0.5; }
    if (e.y+e.h > maxY)   { e.y = maxY - e.h;  e.vy = -Math.abs(e.vy) * 0.5; }
  }

  // ── Draw ──
  function draw(ctx, e, camX, camY, ts) {
    const sx = e.x - camX;
    const sy = e.y - camY;
    const { w, h, stunTimer, attackTimer, bossPhase, hp, maxHp, facing } = e;
    const frozen = (e.frozenTimer || 0) > 0;
    const bob    = Math.sin(e.floatPhase) * 8;

    ctx.save();

    // Halo de fase
    const haloColors = [
      'rgba(167,139,250,', 'rgba(239,68,68,', 'rgba(220,38,38,'
    ];
    const hPulse = 0.35 + Math.sin(ts / 280) * 0.18;
    const glow   = ctx.createRadialGradient(
      sx+w/2, sy+h/2, 0,
      sx+w/2, sy+h/2, w * 1.3
    );
    glow.addColorStop(0,   haloColors[bossPhase-1] + (hPulse * 0.55) + ')');
    glow.addColorStop(0.6, haloColors[bossPhase-1] + (hPulse * 0.20) + ')');
    glow.addColorStop(1,   'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx+w/2, sy+h/2, w*1.3, 0, Math.PI*2);
    ctx.fill();

    // Sprite
    let frameName;
    if      (stunTimer > 0 || frozen) frameName = 'fantasma_hit';
    else if (attackTimer > 0)         frameName = 'fantasma_attack';
    else frameName = e.frameIdx === 0 ? 'fantasma_idle0' : 'fantasma_idle1';

    const img = frames[frameName];

    ctx.globalAlpha = frozen ? 0.55 : stunTimer > 0 ? 0.45 : (e.opacity ?? 0.85);

    ctx.save();
    ctx.translate(sx + w/2, sy + h/2 + bob);
    // Los sprites miran a la DERECHA: se espeja cuando mira a la izquierda.
    if (facing === -1) ctx.scale(-1, 1);

    if (img && img.complete && img.naturalWidth > 0) {
      const ar = img.naturalWidth / img.naturalHeight;
      const dh = h * 1.5 * (1 + (bossPhase - 1) * 0.06); // más pequeño
      const dw = dh * ar;
      const tinte = frozen        ? 'rgba(100,180,255,0.55)'
                  : stunTimer > 0 ? 'rgba(255,60,60,0.50)'
                  : null;
      _dibujarConTinte(ctx, img, -dw/2, -dh/2, dw, dh, tinte);
    } else {
      // Fallback canvas
      ctx.fillStyle = frozen ? '#93c5fd' : '#c4b5fd';
      ctx.beginPath();
      ctx.arc(0, -h*0.1, w*0.42, Math.PI, 0, false);
      ctx.bezierCurveTo( w*0.42, h*0.18,  w*0.3,  h*0.42,  w*0.16, h*0.44);
      ctx.bezierCurveTo( w*0.05, h*0.46,  0,       h*0.40,  0,      h*0.42);
      ctx.bezierCurveTo(-w*0.05, h*0.40, -w*0.16, h*0.46, -w*0.3,  h*0.44);
      ctx.bezierCurveTo(-w*0.42, h*0.42, -w*0.42, h*0.18, -w*0.42, -h*0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(-w*0.14, -h*0.15, w*0.09, h*0.10, 0, 0, Math.PI*2);
      ctx.ellipse( w*0.14, -h*0.15, w*0.09, h*0.10, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();

    // Barra de vida
    if (maxHp) {
      const bw    = w * 1.4;
      const bx    = sx + w/2 - bw/2;
      const by    = sy - 22;
      const ratio = Math.max(0, hp / maxHp);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, 10, 5); ctx.fill();
      ctx.fillStyle = frozen       ? '#60a5fa'
                    : ratio > 0.5  ? '#c4b5fd'
                    : ratio > 0.25 ? '#f9a8d4'
                    :                '#ef4444';
      ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, 10, 5); ctx.fill();
    }

    ctx.restore();
  }

  return { preload, create, update, draw };

})();
