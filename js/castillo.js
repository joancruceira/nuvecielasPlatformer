// ═══════════════════════════════════════════════════════
//  CASTILLO.JS — Todo lo que hace que el Castillo sea un castillo
//
//  Tercer hermano de lago.js y bosque.js.
//
//  EL PROBLEMA ACÁ NO ERA EL DEL BOSQUE. El nivel 2 SÍ tenía tiles dibujados
//  —piso, pinchos— y aun así la capa jugable parecía pegada de otro juego. El
//  problema era de PALETA: el fondo es una ruina gótica en llamas, carbón y
//  carmesí, y la piedra que se pisa era lila azulada. Por eso además de sumar
//  cosas, este sistema TIÑE la piedra que ya existe hacia carbón y brasa.
//
//  LA MECÁNICA PROPIA es el piso que se derrumba, y le da al nivel un verbo que
//  ninguno de los otros tiene:
//
//       el lago     dice  →  explorá, subí, mirá
//       el bosque   dice  →  rebotá, llegá más alto
//       el castillo dice  →  NO TE PARES
//
//  La baldosa se agrieta y RECIÉN medio segundo después se cae. Nunca sin
//  avisar: es el segundo nivel del juego.
// ═══════════════════════════════════════════════════════

const Castillo = (() => {

  const TS = 48;

  let activo    = false;
  let fragiles  = [];   // baldosas que se derrumban
  let antorchas = [];
  let arañas    = [];   // candelabros colgantes
  let rejillas  = [];   // llamaradas del piso
  let props     = [];   // escombros
  let retratos  = [];   // el gancho
  let ceniza    = [];   // pavesas subiendo, puro clima
  let reloj     = 0;

  const AVISO   = 0.55;  // cuánto tarda en caerse desde que la pisás
  const VUELVE  = 3.2;   // cuánto tarda en rearmarse

  function init() {
    activo = false;
    fragiles = []; antorchas = []; arañas = []; rejillas = [];
    props = []; retratos = []; ceniza = []; reloj = 0;
  }

  // ── Nacimiento desde el mapa ──────────────────────────
  function spawnFromMap(map, levelData) {
    init();
    activo = true;
    const filas = map.length, cols = map[0].length;

    for (let r = 0; r < filas; r++) {
      for (let c = 0; c < cols; c++) {
        const t = map[r][c];

        if (t === TILE.PISO_FRAGIL) {
          // OJO: ésta NO se borra del mapa. Tiene que seguir siendo sólida para
          // que el jugador se pare encima; la borramos nosotros cuando cede y la
          // devolvemos al rearmarse.
          fragiles.push({ col: c, fila: r, x: c * TS, y: r * TS,
                          estado: 'entera', t: 0, caida: 0 });
          map[r][c] = TILE.PLATFORM;

        } else if (t === TILE.ANTORCHA) {
          // Las cinco antorchas que llegaron son MODELOS distintos —una con
          // estandarte, otra con cadenas, otra con musgo—, no cuadros de una
          // animación. Se elige una por columna y no se cicla: ciclarlas haría
          // que el soporte mutara. El parpadeo lo pone la luz, no el dibujo.
          antorchas.push({ x: c * TS + TS / 2, y: r * TS + TS / 2,
                           fase: c * 0.9, modelo: (c * 3) % 5 });
          map[r][c] = TILE.AIR;

        } else if (t === TILE.CANDELABRO) {
          arañas.push({ x: c * TS + TS / 2, techo: r * TS, largo: TS * 1.6,
                        fase: c * 0.7, modelo: (c * 7) % 5 });
          map[r][c] = TILE.AIR;

        } else if (t === TILE.REJILLA) {
          rejillas.push({
            x: c * TS, base: (r + 1) * TS, w: TS,
            fase: (c * 1.3) % 3.6,   // no escupen todas juntas
            alto: 0,
          });
          map[r][c] = TILE.AIR;

        } else if (t === TILE.ESCOMBRO) {
          props.push({ key: 'escombro' + ((c * 5 + r) % 18),
                       cx: c * TS + TS / 2, base: (r + 1) * TS, alto: TS * 2.1 });
          map[r][c] = TILE.AIR;

        } else if (t === TILE.RETRATO) {
          retratos.push({ key: 'retrato' + ((c * 5) % 4),
                          cx: c * TS + TS / 2, cy: r * TS + TS / 2, alto: TS * 3.3,
                          fase: c * 0.6 });
          map[r][c] = TILE.AIR;
        }
      }
    }

    for (let i = 0; i < 60; i++) {
      ceniza.push({
        x: Math.random() * cols * TS,
        y: Math.random() * filas * TS,
        vy: -8 - Math.random() * 22,
        r: 1 + Math.random() * 2,
        fase: Math.random() * 6.28,
      });
    }
  }

  // ── Update ────────────────────────────────────────────
  function update(dt, ps, map) {
    if (!activo) return;
    reloj += dt;
    _fragiles(dt, ps, map);
    _rejillas(dt, ps);
    _ceniza(dt, ps);
  }

  function _fragiles(dt, ps, map) {
    for (const f of fragiles) {
      f.t += dt;

      if (f.estado === 'entera') {
        // ¿Está parada encima? Los pies casi tocando el borde de arriba.
        const pies = ps.y + ps.h;
        const encima = ps.x + ps.w > f.x + 4 && ps.x < f.x + TS - 4 &&
                       pies > f.y - 6 && pies < f.y + 16 && ps.vy >= 0;
        if (encima) { f.estado = 'grieta'; f.t = 0;
          if (typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss'); }

      } else if (f.estado === 'grieta') {
        // El aviso. Se agrieta y tiembla, pero todavía te sostiene.
        if (f.t > AVISO) {
          f.estado = 'cayendo'; f.t = 0; f.caida = 0;
          map[f.fila][f.col] = TILE.AIR;      // recién ahora deja de sostener
          if (typeof Renderer !== 'undefined') {
            Renderer.spawnParticles(f.x + TS / 2, f.y + TS / 2, '#a8a29e', 12);
          }
        }

      } else if (f.estado === 'cayendo') {
        f.caida += 900 * dt * dt * 60;        // se desploma acelerando
        if (f.t > VUELVE) {
          f.estado = 'entera'; f.t = 0; f.caida = 0;
          map[f.fila][f.col] = TILE.PLATFORM; // vuelve a su lugar
        }
      }
    }
  }

  function _rejillas(dt, ps) {
    for (const j of rejillas) {
      j.fase = (j.fase + dt) % 3.6;
      // 2,4 s apagada · 0,4 s la rejilla al rojo (el aviso) · 0,8 s de fuego
      const k = j.fase;
      j.avisa = k > 2.4 && k <= 2.8;
      const fuego = k > 2.8;
      const objetivo = fuego ? 1 : 0;
      j.alto += (objetivo - j.alto) * Math.min(1, dt * (fuego ? 14 : 6));

      if (j.alto > 0.45) {
        const altoPx = j.alto * TS * 3.2;
        const toca = ps.x + ps.w > j.x + 6 && ps.x < j.x + j.w - 6 &&
                     ps.y + ps.h > j.base - altoPx && ps.y < j.base;
        if (toca) Player.takeDamage(j.x + j.w / 2);
      }
    }
  }

  // Pavesas: el castillo se está quemando, así que sube ceniza encendida.
  function _ceniza(dt, ps) {
    const cx = ps.x, cy = ps.y;
    for (const p of ceniza) {
      p.y += p.vy * dt;
      p.x += Math.sin(reloj * 1.3 + p.fase) * 12 * dt;
      if (p.y < cy - 500 || Math.abs(p.x - cx) > 900) {
        p.x = cx + (Math.random() - 0.5) * 1500;
        p.y = cy + 380 + Math.random() * 260;
      }
    }
  }

  // ── Dibujo ────────────────────────────────────────────
  function _img(key) {
    if (typeof AssetLoader === 'undefined') return null;
    const i = AssetLoader.get(key);
    return (i && i.complete && i.naturalWidth > 0) ? i : null;
  }

  //  Detrás del jugador: los retratos en la pared y los escombros del piso.
  function drawFondo(ctx, camX, camY) {
    if (!activo) return;
    const { W: vw } = Renderer.getSize();

    for (const q of retratos) {
      const sx = q.cx - camX;
      if (sx < -200 || sx > vw + 200) continue;
      const img = _img(q.key);
      if (img) {
        const ar = img.naturalWidth / img.naturalHeight;
        const dh = q.alto, dw = dh * ar;
        ctx.drawImage(img, sx - dw / 2, q.cy - camY - dh / 2, dw, dh);
      } else {
        _retratoCanvas(ctx, sx, q.cy - camY, q.alto, q.key);
      }
    }

    for (const p of props) {
      const sx = p.cx - camX;
      if (sx < -200 || sx > vw + 200) continue;
      const img = _img(p.key);
      if (img) {
        const ar = img.naturalWidth / img.naturalHeight;
        const dh = p.alto, dw = dh * ar;
        ctx.drawImage(img, sx - dw / 2, p.base - camY - dh, dw, dh);
      } else {
        _escombroCanvas(ctx, sx, p.base - camY, p.alto, p.key);
      }
    }
  }

  //  Delante: el fuego, las baldosas cayéndose y la ceniza.
  function draw(ctx, camX, camY) {
    if (!activo) return;
    const { W: vw } = Renderer.getSize();

    // ── Baldosas frágiles ──
    for (const f of fragiles) {
      const sx = f.x - camX, sy = f.y - camY + f.caida;
      if (sx < -80 || sx > vw + 80) continue;
      if (f.estado === 'cayendo' && f.t > 1.2) continue;   // ya se perdió de vista

      // La hoja trae cinco pasos de deterioro; los que cuentan son entera (0),
      // agrietada en cruz (1) y con el agujero al rojo (3).
      const cuadro = f.estado === 'entera' ? 'piso_fragil0'
                   : f.estado === 'grieta' ? 'piso_fragil1'
                   : 'piso_fragil3';
      const img = _img(cuadro);
      ctx.save();
      // Tiembla mientras avisa: el temblor es la mitad del aviso.
      if (f.estado === 'grieta') {
        ctx.translate(Math.sin(f.t * 60) * 1.6, Math.sin(f.t * 47) * 1.2);
      }
      if (f.estado === 'cayendo') ctx.globalAlpha = Math.max(0, 1 - f.t / 1.2);
      if (img) ctx.drawImage(img, sx, sy, TS, TS);
      else     _fragilCanvas(ctx, sx, sy, TS, f.estado);

      // Entera se parece demasiado al piso normal —las dos son losas de piedra
      // agrietada— y no sirve de nada avisar cuando ya la pisaste. Un latido de
      // brasa la separa del resto ANTES de tocarla, que es cuando importa.
      if (f.estado === 'entera') {
        const latido = 0.35 + Math.sin(reloj * 2.6 + f.col) * 0.30;
        const g = ctx.createRadialGradient(sx + TS/2, sy + TS/2, 2, sx + TS/2, sy + TS/2, TS * 0.62);
        g.addColorStop(0,   `rgba(249,115,22,${0.30 * latido})`);
        g.addColorStop(0.6, `rgba(220,38,38,${0.16 * latido})`);
        g.addColorStop(1,   'rgba(220,38,38,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - 4, sy - 4, TS + 8, TS + 8);
      }
      ctx.restore();
    }

    // ── Llamaradas ──
    for (const j of rejillas) {
      const sx = j.x - camX;
      if (sx < -120 || sx > vw + 120) continue;
      // Los cinco cuadros que llegaron traen la REJA INCLUIDA y alineada a la
      // misma base: apagada, llamita, columna entera, media, y apagada al rojo.
      // Por eso va un solo dibujo y no reja + fuego por separado.
      const idx = j.alto > 0.80 ? 2 : j.alto > 0.45 ? 3 : j.alto > 0.12 ? 1
                : j.avisa ? 4 : 0;
      const img = _img('llamarada' + idx);
      if (img) {
        const ar = img.naturalWidth / img.naturalHeight;
        const dh = TS * 2.6, dw = dh * ar;
        ctx.drawImage(img, sx + TS / 2 - dw / 2, j.base - camY - dh, dw, dh);
        continue;
      }
      ctx.save();
      ctx.fillStyle = j.avisa ? '#f97316' : '#3f3f46';
      ctx.fillRect(sx + 6, j.base - camY - 10, TS - 12, 10);
      ctx.restore();
      if (j.alto <= 0.03) continue;
      _fuegoCanvas(ctx, sx + TS / 2, j.base - camY, TS * 0.7, j.alto * TS * 3.2);
    }

    // ── Antorchas y candelabros: el fuego y su charco de luz ──
    for (const a of antorchas) {
      const sx = a.x - camX, sy = a.y - camY;
      if (sx < -120 || sx > vw + 120) continue;
      const img = _img('antorcha' + a.modelo);
      if (img) {
        const ar = img.naturalWidth / img.naturalHeight;
        const dh = TS * 2.6, dw = dh * ar;
        ctx.drawImage(img, sx - dw / 2, sy - dh / 2, dw, dh);
      } else {
        _antorchaCanvas(ctx, sx, sy, a.fase);
      }
      _luz(ctx, sx, sy + 20, 260, a.fase, 0.55);
    }

    for (const a of arañas) {
      const sx = a.x - camX, sy = a.techo - camY;
      if (sx < -160 || sx > vw + 160) continue;
      const vaiven = Math.sin(reloj * 1.1 + a.fase) * 0.05;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(vaiven);
      const img = _img('candelabro' + a.modelo);
      if (img) {
        // El sprite YA trae la cadena arriba, así que se cuelga desde el techo
        // hacia abajo y no hace falta dibujar ninguna.
        const ar = img.naturalWidth / img.naturalHeight;
        const dh = TS * 3.0, dw = dh * ar;
        ctx.drawImage(img, -dw / 2, 0, dw, dh);
      } else {
        ctx.strokeStyle = 'rgba(120,113,108,0.85)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, a.largo); ctx.stroke();
        _candelabroCanvas(ctx, 0, a.largo, TS * 1.5);
      }
      ctx.restore();
      _luz(ctx, sx + Math.sin(reloj * 1.1 + a.fase) * a.largo * 0.05,
           sy + a.largo + 30, 300, a.fase, 0.42);
    }

    // ── Ceniza encendida ──
    ctx.save();
    for (const p of ceniza) {
      const sx = p.x - camX, sy = p.y - camY;
      if (sx < -20 || sx > vw + 20) continue;
      const pulso = 0.35 + Math.sin(reloj * 4 + p.fase) * 0.45;
      ctx.fillStyle = `rgba(251,146,60,${0.55 * pulso})`;
      ctx.beginPath(); ctx.arc(sx, sy, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Charco de luz parpadeante. Es lo que une la capa jugable con un fondo que
  // está hecho enteramente de fuego.
  function _luz(ctx, x, y, radio, fase, fuerza) {
    const parpadeo = 0.82 + Math.sin(reloj * 9 + fase * 5) * 0.10
                          + Math.sin(reloj * 23 + fase) * 0.06;
    const r = radio * parpadeo;
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0,    `rgba(255,190,110,${fuerza * parpadeo})`);
    g.addColorStop(0.45, `rgba(249,115,22,${fuerza * 0.35 * parpadeo})`);
    g.addColorStop(1,    'rgba(249,115,22,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── Formas de canvas, para jugar antes de que existan los sprites ──
  function _fragilCanvas(ctx, x, y, T, estado) {
    ctx.save();
    ctx.fillStyle = estado === 'entera' ? '#4b4640' : '#5a4038';
    ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
    if (estado !== 'entera') {
      ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 6);       ctx.lineTo(x + T - 8, y + T - 6);
      ctx.moveTo(x + T - 6, y + 8);   ctx.lineTo(x + 10, y + T - 8);
      if (estado === 'cayendo') { ctx.moveTo(x, y + T/2); ctx.lineTo(x + T, y + T/2); }
      ctx.stroke();
    }
    ctx.restore();
  }

  function _fuegoCanvas(ctx, cx, base, w, alto) {
    ctx.save();
    const g = ctx.createLinearGradient(0, base, 0, base - alto);
    g.addColorStop(0,   'rgba(254,240,138,0.95)');
    g.addColorStop(0.4, 'rgba(249,115,22,0.85)');
    g.addColorStop(1,   'rgba(220,38,38,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, base);
    ctx.quadraticCurveTo(cx - w * 0.55 + Math.sin(reloj * 12) * 5, base - alto * 0.55,
                         cx + Math.sin(reloj * 9) * 6, base - alto);
    ctx.quadraticCurveTo(cx + w * 0.55 + Math.sin(reloj * 11) * 5, base - alto * 0.55,
                         cx + w / 2, base);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function _antorchaCanvas(ctx, x, y, fase) {
    ctx.save();
    // Soporte de hierro empotrado en la piedra
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(x - 5, y - 2, 10, 34);
    ctx.fillRect(x - 14, y + 26, 28, 7);
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(x - 9, y - 8, 18, 8);
    _fuegoCanvas(ctx, x, y - 6, 30, 54 + Math.sin(reloj * 7 + fase) * 8);
    ctx.restore();
  }

  function _candelabroCanvas(ctx, x, y, w) {
    ctx.save();
    ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(x, y, w / 2, w * 0.14, 0, 0, Math.PI * 2); ctx.stroke();
    for (const ox of [-0.42, -0.14, 0.14, 0.42]) {
      const vx = x + ox * w;
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(vx - 3, y - 14, 6, 14);
      _fuegoCanvas(ctx, vx, y - 14, 9, 16 + Math.sin(reloj * 8 + ox * 9) * 3);
    }
    ctx.restore();
  }

  function _escombroCanvas(ctx, x, base, alto, key) {
    const n = parseInt(key.slice(-1), 10) || 0;
    ctx.save();
    ctx.fillStyle = '#3f3a35';
    if (n === 1) {            // columna caída
      ctx.beginPath(); ctx.roundRect(x - alto * 0.55, base - alto * 0.33, alto * 1.1, alto * 0.33, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(x + i * alto * 0.26, base - alto * 0.33);
        ctx.lineTo(x + i * alto * 0.26, base); ctx.stroke();
      }
    } else {                  // montón de piedras
      for (let i = 0; i < 6; i++) {
        const px = x + ((i * 37) % 100 - 50) / 100 * alto * 0.7;
        const py = base - ((i * 53) % 100) / 100 * alto * 0.42;
        ctx.beginPath();
        ctx.ellipse(px, py, alto * (0.10 + (i % 3) * 0.035), alto * 0.075, i * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Los retratos. Es el gancho del nivel: aunque falte el sprite, tiene que
  // leerse que en la pared hay alguien colgado y que ese alguien es una mano.
  function _retratoCanvas(ctx, x, y, alto, key) {
    const n = parseInt(key.slice(-1), 10) || 0;
    const w = alto * 0.75;
    ctx.save();
    ctx.translate(x, y);
    if (n === 1) ctx.rotate(0.13);                 // torcido
    // Marco
    ctx.fillStyle = n === 2 ? '#1c1917' : '#8a6a2a';
    ctx.fillRect(-w / 2, -alto / 2, w, alto);
    ctx.fillStyle = '#2a2520';
    ctx.fillRect(-w / 2 + 6, -alto / 2 + 6, w - 12, alto - 12);
    // La Nuveciela: una mano con cara, parada sobre los dedos
    const cols = ['#f9a8d4', '#a5f3fc', '#fde68a', '#c4b5fd'];
    ctx.fillStyle = cols[n % 4];
    ctx.globalAlpha = n === 2 ? 0.35 : n === 3 ? 0.6 : 1;
    const pw = w * 0.42, ph = alto * 0.30;
    ctx.beginPath(); ctx.ellipse(0, -alto * 0.04, pw / 2, ph / 2, 0, 0, Math.PI * 2); ctx.fill();
    for (let d = -2; d <= 2; d++) {                // los dedos, que son las piernas
      ctx.beginPath();
      ctx.ellipse(d * pw * 0.19, alto * 0.16, pw * 0.075, ph * 0.42, d * 0.10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1c1917';
    ctx.beginPath(); ctx.arc(-pw * 0.14, -alto * 0.07, w * 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( pw * 0.14, -alto * 0.07, w * 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Quemado / rasgado
    if (n === 2) {
      ctx.fillStyle = 'rgba(12,10,9,0.88)';
      ctx.fillRect(-w / 2 + 6, alto * 0.02, w - 12, alto / 2 - 8);
    } else if (n === 3) {
      ctx.strokeStyle = '#0c0a09'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-w * 0.34, -alto * 0.42); ctx.lineTo(w * 0.28, alto * 0.40); ctx.stroke();
    }
    ctx.restore();
  }

  function estado() {
    return { activo, fragiles: fragiles.length, antorchas: antorchas.length,
             candelabros: arañas.length, rejillas: rejillas.length,
             escombros: props.length, retratos: retratos.length };
  }

  return { init, spawnFromMap, update, drawFondo, draw, estado };

})();
