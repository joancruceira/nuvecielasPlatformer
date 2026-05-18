// ═══════════════════════════════════════════════════════
//  ARBUSTO.JS — Arbusto Eléctrico (nivel 3)
//  Enemigo estático. No camina. Dispara chispas eléctricas
//  periódicamente. Toca al jugador si se acerca demasiado.
//
//  Estados:  idle → damage → death
//  Sprites:  arbusto_idle0-3, arbusto_damage0-3,
//            arbusto_death0-2
// ═══════════════════════════════════════════════════════

const Arbusto = (() => {

  const W = 56, H = 56;
  const SHOOT_INTERVAL = 2.2;
  const SPARK_SPEED    = 280;
  const TOUCH_RANGE    = 50;

  // ── Sprites ───────────────────────────────────────────
  const imgs = {};
  function _img(k) { const i=imgs[k]; return(i&&i.complete&&i.naturalWidth>0)?i:null; }

  function preload() {
    const B = 'img/level3/';
    function load(anim, count) {
      for(let i=0;i<count;i++) {
        const m=new Image();
        m.src = `${B}arbusto_${anim}${i===0?'0':'0'+i}.png`;
        imgs[`${anim}${i}`]=m;
      }
    }
    load('idle',4); load('damage',4); load('death',3);
  }

  // ── Spawn ─────────────────────────────────────────────
  function spawn(x, y) {
    return {
      type:      'arbusto',
      x, y, w: W, h: H,
      vx: 0, facing: 1,
      hp: 3, maxHp: 3,
      alive: true,
      state: 'idle',
      frameIdx: 0, frameTick: 0, stateTimer: 0,
      shootTimer: Math.random() * SHOOT_INTERVAL,
      sparks: [],   // chispas activas
      onGround: true,
      vy: 0,
    };
  }

  // ── Update ────────────────────────────────────────────
  function update(e, dt, ps) {
    if(!e.alive && e.state !== 'death') return;
    if(e.state === 'death') {
      e.stateTimer += dt;
      _animCycle(e, dt, 3, 0.14);
      if(e.stateTimer > 0.45) e.alive = false;
      return;
    }

    switch(e.state) {

      case 'idle':
        _animCycle(e, dt, 4, 0.18);
        e.shootTimer += dt;
        // Disparar en dirección al jugador
        if(e.shootTimer >= SHOOT_INTERVAL) {
          e.shootTimer = 0;
          _shootSpark(e, ps);
        }
        // Daño por contacto
        if(_touchesPlayer(e, ps)) _enterDamage(e);
        break;

      case 'damage':
        _animCycle(e, dt, 4, 0.09);
        if(e.stateTimer > 0.35) { e.state='idle'; e.stateTimer=0; }
        break;
    }

    // Update chispas
    for(let i=e.sparks.length-1; i>=0; i--) {
      const s = e.sparks[i];
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vy += 180 * dt;   // leve gravedad
      s.life -= dt;
      if(s.life <= 0) { e.sparks.splice(i,1); continue; }
      // Colisión con jugador
      if(_sparkTouchesPlayer(s, ps)) {
        e.sparks.splice(i,1);
        // El daño al jugador lo gestiona enemies.js vía hitPlayer
        s.hitPlayer = true;
      }
    }
  }

  function _shootSpark(e, ps) {
    const dx  = (ps.x+ps.w/2) - (e.x+e.w/2);
    const dy  = (ps.y+ps.h/2) - (e.y+e.h/2);
    const len = Math.hypot(dx, dy) || 1;
    e.sparks.push({
      x: e.x+e.w/2, y: e.y+e.h/2,
      vx: (dx/len)*SPARK_SPEED, vy: (dy/len)*SPARK_SPEED - 60,
      r: 8, life: 1.4,
    });
  }

  function _touchesPlayer(e, ps) {
    return Math.hypot(e.x+e.w/2-(ps.x+ps.w/2), e.y+e.h/2-(ps.y+ps.h/2)) < TOUCH_RANGE;
  }

  function _sparkTouchesPlayer(s, ps) {
    return s.x+s.r > ps.x && s.x-s.r < ps.x+ps.w &&
           s.y+s.r > ps.y && s.y-s.r < ps.y+ps.h;
  }

  function _enterDamage(e) {
    e.state='damage'; e.stateTimer=0; e.frameIdx=0; e.frameTick=0;
  }

  function _animCycle(e, dt, total, speed) {
    e.frameTick += dt;
    if(e.frameTick >= speed) { e.frameTick=0; e.frameIdx=(e.frameIdx+1)%total; }
  }

  // ── Daño ──────────────────────────────────────────────
  function hit(e) {
    if(!e.alive || e.state==='death') return;
    e.hp--;
    if(e.hp <= 0) {
      e.state='death'; e.stateTimer=0; e.frameIdx=0; e.frameTick=0; if(typeof AudioManager!=='undefined') AudioManager.sfx('death_enemy'); e.sparks=[];
    } else {
      _enterDamage(e);
    }
  }

  function isBoss() { return false; }

  // ── Draw ──────────────────────────────────────────────
  function draw(ctx, e, camX, camY) {
    const sx = e.x - camX, sy = e.y - camY;
    if(sx < -W-20 || sx > ctx.canvas.width+20) return;

    // Dibujar chispas
    for(const s of e.sparks) {
      const spx = s.x - camX, spy = s.y - camY;
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.life * 1.5);
      // Halo
      const g = ctx.createRadialGradient(spx,spy,0,spx,spy,s.r*2.5);
      g.addColorStop(0, 'rgba(200,255,80,0.90)');
      g.addColorStop(0.5,'rgba(80,200,255,0.55)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(spx,spy,s.r*2.5,0,Math.PI*2); ctx.fill();
      // Núcleo
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(spx,spy,s.r*0.5,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Sprite del arbusto
    const animKey = e.state === 'idle' ? `idle${e.frameIdx}` : `${e.state}${e.frameIdx}`;
    const im = _img(animKey);

    // Pulso eléctrico en idle — usar stateTimer en lugar de Date.now()
    const pulse = e.state==='idle' ? 0.85 + Math.sin(e.stateTimer*5)*0.15 : 1;

    ctx.save();
    ctx.globalAlpha = pulse;
    if(im) {
      ctx.drawImage(im, sx, sy, e.w, e.h);
    } else {
      ctx.fillStyle = e.state==='death'?'#555':'#15803d';
      ctx.beginPath(); ctx.arc(sx+e.w/2,sy+e.h/2,e.w/2,0,Math.PI*2); ctx.fill();
      // Rayos eléctricos fallback — usar stateTimer
      if(e.state==='idle') {
        ctx.strokeStyle='rgba(200,255,80,0.8)'; ctx.lineWidth=2;
        for(let i=0;i<4;i++) {
          const a=i*Math.PI/2+e.stateTimer*3;
          ctx.beginPath();
          ctx.moveTo(sx+e.w/2,sy+e.h/2);
          ctx.lineTo(sx+e.w/2+Math.cos(a)*20,sy+e.h/2+Math.sin(a)*20);
          ctx.stroke();
        }
      }
    }
    if(e.state==='damage') {
      ctx.globalCompositeOperation='source-atop';
      ctx.fillStyle='rgba(200,255,80,0.60)'; ctx.fillRect(sx,sy,e.w,e.h);
    }
    ctx.restore();

    if(e.alive && e.hp < e.maxHp) _drawHpBar(ctx, sx, sy, e);
  }

  function _drawHpBar(ctx, sx, sy, e) {
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(sx,sy-8,e.w,5);
    ctx.fillStyle='#84cc16'; ctx.fillRect(sx,sy-8,e.w*(e.hp/e.maxHp),5);
  }

  // Expone sparks para que enemies.js chequee colisión con jugador
  function getSparks(e) { return e.sparks || []; }

  return { preload, spawn, update, hit, draw, isBoss, getSparks, H };

})();