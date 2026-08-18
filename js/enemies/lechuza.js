// ═══════════════════════════════════════════════════════
//  LECHUZA.JS — La Lechuza Guardiana (jefe del Sendero Nocturno)
//
//  Reemplaza al Ciempiés Gigante, que era un gusano verde en un nivel donde
//  ya hay orugas: se leía como "la misma oruga pero grande".
//
//  La lechuza, en cambio, YA ESTABA EN EL NIVEL. En img/sendero0.png —la
//  primera pantalla— hay tres búhos posados en las ramas mirándote bajo la
//  luna llena, y el juego nunca explica por qué. Al final del sendero, la más
//  grande baja del árbol. Es un remate que el nivel venía sembrando gratis.
//
//  También ordena el bestiario: oruga → murciélago → lechuza. El jefe deja de
//  ser "el enemigo grande" y pasa a ser el de arriba de todo.
//
//  LA REGLA QUE ENSEÑA LA PELEA: es un pájaro, y un pájaro necesita un momento
//  para volver a levantar vuelo. Volando no la alcanzás (está a cinco tiles de
//  altura). Cuando se tira en picada y toca el piso queda plantada, y ése es tu
//  turno. No hace falta ningún cartel: se descubre en la primera picada.
//
//  Sprites: img/level3/lechuza_<anim><n>.png. Todos vienen en el MISMO lienzo
//  de 378x284, con la lechuza normalizada por el tamaño de su cara y apoyada
//  abajo. Eso importa: las alas en vuelo suben por encima de la cabeza, así que
//  escalando cada cuadro a una altura fija el bicho se achicaba al volar. Con
//  el lienzo común, cada pose ocupa dentro lo que le toca y el tamaño no late.
//  Si falta un cuadro, se dibuja por canvas y la pelea es exactamente la misma.
// ═══════════════════════════════════════════════════════

