// ═══════════════════════════════════════════════════════
//  ORUGA.JS — Oruga Gata (nivel 3)
//  Enemigo terrestre. Patrulla el suelo, ataca al acercarse.
//
//  Estados:  walk → attack → damage → death
//  Sprites:  oruga_walk0-3, oruga_attack0-3,
//            oruga_damage0-3, oruga_death0-3
// ═══════════════════════════════════════════════════════

const Oruga = (() => {

  const W = 64, H = 48;
  const SPEED       = 80;
  const AGGRO_RANGE = 220;
  const ATTACK_DIST = 70;
  const ATTACK_COOLDOWN = 1.4;

  // ── Sprites ───────────────────────────────────────────
  const imgs = {};
  function _img(k) { const i=imgs[k]; return(i&&i.complete&&i.naturalWidth>0)?i:null; }

  function preload() {
    const B = 'img/level3/';
    // Archivos: oruga_walk0.png, oruga_walk01.png, oruga_walk02.png, oruga_walk03.png
    function load(anim, count) {
      for(let i=0;i<count;i++) {
        const m=new Image();
        m.src = `${B}oruga_${anim}${i===0?'0':'0'+i}.png`;
        imgs[`${anim}${i}`]=m;
      }
    }
    load('walk',4); load('attack',4); load('damage',4); load('death',4);
  }

  // ── Spawn ─────────────────────────────────────────────
  function spawn(x, y, patrolLeft, patrolRight) {
    return {
      type:      'oruga',
      x, y, w: W, h: H,
      vx: -SPEED, facing: -1,
      hp: 2, maxHp: 2,
      alive: true,
      state: 'walk',       // walk | attack | damage | death
      frameIdx: 0,
      frameTick: 0,
      stateTimer: 0,
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
      _animCycle(e, dt, 4, 0.14);
      if(e.stateTimer > 0.60) e.alive = false;
      return;
    }

    e.attackCooldown = Math.max(0, e.attackCooldown - dt);
    e.stateTimer    += dt;

    const dx   = (ps.x+ps.w/2) - (e.x+e.w/2);
    const dist = Math.abs(dx);

    switch(e.state) {

      case 'walk':
        // Patrulla o persigue
        if(dist < AGGRO_RANGE) {
          e.vx = dx > 0 ? SPEED : -SPEED;
          e.facing = dx > 0 ? 1 : -1;
        } else {
          if(e.x <= e.patrolLeft)  { e.vx =  SPEED; e.facing =  1; }
          if(e.x >= e.patrolRight) { e.vx = -SPEED; e.facing = -1; }
        }
        e.x += e.vx * dt;
        e.x  = Math.max(e.patrolLeft, Math.min(e.patrolRight, e.x));

        // Atacar si está cerca y el cooldown expiró
        if(dist < ATTACK_DIST && e.attackCooldown <= 0) _enterAttack(e);
        _animCycle(e, dt, 4, 0.14);
        break;

      case 'attack':
        // Durante el ataque, avanza rápido hacia el jugador
        e.x += (dx > 0 ? 1 : -1) * SPEED * 2.2 * dt;
        if(e.stateTimer > 0.55) { e.state='walk'; e.stateTimer=0; e.attackCooldown=ATTACK_COOLDOWN; }
        _animCycle(e, dt, 4, 0.12);
        break;

      case 'damage':
        e.x += e.vx * dt * 0.3;
        if(e.stateTimer > 0.4) { e.state='walk'; e.stateTimer=0; }
        _animCycle(e, dt, 4, 0.09);
        break;
    }
  }

  function _enterAttack(e) {
    e.state = 'attack'; e.stateTimer = 0; e.frameIdx = 0; e.frameTick = 0;
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
      e.state='death'; e.stateTimer=0; e.frameIdx=0; e.frameTick=0; if(typeof AudioManager!=='undefined') AudioManager.sfx('death_enemy');
    } else {
      e.state='damage'; e.stateTimer=0; e.frameIdx=0; e.frameTick=0;
      e.vx = -e.vx;  // rebote
    }
  }

  function isBoss() { return false; }

  // ── Draw ──────────────────────────────────────────────
  function draw(ctx, e, camX, camY) {
    const sx = e.x - camX, sy = e.y - camY;
    if(sx < -W-20 || sx > ctx.canvas.width+20) return;

    const key = `${e.state === 'walk' ? 'walk' : e.state}${e.frameIdx}`;
    const im  = _img(key);

    ctx.save();
    ctx.translate(sx + e.w/2, sy + e.h/2);
    // El sprite mira hacia la derecha por defecto
    // facing = -1 (izquierda) → mirror, facing = 1 (derecha) → sin flip
    if(e.facing === -1) ctx.scale(-1, 1);

    if(im) {
      ctx.drawImage(im, -e.w/2, -e.h/2, e.w, e.h);
    } else {
      // Fallback
      ctx.fillStyle = e.state==='damage'?'#fff':e.state==='death'?'#888':'#9333ea';
      ctx.beginPath(); ctx.ellipse(0, 0, e.w/2, e.h/2, 0, 0, Math.PI*2); ctx.fill();
    }

    // Flash de daño
    if(e.state === 'damage') {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
    }

    ctx.restore();

    // HP bar
    if(e.alive && e.hp < e.maxHp) _drawHpBar(ctx, sx, sy, e);
  }

  function _drawHpBar(ctx, sx, sy, e) {
    const bw=e.w, bh=5, bx=sx, by=sy-8;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle='#4ade80'; ctx.fillRect(bx,by,bw*(e.hp/e.maxHp),bh);
  }

  return { preload, spawn, update, hit, draw, isBoss, H };

})();