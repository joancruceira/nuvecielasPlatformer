// ═══════════════════════════════════════════════════════
//  ARANA.JS — Araña del Castillo de Nuveciela
//
//  Cuelga del techo de un hilo y BAJA cuando pasás por abajo. Después sube
//  y vuelve a esperar.
//
//  Es el único enemigo del juego que ataca desde arriba: todo lo demás camina,
//  vuela en horizontal o salta. Por eso el peligro no está en esquivarla sino
//  en mirar para arriba antes de pasar.
//
//  El sprite es la vista FRONTAL de la araña (mirándote de cara), que es
//  justamente lo que se ve cuando algo baja del techo hacia vos.
// ═══════════════════════════════════════════════════════

const Arana = (() => {

  const TS = 48;

  const frames = {};
  function preload() {
    ['arana_hang0', 'arana_hang1', 'arana_drop0', 'arana_drop1'].forEach(n => {
      const img = new Image();
      img.src = `img/${n}.png`;
      frames[n] = img;
    });
  }

  function create(x, y) {
    return {
      type: 'arana',
      x, y,
      w: 52, h: 40,
      vx: 0, vy: 0,
      facing: 1,
      hp: 1, maxHp: 1,
      alive: true,
      stunTimer: 0,
      // El techo del que cuelga es donde nació: el hilo se dibuja desde ahí.
      anclaY: y,
      estado: 'espera',   // espera → baja → vuelve
      tiempo: 0,
      alcance: 240,       // hasta dónde se estira el hilo
    };
  }

  function update(e, dt, map, ps) {
    if (!e.alive) return;
    if (e.stunTimer > 0) { e.stunTimer -= dt; return; }

    e.tiempo += dt;

    const pcx = ps.x + ps.w / 2;
    const cx  = e.x + e.w / 2;
    const debajo = Math.abs(pcx - cx) < 90;

    if (e.estado === 'espera') {
      // Se mece apenas mientras espera
      e.x += Math.sin(e.tiempo * 1.6) * 8 * dt;
      if (debajo) { e.estado = 'baja'; e.vy = 300; }
      return;
    }

    if (e.estado === 'baja') {
      e.y += e.vy * dt;
      const bajo = e.y - e.anclaY;
      // Frena al llegar al final del hilo o al tocar suelo
      if (bajo >= e.alcance || _sueloDebajo(e, map)) {
        e.estado = 'vuelve';
        e.tiempo = 0;
      }
      return;
    }

    if (e.estado === 'vuelve') {
      // Espera un instante abajo (el momento de peligro) y sube
      if (e.tiempo < 0.5) return;
      e.y -= 150 * dt;
      if (e.y <= e.anclaY) {
        e.y = e.anclaY;
        e.estado = 'espera';
        e.tiempo = 0;
      }
    }
  }

  function _sueloDebajo(e, map) {
    if (!map) return false;
    const r = Math.floor((e.y + e.h + 4) / TS);
    const c = Math.floor((e.x + e.w / 2) / TS);
    const t = map[r]?.[c];
    return t === TILE.GROUND || t === TILE.BLOCK || t === TILE.PLATFORM;
  }

  function hit(e) {
    if (!e.alive) return;
    e.alive = false;
    if (typeof AudioManager !== 'undefined') AudioManager.sfx('death_enemy');
    if (typeof Renderer !== 'undefined') {
      Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#a855f7', 14);
      Renderer.spawnText(e.x + e.w / 2, e.y, '+120', '#c084fc');
    }
  }

  function draw(ctx, e, camX, camY, ts) {
    const x = e.x - camX, y = e.y - camY;

    // El hilo: se dibuja por código para que se estire con ella.
    ctx.save();
    ctx.strokeStyle = 'rgba(226,232,240,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + e.w / 2, e.anclaY - camY);
    ctx.lineTo(x + e.w / 2, y + 6);
    ctx.stroke();
    ctx.restore();

    const bajando = e.estado === 'baja' || e.estado === 'vuelve';
    const key = bajando
      ? (Math.floor(ts / 110) % 2 ? 'arana_drop1' : 'arana_drop0')
      : (Math.floor(ts / 420) % 2 ? 'arana_hang1' : 'arana_hang0');
    const img = frames[key];

    ctx.save();
    ctx.globalAlpha = e.stunTimer > 0 ? 0.55 : 1;
    ctx.translate(x + e.w / 2, y + e.h / 2);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -e.w / 2, -e.h / 2, e.w, e.h);
    } else {
      ctx.fillStyle = '#7e22ce';
      ctx.beginPath(); ctx.ellipse(0, 0, e.w * 0.35, e.h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }

    if (e.stunTimer > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(200,200,200,0.5)';
      ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
    }
    ctx.restore();
  }

  return { preload, create, update, hit, draw };

})();
