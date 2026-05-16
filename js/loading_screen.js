// ═══════════════════════════════════════════════════════
//  LOADING_SCREEN.JS — Pantalla de carga por nivel
//  Muestra progreso mientras AssetLoader carga los assets.
//  Se dibuja directamente en el canvas del juego.
// ═══════════════════════════════════════════════════════

const LoadingScreen = (() => {

  const MESSAGES = [
    '🌿 Preparando el bosque mágico...',
    '✨ Invocando partículas mágicas...',
    '🍄 Despertando a los enemigos...',
    '🌙 Pintando el cielo nocturno...',
    '🏰 Abriendo las puertas del castillo...',
    '🐛 Convocando al ciempiés...',
    '⚡ Cargando las chispas del arbusto...',
    '🦇 Llamando a los murciélagos...',
  ];

  let _progress  = 0;   // 0-1
  let _message   = MESSAGES[0];
  let _msgTimer  = 0;
  let _msgIdx    = 0;
  let _dots      = 0;
  let _dotTimer  = 0;
  let _active    = false;
  let _rafId     = null;
  let _lastTs    = 0;

  // ── Dibujo en canvas ──────────────────────────────────
  function _draw(ts) {
    const canvas = document.getElementById('gameCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const dt = _lastTs ? Math.min((ts - _lastTs)/1000, 0.05) : 0;
    _lastTs = ts;

    // Timers
    _dotTimer += dt;
    if(_dotTimer > 0.5) { _dotTimer=0; _dots=(_dots+1)%4; }
    _msgTimer += dt;
    if(_msgTimer > 2.5) {
      _msgTimer=0;
      _msgIdx=(_msgIdx+1)%MESSAGES.length;
      _message=MESSAGES[_msgIdx];
    }

    // Fondo degradado — misma paleta del juego
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0, '#1a0a3d');
    bg.addColorStop(0.5, '#3d1a6e');
    bg.addColorStop(1, '#c25218');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

    // Partículas decorativas simples
    ctx.save();
    for(let i=0;i<8;i++) {
      const x = W*(0.1+i*0.11);
      const y = H*0.3 + Math.sin(ts/800+i)*H*0.08;
      const r = 3+Math.sin(ts/400+i*2)*2;
      const cols=['rgba(167,139,250,0.5)','rgba(249,200,70,0.5)','rgba(80,200,255,0.4)'];
      ctx.fillStyle=cols[i%cols.length];
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // Logo / título
    ctx.save();
    ctx.textAlign='center';
    ctx.font=`bold ${Math.min(W*0.08,52)}px Fredoka, system-ui`;
    ctx.fillStyle='rgba(0,0,0,0.4)';
    ctx.fillText('NuveBosque', W/2+2, H*0.32+2);
    ctx.fillStyle='#fff';
    ctx.fillText('NuveBosque', W/2, H*0.32);
    ctx.restore();

    // Barra de progreso
    const barW = Math.min(W*0.65, 420);
    const barH = 16;
    const barX = (W-barW)/2;
    const barY = H*0.52;

    // Fondo barra
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.roundRect(barX,barY,barW,barH,8); ctx.fill();

    // Progreso
    const fillW = barW * _progress;
    if(fillW > 0) {
      const grad = ctx.createLinearGradient(barX,0,barX+barW,0);
      grad.addColorStop(0, '#a78bfa');
      grad.addColorStop(0.5,'#f9c846');
      grad.addColorStop(1, '#4ade80');
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.roundRect(barX,barY,fillW,barH,8); ctx.fill();
    }

    // Brillo animado en la barra
    const shine = ((ts/800)%1)*barW;
    ctx.fillStyle='rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.roundRect(barX+shine-20,barY,20,barH,8); ctx.fill();
    ctx.restore();

    // Porcentaje
    ctx.save();
    ctx.textAlign='center';
    ctx.font=`bold ${Math.min(W*0.035,20)}px Fredoka, system-ui`;
    ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.fillText(`${Math.round(_progress*100)}%`, W/2, barY+barH+24);
    ctx.restore();

    // Mensaje con puntos animados
    const dots = '.'.repeat(_dots);
    ctx.save();
    ctx.textAlign='center';
    ctx.font=`${Math.min(W*0.03,16)}px Fredoka, system-ui`;
    ctx.fillStyle='rgba(255,255,255,0.65)';
    ctx.fillText(_message+dots, W/2, barY+barH+52);
    ctx.restore();

    if(_active) _rafId = requestAnimationFrame(_draw);
  }

  // ── API pública ───────────────────────────────────────

  function show() {
    _active   = true;
    _progress = 0;
    _lastTs   = 0;
    _rafId = requestAnimationFrame(_draw);
  }

  function setProgress(loaded, total) {
    _progress = total > 0 ? loaded/total : 1;
  }

  function hide() {
    _active = false;
    if(_rafId) { cancelAnimationFrame(_rafId); _rafId=null; }
  }

  return { show, setProgress, hide };

})();