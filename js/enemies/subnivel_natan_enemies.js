// ═══════════════════════════════════════════════════════
//  SUBNIVEL_NATAN_ENEMIES.JS — Enemigos del sub-nivel Natan
//  Enemigos aéreos: Avión, Helicóptero
//  Enemigos terrestres: Ladrón, Oficinista, Perrero
//  Todos siguen la misma interfaz:
//  preload(), spawn(x,y), update(e,dt,natan), hit(e), draw(ctx,e,camX,camY)
// ═══════════════════════════════════════════════════════

const SNEnemies = (() => {

  const B = 'img/level3/subnivel/';

  // ── Helper de imagen ─────────────────────────────────
  function mkImg(src) { const m = new Image(); m.src = src; return m; }
  function rdy(i) { return i && i.complete && i.naturalWidth > 0 ? i : null; }

  // ── Animador genérico ─────────────────────────────────
  function anim(e, dt, total, speed) {
    e.ft = (e.ft || 0) + dt;
    if (e.ft >= speed) { e.ft = 0; e.fi = (e.fi + 1) % total; }
  }

  // ══════════════════════════════════════════════════════
  //  AVIÓN DE PAPEL
  // ══════════════════════════════════════════════════════
  const Avion = (() => {
    const imgs = {};
    function preload() {
      ['fly','angry','attack','bounce','hurt','turn','death'].forEach(a => {
        const counts = {fly:14,angry:5,attack:5,bounce:6,hurt:3,turn:7,death:6};
        imgs[a] = [];
        for(let i=0;i<counts[a];i++) imgs[a].push(mkImg(`${B}avion/avion_${a}${i}.png`));
      });
    }

    function spawn(x, y) {
      return {
        type:'avion', x, y, w:80, h:48,
        vx:-160, vy:0, facing:-1,
        hp:2, maxHp:2, alive:true,
        state:'fly', fi:0, ft:0, st:0,
        baseY: y, sinePhase: Math.random()*Math.PI*2,
        attackCooldown:0,
      };
    }

    function update(e, dt, natan) {
      if(!e.alive && e.state!=='death') return;
      e.st += dt;
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);

      if(e.state === 'death') {
        e.vy += 300*dt; e.x += e.vx*0.1*dt; e.y += e.vy*dt;
        anim(e, dt, 6, 0.10);
        if(e.st > 0.65) e.alive = false;
        return;
      }
      if(e.state === 'hurt') {
        anim(e, dt, 3, 0.08);
        if(e.st > 0.28) { e.state='fly'; e.st=0; }
        return;
      }
      if(e.state === 'attack') {
        e.x += e.vx * 2.5 * dt;
        e.y += e.vy * 2.5 * dt;
        anim(e, dt, 5, 0.08);
        if(e.st > 0.35) {
          e.state='fly'; e.st=0; e.attackCooldown=2.2;
          e.baseY = Math.max(60, Math.min(e.y, 320));
          e.sinePhase = 0;
        }
        return;
      }

      // fly
      e.sinePhase += dt * 2.0;
      e.x += e.vx * dt;
      e.y = e.baseY + Math.sin(e.sinePhase) * 30;

      const dx = (natan.x+natan.w/2) - (e.x+e.w/2);
      const dy = (natan.y+natan.h/2) - (e.y+e.h/2);
      const dist = Math.hypot(dx,dy);

      if(dist < 280 && e.attackCooldown <= 0) {
        e.state='attack'; e.st=0; e.fi=0; e.ft=0;
        const len = dist||1;
        e.vx = (dx/len)*200; e.vy = (dy/len)*180;
        e.facing = dx > 0 ? 1 : -1;
      } else {
        if(e.x < -100) { e.vx = 160; e.facing = 1; }
        if(e.x > 2400)  { e.vx = -160; e.facing = -1; }
      }
      anim(e, dt, 14, 0.06);
    }

    function hit(e) {
      if(!e.alive || e.state==='death') return;
      e.hp--;
      if(e.hp<=0) { e.state='death'; e.st=0; e.fi=0; e.ft=0; e.vy=-80;
        if(typeof AudioManager!=='undefined') AudioManager.sfx('death_enemy');
      } else {
        e.state='hurt'; e.st=0; e.fi=0; e.ft=0;
      }
    }

    function draw(ctx, e, camX, camY) {
      const sx = e.x - camX, sy = e.y - camY;
      if(sx < -e.w-20 || sx > ctx.canvas.width+20) return;
      const frames = imgs[e.state] || imgs.fly;
      const im = rdy(frames[e.fi % frames.length]);
      ctx.save();
      ctx.translate(sx + e.w/2, sy + e.h/2);
      if(e.facing === 1) ctx.scale(-1,1);
      if(im) ctx.drawImage(im, -e.w/2, -e.h/2, e.w, e.h);
      else { ctx.fillStyle='#e2e8f0'; ctx.fillRect(-e.w/2,-e.h/2,e.w,e.h); }
      if(e.state==='hurt') {
        ctx.globalCompositeOperation='source-atop';
        ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fillRect(-e.w/2,-e.h/2,e.w,e.h);
      }
      ctx.restore();
    }

    return { preload, spawn, update, hit, draw };
  })();

  // ══════════════════════════════════════════════════════
  //  HELICÓPTERO
  // ══════════════════════════════════════════════════════
  const Helicoptero = (() => {
    const imgs = {};
    function preload() {
      ['fly','attack','hit','search','death'].forEach(a => {
        const counts = {fly:6,attack:6,hit:6,search:7,death:6};
        imgs[a] = [];
        for(let i=0;i<counts[a];i++) imgs[a].push(mkImg(`${B}helicoptero/helicoptero_${a}${i}.png`));
      });
    }

    function spawn(x, y) {
      return {
        type:'helicoptero', x, y, w:110, h:70,
        vx:-90, vy:0, facing:-1,
        hp:4, maxHp:4, alive:true,
        state:'fly', fi:0, ft:0, st:0,
        baseY: y, sinePhase: Math.random()*Math.PI*2,
        attackCooldown:3.0, searchTimer:0,
      };
    }

    function update(e, dt, natan) {
      if(!e.alive && e.state!=='death') return;
      e.st += dt;
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);

      if(e.state==='death') {
        e.vy += 200*dt; e.y += e.vy*dt; e.x += e.vx*0.05*dt;
        anim(e, dt, 6, 0.12);
        if(e.st > 0.8) e.alive = false;
        return;
      }
      if(e.state==='hit') {
        anim(e, dt, 6, 0.08);
        if(e.st > 0.5) { e.state='fly'; e.st=0; }
        return;
      }
      if(e.state==='attack') {
        e.x += e.vx * 1.8 * dt;
        anim(e, dt, 6, 0.09);
        if(e.st > 0.6) { e.state='fly'; e.st=0; e.attackCooldown=3.5; }
        return;
      }
      if(e.state==='search') {
        e.searchTimer += dt;
        anim(e, dt, 7, 0.12);
        if(e.searchTimer > 1.8) { e.state='attack'; e.st=0; e.fi=0; e.ft=0; }
        return;
      }

      // fly
      e.sinePhase += dt * 1.2;
      e.x += e.vx * dt;
      e.y = e.baseY + Math.sin(e.sinePhase) * 20;
      if(e.x < -140) { e.vx=90; e.facing=1; }
      if(e.x > 2400)  { e.vx=-90; e.facing=-1; }

      const dx = (natan.x+natan.w/2) - (e.x+e.w/2);
      const dist = Math.abs(dx);
      if(dist < 320 && e.attackCooldown<=0) {
        e.state='search'; e.st=0; e.searchTimer=0; e.fi=0; e.ft=0;
        e.vx = dx>0 ? 90 : -90; e.facing = dx>0 ? 1 : -1;
      }
      anim(e, dt, 6, 0.10);
    }

    function hit(e) {
      if(!e.alive || e.state==='death') return;
      e.hp--;
      if(e.hp<=0) { e.state='death'; e.st=0; e.fi=0; e.ft=0;
        if(typeof AudioManager!=='undefined') AudioManager.sfx('death_boss');
      } else {
        e.state='hit'; e.st=0; e.fi=0; e.ft=0;
        if(typeof AudioManager!=='undefined') AudioManager.sfx('hit_boss');
      }
    }

    function draw(ctx, e, camX, camY) {
      const sx=e.x-camX, sy=e.y-camY;
      if(sx<-e.w-20||sx>ctx.canvas.width+20) return;
      const frames = imgs[e.state]||imgs.fly;
      const im = rdy(frames[e.fi%frames.length]);
      ctx.save();
      ctx.translate(sx+e.w/2, sy+e.h/2);
      if(e.facing===1) ctx.scale(-1,1);
      if(im) ctx.drawImage(im,-e.w/2,-e.h/2,e.w,e.h);
      else { ctx.fillStyle='#1e293b'; ctx.fillRect(-e.w/2,-e.h/2,e.w,e.h); }
      if(e.state==='hit') {
        ctx.globalCompositeOperation='source-atop';
        ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fillRect(-e.w/2,-e.h/2,e.w,e.h);
      }
      ctx.restore();
      // HP bar para helicóptero (es mini-boss)
      if(e.alive && e.hp<e.maxHp) {
        const bx=sx, by=sy-10, bw=e.w;
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(bx,by,bw,5);
        ctx.fillStyle='#ef4444'; ctx.fillRect(bx,by,bw*(e.hp/e.maxHp),5);
      }
    }

    return { preload, spawn, update, hit, draw };
  })();

  // ══════════════════════════════════════════════════════
  //  ENEMIGO TERRESTRE GENÉRICO (Ladrón, Oficinista, Perrero)
  // ══════════════════════════════════════════════════════
  function makeGroundEnemy(type, folder, prefix, frameCount, opts={}) {
    const imgs = [];
    function preload() {
      for(let i=0;i<frameCount;i++) imgs.push(mkImg(`${B}${folder}/${prefix}${i}.png`));
    }
    function spawn(x, y) {
      return {
        type, x, y,
        w: opts.w||52, h: opts.h||72,
        vx: (Math.random()>0.5?1:-1)*(opts.speed||80),
        vy:0, facing:1,
        hp: opts.hp||2, maxHp: opts.hp||2,
        alive:true, state:'walk',
        fi:0, ft:0, st:0,
        patrolLeft: x - (opts.patrol||160),
        patrolRight: x + (opts.patrol||160),
        onGround:false,
      };
    }
    function update(e, dt, natan) {
      if(!e.alive && e.state!=='death') return;
      e.st += dt;
      if(e.state==='death') {
        anim(e, dt, frameCount, 0.10);
        if(e.st > 0.6) e.alive = false;
        return;
      }
      if(e.state==='hurt') {
        if(e.st > 0.3) { e.state='walk'; e.st=0; }
        return;
      }
      // Gravedad simple
      if(!e.onGround) { e.vy = Math.min(e.vy+600*dt, 500); e.y+=e.vy*dt; }
      // Patrulla
      e.x += e.vx * dt;
      if(e.x <= e.patrolLeft)  { e.vx=Math.abs(e.vx); e.facing=1; }
      if(e.x >= e.patrolRight) { e.vx=-Math.abs(e.vx); e.facing=-1; }
      anim(e, dt, frameCount, 0.10);
    }
    function hit(e) {
      if(!e.alive||e.state==='death') return;
      e.hp--;
      if(e.hp<=0) { e.state='death'; e.st=0; e.fi=0; e.ft=0;
        if(typeof AudioManager!=='undefined') AudioManager.sfx('death_enemy');
      } else {
        e.state='hurt'; e.st=0;
        e.vx=-e.vx;
        if(typeof AudioManager!=='undefined') AudioManager.sfx('death_enemy');
      }
    }
    function draw(ctx, e, camX, camY) {
      const sx=e.x-camX, sy=e.y-camY;
      if(sx<-e.w-20||sx>ctx.canvas.width+20) return;
      const im = rdy(imgs[e.fi%imgs.length]);
      ctx.save();
      ctx.translate(sx+e.w/2, sy+e.h/2);
      if(e.facing===-1) ctx.scale(-1,1);
      if(im) ctx.drawImage(im,-e.w/2,-e.h/2,e.w,e.h);
      else { ctx.fillStyle='#7c3aed'; ctx.fillRect(-e.w/2,-e.h/2,e.w,e.h); }
      if(e.state==='hurt') {
        ctx.globalCompositeOperation='source-atop';
        ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fillRect(-e.w/2,-e.h/2,e.w,e.h);
      }
      ctx.restore();
    }
    return { preload, spawn, update, hit, draw };
  }

  const Ladron    = makeGroundEnemy('ladron',    'ladron',    'ladron',    6, {hp:1, speed:90,  patrol:180});
  const Oficinista= makeGroundEnemy('oficinista','oficinista','oficinista',6, {hp:2, speed:70,  patrol:140});
  const Perrero   = makeGroundEnemy('perrero',   'perrero',  'perrero',   6, {hp:2, speed:100, patrol:200, w:60});

  // ── API pública ───────────────────────────────────────
  function preloadAll() {
    Avion.preload(); Helicoptero.preload();
    Ladron.preload(); Oficinista.preload(); Perrero.preload();
  }

  function spawnByType(type, x, y, zone='tierra') {
    let e;
    switch(type) {
      case 'avion':      e=Avion.spawn(x, y);       break;
      case 'helicoptero':e=Helicoptero.spawn(x, y);  break;
      case 'ladron':     e=Ladron.spawn(x, y);       break;
      case 'oficinista': e=Oficinista.spawn(x, y);   break;
      case 'perrero':    e=Perrero.spawn(x, y);      break;
      default:           return null;
    }
    e.zone = zone;  // 'tierra' o 'vuelo'
    return e;
  }

  function updateEnemy(e, dt, natan) {
    switch(e.type) {
      case 'avion':      Avion.update(e,dt,natan);       break;
      case 'helicoptero':Helicoptero.update(e,dt,natan); break;
      case 'ladron':     Ladron.update(e,dt,natan);      break;
      case 'oficinista': Oficinista.update(e,dt,natan);  break;
      case 'perrero':    Perrero.update(e,dt,natan);     break;
    }
  }

  function hitEnemy(e) {
    switch(e.type) {
      case 'avion':      Avion.hit(e);       break;
      case 'helicoptero':Helicoptero.hit(e); break;
      case 'ladron':     Ladron.hit(e);      break;
      case 'oficinista': Oficinista.hit(e);  break;
      case 'perrero':    Perrero.hit(e);     break;
    }
  }

  // BUG4 FIX: recibe camX directo, sin clonar el objeto enemigo
  function drawEnemy(ctx, e, camX, camY) {
    switch(e.type) {
      case 'avion':      Avion.draw(ctx,e,camX,camY);       break;
      case 'helicoptero':Helicoptero.draw(ctx,e,camX,camY); break;
      case 'ladron':     Ladron.draw(ctx,e,camX,camY);      break;
      case 'oficinista': Oficinista.draw(ctx,e,camX,camY);  break;
      case 'perrero':    Perrero.draw(ctx,e,camX,camY);     break;
    }
  }

  return { preloadAll, spawnByType, updateEnemy, hitEnemy, drawEnemy };

})();