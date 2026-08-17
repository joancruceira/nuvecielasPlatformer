// ═══════════════════════════════════════════════════════
//  LAGO.JS — Todo lo que hace que el lago sea un lago
//
//  Un solo sistema para el nivel 5, al estilo de cueva.js y magicdoor.js:
//  burbujas, géiseres, corrientes, almejas y la decoración del fondo.
//
//  La regla de oro del nivel: EL AGUA TE MUEVE A VOS. En los otros cuatro
//  niveles el jugador es lo único que empuja al jugador; acá lo empujan el
//  géiser, la burbuja y la corriente. Ese es el verbo nuevo del nivel.
//
//  Cómo empuja, sin tocar player.js: este sistema corre DESPUÉS de
//  Player.update() y sólo toca la VELOCIDAD, nunca la posición. Así el
//  empuje lo integra el jugador en el frame siguiente con su propia
//  colisión, y es imposible meterlo dentro de una pared.
//
//  Y siempre con Math.min sobre vy: el agua te SOSTIENE, no te secuestra.
//  Podés nadar más rápido que el géiser, pero nunca te hunde mientras estás
//  adentro. Un chico que quiere subir sube; uno que se queda, también.
//
//  NO hay barra de oxígeno, a propósito: en el nivel donde queremos que
//  exploren, las burbujas son un regalo y no una cuenta regresiva.
// ═══════════════════════════════════════════════════════

