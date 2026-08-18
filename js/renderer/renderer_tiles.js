// ═══════════════════════════════════════════════════════
//  RENDERER_TILES.JS — Tilemap y tiles individuales
//  Depende de: renderer_core.js
// ═══════════════════════════════════════════════════════

const RendererTiles = (() => {

  // ── Sprites nivel 2 ──────────────────────────────────
  const L2 = {};
  [
    ['piso0',               'level2/piso0.png'],
    ['piso1',               'level2/piso1.png'],
    ['piso_banderin',       'level2/piso_banderin.png'],
    ['piso_ventanas',       'level2/piso_ventanas.png'],
    ['pinches0',            'level2/pinches0.png'],
    ['pinches_corto',       'level2/pinches_corto.png'],
    ['pinches_largo',       'level2/pinches_largo.png'],
    ['pinches_techo_corto', 'level2/pinches_techo_corto.png'],
    ['pinches_techo_largo', 'level2/pinches_techo_largo.png'],
  ].forEach(([key, src]) => {
    const img = new Image();
    img.src = `img/${src}`;
    L2[key] = img;
  });

  function _l2img(key) {
    const i = L2[key];
    return (i && i.complete && i.naturalWidth > 0) ? i : null;
  }

  // Elige el sprite de piso según la columna para variedad
  function _pisoSprite(c) {
    if (c % 12 === 0) return _l2img('piso_banderin');
    if (c % 7  === 0) return _l2img('piso_ventanas');
    return c % 2 === 0 ? _l2img('piso0') : _l2img('piso1');
  }

  // Elige el sprite de pinches según cuántos tiles hay en la fila
  function _pinchesSprite(col) {
    if (col % 5 === 0) return _l2img('pinches_largo');
    return _l2img('pinches_corto') || _l2img('pinches0');
  }

  function _pinchesSpriteTecho(col) {
    if (col % 5 === 0) return _l2img('pinches_techo_largo');
    return _l2img('pinches_techo_corto');
  }


  // ── Dibujos del Bosque Mágico ────────────────────────
  function _al(key) {
    if (typeof AssetLoader === 'undefined') return null;
    const i = AssetLoader.get(key);
    return (i && i.complete && i.naturalWidth > 0) ? i : null;
  }

  // Tierra del bosque. La de arriba lleva pasto, musgo y de vez en cuando un
  // hongo celeste asomando, que es lo que tiene el fondo del nivel.
  function _sueloBosque(ctx, x, y, T, col, esSuperficie) {
    const g = ctx.createLinearGradient(0, y, 0, y + T);
    g.addColorStop(0, esSuperficie ? '#3f2a17' : '#33210f');
    g.addColorStop(1, '#241608');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, T, T);

    // Grumos de tierra — fijos por columna, no aleatorios: si cambian cada
    // frame el suelo hierve.
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    for (let i = 0; i < 3; i++) {
      const px = x + ((col * 17 + i * 29) % (T - 8)) + 4;
      const py = y + ((col * 11 + i * 23) % (T - 10)) + 6;
      ctx.fillRect(px, py, 5, 4);
    }

    if (!esSuperficie) return;

    // Manto de musgo
    const gm = ctx.createLinearGradient(0, y, 0, y + T * 0.34);
    gm.addColorStop(0, '#4e8f3a');
    gm.addColorStop(1, '#2c5e24');
    ctx.fillStyle = gm;
    ctx.fillRect(x, y, T, T * 0.30);
    ctx.fillStyle = 'rgba(163,230,53,0.30)';
    ctx.fillRect(x, y, T, 3);

    // Pastitos que asoman
    ctx.strokeStyle = '#4e8f3a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const px = x + ((col * 13 + i * 19) % (T - 6)) + 3;
      const alto = 5 + ((col + i) % 4) * 2;
      ctx.beginPath();
      ctx.moveTo(px, y + 1);
      ctx.lineTo(px + ((col + i) % 3) - 1, y - alto);
      ctx.stroke();
    }

    // Cada tantos tiles, un hongo chiquito que brilla
    if (col % 7 === 3) {
      const hx = x + T * 0.62;
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(hx - 2, y - 7, 4, 7);
      const gh = ctx.createRadialGradient(hx, y - 9, 1, hx, y - 9, 11);
      gh.addColorStop(0, 'rgba(103,232,249,0.95)');
      gh.addColorStop(1, 'rgba(103,232,249,0)');
      ctx.fillStyle = gh;
      ctx.beginPath(); ctx.ellipse(hx, y - 9, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Zarzas en vez de triángulos rojos: el peligro tiene que pertenecer al lugar.
  function _zarzas(ctx, x, y, T, col) {
    ctx.save();
    // Maraña de tallos
    ctx.strokeStyle = '#3b2415'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const bx = x + (i + 0.5) * (T / 4);
      ctx.beginPath();
      ctx.moveTo(bx - 6, y + T);
      ctx.quadraticCurveTo(bx, y + T * 0.45, bx + ((col + i) % 3) * 3 - 3, y + 4);
      ctx.stroke();
    }
    // Espinas
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < 6; i++) {
      const sx2 = x + ((col * 7 + i * 13) % (T - 8)) + 4;
      const sy2 = y + 6 + ((col + i * 5) % (T - 16));
      const dir = (i % 2) ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(sx2, sy2);
      ctx.lineTo(sx2 + dir * 6, sy2 - 3);
      ctx.lineTo(sx2, sy2 - 7);
      ctx.closePath(); ctx.fill();
    }
    // Hojitas violetas
    ctx.fillStyle = 'rgba(147,51,234,0.75)';
    for (let i = 0; i < 2; i++) {
      const lx = x + ((col * 5 + i * 21) % (T - 10)) + 5;
      ctx.beginPath();
      ctx.ellipse(lx, y + 10 + i * 14, 5, 3, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Plataformas: ramas con corteza y musgo arriba, no barritas amarillas.
  function _rama(ctx, x, y, T, col) {
    const alto = T * 0.42;
    const g = ctx.createLinearGradient(0, y, 0, y + alto);
    g.addColorStop(0, '#6b4423');
    g.addColorStop(1, '#3d2614');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, T, alto, 5);
    ctx.fill();
    // Musgo arriba
    ctx.fillStyle = '#4e8f3a';
    ctx.beginPath();
    ctx.roundRect(x, y, T, alto * 0.34, 4);
    ctx.fill();
    // Vetas de la corteza
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const ly = y + alto * (0.55 + i * 0.22);
      ctx.beginPath();
      ctx.moveTo(x + 3, ly);
      ctx.lineTo(x + T - 3, ly + ((col + i) % 3) - 1);
      ctx.stroke();
    }
  }


  // ── Teñido del castillo ──────────────────────────────
  //
  //  Los sprites de piedra del nivel 2 están dibujados en LILA AZULADO y el
  //  fondo es una ruina en llamas, carbón y carmesí. No es que falten sprites:
  //  están en otra paleta, y la capa jugable parecía pegada de otro juego.
  //
  //  Se tiñen UNA sola vez, al primer uso, en un lienzo aparte que se guarda.
  //  Teñir por frame costaría carísimo y encima 'source-atop' sobre el canvas
  //  principal mancharía el fondo, que es el bug que ya arreglamos en la
  //  serpiente y el fantasma.
  //  La clave es la RUTA de la imagen, no la columna: distintas columnas piden
  //  distintos sprites de piso, y cachear por columna devolvía el teñido del
  //  sprite equivocado.
  const _tenidos = {};
  function _alCarbon(img) {
    if (!img) return null;
    const clave = img.src;
    if (_tenidos[clave]) return _tenidos[clave];
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    // Primero al gris: mata el lila sin tocar el dibujo.
    x.globalCompositeOperation = 'saturation';
    x.fillStyle = 'hsl(0,0%,50%)';
    x.fillRect(0, 0, c.width, c.height);
    // Después oscurecer y llevar a piedra fría casi negra.
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = '#6b625c';
    x.fillRect(0, 0, c.width, c.height);
    // Y una pizca de brasa en las luces, para que la piedra respire fuego.
    x.globalCompositeOperation = 'overlay';
    x.fillStyle = 'rgba(120,53,15,0.55)';
    x.fillRect(0, 0, c.width, c.height);
    // Recortar todo a la silueta original: sin esto los rellenos pintan el
    // rectángulo entero, incluido lo transparente.
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(img, 0, 0);
    _tenidos[clave] = c;
    return c;
  }

  // Plataformas del castillo: piedra con el borde gastado, no una barrita.
  function _repisa(ctx, x, y, T, col) {
    const alto = T * 0.40;
    const g = ctx.createLinearGradient(0, y, 0, y + alto);
    g.addColorStop(0, '#5c554e');
    g.addColorStop(1, '#26221e');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, T, alto);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x, y, T, 3);
    // Junta entre bloques y alguna brasa en la grieta
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + T - 2, y, 2, alto);
    if (col % 4 === 1) {
      ctx.fillStyle = 'rgba(249,115,22,0.55)';
      ctx.fillRect(x + 5, y + alto - 4, T - 12, 2);
    }
  }

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

  function drawTilemap(map, level, camX, camY) {
    if (!map || !level) return;
    const { ctx, W, H } = R;
    const pal      = getTilePalette(level);
    const rows     = map.length;
    const cols     = map[0].length;
    const startCol = Math.max(0,      Math.floor(camX / TILE_SIZE) - 1);
    const endCol   = Math.min(cols-1, Math.ceil((camX + W) / TILE_SIZE) + 1);
    const startRow = Math.max(0,      Math.floor(camY / TILE_SIZE) - 1);
    const endRow   = Math.min(rows-1, Math.ceil((camY + H) / TILE_SIZE) + 1);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tile = map[r][c];
        if (tile === TILE.AIR) continue;
        const x = Math.floor(c * TILE_SIZE - camX);
        const y = Math.floor(r * TILE_SIZE - camY);
        _drawTile(tile, x, y, TILE_SIZE, pal, level, c, r);
      }
    }
  }

  function _drawTile(tile, x, y, T, pal, level, col, row) {
    const { ctx } = R;
    ctx.save();

    // ── Nivel 2: usar sprites cuando están disponibles ──
    if (level.castleNC) {
      if (tile === TILE.GROUND) {
        const img = _pisoSprite(col);
        const t2 = _alCarbon(img);
        if (t2) { ctx.drawImage(t2, x, y, T, T); ctx.restore(); return; }
      }
      if (tile === TILE.BLOCK) {
        const img = _l2img('piso1') || _l2img('piso0');
        const t2 = _alCarbon(img);
        if (t2) { ctx.drawImage(t2, x, y, T, T); ctx.restore(); return; }
      }
      if (tile === TILE.PLATFORM) {
        _repisa(ctx, x, y, T, col);
        ctx.restore(); return;
      }
      if (tile === TILE.SPIKES) {
        // Fila < 6 = pinchos de techo (apuntan hacia abajo)
        const isCeiling = row < 6;
        const img = isCeiling ? _pinchesSpriteTecho(col) : _pinchesSprite(col);
        if (img) { ctx.drawImage(img, x, y, T, T); ctx.restore(); return; }
      }
    }

    // ── Nivel 5: los pinchos del lago son coral punzante ─
    // El peligro tiene que pertenecer al lugar: en el fondo de un lago no
    // hay púas de metal, hay coral. Es el mismo TILE.SPIKES de siempre, con
    // la cara que le corresponde al nivel.
    if (level.lago && tile === TILE.SPIKES && typeof AssetLoader !== 'undefined') {
      const img = AssetLoader.get(col % 2 ? 'coral_punzante01' : 'coral_punzante0');
      if (img && img.complete && img.naturalWidth > 0) {
        // Fila < 6 = coral que cuelga del techo: el mismo sprite dado vuelta
        if (row < 6) {
          ctx.translate(x, y + T);
          ctx.scale(1, -1);
          ctx.drawImage(img, 0, 0, T, T);
        } else {
          ctx.drawImage(img, x, y, T, T);
        }
        ctx.restore();
        return;
      }
    }

    // ── Nivel 1: el Bosque Mágico ────────────────────────
    // El fondo del nivel es un bosque encantado y lo que se pisaba era una
    // franja verde sobre ladrillos marrones. Acá el suelo, las plataformas y
    // los pinchos pasan a pertenecer al bosque. Si hay sprite se usa; si no,
    // se dibuja por código — que ya es muchísimo mejor que un rectángulo.
    if (level.bosqueMagico) {
      if (tile === TILE.GROUND || tile === TILE.BLOCK) {
        // Seis celdas de superficie y tres de tierra, elegidas por COLUMNA:
        // el mismo tile cae siempre igual. Con azar por frame el suelo hierve.
        const clave = tile === TILE.BLOCK
          ? 'tierra' + ((col * 3 + row) % 3)
          : 'suelo'  + ((col * 7) % 6);
        const img = _al(clave);
        if (img) {
          // La tierra se espeja en columnas alternas. Repetida tal cual, la
          // misma textura cada 48 px dibuja una grilla en el suelo; espejada
          // se lee como tierra y no como baldosas.
          if (tile === TILE.BLOCK && col % 2) {
            ctx.translate(x + T, y); ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, T, T);
          } else {
            ctx.drawImage(img, x, y, T, T);
          }
          ctx.restore(); return;
        }
        _sueloBosque(ctx, x, y, T, col, tile === TILE.GROUND);
        ctx.restore(); return;
      }
      if (tile === TILE.SPIKES) {
        const img = _al('zarza' + ((col * 5) % 3));
        if (img) { ctx.drawImage(img, x, y, T, T); ctx.restore(); return; }
        _zarzas(ctx, x, y, T, col);
        ctx.restore(); return;
      }
      if (tile === TILE.PLATFORM) {
        _rama(ctx, x, y, T, col);
        ctx.restore(); return;
      }
    }

    switch (tile) {

      case TILE.GROUND: {
        ctx.fillStyle = pal.groundTop;  ctx.fillRect(x, y, T, T * 0.3);
        ctx.fillStyle = pal.groundFill; ctx.fillRect(x, y + T*0.3, T, T*0.7);
        if (!level.dark) {
          ctx.fillStyle = 'rgba(255,255,255,.15)';
          ctx.fillRect(x+2, y+2, T-4, 4);
        }
        break;
      }

      case TILE.BLOCK: {
        ctx.fillStyle = pal.groundFill; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = 'rgba(0,0,0,.12)';
        ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y, 2, T);
        break;
      }

      case TILE.ICE: {
        const grad = ctx.createLinearGradient(x, y, x, y + T);
        grad.addColorStop(0, '#7dd3fc');
        grad.addColorStop(0.7, '#38bdf8');
        grad.addColorStop(1, '#0284c7');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, T, T);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(x + 2, y + 2, T - 4, 3);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 6);
        ctx.lineTo(x + T - 8, y + T - 8);
        ctx.stroke();
        break;
      }

      case TILE.ICE_SPIKES: {
        ctx.fillStyle = '#bae6fd';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        const n = 3, sw = T / n;
        for (let i = 0; i < n; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * sw, y + T);
          ctx.lineTo(x + i * sw + sw / 2, y + T * 0.20);
          ctx.lineTo(x + i * sw + sw, y + T);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let i = 0; i < n; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * sw + sw / 2 - 2, y + T);
          ctx.lineTo(x + i * sw + sw / 2, y + T * 0.4);
          ctx.lineTo(x + i * sw + sw / 2 + 2, y + T);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case TILE.PLATFORM: {
        const grad = ctx.createLinearGradient(x, y, x, y+14);
        grad.addColorStop(0, pal.platform); grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(x+2, y, T-4, 14, 5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.30)';
        ctx.fillRect(x+4, y+2, T-8, 3);
        break;
      }

      case TILE.SPIKES: {
        ctx.fillStyle = pal.spikes;
        const n=3, sw=T/n;
        for (let i=0; i<n; i++) {
          ctx.beginPath();
          ctx.moveTo(x+i*sw, y+T);
          ctx.lineTo(x+i*sw+sw/2, y+T*0.25);
          ctx.lineTo(x+i*sw+sw, y+T);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(200,30,40,.4)';
        ctx.fillRect(x, y+T*0.82, T, T*0.18);
        break;
      }

      case TILE.STAR: {
        _drawStarTile(x+T/2, y+T/2, T*0.38, pal.star);
        break;
      }

      case TILE.CHECKPOINT: {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(x+T/2-2, y+4, 4, T-8);
        ctx.beginPath();
        ctx.moveTo(x+T/2+2, y+6);
        ctx.lineTo(x+T/2+20, y+14);
        ctx.lineTo(x+T/2+2, y+22);
        ctx.closePath(); ctx.fill();
        break;
      }

      case TILE.PORTAL: {
        _drawPortal(x+T/2, y+T/2, T*0.44);
        break;
      }
    }
    ctx.restore();
  }

  function _drawStarTile(cx, cy, r, col) {
    const { ctx } = R;
    ctx.save();
    ctx.fillStyle = col + '80';
    ctx.beginPath(); ctx.arc(cx, cy, r*2.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = col;
    _drawStarShape(cx, cy, r);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath(); ctx.arc(cx-r*0.2, cy-r*0.25, r*0.32, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function _drawStarShape(cx, cy, r) {
    const { ctx } = R;
    ctx.beginPath();
    const spikes=5, inner=r*0.45;
    let rot = -Math.PI/2;
    for (let i=0; i<spikes*2; i++) {
      const radius = i%2===0 ? r : inner;
      ctx.lineTo(cx+Math.cos(rot)*radius, cy+Math.sin(rot)*radius);
      rot += Math.PI/spikes;
    }
    ctx.closePath(); ctx.fill();
  }

  function _drawPortal(cx, cy, r) {
    const { ctx } = R;
    ctx.save();
    const g = ctx.createRadialGradient(cx,cy,r*0.3,cx,cy,r*1.4);
    g.addColorStop(0,   'rgba(255,255,255,.90)');
    g.addColorStop(0.4, 'rgba(167,139,250,.80)');
    g.addColorStop(0.8, 'rgba(99,102,241,.55)');
    g.addColorStop(1,   'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx,cy,r*1.4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(cx,cy,r*0.45,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // Estrella animada coleccionable (fuera del tilemap)
  function drawStarAnimated(x, y, ts, collected) {
    if (collected) return;
    const bounce = Math.sin(ts / 500) * 3;
    _drawStarTile(x, y + bounce, TILE_SIZE * 0.38, '#f9c846');
  }

  return { getTilePalette, drawTilemap, drawStarAnimated };

})();