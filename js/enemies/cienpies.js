// ═══════════════════════════════════════════════════════
//  CIENPIES.JS — Ciempiés Gigante (Boss nivel 3)
//  Boss horizontal. Patrulla la arena, hace lunges.
//  3 fases según HP. Al morir abre el portal.
//
//  Estados:  walk → attack → damage → death
//  Sprites:  cienpies_walk0-2, cienpies_attack0-2,
//            cienpies_damage0-2, cienpies_death0-1
// ═══════════════════════════════════════════════════════

const Cienpies = (() => {

  const W = 256, H = 128;
  const BASE_SPEED     = 90;
  const LUNGE_SPEED    = 380;
  const LUNGE_DURATION = 0.35;
  const LUNGE_COOLDOWN = 2.2;
  const MAX_HP         = 12;

  // ── Sprites ───────────────────────────────────────────
  const imgs = {};
  function _img(k) { const i=imgs[k]; return(i&&i.complete&&i.naturalWidth>0)?i:null; }

  function preload() {
    const B = 'img/level3/';
    function load(anim, count) {
      for(let i=0;i<count;i++) {
        const m=new Image();
        m.src = `${B}cienpies_${anim}${i===0?'0':'0'+i}.png`;
        imgs[`${anim}${i}`]=m;
      }
    }
    load('walk',3); load('attack',3); load('damage',3); load('death',2);
  }

  // ── Spawn ─────────────────────────────────────────────
  function spawn(x, y, arenaLeft, arenaRight) {
    return {
      type:      'cienpies',
      x, y, w: W, h: H,
      vx: -BASE_SPEED, facing: -1,
      hp: MAX_HP, maxHp: MAX_HP,
      alive: true,
      activated: false,
      state: 'walk',
      frameIdx: 0, frameTick: 0, stateTimer: 0,
      lungeCooldown: 0,
      arenaLeft, arenaRight,
      phase: 1,   // 1=verde, 2=amarillo, 3=rojo
      onGround: true, vy: 0,
    };
  }

  // ── Update ────────────────────────────────────────────
  function update(e, dt, ps) {
    if(!e.alive && e.state !== 'death') return;
    if(e.state === 'death') {
      e.stateTimer += dt;
      _animCycle(e, dt, 2, 0.20);
      if(e.stateTimer > 0.90) e.alive = false;
      return;
    }

    // Activar cuando el jugador entra al arena
    const dist = Math.abs((ps.x+ps.w/2) - (e.x+e.w/2));
    if(!e.activated && dist < 900) {
      e.activated = true;
      e.state = 'walk';
    }
    if(!e.activated) return;

    e.stateTimer    += dt;
    e.lungeCooldown  = Math.max(0, e.lungeCooldown - dt);

    // Actualizar fase según HP
    const ratio = e.hp / e.maxHp;
    e.phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    const speed = BASE_SPEED * (1 + (e.phase-1) * 0.45);

    const dx = (ps.x+ps.w/2) - (e.x+e.w/2);

    switch(e.state) {

      case 'walk':
        // Patrulla con tendencia hacia el jugador
        if(Math.abs(dx) > 80) {
          e.vx = dx > 0 ? speed : -speed;
          e.facing = dx > 0 ? 1 : -1;
        }
        // Clamp arena
        if(e.x <= e.arenaLeft)            { e.x=e.arenaLeft;       e.vx=Math.abs(e.vx); e.facing=1;  }
        if(e.x+e.w >= e.arenaRight)       { e.x=e.arenaRight-e.w;  e.vx=-Math.abs(e.vx);e.facing=-1; }
        e.x += e.vx * dt;

        // Lunge si está cerca y cooldown ok
        if(Math.abs(dx) < 400 && e.lungeCooldown <= 0) {
          e.state='attack'; e.stateTimer=0; e.frameIdx=0; e.frameTick=0;
          e.lungeVx = (dx>0?1:-1) * LUNGE_SPEED * (1+(e.phase-1)*0.3);
          e.facing = dx > 0 ? 1 : -1;
        }
        _animCycle(e, dt, 3, 0.18 - (e.phase-1)*0.04);
        break;

      case 'attack':
        // Lunge horizontal
        e.x += e.lungeVx * dt;
        e.x = Math.max(e.arenaLeft, Math.min(e.arenaRight-e.w, e.x));
        _animCycle(e, dt, 3, 0.10);
        if(e.stateTimer > LUNGE_DURATION) {
          e.state='walk'; e.stateTimer=0;
          e.lungeCooldown = LUNGE_COOLDOWN / e.phase;
          e.vx = -e.lungeVx * 0.2;  // rebote suave
        }
        break;

      case 'damage':
        e.x += e.vx * dt * 0.15;
        _animCycle(e, dt, 3, 0.09);
        if(e.stateTimer > 0.4) { e.state='walk'; e.stateTimer=0; }
        break;

      case 'death':
        e.x += e.vx * dt * 0.05;
        _animCycle(e, dt, 2, 0.20);
        if(e.stateTimer > 0.9) e.alive = false;
        break;
    }
  }

  function _animCycle(e, dt, total, speed) {
    e.frameTick += dt;
    if(e.frameTick >= speed) { e.frameTick=0; e.frameIdx=(e.frameIdx+1)%total; }
  }

  // ── Daño ──────────────────────────────────────────────
  function hit(e) {
    if(!e.alive || e.state==='death') return;
    e.hp--;
    Renderer.spawnParticles && Renderer.spawnParticles(e.x+e.w/2, e.y, '#84cc16', 8);
    if(e.hp <= 0) {
      e.state='death'; e.stateTimer=0; e.frameIdx=0; e.frameTick=0;
      // El event de boss derrotado lo dispara enemies.js
      window.dispatchEvent(new CustomEvent('bossDefeated'));
    } else {
      e.state='damage'; e.stateTimer=0; e.frameIdx=0; e.frameTick=0;
      e.vx = -e.vx;
    }
  }

  function isBoss() { return true; }

  // ── Draw ──────────────────────────────────────────────
  function draw(ctx, e, camX, camY) {
    const sx = e.x - camX, sy = e.y - camY;
    if(sx < -W-20 || sx > ctx.canvas.width+W+20) return;

    const stateKey = e.state==='walk'?'walk':e.state;
    const im = _img(`${stateKey}${e.frameIdx}`);

    // Glow de fase — sin shadowBlur (muy costoso en canvas)
    // Usamos un rect translúcido simple en vez de shadow
    if(e.alive) {
      const glowCol = e.phase===3?'rgba(239,68,68,0.18)':e.phase===2?'rgba(234,179,8,0.15)':'rgba(74,222,128,0.12)';
      ctx.save();
      ctx.fillStyle = glowCol;
      ctx.fillRect(sx-8, sy-8, e.w+16, e.h+16);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(sx + e.w/2, sy + e.h/2);
    if(e.facing === 1) ctx.scale(-1, 1);

    if(im) {
      ctx.drawImage(im, -e.w/2, -e.h/2, e.w, e.h);
    } else {
      // Fallback ciempiés canvas
      const col = e.phase===3?'#dc2626':e.phase===2?'#ca8a04':'#16a34a';
      ctx.fillStyle = col;
      // Cuerpo segmentado
      for(let i=0;i<8;i++) {
        const segX = -e.w/2 + i*(e.w/8) + e.w/16;
        ctx.beginPath(); ctx.ellipse(segX,0,e.w/18,e.h/3,0,0,Math.PI*2); ctx.fill();
      }
      // Cabeza
      ctx.fillStyle='#15803d';
      ctx.beginPath(); ctx.ellipse(-e.w/2+20,0,22,e.h/2.5,0,0,Math.PI*2); ctx.fill();
      // Ojos
      ctx.fillStyle='#ef4444';
      ctx.beginPath(); ctx.arc(-e.w/2+14,-10,5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-e.w/2+14, 10,5,0,Math.PI*2); ctx.fill();
    }

    if(e.state==='damage') {
      ctx.globalCompositeOperation='source-atop';
      ctx.fillStyle='rgba(255,255,255,0.50)'; ctx.fillRect(-e.w/2,-e.h/2,e.w,e.h);
    }
    ctx.restore();

    // Barra de HP del boss — grande y con fases de color
    if(e.alive) _drawBossHpBar(ctx, e, camX);
  }

  function _drawBossHpBar(ctx, e, camX) {
    const canvasW = ctx.canvas.width;
    const bw=canvasW*0.7, bx=(canvasW-bw)/2, by=14, bh=14;
    const ratio = Math.max(0, e.hp/e.maxHp);
    const col = e.phase===3?'#ef4444':e.phase===2?'#eab308':'#4ade80';

    ctx.save();
    // Fondo
    ctx.fillStyle='rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.roundRect(bx-2,by-2,bw+4,bh+4,6); ctx.fill();
    // Barra
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.roundRect(bx,by,bw*ratio,bh,4); ctx.fill();
    // Marcas de fase
    ctx.strokeStyle='rgba(255,255,255,0.30)'; ctx.lineWidth=2;
    [0.33,0.66].forEach(p => {
      ctx.beginPath(); ctx.moveTo(bx+bw*p,by); ctx.lineTo(bx+bw*p,by+bh); ctx.stroke();
    });
    // Label
    ctx.font='bold 12px Fredoka,system-ui'; ctx.textAlign='center';
    ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillText(`🐛 Ciempiés — ${e.hp}/${e.maxHp}`, canvasW/2+1, by-2);
    ctx.fillStyle='#fff';
    ctx.fillText(`🐛 Ciempiés — ${e.hp}/${e.maxHp}`, canvasW/2, by-3);
  }

  return { preload, spawn, update, hit, draw, isBoss, H };

})();