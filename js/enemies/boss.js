// ═══════════════════════════════════════════════════════
//  BOSS.JS — Hongo Gigante (Jefe del nivel 1)
//
//  Level1 siempre declaró `bossName: 'Hongo Gigante'`, pero el sprite que se
//  cargaba era img/alien.png, con aura verde alienígena. El jefe del bosque
//  mágico era, literalmente, un extraterrestre.
//
//  Tres fases, puede caer al foso (derrota alternativa).
// ═══════════════════════════════════════════════════════

const Boss = (() => {

  const TS         = 48;
  const BASE_SPEED = 70;

  // ── Animaciones ──────────────────────────────────────
  const ANIMS = {
    idle:   ['hongo_idle0', 'hongo_idle01'],
    walk:   ['hongo_walk0', 'hongo_walk01', 'hongo_walk02', 'hongo_walk03'],
    attack: ['hongo_attack0', 'hongo_attack01', 'hongo_attack02'],
    hit:    ['hongo_hit0'],
  };
  const FPS = { idle: 4, walk: 8, attack: 10, hit: 6 };

  const frames = {};
  function preload() {
    for (const lista of Object.values(ANIMS)) {
      for (const key of lista) {
        const img = new Image();
        img.src = `img/${key}.png`;
        frames[key] = img;
      }
    }
  }

  /** Qué está haciendo el hongo, traducido a cuadro. */
  function _frame(e, ts) {
    let anim = 'idle';
    if (e.stunTimer > 0)                 anim = 'hit';
    else if (e.bossPattern === 'charge' || e.bossPattern === 'escupir') anim = 'attack';
    else if (Math.abs(e.vx) > 5)         anim = 'walk';

    const lista = ANIMS[anim];
    return frames[lista[Math.floor(ts / 1000 * FPS[anim]) % lista.length]];
  }

  function create(x, y) {
    return {
      type:    'boss',
      x, y,
      w: 96, h: 96,
      vx: 0, vy: 0,
      facing: -1,
      hp: 12, maxHp: 12,
      stunTimer:        0,
      bossPhase:        1,
      bossTimer:        0,
      bossJumpTimer:    0,
      bossPatternTimer: 0,
      bossPattern:      'patrol',
      activated:        false,
      alive:            true,
      // Esporas en vuelo. El arte tenía el cuadro de lanzamiento desde el
      // principio; hasta ahora el hongo hacía el gesto y no salía nada.
      esporas:          [],
    };
  }

  function update(e, dt, map, ps, onDefeated) {
    const dx   = ps.x - e.x;
    const dist = Math.abs(dx);

    if (!e.activated && dist < 600) e.activated = true;
    if (!e.activated) return;

    if (e.stunTimer > 0) {
      e.stunTimer -= dt;
      e.vx *= 0.85;
      e.vy += 900 * dt;
      e.y  += e.vy * dt;
      _resolveFloor(e, dt, map);
      _checkFall(e, map, onDefeated);
      return;
    }

    const ratio = e.hp / e.maxHp;
    e.bossPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;

    const speed = BASE_SPEED * (1 + (e.bossPhase - 1) * 0.45);
    const dur   = e.bossPhase === 3 ? 1.8 : e.bossPhase === 2 ? 2.4 : 3.0;

    e.bossPatternTimer += dt;
    if (e.bossPatternTimer > dur) {
      e.bossPatternTimer = 0;
      const opts = e.bossPhase >= 2
        ? ['patrol','chase','charge','escupir']
        : ['patrol','chase'];
      e.bossPattern = opts[Math.floor(Math.random() * opts.length)];
    }

    if (e.bossPattern === 'patrol')      e.vx = e.facing * speed;
    else if (e.bossPattern === 'chase')  e.vx = dx > 0 ? speed : -speed;
    else if (e.bossPattern === 'charge') e.vx = dx > 0 ? speed * 2.2 : -speed * 2.2;
    else if (e.bossPattern === 'escupir') {
      // Se planta y escupe. De cerca no sirve: es el castigo por quedarse lejos.
      e.vx = 0;
      e.facing = dx > 0 ? 1 : -1;
      if (dist > 220) _escupir(e, dx);   // `_escupido` garantiza una por ciclo
    }

    _actualizarEsporas(e, dt, map, ps);

    e.vy += 900 * dt;
    e.x  += e.vx * dt;
    e.y  += e.vy * dt;

    _resolveFloor(e, dt, map);
    _checkFall(e, map, onDefeated);

    const cols = map[0].length;
    if (e.x < 0)                { e.x = 0;              e.facing =  1; }
    if (e.x + e.w > cols * TS)  { e.x = cols * TS - e.w; e.facing = -1; }
    e.facing = e.vx >= 0 ? 1 : -1;

    if (e.hp <= 0 && e.alive) {
      e.alive = false;
      Renderer.spawnParticles(e.x + e.w/2, e.y + e.h/2, '#86efac', 32);
      Renderer.flash('#86efac', 0.6);
      onDefeated && onDefeated();
    }
  }

  /** Lanza una espora en arco hacia la jugadora. */
  function _escupir(e, dx) {
    // Una sola por ciclo de patrón: si no, escupe sin parar.
    if (e._escupido) return;
    e._escupido = true;

    const dir = dx > 0 ? 1 : -1;
    e.esporas.push({
      x: e.x + e.w / 2 + dir * e.w * 0.4,
      y: e.y + e.h * 0.45,
      vx: dir * 300,
      vy: -180,          // sale en arco, no recto: se puede saltar por debajo
      giro: 0,
    });
    if (typeof AudioManager !== 'undefined') AudioManager.sfx('shoot');
    if (typeof Renderer !== 'undefined') {
      Renderer.spawnParticles(e.x + e.w / 2, e.y + e.h * 0.45, '#a3e635', 8);
    }
  }

  function _actualizarEsporas(e, dt, map, ps) {
    if (e.bossPattern !== 'escupir') e._escupido = false;

    for (let i = e.esporas.length - 1; i >= 0; i--) {
      const sp = e.esporas[i];
      sp.vy += 520 * dt;
      sp.x  += sp.vx * dt;
      sp.y  += sp.vy * dt;
      sp.giro += dt * 7;

      // Contra el suelo: revienta en una nubecita
      const r = Math.floor(sp.y / TS), c = Math.floor(sp.x / TS);
      const t = map[r]?.[c];
      if (t === TILE.GROUND || t === TILE.BLOCK) {
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(sp.x, sp.y, '#a3e635', 10);
        }
        e.esporas.splice(i, 1);
        continue;
      }

      // Contra la jugadora
      if (sp.x > ps.x && sp.x < ps.x + ps.w && sp.y > ps.y && sp.y < ps.y + ps.h) {
        if (!ps.invincible) Player.takeDamage(sp.x);
        if (typeof Renderer !== 'undefined') {
          Renderer.spawnParticles(sp.x, sp.y, '#a3e635', 12);
        }
        e.esporas.splice(i, 1);
        continue;
      }

      // Fuera del mapa
      if (sp.y > map.length * TS + 100 || sp.x < 0 || sp.x > map[0].length * TS) {
        e.esporas.splice(i, 1);
      }
    }
  }

  function _dibujarEsporas(ctx, e, camX, camY) {
    if (!e.esporas || !e.esporas.length) return;
    ctx.save();
    for (const sp of e.esporas) {
      const x = sp.x - camX, y = sp.y - camY;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sp.giro);
      ctx.fillStyle = '#65a30d';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a3e635';
      ctx.beginPath(); ctx.arc(-3, -3, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f6212';
      ctx.beginPath(); ctx.arc(4, 2, 2.5, 0, Math.PI * 2); ctx.arc(-2, 5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function _resolveFloor(e, dt, map) {
    const rows = map.length, cols = map[0].length;
    const rFloor = Math.floor((e.y + e.h) / TS);
    const cL = Math.max(0,        Math.floor((e.x + 4)        / TS));
    const cR = Math.min(cols - 1, Math.floor((e.x + e.w - 4) / TS));

    let onGround = false;
    if (rFloor >= 0 && rFloor < rows) {
      for (let c = cL; c <= cR; c++) {
        const t = map[rFloor]?.[c];
        if (t === TILE.GROUND || t === TILE.BLOCK) {
          e.y  = rFloor * TS - e.h;
          e.vy = 0;
          onGround = true;
          e.bossJumpTimer += dt;
          const ji = e.bossPhase === 3 ? 1.2 : e.bossPhase === 2 ? 1.8 : 2.5;
          if (e.bossJumpTimer > ji) {
            e.vy = -580 - (e.bossPhase - 1) * 80;
            e.bossJumpTimer = 0;
          }
          break;
        }
      }
    }
    // Voltear en borde de foso
    if (onGround && Math.abs(e.vx) > 5) {
      const lookX  = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
      const cFront = Math.floor(lookX / TS);
      const rFoot  = Math.floor((e.y + e.h + 2) / TS);
      if (cFront >= 0 && cFront < cols && rFoot >= 0 && rFoot < rows) {
        const tF = map[rFoot]?.[cFront];
        if (tF !== TILE.GROUND && tF !== TILE.BLOCK) {
          e.vx = -e.vx;
          e.facing = e.vx >= 0 ? 1 : -1;
        }
      }
    }
  }

  function _checkFall(e, map, onDefeated) {
    if (e.y > map.length * TS + 80 && e.alive) {
      e.alive = false;
      Renderer.spawnText(e.x + e.w/2, map.length * TS - 40, '¡AL FOSO! 😱', '#86efac');
      Renderer.flash('#86efac', 0.75);
      onDefeated && onDefeated();
    }
  }

  function draw(ctx, e, camX, camY, ts) {
    _dibujarEsporas(ctx, e, camX, camY);
    const x = e.x - camX, y = e.y - camY;
    const { w, h, bossPhase = 1, stunTimer, hp, maxHp } = e;
    const bob = Math.sin(ts / 300) * 4;

    ctx.save();
    ctx.globalAlpha = stunTimer > 0 ? 0.6 : 1;
    ctx.translate(x + w/2, y + h/2 + bob);

    const scale = 1 + (bossPhase - 1) * 0.08;
    // Los sprites miran a la DERECHA; se espeja cuando camina hacia la izquierda.
    // Antes no se espejaba nunca: `facing` se calculaba en update y el draw lo
    // ignoraba, así que el jefe siempre miraba para el mismo lado.
    ctx.scale(scale * (e.facing === -1 ? -1 : 1), scale);

    // Nube de esporas. Antes era un aura verde alienígena; ahora acompaña al
    // hongo y se pone más densa a medida que se enoja.
    const pulse = 0.4 + Math.sin(ts / 220) * 0.18;
    const densidad = 1 + (bossPhase - 1) * 0.35;
    const aura  = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.9);
    aura.addColorStop(0,   `rgba(190,220,120,${pulse * 0.45 * densidad})`);
    aura.addColorStop(0.5, `rgba(120,170,70,${pulse * 0.22 * densidad})`);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, 0, w * 0.9, 0, Math.PI*2); ctx.fill();

    const img = _frame(e, ts);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -w/2, -h/2, w, h);
      if (stunTimer > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,60,60,0.5)';
        ctx.fillRect(-w/2, -h/2, w, h);
      }
    } else {
      // Fallback
      ctx.fillStyle = bossPhase === 3 ? '#dc2626' : bossPhase === 2 ? '#ef4444' : '#f87171';
      ctx.beginPath(); ctx.ellipse(0, 0, w*0.42, h*0.38, 0, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();

    // Barra de vida
    if (maxHp) {
      const bw = w*1.2, bx = x+w/2-bw/2, by = y-18;
      const ratio = Math.max(0, hp/maxHp);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, 8, 4); ctx.fill();
      ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#ef4444';
      ctx.beginPath(); ctx.roundRect(bx, by, bw*ratio, 8, 4); ctx.fill();
      ctx.restore();
    }
  }

  return { preload, create, update, draw };

})();
