// ═══════════════════════════════════════════════════════
//  SUBMISION_ENTITIES.JS — Enemigos, gatitos, pablo, boss
//  Depende de: submision_const.js, submision_physics.js
// ═══════════════════════════════════════════════════════

const SubEntities = (() => {

  // ── ENEMIGOS ──────────────────────────────────────────
  function spawnEnemies() {
    S.enemies = [];
    const { GROUND_ROW, MAP_W, MAP_H, TS } = S;

    for(const [col, ti] of S.ENEMY_SPAWNS){
      if(col >= MAP_W) continue;
      const def = S.ENEMY_DEF[ti % S.ENEMY_DEF.length];

      // Busca suelo SÓLIDO (tile 1 o 5).
      // Plataformas solo si no tienen agua debajo.
      let groundRow = GROUND_ROW;
      for(let r=0; r<MAP_H; r++){
        const t = S.subMap[r][col];
        if(t===1 || t===5){ groundRow=r; break; }
        if(t===3){
          let waterBelow = false;
          for(let rb=r+1; rb<MAP_H; rb++){
            if(S.subMap[rb][col]===4){ waterBelow=true; break; }
          }
          if(!waterBelow){ groundRow=r; break; }
        }
      }

      S.enemies.push({
        ...def,
        x: col*TS, y: groundRow*TS - def.h,  // FIX: usa def.h no ps.h
        w:44, h:68, vx:-def.speed, facing:-1,
        alive:true, stunTimer:0,
        frameIdx:0, frameTick:0,
        patrolLeft:  Math.max(0,         col*TS - 220),
        patrolRight: Math.min(MAP_W*TS,  col*TS + 220),
      });
    }
  }

  function updateEnemies(dt) {
    const ps  = S.ps;
    const cam = S.cam;

    for(const e of S.enemies){
      if(!e.alive) continue;
      if(e.stunTimer > 0){ e.stunTimer-=dt; e.vx*=0.7; e.x+=e.vx*dt; continue; }

      const dx   = (ps.x+ps.w/2) - (e.x+e.w/2);
      const dist = Math.abs(dx);

      if(dist < e.aggroRange && ps.invTimer <= 0){
        const spd = e.speed * (1 + (1 - dist/e.aggroRange) * 0.6);
        e.vx = dx>0 ? spd : -spd;
        e.facing = dx>0 ? 1 : -1;
      } else {
        if     (e.x <= e.patrolLeft)  { e.vx =  e.speed; e.facing =  1; }
        else if(e.x >= e.patrolRight) { e.vx = -e.speed; e.facing = -1; }
        else if(e.vx === 0)           { e.vx = -e.speed; e.facing = -1; }
      }

      e.x = Math.max(e.patrolLeft, Math.min(e.patrolRight, e.x + e.vx*dt));

      e.frameTick += dt;
      if(e.frameTick > 0.15){ e.frameTick=0; e.frameIdx=(e.frameIdx+1)%2; }

      if(ps.invTimer <= 0){
        const ox = (ps.x+ps.w)>e.x && ps.x<(e.x+e.w);
        const oy = (ps.y+ps.h)>e.y && ps.y<(e.y+e.h);
        if(ox && oy) SubPhysics.hurtPlayer(e.x < ps.x ? 1 : -1);
      }
    }
  }

  // ── GATITOS COLECCIONABLES ────────────────────────────
  function spawnKitties() {
    S.kitties = [];
    const { MAP_H, TS, KITTY_COLS } = S;

    for(const col of KITTY_COLS){
      if(col >= S.MAP_W) continue;
      // Solo suelo sólido (tile 1 o 5) — nunca agua ni plataformas
      let gr = -1;
      for(let r=0; r<MAP_H; r++){
        if(S.subMap[r][col]===1 || S.subMap[r][col]===5){ gr=r; break; }
      }
      if(gr < 0) continue; // sin suelo firme → no spawn

      S.kitties.push({
        x: col*TS+6, y: gr*TS-32,
        w:36, h:32,
        collected:false,
        frameIdx:0, frameTick:0,
        walkDir: Math.random()<0.5 ? 1 : -1,
        walkTimer: Math.random()*3,
      });
    }
  }

  function updateKitties(dt) {
    const ps  = S.ps;
    const cam = S.cam;

    for(const k of S.kitties){
      if(k.collected) continue;
      k.walkTimer += dt;
      if(k.walkTimer > 2+Math.random()*2){ k.walkDir*=-1; k.walkTimer=0; }
      k.x += k.walkDir * 22 * dt;
      k.frameTick += dt;
      if(k.frameTick > 0.15){ k.frameTick=0; k.frameIdx=(k.frameIdx+1)%4; }

      const ox = (ps.x+ps.w)>k.x && ps.x<(k.x+k.w);
      const oy = (ps.y+ps.h)>k.y && ps.y<(k.y+k.h);
      if(ox && oy){
        k.collected = true; ps.score += 50;
        Renderer.spawnParticles && Renderer.spawnParticles(k.x-cam.x, k.y-cam.y, '#ffd93d', 12);
        Renderer.spawnText && Renderer.spawnText(k.x-cam.x, k.y-cam.y-20, '+50 🐱', '#ffd93d');
      }
    }
  }

  // ── PABLO ─────────────────────────────────────────────
  function updatePablo(dt) {
    const p = S.pablo;
    p.glowPhase += dt * 2;
    p.frameTick += dt;

    if(!p.freed){
      if(p.frameTick > 0.35){
        p.frameTick = 0;
        p.frameIdx  = (p.frameIdx+1) % S.JAULA_CYCLE.length;
      }
    } else {
      p.freeFrameTick = (p.freeFrameTick||0) + dt;
      if(p.freeFrameTick > 0.12){
        p.freeFrameTick = 0;
        p.freeFrameIdx  = (p.freeFrameIdx+1) % 7;
      }
    }
  }

  // ── GEM ───────────────────────────────────────────────
  function updateGem(dt) {
    S.gem.glowPhase += dt * 2.5;

    if(!S.pablo.freed || S.gem.collected) return;
    const ps  = S.ps;
    const gem = S.gem;
    const cam = S.cam;
    const dx  = (ps.x+ps.w/2) - (gem.x+gem.w/2);
    const dy  = (ps.y+ps.h/2) - (gem.y+gem.h/2);

    if(Math.hypot(dx, dy) < 65){
      gem.collected = true; ps.score += 500;
      Renderer.flash && Renderer.flash('rgba(255,215,0,0.7)', 1.0);
      setTimeout(() => { S.phase='transition_out'; S.transTimer=0; }, 1800);
    }
  }

  // ── BOSS ─────────────────────────────────────────────
  function updateBoss(dt) {
    const boss = S.boss;
    const ps   = S.ps;

    if(!boss.alive || S.pablo.freed) return;

    const dx   = (ps.x+ps.w/2) - (boss.x+boss.w/2);
    const dist = Math.abs(dx);

    // Activación — entra inmediatamente en chase
    if(!boss.activated && dist < 900){
      boss.activated = true;
      boss.state     = 'chase';
      boss.stateTimer = 0;
    }
    if(!boss.activated) return;

    // Stun
    if(boss.stunTimer > 0){
      boss.stunTimer -= dt;
      boss.vx *= 0.80;
      boss.x  += boss.vx * dt;
      _clampBoss();
      return;
    }

    // Fase según HP
    const ratio = boss.hp / boss.maxHp;
    boss.bossPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    const spd = 130 * (1 + (boss.bossPhase-1) * 0.60);

    // Cambio de estado
    boss.stateTimer += dt;
    const dur = boss.bossPhase===3 ? 0.7 : boss.bossPhase===2 ? 1.2 : 1.8;
    if(boss.stateTimer >= dur){
      boss.stateTimer = 0;
      const r = Math.random();
      if     (boss.bossPhase >= 3) boss.state = r<0.70 ? 'charge' : 'chase';
      else if(boss.bossPhase >= 2) boss.state = r<0.55 ? 'charge' : r<0.90 ? 'chase' : 'patrol';
      else                          boss.state = r<0.65 ? 'chase'  : r<0.90 ? 'patrol' : 'charge';
    }

    // Movimiento — nunca queda parado
    if     (boss.state==='patrol') boss.vx = dx>0 ?  spd*0.50 : -spd*0.50;
    else if(boss.state==='chase')  boss.vx = dx>0 ?  spd      : -spd;
    else if(boss.state==='charge') boss.vx = dx>0 ?  spd*2.5  : -spd*2.5;

    boss.x += boss.vx * dt;
    _clampBoss();
    boss.facing = boss.vx >= 0 ? 1 : -1;

    // Animación
    const animSpd = boss.bossPhase===3 ? 0.10 : boss.bossPhase===2 ? 0.16 : 0.22;
    boss.frameTick += dt;
    if(boss.frameTick > animSpd){ boss.frameTick=0; boss.frameIdx=(boss.frameIdx+1)%2; }

    // Colisión con jugador
    if(ps.invTimer <= 0){
      const ox = (ps.x+ps.w)>boss.x && ps.x<(boss.x+boss.w);
      const oy = (ps.y+ps.h)>boss.y && ps.y<(boss.y+boss.h);
      if(ox && oy) SubPhysics.hurtPlayer(boss.x < ps.x ? 1 : -1);
    }
  }

  function _clampBoss() {
    const b = S.boss;
    if(b.x < b.patrolLeft)           { b.x = b.patrolLeft;        b.vx =  Math.abs(b.vx); }
    if(b.x+b.w > b.patrolRight)      { b.x = b.patrolRight-b.w;   b.vx = -Math.abs(b.vx); }
  }

  // ── UPDATE GLOBAL ─────────────────────────────────────
  function updateAll(dt) {
    updateEnemies(dt);
    updateKitties(dt);
    updatePablo(dt);
    updateGem(dt);
    updateBoss(dt);
  }

  // ── RESET ─────────────────────────────────────────────
  function reset() {
    const { TS, GROUND_ROW } = S;

    S.pablo.freed       = false;
    S.pablo.glowPhase   = 0;
    S.pablo.frameIdx    = 0;
    S.pablo.frameTick   = 0;
    S.pablo.freeFrameIdx = 0;
    S.pablo.freeFrameTick = 0;
    S.pablo.x = 192 * TS;
    S.pablo.y = 8   * TS - 72;   // pedestal fila 8

    S.gem.collected  = false;
    S.gem.glowPhase  = 0;
    S.gem.x = 196 * TS;
    S.gem.y = GROUND_ROW * TS - 36;

    S.boss.hp         = 8;
    S.boss.alive      = true;
    S.boss.activated  = false;
    S.boss.x          = 172 * TS;
    S.boss.y          = GROUND_ROW * TS - 96;
    S.boss.vx         = 0;
    S.boss.state      = 'patrol';
    S.boss.stateTimer = 0;
    S.boss.bossPhase  = 1;
    S.boss.stunTimer  = 0;
    S.boss.frameIdx   = 0;
    S.boss.frameTick  = 0;
    S.boss.patrolLeft  = 162 * TS;
    S.boss.patrolRight = 187 * TS;

    spawnEnemies();
    spawnKitties();
  }

  return { spawnEnemies, spawnKitties, updateAll, reset };

})();