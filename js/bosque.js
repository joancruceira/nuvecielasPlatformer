// ═══════════════════════════════════════════════════════
//  BOSQUE.JS — Todo lo que hace que el Bosque Mágico sea un bosque
//
//  Un solo sistema para el nivel 1, hermano de lago.js.
//
//  EL PROBLEMA QUE RESUELVE: el fondo del nivel es hermoso —árboles enormes,
//  niebla violeta, hongos que brillan— y lo que la nena pisaba era una franja
//  verde sobre ladrillos marrones. El fondo hacía todo el trabajo y la capa
//  jugable no le pertenecía. Esto es lo que las une.
//
//  LA MECÁNICA PROPIA son los hongos trampolín, y no salieron de la nada: el
//  fondo está lleno de hongos que brillan y el jefe del nivel es un Hongo
//  Gigante. Nadie lo había cobrado. Ahora, cuando la nena llega al jefe, viene
//  rebotando en sus hijos hace veinte minutos.
//
//  Cómo empuja, sin tocar player.js: igual que el lago. Este sistema corre
//  DESPUÉS de Player.update() y sólo toca la VELOCIDAD, nunca la posición, así
//  que el rebote lo integra el jugador en el frame siguiente con su propia
//  colisión y es imposible meterlo dentro de una pared.
// ═══════════════════════════════════════════════════════

