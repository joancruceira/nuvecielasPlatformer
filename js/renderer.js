// ═══════════════════════════════════════════════════════
//  RENDERER.JS — Dibuja todo en el canvas
// ═══════════════════════════════════════════════════════

const Renderer = (() => {

  let canvas, ctx;
  let W = 0, H = 0;

  const particles = [];

  let _bgTreesConfig = null;

  // Candelabro para el fondo del nivel 2
  const candelabraImg = new Image();
  candelabraImg.src = 'img/candelabro01.png'; // se llena en drawBackground, se usa en drawBgTreesOverlay

  // Frames animados de árboles (viento) para el fondo del nivel 1
  const treeFrames = [];
  (function() {
    for (let i = 1; i <= 6; i++) {
      const img = new Image();
      img.src = `img/arbol0${i}.png`;
      treeFrames.push(img);
    }
  })();

  // Imagen del castillo portal
  const castleImg = new Image();
  castleImg.src = 'img/castle_bg.jpg';

  // Estado de transición del castillo
  let castleAlpha    = 0;   // 0=invisible, 1=totalmente visible
  let castleActive   = false;
  let castleAnimDir  = 0;   // 1=fade in, -1=fade out
  let castleParallax = 0;   // desplazamiento suave

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
  }

  // Llamar desde engine cuando el boss muere
  function showCastle()  { castleActive = true;  castleAnimDir =  1; }
  function hideCastle()  { castleAnimDir = -1; }
  function resetCastle() { castleAlpha = 0; castleActive = false; castleAnimDir = 0; }

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
  function drawBackground(level, camX, camY, ts) {
    if (!level) return;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, level.skyTop);
    grad.addColorStop(1, level.skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (level.bgTrees)   _bgTreesConfig = { camY, dark: level.dark, crystals: false };
    if (level.crystals)  _bgTreesConfig = { camY, dark: level.dark, crystals: true };
    if (level.crystals) drawBgCrystals(camX, ts);
    if (level.glowing)  drawBgGlow(camX, ts);

    // Castillo del portal — aparece cuando el boss muere
    _drawCastle(ts, camX);
  }

  function _drawCastle(ts, camX) {
    if (!castleActive && castleAlpha <= 0) return;

    // Actualizar alpha de transición
    const speed = 0.012;
    if (castleAnimDir === 1)       castleAlpha = Math.min(1, castleAlpha + speed);
    else if (castleAnimDir === -1) castleAlpha = Math.max(0, castleAlpha - speed);
    if (castleAlpha <= 0 && castleAnimDir === -1) { castleActive = false; return; }

    if (!castleImg.complete || castleImg.naturalWidth === 0) return;

    ctx.save();

    // Parallax suave: el castillo se mueve levemente con la cámara
    castleParallax = camX * 0.06;
    const px = -castleParallax % (W * 0.15);

    // Calcular dimensiones manteniendo aspect ratio, centrado
    const iAR = castleImg.naturalWidth / castleImg.naturalHeight;
    let dw = W * 1.05, dh = dw / iAR;
    if (dh < H) { dh = H * 1.05; dw = dh * iAR; }
    const dx = (W - dw) / 2 + px;
    const dy = (H - dh) / 2;

    // Sombra oscura debajo para que no tape el suelo
    const dimGrad = ctx.createLinearGradient(0, 0, 0, H);
    dimGrad.addColorStop(0,    `rgba(0,0,0,0)`);
    dimGrad.addColorStop(0.55, `rgba(0,0,0,0)`);
    dimGrad.addColorStop(1,    `rgba(0,0,0,${castleAlpha * 0.82})`);

    ctx.globalAlpha = castleAlpha;
    ctx.drawImage(castleImg, dx, dy, dw, dh);

    // Oscurecer la parte inferior para que los tiles del suelo sigan visibles
    ctx.globalAlpha = 1;
    ctx.fillStyle   = dimGrad;
    ctx.fillRect(0, 0, W, H);

    // Overlay de color rojo oscuro que aumenta con la cercanía al portal
    const redPulse = 0.08 + Math.sin(ts / 600) * 0.04;
    ctx.globalAlpha = castleAlpha * redPulse;
    ctx.fillStyle   = '#8b0000';
    ctx.fillRect(0, 0, W, H);

    // Viñeta en los bordes
    const vignette = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.9);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, `rgba(0,0,0,${castleAlpha * 0.65})`);
    ctx.globalAlpha = 1;
    ctx.fillStyle   = vignette;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  }

  function drawBgTrees(camX, camY, ts, dark) {
    if (!dark && treeFrames.length === 6 && treeFrames[0].complete && treeFrames[0].naturalWidth > 0) {
      _drawAnimatedTrees(camX, camY, ts);
    } else {
      // Fallback: árboles canvas para niveles oscuros o si las imágenes no cargaron
      _drawCanvasTrees(camX, ts, dark);
    }
  }

  // Árboles animados con sprites reales — 3 capas de parallax
  function _drawAnimatedTrees(camX, camY, ts) {
    // UN SOLO frameIdx para todas las capas — animación coherente del viento
    const frameIdx = Math.floor(ts / 450) % 6;
    const img      = treeFrames[frameIdx];
    if (!img || !img.complete || !img.naturalWidth) return;

    const ar = img.naturalWidth / img.naturalHeight;

    // Suelo real: fila 13 × 48px en coordenadas de pantalla
    // Se clampea para que siempre quede visible aunque camY sea grande
    const GROUND_WORLD_Y = 13 * 48;
    const groundScreenY  = Math.min(GROUND_WORLD_Y - camY, H - 15);

    // Tamaño 3× más grande que antes (96 * 3 = 288px de alto)
    const TREE_H = 288;
    const TREE_W = TREE_H * ar;

    // Separación: 8× el ancho del árbol entre cada uno
    // Capa trasera
    const BACK_H   = TREE_H * 0.7;
    const BACK_W   = BACK_H * ar;
    const BACK_GAP = BACK_W * 8.0;
    const backOff  = (camX * 0.06) % BACK_GAP;
    const backY    = groundScreenY - BACK_H;
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let i = -1; i < Math.ceil(W / BACK_GAP) + 2; i++) {
      ctx.drawImage(img, i * BACK_GAP - backOff, backY, BACK_W, BACK_H);
    }
    ctx.restore();

    // Capa media
    const MID_H   = TREE_H * 0.85;
    const MID_W   = MID_H * ar;
    const MID_GAP = MID_W * 9.0;
    const midOff  = (camX * 0.11 + MID_GAP * 0.5) % MID_GAP;
    const midY    = groundScreenY - MID_H;
    ctx.save();
    ctx.globalAlpha = 0.72;
    for (let i = -1; i < Math.ceil(W / MID_GAP) + 2; i++) {
      ctx.drawImage(img, i * MID_GAP - midOff, midY, MID_W, MID_H);
    }
    ctx.restore();

    // Capa delantera
    const FRONT_GAP = TREE_W * 10.0;
    const frontOff  = (camX * 0.18 + FRONT_GAP * 0.3) % FRONT_GAP;
    const frontY    = groundScreenY - TREE_H;
    ctx.save();
    ctx.globalAlpha = 0.88;
    for (let i = -1; i < Math.ceil(W / FRONT_GAP) + 2; i++) {
      ctx.drawImage(img, i * FRONT_GAP - frontOff, frontY, TREE_W, TREE_H);
    }
    ctx.restore();
  }

  // Llamar desde engine DESPUÉS de drawTilemap
  function drawBgTreesOverlay(camX, camY, ts) {
    if (!_bgTreesConfig) return;
    const { dark, crystals } = _bgTreesConfig;

    if (crystals) {
      // Nivel 2: candelabros en las paredes
      _drawCandelabras(camX, camY, ts);
    } else if (!dark && treeFrames.length === 6 && treeFrames[0].complete && treeFrames[0].naturalWidth > 0) {
      // Nivel 1: árboles animados
      _drawAnimatedTrees(camX, camY, ts);
    } else {
      _drawCanvasTrees(camX, ts, dark);
    }
  }

  // ── Candelabros para el nivel 2 ──
  function _drawCandelabras(camX, camY, ts) {
    if (!candelabraImg.complete || !candelabraImg.naturalWidth) return;

    const ar = candelabraImg.naturalWidth / candelabraImg.naturalHeight;

    // Parpadeo de llama: oscilación sutil de alpha
    const flicker = 0.80 + Math.sin(ts / 180) * 0.12 + Math.sin(ts / 90) * 0.06;

    // Suelo de la caverna en fila 13
    const GROUND_WORLD_Y = 13 * 48;
    const groundScreenY  = Math.min(GROUND_WORLD_Y - camY, H - 15);

    // Tamaño: el candelabro es vertical — altura proporcional al escenario
    const CAND_H = 120;
    const CAND_W = CAND_H * ar;

    // Posición: pegado a la pared izquierda de cada sección, un poco arriba del suelo
    // Parallax muy lento — como si estuviera fijado en la pared del fondo
    const GAP     = CAND_W * 5.5;
    const offset  = (camX * 0.08) % GAP;
    const candY   = groundScreenY - CAND_H - 20; // flota un poco sobre el suelo

    ctx.save();
    ctx.globalAlpha = flicker * 0.85;

    for (let i = -1; i < Math.ceil(W / GAP) + 2; i++) {
      const x = i * GAP - offset;
      ctx.drawImage(candelabraImg, x, candY, CAND_W, CAND_H);
    }

    // Segunda fila: candelabros más altos en el fondo (más pequeños, más alejados)
    const GAP2    = CAND_W * 7.0;
    const offset2 = (camX * 0.04 + GAP2 * 0.5) % GAP2;
    const CAND_H2 = CAND_H * 0.65;
    const CAND_W2 = CAND_H2 * ar;
    const candY2  = groundScreenY - CAND_H2 - 80; // más arriba, simulando estar en la pared alta

    ctx.globalAlpha = flicker * 0.55;
    for (let i = -1; i < Math.ceil(W / GAP2) + 2; i++) {
      const x = i * GAP2 - offset2;
      ctx.drawImage(candelabraImg, x, candY2, CAND_W2, CAND_H2);
    }

    ctx.restore();
  }

  function _drawCanvasTrees(camX, ts, dark) {
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

  // ── Proyectiles (hielo, rayo, bolas de Nuve) ──
  function drawProjectiles(projectiles, camX, camY, ts) {
    if (!projectiles || projectiles.length === 0) return;
    for (const p of projectiles) {
      if (!p.active) continue;
      const sx = p.x - camX, sy = p.y - camY;

      ctx.save();
      if (p.kind === 'ice') {
        // Bola de hielo: hexágono brillante
        const pulse = 0.7 + Math.sin(ts / 80) * 0.3;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r * 2.2);
        g.addColorStop(0, `rgba(186,230,253,${0.8 * pulse})`);
        g.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, p.r * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 + ts / 400;
          i === 0 ? ctx.moveTo(sx + Math.cos(a)*p.r, sy + Math.sin(a)*p.r)
                  : ctx.lineTo(sx + Math.cos(a)*p.r, sy + Math.sin(a)*p.r);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(sx - p.r*0.25, sy - p.r*0.3, p.r*0.3, 0, Math.PI*2); ctx.fill();
      } else if (p.kind === 'ray') {
        // Rayo: línea brillante con destello
        const alpha = (p.life / 1.2) * 0.9;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth   = 5;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.moveTo(sx - p.vx * 0.04, sy);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(sx, sy, p.r * 0.55, 0, Math.PI*2); ctx.fill();
      } else {
        // Bola de color (Nuve)
        const pulse = 0.6 + Math.sin(ts / 60) * 0.4;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r * 2.5);
        g.addColorStop(0,   `rgba(255,255,255,${0.9 * pulse})`);
        g.addColorStop(0.4,  p.color + 'cc');
        g.addColorStop(1,   p.color + '00');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, p.r * 2.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sx, sy, p.r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(sx - p.r*0.28, sy - p.r*0.32, p.r*0.35, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ── Árbol Mágico ──
  function drawMagicTrees(trees, camX, camY, ts) {
    if (!trees) return;
    for (const t of trees) {
      if (t.used) continue;
      const sx = t.x - camX, sy = t.y - camY;
      const bob  = Math.sin(ts / 500) * 3;
      const pulse = 0.6 + Math.sin(ts / 380) * 0.3;

      ctx.save();
      ctx.translate(sx, sy + bob);

      // Halo verde mágico
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 42);
      glow.addColorStop(0,   `rgba(74,222,128,${pulse * 0.55})`);
      glow.addColorStop(0.5, `rgba(34,197,94,${pulse * 0.28})`);
      glow.addColorStop(1,   'rgba(34,197,94,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI*2); ctx.fill();

      // Tronco
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-5, 8, 10, 20);

      // Copa grande
      ctx.fillStyle = '#15803d';
      ctx.beginPath(); ctx.arc(0, -4, 22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.beginPath(); ctx.arc(-8, -10, 14, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.arc(8, -10, 14, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#4ade80';
      ctx.beginPath(); ctx.arc(0, -16, 11, 0, Math.PI*2); ctx.fill();

      // Destellos giratorios
      ctx.fillStyle = `rgba(74,222,128,${pulse})`;
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 + ts / 900;
        const r = 24 + Math.sin(ts/400 + i)*4;
        ctx.beginPath(); ctx.arc(Math.cos(a)*r, Math.sin(a)*r - 4, 3, 0, Math.PI*2); ctx.fill();
      }

      // Indicador de poder
      ctx.font = 'bold 13px Fredoka, system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText('🌳', 0, -32);

      ctx.restore();
    }
  }

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
    drawBackground, drawTilemap, drawBgTreesOverlay,
    showCastle, hideCastle, resetCastle,
    drawPlayer, drawEnemy,
    spawnParticles, updateAndDrawParticles,
    spawnText, drawFloatingTexts,
    drawFlash, flash,
    drawStarAnimated,
    drawFireballs,
    drawProjectiles,
    drawMagicTrees,
    clear,
    getCtx: () => ctx,
  };

})();