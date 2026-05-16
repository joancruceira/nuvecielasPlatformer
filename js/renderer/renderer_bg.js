// ═══════════════════════════════════════════════════════
//  RENDERER_BG.JS — Fondos de nivel
//  Depende de: renderer_core.js
//
//  Responsabilidades:
//  - Cielo (gradiente)
//  - Fondos parallax por nivel (bosqueMagico, castleNC)
//  - Portal del castillo (fade in/out cuando muere el boss)
//  - Overlays de partículas y wisps encima del tilemap
//  - Fondos legacy (crystals, bgTrees canvas)
//
//  Flags de nivel que maneja:
//    level.bosqueMagico → back_bosqueMagico01/02/03.png
//    level.castleNC     → back_castlenc01/02/03.png
//    level.crystals     → cristales canvas (legacy)
//    level.bgTrees      → árboles canvas (legacy)
//    level.glowing      → halos de colores
// ═══════════════════════════════════════════════════════

const RendererBg = (() => {

  // ── Imágenes del Bosque Mágico (nivel 1) ─────────────
  const bosqueFrames = [];
  ['bosqueMagico01','bosqueMagico02','bosqueMagico03'].forEach(name => {
    const img = new Image(); img.src = `img/${name}.png`; bosqueFrames.push(img);
  });

  // ── Imágenes del Castillo de Nuveciela (nivel 2) ─────
  const castleNCFrames = [];
  ['back_castlenc01','back_castlenc02','back_castlenc03'].forEach(name => {
    const img = new Image(); img.src = `img/${name}.png`; castleNCFrames.push(img);
  });

  // ── Imágenes del Sendero Nocturno (nivel 3) ──────────
  const senderoFrames = [];
  ['sendero0','sendero1','sendero2'].forEach(name => {
    const img = new Image(); img.src = `img/${name}.png`; senderoFrames.push(img);
  });

  // ── Castillo portal (aparece al matar al boss) ────────
  const castlePortalImg = new Image();
  castlePortalImg.src = 'img/castle_bg.jpg';
  let castleAlpha   = 0;
  let castleActive  = false;
  let castleAnimDir = 0;
  let castleParallax = 0;

  // Candelabro legacy
  const candelabraImg = new Image();
  candelabraImg.src = 'img/candelabro01.png';

  // Config del overlay — se setea en drawBackground, se usa en drawOverlay
  let _overlayConfig = null;

  // ── API del portal ────────────────────────────────────
  function showCastle()  { castleActive = true; castleAnimDir =  1; }
  function hideCastle()  { castleAnimDir = -1; }
  function resetCastle() { castleAlpha = 0; castleActive = false; castleAnimDir = 0; }

  // Cache de gradientes — se invalida solo cuando cambia el nivel
  let _skyGradCache    = null;
  let _skyGradKey      = '';
  let _atmosGradCache  = null;

  // ─────────────────────────────────────────────────────
  //  DRAW BACKGROUND — llama el engine antes del tilemap
  // ─────────────────────────────────────────────────────
  function drawBackground(level, camX, camY, ts) {
    if (!level) return;
    const { ctx, W, H } = R;

    // Cielo — cachear gradiente mientras no cambie el nivel
    const skyKey = `${level.skyTop}|${level.skyBot}|${W}|${H}`;
    if(skyKey !== _skyGradKey) {
      _skyGradCache = ctx.createLinearGradient(0, 0, 0, H);
      _skyGradCache.addColorStop(0, level.skyTop);
      _skyGradCache.addColorStop(1, level.skyBot);
      _skyGradKey = skyKey;
    }
    ctx.fillStyle = _skyGradCache;
    ctx.fillRect(0, 0, W, H);

    // Registrar config para el overlay post-tilemap
    _overlayConfig = null;
    if (level.bosqueMagico) _overlayConfig = { type: 'bosque' };
    else if (level.castleNC) _overlayConfig = { type: 'castleNC' };
    else if (level.crystals) _overlayConfig = { type: 'crystals' };
    else if (level.bgTrees)  _overlayConfig = { type: 'trees', dark: level.dark };
    else if (level.senderoNocturno) _overlayConfig = { type: 'sendero' };

    // Fondos parallax
    if (level.bosqueMagico)    _drawBosqueBg(camX, ts);
    if (level.castleNC)        _drawCastleNCBg(camX, ts);
    if (level.senderoNocturno) _drawSenderoBg(camX, ts);
    if (level.crystals)        _drawCrystalsBg(camX, ts);
    if (level.glowing)         _drawGlowBg(camX, ts);

    // Portal del castillo
    _drawCastlePortal(ts, camX);
  }

  // ─────────────────────────────────────────────────────
  //  DRAW OVERLAY — llama el engine DESPUÉS del tilemap
  // ─────────────────────────────────────────────────────
  function drawOverlay(camX, camY, ts) {
    if (!_overlayConfig) return;
    switch(_overlayConfig.type) {
      case 'bosque':   _drawBosqueParticles(camX, ts); break;
      case 'castleNC': _drawCastleWisps(camX, ts);     break;
      case 'sendero':  _drawSenderoOverlay(camX, ts);  break;
      case 'crystals': _drawCandelabras(camX, camY, ts); break;
      case 'trees':    _drawCanvasTrees(camX, ts, _overlayConfig.dark); break;
    }
  }

  // ─────────────────────────────────────────────────────
  //  BOSQUE MÁGICO — 3 capas parallax
  // ─────────────────────────────────────────────────────
  function _drawBosqueBg(camX, ts) {
    const { ctx, W, H } = R;
    const layers = [
      { img: bosqueFrames[0], px: 0.03, alpha: 0.72, scaleH: 1.10 },
      { img: bosqueFrames[1], px: 0.08, alpha: 0.82, scaleH: 1.05 },
      { img: bosqueFrames[2], px: 0.16, alpha: 0.90, scaleH: 1.00 },
    ];
    const pulse = 0.94 + Math.sin(ts / 1200) * 0.06;
    for (const l of layers) {
      const { img, px, alpha, scaleH } = l;
      if (!img.complete || !img.naturalWidth) continue;
      const ar  = img.naturalWidth / img.naturalHeight;
      const dh  = H * scaleH;
      const dw  = Math.max(W + 200, dh * ar);
      const dy  = H - dh;
      const off = ((camX * px) % dw + dw) % dw;
      ctx.save();
      ctx.globalAlpha = alpha * pulse;
      ctx.drawImage(img, -off,      dy, dw, dh);
      ctx.drawImage(img, -off + dw, dy, dw, dh);
      ctx.restore();
    }
  }

  // Partículas mágicas — overlay encima del tilemap
  function _drawBosqueParticles(camX, ts) {
    const { ctx, W, H } = R;
    const pts = [
      { bx:0.08, speed:0.5, size:8,  col:'rgba(100,220,255,0.70)', oy:0.55 },
      { bx:0.22, speed:0.3, size:5,  col:'rgba(180,100,255,0.60)', oy:0.45 },
      { bx:0.35, speed:0.7, size:9,  col:'rgba(80,255,180,0.55)',  oy:0.60 },
      { bx:0.50, speed:0.4, size:6,  col:'rgba(255,220,80,0.65)',  oy:0.40 },
      { bx:0.63, speed:0.6, size:7,  col:'rgba(100,200,255,0.60)', oy:0.50 },
      { bx:0.75, speed:0.8, size:5,  col:'rgba(200,100,255,0.55)', oy:0.48 },
      { bx:0.85, speed:0.3, size:8,  col:'rgba(80,255,200,0.65)',  oy:0.58 },
      { bx:0.93, speed:0.5, size:6,  col:'rgba(255,240,100,0.70)', oy:0.42 },
    ];
    ctx.save();
    for (const p of pts) {
      const wx = ((p.bx * W - camX * 0.05 + ts * p.speed * 0.015) % (W+40) + W+40) % (W+40) - 20;
      const wy = H * p.oy + Math.sin(ts / 700 + p.bx * 10) * 18;
      const pulse = 0.55 + Math.sin(ts / 500 + p.bx * 8) * 0.45;
      const glow = ctx.createRadialGradient(wx, wy, 0, wx, wy, p.size * 2.5);
      glow.addColorStop(0, p.col); glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = pulse; ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(wx, wy, p.size * 2.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────
  //  CASTILLO DE NUVECIELA — 3 capas parallax
  // ─────────────────────────────────────────────────────
  function _drawCastleNCBg(camX, ts) {
    const { ctx, W, H } = R;
    const layers = [
      { img: castleNCFrames[0], px: 0.04, alpha: 0.70, scaleH: 0.85 },
      { img: castleNCFrames[1], px: 0.10, alpha: 0.82, scaleH: 0.95 },
      { img: castleNCFrames[2], px: 0.20, alpha: 0.95, scaleH: 1.05 },
    ];
    const flicker = 0.92 + Math.sin(ts/180)*0.05 + Math.sin(ts/80)*0.03;
    for (const l of layers) {
      const { img, px, alpha, scaleH } = l;
      if (!img.complete || !img.naturalWidth) continue;
      const ar  = img.naturalWidth / img.naturalHeight;
      const dh  = H * scaleH;
      const dw  = Math.max(W + 200, dh * ar);
      const dy  = H - dh;
      const off = ((camX * px) % dw + dw) % dw;
      ctx.save(); ctx.globalAlpha = alpha * flicker;
      ctx.drawImage(img, -off,      dy, dw, dh);
      ctx.drawImage(img, -off + dw, dy, dw, dh);
      ctx.restore();
    }
    // Atmósfera roja — cachear (no cambia)
    if(!_atmosGradCache) {
      _atmosGradCache = ctx.createLinearGradient(0, 0, 0, H);
      _atmosGradCache.addColorStop(0,   'rgba(60,0,0,0.28)');
      _atmosGradCache.addColorStop(0.6, 'rgba(30,0,0,0.12)');
      _atmosGradCache.addColorStop(1,   'rgba(0,0,0,0.40)');
    }
    ctx.fillStyle = _atmosGradCache; ctx.fillRect(0, 0, W, H);
  }

  // Wisps fantasmales — overlay encima del tilemap
  function _drawCastleWisps(camX, ts) {
    const { ctx, W, H } = R;
    const wisps = [
      { bx:0.12, speed:0.6, size:14, col:'rgba(0,220,220,0.55)'   },
      { bx:0.28, speed:0.4, size:10, col:'rgba(255,80,80,0.40)'   },
      { bx:0.45, speed:0.7, size:16, col:'rgba(0,200,200,0.45)'   },
      { bx:0.62, speed:0.5, size:11, col:'rgba(255,60,60,0.35)'   },
      { bx:0.78, speed:0.8, size:13, col:'rgba(180,100,255,0.40)' },
      { bx:0.91, speed:0.3, size:9,  col:'rgba(0,180,180,0.50)'   },
    ];
    ctx.save();
    for (const w of wisps) {
      const wx = ((w.bx*W - camX*0.05 + ts*w.speed*0.02) % (W+60) + W+60) % (W+60) - 30;
      const wy = H*0.35 + Math.sin(ts/800 + w.bx*8) * H*0.12;
      const pulse = 0.6 + Math.sin(ts/400 + w.bx*5) * 0.4;
      const glow = ctx.createRadialGradient(wx, wy, 0, wx, wy, w.size*2);
      glow.addColorStop(0, w.col); glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = pulse; ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(wx, wy, w.size*2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────
  //  PORTAL DEL CASTILLO — fade in cuando muere el boss
  // ─────────────────────────────────────────────────────
  function _drawCastlePortal(ts, camX) {
    const { ctx, W, H } = R;
    if (!castleActive && castleAlpha <= 0) return;
    const speed = 0.012;
    if (castleAnimDir ===  1) castleAlpha = Math.min(1, castleAlpha + speed);
    if (castleAnimDir === -1) castleAlpha = Math.max(0, castleAlpha - speed);
    if (castleAlpha <= 0 && castleAnimDir === -1) { castleActive = false; return; }
    if (!castlePortalImg.complete || !castlePortalImg.naturalWidth) return;

    ctx.save();
    castleParallax = camX * 0.06;
    const px = -castleParallax % (W * 0.15);
    const iAR = castlePortalImg.naturalWidth / castlePortalImg.naturalHeight;
    let dw = W * 1.05, dh = dw / iAR;
    if (dh < H) { dh = H * 1.05; dw = dh * iAR; }
    const dx = (W - dw) / 2 + px, dy = (H - dh) / 2;

    ctx.globalAlpha = castleAlpha;
    ctx.drawImage(castlePortalImg, dx, dy, dw, dh);

    const dimGrad = ctx.createLinearGradient(0, 0, 0, H);
    dimGrad.addColorStop(0,    'rgba(0,0,0,0)');
    dimGrad.addColorStop(0.55, 'rgba(0,0,0,0)');
    dimGrad.addColorStop(1,    `rgba(0,0,0,${castleAlpha * 0.82})`);
    ctx.globalAlpha = 1; ctx.fillStyle = dimGrad; ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = castleAlpha * (0.08 + Math.sin(ts/600)*0.04);
    ctx.fillStyle = '#8b0000'; ctx.fillRect(0, 0, W, H);

    const vignette = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.9);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, `rgba(0,0,0,${castleAlpha * 0.65})`);
    ctx.globalAlpha = 1; ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────
  //  SENDERO NOCTURNO — transición progresiva noche→amanecer
  //  sendero0 = inicio (noche cerrada, luna llena)
  //  sendero1 = mitad  (pre-amanecer, cielo violeta/naranja)
  //  sendero2 = final  (alba, castillo de Ciela visible)
  //
  //  Progreso basado en camX vs ancho total del nivel (~9600px)
  //  0%-40%  → sendero0
  //  40%-70% → crossfade sendero0→sendero1
  //  70%-85% → sendero1
  //  85%-100%→ crossfade sendero1→sendero2
  // ─────────────────────────────────────────────────────
  function _drawSenderoBg(camX, ts) {
    const { ctx, W, H } = R;
    const LEVEL_W = 200 * 48;  // nivel 3: 200 tiles × 48px
    const progress = Math.min(1, camX / (LEVEL_W - W));

    // Determinar qué frame/s mostrar y con qué alpha
    let frame0 = 0, frame1 = -1, blend = 0;
    if (progress < 0.40) {
      frame0 = 0; frame1 = -1; blend = 0;
    } else if (progress < 0.55) {
      frame0 = 0; frame1 = 1; blend = (progress - 0.40) / 0.15;
    } else if (progress < 0.70) {
      frame0 = 1; frame1 = -1; blend = 0;
    } else if (progress < 0.85) {
      frame0 = 1; frame1 = 2; blend = (progress - 0.70) / 0.15;
    } else {
      frame0 = 2; frame1 = -1; blend = 0;
    }

    function _drawFrame(idx, alpha) {
      const img = senderoFrames[idx];
      if (!img || !img.complete || !img.naturalWidth) return;
      const ar  = img.naturalWidth / img.naturalHeight;
      const dh  = H * 1.05;
      const dw  = Math.max(W + 200, dh * ar);
      const dy  = H - dh;
      // Parallax suave — el fondo se mueve más lento que el nivel
      const off = ((camX * 0.15) % dw + dw) % dw;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, -off,      dy, dw, dh);
      ctx.drawImage(img, -off + dw, dy, dw, dh);
      ctx.restore();
    }

    // Dibujar frame base
    _drawFrame(frame0, 1.0);
    // Crossfade al siguiente si aplica
    if (frame1 >= 0) _drawFrame(frame1, blend);
  }

  // Overlay: luciérnagas y estrellas fugaces sobre el tilemap
  function _drawSenderoOverlay(camX, ts) {
    const { ctx, W, H } = R;
    ctx.save();
    // Luciérnagas doradas — siguen el camino dorado
    const fireflies = [
      { bx:0.06, speed:0.4, size:5, col:'rgba(255,220,80,0.75)', oy:0.70 },
      { bx:0.18, speed:0.3, size:4, col:'rgba(255,240,100,0.65)', oy:0.68 },
      { bx:0.34, speed:0.5, size:5, col:'rgba(255,200,60,0.70)',  oy:0.72 },
      { bx:0.50, speed:0.4, size:4, col:'rgba(255,230,90,0.65)',  oy:0.69 },
      { bx:0.65, speed:0.6, size:5, col:'rgba(255,210,70,0.75)',  oy:0.71 },
      { bx:0.80, speed:0.3, size:4, col:'rgba(255,240,110,0.60)', oy:0.70 },
      { bx:0.92, speed:0.5, size:5, col:'rgba(255,220,80,0.70)',  oy:0.68 },
    ];
    for (const f of fireflies) {
      const wx = ((f.bx*W - camX*0.04 + ts*f.speed*0.012) % (W+40) + W+40) % (W+40) - 20;
      const wy = H*f.oy + Math.sin(ts/600 + f.bx*8) * 16;
      const pulse = 0.5 + Math.sin(ts/400 + f.bx*6) * 0.5;
      const glow = ctx.createRadialGradient(wx,wy,0,wx,wy,f.size*3);
      glow.addColorStop(0, f.col); glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = pulse;
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(wx,wy,f.size*3,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  function _drawCrystalsBg(camX, ts) {
    const { ctx, W, H } = R;
    const px = (camX * 0.15) % 180;
    for (let i = -1; i < Math.ceil(W/180)+1; i++) {
      const x = i*180 - px;
      const pulse = 0.4 + Math.sin(ts/800 + i) * 0.15;
      ctx.fillStyle = `rgba(120,80,200,${pulse})`;
      ctx.beginPath(); ctx.moveTo(x+30,H); ctx.lineTo(x+20,H-70); ctx.lineTo(x+40,H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(160,100,220,${pulse*0.7})`;
      ctx.beginPath(); ctx.moveTo(x+80,H); ctx.lineTo(x+72,H-50); ctx.lineTo(x+90,H); ctx.closePath(); ctx.fill();
    }
  }

  function _drawGlowBg(camX, ts) {
    const { ctx, W, H } = R;
    const colors = ['rgba(100,200,120,.12)','rgba(80,120,255,.10)','rgba(200,100,255,.10)'];
    for (let i = 0; i < 5; i++) {
      const x = ((i*310 - camX*0.08) % (W+200)) - 100;
      const y = H*0.3 + Math.sin(ts/1200 + i*1.8) * H*0.15;
      const r = 80 + i*25;
      const g = ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0, colors[i%colors.length]); g.addColorStop(1,'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
  }

  function _drawCanvasTrees(camX, ts, dark) {
    const { ctx, W, H } = R;
    const cols = dark
      ? ['rgba(20,40,20,.35)','rgba(15,30,15,.5)']
      : ['rgba(40,100,55,.40)','rgba(30,80,45,.55)'];
    for (let layer = 0; layer < 2; layer++) {
      const px = (camX * (0.18 + layer*0.12)) % 220;
      ctx.fillStyle = cols[layer];
      for (let i = -1; i < Math.ceil(W/220)+1; i++) {
        const x = i*220 - px;
        const h = 140 + layer*40;
        ctx.beginPath(); ctx.moveTo(x+55,H-h); ctx.lineTo(x+100,H); ctx.lineTo(x+10,H); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x+55,H-h*0.6); ctx.lineTo(x+105,H); ctx.lineTo(x+5,H); ctx.closePath(); ctx.fill();
      }
    }
  }

  function _drawCandelabras(camX, camY, ts) {
    const { ctx, W, H } = R;
    const img = candelabraImg;
    if (!img.complete || !img.naturalWidth) return;
    const ar      = img.naturalWidth / img.naturalHeight;
    const flicker = 0.85 + Math.sin(ts/200)*0.10 + Math.sin(ts/90)*0.05;
    const H1=180, W1=H1*ar, H2=110, W2=H2*ar;
    const Y1=H*0.30, Y2=H*0.08;
    const GAP1=W1*5.5, GAP2=W2*7.0;
    const off1=((camX*0.08)%GAP1+GAP1)%GAP1;
    const off2=((camX*0.04+GAP2*0.5)%GAP2+GAP2)%GAP2;
    ctx.save();
    ctx.globalAlpha=flicker;
    for(let i=-1;i<=Math.ceil(W/GAP1)+1;i++) ctx.drawImage(img,i*GAP1-off1,Y1,W1,H1);
    ctx.globalAlpha=flicker*0.50;
    for(let i=-1;i<=Math.ceil(W/GAP2)+1;i++) ctx.drawImage(img,i*GAP2-off2,Y2,W2,H2);
    ctx.restore();
  }

  function _invalidateCache() {
    _skyGradCache   = null;
    _skyGradKey     = '';
    _atmosGradCache = null;
  }

  return { drawBackground, drawOverlay, showCastle, hideCastle, resetCastle, _invalidateCache };

})();