const Lago = (() => {

  const TS = 48;

  // ── Estado ────────────────────────────────────────────
  let activo     = false;
  let ambiente   = [];   // burbujitas de fondo, puro clima
  let geiseres   = [];   // columnas que elevan
  let montables  = [];   // burbujas grandes: ascensor frágil
  let emisores   = [];   // de dónde salen las montables
  let almejas    = [];   // se abren, se cierran y muerden
  let props      = [];   // coral, algas, ruinas, la estatua
  let corrientes = [];   // franjas que empujan
  let reloj      = 0;

  // Fuerzas. Positivo = px/s hacia abajo, negativo = hacia arriba.
  const GEISER_FUERZA   = -430;  // ascensor: más rápido que la brazada (-300)
  const MONTABLE_SUBIDA = -70;   // paseo lento, se disfruta
  const MONTABLE_VIDA   = 14;    // segundos antes de reventar sola

  function init() {
    activo = false;
    ambiente = []; geiseres = []; montables = []; emisores = [];
    almejas = []; props = []; corrientes = []; reloj = 0;
  }

  // ── Nacimiento desde el mapa ──────────────────────────
  //
  //  Los props se anclan por la BASE al piso del tile donde los pusiste:
  //  poner una estatua en la fila 12 la deja parada sobre el suelo de la 13,
  //  sin importar cuánto mida el sprite.

  function spawnFromMap(map, levelData) {
    init();
    activo = true;

    const filas = map.length, cols = map[0].length;

    // Cuánto mide cada prop en pantalla, en tiles de alto. El ancho sale de
    // la proporción real del sprite para que nada quede estirado.
    const medidas = {
      [TILE.CORAL]:   { keys: ['coral0','coral01','coral02','coral03'], alto: 2.0 },
      [TILE.ALGA]:    { keys: ['alga0','alga01','alga02'],              alto: 2.2 },
      [TILE.RUINA]:   { keys: ['ruina0','ruina01'],                     alto: 3.0 },
      [TILE.ESTATUA]: { keys: ['estatua0'],                             alto: 4.5 },
    };

    for (let r = 0; r < filas; r++) {
      for (let c = 0; c < cols; c++) {
        const t = map[r][c];

        if (medidas[t]) {
          const m = medidas[t];
          props.push({
            key:  m.keys[(c + r) % m.keys.length],   // variedad sin azar: siempre igual
            cx:   c * TS + TS / 2,
            base: (r + 1) * TS,                      // los pies, no la cabeza
            alto: m.alto * TS,
            mece: t === TILE.ALGA,                   // sólo las algas se mecen
            fase: (c * 0.7 + r * 1.3) % (Math.PI * 2),
          });
          map[r][c] = TILE.AIR;

        } else if (t === TILE.GEISER) {
          // La columna llega hasta el primer sólido de arriba (o 9 tiles).
          let alto = 0;
          for (let rr = r - 1; rr >= 0 && alto < 9; rr--) {
            const tt = map[rr][c];
            if (tt === TILE.GROUND || tt === TILE.BLOCK) break;
            alto++;
          }
          geiseres.push({
            x: c * TS, w: TS,
            yBase: (r + 1) * TS,
            yTope: (r + 1) * TS - alto * TS,
            burbujas: [],
            acum: 0,
          });
          map[r][c] = TILE.AIR;

        } else if (t === TILE.BURBUJA) {
          emisores.push({ x: c * TS + TS / 2, y: r * TS + TS / 2, espera: 1.0 });
          map[r][c] = TILE.AIR;

        } else if (t === TILE.ALMEJA) {
          almejas.push({
            x: c * TS - TS / 2,          // 2 tiles de ancho, centrada en la suya
            base: (r + 1) * TS,
            w: TS * 2, h: TS * 1.42,
            fase: (c * 0.9) % 3.4,       // no muerden todas a la vez
            cerrada: false,
            enfriamiento: 0,
          });
          map[r][c] = TILE.AIR;
        }
      }
    }

    // Corrientes: se declaran en el nivel en TILES y acá pasan a píxeles.
    for (const co of (levelData && levelData.corrientes) || []) {
      corrientes.push({
        x: co.x * TS, y: co.y * TS,
        w: co.w * TS, h: co.h * TS,
        vx: co.vx || 0,
        motas: _motasDeCorriente(co),
      });
    }
  }

  function _motasDeCorriente(co) {
    // La corriente se lee SÓLO por sus motas arrastrándose, así que tienen que
    // ser muchas: con pocas parecen rayitas sueltas en vez de agua moviéndose.
    const n = Math.min(90, Math.round(co.w * co.h * 0.8));
    const motas = [];
    for (let i = 0; i < n; i++) {
      motas.push({
        x: co.x * TS + Math.random() * co.w * TS,
        y: co.y * TS + Math.random() * co.h * TS,
        v: 0.6 + Math.random() * 0.8,
      });
    }
    return motas;
  }

  // ── Update ────────────────────────────────────────────
  function update(dt, ps, map) {
    if (!activo) return;
    reloj += dt;

    _ambiente(dt, ps, map);
    _geiseres(dt, ps);
    _montables(dt, ps, map);
    _corrientes(dt, ps);
    _almejas(dt, ps);
  }

  // Burbujitas de clima: no hacen nada y son el 80 % de la sensación de
  // estar bajo el agua. Viven cerca del jugador y se reciclan solas.
  function _ambiente(dt, ps, map) {
    const cx = ps.x, cy = ps.y;
    while (ambiente.length < 70) {
      ambiente.push({
        x: cx + (Math.random() - 0.5) * 1400,
        y: cy + 300 + Math.random() * 500,
        r: 1.5 + Math.random() * 4,
        vy: -18 - Math.random() * 34,
        fase: Math.random() * 6.28,
      });
    }
    for (const b of ambiente) {
      b.y += b.vy * dt;
      b.x += Math.sin(reloj * 1.6 + b.fase) * 9 * dt;

      // No hay burbujas dentro de la roca: nacen donde caen, así que sin este
      // chequeo aparecían flotando adentro del fondo del lago.
      const t = map && map[Math.floor(b.y / TS)] && map[Math.floor(b.y / TS)][Math.floor(b.x / TS)];
      b.oculta = (t === TILE.GROUND || t === TILE.BLOCK);

      // Se recicla cuando sube demasiado o el jugador la dejó muy atrás
      if (b.y < cy - 500 || Math.abs(b.x - cx) > 900) {
        b.x  = cx + (Math.random() - 0.5) * 1400;
        b.y  = cy + 350 + Math.random() * 300;
        b.r  = 1.5 + Math.random() * 4;
        b.vy = -18 - Math.random() * 34;
      }
    }
  }

  function _geiseres(dt, ps) {
    for (const g of geiseres) {
      // Chorro de burbujas hacia arriba
      g.acum += dt;
      while (g.acum > 0.045) {
        g.acum -= 0.045;
        g.burbujas.push({
          x: g.x + 6 + Math.random() * (g.w - 12),
          y: g.yBase - 4,
          r: 3 + Math.random() * 6,
          fase: Math.random() * 6.28,
        });
      }
      for (let i = g.burbujas.length - 1; i >= 0; i--) {
        const b = g.burbujas[i];
        b.y -= 320 * dt;
        if (b.y < g.yTope) g.burbujas.splice(i, 1);
      }

      if (_tocaCaja(ps, g.x, g.yTope, g.w, g.yBase - g.yTope)) {
        ps.vy = Math.min(ps.vy, GEISER_FUERZA);
        ps.grounded = false;
      }
    }
  }

  function _montables(dt, ps, map) {
    for (const e of emisores) {
      e.espera -= dt;
      if (e.espera <= 0) {
        e.espera = 4.5;
        montables.push({ x: e.x, y: e.y, r: 34, vida: MONTABLE_VIDA, fase: Math.random() * 6.28 });
      }
    }

    for (let i = montables.length - 1; i >= 0; i--) {
      const b = montables[i];
      b.y += MONTABLE_SUBIDA * dt;
      b.x += Math.sin(reloj * 1.1 + b.fase) * 14 * dt;
      b.vida -= dt;

      // Revienta contra el techo, contra un coral punzante o de vieja.
      // Y también al salirse por arriba: donde el nivel no tiene techo, sin
      // esto la burbuja seguía subiendo fuera del mapa hasta cumplir su vida.
      const rr = Math.floor((b.y - b.r) / TS), cc = Math.floor(b.x / TS);
      const t  = map[rr] && map[rr][cc];
      const choca = rr < 0 || t === TILE.GROUND || t === TILE.BLOCK || t === TILE.SPIKES;
      if (choca || b.vida <= 0) {
        _reventar(b);
        montables.splice(i, 1);
        continue;
      }

      // Te lleva: te sostiene mientras estés adentro, y podés nadar más
      // rápido si querés. Nunca te arrastra hacia abajo.
      if (_tocaCaja(ps, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2)) {
        ps.vy = Math.min(ps.vy, MONTABLE_SUBIDA);
        ps.grounded = false;
      }
    }
  }

  function _reventar(b) {
    if (typeof Renderer !== 'undefined') {
      Renderer.spawnParticles(b.x, b.y, '#bae6fd', 10);
    }
  }

  function _corrientes(dt, ps) {
    for (const co of corrientes) {
      for (const m of co.motas) {
        m.x += co.vx * m.v * dt;
        if (co.vx > 0 && m.x > co.x + co.w) m.x = co.x;
        if (co.vx < 0 && m.x < co.x)        m.x = co.x + co.w;
      }
      if (!_tocaCaja(ps, co.x, co.y, co.w, co.h)) continue;

      // Empuje suave y con techo: es una corriente, no una catapulta. El
      // tope deja que el jugador siga siendo el que manda si rema en contra.
      const tope = Math.abs(co.vx) * 1.5;
      ps.vx += co.vx * 2.4 * dt;
      if (ps.vx >  tope) ps.vx =  tope;
      if (ps.vx < -tope) ps.vx = -tope;
    }
  }

  function _almejas(dt, ps) {
    for (const a of almejas) {
      a.fase = (a.fase + dt) % 3.4;
      a.cerrada = a.fase > 2.0;          // 2 s abierta, 1,4 s cerrada
      if (a.enfriamiento > 0) a.enfriamiento -= dt;

      if (!a.cerrada || a.enfriamiento > 0) continue;
      // La boca es la mitad de arriba: pasar por al lado no muerde.
      if (_tocaCaja(ps, a.x + 8, a.base - a.h, a.w - 16, a.h * 0.6)) {
        a.enfriamiento = 1.5;
        Player.takeDamage(a.x + a.w / 2);
      }
    }
  }

  function _tocaCaja(ps, x, y, w, h) {
    return ps.x + ps.w > x && ps.x < x + w &&
           ps.y + ps.h > y && ps.y < y + h;
  }

  // ── Dibujo ────────────────────────────────────────────
  //
  //  Dos pasadas a propósito: lo que es paisaje va DETRÁS del jugador
  //  (drawFondo) y lo que te envuelve va DELANTE (draw), para que se vea
  //  que estás dentro de la burbuja y no atrás.

  function _img(key) {
    if (typeof AssetLoader === 'undefined') return null;
    const i = AssetLoader.get(key);
    return (i && i.complete && i.naturalWidth > 0) ? i : null;
  }

  function drawFondo(ctx, camX, camY) {
    if (!activo) return;
    const ancho = ctx.canvas ? ctx.canvas.width : 1920;

    // Corrientes primero: son agua, van abajo de todo
    for (const co of corrientes) {
      const sx = co.x - camX;
      if (sx > ancho + 40 || sx + co.w < -40) continue;
      // Sin rectángulo de fondo: pintar la zona dejaba una caja celeste con
      // bordes rectos flotando en el agua, que se lee como un error de dibujo.
      // El agua en movimiento se cuenta con las motas arrastrándose y nada más.
      ctx.save();
      ctx.strokeStyle = 'rgba(186,230,253,0.45)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const m of co.motas) {
        const mx = m.x - camX, my = m.y - camY;
        ctx.moveTo(mx, my);
        ctx.lineTo(mx - Math.sign(co.vx) * (10 + m.v * 14), my);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Burbujitas de clima
    ctx.save();
    ctx.strokeStyle = 'rgba(224,242,254,0.5)';
    ctx.fillStyle   = 'rgba(186,230,253,0.16)';
    ctx.lineWidth = 1;
    for (const b of ambiente) {
      if (b.oculta) continue;
      const sx = b.x - camX, sy = b.y - camY;
      if (sx < -20 || sx > ancho + 20) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, b.r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    // Paisaje del fondo: coral, algas, ruinas y la estatua
    for (const p of props) {
      const img = _img(p.key);
      const sx  = p.cx - camX;
      if (sx < -200 || sx > ancho + 200) continue;

      const ar = img ? img.naturalWidth / img.naturalHeight : 0.5;
      const dh = p.alto, dw = dh * ar;
      const sy = p.base - camY;

      ctx.save();
      if (p.mece) {
        // Las algas se mecen desde la base, como si las moviera la corriente
        ctx.translate(sx, sy);
        ctx.rotate(Math.sin(reloj * 1.1 + p.fase) * 0.09);
        ctx.translate(-sx, -sy);
      }
      if (img) ctx.drawImage(img, sx - dw / 2, sy - dh, dw, dh);
      else { ctx.fillStyle = 'rgba(13,148,136,0.55)'; ctx.fillRect(sx - dw/2, sy - dh, dw, dh); }
      ctx.restore();
    }

    // Almejas: paisaje que muerde
    for (const a of almejas) {
      const sx = a.x - camX;
      if (sx < -160 || sx > ancho + 160) continue;
      const img = _img(a.cerrada ? 'almeja0' : 'almeja01');
      if (img) ctx.drawImage(img, sx, a.base - camY - a.h, a.w, a.h);
      else {
        ctx.save();
        ctx.fillStyle = a.cerrada ? '#7e22ce' : '#c084fc';
        ctx.beginPath();
        ctx.ellipse(sx + a.w/2, a.base - camY - a.h/2, a.w/2, a.h/2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function draw(ctx, camX, camY) {
    if (!activo) return;
    const ancho = ctx.canvas ? ctx.canvas.width : 1920;

    // Chorros de los géiseres
    ctx.save();
    ctx.fillStyle   = 'rgba(224,242,254,0.42)';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    for (const g of geiseres) {
      if (g.x - camX < -80 || g.x - camX > ancho + 80) continue;
      for (const b of g.burbujas) {
        const sx = b.x - camX + Math.sin(reloj * 5 + b.fase) * 4;
        ctx.beginPath();
        ctx.arc(sx, b.y - camY, b.r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();

    // Burbujas montables: van delante para que se vea que estás ADENTRO
    for (const b of montables) {
      const sx = b.x - camX, sy = b.y - camY;
      if (sx < -80 || sx > ancho + 80) continue;
      // Parpadea cuando le queda poco: aviso antes de reventar
      const porMorir = b.vida < 2.5 && Math.floor(b.vida * 6) % 2 === 0;
      ctx.save();
      ctx.globalAlpha = porMorir ? 0.35 : 0.75;
      const gr = ctx.createRadialGradient(sx - b.r*0.3, sy - b.r*0.3, 2, sx, sy, b.r);
      gr.addColorStop(0,    'rgba(255,255,255,0.55)');
      gr.addColorStop(0.55, 'rgba(186,230,253,0.18)');
      gr.addColorStop(1,    'rgba(125,211,252,0.35)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(sx, sy, b.r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Brillito
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(sx - b.r*0.35, sy - b.r*0.4, b.r*0.13, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // Para pruebas y para el resto del motor
  function estado() {
    return {
      activo, props: props.length, geiseres: geiseres.length,
      emisores: emisores.length, montables: montables.length,
      almejas: almejas.length, corrientes: corrientes.length,
      ambiente: ambiente.length,
    };
  }

  return { init, spawnFromMap, update, drawFondo, draw, estado };

})();
