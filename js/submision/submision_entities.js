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
        x: col*TS, y: groundRow*TS - def.h,
        w:44, h:68,
        vx:-def.speed, vy:0,        // vy para gravedad
        facing:-1,
        alive:true, stunTimer:0,
        frameIdx:0, frameTick:0,
        onGround:false,
        patrolLeft:  Math.max(0,        col*TS - 220),
        patrolRight: Math.min(MAP_W*TS, col*TS + 220),
      });
    }
  }

  // Gravedad y colisión de suelo para enemigos
  function _applyEnemyGravity(e, dt) {
    const map  = S.subMap;
    const TS   = S.TS;
    const rows = S.MAP_H, cols = S.MAP_W;

    e.vy = Math.min(e.vy + 1200*dt, 800);
    e.y += e.vy * dt;
    e.onGround = false;

    if(e.vy >= 0){
      const rFloor = Math.floor((e.y + e.h) / TS);
      const cL = Math.max(0,      Math.floor((e.x + 4)      / TS));
      const cR = Math.min(cols-1, Math.floor((e.x + e.w - 4)/ TS));
      if(rFloor >= 0 && rFloor < rows){
        for(let c=cL; c<=cR; c++){
          const t = map[rFloor]?.[c];
          if(t===1||t===2||t===3||t===5||t===6){
            e.y = rFloor*TS - e.h;
            e.vy = 0;
            e.onGround = true;
            break;
          }
        }
      }
    }

    // Voltear en borde de plataforma (no caer al vacío)
    if(e.onGround){
      const lookX  = e.vx > 0 ? e.x + e.w + 4 : e.x - 4;
      const cFront = Math.floor(lookX / TS);
      const rFoot  = Math.floor((e.y + e.h + 2) / TS);
      if(cFront >= 0 && cFront < cols && rFoot >= 0 && rFoot < rows){
        const tf = map[rFoot]?.[cFront];
        if(!tf || tf===0 || tf===4){
          e.vx = -e.vx;
          e.patrolLeft  = Math.min(e.x, e.patrolLeft);
          e.patrolRight = Math.max(e.x, e.patrolRight);
        }
      }
    }

    // Límites del mundo
    if(e.y > rows*TS + 100) e.alive = false;
  }

  function updateEnemies(dt) {
    const ps = S.ps;

    for(const e of S.enemies){
      if(!e.alive) continue;
      if(e.stunTimer > 0){ e.stunTimer-=dt; e.vx*=0.7; e.x+=e.vx*dt; _applyEnemyGravity(e,dt); continue; }

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
      _applyEnemyGravity(e, dt);

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
    S.fila = [];   // la fila de rescatados arranca vacía en cada intento
    const { MAP_H, TS, KITTY_COLS } = S;

    for(const col of KITTY_COLS){
      if(col >= S.MAP_W) continue;
      let gr = -1;
      for(let r=0; r<MAP_H; r++){
        if(S.subMap[r][col]===1 || S.subMap[r][col]===5){ gr=r; break; }
      }
      if(gr < 0) continue;

      // FIX: +20% de tamaño (36→44, 32→38)
      S.kitties.push({
        x: col*TS+4, y: gr*TS-38,
        w:44, h:38,
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
        // Ya no desaparece: se suma a la FILA y te sigue. Antes juntar un gatito
        // sólo sumaba puntos y el gatito se esfumaba — justo en el nivel que
        // trata de rescatarlos.
        k.collected = true; ps.score += 50;
        k.orden = S.fila.length;
        S.fila.push(k);
        Renderer.spawnParticles && Renderer.spawnParticles(k.x-cam.x, k.y-cam.y, '#ffd93d', 12);
        Renderer.spawnText && Renderer.spawnText(k.x-cam.x, k.y-cam.y-20, '+50 🐱', '#ffd93d');
      }
    }
    _actualizarFila(dt);
  }

  // ── LA FILA DE GATITOS ────────────────────────────────
  //
  //  Los rescatados caminan atrás tuyo como patitos. Cada uno persigue al de
  //  adelante, no al jugador: así la fila se curva sola en vez de amontonarse,
  //  y al frenar se acordeona en lugar de superponerse.
  //
  //  Sirve para dos cosas además de ser lindo: lo que juntaste SE VE todo el
  //  tiempo sin mirar un número, y el final deja de ser "matá al jefe" para ser
  //  "llegaste con todos".
  function _actualizarFila(dt) {
    const ps = S.ps;
    const SEPARACION = 34;

    for (let i = 0; i < S.fila.length; i++) {
      const g = S.fila[i];
      const delante = i === 0
        ? { x: ps.x + ps.w / 2, y: ps.y + ps.h }
        : { x: S.fila[i-1].x + S.fila[i-1].w / 2, y: S.fila[i-1].y + S.fila[i-1].h };

      const dx = delante.x - (g.x + g.w / 2);
      const dist = Math.abs(dx);

      // Sólo camina si quedó lejos: si no, tiembla en el lugar.
      if (dist > SEPARACION) {
        const paso = Math.min(dist - SEPARACION, 260 * dt);
        g.x += Math.sign(dx) * paso;
        g.walkDir = Math.sign(dx);
        g.frameTick += dt;
        if (g.frameTick > 0.10) { g.frameTick = 0; g.frameIdx = (g.frameIdx + 1) % 4; }
      }

      // Y se apoya en el piso que tenga debajo, para no flotar en los pozos.
      const col = Math.floor((g.x + g.w / 2) / S.TS);
      let fila = -1;
      for (let r = 0; r < S.MAP_H; r++) {
        const tt = S.subMap[r] && S.subMap[r][col];
        if (tt === 1 || tt === 5 || tt === 3) { fila = r; break; }
      }
      const destinoY = fila >= 0 ? fila * S.TS - g.h : delante.y - g.h;
      g.y += (destinoY - g.y) * Math.min(1, dt * 9);
    }
  }

  // ── PABLO ─────────────────────────────────────────────
  // Máquina de estados unificada — una sola variable `p.state`:
  //   'caged'   → enjaulado, esperando que el boss muera
  //   'idle'    → libre, se mueve en la plataforma
  //   'pickup'  → jugador lo toca → sube con estrellitas → desaparece
  //   'gone'    → desapareció, muestra gema

  function updatePablo(dt) {
    const p   = S.pablo;
    const ps  = S.ps;
    const cam = S.cam;
    const TS  = S.TS;

    p.glowPhase += dt * 2;
    p.frameTick += dt;

    // ── Enjaulado ─────────────────────────────────────
    if(p.state === 'caged'){
      if(p.frameTick > 0.35){
        p.frameTick = 0;
        p.frameIdx  = (p.frameIdx+1) % S.JAULA_CYCLE.length;
      }
      return;
    }

    // ── Subiendo con estrellitas ───────────────────────
    if(p.state === 'pickup'){
      p.pickupTimer = (p.pickupTimer||0) + dt;
      p.y -= 60 * dt;
      p.glowPhase += dt * 8;
      if(Math.random() < 0.4){
        const colors = ['#ffd93d','#ff6b9d','#c77dff','#6bcb77'];
        Renderer.spawnParticles && Renderer.spawnParticles(
          p.x - cam.x + p.w/2,
          p.y - cam.y + p.h/2,
          colors[Math.floor(Math.random()*colors.length)], 3);
      }
      if(p.pickupTimer > 0.8){
        p.state = 'gone';
        Renderer.flash && Renderer.flash('rgba(255,215,0,0.6)', 0.6);
        Renderer.spawnText && Renderer.spawnText(
          p.x - cam.x + p.w/2, p.y - cam.y,
          '¡Pablo rescatado! 🐱✨', '#ffd93d');
      }
      return;
    }

    // ── Desapareció ────────────────────────────────────
    if(p.state === 'gone') return;

    // ── Libre: se mueve en la plataforma ──────────────
    // (estado 'idle')
    p.freeFrameTick = (p.freeFrameTick||0) + dt;
    if(p.freeFrameTick > 0.12){
      p.freeFrameTick = 0;
      p.freeFrameIdx  = (p.freeFrameIdx+1) % 7;
    }

    // Camina entre los bordes del pedestal (ver S.COLS.PEDESTAL en el const)
    const platLeft  = S.COLS.PEDESTAL * TS + 4;
    const platRight = (S.COLS.PEDESTAL + 4) * TS - p.w - 4;
    if(!p.freeVx) p.freeVx = 40;

    p.x += p.freeVx * dt;
    if(p.x <= platLeft)  { p.x = platLeft;  p.freeVx =  40; p.freeFacing =  1; }
    if(p.x >= platRight) { p.x = platRight; p.freeVx = -40; p.freeFacing = -1; }

    // Detección de toque para rescatar
    const ox = (ps.x+ps.w)>p.x && ps.x<(p.x+p.w);
    const oy = (ps.y+ps.h)>p.y && ps.y<(p.y+p.h);
    if(ox && oy){
      p.state = 'pickup';
      p.pickupTimer = 0;
      ps.score += 200;
      Renderer.spawnParticles && Renderer.spawnParticles(p.x-cam.x+p.w/2, p.y-cam.y, '#ffd93d', 30);
      Renderer.spawnParticles && Renderer.spawnParticles(p.x-cam.x+p.w/2, p.y-cam.y, '#ff6b9d', 20);
      Renderer.spawnParticles && Renderer.spawnParticles(p.x-cam.x+p.w/2, p.y-cam.y, '#c77dff', 20);
    }
  }

  // ── GEM ───────────────────────────────────────────────
  function updateGem(dt) {
    S.gem.glowPhase += dt * 2.5;

    // La gema aparece solo cuando pablo está en 'gone'
    if(S.pablo.state !== 'gone' || S.gem.collected) return;

    const ps  = S.ps;
    const gem = S.gem;
    const cam = S.cam;
    const dx  = (ps.x+ps.w/2) - (gem.x+gem.w/2);
    const dy  = (ps.y+ps.h/2) - (gem.y+gem.h/2);

    if(Math.hypot(dx, dy) < 65){
      gem.collected = true; ps.score += 500;
      Renderer.flash && Renderer.flash('rgba(255,215,0,0.7)', 1.0);
      Renderer.spawnText && Renderer.spawnText(
        gem.x-cam.x+16, gem.y-cam.y, '+500 💎', '#ffd700');
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

    if(!boss.activated && dist < 900){
      boss.activated = true;
      boss.state     = 'chase';
      boss.stateTimer = 0;
    }
    if(!boss.activated) return;

    if(boss.stunTimer > 0){
      boss.stunTimer -= dt;
      boss.vx *= 0.80;
      boss.x  += boss.vx * dt;
      _clampBoss();
      return;
    }

    const ratio = boss.hp / boss.maxHp;
    boss.bossPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    const spd = 130 * (1 + (boss.bossPhase-1) * 0.60);

    boss.stateTimer += dt;
    const dur = boss.bossPhase===3 ? 0.7 : boss.bossPhase===2 ? 1.2 : 1.8;
    if(boss.stateTimer >= dur && boss.state !== 'windup'){
      boss.stateTimer = 0;
      const r = Math.random();
      if     (boss.bossPhase >= 3) boss.state = r<0.70 ? 'windup' : 'chase';
      else if(boss.bossPhase >= 2) boss.state = r<0.55 ? 'windup' : r<0.90 ? 'chase' : 'patrol';
      // Fase 1: la embestida salía sólo el 10% de las veces y el jefe se leía
      // como pasivo. Con 25% aparece lo bastante como para que aprendas a
      // reconocer el aviso, sin castigar todavía.
      else                          boss.state = r<0.55 ? 'chase'  : r<0.75 ? 'patrol' : 'windup';
    }

    // ── Embestida telegrafiada ────────────────────────
    // Antes 'charge' salía sin aviso: era daño aleatorio, no algo que
    // pudieras leer y esquivar. Ahora frena, se planta y recién ahí carga.
    if(boss.state === 'windup'){
      boss.vx = 0;
      boss.chargeDir = dx > 0 ? 1 : -1;
      boss.facing    = boss.chargeDir;
      if(boss.stateTimer > (boss.bossPhase===3 ? 0.35 : 0.55)){
        boss.state = 'charge'; boss.stateTimer = 0;
        Renderer.spawnText && Renderer.spawnText(
          boss.x - S.cam.x + boss.w/2, boss.y - S.cam.y - 10, '¡!', '#ef4444');
      }
    }
    else if(boss.state==='patrol') boss.vx = dx>0 ?  spd*0.50 : -spd*0.50;
    else if(boss.state==='chase')  boss.vx = dx>0 ?  spd      : -spd;
    else if(boss.state==='charge'){
      // La embestida mantiene su dirección: si te corrés, falla y se pasa
      // de largo. Eso es lo que la vuelve esquivable en lugar de teledirigida.
      boss.vx = boss.chargeDir * spd * 2.6;
      if(boss.stateTimer > 0.9){ boss.state = 'chase'; boss.stateTimer = 0; }
    }

    boss.x += boss.vx * dt;
    _clampBoss();
    boss.facing = boss.vx >= 0 ? 1 : (boss.vx < 0 ? -1 : boss.facing);

    const animSpd = boss.bossPhase===3 ? 0.10 : boss.bossPhase===2 ? 0.16 : 0.22;
    boss.frameTick += dt;
    if(boss.frameTick > animSpd){ boss.frameTick=0; boss.frameIdx=(boss.frameIdx+1)%2; }

    // ── Colisión con jugador ─────────────────────────
    // FIX: cuando toca al jugador, el boss retrocede para
    // no quedarse tildado empujándolo contra la pared.
    const ox = (ps.x+ps.w)>boss.x && ps.x<(boss.x+boss.w);
    const oy = (ps.y+ps.h)>boss.y && ps.y<(boss.y+boss.h);
    if(ox && oy){
      if(ps.invTimer <= 0){
        SubPhysics.hurtPlayer(boss.x < ps.x ? 1 : -1);
      }
      // Rebote del boss — se aleja independientemente del invTimer
      boss.vx = boss.x < ps.x ? -spd*0.8 : spd*0.8;
      boss.x += boss.vx * dt * 8;   // empujón inmediato
      // Cortar SÓLO la embestida, que ya impactó. El wind-up no se toca: si
      // también se abortaba, el jefe no podía telegrafiar nada mientras te
      // tuviera encima —que es la mayor parte de la pelea— y se leía como
      // pasivo. Tampoco se resetea stateTimer: hacerlo en cada frame de
      // contacto lo dejaba encerrado en 'chase' para siempre.
      if(boss.state === 'charge') boss.state = 'chase';
      _clampBoss();
    }
  }

  // Correa, no jaula.
  //
  // Antes esto clavaba al boss entre patrolLeft y patrolRight pasara lo que
  // pasara: bastaba con pararse un paso afuera de esa caja de 544 px para que
  // no pudiera tocarte nunca —y como no tiene ataque a distancia, lo fusilabas
  // gratis desde afuera—. Medido: perseguía hasta el borde y se quedaba
  // oscilando ahí el resto de la pelea.
  //
  // Ahora, mientras persigue o embiste puede salirse de su zona para
  // alcanzarte; sólo la respeta cuando está patrullando.
  const BOSS_CORREA = 420;   // px que puede excederse persiguiendo

  function _clampBoss() {
    const b = S.boss;
    const persiguiendo = b.state === 'chase' || b.state === 'charge' || b.state === 'windup';
    const margen = persiguiendo ? BOSS_CORREA : 0;
    const izq = b.patrolLeft  - margen;
    const der = b.patrolRight + margen;
    if(b.x < izq)       { b.x = izq;       b.vx =  Math.abs(b.vx); }
    if(b.x+b.w > der)   { b.x = der-b.w;   b.vx = -Math.abs(b.vx); }
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

    // Pablo — empieza enjaulado
    const p = S.pablo;
    p.state        = 'caged';
    p.freed        = false;
    p.glowPhase    = 0;
    p.frameIdx     = 0;
    p.frameTick    = 0;
    p.freeFrameIdx  = 0;
    p.freeFrameTick = 0;
    p.freeVx       = 40;
    p.freeFacing   = 1;
    p.pickupTimer  = 0;
    // Centrado en el pedestal
    p.x = S.COLS.PABLO * TS;
    p.y = 8 * TS - 72;

    // Gema — aparece cuando pablo es rescatado
    S.gem.collected = false;
    S.gem.glowPhase = 0;
    S.gem.x = S.COLS.GEMA * TS;
    S.gem.y = GROUND_ROW * TS - 36;

    // Boss — al lado de la jaula, patrulla corta que la defiende
    const b = S.boss;
    b.hp         = 8;
    b.alive      = true;
    b.activated  = false;
    // Parado justo a la izquierda de la jaula
    b.x          = S.COLS.BOSS * TS;
    b.y          = GROUND_ROW * TS - 96;
    b.vx         = 0;
    b.state      = 'patrol';
    b.stateTimer = 0;
    b.bossPhase  = 1;
    b.stunTimer  = 0;
    b.frameIdx   = 0;
    b.frameTick  = 0;
    // Patrulla ajustada: se queda cerca de la jaula
    // No abandona el corralón por la izquierda ni pasa la jaula por la derecha
    b.patrolLeft  = S.COLS.BOSS_IZQ * TS;
    b.patrolRight = S.COLS.BOSS_DER * TS;

    spawnEnemies();
    spawnKitties();
  }

  return { spawnEnemies, spawnKitties, updateAll, reset };

})();