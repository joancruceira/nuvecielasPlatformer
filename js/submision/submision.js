// ═══════════════════════════════════════════════════════
//  SUBMISION.JS — Coordinador principal (game loop + API)
//  Depende de (en este orden en index.html):
//    submision_const.js
//    submision_map.js
//    submision_physics.js
//    submision_entities.js
//    submision_render.js
//    submision.js       ← este archivo
// ═══════════════════════════════════════════════════════

const SubMision = (() => {

  // Referencia al canvas y listener de tap para la pantalla de selección
  let _canvas     = null;
  let _tapHandler = null;

  // Registra las zonas de botones para hit-test (se calculan en cada drawSelect)
  const _btnZones = {};  // { nina: {x,y,w,h}, jazmin: {x,y,w,h} }

  // Expone las zonas para que drawSelect las pueda registrar
  function _registerBtnZone(id, x, y, w, h) {
    _btnZones[id] = { x, y, w, h };
  }

  function _bindCanvasTap() {
    _canvas = document.getElementById('gameCanvas');
    if(!_canvas) return;

    _tapHandler = (ev) => {
      if(S.phase !== 'select') return;
      ev.preventDefault();

      // Pasar el toque a UNIDADES DE MUNDO, que es donde drawSelect registró
      // las zonas de los botones. Antes se escalaba por canvas.width/rect.width,
      // que ahora incluye la densidad de píxeles y daba coordenadas al doble.
      const rect = _canvas.getBoundingClientRect();
      const { W, H } = Renderer.getSize();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const cx = (clientX - rect.left) / rect.width  * W;
      const cy = (clientY - rect.top)  / rect.height * H;

      for(const [id, z] of Object.entries(_btnZones)){
        if(cx >= z.x && cx <= z.x+z.w && cy >= z.y && cy <= z.y+z.h){
          _confirmChar(id);
          return;
        }
      }
    };

    _canvas.addEventListener('pointerdown', _tapHandler, { passive: false });
  }

  function _unbindCanvasTap() {
    if(_canvas && _tapHandler){
      _canvas.removeEventListener('pointerdown', _tapHandler);
      _tapHandler = null;
    }
  }

  // ── GAME LOOP ──────────────────────────────────────────
  function _updatePlaying(dt, ctx, W, H) {
    S.gameTime += dt;

    SubPhysics.updatePlayer(dt);
    SubPhysics.updateHearts(dt);
    SubEntities.updateAll(dt);

    // Cámara — scroll horizontal suave
    S.cam.x = Math.max(0, Math.min(
      S.ps.x - W * 0.38,
      S.MAP_W * S.TS - W
    ));

    SubRender.drawFrame(ctx, W, H);
  }

  // ── TRANSICIONES ──────────────────────────────────────
  function _updateTransIn(dt, ctx, W, H) {
    S.transTimer += dt;
    SubRender.drawRainbow(ctx, W, H, S.transTimer);
    SubRender.drawSpiral(ctx, W, H, S.transTimer);
    if(S.transTimer > 0.3){
      const fade = Math.min(1, (S.transTimer-0.3)/0.4);
      ctx.save(); ctx.globalAlpha=fade;
      ctx.font='bold 26px Fredoka,system-ui'; ctx.textAlign='center';
      ctx.fillStyle='#fff'; ctx.shadowColor='#000'; ctx.shadowBlur=10;
      ctx.fillText('✨ Viajando a La Tierra... ✨', W/2, H/2);
      ctx.restore();
    }
    if(S.transTimer >= 1.0) S.phase = 'select';
  }

  function _updateTransOut(dt, ctx, W, H) {
    S.transTimer += dt;
    SubRender.drawRainbow(ctx, W, H, S.transTimer);
    SubRender.drawSpiral(ctx, W, H, S.transTimer);
    if(S.transTimer > 0.2){
      const fade = Math.min(1, (S.transTimer-0.2)/0.5);
      ctx.save(); ctx.globalAlpha=fade;
      ctx.font='bold 26px Fredoka,system-ui'; ctx.textAlign='center';
      ctx.fillStyle='#ffd93d'; ctx.shadowColor='#000'; ctx.shadowBlur=12;
      ctx.fillText('✨ Regresando a Manolandia... ✨', W/2, H/2);
      ctx.restore();
    }
    if(S.transTimer >= 1.0){
      stop();
      // Premio por completar la misión — restaurar vidas del personaje de Manolandia.
      // Funciona siempre, independientemente de cómo se llamó a start().
      try {
        const ps = Player.getState();
        if(ps) ps.lives = 5;
        UI && UI.updateHUD && UI.updateHUD();
      } catch(e) {}
      S.onComplete && S.onComplete.onReturn && S.onComplete.onReturn();
    }
  }

  // ── SELECCIÓN DE PERSONAJE ────────────────────────────
  function _confirmChar(id) {
    S.selectedChar = id;
    S.phase = 'playing';
    S.ps.x = 2  * S.TS;
    S.ps.y = (S.GROUND_ROW - 1) * S.TS;
    S.ps.vx = 0; S.ps.vy = 0;
  }

  // ── API PÚBLICA ────────────────────────────────────────
  function start(savedState, callbacks) {
    S.onComplete = callbacks;

    // Carga sprites y construye el mapa
    SubMap.preload();
    SubMap.build();

    // Reset jugador
    const ps = S.ps;
    ps.x=2*S.TS; ps.y=(S.GROUND_ROW-1)*S.TS;
    ps.vx=0; ps.vy=0; ps.grounded=false;
    ps.lives=5; ps.invTimer=0;
    ps.runFrame=0; ps.jumpFrame=0;
    ps.score=0; ps.hearts=[]; ps.heartCooldown=0;

    // Reset entidades
    SubEntities.reset();

    // Reset cámara y tiempo
    S.cam.x=0; S.cam.y=0;
    S.gameTime=0;

    // Arrancar
    S.phase      = 'transition_in';
    S.transTimer = 0;
    S.selectedChar = null;

    SubPhysics.bindInput();
    SubPhysics.resetCheckpoint();
    _bindCanvasTap();    // touch para selección de personaje en móvil

    const hud = document.getElementById('hud');
    if(hud) hud.style.display = 'none';
  }

  function stop() {
    S.phase = 'idle';
    SubPhysics.unbindInput();
    _unbindCanvasTap();
    const hud = document.getElementById('hud');
    if(hud) hud.style.display = '';
  }

  function isActive() { return S.phase !== 'idle'; }

  // Llamado por el engine en cada frame: SubMision.update(dt, ctx, W, H)
  function update(dt, ctx, W, H) {
    if(S.phase === 'idle') return;
    const sW = W || ctx.canvas.width  || 800;
    const sH = H || ctx.canvas.height || 600;

    if     (S.phase === 'transition_in')  _updateTransIn(dt,  ctx, sW, sH);
    else if(S.phase === 'select')         SubRender.drawSelect(ctx, sW, sH);
    else if(S.phase === 'playing')        _updatePlaying(dt,   ctx, sW, sH);
    else if(S.phase === 'transition_out') _updateTransOut(dt,  ctx, sW, sH);
  }

  // Teclas especiales — el engine las delega aquí
  function handleKeyForSubMision(key) {
    if(S.phase === 'idle') return false;
    if(S.phase === 'select'){
      if(key==='n'||key==='N'){ _confirmChar('nina');   return true; }
      if(key==='j'||key==='J'){ _confirmChar('jazmin'); return true; }
    }
    if(S.phase === 'playing' && key === 'Escape'){
      S.phase = 'transition_out'; S.transTimer = 0; return true;
    }
    return false;
  }

  return { start, stop, isActive, update, handleKeyForSubMision, registerBtnZone: _registerBtnZone };

})();