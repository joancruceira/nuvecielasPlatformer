// ═══════════════════════════════════════════════════════
//  MAGICDOOR.JS — Puerta mágica del nivel 2
//  10 disparos → se abre → fondo multicolor → aparece sorpresa
// ═══════════════════════════════════════════════════════

const MagicDoor = (() => {

  const TILE_SIZE  = 48;
  const MAX_HITS   = 10;
  const DOOR_W     = TILE_SIZE * 2;   // 2 tiles de ancho
  const DOOR_H     = TILE_SIZE * 2.5; // 2.5 tiles de alto

  const RAINBOW_COLORS = [
    '#ff6b6b','#ffd93d','#6bcb77','#4d96ff',
    '#c77dff','#ff9f1c','#ff477e','#00f5d4',
  ];

  const imgs = {};
  function preload() {
    const img = new Image();
    img.src = 'img/puerta_cerrada.png';
    imgs['cerrada'] = img;

    ['melli_celeste', 'melli_amarilla'].forEach(name => {
      const m = new Image();
      m.src = `img/${name}.png`;
      imgs[name] = m;
    });
  }

  let doors         = [];
  let rainbowTimer  = 0;
  let rainbowActive = false;
  const RAINBOW_DURATION = 7.0;

  function init()  { doors = []; rainbowActive = false; rainbowTimer = 0; }
  function isRainbow()   { return rainbowActive; }
  function getRainbowT() { return rainbowTimer; }

  // Extraer puertas del mapa
  function spawnFromMap(map) {
    doors = [];
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        if (map[r][c] === TILE.MAGIC_DOOR) {
          doors.push({
            col: c, row: r,
            x: c * TILE_SIZE - TILE_SIZE * 0.5, // centrar el ancho de 2 tiles
            y: r * TILE_SIZE,
            hits:        0,
            opened:      false,
            openTimer:   0,
            hitFlash:    0,
            shakeTimer:  0,
            shakeX:      0,
            melliTimer:  0,    // cuánto llevan aparecidas
            melliAlpha:  0,    // fade in de las mellis
            melli1Y:     0,    // offset Y de melli_amarilla
            melli2Y:     0,    // offset Y de melli_celeste
          });
          map[r][c] = TILE.AIR;
        }
      }
    }
  }

  function getDoors() { return doors; }

  // Llamar desde engine con los proyectiles del jugador
  function checkProjectileHits(projectiles, fireballs) {
    for (const door of doors) {
      if (door.opened) continue;

      const allProj = [...(projectiles || []), ...(fireballs || [])];
      for (const p of allProj) {
        if (!p.active) continue;
        const dx = door.x + DOOR_W / 2;
        const dy = door.y + DOOR_H / 2;
        // Colisión con el área de la puerta
        if (p.x > door.x && p.x < door.x + DOOR_W &&
            p.y > door.y && p.y < door.y + DOOR_H) {

          p.active = false; // consumir proyectil
          door.hits++;
          door.hitFlash   = 0.25;
          door.shakeTimer = 0.20;

          Renderer.spawnParticles(p.x, p.y, '#c77dff', 8);
          Renderer.spawnText(
            door.x + DOOR_W/2, door.y - 10,
            `${door.hits}/${MAX_HITS} 💥`, '#c77dff'
          );

          if (door.hits >= MAX_HITS) {
            _openDoor(door);
          }
        }
      }
    }
  }

  function _openDoor(door) {
    door.opened      = true;
    door.openTimer   = 0;
    rainbowActive    = true;
    rainbowTimer     = RAINBOW_DURATION;

    Renderer.spawnParticles(door.x + DOOR_W/2, door.y + DOOR_H/2, '#c77dff', 40);
    Renderer.spawnParticles(door.x + DOOR_W/2, door.y + DOOR_H/2, '#ffd93d', 30);
    Renderer.spawnParticles(door.x + DOOR_W/2, door.y + DOOR_H/2, '#ff6b6b', 25);
    Renderer.flash('rgba(200,100,255,0.75)', 0.95);
  }

  function update(dt) {
    if (rainbowActive) {
      rainbowTimer -= dt;
      if (rainbowTimer <= 0) { rainbowActive = false; rainbowTimer = 0; }
    }
    for (const door of doors) {
      if (door.hitFlash   > 0) door.hitFlash   -= dt;
      if (door.shakeTimer > 0) {
        door.shakeTimer -= dt;
        door.shakeX = door.shakeTimer > 0
          ? Math.sin(door.shakeTimer * 60) * 5 * (door.shakeTimer / 0.20)
          : 0;
      }
      if (door.opened) {
        door.openTimer += dt;
        door.melliTimer += dt;
        // Fade in y subida de las mellis durante 1.2s
        door.melliAlpha = Math.min(1, door.melliTimer * 1.2);
        const rise      = Math.min(1, door.melliTimer / 1.0);
        door.melli1Y    = (1 - rise) * 60;  // sube desde abajo
        door.melli2Y    = (1 - rise) * 80;
      }
    }
  }

  function draw(ctx, camX, camY, ts) {
    for (const door of doors) {
      const sx = door.x - camX + door.shakeX;
      const sy = door.y - camY;

      if (!door.opened) {
        // ── Puerta cerrada ──
        const img = imgs['cerrada'];
        ctx.save();

        if (door.hitFlash > 0) {
          const f = door.hitFlash / 0.25;
          ctx.shadowColor = '#c77dff';
          ctx.shadowBlur  = 24 * f;
          ctx.globalAlpha = 0.4 + (1 - f) * 0.6;
        }

        if (img && img.complete && img.naturalWidth) {
          ctx.drawImage(img, sx, sy, DOOR_W, DOOR_H);
          if (door.hitFlash > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = (door.hitFlash / 0.25) * 0.5;
            ctx.fillStyle   = '#c77dff';
            ctx.fillRect(sx, sy, DOOR_W, DOOR_H);
          }
        } else {
          // Fallback canvas
          ctx.fillStyle = '#6b3a2a';
          ctx.fillRect(sx, sy, DOOR_W, DOOR_H);
          ctx.strokeStyle = '#4a1a0a';
          ctx.lineWidth   = 3;
          ctx.strokeRect(sx, sy, DOOR_W, DOOR_H);
          // Arco
          ctx.strokeStyle = '#888';
          ctx.beginPath();
          ctx.arc(sx + DOOR_W/2, sy + DOOR_H * 0.35, DOOR_W * 0.48, Math.PI, 0);
          ctx.stroke();
          // Runas púrpura
          ctx.fillStyle = '#c77dff';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(sx + 12 + i * 18, sy + DOOR_H * 0.3 + i * 20, 8, 14);
          }
        }
        ctx.restore();

        // Barra de progreso de disparos
        const bw    = DOOR_W;
        const bx    = sx;
        const by    = sy - 14;
        const ratio = door.hits / MAX_HITS;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.roundRect(bx, by, bw, 8, 4); ctx.fill();
        ctx.fillStyle = '#c77dff';
        ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, 8, 4); ctx.fill();
        // Texto disparos
        if (door.hits > 0) {
          ctx.font      = 'bold 11px Fredoka, system-ui';
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.fillText(`${door.hits}/${MAX_HITS}`, bx + bw/2, by - 2);
        }
        ctx.restore();

      } else {
        // ── Puerta abierta: luz mágica saliendo ──
        const t     = door.openTimer;
        const pulse = 0.7 + Math.sin(ts / 180) * 0.25;
        const colorIdx = Math.floor(ts / 200) % RAINBOW_COLORS.length;

        ctx.save();

        // Marco de piedra (canvas)
        ctx.fillStyle = '#555';
        ctx.fillRect(sx, sy, 8, DOOR_H);
        ctx.fillRect(sx + DOOR_W - 8, sy, 8, DOOR_H);
        ctx.fillRect(sx, sy, DOOR_W, 8);

        // Arco interior con luz mágica pulsante
        const glow = ctx.createRadialGradient(
          sx + DOOR_W/2, sy + DOOR_H/2, 0,
          sx + DOOR_W/2, sy + DOOR_H/2, DOOR_W * 0.75
        );
        const col1 = RAINBOW_COLORS[colorIdx];
        const col2 = RAINBOW_COLORS[(colorIdx + 3) % RAINBOW_COLORS.length];
        glow.addColorStop(0,   col1 + 'ff');
        glow.addColorStop(0.5, col2 + 'aa');
        glow.addColorStop(1,   'transparent');

        ctx.globalAlpha = pulse;
        ctx.fillStyle   = glow;
        ctx.beginPath();
        ctx.roundRect(sx + 8, sy + 8, DOOR_W - 16, DOOR_H - 8, 8);
        ctx.fill();

        // Partículas de luz saliendo
        if (Math.random() < 0.4) {
          Renderer.spawnParticles(
            door.x + DOOR_W/2 + (Math.random()-0.5)*DOOR_W*0.6,
            door.y + DOOR_H/2,
            RAINBOW_COLORS[Math.floor(Math.random()*RAINBOW_COLORS.length)], 2
          );
        }
        ctx.restore();

        // ── Las mellis aparecen saliendo de la puerta ──
        if (door.melliAlpha > 0) {
          const mH  = 140;  // alto del sprite en pantalla
          const ar1 = imgs['melli_amarilla']?.naturalWidth / imgs['melli_amarilla']?.naturalHeight || 0.44;
          const ar2 = imgs['melli_celeste']?.naturalWidth  / imgs['melli_celeste']?.naturalHeight  || 0.44;
          const mW1 = mH * ar1;
          const mW2 = mH * ar2;

          // Melli amarilla — izquierda de la puerta
          const m1x = sx - mW1 * 0.1;
          const m1y = sy + DOOR_H - mH + door.melli1Y;
          // Melli celeste — derecha
          const m2x = sx + DOOR_W - mW2 * 0.9;
          const m2y = sy + DOOR_H - mH + door.melli2Y;

          ctx.save();
          ctx.globalAlpha = door.melliAlpha;

          // Estrellitas y colores alrededor de cada melli
          if (door.melliTimer < 3.0 && Math.random() < 0.35) {
            const col = RAINBOW_COLORS[Math.floor(Math.random() * RAINBOW_COLORS.length)];
            Renderer.spawnParticles(m1x + mW1/2 + (Math.random()-0.5)*40, m1y, col, 2);
            Renderer.spawnParticles(m2x + mW2/2 + (Math.random()-0.5)*40, m2y, col, 2);
          }

          const img1 = imgs['melli_amarilla'];
          const img2 = imgs['melli_celeste'];
          if (img1?.complete && img1.naturalWidth) ctx.drawImage(img1, m1x, m1y, mW1, mH);
          if (img2?.complete && img2.naturalWidth) ctx.drawImage(img2, m2x, m2y, mW2, mH);

          // Nombres sobre sus cabezas
          ctx.font      = 'bold 13px Fredoka, system-ui';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffd93d';
          ctx.fillText('✨ Melli ✨', m1x + mW1/2, m1y - 6);
          ctx.fillText('✨ Melli ✨', m2x + mW2/2, m2y - 6);

          ctx.restore();
        }
      }
    }
  }

  // Fondo rainbow — idéntico al de GiftBox
  function drawRainbowBg(ctx, W, H, ts) {
    if (!rainbowActive) return;
    const t     = ts / 400;
    const fade  = Math.min(1, rainbowTimer / 1.5);
    const n     = RAINBOW_COLORS.length;
    const sw    = W / n;
    ctx.save();
    ctx.globalAlpha = 0.68 * fade;
    for (let i = 0; i < n + 2; i++) {
      const xi = i * sw - (t * sw * 0.5) % (sw * n);
      ctx.fillStyle = RAINBOW_COLORS[(i + Math.floor(t)) % n];
      ctx.beginPath();
      ctx.moveTo(xi, 0); ctx.lineTo(xi + sw + H, 0);
      ctx.lineTo(xi + sw, H); ctx.lineTo(xi - H, H);
      ctx.closePath(); ctx.fill();
    }
    if (rainbowTimer > RAINBOW_DURATION - 0.5) {
      const pulse = (rainbowTimer - (RAINBOW_DURATION - 0.5)) / 0.5;
      ctx.globalAlpha = pulse * 0.65;
      ctx.fillStyle   = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  return {
    preload, init, spawnFromMap, update, draw,
    checkProjectileHits, getDoors,
    isRainbow, drawRainbowBg,
  };

})();
