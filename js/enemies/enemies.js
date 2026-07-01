// ═══════════════════════════════════════════════════════
//  ENEMIES.JS — Coordinador: spawn, update, colisiones
//  Delega lógica y render a cada módulo específico
// ═══════════════════════════════════════════════════════

const Enemies = (() => {

  const TILE_SIZE_E = 48;
  let enemies = [];

  const MODULES = {
    walker:    Walker,
    serpiente: Serpiente,
    boss:      Boss,
    fantasma:  Fantasma,
  };

  const TILE_TO_TYPE = {
    [10]: 'walker',
    [11]: 'flyer',
    [12]: 'boss',
    [13]: 'serpiente',
    [14]: 'ghost',
    [20]: 'oruga',
    [21]: 'arbusto',
    [22]: 'murcielago',
    [23]: 'cienpies',
    [32]: 'caballero',
    [33]: 'gargola',
    [34]: 'gota',
    [35]: 'rey_escarcha',
  };

  function preloadAll() {
    Object.values(MODULES).forEach(mod => mod.preload && mod.preload());
  }

  function init() {
    enemies = [];
    if (typeof EnemiesLevel3 !== 'undefined') EnemiesLevel3.preload();
    if (typeof EnemiesLevel4 !== 'undefined') EnemiesLevel4.preload();
    preloadAll();
  }

  function getEnemies() {
    if (typeof EnemiesLevel3 !== 'undefined' && EnemiesLevel3.getEnemies().length > 0)
      return EnemiesLevel3.getEnemies();
    if (typeof EnemiesLevel4 !== 'undefined' && EnemiesLevel4.getEnemies().length > 0)
      return EnemiesLevel4.getEnemies();
    return enemies;
  }

  // ── Spawn ─────────────────────────────────────────────
  function spawnFromMap(map, levelIdx) {
    enemies = [];
    const rows = map.length;
    const cols = map[0].length;

    // Nivel 3 — delegar completamente a EnemiesLevel3
    if (levelIdx === 2 && typeof EnemiesLevel3 !== 'undefined') {
      EnemiesLevel3.spawnFromMap(map, TILE_SIZE_E);
      return;
    }
    // Nivel 4 — delegar completamente a EnemiesLevel4
    if (levelIdx === 3 && typeof EnemiesLevel4 !== 'undefined') {
      EnemiesLevel4.spawnFromMap(map, TILE_SIZE_E);
      return;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = map[r][c];
        const type = TILE_TO_TYPE[tile];
        if (!type) continue;

        const spawnX = c * TILE_SIZE_E;
        const spawnY = r * TILE_SIZE_E;
        let e;
        let actualType = type;
        if (type === 'boss' && levelIdx >= 1) actualType = 'fantasma_boss';
        if (actualType === 'fantasma_boss') {
          e = Fantasma.create(spawnX, spawnY - 4 * TILE_SIZE_E);
        } else if (MODULES[type]) {
          e = MODULES[type].create(spawnX, spawnY);
        } else if (type === 'ghost') {
          e = _createSmallGhost(c, r);
        } else if (type === 'flyer') {
          e = _createFlyer(c, r);
        } else {
          continue;
        }
        enemies.push(e);
        map[r][c] = TILE.AIR;
      }
    }
  }

  function _createFlyer(c, r) {
    const startY = r * TILE_SIZE_E - 36 + TILE_SIZE_E;
    return { type:'flyer', x:c*TILE_SIZE_E, y:startY, w:44, h:36, vx:110, vy:0,
      facing:1, hp:1, maxHp:1, stunTimer:0, attackTimer:0, frozenTimer:0,
      alive:true, startY, flyPhase:Math.random()*Math.PI*2 };
  }

  function _createSmallGhost(col, row) {
    return { type:'ghost', x:col*TILE_SIZE_E, y:row*TILE_SIZE_E, w:34, h:40,
      vx:(Math.random()>0.5?1:-1)*65, vy:0, facing:-1, hp:1, maxHp:1,
      stunTimer:0, frozenTimer:0, attackTimer:0, alive:true,
      floatPhase:Math.random()*Math.PI*2, opacity:0.75, alphaDir:1, isShy:false };
  }

  function _updateSmallGhost(e, dt, map, ps) {
    const cols=map[0].length, rows=map.length, TS=TILE_SIZE_E;
    e.floatPhase += dt*1.5;

    // ¿El jugador mira de frente al fantasma?
    const playerFacingGhost = (ps.facing === 1 && ps.x < e.x) || (ps.facing === -1 && ps.x > e.x);

    if ((e.frozenTimer||0)>0){
      e.frozenTimer-=dt; e.vx*=0.85; e.vy*=0.85; e.isShy=false;
    } else if (e.stunTimer>0) {
      e.stunTimer  -=dt; e.vx*=0.85; e.vy*=0.85; e.isShy=false;
    } else if (playerFacingGhost) {
      // Comportamiento "Boo": tímido, se frena y desvanece
      e.isShy = true;
      e.opacity = Math.max(0.18, (e.opacity || 0.75) - dt * 4);
      e.vx *= 0.82;
      e.vy *= 0.82;
      if (Math.abs(e.vx) < 1) e.vx = 0;
      if (Math.abs(e.vy) < 1) e.vy = 0;
    } else {
      // Persigue o vuela libre si el jugador no lo mira
      e.isShy = false;
      e.opacity = Math.min(0.85, (e.opacity || 0.75) + dt * 3);
      const dx=(ps.x+ps.w/2)-(e.x+e.w/2), dy=(ps.y+ps.h/2)-(e.y+e.h/2), d=Math.hypot(dx,dy);
      if (d<320&&d>8){
        const spd = 95; // 45% más veloz en persecución activa
        e.vx+=(dx/d*spd-e.vx)*3*dt;
        e.vy+=(dy/d*spd-e.vy)*2.5*dt;
      } else {
        e.vx+=(Math.cos(e.floatPhase)*55-e.vx)*2*dt;
        e.vy+=(Math.sin(e.floatPhase*0.7)*30-e.vy)*2*dt;
      }
    }

    e.x+=e.vx*dt; e.y+=e.vy*dt;
    if(e.x<TS)              {e.x=TS;              e.vx= Math.abs(e.vx);}
    if(e.x+e.w>(cols-1)*TS) {e.x=(cols-1)*TS-e.w; e.vx=-Math.abs(e.vx);}
    if(e.y<TS)              {e.y=TS;              e.vy= Math.abs(e.vy);}
    if(e.y+e.h>(rows-3)*TS) {e.y=(rows-3)*TS-e.h; e.vy=-Math.abs(e.vy);}
    e.facing=e.vx>=0?1:-1;
  }

  function _drawSmallGhost(ctx, e, camX, camY, ts) {
    const sx=e.x-camX, sy=e.y-camY, {w,h,stunTimer,frozenTimer}=e;
    const frozen=(frozenTimer||0)>0, bob=Math.sin(e.floatPhase)*5;
    ctx.save();
    ctx.globalAlpha=stunTimer>0||frozen?0.35:(e.opacity||0.75);
    ctx.translate(sx+w/2,sy+h/2+bob);
    ctx.fillStyle=frozen?'#bfdbfe':stunTimer>0?'#aaa':(e.isShy?'#e0e7ff':'#ddd6fe');
    ctx.beginPath();
    ctx.arc(0,-h*0.12,w*0.38,Math.PI,0,false);
    ctx.bezierCurveTo(w*0.38,h*0.14,w*0.25,h*0.38,w*0.14,h*0.40);
    ctx.bezierCurveTo(w*0.05,h*0.36,0,h*0.38,0,h*0.38);
    ctx.bezierCurveTo(-w*0.05,h*0.36,-w*0.14,h*0.42,-w*0.25,h*0.40);
    ctx.bezierCurveTo(-w*0.38,h*0.14,-w*0.38,h*0.14,-w*0.38,-h*0.12);
    ctx.closePath(); ctx.fill();

    // Dibujar manos tapando ojos si es tímido
    ctx.fillStyle=frozen?'#3b82f6':'#312e81';
    if (e.isShy) {
      ctx.strokeStyle=frozen?'#60a5fa':'#4f46e5'; ctx.lineWidth=2.5;
      ctx.beginPath();
      ctx.arc(-w*0.12,-h*0.06,3,0,Math.PI*2);
      ctx.arc( w*0.12,-h*0.06,3,0,Math.PI*2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(-w*0.13,-h*0.14,w*0.07,h*0.08,0,0,Math.PI*2);
      ctx.ellipse( w*0.13,-h*0.14,w*0.07,h*0.08,0,0,Math.PI*2);
      ctx.fill();
    }

    if(frozen){ctx.globalCompositeOperation='source-atop';ctx.fillStyle='rgba(100,180,255,0.45)';ctx.fillRect(-w/2,-h/2,w,h);}
    ctx.restore();
  }

  function _updateFlyer(e, dt, map, ps) {
    e.flyPhase+=dt*1.8; e.x+=e.vx*dt; e.y=e.startY+Math.sin(e.flyPhase)*55;
    const cols=map[0].length;
    if(e.x<0)                    {e.x=0;                    e.vx= Math.abs(e.vx);}
    if(e.x+e.w>cols*TILE_SIZE_E) {e.x=cols*TILE_SIZE_E-e.w; e.vx=-Math.abs(e.vx);}
    const dx=ps.x-e.x, dy=ps.y-e.y, dist=Math.hypot(dx,dy);
    if(dist<280&&dist>20){e.x+=(dx/dist)*110*0.35*dt; e.y+=(dy/dist)*110*0.25*dt;}
    e.facing=e.vx>0?1:-1;
  }

  function _drawFlyer(ctx, e, camX, camY, ts) {
    const x=e.x-camX, y=e.y-camY, {w,h,facing,stunTimer}=e, flutter=Math.sin(ts/120)*5;
    ctx.save(); ctx.globalAlpha=stunTimer>0?0.55:1;
    if(facing===-1){ctx.translate(x+w,y+flutter);ctx.scale(-1,1);}else ctx.translate(x,y+flutter);
    ctx.fillStyle=stunTimer>0?'#888':'#6b21a8';
    ctx.beginPath();ctx.ellipse(w/2,h*0.55,w*0.32,h*0.28,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=stunTimer>0?'#666':'#7c3aed';
    ctx.beginPath();ctx.moveTo(w*0.2,h*0.5);ctx.bezierCurveTo(0,h*0.2,-w*0.3,h*0.8,w*0.2,h*0.65);ctx.fill();
    ctx.beginPath();ctx.moveTo(w*0.8,h*0.5);ctx.bezierCurveTo(w,h*0.2,w*1.3,h*0.8,w*0.8,h*0.65);ctx.fill();
    ctx.fillStyle=stunTimer>0?'#aaa':'#fbbf24';
    ctx.beginPath();ctx.arc(w*0.40,h*0.52,4,0,Math.PI*2);ctx.arc(w*0.60,h*0.52,4,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  // ── Update ────────────────────────────────────────────
  function update(dt, map, ps, onPlayerHit, onBossDefeated) {
    if (!map) return;
    if (typeof EnemiesLevel3 !== 'undefined' && EnemiesLevel3.getEnemies().length > 0) {
      EnemiesLevel3.update(dt, map, ps, onPlayerHit); return;
    }
    if (typeof EnemiesLevel4 !== 'undefined' && EnemiesLevel4.getEnemies().length > 0) {
      EnemiesLevel4.update(dt, map, ps, onPlayerHit); return;
    }
    for (let i=enemies.length-1; i>=0; i--) {
      const e=enemies[i];
      if (!e.alive){enemies.splice(i,1);continue;}
      if      (e.type==='walker')   Walker.update(e,dt,map,ps);
      else if (e.type==='ghost')    _updateSmallGhost(e,dt,map,ps);
      else if (e.type==='flyer')    _updateFlyer(e,dt,map,ps);
      else if (e.type==='boss')     Boss.update(e,dt,map,ps,onBossDefeated);
      else if (e.type==='fantasma') Fantasma.update(e,dt,map,ps,onBossDefeated);
      else if (MODULES[e.type])     MODULES[e.type].update(e,dt,map,ps);
      checkPlayerCollision(e, ps, onPlayerHit);
    }
  }

  function checkPlayerCollision(e, ps, onPlayerHit) {
    if (!e.alive) return;
    const overlapX=(ps.x+ps.w)>(e.x+4)&&ps.x<(e.x+e.w-4);
    const overlapY=(ps.y+ps.h)>e.y&&ps.y<(e.y+e.h);
    if (!overlapX||!overlapY) return;
    const isBossType=e.type==='boss'||e.type==='fantasma';
    const stomping=ps.vy>=0&&(ps.y+ps.h)<(e.y+(isBossType?40:28))&&!ps.wasGrounded;
    const frozen=(e.frozenTimer||0)>0;
    if (stomping||(frozen&&!isBossType)){hitEnemy(e);onPlayerHit&&onPlayerHit('stomp',e);}
    else if (!ps.invincible) onPlayerHit&&onPlayerHit('damage',e);
  }

  // ── Draw ──────────────────────────────────────────────
  function drawAll(ctx, camX, camY, ts) {
    if (typeof EnemiesLevel3 !== 'undefined' && EnemiesLevel3.getEnemies().length > 0) {
      EnemiesLevel3.drawAll(ctx, camX, camY, ts); return;
    }
    if (typeof EnemiesLevel4 !== 'undefined' && EnemiesLevel4.getEnemies().length > 0) {
      EnemiesLevel4.drawAll(ctx, camX, camY); return;
    }
    for (const e of enemies) {
      if      (e.type==='walker')   Walker.draw(ctx,e,camX,camY,ts);
      else if (e.type==='ghost')    _drawSmallGhost(ctx,e,camX,camY,ts);
      else if (e.type==='flyer')    _drawFlyer(ctx,e,camX,camY,ts);
      else if (e.type==='boss')     Boss.draw(ctx,e,camX,camY,ts);
      else if (e.type==='fantasma') Fantasma.draw(ctx,e,camX,camY,ts);
      else if (MODULES[e.type])     MODULES[e.type].draw(ctx,e,camX,camY,ts);
    }
  }

  // ── Hit ───────────────────────────────────────────────
  function hitEnemy(e) {
    if (typeof EnemiesLevel3 !== 'undefined' &&
        ['oruga','arbusto','murcielago','cienpies'].includes(e.type)) {
      EnemiesLevel3.hitEnemy(e); return;
    }
    if (typeof EnemiesLevel4 !== 'undefined' &&
        ['caballero','gargola','gota','rey_escarcha'].includes(e.type)) {
      EnemiesLevel4.hitEnemy(e); return;
    }
    if (!e.alive) return;
    if (e.type==='boss'||e.type==='fantasma') {
      e.hp-=1; e.stunTimer=0.6;
      if(typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss');
      Renderer.spawnParticles(e.x+e.w/2,e.y,'#ef4444',14);
      Renderer.spawnText(e.x+e.w/2,e.y-10,'-1','#ef4444');
      if (e.hp<=0) {
        e.alive=false;
        if(typeof AudioManager !== 'undefined') AudioManager.sfx('death_boss');
        Renderer.spawnParticles(e.x+e.w/2,e.y+e.h/2,'#f9c846',32);
        Renderer.flash('#f9c846',0.6);
        window.dispatchEvent(new CustomEvent('bossDefeated'));
      }
    } else if (MODULES[e.type] && MODULES[e.type].hit) {
      MODULES[e.type].hit(e);
    } else {
      e.alive=false;
      if(typeof AudioManager !== 'undefined') AudioManager.sfx('death_enemy');
      Renderer.spawnParticles(e.x+e.w/2,e.y+e.h/2,'#f9c846',14);
      Renderer.spawnText(e.x+e.w/2,e.y,'+100','#f9c846');
    }
  }

  function stunNearby(cx, cy, radius) {
    if (typeof EnemiesLevel3 !== 'undefined' && EnemiesLevel3.getEnemies().length > 0) {
      EnemiesLevel3.stunNearby(cx,cy,radius); return;
    }
    if (typeof EnemiesLevel4 !== 'undefined' && EnemiesLevel4.getEnemies().length > 0) {
      EnemiesLevel4.stunNearby(cx,cy,radius); return;
    }
    for (const e of enemies) {
      if (!e.alive||e.type==='boss') continue;
      if (Math.hypot(e.x+e.w/2-cx,e.y+e.h/2-cy)<radius) {
        e.stunTimer=2.0; Renderer.spawnParticles(e.x+e.w/2,e.y,'#fbbf24',10);
      }
    }
  }

  function groundPound(cx, cy, radius) {
    let hit=false;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x+e.w/2-cx,e.y+e.h/2-cy)<radius) {
        if (e.type==='boss') {
          e.stunTimer=1.5; e.hp=Math.max(0,e.hp-2);
          Renderer.spawnText(e.x+e.w/2,e.y,'-2 💥','#ef4444');
          if (e.hp<=0&&e.alive){e.alive=false;window.dispatchEvent(new CustomEvent('bossDefeated'));}
        } else hitEnemy(e);
        hit=true;
      }
    }
    return hit;
  }

  function isBossAlive()  {
    if (typeof EnemiesLevel3 !== 'undefined' && EnemiesLevel3.getBoss()) {
      return EnemiesLevel3.getBoss().alive;
    }
    if (typeof EnemiesLevel4 !== 'undefined' && EnemiesLevel4.getBoss()) {
      return EnemiesLevel4.getBoss().alive;
    }
    return enemies.some(e=>(e.type==='boss'||e.type==='fantasma')&&e.alive);
  }
  function getBossEnemy() {
    if (typeof EnemiesLevel3 !== 'undefined' && EnemiesLevel3.getBoss()) {
      return EnemiesLevel3.getBoss();
    }
    if (typeof EnemiesLevel4 !== 'undefined' && EnemiesLevel4.getBoss()) {
      return EnemiesLevel4.getBoss();
    }
    return enemies.find(e=>(e.type==='boss'||e.type==='fantasma')&&e.alive);
  }

  function hitByProjectile(e, kind, color) {
    if (typeof EnemiesLevel4 !== 'undefined' &&
        ['caballero','gargola','gota','rey_escarcha'].includes(e.type)) {
      return EnemiesLevel4.hitByProjectile(e, kind, color);
    }
    return false;
  }

  return {
    init, spawnFromMap, update, drawAll, getEnemies,
    hitEnemy, stunNearby, groundPound,
    isBossAlive, getBossEnemy, hitByProjectile,
  };

})();