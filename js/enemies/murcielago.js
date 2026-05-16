// ═══════════════════════════════════════════════════════
//  MURCIELAGO.JS — Murciélago Volador (nivel 3)
//  Enemigo aéreo. Vuela en sine wave. Al acercarse
//  al jugador cambia a modo ataque (dive).
//
//  Estados:  fly → attack → damage → death
//  Sprites:  murcielago_fly0-3, murcielago_attack0-3,
//            murcielago_damage0-3, murcielago_death0-3
// ═══════════════════════════════════════════════════════

const Murcielago = (() => {

  const W = 64, H = 40;
  const FLY_SPEED    = 110;
  const DIVE_SPEED   = 240;
  const AGGRO_RANGE  = 300;
  const SINE_AMP     = 40;    // amplitud del vuelo ondulante
  const SINE_FREQ    = 2.2;   // frecuencia

  // ── Sprites ───────────────────────────────────────────
  const imgs = {};
  function _img(k) { const i=imgs[k]; return(i&&i.complete&&i.naturalWidth>0)?i:null; }

  function preload() {
    const B = 'img/level3/';
    function load(anim, count) {
      for(let i=0;i<count;i++) {
        const m=new Image();
        m.src = `${B}murcielago_${anim}${i===0?'0':'0'+i}.png`;
        imgs[`${anim}${i}`]=m;
      }
    }
    load('fly',4); load('attack',4); load('damage',4); load('death',4);
  }

  // ── Spawn ─────────────────────────────────────────────
  function spawn(x, y, patrolLeft, patrolRight) {
    return {
      type:      'murcielago',
      x, y, w: W, h: H,
      baseY:     y,           // Y base para el sine wave
      sinePhase: Math.random() * Math.PI * 2,
      vx: -FLY_SPEED, facing: -1,
      hp: 2, maxHp: 2,
      alive: true,
      state: 'fly',
      frameIdx: 0, frameTick: 0, stateTimer: 0,
      attackCooldown: 0,
      patrolLeft, patrolRight,
      onGround: false,
      vy: 0,
    };
  }

  // ── Update ────────────────────────────────────────────
  function update(e, dt, ps) {
    if(!e.alive && e.state !== 'death') return;
    if(e.state === 'death') {
      e.stateTimer += dt;
      e.vy = Math.min(e.vy + 600*dt, 400);
      e.y += e.vy * dt;
      _animCycle(e, dt, 4, 0.14);
      if(e.stateTimer > 0.60) e.alive = false;
      return;
    }

    e.stateTimer    += dt;   // ← siempre incrementar
    e.attackCooldown = Math.max(0, e.attackCooldown - dt);

    const dx   = (ps.x+ps.w/2) - (e.x+e.w/2);
    const dy   = (ps.y+ps.h/2) - (e.y+e.h/2);
    const dist = Math.hypot(dx, dy);

    switch(e.state) {

      case 'fly':
        // Patrulla con sine wave
        if(e.x <= e.patrolLeft)  { e.vx =  FLY_SPEED; e.facing =  1; }
        if(e.x >= e.patrolRight) { e.vx = -FLY_SPEED; e.facing = -1; }
        e.x += e.vx * dt;
        // Sine wave suave sobre baseY
        e.sinePhase += dt * SINE_FREQ;
        e.y = e.baseY + Math.sin(e.sinePhase) * SINE_AMP;

        // Atacar si el jugador está cerca y tiene cooldown
        if(dist < AGGRO_RANGE && e.attackCooldown <= 0) {
          e.state = 'attack'; e.stateTimer = 0; e.frameIdx = 0;
          const len = dist || 1;
          e.diveVx = (dx/len) * DIVE_SPEED;
          e.diveVy = (dy/len) * DIVE_SPEED;
        }
        _animCycle(e, dt, 4, 0.12);
        break;

      case 'attack':
        e.x += e.diveVx * dt;
        e.y += e.diveVy * dt;
        e.facing = e.diveVx > 0 ? 1 : -1;
        // Volver a fly después de 0.4s
        if(e.stateTimer > 0.4) {
          e.state = 'fly'; e.stateTimer = 0;
          // Resetear baseY a posición actual clampeada
          e.baseY = Math.max(100, Math.min(e.y, 350));
          // Resetear sinePhase para evitar salto brusco
          e.sinePhase = 0;
          e.attackCooldown = 2.0;
          e.vx = e.facing * FLY_SPEED;
        }
        _animCycle(e, dt, 4, 0.10);
        break;

      case 'damage':
        e.y -= 50 * dt;   // rebote suave hacia arriba
        if(e.stateTimer > 0.3) {
          e.state = 'fly'; e.stateTimer = 0;
          e.baseY = Math.max(100, Math.min(e.y, 350));
          e.sinePhase = 0;
        }
        _animCycle(e, dt, 4, 0.09);
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
    if(e.hp <= 0) {
      e.state='death'; e.stateTimer=0; e.frameIdx=0; e.frameTick=0; e.vy=0;
    } else {
      e.state='damage'; e.stateTimer=0; e.frameIdx=0; e.frameTick=0;
      e.vx = -e.vx;
    }
  }

  function isBoss() { return false; }

  // ── Draw ──────────────────────────────────────────────
  function draw(ctx, e, camX, camY) {
    const sx = e.x - camX, sy = e.y - camY;
    if(sx < -W-20 || sx > ctx.canvas.width+20) return;

    const stateKey = e.state === 'fly' ? 'fly' : e.state;
    const im = _img(`${stateKey}${e.frameIdx}`);

    ctx.save();
    ctx.translate(sx + e.w/2, sy + e.h/2);
    if(e.facing === 1) ctx.scale(-1, 1);

    if(im) {
      ctx.drawImage(im, -e.w/2, -e.h/2, e.w, e.h);
    } else {
      ctx.fillStyle = e.state==='death'?'#555':'#3730a3';
      ctx.beginPath(); ctx.ellipse(0,0,e.w/2,e.h/2,0,0,Math.PI*2); ctx.fill();
      // Ojos rojos fallback
      ctx.fillStyle='#ef4444';
      ctx.beginPath(); ctx.arc(-8,-4,4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc( 8,-4,4,0,Math.PI*2); ctx.fill();
    }

    if(e.state==='damage') {
      ctx.globalCompositeOperation='source-atop';
      ctx.fillStyle='rgba(255,255,255,0.55)';
      ctx.fillRect(-e.w/2,-e.h/2,e.w,e.h);
    }
    ctx.restore();

    if(e.alive && e.hp < e.maxHp) _drawHpBar(ctx, sx, sy, e);
  }

  function _drawHpBar(ctx, sx, sy, e) {
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(sx,sy-8,e.w,5);
    ctx.fillStyle='#818cf8'; ctx.fillRect(sx,sy-8,e.w*(e.hp/e.maxHp),5);
  }

  return { preload, spawn, update, hit, draw, isBoss };

})();