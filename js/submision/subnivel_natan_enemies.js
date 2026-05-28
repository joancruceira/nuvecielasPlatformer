// ═══════════════════════════════════════════════════════
//  SUBNIVEL_NATAN_ENEMIES.JS
//  HeliBajo, Helicóptero, Ladrón, Oficinista, Perrero
//  (Avión removido temporalmente)
// ═══════════════════════════════════════════════════════

const SNEnemies = (() => {

  const B = 'img/level3/subnivel/';
  function mkImg(src){ const m=new Image(); m.src=src; return m; }
  function rdy(i){ return i&&i.complete&&i.naturalWidth>0?i:null; }
  function anim(e,dt,total,speed){
    e.ft=(e.ft||0)+dt;
    if(e.ft>=speed){e.ft=0;e.fi=(e.fi+1)%total;}
  }

  // ── Draw helper: muerte con scale+fade ───────────────
  // facing=1 → sprite mira derecha (sin flip)
  // facing=-1 → sprite mira izquierda (flip horizontal)
  function drawWithDeath(ctx,e,camX,camY,drawFn,deathDur){
    const sx=e.x-camX, sy=e.y-camY;
    if(sx<-e.w-40||sx>ctx.canvas.width+40)return;
    ctx.save();
    if(e.state==='death'){
      const t=Math.min(1,e.st/deathDur);
      ctx.globalAlpha=1-t;
      ctx.translate(sx+e.w/2, sy+e.h/2);
      ctx.scale(1+t*0.5, 1+t*0.5);
      drawFn(ctx,e);
    } else {
      ctx.translate(sx+e.w/2, sy+e.h/2);
      if(e.facing===-1) ctx.scale(-1,1);
      drawFn(ctx,e);
      if(e.state==='hurt'||e.state==='hit'){
        ctx.globalCompositeOperation='source-atop';
        ctx.fillStyle='rgba(255,255,255,0.55)';
        ctx.fillRect(-e.w/2,-e.h/2,e.w,e.h);
      }
    }
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════
  //  HELICÓPTERO BAJO  (patrulla en fase tierra, hp:2)
  //  Facing siempre mira hacia Natan.
  //  El sprite base mira hacia la DERECHA → facing=1 sin flip.
  // ══════════════════════════════════════════════════════
  const HeliBajo = (() => {
    const imgs={};
    function preload(){
      const counts={fly:6,attack:6,hit:6,death:6};
      Object.keys(counts).forEach(a=>{
        imgs[a]=[];
        for(let i=0;i<counts[a];i++)
          imgs[a].push(mkImg(`${B}helicoptero/helicoptero_${a}${i}.png`));
      });
    }
    function spawn(x,y){
      return {type:'heli_bajo',x,y,w:95,h:60,vx:-100,vy:0,facing:-1,
        hp:2,maxHp:2,alive:true,state:'fly',fi:0,ft:0,st:0,
        baseY:y,sinePhase:Math.random()*Math.PI*2,attackCooldown:2.0,score:180,
        zone:'tierra'};
    }
    function update(e,dt,natan){
      if(!e.alive&&e.state!=='death')return;
      e.st+=dt; e.attackCooldown=Math.max(0,e.attackCooldown-dt);
      if(e.state==='death'){
        e.vy+=280*dt; e.y+=e.vy*dt; e.x+=e.vx*0.04*dt;
        anim(e,dt,6,0.11);
        if(e.st>0.7){e.alive=false;e.state='gone';} return;
      }
      if(e.state==='hit'){anim(e,dt,6,0.09);if(e.st>0.4){e.state='fly';e.st=0;}return;}
      if(e.state==='attack'){
        e.x+=e.vx*2.0*dt; e.y+=e.vy*1.5*dt; anim(e,dt,6,0.09);
        if(e.st>0.5){e.state='fly';e.st=0;e.attackCooldown=3.0;e.baseY=Math.max(60,e.y);e.sinePhase=0;}
        return;
      }
      e.sinePhase+=dt*1.4; e.x+=e.vx*dt; e.y=e.baseY+Math.sin(e.sinePhase)*16;
      const dx=(natan.x+natan.w/2)-(e.x+e.w/2), dy=(natan.y+natan.h/2)-(e.y+e.h/2);
      const dist=Math.hypot(dx,dy);
      // Facing siempre hacia Natan
      e.facing=dx>=0?1:-1;
      if(dist<280&&e.attackCooldown<=0){
        e.state='attack';e.st=0;e.fi=0;e.ft=0;
        const len=dist||1; e.vx=(dx/len)*200; e.vy=(dy/len)*130;
      } else {
        if(e.x<50){e.vx=Math.abs(e.vx);} if(e.x>20000){e.vx=-Math.abs(e.vx);}
      }
      anim(e,dt,6,0.11);
    }
    function hit(e){
      if(!e.alive||e.state==='death')return;
      e.hp--;
      if(e.hp<=0){e.state='death';e.st=0;e.fi=0;e.ft=0;}
      else{e.state='hit';e.st=0;e.fi=0;e.ft=0;}
    }
    function draw(ctx,e,camX,camY){
      drawWithDeath(ctx,e,camX,camY,(c,en)=>{
        const frames=imgs[en.state]||imgs.fly;
        const im=rdy(frames[en.fi%frames.length]);
        if(im) c.drawImage(im,-en.w/2,-en.h/2,en.w,en.h);
        else{c.fillStyle='#475569';c.fillRect(-en.w/2,-en.h/2,en.w,en.h);}
      },0.7);
    }
    return {preload,spawn,update,hit,draw};
  })();

  // ══════════════════════════════════════════════════════
  //  HELICÓPTERO NORMAL (fase vuelo, hp:4, más agresivo)
  //  Facing hacia Natan. Sprite base mira derecha.
  // ══════════════════════════════════════════════════════
  const Helicoptero = (() => {
    const imgs={};
    function preload(){
      const counts={fly:6,attack:6,hit:6,search:7,death:6};
      Object.keys(counts).forEach(a=>{
        imgs[a]=[];
        for(let i=0;i<counts[a];i++)
          imgs[a].push(mkImg(`${B}helicoptero/helicoptero_${a}${i}.png`));
      });
    }
    function spawn(x,y){
      return {type:'helicoptero',x,y,w:110,h:70,vx:-90,vy:0,facing:-1,
        hp:4,maxHp:4,alive:true,state:'fly',fi:0,ft:0,st:0,
        baseY:y,sinePhase:Math.random()*Math.PI*2,attackCooldown:3.0,searchTimer:0,score:300};
    }
    function update(e,dt,natan){
      if(!e.alive&&e.state!=='death')return;
      e.st+=dt; e.attackCooldown=Math.max(0,e.attackCooldown-dt);
      if(e.state==='death'){
        e.vy+=200*dt; e.y+=e.vy*dt; e.x+=e.vx*0.04*dt;
        anim(e,dt,6,0.12);
        if(e.st>0.85){e.alive=false;e.state='gone';} return;
      }
      if(e.state==='hit'){anim(e,dt,6,0.08);if(e.st>0.5){e.state='fly';e.st=0;}return;}
      if(e.state==='attack'){
        e.x+=e.vx*1.8*dt; e.y+=e.vy*1.4*dt; anim(e,dt,6,0.09);
        if(e.st>0.6){e.state='fly';e.st=0;e.attackCooldown=3.5;}
        return;
      }
      if(e.state==='search'){
        e.searchTimer+=dt; anim(e,dt,7,0.12);
        if(e.searchTimer>1.8){
          e.state='attack';e.st=0;e.fi=0;e.ft=0;
          const dx=(natan.x+natan.w/2)-(e.x+e.w/2), dy=(natan.y+natan.h/2)-(e.y+e.h/2);
          const len=Math.hypot(dx,dy)||1;
          e.vx=(dx/len)*180; e.vy=(dy/len)*140;
        } return;
      }
      e.sinePhase+=dt*1.2; e.x+=e.vx*dt; e.y=e.baseY+Math.sin(e.sinePhase)*20;
      // Facing hacia Natan
      const dx=(natan.x+natan.w/2)-(e.x+e.w/2);
      e.facing=dx>=0?1:-1;
      if(e.x<-140){e.vx=90;} if(e.x>20000){e.vx=-90;}
      const dist=Math.abs(dx);
      if(dist<320&&e.attackCooldown<=0){
        e.state='search';e.st=0;e.searchTimer=0;e.fi=0;e.ft=0;
      }
      anim(e,dt,6,0.10);
    }
    function hit(e){
      if(!e.alive||e.state==='death')return;
      e.hp--;
      if(e.hp<=0){e.state='death';e.st=0;e.fi=0;e.ft=0;}
      else{e.state='hit';e.st=0;e.fi=0;e.ft=0;}
    }
    function draw(ctx,e,camX,camY){
      const sx=e.x-camX, sy=e.y-camY;
      drawWithDeath(ctx,e,camX,camY,(c,en)=>{
        const frames=imgs[en.state]||imgs.fly;
        const im=rdy(frames[en.fi%frames.length]);
        if(im) c.drawImage(im,-en.w/2,-en.h/2,en.w,en.h);
        else{c.fillStyle='#1e293b';c.fillRect(-en.w/2,-en.h/2,en.w,en.h);}
      },0.85);
      // Barra de HP
      if(e.alive&&e.hp<e.maxHp){
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(sx,sy-12,e.w,5);
        ctx.fillStyle='#ef4444'; ctx.fillRect(sx,sy-12,e.w*(e.hp/e.maxHp),5);
      }
    }
    return {preload,spawn,update,hit,draw};
  })();

  // ══════════════════════════════════════════════════════
  //  ENEMIGOS TERRESTRES GENÉRICOS
  // ══════════════════════════════════════════════════════
  function makeGroundEnemy(type,folder,prefix,frameCount,opts={}){
    const imgs=[];
    function preload(){
      for(let i=0;i<frameCount;i++)
        imgs.push(mkImg(`${B}${folder}/${prefix}${i}.png`));
    }
    function spawn(x,y){
      const dir=Math.random()>0.5?1:-1;
      return {
        type,x,y,w:opts.w||52,h:opts.h||72,
        vx:dir*(opts.speed||80), vy:0, facing:dir,
        hp:opts.hp||2, maxHp:opts.hp||2,
        alive:true, state:'walk', fi:0, ft:0, st:0,
        patrolLeft:x-(opts.patrol||160), patrolRight:x+(opts.patrol||160),
        onGround:false, score:opts.score||80,
      };
    }
    function update(e,dt,natan){
      if(!e.alive&&e.state!=='death')return;
      e.st+=dt;
      if(e.state==='death'){anim(e,dt,frameCount,0.10);if(e.st>0.6){e.alive=false;e.state='gone';}return;}
      if(e.state==='hurt'){if(e.st>0.3){e.state='walk';e.st=0;}return;}
      if(!e.onGround){e.vy=Math.min(e.vy+600*dt,500);e.y+=e.vy*dt;}
      e.x+=e.vx*dt;
      if(e.x<=e.patrolLeft){e.vx=Math.abs(e.vx);e.facing=1;}
      if(e.x>=e.patrolRight){e.vx=-Math.abs(e.vx);e.facing=-1;}
      anim(e,dt,frameCount,0.10);
    }
    function hit(e){
      if(!e.alive||e.state==='death')return;
      e.hp--;
      if(e.hp<=0){e.state='death';e.st=0;e.fi=0;e.ft=0;}
      else{e.state='hurt';e.st=0;e.vx=-e.vx;e.facing=-e.facing;}
    }
    function draw(ctx,e,camX,camY){
      drawWithDeath(ctx,e,camX,camY,(c,en)=>{
        const im=rdy(imgs[en.fi%imgs.length]);
        if(im) c.drawImage(im,-en.w/2,-en.h/2,en.w,en.h);
        else{c.fillStyle='#7c3aed';c.fillRect(-en.w/2,-en.h/2,en.w,en.h);}
      },0.6);
    }
    return {preload,spawn,update,hit,draw};
  }

  const Ladron    =makeGroundEnemy('ladron',    'ladron',    'ladron',    6,{hp:1,speed:90, patrol:200,score:80 });
  const Oficinista=makeGroundEnemy('oficinista','oficinista','oficinista',6,{hp:2,speed:70, patrol:150,score:120});
  const Perrero   =makeGroundEnemy('perrero',   'perrero',  'perrero',   6,{hp:2,speed:110,patrol:220,score:120,w:60});

  // ── API pública ───────────────────────────────────────
  function preloadAll(){
    HeliBajo.preload(); Helicoptero.preload();
    Ladron.preload(); Oficinista.preload(); Perrero.preload();
  }

  function spawnByType(type,x,y,zone='tierra'){
    let e;
    switch(type){
      case 'heli_bajo':  e=HeliBajo.spawn(x,y);   break;
      case 'helicoptero':e=Helicoptero.spawn(x,y); break;
      case 'ladron':     e=Ladron.spawn(x,y);      break;
      case 'oficinista': e=Oficinista.spawn(x,y);  break;
      case 'perrero':    e=Perrero.spawn(x,y);     break;
      default: return null;
    }
    e.zone=zone; return e;
  }

  function updateEnemy(e,dt,natan){
    switch(e.type){
      case 'heli_bajo':  HeliBajo.update(e,dt,natan);   break;
      case 'helicoptero':Helicoptero.update(e,dt,natan); break;
      case 'ladron':     Ladron.update(e,dt,natan);      break;
      case 'oficinista': Oficinista.update(e,dt,natan);  break;
      case 'perrero':    Perrero.update(e,dt,natan);     break;
    }
  }

  function hitEnemy(e){
    switch(e.type){
      case 'heli_bajo':  HeliBajo.hit(e);   break;
      case 'helicoptero':Helicoptero.hit(e); break;
      case 'ladron':     Ladron.hit(e);      break;
      case 'oficinista': Oficinista.hit(e);  break;
      case 'perrero':    Perrero.hit(e);     break;
    }
  }

  function drawEnemy(ctx,e,camX,camY){
    switch(e.type){
      case 'heli_bajo':  HeliBajo.draw(ctx,e,camX,camY);   break;
      case 'helicoptero':Helicoptero.draw(ctx,e,camX,camY); break;
      case 'ladron':     Ladron.draw(ctx,e,camX,camY);      break;
      case 'oficinista': Oficinista.draw(ctx,e,camX,camY);  break;
      case 'perrero':    Perrero.draw(ctx,e,camX,camY);     break;
    }
  }

  return {preloadAll,spawnByType,updateEnemy,hitEnemy,drawEnemy};
})();
