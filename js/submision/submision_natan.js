// ═══════════════════════════════════════════════════════
//  SUBMISION_NATAN.JS — Orquestador SuperNatan
// ═══════════════════════════════════════════════════════

const SubMisionNatan = (() => {
  const C = SubNivelNatanConfig;
  const R = SubNivelNatanRenderer;

  let active=false, onReturn=()=>{}, onGameOver=()=>{};
  let W=800, H=600, camX=0, groundY=0, time=0;
  let phase=C.PHASE.TRANSITION, transitionTimer=0;
  let score=0, flying=false, jumpCount=0, lastJumpTs=0;
  let finalTimer=0, hitstop=0, skyAlpha=0;
  let _hudEl=null;

  // Disparo: solo doble-tap de dirección o botón 🔥 en móvil
  let _lastRightTs=0, _lastLeftTs=0;
  const DOUBLE_TAP_MS=240;

  const keys={left:false,right:false,up:false,down:false};
  const rays=[], enemies=[], particles=[];
  const spawned=new Set();
  let message=null;
  const btnHandlers=new Map();

  // Juguetes: copia local mutable del config
  let toys=[];

  const N={
    x:150,y:120,w:C.PLAYER.w,h:C.PLAYER.h,
    vx:0,vy:0,facing:1,
    hp:C.PLAYER.hp,maxHp:C.PLAYER.hp,
    state:'idle',fi:0,ft:0,st:0,
    invTimer:0,attackCooldown:0,onGround:false,
  };

  // ── API ───────────────────────────────────────────────
  function start(savedState={},callbacks={}){
    // Preload de TODOS los assets (bug fix: faltaba preloadAll)
    SubNivelNatanAssets.preload();
    SNEnemies.preloadAll();

    active=true; onReturn=callbacks.onReturn||(()=>{}); onGameOver=callbacks.onGameOver||(()=>{});
    camX=0; time=0; transitionTimer=0;
    phase=C.PHASE.TRANSITION; score=0;
    flying=false; jumpCount=0; lastJumpTs=0;
    finalTimer=0; hitstop=0; skyAlpha=0; message=null;
    rays.length=enemies.length=particles.length=0;
    spawned.clear();

    // Reset juguetes (copia profunda)
    toys=C.TOYS.map(t=>({...t,collected:false}));

    Object.assign(N,{x:C.PLAYER.startX,y:120,vx:0,vy:0,facing:1,
      hp:C.PLAYER.hp,maxHp:C.PLAYER.hp,state:'idle',fi:0,ft:0,st:0,
      invTimer:0,attackCooldown:0,onGround:false});
    _setupInput();

    // Ocultar HUD del juego principal
    _hudEl=document.getElementById('hud');
    if(_hudEl) _hudEl.style.visibility='hidden';

    _burst(150,300,60,true);
    _showMsg('⚡ SUPER NATAN ⚡','#facc15',1.8);
  }

  function isActive(){ return active; }
  function handleKey(k){ if(k==='Escape') _finish(); }

  // ── Input ─────────────────────────────────────────────
  function _setupInput(){
    document.removeEventListener('keydown',_onKD);
    document.removeEventListener('keyup',  _onKU);
    document.addEventListener('keydown',_onKD);
    document.addEventListener('keyup',  _onKU);
    _bindBtn('mcLeft', ()=>keys.left=true,  ()=>keys.left=false);
    _bindBtn('mcRight',()=>keys.right=true, ()=>keys.right=false);
    _bindBtn('mcDown', ()=>keys.down=true,  ()=>keys.down=false);
    _bindBtn('mcJump', ()=>{keys.up=true;_tryJump();}, ()=>keys.up=false);
    // Botón 🔥 en móvil = disparo directo
    _bindBtn('mcFire', ()=>_tryFire(), ()=>{});
  }
  function _bindBtn(id,down,up){
    const el=document.getElementById(id); if(!el)return;
    if(btnHandlers.has(id)){
      const old=btnHandlers.get(id);
      el.removeEventListener('pointerdown',old.d);
      el.removeEventListener('pointerup',  old.u);
      el.removeEventListener('pointercancel',old.u);
    }
    const hD=e=>{e.preventDefault();down();};
    const hU=e=>{e.preventDefault();up();};
    el.addEventListener('pointerdown',hD,{passive:false});
    el.addEventListener('pointerup',  hU,{passive:false});
    el.addEventListener('pointercancel',hU,{passive:false});
    btnHandlers.set(id,{d:hD,u:hU});
  }
  function _onKD(e){
    if(!active)return;
    if(e.key==='ArrowLeft'||e.key==='a'){
      // e.repeat=true cuando el OS repite la tecla por mantenerla → ignorar para el disparo
      if(!e.repeat){
        const now=performance.now();
        if(now-_lastLeftTs<DOUBLE_TAP_MS){ N.facing=-1; _tryFire(); }
        _lastLeftTs=now;
      }
      keys.left=true;
    }
    if(e.key==='ArrowRight'||e.key==='d'){
      if(!e.repeat){
        const now=performance.now();
        if(now-_lastRightTs<DOUBLE_TAP_MS){ N.facing=1; _tryFire(); }
        _lastRightTs=now;
      }
      keys.right=true;
    }
    if(e.key==='ArrowDown'||e.key==='s') keys.down=true;
    if(e.key==='ArrowUp'  ||e.key==='w'){if(!keys.up)_tryJump();keys.up=true;}
    if(e.key==='z'||e.key==='Z'||e.key===' ') _tryJump();
    if(e.key==='Escape'){
      // Cortar la propagación: si el evento sigue hasta el listener de window
      // del engine, éste ve el subnivel ya cerrado y abre el menú de pausa.
      // Salir del subnivel y quedar en pausa a la vez es desconcertante.
      e.stopPropagation();
      _finish();
    }
  }
  function _onKU(e){
    if(e.key==='ArrowLeft' ||e.key==='a') keys.left=false;
    if(e.key==='ArrowRight'||e.key==='d') keys.right=false;
    if(e.key==='ArrowDown' ||e.key==='s') keys.down=false;
    if(e.key==='ArrowUp'   ||e.key==='w') keys.up=false;
  }

  // ── Update ────────────────────────────────────────────
  function update(dt,ctx,cW,cH){
    if(!active)return;
    W=cW; H=cH;
    groundY=H*C.WORLD.groundPct-N.h;
    if(hitstop>0){hitstop-=dt;_draw(ctx);return;}
    time+=dt;
    _updateMsg(dt); _updateParticles(dt);
    if(phase===C.PHASE.TRANSITION){_updateTransition(dt);_draw(ctx);return;}
    if(phase===C.PHASE.FINAL){
      finalTimer+=dt;
      if(Math.random()<dt*18) _burst(W*(0.3+Math.random()*0.4),H*(0.25+Math.random()*0.35),5,true);
      if(finalTimer>=C.WORLD.finishDelay) _finish();
      _updateCamera(); _draw(ctx); return;
    }
    _updateNatan(dt);
    _updatePhase();
    // skyAlpha: solo en fase VUELO, sube con la altura de Natan (0 en groundY, 1 en top)
    if(phase===C.PHASE.VUELO){
      const heightPct = 1 - (N.y / groundY); // 0 en suelo, 1 arriba del todo
      skyAlpha = Math.min(1, skyAlpha + dt * 0.8); // sube gradual (~1.25s para llegar a 1)
      skyAlpha = Math.max(skyAlpha, Math.min(1, heightPct * 1.5)); // también responde a altura
    } else {
      skyAlpha = 0;
    }
    _spawnByProgress();
    _updateToys();
    _updateRays(dt);
    _updateEnemies(dt);
    _updateCamera();
    _draw(ctx);
  }

  // ── Transición ────────────────────────────────────────
  function _updateTransition(dt){
    transitionTimer+=dt;
    if(Math.random()<dt*25) particles.push({
      x:Math.random()*W,y:Math.random()*H,
      vx:-12+Math.random()*24,vy:-18-Math.random()*35,
      r:2+Math.random()*4,life:0.9+Math.random()*0.7,maxLife:1.6,
      color:['#fff','#fef08a','#93c5fd','#f0abfc'][Math.floor(Math.random()*4)],star:true,
    });
    if(transitionTimer>=C.WORLD.transitionDuration){
      phase=C.PHASE.TIERRA; N.x=C.PLAYER.startX; N.y=groundY;
      N.vx=0;N.vy=0;N.onGround=true;_setNS('idle');
      _showMsg('Barrio Alberdi 🏘️','#38bdf8',1.5);
      _burst(W*0.4,H*0.5,40,true);
    }
  }

  // ── Fases ─────────────────────────────────────────────
  function _updatePhase(){
    if(N.x>=C.WORLD.vetX) _startFinal();
  }
  function _startFinal(){
    if(phase===C.PHASE.FINAL)return;
    phase=C.PHASE.FINAL; flying=false; finalTimer=0;
    enemies.length=0; rays.length=0;
    N.vx=0;N.vy=0;N.onGround=true;_setNS('idle');
    _burst(W*0.5,H*0.42,90,true);
    _showMsg('¡Cleopatra está a salvo! 🐱','#facc15',C.WORLD.finishDelay-0.5);
    if(typeof AudioManager!=='undefined') AudioManager.sfx('giftbox_open');
    if(navigator.vibrate) navigator.vibrate([20,10,20,10,40]);
  }

  // ── Física Natan ─────────────────────────────────────
  function _updateNatan(dt){
    N.st+=dt;
    N.invTimer=Math.max(0,N.invTimer-dt);
    N.attackCooldown=Math.max(0,N.attackCooldown-dt);

    if(N.state==='hurt'){
      N.x+=N.vx*0.25*dt;
      if(!flying){N.vy=Math.min(N.vy+C.PLAYER.gravity*dt,C.PLAYER.maxFall);N.y+=N.vy*dt;_clampG();}
      else N.y=_clamp(N.y+N.vy*dt,22,groundY-8);
      N.x=_clamp(N.x,40,C.WORLD.width-N.w-40);
      _anim(N,dt,3,0.09);
      if(N.st>0.44) _setNS(flying?'fly':'idle');
      return;
    }
    if(N.state==='landing'){
      _anim(N,dt,2,0.10);
      if(N.st>0.22) _setNS('idle');
      return;
    }
    if(N.state==='attack'){
      _anim(N,dt,4,0.09);
      if(N.st>0.36) _setNS(flying?'fly':'idle');
    }

    const movingH=keys.right||keys.left;
    if(keys.right){N.vx=C.PLAYER.speedX;N.facing=1;}
    else if(keys.left){N.vx=-C.PLAYER.speedX*0.80;N.facing=-1;}
    else N.vx*=Math.pow(0.08,dt);

    const maxX=(!flying&&phase===C.PHASE.TIERRA)?C.WORLD.tierraEndX+60:C.WORLD.width-N.w-40;
    N.x=_clamp(N.x+N.vx*dt,40,maxX);

    if(flying){
      if(keys.up)       N.vy=Math.max(N.vy-C.PLAYER.flySpeedY*dt*6,-C.PLAYER.flySpeedY);
      else if(keys.down)N.vy=Math.min(N.vy+C.PLAYER.flySpeedY*dt*6, C.PLAYER.flySpeedY);
      else              N.vy*=Math.pow(0.15,dt);
      N.y=_clamp(N.y+N.vy*dt,22,groundY-8);
      if(N.y>=groundY-8){
        N.y=groundY;N.vy=0;N.onGround=true;jumpCount=0;
        flying=false; _setNS('landing');
      } else if(N.state!=='attack'&&N.state!=='hurt'){
        _anim(N,dt,4,0.12);
      }
    } else {
      N.vy=Math.min(N.vy+C.PLAYER.gravity*dt,C.PLAYER.maxFall);
      N.y+=N.vy*dt; _clampG();
      if(N.vy>=0){
        C.PLATFORMS.forEach(p=>{
          const py=groundY+N.h-H*p.yRel-p.h;
          if(N.x+N.w>p.x&&N.x<p.x+p.w&&N.y+N.h>py&&N.y+N.h<py+p.h+24){
            N.y=py-N.h;N.vy=0;N.onGround=true;jumpCount=0;
          }
        });
      }
      if(N.state!=='attack'&&N.state!=='hurt'&&N.state!=='landing'){
        if(movingH){
          if(N.state!=='run') _setNS('run');
          _anim(N,dt,6,0.10);
        } else {
          N.state='idle'; N.fi=0; N.ft=0;
        }
      }
    }
  }

  function _clampG(){
    if(N.y>=groundY){
      N.y=groundY; N.vy=0;
      if(flying){ flying=false; _setNS('landing'); }
      else if(N.state!=='landing'&&N.state!=='idle'&&N.state!=='run'&&N.state!=='attack') _setNS('idle');
      N.onGround=true; jumpCount=0;
    } else { N.onGround=false; }
  }

  // ── Salto / Vuelo ─────────────────────────────────────
  function _tryJump(){
    if(!active||phase===C.PHASE.TRANSITION||phase===C.PHASE.FINAL||N.state==='hurt')return;
    const now=performance.now();
    if(now-lastJumpTs<80)return;
    lastJumpTs=now;
    if(flying)return;
    if(N.onGround){jumpCount=1;N.vy=C.PLAYER.jumpVy;N.onGround=false;_setNS('run');return;}
    if(jumpCount<2){
      jumpCount=2; flying=true; N.vy=-70; _setNS('fly');
      if(N.x>=C.WORLD.tierraEndX&&phase===C.PHASE.TIERRA){
        phase=C.PHASE.VUELO;
        for(let i=enemies.length-1;i>=0;i--)
          if(enemies[i].zone===C.PHASE.TIERRA) enemies.splice(i,1);
        _showMsg('¡Volando hacia la veterinaria! ✈️','#38bdf8',1.8);
        if(typeof AudioManager!=='undefined') AudioManager.sfx('flag_point');
      } else {
        _showMsg('🦅 ¡Volando!','#38bdf8',1.0);
      }
      _burst(N.x-camX+N.w/2,N.y+N.h/2,30,true);
      if(navigator.vibrate) navigator.vibrate([15,5,25]);
    }
  }

  // ── Disparo (doble-tap dirección o botón 🔥) ──────────
  function _tryFire(){
    if(!active||N.attackCooldown>0||phase===C.PHASE.TRANSITION||phase===C.PHASE.FINAL)return;
    N.attackCooldown=C.PLAYER.fireCooldown; _setNS('attack');
    rays.push({x:N.facing===1?N.x+N.w:N.x,y:N.y+N.h*0.38,vx:N.facing*720,r:12,life:1.05,active:true});
    if(typeof AudioManager!=='undefined') AudioManager.sfx('lunaria_shoot');
    if(navigator.vibrate) navigator.vibrate(10);
  }

  // ── Rayos ─────────────────────────────────────────────
  function _updateRays(dt){
    for(let i=rays.length-1;i>=0;i--){
      const r=rays[i];
      r.life-=dt; r.x+=r.vx*dt;
      if(r.life<=0||r.x<camX-120||r.x>camX+W+120){rays.splice(i,1);continue;}
      for(const e of enemies){
        if(!e.alive||!r.active)continue;
        if(_circleRect(r.x,r.y,r.r,e)){
          r.active=false;
          const wasDead=e.hp<=1;
          SNEnemies.hitEnemy(e);
          const sx=r.x-camX;
          if(wasDead){ _burstEnemy(sx,r.y,e.w); score+=e.score||100; }
          else _burst(sx,r.y,8,false);
          hitstop=0.06; break;
        }
      }
      if(!r.active) rays.splice(i,1);
    }
  }

  function _burstEnemy(sx,sy,size){
    const n=20+Math.floor(size/4);
    const cols=['#f97316','#ef4444','#facc15','#fff','#fde68a'];
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2,s=80+Math.random()*260;
      particles.push({x:sx,y:sy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,
        r:3+Math.random()*6,life:0.6+Math.random()*0.5,maxLife:1.1,
        color:cols[i%cols.length],star:i%3===0});
    }
    if(typeof AudioManager!=='undefined') AudioManager.sfx('death_enemy');
  }

  // ── Juguetes ──────────────────────────────────────────
  function _updateToys(){
    const toyZone= phase===C.PHASE.VUELO?'vuelo':'tierra';
    for(const t of toys){
      if(t.collected) continue;
      if(t.zone!==toyZone&&t.zone!=='tierra') continue;
      // Calcular posición Y del juguete
      const ty = t.onPlatform
        ? groundY+N.h - H*0.60
        : H*t.yPct - 20;
      // Overlap con Natan
      const tx=t.x; const tw=36,th=36;
      if(N.x+N.w>tx&&N.x<tx+tw&&N.y+N.h>ty&&N.y<ty+th){
        t.collected=true; score+=t.score;
        _burst(tx-camX+18,ty,12,true);
        _showMsg(`+${t.score} ${t.icon}`,'#facc15',0.8);
        if(typeof AudioManager!=='undefined') AudioManager.sfx('giftbox_open');
        if(navigator.vibrate) navigator.vibrate(8);
      }
    }
  }

  // ── Spawns ────────────────────────────────────────────
  function _spawnByProgress(){
    if(phase===C.PHASE.TIERRA||phase===C.PHASE.VUELO){
      C.GROUND_SPAWNS.forEach(s=>{
        if(spawned.has(s.id))return;
        if(N.x<s.x-W)return;
        spawned.add(s.id);
        // avion_bajo usa yPct relativo a H
        const spawnY = s.yPct ? H*s.yPct : groundY;
        const e=SNEnemies.spawnByType(s.type,s.x,spawnY,C.PHASE.TIERRA);
        if(e) enemies.push(e);
      });
    }
    if(phase===C.PHASE.VUELO){
      C.AIR_SPAWNS.forEach(s=>{
        if(spawned.has(s.id))return;
        if(N.x<s.x-W)return;
        spawned.add(s.id);
        const e=SNEnemies.spawnByType(s.type,s.x,H*s.yPct,C.PHASE.VUELO);
        if(e) enemies.push(e);
      });
    }
  }

  function _updateEnemies(dt){
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];
      // Los que vuelan siguen existiendo en la fase de vuelo y NO se pegan al
      // suelo. Antes esto se preguntaba con `e.type!=='avion_bajo'`, un tipo
      // que no existe en ningún lado: el tipo real es 'heli_bajo'. Resultado:
      // los helicópteros se clavaban al piso (142 px por debajo de su altura)
      // peleando contra su propia onda senoidal —de ahí el temblor— y además
      // desaparecían justo al empezar a volar.
      if(phase===C.PHASE.VUELO&&e.zone===C.PHASE.TIERRA&&!e.flying){enemies.splice(i,1);continue;}
      if(!e.alive||e.state==='gone'||e.y>H+200){enemies.splice(i,1);continue;}
      SNEnemies.updateEnemy(e,dt,N);
      if(e.zone===C.PHASE.TIERRA&&!e.flying){
        const eg=groundY-(e.h-N.h);
        if(e.y>=eg){e.y=eg;e.vy=0;e.onGround=true;}else e.onGround=false;
      }
      if(e.x<camX-400||e.x>camX+W+800)continue;
      if(N.invTimer>0||!e.alive)continue;
      if(_rectsOverlap(N,e)) _damageNatan(e);
    }
  }

  function _damageNatan(enemy){
    N.hp--; N.invTimer=C.PLAYER.invincibleTime;
    N.vx=enemy.x>N.x?-160:160; N.vy=flying?-60:-140;
    _setNS('hurt');
    _burst(N.x-camX+N.w/2,N.y+N.h/2,16,false);
    if(typeof AudioManager!=='undefined') AudioManager.sfx('hit_boss');
    if(navigator.vibrate) navigator.vibrate([25,8,25]);
    if(N.hp<=0){
      // Sin más vidas → volver al nivel 3 (puerta de la cueva)
      _showMsg('💀 ¡Natan cayó!','#ef4444',1.2);
      setTimeout(()=>_finish(true), 1200);
    }
  }

  // ── Cámara ────────────────────────────────────────────
  function _updateCamera(){
    const target=N.x-W*0.30;
    camX+=(target-camX)*0.10;
    camX=_clamp(camX,0,Math.max(0,C.WORLD.width-W));
  }

  // ── Partículas ────────────────────────────────────────
  function _updateParticles(dt){
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;p.life-=dt;
      if(p.life<=0) particles.splice(i,1);
    }
  }
  function _burst(sx,sy,n,stars){
    const cols=['#facc15','#38bdf8','#fff','#a78bfa','#4ade80','#f472b6'];
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2,s=45+Math.random()*210;
      particles.push({x:sx,y:sy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
        r:2+Math.random()*5,life:0.55+Math.random()*0.7,maxLife:1.25,
        color:cols[i%cols.length],star:!!stars});
    }
  }

  // ── Mensajes ──────────────────────────────────────────
  function _showMsg(text,color,dur){message={text,color,timer:dur,maxTimer:dur,alpha:1};}
  function _updateMsg(dt){
    if(!message)return;
    message.timer-=dt;
    message.alpha=Math.max(0,Math.min(1,message.timer/Math.min(0.4,message.maxTimer)));
    if(message.timer<=0) message=null;
  }

  // ── Draw ──────────────────────────────────────────────
  function _draw(ctx){
    R.draw(ctx,{W,H,camX,groundY,time,phase,flying,score,skyAlpha,
      transitionT:transitionTimer/C.WORLD.transitionDuration,
      natan:N,rays,enemies,particles,message,finalTimer,toys});
  }

  // ── Utils ─────────────────────────────────────────────
  function _setNS(s){N.state=s;N.st=0;N.fi=0;N.ft=0;}
  function _anim(o,dt,tot,spd){o.ft+=dt;if(o.ft>=spd){o.ft=0;o.fi=(o.fi+1)%tot;}}
  function _clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
  function _rectsOverlap(a,b){return a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;}
  function _circleRect(cx,cy,r,rect){
    const x=_clamp(cx,rect.x,rect.x+rect.w),y=_clamp(cy,rect.y,rect.y+rect.h);
    return Math.hypot(cx-x,cy-y)<=r;
  }

  // ── Finalizar ─────────────────────────────────────────
  function _teardown(){
    active=false;
    document.removeEventListener('keydown',_onKD);
    document.removeEventListener('keyup',  _onKU);
    btnHandlers.forEach((h,id)=>{
      const el=document.getElementById(id);if(!el)return;
      el.removeEventListener('pointerdown',  h.d);
      el.removeEventListener('pointerup',    h.u);
      el.removeEventListener('pointercancel',h.u);
    });
    btnHandlers.clear();
    rays.length=enemies.length=particles.length=0;
    Object.keys(keys).forEach(k=>keys[k]=false);
    if(_hudEl) _hudEl.style.visibility='';
    _hudEl=null;
  }

  function _finish(gameOver=false){
    if(!active)return;
    _teardown();
    if(gameOver) onGameOver();
    else onReturn();
  }

  // Cierre forzado sin disparar callbacks: lo usa el Engine al parar o al
  // cargar otro nivel. Sin esto el subnivel quedaba "activo" para siempre y
  // el game loop nunca volvía a llamar a _update() del nivel principal.
  function abort(){ if(active) _teardown(); }

  return {start,isActive,update,handleKey,abort};
})();
