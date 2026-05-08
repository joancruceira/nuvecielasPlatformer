// ═══════════════════════════════════════════════════════
//  GIFTBOX.JS — Caja sorpresa con gatito
//  5 saltos → se abre → sale el gatito → fondo multicolor
// ═══════════════════════════════════════════════════════

const GiftBox = (() => {

  const TILE_SIZE = 48;
  const MAX_HITS  = 5;

  // Imágenes
  const imgs = {};
  function preload() {
    ['caja_cerrada', 'caja_abierta', 'gatito'].forEach(name => {
      const img = new Image();
      img.src = `img/${name}.png`;
      imgs[name] = img;
    });
  }

  // Estado global de cajas en el nivel
  let boxes = [];

  // Estado del fondo multicolor
  let rainbowTimer  = 0;
  let rainbowActive = false;
  const RAINBOW_DURATION = 6.0; // segundos
  const RAINBOW_COLORS = [
    '#ff6b6b','#ffd93d','#6bcb77','#4d96ff',
    '#c77dff','#ff9f1c','#ff477e','#00f5d4',
  ];

  function init() {
    boxes = [];
    rainbowActive = false;
    rainbowTimer  = 0;
  }

  // Extraer cajas del mapa
  function spawnFromMap(map) {
    boxes = [];
    const rows = map.length, cols = map[0].length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (map[r][c] === TILE.GIFT_BOX) {
          boxes.push({
            col: c, row: r,
            x:   c * TILE_SIZE,
            y:   r * TILE_SIZE,
            w:   TILE_SIZE, h: TILE_SIZE,
            hits:     0,
            opened:   false,
            bounceTimer: 0,   // animación de rebote al golpear
            hitFlash:    0,   // destello blanco al ser golpeada
            openTimer:   0,   // tiempo desde que se abrió
            catTimer:    0,   // animación del gatito saliendo
            catY:        0,   // offset Y del gatito (sube al salir)
            catAlpha:    0,
          });
          map[r][c] = TILE.AIR; // limpiar del mapa
        }
      }
    }
  }

  function getBoxes()     { return boxes; }
  function isRainbow()    { return rainbowActive; }
  function getRainbowT()  { return rainbowTimer; }

  // Update — llamar desde engine cada frame
  function update(dt, ps, onOpen) {
    if (rainbowActive) {
      rainbowTimer -= dt;
      if (rainbowTimer <= 0) { rainbowActive = false; rainbowTimer = 0; }
    }

    for (const box of boxes) {
      if (box.bounceTimer > 0) box.bounceTimer -= dt;
      if (box.hitFlash    > 0) box.hitFlash    -= dt;
      // Resetear flag de hit cuando el jugador está en el suelo (nuevo salto)
      if (ps.grounded && box._hitThisJump) box._hitThisJump = false;

      if (box.opened) {
        box.openTimer += dt;
        // Gatito sube durante 1.5s
        if (box.catTimer < 1.5) {
          box.catTimer  += dt;
          box.catY       = -box.catTimer * 80; // sube
          box.catAlpha   = Math.min(1, box.catTimer * 2);
        }
        continue;
      }

      // Colisión desde abajo: jugador salta y golpea la base de la caja
      const pRight = ps.x + ps.w, pLeft = ps.x;
      const pTop   = ps.y,        pBot  = ps.y + ps.h;
      const bLeft  = box.x + 2,   bRight = box.x + box.w - 2;
      const bTop   = box.y,        bBot  = box.y + box.h;

      const overlapX = pRight > bLeft && pLeft < bRight;
      const overlapY = pBot > bTop && pTop < bBot;

      if (!overlapX || !overlapY) continue; // sin overlap, nada que hacer

      // ── Desde arriba: el jugador aterriza encima — comportarse como tile sólido ──
      const landingOnTop = ps.vy >= 0 && pBot >= bTop && pBot <= bTop + 16 && overlapX;
      if (landingOnTop) {
        ps.y       = bTop - ps.h;
        ps.vy      = 0;
        ps.grounded = true;
        // Flash de hit en la caja para feedback visual
        box.hitFlash = 0.12;
        continue;
      }

      // ── Desde abajo: cabeza toca la base de la caja mientras sube ──
      const headNearBase = pTop <= bBot + 6 && pTop >= bBot - 20;
      const hitsBottom   = ps.vy < 0 && headNearBase && overlapX;

      if (hitsBottom && !box._hitThisJump) {
        box._hitThisJump = true;
        box.hits++;
        box.bounceTimer = 0.18;
        box.hitFlash    = 0.20; // destello de hit

        // Rebotar al jugador hacia abajo (rebote natural)
        ps.vy = Math.abs(ps.vy) * 0.4 + 60;
        ps.y  = bBot + 2; // sacar al jugador de dentro de la caja
        ps.grounded = false;

        Renderer.spawnParticles(box.x + box.w/2, box.y, '#f9c846', 8);

        if (box.hits >= MAX_HITS) {
          box.opened = true;
          box.catTimer = 0;
          Renderer.spawnParticles(box.x + box.w/2, box.y - 20, '#f9c846', 28);
          Renderer.spawnParticles(box.x + box.w/2, box.y - 20, '#ff6b6b', 20);
          Renderer.spawnParticles(box.x + box.w/2, box.y - 20, '#c77dff', 20);
          Renderer.flash('rgba(255,255,255,0.85)', 0.9);
          // Activar fondo multicolor
          rainbowActive = true;
          rainbowTimer  = RAINBOW_DURATION;
          onOpen && onOpen(box);
        } else {
          // Mostrar cuántos golpes faltan
          const left = MAX_HITS - box.hits;
          Renderer.spawnText(box.x + box.w/2, box.y - 10, `${left} 💥`, '#f9c846');
        }
      }
    }
  }

  // Dibujar cajas — llamar desde render DESPUÉS del tilemap
  function draw(ctx, camX, camY, ts) {
    for (const box of boxes) {
      const sx = box.x - camX;
      const sy = box.y - camY + (box.bounceTimer > 0 ? Math.sin(box.bounceTimer * 30) * -6 : 0);

      if (!box.opened) {
        // Caja cerrada — vibra con cada golpe
        const img = imgs['caja_cerrada'];
        if (img && img.complete && img.naturalWidth) {
          const scale = box.bounceTimer > 0 ? 1.08 : 1.0;
          const dw = box.w * 1.4 * scale;
          const dh = box.h * 1.7 * scale;
          const ix = sx + box.w/2 - dw/2;
          const iy = sy + box.h - dh;

          ctx.save();
          // Transparencia pulsante al recibir golpe
          if (box.hitFlash > 0) {
            const flashPct = box.hitFlash / 0.20;
            ctx.globalAlpha = 0.35 + (1 - flashPct) * 0.65; // de transparente a normal
            // Halo blanco alrededor
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur  = 18 * flashPct;
          }
          ctx.drawImage(img, ix, iy, dw, dh);

          // Overlay blanco que se desvanece
          if (box.hitFlash > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = (box.hitFlash / 0.20) * 0.55;
            ctx.fillStyle   = '#ffffff';
            ctx.fillRect(ix, iy, dw, dh);
          }
          ctx.restore();
        } else {
          // Fallback
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(sx, sy, box.w, box.h);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(sx + box.w/2 - 4, sy, 8, box.h);
          ctx.fillRect(sx, sy + box.h/2 - 4, box.w, 8);
        }

        // Indicador de golpes restantes (puntitos dorados)
        for (let i = 0; i < MAX_HITS - box.hits; i++) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(sx + 8 + i * 8, sy - 6, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Caja abierta
        const imgOpen = imgs['caja_abierta'];
        if (imgOpen && imgOpen.complete && imgOpen.naturalWidth) {
          const ar = imgOpen.naturalWidth / imgOpen.naturalHeight;
          const dh = box.h * 2.0;
          const dw = dh * ar;
          ctx.drawImage(imgOpen, sx + box.w/2 - dw/2, sy + box.h - dh, dw, dh);
        }

        // Gatito sale volando hacia arriba
        if (box.catTimer < 3.0) {
          const imgCat = imgs['gatito'];
          if (imgCat && imgCat.complete && imgCat.naturalWidth) {
            const ar  = imgCat.naturalWidth / imgCat.naturalHeight;
            const ch  = 72;
            const cw  = ch * ar;
            ctx.save();
            ctx.globalAlpha = Math.min(1, box.catAlpha);
            // Girar un poco al salir
            ctx.translate(sx + box.w/2, sy + box.catY);
            ctx.rotate(Math.sin(box.catTimer * 3) * 0.15);
            ctx.drawImage(imgCat, -cw/2, -ch/2, cw, ch);
            ctx.restore();
          }

          // Estrellitas y fueguitos alrededor del gatito
          if (box.openTimer < 2.0 && Math.random() < 0.3) {
            const angle = Math.random() * Math.PI * 2;
            const rad   = 30 + Math.random() * 25;
            Renderer.spawnParticles(
              box.x + box.w/2 + Math.cos(angle) * rad - camX,
              box.y + box.catY - camY,
              RAINBOW_COLORS[Math.floor(Math.random() * RAINBOW_COLORS.length)], 3
            );
          }
        }
      }
    }
  }

  // Fondo multicolor — llamar al inicio de drawBackground si rainbow activo
  function drawRainbowBg(ctx, W, H, ts) {
    if (!rainbowActive) return;

    const t       = ts / 400;
    const fade    = Math.min(1, rainbowTimer / 1.5); // fade out al final
    const nColors = RAINBOW_COLORS.length;

    // Franjas diagonales animadas
    ctx.save();
    ctx.globalAlpha = 0.72 * fade;
    const stripeW = W / nColors;
    for (let i = 0; i < nColors + 2; i++) {
      const xi = (i * stripeW - (t * stripeW * 0.5) % (stripeW * nColors));
      ctx.fillStyle = RAINBOW_COLORS[(i + Math.floor(t)) % nColors];
      ctx.beginPath();
      ctx.moveTo(xi,          0);
      ctx.lineTo(xi + stripeW + H, 0);
      ctx.lineTo(xi + stripeW,     H);
      ctx.lineTo(xi - H,           H);
      ctx.closePath();
      ctx.fill();
    }

    // Pulso blanco en el centro al momento de apertura
    if (rainbowTimer > RAINBOW_DURATION - 0.5) {
      const pulse = (rainbowTimer - (RAINBOW_DURATION - 0.5)) / 0.5;
      ctx.globalAlpha = pulse * 0.6;
      ctx.fillStyle   = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  return {
    preload, init, spawnFromMap, update, draw,
    getBoxes, isRainbow, getRainbowT, drawRainbowBg,
    RAINBOW_COLORS,
  };

})();
