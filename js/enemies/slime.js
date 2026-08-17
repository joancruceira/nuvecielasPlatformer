// ═══════════════════════════════════════════════════════
//  SLIME.JS — Slime del Bosque Mágico
//
//  No camina: SALTA. Se agacha, se estira en el aire y se aplasta al caer.
//
//  Los cuatro cuadros son un ciclo de squash-and-stretch, y por eso se dibujan
//  RESPETANDO su proporción y apoyados en el piso, no metidos en una caja fija:
//  el cuadro aplastado mide 92x24 contra 65x52 del de reposo, y meterlos a los
//  dos en la misma caja borraría justamente lo que hace gracioso al bicho.
// ═══════════════════════════════════════════════════════

const Slime = (() => {

  const TS = 48;
  const GRAVEDAD = 1100;

  const frames = {};
  function preload() {
    ['slime_idle0', 'slime_crouch0', 'slime_air0', 'slime_land0'].forEach(n => {
      const img = new Image();
      img.src = `img/${n}.png`;
      frames[n] = img;
    });
  }

  function create(x, y) {
    return {
      type: 'slime',
      x, y: y - 34,
      w: 44, h: 34,
      vx: 0, vy: 0,
      facing: -1,
      hp: 1, maxHp: 1,
      alive: true,
      stunTimer: 0,
      onGround: false,
      estado: 'reposo',      // reposo → agacha → aire → aterriza
      tiempo: 0,
      esperaSalto: 0.9 + Math.random() * 0.8,
    };
  }

  function update(e, dt, map, ps) {
    if (!e.alive) return;
    if (e.stunTimer > 0) { e.stunTimer -= dt; }

    e.tiempo += dt;

    // Gravedad y piso — siempre, aunque esté aturdido
    e.vy += GRAVEDAD * dt;
    e.y += e.vy * dt;
    e.x += e.vx * dt;
    const tocaba = e.onGround;
    _resolverPiso(e, map);

    if (e.onGround && !tocaba && e.estado === 'aire') {
      e.estado = 'aterriza';
      e.tiempo = 0;
      e.vx = 0;
      if (typeof Renderer !== 'undefined') {
        Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h, '#4ade80', 6);
      }
    }

    if (e.stunTimer > 0) return;

    if (e.estado === 'aterriza') {
      // El aplastado dura poco: es el remate del salto
      if (e.tiempo > 0.18) { e.estado = 'reposo'; e.tiempo = 0; }
      return;
    }

    if (e.estado === 'reposo' && e.onGround) {
      if (e.tiempo > e.esperaSalto) { e.estado = 'agacha'; e.tiempo = 0; }
      return;
    }

    if (e.estado === 'agacha') {
      // Se agacha antes de saltar: el aviso que hace justo al salto
      if (e.tiempo > 0.25) {
        const dx = (ps.x + ps.w / 2) - (e.x + e.w / 2);
        e.facing = dx < 0 ? -1 : 1;
        e.vx = e.facing * 90;
        e.vy = -420;
        e.estado = 'aire';
        e.tiempo = 0;
        e.onGround = false;
        e.esperaSalto = 0.9 + Math.random() * 0.8;
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('jump');
      }
    }
  }

  function _resolverPiso(e, map) {
    if (!map) return;
    const filas = map.length, cols = map[0].length;
    e.onGround = false;

    const c0 = Math.max(0, Math.floor((e.x + 4) / TS));
    const c1 = Math.min(cols - 1, Math.floor((e.x + e.w - 4) / TS));
    const r  = Math.floor((e.y + e.h) / TS);

    if (r >= 0 && r < filas && e.vy >= 0) {
      for (let c = c0; c <= c1; c++) {
        const t = map[r]?.[c];
        if (t === TILE.GROUND || t === TILE.BLOCK || t === TILE.PLATFORM) {
          e.y = r * TS - e.h;
          e.vy = 0;
          e.onGround = true;
          break;
        }
      }
    }

    if (e.x < 0) { e.x = 0; e.vx = Math.abs(e.vx); }
    if (e.x + e.w > cols * TS) { e.x = cols * TS - e.w; e.vx = -Math.abs(e.vx); }
    if (e.y > filas * TS + 120) e.alive = false;
  }

  function hit(e) {
    if (!e.alive) return;
    e.alive = false;
    if (typeof AudioManager !== 'undefined') AudioManager.sfx('death_enemy');
    if (typeof Renderer !== 'undefined') {
      Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#4ade80', 16);
      Renderer.spawnText(e.x + e.w / 2, e.y, '+100', '#86efac');
    }
  }

  function draw(ctx, e, camX, camY) {
    const key = e.estado === 'aterriza' ? 'slime_land0'
              : e.estado === 'agacha'   ? 'slime_crouch0'
              : e.estado === 'aire'     ? 'slime_air0'
              : 'slime_idle0';
    const img = frames[key];

    const x = e.x - camX, y = e.y - camY;

    ctx.save();
    ctx.globalAlpha = e.stunTimer > 0 ? 0.55 : 1;

    if (img && img.complete && img.naturalWidth > 0) {
      // Proporción propia y APOYADO EN EL PISO: el aplastado tiene que
      // quedar bajo y ancho, no estirado hasta llenar una caja.
      const escala = e.h / 52;                   // 52 = alto del cuadro de reposo
      const dw = img.naturalWidth  * escala;
      const dh = img.naturalHeight * escala;
      ctx.translate(x + e.w / 2, y + e.h);       // ancla: el pie
      if (e.facing === 1) ctx.scale(-1, 1);      // el sprite mira a la izquierda
      ctx.drawImage(img, -dw / 2, -dh, dw, dh);
      if (e.stunTimer > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(200,200,200,0.5)';
        ctx.fillRect(-dw / 2, -dh, dw, dh);
      }
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(x + e.w / 2, y + e.h * 0.6, e.w * 0.45, e.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return { preload, create, update, hit, draw };

})();
