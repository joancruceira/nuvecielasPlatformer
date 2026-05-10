// ═══════════════════════════════════════════════════════
//  SUBMISION_PHYSICS.JS — Física, input, colisión
//  Depende de: submision_const.js
// ═══════════════════════════════════════════════════════

const SubPhysics = (() => {

  let _kd = null, _ku = null;
  let _mobileListeners = [];

  // ── INPUT ─────────────────────────────────────────────
  function bindInput() {
    _kd = e => {
      const i = S.inp;
      if(e.key==='ArrowLeft' ||e.key==='a'||e.key==='A') i.left=true;
      if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') i.right=true;
      if((e.key==='ArrowUp'||e.key==='z'||e.key==='Z'||e.key===' ')&&!i.jump){
        i.jump=true; i.jumpPressed=true;
      }
      if(e.key==='ArrowDown'||e.key==='s'||e.key==='S'){
        i.fire=true; i.firePressed=true;
      }
    };
    _ku = e => {
      const i = S.inp;
      if(e.key==='ArrowLeft' ||e.key==='a'||e.key==='A') i.left=false;
      if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') i.right=false;
      if(e.key==='ArrowUp'||e.key==='z'||e.key==='Z'||e.key===' ')  i.jump=false;
      if(e.key==='ArrowDown'||e.key==='s'||e.key==='S') i.fire=false;
    };
    window.addEventListener('keydown', _kd);
    window.addEventListener('keyup',   _ku);
    _bindMobile();
  }

  function unbindInput() {
    if(_kd) window.removeEventListener('keydown', _kd);
    if(_ku) window.removeEventListener('keyup',   _ku);
    _unbindMobile();
    Object.keys(S.inp).forEach(k => S.inp[k] = false);
  }

  function _bindMobile() {
    _mobileListeners = [];
    function bind(id, onDown, onUp) {
      const btn = document.getElementById(id); if(!btn) return;
      const pd = ev => { ev.preventDefault(); btn.setPointerCapture(ev.pointerId); btn.classList.add('pressed'); onDown(); };
      const pu = ()  => { btn.classList.remove('pressed'); onUp(); };
      const pc = ()  => { btn.classList.remove('pressed'); onUp(); };
      btn.addEventListener('pointerdown',   pd, {passive:false});
      btn.addEventListener('pointerup',     pu, {passive:false});
      btn.addEventListener('pointercancel', pc);
      _mobileListeners.push({btn,pd,pu,pc});
    }
    bind('mcLeft',  ()=>S.inp.left=true,  ()=>S.inp.left=false);
    bind('mcRight', ()=>S.inp.right=true, ()=>S.inp.right=false);
    bind('mcJump',  ()=>{S.inp.jump=true;S.inp.jumpPressed=true;}, ()=>{S.inp.jump=false;});
    bind('mcDown',  ()=>{S.inp.fire=true;S.inp.firePressed=true;}, ()=>S.inp.fire=false);
    bind('mcFire',  ()=>{S.inp.fire=true;S.inp.firePressed=true;}, ()=>S.inp.fire=false);
  }

  function _unbindMobile() {
    for(const {btn,pd,pu,pc} of _mobileListeners){
      btn.removeEventListener('pointerdown',   pd);
      btn.removeEventListener('pointerup',     pu);
      btn.removeEventListener('pointercancel', pc);
      btn.classList.remove('pressed');
    }
    _mobileListeners = [];
  }

  // ── FÍSICA JUGADOR ────────────────────────────────────
  function updatePlayer(dt) {
    const ps = S.ps, inp = S.inp;
    const SPEED=280, JUMP=-580, GRAV=1350;

    if(ps.invTimer > 0) ps.invTimer -= dt;

    if     (inp.left)  { ps.vx = -SPEED; ps.facing = -1; }
    else if(inp.right) { ps.vx =  SPEED; ps.facing =  1; }
    else               ps.vx *= 0.78;

    if(inp.jumpPressed && ps.grounded) {
      ps.vy = JUMP; ps.grounded = false; ps.jumpFrame = 0;
    }
    inp.jumpPressed = false;

    if(inp.firePressed) { _tryShootHeart(); inp.firePressed = false; }

    ps.vy = Math.min(ps.vy + GRAV*dt, 900);
    ps.x += ps.vx * dt;
    ps.y += ps.vy * dt;
    ps.grounded = false;

    resolveCollision();

    if(ps.x < 0) { ps.x = 0; ps.vx = 0; }

    // Animación
    if(!ps.grounded) {
      ps.jumpFrame = ps.vy < -200 ? 1 : ps.vy < 0 ? 2 : 3;
      ps.runFrame = 0; ps.runTick = 0;
    } else if(Math.abs(ps.vx) > 20) {
      ps.runTick += dt;
      if(ps.runTick > 0.11) { ps.runTick = 0; ps.runFrame = (ps.runFrame+1)%6; }
    } else { ps.runFrame = 0; ps.runTick = 0; }

    // Caída al vacío
    if(ps.y > S.MAP_H * S.TS + 60) { hurtPlayer(0); _respawn(); }

    // Guardar checkpoint automático
    _updateCheckpoint();
  }

  // ── CHECKPOINT ───────────────────────────────────────
  // Se guarda la posición x del jugador cada vez que pasa
  // por una zona nueva (cada 30 tiles = ~1440px).
  // El agua y el vacío respawnean al último checkpoint.

  const CHECKPOINT_INTERVAL = 30 * 48; // cada 30 tiles
  let _lastCheckpointX = 2 * 48;       // inicio por defecto

  function _updateCheckpoint() {
    const ps = S.ps;
    if(ps.x - _lastCheckpointX > CHECKPOINT_INTERVAL && ps.grounded){
      _lastCheckpointX = ps.x;
    }
  }

  function _respawn() {
    const ps = S.ps;
    ps.x  = _lastCheckpointX;
    ps.y  = (S.GROUND_ROW - 1) * S.TS;
    ps.vx = 0; ps.vy = 0;
  }

  function resetCheckpoint() {
    _lastCheckpointX = 2 * S.TS;
  }

  function hurtPlayer(dir) {
    const ps = S.ps;
    if(ps.invTimer > 0) return;
    ps.lives    = Math.max(0, ps.lives - 1);
    ps.invTimer = 2.0;
    ps.vx       = dir * 260;
    ps.vy       = -220;
    Renderer.flash && Renderer.flash('#ef4444', 0.40);
    if(ps.lives <= 0) setTimeout(() => { S.phase = 'transition_out'; S.transTimer = 0; }, 1400);
  }

  // ── COLISIÓN ──────────────────────────────────────────
  //
  //  ORDEN ESTRICTO (nunca cambiar):
  //  1. Plataformas (tile 3) — antes que el agua, ventana ajustada
  //  2. Suelo sólido (tiles 1,2,5,6) — anti-sink solo cayendo
  //  3. Agua (tile 4) — hurtPlayer + respawn al checkpoint
  //  4. Colisión horizontal — solo tiles sólidos
  //
  function resolveCollision() {
    const ps   = S.ps;
    const map  = S.subMap;
    const rows = S.MAP_H, cols = S.MAP_W;
    const TS   = S.TS;

    const c0 = Math.max(0,      Math.floor((ps.x+4)      / TS));
    const c1 = Math.min(cols-1, Math.floor((ps.x+ps.w-4) / TS));

    // ── 1. Plataformas (tile 3) ───────────────────────
    // FIX: ventana reducida a ps.h (antes TS) para evitar
    // enganches desde muy arriba. Solo aplica cayendo (vy>=0).
    // FIX: break al resolver → no aplica dos veces por frame.
    outer1:
    for(let c=c0; c<=c1; c++){
      for(let r=0; r<rows; r++){
        if(map[r][c] !== 3) continue;
        const platTop = r * TS;
        const pBot    = ps.y + ps.h;
        if(ps.vy >= 0 && pBot >= platTop - ps.h && pBot <= platTop + 12){
          ps.y = platTop - ps.h; ps.vy = 0; ps.grounded = true;
          break outer1;
        }
      }
    }

    // ── 2. Suelo sólido (tiles 1,2,5,6) ──────────────
    // FIX: anti-sink ahora requiere ps.vy >= 0 para no
    // "chupear" al jugador que salta desde abajo.
    const r0 = Math.max(0,      Math.floor(ps.y        / TS));
    const r1 = Math.min(rows-1, Math.floor((ps.y+ps.h) / TS));

    for(let r=r0; r<=r1; r++){
      for(let c=c0; c<=c1; c++){
        const t = map[r][c];
        if(t!==1 && t!==2 && t!==5 && t!==6) continue;
        const tileTop = r * TS;
        const pBot    = ps.y + ps.h;
        // Caso normal: pie entrando por arriba
        if(ps.vy >= 0 && pBot > tileTop && pBot <= tileTop + ps.h*0.6){
          ps.y = tileTop - ps.h; ps.vy = 0; ps.grounded = true;
        }
        // FIX: anti-sink solo si viene cayendo (vy >= 0)
        // Antes no tenía esta guarda → snappeaba al jugador que saltaba
        if(ps.vy >= 0 && ps.y < tileTop && pBot > tileTop + 4){
          ps.y = tileTop - ps.h; ps.vy = 0; ps.grounded = true;
        }
      }
    }

    // ── 3. Agua (tile 4) ──────────────────────────────
    // FIX: agua = hurtPlayer + respawn al último checkpoint.
    // Antes solo llamaba hurtPlayer y el personaje "caía
    // dentro del agua" con invencibilidad temporal, lo que
    // podía verse como bug (sigue vivo en el agua).
    if(!ps.grounded && ps.invTimer <= 0){
      for(let r=r0; r<=r1; r++){
        for(let c=c0; c<=c1; c++){
          if(map[r][c] === 4){
            hurtPlayer(0);
            _respawn();   // respawn inmediato al checkpoint
            return;
          }
        }
      }
    }

    // ── 4. Colisión horizontal ────────────────────────
    const rT = Math.max(0,      Math.floor((ps.y+4)      / TS));
    const rB = Math.min(rows-1, Math.floor((ps.y+ps.h-8) / TS));

    if(ps.vx > 0){
      const cR = Math.floor((ps.x+ps.w) / TS);
      for(let r=rT; r<=rB; r++){
        const t = cR < cols ? map[r][cR] : 0;
        if(t===1||t===2||t===5||t===6){ ps.x = cR*TS - ps.w; ps.vx = 0; }
      }
    } else if(ps.vx < 0){
      const cL = Math.floor(ps.x / TS);
      for(let r=rT; r<=rB; r++){
        const t = cL >= 0 ? map[r][cL] : 0;
        if(t===1||t===2||t===5||t===6){ ps.x = (cL+1)*TS; ps.vx = 0; }
      }
    }
  }

  // ── CORAZONCITOS ──────────────────────────────────────
  function _tryShootHeart() {
    const ps = S.ps;
    if(ps.heartCooldown > 0) return;
    ps.heartCooldown = 0.45;
    ps.hearts.push({
      x:   ps.x + (ps.facing > 0 ? ps.w : 0),
      y:   ps.y + ps.h * 0.45,
      vx:  ps.facing * 380, vy: 0,
      r:   12, active: true, life: 2.5,
    });
    Renderer.spawnParticles && Renderer.spawnParticles(ps.x+ps.w/2, ps.y, '#ff6b9d', 5);
  }

  function updateHearts(dt) {
    const ps   = S.ps;
    const cam  = S.cam;
    const boss = S.boss;

    if(ps.heartCooldown > 0) ps.heartCooldown -= dt;

    for(let i = ps.hearts.length-1; i >= 0; i--){
      const h = ps.hearts[i];
      if(!h.active){ ps.hearts.splice(i,1); continue; }
      h.life -= dt; if(h.life <= 0){ h.active = false; continue; }
      h.vy += 120*dt; h.x += h.vx*dt; h.y += h.vy*dt;

      // vs enemigos
      for(const e of S.enemies){
        if(!e.alive || !h.active) continue;
        if(h.x>e.x && h.x<e.x+e.w && h.y>e.y && h.y<e.y+e.h){
          h.active = false; e.hp--; e.stunTimer = 0.5;
          Renderer.spawnText && Renderer.spawnText(h.x-cam.x, h.y-cam.y, '💥', '#ff6b9d');
          if(e.hp <= 0){
            e.alive = false; ps.score += e.pts;
            Renderer.spawnText && Renderer.spawnText(e.x-cam.x, e.y-cam.y-20, `+${e.pts}`, '#ffd93d');
          }
          break;
        }
      }

      // vs boss
      if(boss.alive && h.active){
        const ox = h.x>boss.x && h.x<boss.x+boss.w;
        const oy = h.y>boss.y && h.y<boss.y+boss.h;
        if(ox && oy){
          h.active = false; boss.hp--; boss.stunTimer = 0.5;
          Renderer.spawnParticles && Renderer.spawnParticles(h.x-cam.x, h.y-cam.y, '#ff6b9d', 10);
          Renderer.spawnText && Renderer.spawnText(h.x-cam.x, h.y-cam.y, '-1 ❤️', '#ff6b9d');
          if(boss.hp <= 0){
            boss.alive      = false;
            S.pablo.freed   = true;
            S.pablo.state   = 'idle';
            S.pablo.freeVx  = 40;
            S.pablo.freeFacing = 1;
            Renderer.spawnParticles && Renderer.spawnParticles(
              boss.x-cam.x+boss.w/2, boss.y-cam.y, '#ffd93d', 40);
            Renderer.flash && Renderer.flash('rgba(255,215,0,0.6)', 0.8);
          }
        }
      }

      if(h.x < cam.x-100 || h.x > cam.x+2000) h.active = false;
    }
  }

  return { bindInput, unbindInput, updatePlayer, updateHearts, resolveCollision, hurtPlayer, resetCheckpoint };

})();