const Lechuza = (() => {

  const W = 96, H = 120;
  const MAX_HP = 12;

  // Alto pero no pegado al borde: el canvas siempre dibuja 15 de las 16 filas
  // del mapa, así que a 320 px del piso queda en la fila 3 y media — fuera de
  // todo alcance y con aire arriba, en vez de metida contra el HUD.
  const ALTURA_VUELO   = 320;   // px sobre el suelo de la arena
  const VEL_VUELO      = 300;   // seguimiento horizontal
  const ENCIMA         = 100;   // qué tan alineada tiene que estar para tirarse
  const VEL_PICADA     = 520;
  const AVISO_DUR      = 0.55;  // el instante de acecho antes de tirarse
  const OSCURIDAD_DUR  = 5.0;   // cuánto dura el apagón

  // Cuánto se queda plantada al aterrizar, por fase. Es la ventana para pegarle
  // y por eso es lo único que se achica: la pelea se endurece acortando tu turno.
  const PISO_POR_FASE  = [1.40, 1.10, 0.90];
  const PICADAS_POR_FASE = [1, 2, 3];

  //  Los cuadros que efectivamente llegaron. 'aterrizado' tiene los suyos —la
  //  lechuza encogida, recuperándose— en vez de reusar los de la rama: es la
  //  ventana en la que le pegás, así que tiene que verse distinta de un vistazo.
  const ANIMS = {
    posado: 2, vuelo: 4, picada: 3, aterrizado: 2, grito: 2, damage: 2, death: 3,
  };

  // ── Sprites ───────────────────────────────────────────
  const imgs = {};
  function _img(k) { const i = imgs[k]; return (i && i.complete && i.naturalWidth > 0) ? i : null; }

  function preload() {
    for (const [anim, n] of Object.entries(ANIMS)) {
      for (let i = 0; i < n; i++) {
        const m = new Image();
        // Convención de nombres de level3: fly0 / fly01 / fly02
        m.src = `img/level3/lechuza_${anim}${i === 0 ? '0' : '0' + i}.png`;
        imgs[`${anim}${i}`] = m;
      }
    }
  }

  // ── Spawn ─────────────────────────────────────────────
  //
  //  La arena (columnas 168-199) es suelo continuo y plano, así que el piso es
  //  un solo número. El coordinador lo busca en el mapa y lo pasa acá, y con
  //  eso el update no necesita el mapa — que es bueno, porque el coordinador
  //  del nivel 3 no se lo pasa a ningún enemigo.
  function spawn(x, y, arenaLeft, arenaRight, sueloY) {
    return {
      type: 'lechuza',
      x, y, w: W, h: H,
      vx: 0, vy: 0,
      facing: -1,
      hp: MAX_HP, maxHp: MAX_HP,
      alive: true,
      activated: false,
      state: 'posado',
      frameIdx: 0, frameTick: 0, stateTimer: 0,
      arenaLeft, arenaRight,
      perchaX: x, perchaY: y,
      sueloY: sueloY || (y + H),   // dónde apoya las garras
      phase: 1,
      picadasHechas: 0,
      ciclos: 0,
      objetivoX: x,
      gritoPendiente: false,
      oscuridad: 0,           // segundos que le quedan al apagón
      onGround: true,
    };
  }

  // ── Update ────────────────────────────────────────────
  function update(e, dt, ps) {
    if (e.oscuridad > 0) e.oscuridad = Math.max(0, e.oscuridad - dt);

    if (!e.alive && e.state !== 'death') return;
    if (e.state === 'death') {
      e.stateTimer += dt;
      _anim(e, dt, ANIMS.death, 0.22);
      if (e.stateTimer > 1.0) e.alive = false;
      return;
    }

    const pcx = ps.x + ps.w / 2;
    const cx  = e.x + e.w / 2;

    if (!e.activated) {
      if (Math.abs(pcx - cx) < 900) { e.activated = true; e.state = 'posado'; e.stateTimer = 0; }
      return;
    }

    e.stateTimer += dt;

    const ratio = e.hp / e.maxHp;
    const faseAnterior = e.phase;
    e.phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    // Al entrar en fase 2 grita por primera vez. En la 3 vuelve cada dos ciclos.
    if (e.phase > faseAnterior && e.phase >= 2) e.gritoPendiente = true;

    const alturaVuelo = e.sueloY - H - ALTURA_VUELO;

    switch (e.state) {

      case 'posado':
        // Sube a la altura de la rama —si se quedara en el piso donde aterrizó,
        // la ventana para pegarle sería 'aterrizado' MÁS este estado, casi tres
        // segundos seguidos— pero en HORIZONTAL se acerca a vos en vez de volver
        // siempre al mismo punto. Volver a la misma percha después de cada
        // picada era lo que hacía que la pelea se sintiera un bucle fijo.
        e.y += (e.perchaY - e.y) * Math.min(1, dt * 3);
        e.x += Math.sign(pcx - cx) * Math.min(Math.abs(pcx - cx), 70 * dt);
        _clampArena(e);
        e.facing = pcx > cx ? 1 : -1;
        _anim(e, dt, ANIMS.posado, 0.55);
        if (e.stateTimer > (e.phase === 1 ? 1.5 : 1.1)) {
          if (e.gritoPendiente) _entrar(e, 'grito');
          else { _entrar(e, 'vuelo'); e.picadasHechas = 0; }
        }
        break;

      case 'grito':
        // Se planta de frente y apaga el camino dorado. El apagón arranca en el
        // tercer cuadro, cuando abre las alas del todo: el sonido y la imagen
        // tienen que caer juntos.
        e.vx = 0;
        _anim(e, dt, ANIMS.grito, 0.18);
        if (e.stateTimer > 0.54 && e.oscuridad <= 0 && !e.yaGrito) {
          e.yaGrito = true;
          e.oscuridad = OSCURIDAD_DUR;
          if (typeof Renderer !== 'undefined') Renderer.flash('rgba(250,204,21,0.35)', 0.4);
          if (typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss');
        }
        if (e.stateTimer > 1.1) {
          e.yaGrito = false;
          e.gritoPendiente = false;
          _entrar(e, 'vuelo');
          e.picadasHechas = 0;
        }
        break;

      case 'vuelo': {
        // Sube hasta la altura de vuelo y persigue tu columna. Acá no la tocás:
        // está a cinco tiles del piso y ésa es toda la defensa que necesita.
        e.y += (alturaVuelo - e.y) * Math.min(1, dt * 3.5);
        const dx = pcx - cx;
        e.facing = dx > 0 ? 1 : -1;
        e.x += Math.sign(dx) * Math.min(Math.abs(dx), VEL_VUELO * (1 + (e.phase - 1) * 0.3) * dt);
        _clampArena(e);
        _anim(e, dt, ANIMS.vuelo, 0.12);
        // Se tira cuando logra ponerse ENCIMA, no cuando se le cumple un
        // cronómetro. Es la diferencia entre parecer que te caza y parecer que
        // repite un ciclo sin mirarte. El tope de 2,8 s existe sólo para que no
        // se quede dando vueltas si el jugador corre en círculos.
        if (e.stateTimer > 0.5 && Math.abs(dx) < ENCIMA) _entrar(e, 'aviso');
        else if (e.stateTimer > 2.8)                     _entrar(e, 'aviso');
        break;
      }

      case 'aviso':
        // Se queda quieta con los ojos encendidos y FIJA el blanco. Fijarlo acá
        // —y no al empezar la picada— es lo que hace que moverse sirva.
        e.y += (alturaVuelo - e.y) * Math.min(1, dt * 3.5);
        _anim(e, dt, ANIMS.vuelo, 0.30);
        if (e.stateTimer > AVISO_DUR) {
          e.objetivoX = pcx - e.w / 2;
          e.facing = e.objetivoX > e.x ? 1 : -1;
          _entrar(e, 'picada');
        }
        break;

      case 'picada': {
        const dx = e.objetivoX - e.x;
        const dy = (e.sueloY - e.h) - e.y;
        const d  = Math.hypot(dx, dy) || 1;
        const v  = VEL_PICADA * (1 + (e.phase - 1) * 0.15);
        e.x += (dx / d) * v * dt;
        e.y += (dy / d) * v * dt;
        _clampArena(e);
        _anim(e, dt, ANIMS.picada, 0.09);
        if (e.y + e.h >= e.sueloY) {
          e.y = e.sueloY - e.h;
          e.picadasHechas++;
          _entrar(e, 'aterrizado');
          if (typeof Renderer !== 'undefined') {
            Renderer.spawnParticles(e.x + e.w / 2, e.sueloY, '#a78bfa', 12);
          }
        }
        break;
      }

      case 'aterrizado':
        // TU TURNO. Todo lo demás de la pelea existe para llegar acá.
        e.y = e.sueloY - e.h;
        e.facing = pcx > cx ? 1 : -1;
        _anim(e, dt, ANIMS.posado, 0.30);
        if (e.stateTimer > PISO_POR_FASE[e.phase - 1]) {
          if (e.picadasHechas < PICADAS_POR_FASE[e.phase - 1]) {
            _entrar(e, 'vuelo');
          } else {
            e.ciclos++;
            // En fase 3 el apagón vuelve cada dos ciclos
            if (e.phase === 3 && e.ciclos % 2 === 0) e.gritoPendiente = true;
            _entrar(e, 'posado');
          }
        }
        break;

      case 'damage':
        _anim(e, dt, ANIMS.damage, 0.10);
        if (e.stateTimer > 0.40) {
          // Golpeada, levanta vuelo. Es lo que hace un pájaro y además es lo
          // que sostiene toda la pelea: si volviera al piso con la ventana
          // reseteada, se la podía matar encadenando doce pisotones seguidos
          // sin que llegara a volar una sola vez. Un golpe por aterrizaje.
          //
          // Y el grito se decide TAMBIÉN acá, no sólo al volver a la rama: a
          // quien le pega en cada aterrizaje, la lechuza nunca vuelve a la
          // rama, y así el apagón —que es el corazón de la pelea— no se
          // disparaba nunca. Además cae mejor: el golpe que la pasa de fase la
          // hace tambalear, y de ahí grita.
          if (e.gritoPendiente) _entrar(e, 'grito');
          else                  _entrar(e, 'vuelo');
        }
        break;
    }
  }

  function _entrar(e, estado) {
    e.state = estado; e.stateTimer = 0; e.frameIdx = 0; e.frameTick = 0;
  }

  function _clampArena(e) {
    if (e.x < e.arenaLeft)            e.x = e.arenaLeft;
    if (e.x + e.w > e.arenaRight)     e.x = e.arenaRight - e.w;
  }

  function _anim(e, dt, total, vel) {
    e.frameTick += dt;
    if (e.frameTick >= vel) { e.frameTick = 0; e.frameIdx = (e.frameIdx + 1) % total; }
  }

  // ── Daño ──────────────────────────────────────────────
  //
  //  Sin condiciones: si la alcanzaste, le pegaste. Volando está a cinco tiles
  //  de altura, así que la geometría ya hace de regla — y si alguien logra
  //  saltarle encima en plena picada, se lo ganó.
  function hit(e) {
    if (!e.alive || e.state === 'death') return;
    e.hp--;
    if (typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss');
    if (typeof Renderer !== 'undefined') {
      Renderer.spawnParticles(e.x + e.w / 2, e.y + 20, '#facc15', 10);
    }
    if (e.hp <= 0) {
      e.oscuridad = 0;            // que el nivel se vuelva a encender al ganar
      _entrar(e, 'death');
      if (typeof AudioManager !== 'undefined') AudioManager.sfx('death_boss');
      window.dispatchEvent(new CustomEvent('bossDefeated'));
    } else {
      _entrar(e, 'damage');
    }
  }

  function isBoss() { return true; }

  // ── Draw ──────────────────────────────────────────────
  function draw(ctx, e, camX, camY) {
    const sx = e.x - camX, sy = e.y - camY;
    const ancho = Renderer.getSize().W;
    if (sx < -W * 3 || sx > ancho + W * 3) return;

    // 'aviso' es el instante de acecho: se queda quieta en el aire, así que
    // usa los cuadros de vuelo.
    const anim = ANIMS[e.state] ? e.state : e.state === 'aviso' ? 'vuelo' : 'posado';
    const img = _img(`${anim}${e.frameIdx}`);

    ctx.save();

    // Los cuadros con las alas abiertas son mucho más anchos que los del cuerpo
    // plegado, así que se dibuja RESPETANDO la proporción y apoyada en las
    // garras. Meter todo en la misma caja aplastaría justo la envergadura.
    ctx.translate(sx + e.w / 2, sy + e.h);
    // Los sprites están dibujados mirando a la DERECHA (medido: el disco facial
    // cae siempre a la derecha del centro del cuerpo). Así que se espeja cuando
    // mira a la IZQUIERDA. Al revés —como estaba— la lechuza le daba la espalda
    // al jugador todo el tiempo, y eso sólo se lee como que no te ve.
    // El grito es de frente: ése no se espeja nunca.
    if (e.facing === -1 && e.state !== 'grito') ctx.scale(-1, 1);

    if (img) {
      // Todos los cuadros vienen en el mismo lienzo de 378x284, con la lechuza
      // ya normalizada por el tamaño de su cara y apoyada abajo. Por eso alcanza
      // un solo factor: dentro del lienzo cada pose ocupa lo que le toca.
      const ar = img.naturalWidth / img.naturalHeight;
      const dh = e.h * 1.31, dw = dh * ar;
      ctx.drawImage(img, -dw / 2, -dh, dw, dh);
    } else {
      _dibujarFallback(ctx, e);
    }
    ctx.restore();

    if (e.alive) _dibujarBarra(ctx, e);
  }

  // Lechuza de canvas — sirve para jugar la pelea completa mientras no estén
  // los sprites. Dibujada desde las garras hacia arriba, como los sprites.
  function _dibujarFallback(ctx, e) {
    const h = e.h * 1.31, w = h * 0.78;
    const abierta = e.state === 'grito' || e.state === 'picada' || e.state === 'vuelo';
    const alaW = abierta ? w * 0.55 : w * 0.22;

    ctx.save();
    // Alas — salen de los hombros hacia los costados, no envuelven al bicho
    ctx.fillStyle = '#4c3a2a';
    [-1, 1].forEach(s => {
      ctx.beginPath();
      ctx.ellipse(s * (w * 0.32 + alaW * 0.75), -h * 0.55, alaW, h * 0.20, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    });
    // Cuerpo
    ctx.fillStyle = '#6b5138';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.42, w * 0.40, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cara de corazón
    ctx.fillStyle = '#d9cbb4';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.72, w * 0.30, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Penachos
    ctx.fillStyle = '#4c3a2a';
    [-1, 1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s * w * 0.26, -h * 0.86);
      ctx.lineTo(s * w * 0.36, -h * 1.02);
      ctx.lineTo(s * w * 0.10, -h * 0.90);
      ctx.closePath(); ctx.fill();
    });
    // Pico
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.66);
    ctx.lineTo(-w * 0.05, -h * 0.60);
    ctx.lineTo(w * 0.05, -h * 0.60);
    ctx.closePath(); ctx.fill();
    // Garras
    ctx.strokeStyle = '#3a2c1e'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    [-1, 1].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s * w * 0.14, -h * 0.06);
      ctx.lineTo(s * w * 0.20, 0);
      ctx.stroke();
    });
    ctx.restore();
  }

  // ── Los ojos ──────────────────────────────────────────
  //
  //  Los sprites ya traen los ojos pintados, así que con luz normal no hace
  //  falta dibujar nada: agregarles un brillo encima sólo los ensucia. Estos
  //  son los faroles del APAGÓN, cuando la lechuza es una silueta negra y los
  //  ojos son lo único que te dice de dónde viene.
  //
  //  La cabeza se mueve muchísimo entre poses —volando está abajo y adelante,
  //  posada está arriba y al medio—, así que la posición sale de esta tabla,
  //  medida sobre los propios PNG buscando los píxeles amarillos del ojo.
  //  Están en fracción del lienzo de 378x284, que es común a todos los cuadros.
  const OJOS = {
    posado:     [0.519, 0.471],
    vuelo:      [0.637, 0.703],
    picada:     [0.720, 0.746],
    aterrizado: [0.639, 0.540],
    grito:      [0.481, 0.561],
    damage:     [0.501, 0.493],
  };

  function _dibujarOjos(ctx, e, sx, sy, anim) {
    const punto = OJOS[anim];
    if (!punto) return;                       // en 'death' los tiene cerrados

    const img = _img(`${anim}${e.frameIdx}`);
    const ar  = img ? img.naturalWidth / img.naturalHeight : 1.331;
    const dh  = e.h * 1.31, dw = dh * ar;

    // Espejar el punto igual que se espeja el dibujo
    const espeja = e.facing === -1 && e.state !== 'grito';
    const fx = espeja ? 1 - punto[0] : punto[0];
    const cx = sx + e.w / 2 + (fx - 0.5) * dw;
    const cy = sy + e.h - dh + punto[1] * dh;
    const sep = dw * 0.07;

    ctx.save();
    const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, dw * 0.16);
    halo.addColorStop(0,   'rgba(255,240,150,0.85)');
    halo.addColorStop(0.4, 'rgba(250,204,21,0.45)');
    halo.addColorStop(1,   'rgba(250,204,21,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, dw * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,220,0.95)';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(cx + s * sep / 2, cy, dw * 0.018, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── El apagón ─────────────────────────────────────────
  //
  //  Se dibuja al final del frame, sobre todo lo demás. Es un solo gradiente
  //  radial centrado en el jugador (transparente adentro, negro afuera) en vez
  //  de recortar con destination-out: componer sobre el canvas principal
  //  borraría el nivel entero, no sólo esta capa.
  function drawOscuridad(ctx, e, camX, camY, ps) {
    if (!e || e.oscuridad <= 0) return;
    // Tamaño LÓGICO, no el del canvas. El contexto viene con una escala
    // aplicada (≈2,5 según la pantalla), así que ctx.canvas.width está en
    // píxeles físicos: usarlo hacía el radio de luz casi el triple del que
    // corresponde y el apagón quedaba en una penumbra floja.
    const { W: W_, H: H_ } = Renderer.getSize();

    // Entra de golpe (el grito) y se va despacio (vuelven las luciérnagas)
    const k = e.oscuridad > OSCURIDAD_DUR - 0.3
      ? (OSCURIDAD_DUR - e.oscuridad) / 0.3
      : Math.min(1, e.oscuridad / 1.4);

    const px = ps.x + ps.w / 2 - camX, py = ps.y + ps.h / 2 - camY;
    const radio = Math.hypot(W_, H_);

    ctx.save();
    const g = ctx.createRadialGradient(px, py, 0, px, py, radio);
    g.addColorStop(0,    'rgba(4,2,18,0)');
    g.addColorStop(0.10, 'rgba(4,2,18,0)');
    g.addColorStop(0.26, `rgba(4,2,18,${0.93 * k})`);
    g.addColorStop(1,    `rgba(4,2,18,${0.93 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W_, H_);
    ctx.restore();

    // Y encima, los faroles.
    const anim = ANIMS[e.state] ? e.state : e.state === 'aviso' ? 'vuelo' : 'posado';
    _dibujarOjos(ctx, e, e.x - camX, e.y - camY, anim);
  }

  function _dibujarBarra(ctx, e) {
    // Igual que arriba: en coordenadas lógicas. Con ctx.canvas.width la barra
    // se centraba respecto de un ancho físico y terminaba fuera de pantalla.
    const canvasW = Renderer.getSize().W;
    const bw = Math.min(420, canvasW * 0.46), bh = 12;
    const bx = (canvasW - bw) / 2, by = 46;
    const ratio = Math.max(0, e.hp / e.maxHp);
    const col = e.phase === 3 ? '#ef4444' : e.phase === 2 ? '#eab308' : '#4ade80';

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, bw + 4, bh + 4, 6); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.30)'; ctx.lineWidth = 2;
    [0.33, 0.66].forEach(p => {
      ctx.beginPath(); ctx.moveTo(bx + bw * p, by); ctx.lineTo(bx + bw * p, by + bh); ctx.stroke();
    });
    ctx.font = 'bold 12px Fredoka,system-ui'; ctx.textAlign = 'center';
    const txt = `🦉 Lechuza Guardiana — ${e.hp}/${e.maxHp}`;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(txt, canvasW / 2 + 1, by - 2);
    ctx.fillStyle = '#fff';             ctx.fillText(txt, canvasW / 2,     by - 3);
    ctx.restore();
  }

  return { preload, spawn, update, hit, draw, drawOscuridad, isBoss, H, W };

})();