const Bosque = (() => {

  const TS = 48;

  let activo    = false;
  let hongos    = [];   // trampolines
  let flores    = [];   // se abren y se cierran
  let props     = [];   // hongos deco, plantas, el árbol de las manos
  let luces     = [];   // luciérnagas
  let rayos     = [];   // haces de sol
  let niebla    = [];
  let reloj     = 0;

  const REBOTE = -880;  // bastante más que el salto normal: por eso es un premio

  function init() {
    activo = false;
    hongos = []; flores = []; props = []; luces = []; rayos = []; niebla = [];
    reloj = 0;
  }

  // ── Nacimiento desde el mapa ──────────────────────────
  //
  //  Los props se anclan por la BASE al piso del tile donde los pusiste: van en
  //  la fila 12 y quedan parados sobre el suelo de la 13, mida lo que mida el
  //  sprite. Igual que en el lago.
  function spawnFromMap(map, levelData) {
    init();
    activo = true;

    const filas = map.length, cols = map[0].length;

    const medidas = {
      [TILE.HONGO_DECO]:  { keys: ['hongo_deco0','hongo_deco1','hongo_deco2'],       alto: 1.5 },
      [TILE.PLANTA]:      { keys: ['planta0','planta1','planta2','planta3'],          alto: 1.7 },
      [TILE.ARBOL_MANOS]: { keys: ['arbol_manos'],                                    alto: 8.0 },
    };

    for (let r = 0; r < filas; r++) {
      for (let c = 0; c < cols; c++) {
        const t = map[r][c];

        if (medidas[t]) {
          const m = medidas[t];
          props.push({
            key:  m.keys[(c * 3 + r) % m.keys.length],   // variedad sin azar
            cx:   c * TS + TS / 2,
            base: (r + 1) * TS,
            alto: m.alto * TS,
            mece: t !== TILE.ARBOL_MANOS,   // el árbol no se mece: pesa
            fase: (c * 0.7 + r * 1.3) % (Math.PI * 2),
            brilla: t === TILE.HONGO_DECO,
          });
          map[r][c] = TILE.AIR;

        } else if (t === TILE.HONGO_SALTO) {
          hongos.push({
            x: c * TS - TS * 0.25, base: (r + 1) * TS,
            w: TS * 1.5, h: TS * 0.9,
            aplaste: 0,        // 0 = en reposo, 1 = aplastado del todo
            enfriamiento: 0,
          });
          map[r][c] = TILE.AIR;

        } else if (t === TILE.FLOR) {
          flores.push({
            cx: c * TS + TS / 2, base: (r + 1) * TS,
            w: TS * 1.4, h: TS * 1.9,
            fase: (c * 0.9) % 3.4,   // no se abren todas a la vez
            abierta: true,
            enfriamiento: 0,
          });
          map[r][c] = TILE.AIR;
        }
      }
    }

    // Rayos de sol: en el fondo hay haces atravesando las copas y la capa
    // jugable no tenía ninguno. Van fijos en el mundo, no en la pantalla, para
    // que la cámara pase por debajo de ellos y se sienta el volumen.
    for (let i = 0; i < 26; i++) {
      rayos.push({
        x: (i * 7 + 3) * TS + (i % 5) * 40,
        ancho: 60 + (i % 4) * 34,
        inclina: 0.20 + (i % 3) * 0.06,
        alpha: 0.05 + (i % 3) * 0.025,
        fase: i * 1.7,
      });
    }
    for (let i = 0; i < 34; i++) {
      niebla.push({
        x: Math.random() * cols * TS,
        y: (9.2 + Math.random() * 3.2) * TS,
        w: 120 + Math.random() * 220,
        h: 14 + Math.random() * 22,
        v: 4 + Math.random() * 10,
        alpha: 0.05 + Math.random() * 0.07,
      });
    }
  }

  // ── Update ────────────────────────────────────────────
  function update(dt, ps, map) {
    if (!activo) return;
    reloj += dt;
    _hongos(dt, ps);
    _flores(dt, ps);
    _luces(dt, ps, map);
    for (const n of niebla) {
      n.x += n.v * dt;
      n.oculta = _macizo(map, n.x + n.w / 2, n.y);
    }
  }

  function _hongos(dt, ps) {
    for (const h of hongos) {
      // El sombrero vuelve solo a su forma
      h.aplaste = Math.max(0, h.aplaste - dt * 3.5);
      if (h.enfriamiento > 0) h.enfriamiento -= dt;
      if (h.enfriamiento > 0) continue;

      // Se rebota CAYENDO sobre el sombrero, no rozándolo de costado: si no,
      // pasar caminando al lado te disparaba sin que entendieras por qué.
      const pies = ps.y + ps.h;
      const sobre = ps.x + ps.w > h.x + 6 && ps.x < h.x + h.w - 6;
      const enElSombrero = pies > h.base - h.h && pies < h.base - h.h * 0.25;
      if (sobre && enElSombrero && ps.vy >= 0) {
        ps.vy = REBOTE;
        ps.grounded = false;
        h.aplaste = 1;
        h.enfriamiento = 0.18;
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('jump');
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(h.x + h.w / 2, h.base - h.h * 0.5, '#67e8f9', 10);
        }
      }
    }
  }

  function _flores(dt, ps) {
    for (const f of flores) {
      f.fase = (f.fase + dt) % 3.4;
      f.abierta = f.fase < 2.0;          // 2 s abierta, 1,4 s cerrada
      if (f.enfriamiento > 0) f.enfriamiento -= dt;
      if (f.abierta || f.enfriamiento > 0) continue;

      // Cerrada te empuja con polen, NO te saca vida. La almeja del lago muerde,
      // pero eso está en el último nivel: éste es el primero del juego y el
      // castigo tiene que ser proporcional. La lección —mirar el ritmo y entrar
      // a tiempo— se aprende igual perdiendo la posición.
      const tocando = ps.x + ps.w > f.cx - f.w / 2 && ps.x < f.cx + f.w / 2 &&
                      ps.y + ps.h > f.base - f.h && ps.y < f.base;
      if (tocando) {
        f.enfriamiento = 1.2;
        const dir = (ps.x + ps.w / 2) < f.cx ? -1 : 1;
        ps.vx = dir * 340;
        ps.vy = Math.min(ps.vy, -240);
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(f.cx, f.base - f.h * 0.6, '#e9d5ff', 16);
          Renderer.spawnText(f.cx, f.base - f.h, '¡Polen!', '#c4b5fd');
        }
      }
    }
  }

  // Luciérnagas: no hacen daño y no hacen nada. Se juntan cuando te quedás
  // quieta y se dispersan cuando corrés — es el cardumen del lago, en bosque.
  function _luces(dt, ps, map) {
    const cx = ps.x + ps.w / 2, cy = ps.y + ps.h / 2;
    while (luces.length < 26) {
      luces.push({
        x: cx + (Math.random() - 0.5) * 900,
        y: cy + (Math.random() - 0.5) * 500,
        vx: 0, vy: 0,
        fase: Math.random() * 6.28,
        r: 1.6 + Math.random() * 2.2,
      });
    }
    const corriendo = Math.abs(ps.vx) > 90;
    for (const l of luces) {
      const dx = cx - l.x, dy = cy - l.y;
      const d = Math.hypot(dx, dy) || 1;
      // Quieta: se acercan. Corriendo: se apartan.
      const tira = corriendo ? -26 : (d > 120 ? 22 : -14);
      l.vx += (dx / d) * tira * dt * 3;
      l.vy += (dy / d) * tira * dt * 3;
      l.vx += Math.sin(reloj * 2.1 + l.fase) * 14 * dt;
      l.vy += Math.cos(reloj * 1.7 + l.fase) * 14 * dt;
      l.vx *= 0.97; l.vy *= 0.97;
      l.x += l.vx; l.y += l.vy;
      // Nada de luciérnagas dentro de la tierra: nacen alrededor del jugador
      // sin mirar el mapa, así que sin esto quedaban brillando bajo el suelo.
      l.oculta = _macizo(map, l.x, l.y);
      if (Math.abs(l.x - cx) > 800 || Math.abs(l.y - cy) > 520) {
        l.x = cx + (Math.random() - 0.5) * 700;
        l.y = cy + (Math.random() - 0.5) * 420;
        l.vx = l.vy = 0;
      }
    }
  }

  function _macizo(map, x, y) {
    const t = map && map[Math.floor(y / TS)] && map[Math.floor(y / TS)][Math.floor(x / TS)];
    return t === TILE.GROUND || t === TILE.BLOCK;
  }

  // ── Dibujo ────────────────────────────────────────────
  function _img(key) {
    if (typeof AssetLoader === 'undefined') return null;
    const i = AssetLoader.get(key);
    return (i && i.complete && i.naturalWidth > 0) ? i : null;
  }

  //  Detrás del jugador: el paisaje y los rayos.
  function drawFondo(ctx, camX, camY) {
    if (!activo) return;
    const { W: vw, H: vh } = Renderer.getSize();

    // Rayos de sol — el fondo los tiene y la capa jugable no tenía ninguno
    ctx.save();
    for (const ry of rayos) {
      const sx = ry.x - camX * 0.85;
      if (sx < -260 || sx > vw + 260) continue;
      const vaiven = Math.sin(reloj * 0.35 + ry.fase) * 10;
      const g = ctx.createLinearGradient(sx, 0, sx + ry.inclina * vh, vh);
      g.addColorStop(0,   `rgba(255,240,190,${ry.alpha})`);
      g.addColorStop(0.7, `rgba(255,225,160,${ry.alpha * 0.4})`);
      g.addColorStop(1,   'rgba(255,225,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx + vaiven, 0);
      ctx.lineTo(sx + vaiven + ry.ancho, 0);
      ctx.lineTo(sx + vaiven + ry.ancho + ry.inclina * vh, vh);
      ctx.lineTo(sx + vaiven + ry.inclina * vh, vh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Paisaje del suelo
    for (const p of props) {
      const sx = p.cx - camX;
      if (sx < -400 || sx > vw + 400) continue;
      const img = _img(p.key);
      const ar  = img ? img.naturalWidth / img.naturalHeight : 0.7;
      const dh  = p.alto, dw = dh * ar;
      const sy  = p.base - camY;

      ctx.save();
      if (p.mece) {
        ctx.translate(sx, sy);
        ctx.rotate(Math.sin(reloj * 0.9 + p.fase) * 0.05);
        ctx.translate(-sx, -sy);
      }
      if (img) ctx.drawImage(img, sx - dw / 2, sy - dh, dw, dh);
      else if (p.key === 'arbol_manos') _arbolCanvas(ctx, sx, sy, dh);
      else     _plantaCanvas(ctx, sx, sy, dw, dh, p);
      ctx.restore();
    }

    // Flores
    for (const f of flores) {
      const sx = f.cx - camX;
      if (sx < -160 || sx > vw + 160) continue;
      const img = _img(f.abierta ? 'flor1' : 'flor0');
      if (img) {
        const ar = img.naturalWidth / img.naturalHeight;
        const dh = f.h, dw = dh * ar;
        ctx.drawImage(img, sx - dw / 2, f.base - camY - dh, dw, dh);
      } else {
        _florCanvas(ctx, sx, f.base - camY, f);
      }
    }
  }

  //  Delante del jugador: los hongos (para que se vea que estás encima), las
  //  luciérnagas y la niebla que se arrastra por el piso.
  function draw(ctx, camX, camY) {
    if (!activo) return;
    const { W: vw } = Renderer.getSize();

    for (const h of hongos) {
      const sx = h.x - camX;
      if (sx < -180 || sx > vw + 180) continue;
      const img = _img(h.aplaste > 0.35 ? 'hongo_salto1' : 'hongo_salto0');
      const alto = h.h * (1 - h.aplaste * 0.45);
      if (img) {
        const ar = img.naturalWidth / img.naturalHeight;
        const dh = alto * 1.35, dw = dh * ar;
        ctx.drawImage(img, sx + h.w / 2 - dw / 2, h.base - camY - dh, dw, dh);
      } else {
        _hongoCanvas(ctx, sx, h.base - camY, h.w, alto, h.aplaste);
      }
    }

    // Luciérnagas
    ctx.save();
    for (const l of luces) {
      if (l.oculta) continue;
      const sx = l.x - camX, sy = l.y - camY;
      if (sx < -30 || sx > vw + 30) continue;
      const pulso = 0.45 + Math.sin(reloj * 3.4 + l.fase) * 0.55;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, l.r * 5);
      g.addColorStop(0,   `rgba(190,255,210,${0.85 * pulso})`);
      g.addColorStop(0.4, `rgba(134,239,172,${0.35 * pulso})`);
      g.addColorStop(1,   'rgba(134,239,172,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, l.r * 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Niebla baja
    ctx.save();
    for (const n of niebla) {
      if (n.oculta) continue;
      const sx = n.x - camX * 0.92;
      if (sx < -n.w - 40 || sx > vw + 40) continue;
      const g = ctx.createLinearGradient(sx, 0, sx + n.w, 0);
      g.addColorStop(0,   'rgba(216,180,254,0)');
      g.addColorStop(0.5, `rgba(216,180,254,${n.alpha})`);
      g.addColorStop(1,   'rgba(216,180,254,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(sx + n.w / 2, n.y - camY, n.w / 2, n.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Formas de canvas, para poder jugar antes de que existan los sprites ──
  function _hongoCanvas(ctx, sx, sy, w, h, aplaste) {
    const cw = w * (1 + aplaste * 0.25);
    ctx.save();
    // Tallo
    ctx.fillStyle = '#f5f3ff';
    ctx.fillRect(sx + w / 2 - w * 0.13, sy - h * 0.45, w * 0.26, h * 0.45);
    // Sombrero
    const g = ctx.createLinearGradient(0, sy - h, 0, sy - h * 0.35);
    g.addColorStop(0, '#f0abfc'); g.addColorStop(1, '#c026d3');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(sx + w / 2, sy - h * 0.45, cw / 2, h * 0.55, 0, Math.PI, 0);
    ctx.fill();
    // Lunares que brillan
    ctx.fillStyle = 'rgba(103,232,249,0.95)';
    for (const [ox, oy, r] of [[-0.22,-0.62,0.09],[0.08,-0.75,0.07],[0.26,-0.55,0.06]]) {
      ctx.beginPath(); ctx.arc(sx + w/2 + cw*ox, sy + h*oy, w*r, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function _florCanvas(ctx, sx, sy, f) {
    const h = f.h, w = f.w;
    ctx.save();
    ctx.strokeStyle = '#4d7c0f'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - h * 0.45); ctx.stroke();
    if (f.abierta) {
      ctx.fillStyle = '#a855f7';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(sx + Math.cos(a) * w * 0.28, sy - h * 0.62 + Math.sin(a) * h * 0.13,
                    w * 0.22, h * 0.11, a, 0, Math.PI * 2);
        ctx.fill();
      }
      const g = ctx.createRadialGradient(sx, sy - h*0.62, 1, sx, sy - h*0.62, w*0.25);
      g.addColorStop(0, 'rgba(165,243,252,0.95)'); g.addColorStop(1, 'rgba(103,232,249,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy - h*0.62, w*0.25, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle = '#6b21a8';
      ctx.beginPath();
      ctx.ellipse(sx, sy - h * 0.62, w * 0.17, h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // El árbol de las manos. Es el gancho del nivel, así que tiene que leerse
  // aunque el sprite todavía no exista: tronco, musgo y las huellas.
  function _arbolCanvas(ctx, sx, sy, dh) {
    const w = dh * 0.34;
    ctx.save();
    // Tronco
    const g = ctx.createLinearGradient(sx - w / 2, 0, sx + w / 2, 0);
    g.addColorStop(0,    '#2e1c0e');
    g.addColorStop(0.45, '#5a3a1e');
    g.addColorStop(1,    '#26160a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy);
    ctx.quadraticCurveTo(sx - w * 0.34, sy - dh * 0.55, sx - w * 0.30, sy - dh);
    ctx.lineTo(sx + w * 0.30, sy - dh);
    ctx.quadraticCurveTo(sx + w * 0.34, sy - dh * 0.55, sx + w / 2, sy);
    ctx.closePath();
    ctx.fill();
    // Vetas
    ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const vx = sx - w * 0.3 + i * w * 0.2;
      ctx.beginPath();
      ctx.moveTo(vx, sy - 6);
      ctx.quadraticCurveTo(vx + 6, sy - dh * 0.5, vx + 2, sy - dh * 0.95);
      ctx.stroke();
    }
    // Musgo en la base
    ctx.fillStyle = 'rgba(78,143,58,0.75)';
    ctx.beginPath();
    ctx.ellipse(sx, sy - dh * 0.03, w * 0.52, dh * 0.05, 0, Math.PI, 0);
    ctx.fill();

    // LAS HUELLAS DE MANOS. Son el motivo por el que el árbol existe.
    const manos = [[-0.20,0.22],[0.14,0.34],[-0.08,0.47],[0.22,0.58],[-0.24,0.66]];
    manos.forEach(([ox, oy], i) => {
      const hx = sx + ox * w * 1.5, hy = sy - dh * oy;
      const s  = dh * 0.038;
      ctx.save();
      ctx.globalAlpha = i % 2 ? 0.30 : 0.52;   // algunas ya tapadas por el musgo
      ctx.fillStyle = i % 2 ? '#6b8f4e' : '#c9b48d';
      // Palma
      ctx.beginPath(); ctx.ellipse(hx, hy, s * 0.75, s * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      // Dedos
      for (let d = -2; d <= 2; d++) {
        ctx.beginPath();
        ctx.ellipse(hx + d * s * 0.42, hy - s * 1.05 - Math.abs(d) * s * -0.12,
                    s * 0.16, s * 0.52, d * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Hongos celestes en la base
    for (const ox of [-0.62, 0.55]) {
      const hx = sx + ox * w;
      const gh = ctx.createRadialGradient(hx, sy - 12, 1, hx, sy - 12, 22);
      gh.addColorStop(0, 'rgba(103,232,249,0.85)');
      gh.addColorStop(1, 'rgba(103,232,249,0)');
      ctx.fillStyle = gh;
      ctx.beginPath(); ctx.ellipse(hx, sy - 12, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function _plantaCanvas(ctx, sx, sy, dw, dh, p) {
    ctx.save();
    if (p.brilla) {
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(sx - dw * 0.06, sy - dh * 0.5, dw * 0.12, dh * 0.5);
      const g = ctx.createRadialGradient(sx, sy - dh*0.6, 1, sx, sy - dh*0.6, dw*0.5);
      g.addColorStop(0, 'rgba(103,232,249,0.9)'); g.addColorStop(1, 'rgba(103,232,249,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(sx, sy - dh*0.6, dw*0.45, dh*0.28, 0, Math.PI, 0); ctx.fill();
    } else {
      ctx.strokeStyle = '#2f6b2f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + i * dw * 0.16, sy - dh * 0.55,
                             sx + i * dw * 0.30, sy - dh * 0.9);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function estado() {
    return { activo, hongos: hongos.length, flores: flores.length,
             props: props.length, luces: luces.length, rayos: rayos.length };
  }

  return { init, spawnFromMap, update, drawFondo, draw, estado };

})();
