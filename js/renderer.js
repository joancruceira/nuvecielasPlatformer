// ═══════════════════════════════════════════════════════
//  RENDERER.JS — Dibuja todo en el canvas
// ═══════════════════════════════════════════════════════

const Renderer = (() => {

  let canvas, ctx;
  let W = 0, H = 0;

  const particles = [];

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
  }

  function resize() {
    // BUG FIX: Usar clientWidth/clientHeight como fallback si offsetWidth es 0
    W = canvas.offsetWidth  || canvas.clientWidth  || window.innerWidth;
    H = canvas.offsetHeight || canvas.clientHeight || window.innerHeight;
    canvas.width  = W;
    canvas.height = H;
  }

  function getSize() { return { W, H }; }

  function getTilePalette(level) {
    return {
      groundTop:  level.groundCol,
      groundFill: level.blockCol,
      platform:   level.dark ? '#7a5fb0' : '#c8a04a',
      spikes:     '#e84a5a',
      star:       '#f9c846',
      checkpoint: '#4ade80',
      portal:     '#a78bfa',
    };
  }

  // ── Fondo ──
  function drawBackground(level, camX, ts) {
    if (!level) return; // BUG FIX: Guard para evitar crash si level es null
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, level.skyTop);
    grad.addColorStop(1, level.skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (level.bgTrees)  drawBgTrees(camX, ts, level.dark);
    if (level.crystals) drawBgCrystals(camX, ts);
    if (level.glowing)  drawBgGlow(camX, ts);
  }

  function drawBgTrees(camX, ts, dark) {
    const cols = dark
      ? ['rgba(20,40,20,.35)', 'rgba(15,30,15,.5)']
      : ['rgba(40,100,55,.40)', 'rgba(30,80,45,.55)'];

    for (let layer = 0; layer < 2; layer++) {
      const px = (camX * (0.18 + layer * 0.12)) % 220;
      ctx.fillStyle = cols[layer];
      for (let i = -1; i < Math.ceil(W / 220) + 1; i++) {
        const x = i * 220 - px;
        const h = 140 + layer * 40;
        ctx.beginPath();
        ctx.moveTo(x + 55, H - h);
        ctx.lineTo(x + 100, H);
        ctx.lineTo(x + 10, H);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 55, H - h * 0.6);
        ctx.lineTo(x + 105, H);
        ctx.lineTo(x + 5, H);
        ctx.closePath();
        ctx.fill();
        if (!dark) {
          ctx.fillStyle = 'rgba(200,80,80,.28)';
          ctx.beginPath();
          ctx.ellipse(x + 160, H - 22, 22, 18, 0, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = cols[layer];
        }
      }
    }
  }

  function drawBgCrystals(camX, ts) {
    const px = (camX * 0.15) % 180;
    for (let i = -1; i < Math.ceil(W / 180) + 1; i++) {
      const x = i * 180 - px;
      const pulse = 0.4 + Math.sin(ts / 800 + i) * 0.15;
      ctx.fillStyle = `rgba(120,80,200,${pulse})`;
      ctx.beginPath();
      ctx.moveTo(x + 30, H);
      ctx.lineTo(x + 20, H - 70);
      ctx.lineTo(x + 40, H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(160,100,220,${pulse * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(x + 80, H);
      ctx.lineTo(x + 72, H - 50);
      ctx.lineTo(x + 90, H);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBgGlow(camX, ts) {
    const colors = ['rgba(100,200,120,.12)', 'rgba(80,120,255,.10)', 'rgba(200,100,255,.10)'];
    for (let i = 0; i < 5; i++) {
      const x = ((i * 310 - camX * 0.08) % (W + 200)) - 100;
      const y = H * 0.3 + Math.sin(ts / 1200 + i * 1.8) * H * 0.15;
      const r = 80 + i * 25;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, colors[i % colors.length]);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Tilemap ──
  function drawTilemap(map, level, camX, camY) {
    if (!map || !level) return;
    const pal  = getTilePalette(level);
    const rows = map.length;
    const cols = map[0].length;

    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
    const endCol   = Math.min(cols - 1, Math.ceil((camX + W) / TILE_SIZE) + 1);
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
    const endRow   = Math.min(rows - 1, Math.ceil((camY + H) / TILE_SIZE) + 1);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tile = map[r][c];
        if (tile === TILE.AIR) continue;

        const x = Math.floor(c * TILE_SIZE - camX);
        const y = Math.floor(r * TILE_SIZE - camY);
        const T = TILE_SIZE;

        drawTile(tile, x, y, T, pal, r, c, level);
      }
    }
  }

  function drawTile(tile, x, y, T, pal, row, col, level) {
    ctx.save();

    switch (tile) {
      case TILE.GROUND: {
        ctx.fillStyle = pal.groundTop;
        ctx.fillRect(x, y, T, T * 0.3);
        ctx.fillStyle = pal.groundFill;
        ctx.fillRect(x, y + T * 0.3, T, T * 0.7);
        if (!level.dark) {
          ctx.fillStyle = 'rgba(255,255,255,.15)';
          ctx.fillRect(x + 2, y + 2, T - 4, 4);
        }
        break;
      }
      case TILE.BLOCK: {
        ctx.fillStyle = pal.groundFill;
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = 'rgba(0,0,0,.12)';
        ctx.fillRect(x, y, T, 2);
        ctx.fillRect(x, y, 2, T);
        break;
      }
      case TILE.PLATFORM: {
        const grad = ctx.createLinearGradient(x, y, x, y + 14);
        grad.addColorStop(0, pal.platform);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x + 2, y, T - 4, 14, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.30)';
        ctx.fillRect(x + 4, y + 2, T - 8, 3);
        break;
      }
      case TILE.SPIKES: {
        ctx.fillStyle = pal.spikes;
        const n  = 3;
        const sw = T / n;
        for (let i = 0; i < n; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * sw, y + T);
          ctx.lineTo(x + i * sw + sw / 2, y + T * 0.25);
          ctx.lineTo(x + i * sw + sw, y + T);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(200,30,40,.4)';
        ctx.fillRect(x, y + T * 0.82, T, T * 0.18);
        break;
      }
      case TILE.STAR: {
        drawStarTile(x + T / 2, y + T / 2, T * 0.38, pal.star);
        break;
      }
      case TILE.CHECKPOINT: {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(x + T / 2 - 2, y + 4, 4, T - 8);
        ctx.beginPath();
        ctx.moveTo(x + T / 2 + 2, y + 6);
        ctx.lineTo(x + T / 2 + 20, y + 14);
        ctx.lineTo(x + T / 2 + 2, y + 22);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case TILE.PORTAL: {
        drawPortal(x + T / 2, y + T / 2, T * 0.44);
        break;
      }
      default: break;
    }

    ctx.restore();
  }

  function drawStarTile(cx, cy, r, col) {
    ctx.save();
    // BUG FIX: Construir el color rgba de forma robusta sin depender del formato exacto del string
    ctx.fillStyle = col + '80'; // hex + alpha simplificado
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    drawStarShape(cx, cy, r);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, cy - r * 0.25, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawStarShape(cx, cy, r) {
    ctx.beginPath();
    const spikes = 5;
    const inner  = r * 0.45;
    let rot = -Math.PI / 2;
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? r : inner;
      ctx.lineTo(cx + Math.cos(rot) * radius, cy + Math.sin(rot) * radius);
      rot += Math.PI / spikes;
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawPortal(cx, cy, r) {
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.4);
    g.addColorStop(0, 'rgba(255,255,255,.90)');
    g.addColorStop(0.4, 'rgba(167,139,250,.80)');
    g.addColorStop(0.8, 'rgba(99,102,241,.55)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Jugador ──
  function drawPlayer(player, images, ts) {
    const { x, y, w, h, charId, facing, sliding, grounded, jumping, doubleJumped, floating } = player;

    ctx.save();

    // sombra
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 4, w * 0.55, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const img = images[charId];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      if (facing === -1) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        if (sliding) {
          ctx.translate(0, h * 0.35);
          ctx.rotate(-0.45);
        }
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        ctx.translate(x, y);
        if (sliding) {
          ctx.translate(w, h * 0.35);
          ctx.scale(-1, 1);
          ctx.rotate(-0.45);
          ctx.translate(-w, 0);
        }
        ctx.drawImage(img, 0, 0, w, h);
      }
      ctx.restore();
    } else {
      // fallback
      ctx.fillStyle = '#a78bfa';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${w * 0.4}px Fredoka`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(charId ? charId[0].toUpperCase() : '?', x + w / 2, y + h / 2);
    }

    // efecto doble salto
    if (doubleJumped && !grounded) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // efecto float (Lunaria)
    if (floating) {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // ── Enemigos ──
  // El render de enemigos ahora lo maneja Enemies.drawAll(ctx, camX, camY, ts)
  // en el módulo enemies/enemies.js — cada tipo delega a su propio módulo.
  // drawEnemy se mantiene como fallback por compatibilidad.
  function drawEnemy(enemy, ts) {
    // No-op: mantenido por compatibilidad. Ver Enemies.drawAll()
  }

    // ── Partículas ──
  function spawnParticles(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 200;
      const life = 0.5 + Math.random() * 0.5;
      particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 60,
        r: 3 + Math.random() * 5,
        color,
        life,
        maxLife: life,
      });
    }
  }

  function updateAndDrawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 320 * dt;
      p.vx *= 1 - dt * 3;
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0, p.r * alpha), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Estrellas coleccionables animadas ──
  function drawStarAnimated(x, y, ts, collected) {
    if (collected) return;
    const bounce = Math.sin(ts / 500) * 3;
    drawStarTile(x, y + bounce, TILE_SIZE * 0.38, '#f9c846');
  }

  // ── Screen flash ──
  let flashAlpha = 0;
  let flashColor = '#fff';
  function flash(color = '#fff', strength = 0.7) {
    flashAlpha = strength;
    flashColor = color;
  }
  function drawFlash() {
    if (flashAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    flashAlpha = Math.max(0, flashAlpha - 0.05);
  }

  // ── Texto flotante ──
  const floatingTexts = [];
  function spawnText(x, y, text, color = '#f9c846') {
    floatingTexts.push({ x, y, text, color, life: 1.0, vy: -60 });
  }
  function drawFloatingTexts(dt) {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const t = floatingTexts[i];
      t.life -= dt * 1.8;
      if (t.life <= 0) { floatingTexts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      ctx.save();
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.font = `900 16px Fredoka, system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#000';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  // ── Bolas de fuego ──
  function drawFireballs(fireballs, camX, camY, ts) {
    if (!fireballs || fireballs.length === 0) return;
    for (const fb of fireballs) {
      if (!fb.active) continue;
      const sx = fb.x - camX;
      const sy = fb.y - camY;
      const pulse = 0.7 + Math.sin(ts / 60) * 0.3;

      ctx.save();
      // Halo exterior
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, fb.r * 2.5);
      glow.addColorStop(0,   `rgba(255,200,50,${0.55 * pulse})`);
      glow.addColorStop(0.5, `rgba(249,115,22,${0.35 * pulse})`);
      glow.addColorStop(1,   'rgba(249,115,22,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, fb.r * 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Núcleo
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(sx, sy, fb.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // Capa media naranja
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(sx, sy, fb.r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      // Núcleo blanco
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(sx, sy, fb.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function clear() {
    if (W > 0 && H > 0) ctx.clearRect(0, 0, W, H);
  }

  return {
    init, resize, getSize,
    drawBackground, drawTilemap,
    drawPlayer, drawEnemy,
    spawnParticles, updateAndDrawParticles,
    spawnText, drawFloatingTexts,
    drawFlash, flash,
    drawStarAnimated,
    drawFireballs,
    clear,
    getCtx: () => ctx,
  };

})();