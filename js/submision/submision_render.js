// ═══════════════════════════════════════════════════════
//  SUBMISION_RENDER.JS — Todo el sistema de dibujo
//  Depende de: submision_const.js
//
//  ORDEN DE CAPAS:
//  1. Fondo (cielo + void + parallax)
//  2. Bus (antes del tilemap para que la plataforma quede encima)
//  3. Tilemap (suelo + plataformas + agua)
//  4. Props decorativos
//  5. Gatitos coleccionables
//  6. Pablo + jaula
//  7. Gema
//  8. Enemigos
//  9. Boss
// 10. Corazoncitos
// 11. Jugador
// 12. HUD
// ═══════════════════════════════════════════════════════

const SubRender = (() => {

  // ── Helpers de imagen ────────────────────────────────
  function img(k) {
    const i = S.imgs[k];
    return (i && i.complete && i.naturalWidth > 0) ? i : null;
  }
  function drawImg(ctx, k, x, y, w, h) {
    const i = img(k); if(!i) return false;
    ctx.drawImage(i, x, y, w, h); return true;
  }
  function drawImgAR(ctx, k, cx, cy, dh) {
    const i = img(k); if(!i) return false;
    const dw = dh * (i.naturalWidth / i.naturalHeight);
    ctx.drawImage(i, cx-dw/2, cy-dh/2, dw, dh); return true;
  }

  // ── RENDER PRINCIPAL ─────────────────────────────────
  function drawFrame(ctx, W, H) {
    drawBg(ctx, W, H);
    drawBus(ctx, W);
    drawTilemap(ctx, W, H);
    drawProps(ctx, W);
    drawKitties(ctx);
    drawPablo(ctx);
    if(!S.gem.collected) drawGem(ctx);
    drawEnemies(ctx);
    drawBoss(ctx);
    drawHearts(ctx);
    drawPlayer(ctx);
    drawHUD(ctx, W, H);
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 1 — FONDO (cielo, void, parallax)
  // ═══════════════════════════════════════════════════

  // ── LA HORA DEL DÍA ───────────────────────────────────
  //
  //  El cielo era un degradé FIJO de atardecer con el sol clavado al 75 % de la
  //  pantalla: no se movía con la cámara ni cambiaba en 200 tiles. La costanera,
  //  la ciudad, el río y el corralón se veían con la misma luz.
  //
  //  Ahora la luz corre con el avance, que es la forma más barata de que un
  //  nivel largo se sienta un viaje:
  //
  //     costanera  →  ciudad   →   río      →  corralón  →  rescate
  //     sol de tarde  atardece    tormenta      noche       primeras luces
  //
  //  Todo por código: no hace falta un solo sprite nuevo.
  const HORAS = [
    // avance, cielo (de arriba abajo), sol: [x, alto, color, tamaño]
    //  `velo` es la clave: los fondos de Rosario están pintados a pleno sol
    //  dorado y se dibujan ENCIMA del cielo, así que por más que oscurezcas el
    //  degradé el atardecer no llega nunca. El velo se pinta sobre las capas y
    //  es lo que de verdad hace anochecer.
    { p:0.00, cielo:['#4aa3d8','#8fc9e8','#ffd89b','#ffc078'], sol:[0.78,0.30,'#fff3b0',30], estrellas:0,    velo:['10,8,40',0.00] },
    { p:0.30, cielo:['#2a5a9e','#7a6fb0','#f0904a','#fbbf6e'], sol:[0.72,0.48,'#ffe066',26], estrellas:0,    velo:['40,16,50',0.16] },
    { p:0.52, cielo:['#1a0a3d','#3d1a6e','#c25218','#f4813a'], sol:[0.66,0.66,'#ff9a3c',22], estrellas:0.25, velo:['30,12,52',0.34] },
    { p:0.68, cielo:['#0a0620','#191036','#2a1a4a','#3a2a55'], sol:[0.58,0.92,'#6b5a80',14], estrellas:0.85, velo:['12,8,34',0.60] },
    { p:0.84, cielo:['#05040f','#0c0a20','#141030','#1c1838'], sol:[0.50,1.20,'#3a3050', 8], estrellas:1.00, velo:['6,5,20',0.78] },
    { p:1.00, cielo:['#0a0a1f','#16123a','#2a2050','#4a3a60'], sol:[0.44,1.10,'#5a4a70',10], estrellas:0.80, velo:['8,6,26',0.70] },
  ];

  function _mez(a, b, k) {
    const h = s => [parseInt(s.slice(1,3),16), parseInt(s.slice(3,5),16), parseInt(s.slice(5,7),16)];
    const A = h(a), B = h(b);
    return `rgb(${Math.round(A[0]+(B[0]-A[0])*k)},${Math.round(A[1]+(B[1]-A[1])*k)},${Math.round(A[2]+(B[2]-A[2])*k)})`;
  }

  function _hora() {
    // El avance sale de la CÁMARA, no del jugador: así el cielo no salta si el
    // jugador retrocede un paso.
    const p = Math.max(0, Math.min(1, S.cam.x / ((S.MAP_W - 12) * S.TS)));
    let i = 0;
    while (i < HORAS.length - 2 && p > HORAS[i + 1].p) i++;
    const a = HORAS[i], b = HORAS[i + 1];
    const k = (p - a.p) / (b.p - a.p || 1);
    return {
      cielo: a.cielo.map((c, j) => _mez(c, b.cielo[j], k)),
      solX:  a.sol[0] + (b.sol[0] - a.sol[0]) * k,
      solY:  a.sol[1] + (b.sol[1] - a.sol[1]) * k,
      solCol:_mez(a.sol[2], b.sol[2], k),
      solR:  a.sol[3] + (b.sol[3] - a.sol[3]) * k,
      estrellas: a.estrellas + (b.estrellas - a.estrellas) * k,
      velo: `rgba(${k < 0.5 ? a.velo[0] : b.velo[0]},${(a.velo[1] + (b.velo[1]-a.velo[1])*k).toFixed(3)})`,
      avance: p,
    };
  }

  function drawBg(ctx, W, H) {
    const groundY = S.GROUND_ROW * S.TS;  // y=480, cam.y siempre 0

    // ── Void (río Paraná marrón) — cubre todo el canvas ──
    // El cielo lo tapará encima. Los GAPS muestran esto.
    {
      const vg = ctx.createLinearGradient(0, groundY, 0, H);
      vg.addColorStop(0,   '#5a3a1a');
      vg.addColorStop(0.2, '#4a2e12');
      vg.addColorStop(0.6, '#3a2208');
      vg.addColorStop(1,   '#2a1804');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      if(groundY < H){
        ctx.save(); ctx.globalAlpha = 0.30;
        for(let w2=0; w2<5; w2++){
          const wy  = groundY + 8 + w2*20; if(wy > H) break;
          const off = (S.gameTime*22 + w2*48) % (W+100);
          ctx.fillStyle = '#c8902a';
          ctx.fillRect(-off+W, wy, W*0.50, 2);
          ctx.fillRect(-off,   wy, W*0.50, 2);
        }
        ctx.restore();
      }
    }

    // ── Cielo — solo hasta groundY ───────────────────────
    {
      const skyH = Math.min(groundY, H);
      if(skyH <= 0) return;

      const hora = _hora();
      const sky = ctx.createLinearGradient(0,0,0,skyH);
      sky.addColorStop(0,    hora.cielo[0]);
      sky.addColorStop(0.34, hora.cielo[1]);
      sky.addColorStop(0.70, hora.cielo[2]);
      sky.addColorStop(1,    hora.cielo[3]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, skyH);

      // El sol baja y se corre con el avance. Cuando solY pasa de 1 ya está
      // abajo del horizonte y sólo queda el resplandor.
      const sunX = W*hora.solX, sunY = skyH*hora.solY;
      const halo = 110 * (1 - hora.avance*0.45);
      const sg=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,halo);
      sg.addColorStop(0,   hora.solCol);
      sg.addColorStop(0.22,'rgba(255,165,40,0.45)');
      sg.addColorStop(0.6, 'rgba(255,100,20,0.12)');
      sg.addColorStop(1,   'transparent');
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, hora.solY-1)*3);
      ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sunX,sunY,halo,0,Math.PI*2);ctx.fill();
      if(hora.solY < 1.02){
        ctx.fillStyle=hora.solCol;
        ctx.beginPath();ctx.arc(sunX,sunY,hora.solR,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();

      // Estrellas parpadeantes
      const stars=[[0.08,0.08],[0.20,0.04],[0.32,0.12],[0.47,0.06],[0.61,0.09],[0.80,0.12],[0.91,0.05]];
      for(const [sx,sy] of stars){
        const py=sy*skyH; if(py>skyH) continue;
        ctx.globalAlpha=(0.22+Math.sin(S.gameTime*3+sx*12)*0.38) * _hora().estrellas;
        ctx.fillStyle='#fff'; ctx.fillRect(sx*W-1,py-1,2,2);
      }
      ctx.globalAlpha=1;

      // ── Parallax BG — clipeado al cielo ──────────────
      ctx.save();
      ctx.beginPath(); ctx.rect(0,0,W,skyH); ctx.clip();
      const layers=[
        {key:'cielo_lejano', px:0.03, alpha:0.48},
        {key:'bg_rosario2',  px:0.09, alpha:0.62},
        {key:'fondo_rosario',px:0.18, alpha:0.76},
      ];
      for(const l of layers){
        const im=img(l.key); if(!im) continue;
        const ar=im.naturalWidth/im.naturalHeight;
        const dh=skyH, dw=Math.max(W+600, dh*ar);
        const off=Math.min(S.cam.x*l.px, Math.max(0, dw-W));
        ctx.globalAlpha=l.alpha;
        ctx.drawImage(im,-off,0,dw,dh);
      }
      // El velo va acá adentro, todavía clipeado al cielo: oscurece las capas
      // de Rosario sin tocar el suelo ni a los personajes.
      ctx.globalAlpha = 1;
      ctx.fillStyle = hora.velo;
      ctx.fillRect(0, 0, W, skyH);
      ctx.restore();

      // ── El corralón (zona 5): faroles de sodio ────────
    //
    //  La zona del jefe no puede ser un vacío violeta: es un depósito municipal
    //  de noche, y de noche lo que hay son faroles naranjas cada tantos metros.
    //  Son charcos de luz por código, sin sprite, y además cumplen una función
    //  de juego: marcan el ancho de la arena.
    {
      const y0 = S.GROUND_ROW * S.TS;
      for (let col = 162; col <= 188; col += 9) {
        const lx = col * S.TS - S.cam.x;
        if (lx < -260 || lx > W + 260) continue;
        const parp = 0.86 + Math.sin(S.gameTime * 7 + col) * 0.07
                          + Math.sin(S.gameTime * 19 + col) * 0.04;
        const g = ctx.createRadialGradient(lx, y0 - 150, 4, lx, y0 - 150, 230);
        g.addColorStop(0,    `rgba(255,176,80,${0.30 * parp})`);
        g.addColorStop(0.45, `rgba(255,140,40,${0.12 * parp})`);
        g.addColorStop(1,    'rgba(255,140,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(lx, y0 - 150, 230, 0, Math.PI * 2); ctx.fill();
        // el poste y la lámpara
        ctx.fillStyle = 'rgba(30,28,26,0.9)';
        ctx.fillRect(lx - 3, y0 - 210, 6, 210);
        ctx.fillStyle = `rgba(255,196,110,${parp})`;
        ctx.beginPath(); ctx.ellipse(lx, y0 - 212, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── Tormenta (zona 4-5) ───────────────────────────
      const z4sx=130*S.TS-S.cam.x, z5ex=190*S.TS-S.cam.x;
      if(z5ex>0 && z4sx<W){
        const x0=Math.max(0,z4sx), x1=Math.min(W,z5ex);
        const stG=ctx.createLinearGradient(z4sx,0,z5ex,0);
        stG.addColorStop(0,'transparent');
        stG.addColorStop(0.06,'rgba(20,10,55,0.42)');
        stG.addColorStop(0.94,'rgba(20,10,55,0.48)');
        stG.addColorStop(1,'transparent');
        ctx.fillStyle=stG; ctx.fillRect(x0,0,x1-x0,skyH);

        // Nubes de tormenta
        ctx.save(); ctx.globalAlpha=0.52;
        const cloudY=Math.min(skyH*0.30,100);
        [0,170,340,510].forEach(off=>{
          const cx=z4sx+off; if(cx>W+80||cx<-120) return;
          ctx.fillStyle='rgba(18,8,58,0.78)';
          [[cx+36,cloudY,28],[cx+64,cloudY+6,22],[cx+88,cloudY+2,24],[cx+52,cloudY-12,18]]
            .forEach(([x,y,r])=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();});
        });
        // Relámpago
        if(Math.sin(S.gameTime*14.6)>0.93){
          const lx=z4sx+200+Math.sin(S.gameTime)*140;
          ctx.strokeStyle='rgba(180,130,255,0.85)'; ctx.lineWidth=1.5;
          ctx.beginPath();
          ctx.moveTo(lx,cloudY+28);ctx.lineTo(lx-7,cloudY+55);
          ctx.lineTo(lx+4,cloudY+55);ctx.lineTo(lx-5,cloudY+90);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 2 — BUS (antes del tilemap)
  // ═══════════════════════════════════════════════════
  function drawBus(ctx, W) {
    const sx=48*S.TS-S.cam.x;
    if(sx>W+10||sx<-10*S.TS) return;
    const gy=S.GROUND_ROW*S.TS, busW=10*S.TS, busH=3*S.TS, busY=gy-busH;

    if(!drawImg(ctx,'bus',sx-4,busY,busW+8,busH)){
      ctx.fillStyle='#C83818';ctx.fillRect(sx,busY,busW,busH);
      ctx.fillStyle='#A02808';ctx.fillRect(sx,busY,busW,8);
      ctx.fillStyle='#f0c020';ctx.fillRect(sx,busY+8,busW,5);
      ctx.fillStyle='rgba(100,170,210,0.50)';
      for(let w=0;w<5;w++) ctx.fillRect(sx+10+w*34,busY+18,26,24);
      ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;
      for(let w=0;w<5;w++) ctx.strokeRect(sx+10+w*34,busY+18,26,24);
      ctx.fillStyle='#222';
      ctx.beginPath();ctx.arc(sx+28,gy-2,14,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(sx+busW-28,gy-2,14,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#555';
      ctx.beginPath();ctx.arc(sx+28,gy-2,6,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(sx+busW-28,gy-2,6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#f0c020';ctx.fillRect(sx+busW-40,busY+14,38,16);
      ctx.fillStyle='#1a1a1a';ctx.font='bold 8px sans-serif';ctx.textAlign='center';
      ctx.fillText('142 COSTANERA',sx+busW-21,busY+25);
    }
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 3 — TILEMAP
  // ═══════════════════════════════════════════════════

  // ── El corralón: de morado mágico a cemento ───────────
  //
  //  Los tiles 'dark' están pintados en violeta (rgb 52,28,54): es lo único del
  //  subnivel que no podría existir en Rosario. Se tiñen UNA vez a cemento
  //  sucio y quedan guardados — teñir por frame sería carísimo, y hacerlo con
  //  'source-atop' sobre el canvas principal mancharía la pantalla entera.
  const _cemento = {};
  function _aCemento(key) {
    if (_cemento[key] !== undefined) return _cemento[key];
    const im = S.imgs[key];
    if (!(im && im.complete && im.naturalWidth > 0)) return null;
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'saturation';   // mata el violeta
    x.fillStyle = 'hsl(0,0%,50%)';
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'multiply';     // cemento sucio, no negro
    x.fillStyle = '#8a8580';
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(im, 0, 0);
    _cemento[key] = c;
    return c;
  }

  function drawTilemap(ctx, W, H) {
    if(!S.subMap) return;
    const { TS, MAP_W, MAP_H, PAL } = S;
    const t0 = S.gameTime;
    const c0 = Math.max(0,      Math.floor(S.cam.x/TS)-1);
    const c1 = Math.min(MAP_W-1,Math.ceil((S.cam.x+W)/TS)+1);

    for(let r=0;r<MAP_H;r++){
      for(let c=c0;c<=c1;c++){
        const t=S.subMap[r][c]; if(!t) continue;
        const sx=c*TS-S.cam.x, sy=r*TS;

        // ── Tile 1: suelo sólido ──────────────────────
        if(t===1){
          if(!drawImg(ctx,'tile_ground_top',sx,sy,TS,TS)){
            ctx.fillStyle=(c+r)%2?'#c8a050':'#c0984a'; ctx.fillRect(sx,sy,TS,TS);
            ctx.strokeStyle='rgba(80,50,15,0.28)';ctx.lineWidth=1;
            ctx.strokeRect(sx+.5,sy+.5,TS-1,TS-1);
          }
          // Borde verde siempre — señal "pisable"
          ctx.fillStyle=PAL.GROUND_TOP; ctx.fillRect(sx,sy,TS,6);
          ctx.fillStyle='rgba(200,255,120,0.55)'; ctx.fillRect(sx,sy,TS,2);
        }

        // ── Tile 2: relleno suelo ─────────────────────
        else if(t===2){
          if(!drawImg(ctx,'tile_ground_mid',sx,sy,TS,TS)){
            ctx.fillStyle='#7a5020'; ctx.fillRect(sx,sy,TS,TS);
          }
          ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(sx,sy+TS-5,TS,5);
          ctx.fillStyle='rgba(0,10,30,0.40)'; ctx.fillRect(sx,sy+TS-2,TS,2);
        }

        // ── Tile 3: plataforma ─────────────────────────
        else if(t===3){
          const type = S.platMeta[`${c}_${r}`] || 'wood';
          // Sombra drop
          ctx.save();ctx.globalAlpha=0.32;ctx.fillStyle='#000';
          ctx.fillRect(sx+2,sy+14,TS,8);ctx.restore();
          // Cuerpo
          if(!drawImg(ctx,`plat_${type}`,sx,sy,TS,14)){
            const body={wood:'#7a4e20',stone:'#686870',metal:'#486070',dark:'#281540'};
            ctx.fillStyle=body[type]||body.wood; ctx.fillRect(sx,sy+4,TS,10);
          }
          // Borde top amarillo — señal "plataforma"
          ctx.fillStyle=PAL.PLAT_TOP; ctx.fillRect(sx,sy,TS,5);
          ctx.fillStyle='rgba(255,240,120,0.60)'; ctx.fillRect(sx,sy,TS,2);
        }

        // ── Tile 4: agua ──────────────────────────────
        else if(t===4){
          const wave  = Math.sin(t0*2.0+c*0.4)*3;
          const isTop = (r===0) || S.subMap[r-1]?.[c]!==4;
          const wKey  = isTop ? 'tile_water_top' : 'tile_water_mid';
          if(!drawImg(ctx,wKey,sx,sy,TS,TS)){
            ctx.fillStyle = isTop ? PAL.WATER_TOP : PAL.WATER_MID;
            ctx.fillRect(sx,sy,TS,TS);
          }
          if(isTop){
            ctx.save();ctx.globalAlpha=0.40;
            ctx.fillStyle=PAL.WATER_ANIM;ctx.fillRect(sx,sy+wave+3,TS,3);
            ctx.globalAlpha=0.18;ctx.fillRect(sx,sy+wave+12,TS,2);ctx.restore();
          }
        }

        // ── Tile 5: suelo dark TOP ────────────────────
        else if(t===5){
          const cem = _aCemento('tile_dark_top');
          if(cem) ctx.drawImage(cem, sx, sy, TS, TS);
          else {
            ctx.fillStyle='#4a4640'; ctx.fillRect(sx,sy,TS,TS);
          }
          // La franja de arriba era violeta fosforescente; ahora es el reflejo
          // del farol de sodio sobre el cemento mojado.
          ctx.fillStyle=PAL.DARK_GLOW; ctx.globalAlpha=0.55;
          ctx.fillRect(sx,sy,TS,3); ctx.globalAlpha=1;
          ctx.fillStyle='rgba(255,210,150,0.35)'; ctx.fillRect(sx,sy,TS,1);
        }

        // ── Tile 6: relleno dark ──────────────────────
        else if(t===6){
          const cem = _aCemento('tile_dark_mid');
          if(cem) ctx.drawImage(cem, sx, sy, TS, TS);
          else { ctx.fillStyle='#2e2b28'; ctx.fillRect(sx,sy,TS,TS); }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 4 — PROPS decorativos
  // ═══════════════════════════════════════════════════
  function drawProps(ctx, W) {
    if(!S.subMap) return;
    const { TS, MAP_W, MAP_H, GROUND_ROW } = S;
    const c0=Math.max(0,      Math.floor(S.cam.x/TS)-3);
    const c1=Math.min(MAP_W-1,Math.ceil((S.cam.x+W)/TS)+3);

    for(let c=c0;c<=c1;c++){
      const sx=c*TS-S.cam.x;

      // Y del suelo en esta columna
      let gy=GROUND_ROW*TS;
      for(let r=0;r<MAP_H;r++){
        if(S.subMap[r][c]===1||S.subMap[r][c]===5){gy=r*TS;break;}
      }

      // ── Zona cálida: costanera (0-89) y rescate (190-199) ──
      const inWarm=(c>=0&&c<90)||(c>=190&&c<MAP_W);
      if(inWarm && S.subMap[GROUND_ROW]?.[c]===1){

        // FAROLA — cada 12 cols, 42×134px
        if(c%12===0){
          if(!drawImg(ctx,'prop_lamp',sx+2,gy-132,42,134)){
            ctx.fillStyle='#8a9caa';
            ctx.fillRect(sx+18,gy-128,6,128);
            ctx.fillRect(sx+2, gy-128,18,5);
            ctx.fillRect(sx+2, gy-133,18,5);
            ctx.fillStyle='#c0d0da'; ctx.fillRect(sx,gy-136,16,10);
            ctx.fillStyle='#909eaa'; ctx.fillRect(sx,gy-136,16,4);
            const gl=ctx.createRadialGradient(sx+8,gy-131,0,sx+8,gy-131,36);
            gl.addColorStop(0,'rgba(255,240,140,0.95)');
            gl.addColorStop(0.4,'rgba(255,220,80,0.40)');
            gl.addColorStop(1,'transparent');
            ctx.fillStyle=gl;ctx.beginPath();ctx.arc(sx+8,gy-131,36,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#fff8a0';ctx.beginPath();ctx.arc(sx+8,gy-131,6,0,Math.PI*2);ctx.fill();
          }
        }

        // BANCO — cada 16 cols offset 5, 84×40px
        if(c%16===5){
          if(!drawImg(ctx,'prop_bench',sx-6,gy-40,84,40)){
            ctx.fillStyle='rgba(0,0,0,0.18)';ctx.fillRect(sx,gy+2,80,6);
            ctx.fillStyle='#7a4e28';ctx.fillRect(sx,gy-40,80,10);
            ctx.fillStyle='#5a3618';ctx.fillRect(sx,gy-40,80,3);
            ctx.fillStyle='#9a6e3a';
            for(let s=0;s<4;s++) ctx.fillRect(sx+4+s*19,gy-37,14,7);
            ctx.fillStyle='#b08040';ctx.fillRect(sx-2,gy-26,84,10);
            ctx.fillStyle='#c89050';ctx.fillRect(sx-2,gy-26,84,3);
            ctx.fillStyle='#9a6e3a';
            for(let s=0;s<4;s++) ctx.fillRect(sx+2+s*19,gy-23,14,7);
            ctx.fillStyle='#3a2208';
            ctx.fillRect(sx+2, gy-16,7,16);ctx.fillRect(sx+24,gy-16,7,16);
            ctx.fillRect(sx+52,gy-16,7,16);ctx.fillRect(sx+74,gy-16,7,16);
            ctx.fillRect(sx+2,gy-6,78,4);
          }
        }

        // ÁRBOL — cada 14 cols offset 8, 120×154px
        if(c%14===8){
          if(!drawImg(ctx,'prop_tree',sx-24,gy-152,120,154)){
            ctx.fillStyle='rgba(0,0,0,0.14)';
            ctx.beginPath();ctx.ellipse(sx+28,gy+3,40,8,0,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#7B5A1A';ctx.fillRect(sx+18,gy-76,18,76);
            ctx.fillStyle='#9B7A3A';ctx.fillRect(sx+18,gy-76,6,76);
            ctx.fillStyle='#6a4a10';ctx.fillRect(sx+30,gy-76,6,76);
            ctx.fillStyle='#7B5A1A';
            ctx.fillRect(sx+6,gy-8,12,8);ctx.fillRect(sx+36,gy-8,12,8);
            ctx.fillStyle='#1a4010';ctx.beginPath();ctx.arc(sx+28,gy-100,42,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#246018';ctx.beginPath();ctx.arc(sx+8, gy-118,28,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#246018';ctx.beginPath();ctx.arc(sx+48,gy-114,26,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#307820';ctx.beginPath();ctx.arc(sx+28,gy-134,24,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#3a8828';ctx.beginPath();ctx.arc(sx+28,gy-146,16,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='rgba(80,180,40,0.20)';
            ctx.beginPath();ctx.arc(sx+16,gy-138,10,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(sx+10,gy-116,8,0,Math.PI*2);ctx.fill();
          }
        }
      }

      // KIOSCO — col 24, 102×104px
      if(c===24){
        if(!drawImg(ctx,'prop_kiosk',sx-2,gy-102,102,104)){
          ctx.fillStyle='rgba(0,0,0,0.15)';ctx.fillRect(sx+4,gy,96,6);
          ctx.fillStyle='#b0a090';ctx.fillRect(sx+2,gy-82,68,82);
          ctx.fillStyle='#908070';ctx.fillRect(sx+2,gy-82,8,82);
          ctx.fillStyle='#c02818';
          ctx.beginPath();ctx.moveTo(sx-6,gy-84);ctx.lineTo(sx+76,gy-84);
          ctx.lineTo(sx+68,gy-70);ctx.lineTo(sx+2,gy-70);ctx.closePath();ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.28)';
          for(let s=0;s<5;s++) ctx.fillRect(sx-4+s*16,gy-84,8,14);
          ctx.fillStyle='rgba(120,190,220,0.60)';ctx.fillRect(sx+10,gy-66,52,32);
          ctx.strokeStyle='#706050';ctx.lineWidth=2;ctx.strokeRect(sx+10,gy-66,52,32);
          ctx.beginPath();ctx.moveTo(sx+36,gy-66);ctx.lineTo(sx+36,gy-34);ctx.stroke();
          ctx.beginPath();ctx.moveTo(sx+10,gy-50);ctx.lineTo(sx+62,gy-50);ctx.stroke();
          ctx.fillStyle='#f5d020';ctx.fillRect(sx+8,gy-28,56,12);
          ctx.fillStyle='#201008';ctx.font='bold 8px sans-serif';ctx.textAlign='center';
          ctx.fillText('KIOSCO · DIARIOS',sx+36,gy-19);
          ctx.fillStyle='#806040';ctx.fillRect(sx+24,gy-38,24,38);
          ctx.fillStyle='#604020';ctx.fillRect(sx+24,gy-38,4,38);
          ctx.fillStyle='#d0a020';ctx.beginPath();ctx.arc(sx+46,gy-18,3,0,Math.PI*2);ctx.fill();
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 5 — GATITOS coleccionables
  // ═══════════════════════════════════════════════════
  function drawKitties(ctx) {
    const cam=S.cam;

    // La fila de rescatados, primero: van detrás del jugador.
    for(const g of S.fila){
      const sx=g.x-cam.x, sy=g.y;
      if(sx<-60||sx>2000) continue;
      if(!drawImg(ctx,`gatito_walk${g.frameIdx}`,sx,sy,g.w,g.h)){
        ctx.fillStyle='#f97316';
        ctx.beginPath();ctx.ellipse(sx+16,sy+14,12,9,0,0,Math.PI*2);ctx.fill();
      }
    }

    for(const k of S.kitties){
      if(k.collected) continue;
      const sx=k.x-cam.x, sy=k.y;
      if(sx<-60||sx>2000) continue;
      ctx.save();
      if(!drawImg(ctx,`gatito_walk${k.frameIdx}`,sx,sy,k.w,k.h)){
        ctx.fillStyle='#f97316';
        ctx.beginPath();ctx.ellipse(sx+16,sy+14,12,9,0,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=(0.55+Math.sin(S.gameTime*2.5)*0.3)*0.45;
      ctx.fillStyle='#ffd93d';
      ctx.beginPath();ctx.arc(sx+k.w/2,sy+k.h/2,16,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 6 — PABLO (jaula / libre / pickup / gone)
  // ═══════════════════════════════════════════════════
  function drawPablo(ctx) {
    const p=S.pablo, cam=S.cam;
    if(p.state==='gone') return;
    const sx=p.x-cam.x, sy=p.y;
    // Usar ancho real del canvas para el check de visibilidad
    const canvasW = ctx.canvas ? ctx.canvas.width : 1920;
    if(sx < -p.w-100 || sx > canvasW+100) return;

    const pulse=0.55+Math.sin(p.glowPhase)*0.35;
    ctx.save();

    // Halo — tamaño y alpha según estado
    const glowR = p.state==='pickup' ? 70 : p.state==='idle' ? 58 : 50;
    const glowA = p.state==='pickup' ? pulse*0.90 : p.state==='idle' ? pulse*0.80 : pulse*0.52;
    const glow=ctx.createRadialGradient(sx+p.w/2,sy+p.h/2,0,sx+p.w/2,sy+p.h/2,glowR);
    glow.addColorStop(0,`rgba(255,215,0,${glowA})`);
    glow.addColorStop(1,'transparent');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(sx+p.w/2,sy+p.h/2,glowR,0,Math.PI*2);ctx.fill();

    if(p.state==='caged'){
      // ── Enjaulado ────────────────────────────────
      const fn=S.JAULA_CYCLE[p.frameIdx%S.JAULA_CYCLE.length];
      if(!drawImg(ctx,`jaula_pablo_${fn}`,sx,sy,p.w,p.h)){
        _drawCageFallback(ctx,sx,sy,p.w,p.h);
      }
      ctx.font='bold 13px Fredoka,system-ui';ctx.fillStyle='#ffd93d';ctx.textAlign='center';
      ctx.shadowColor='#000';ctx.shadowBlur=4;
      ctx.fillText('🐱 ¡Pablo!',sx+p.w/2,sy-10);ctx.shadowBlur=0;
      ctx.font='10px Fredoka,system-ui';ctx.fillStyle='rgba(220,220,220,0.9)';
      ctx.fillText('(derrota al Inspector)',sx+p.w/2,sy+p.h+14);

    } else if(p.state==='pickup'){
      // ── Subiendo con estrellitas ──────────────────
      const alpha=Math.max(0,1-(p.pickupTimer||0)/0.8);
      ctx.globalAlpha=alpha;
      if(!drawImg(ctx,`pablo_free_${p.freeFrameIdx||0}`,sx,sy,p.w,p.h)){
        _drawFreeFallback(ctx,sx,sy,p.w,p.h);
      }
      const t=S.gameTime;
      for(let i=0;i<6;i++){
        const a=t*4+i*Math.PI/3, r=28+Math.sin(t*3+i)*8;
        ctx.globalAlpha=alpha*(0.7+Math.sin(t*5+i)*0.3);
        ctx.font='14px system-ui';ctx.textAlign='center';
        ctx.fillText(['✨','⭐','💫','🌟'][i%4],sx+p.w/2+Math.cos(a)*r,sy+p.h/2+Math.sin(a)*r);
      }

    } else {
      // ── Libre (state==='idle'): se mueve en la plataforma ──
      const facing=p.freeFacing||1;
      ctx.translate(sx+p.w/2,sy+p.h/2);
      if(facing===-1) ctx.scale(-1,1);
      if(!drawImgAR(ctx,`pablo_free_${p.freeFrameIdx}`,0,0,p.h*1.1)){
        _drawFreeFallback(ctx,-p.w/2,-p.h/2,p.w,p.h);
      }
      ctx.setTransform(1,0,0,1,0,0);
      ctx.font='bold 13px Fredoka,system-ui';ctx.fillStyle='#ffd93d';ctx.textAlign='center';
      ctx.shadowColor='#000';ctx.shadowBlur=4;
      ctx.fillText('¡Pablo libre! 🎉',sx+p.w/2,sy-10);ctx.shadowBlur=0;
      if(Math.sin(S.gameTime*4)>0){
        ctx.font='11px Fredoka,system-ui';ctx.fillStyle='#fff';
        ctx.fillText('¡Tócalo para rescatarlo!',sx+p.w/2,sy+p.h+14);
      }
    }
    ctx.restore();
  }

  function _drawCageFallback(ctx,sx,sy,w,h){
    ctx.fillStyle='rgba(0,0,0,0.22)';
    ctx.beginPath();ctx.ellipse(sx+w/2,sy+h+4,w*0.45,6,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#887060';ctx.fillRect(sx-4,sy+h-4,w+8,8);
    ctx.fillStyle='rgba(180,140,50,0.12)';ctx.fillRect(sx+3,sy+3,w-6,h-6);
    ctx.strokeStyle='#c8a030';ctx.lineWidth=3;ctx.lineCap='round';
    for(let i=0;i<=4;i++){
      const bx=sx+4+i*(w-8)/4;
      ctx.beginPath();ctx.moveTo(bx,sy+6);ctx.lineTo(bx,sy+h-4);ctx.stroke();
    }
    ctx.strokeStyle='#d4aa38';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(sx+2,sy+6);ctx.lineTo(sx+w-2,sy+6);ctx.stroke();
    ctx.beginPath();ctx.moveTo(sx+2,sy+h-4);ctx.lineTo(sx+w-2,sy+h-4);ctx.stroke();
    ctx.fillStyle='#a08020';ctx.fillRect(sx+w/2-5,sy+h/2-4,10,8);
    ctx.strokeStyle='#c0a030';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(sx+w/2,sy+h/2-5,4,Math.PI,0);ctx.stroke();
    const ky=sy+h-28;
    ctx.fillStyle='#bbbbbb';ctx.beginPath();ctx.arc(sx+w/2,ky,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#aaaaaa';ctx.beginPath();ctx.ellipse(sx+w/2,ky+10,10,8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#336688';
    ctx.beginPath();ctx.arc(sx+w/2-4,ky-1,2.5,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(sx+w/2+4,ky-1,2.5,0,Math.PI*2);ctx.fill();
  }

  function _drawFreeFallback(ctx,sx,sy,w,h){
    ctx.fillStyle='#bbb';ctx.beginPath();ctx.ellipse(sx+w/2,sy+h/2+6,14,10,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ccc';ctx.beginPath();ctx.arc(sx+w/2,sy+h/2-10,11,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#aaa';
    ctx.beginPath();ctx.moveTo(sx+w/2-8,sy+h/2-18);ctx.lineTo(sx+w/2-4,sy+h/2-26);ctx.lineTo(sx+w/2,sy+h/2-18);ctx.fill();
    ctx.beginPath();ctx.moveTo(sx+w/2,sy+h/2-18);ctx.lineTo(sx+w/2+4,sy+h/2-26);ctx.lineTo(sx+w/2+8,sy+h/2-18);ctx.fill();
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 7 — GEM
  // ═══════════════════════════════════════════════════
  function drawGem(ctx) {
    if(S.pablo.state !== 'gone') return;
    const gem=S.gem, cam=S.cam;
    const sx=gem.x-cam.x, sy=gem.y;
    const canvasW = ctx.canvas ? ctx.canvas.width : 1920;
    if(sx < -100 || sx > canvasW+100) return;

    const pulse=0.65+Math.sin(gem.glowPhase)*0.35;
    ctx.save();
    const glow=ctx.createRadialGradient(sx+16,sy+16,0,sx+16,sy+16,50);
    glow.addColorStop(0,`rgba(255,215,0,${pulse*0.90})`);
    glow.addColorStop(0.5,`rgba(255,180,0,${pulse*0.40})`);
    glow.addColorStop(1,'transparent');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(sx+16,sy+16,50,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffd700';
    ctx.beginPath();
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+gem.glowPhase*0.6, r=i%2===0?16:8;
      i===0?ctx.moveTo(sx+16+Math.cos(a)*r,sy+16+Math.sin(a)*r)
           :ctx.lineTo(sx+16+Math.cos(a)*r,sy+16+Math.sin(a)*r);
    }
    ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,200,0.70)';
    ctx.beginPath();
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+gem.glowPhase*0.6, r=i%2===0?8:4;
      i===0?ctx.moveTo(sx+16+Math.cos(a)*r,sy+16+Math.sin(a)*r)
           :ctx.lineTo(sx+16+Math.cos(a)*r,sy+16+Math.sin(a)*r);
    }
    ctx.closePath();ctx.fill();
    ctx.font='bold 13px Fredoka,system-ui';ctx.fillStyle='#ffd700';ctx.textAlign='center';
    ctx.shadowColor='#000';ctx.shadowBlur=4;
    ctx.fillText('💎 ¡La Gema!',sx+16,sy-10);ctx.shadowBlur=0;
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 8 — ENEMIGOS
  // ═══════════════════════════════════════════════════
  function drawEnemies(ctx) {
    const cam=S.cam;
    for(const e of S.enemies){
      if(!e.alive) continue;
      const sx=e.x-cam.x, sy=e.y;
      if(sx<-100||sx>2000) continue;
      const dh=e.h*1.5;
      ctx.save();
      ctx.globalAlpha=e.stunTimer>0?0.5:1;
      ctx.translate(sx+e.w/2,sy+e.h/2);
      if(e.facing===1) ctx.scale(-1,1);
      const ikey=`${e.type}_${e.frameIdx}`;
      const drawn=drawImgAR(ctx,ikey,0,0,dh);
      if(!drawn){
        ctx.fillStyle=e.stunTimer>0?'#888':'#7c3aed';
        ctx.beginPath();ctx.ellipse(0,0,20,28,0,0,Math.PI*2);ctx.fill();
      } else if(e.stunTimer>0){
        const ii=img(ikey);
        const dw=dh*(ii.naturalWidth/ii.naturalHeight);
        ctx.globalCompositeOperation='source-atop';
        ctx.fillStyle='rgba(255,100,100,0.5)';ctx.fillRect(-dw/2,-dh/2,dw,dh);
      }
      ctx.restore();
      ctx.save();ctx.font='11px Fredoka,system-ui';ctx.fillStyle='#ffd93d';
      ctx.textAlign='center';ctx.fillText(e.label,sx+e.w/2,sy-5);ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 9 — BOSS
  // ═══════════════════════════════════════════════════
  function drawBoss(ctx) {
    const boss=S.boss, cam=S.cam;
    if(!boss.alive) return;
    const sx=boss.x-cam.x, sy=boss.y;
    const canvasW = ctx.canvas ? ctx.canvas.width : 1920;
    if(sx<-200||sx>canvasW+200) return;

    const ikey=`enemigo_jefe_${boss.frameIdx}`;
    const dh=boss.h*1.6*(1+(boss.bossPhase-1)*0.08);
    ctx.save();
    ctx.globalAlpha=boss.stunTimer>0?0.55:1;
    ctx.translate(sx+boss.w/2,sy+boss.h/2);
    if(boss.facing===1) ctx.scale(-1,1);
    const drawn=drawImgAR(ctx,ikey,0,0,dh);
    if(!drawn){
      ctx.fillStyle=boss.bossPhase===3?'#dc2626':boss.bossPhase===2?'#9333ea':'#6b7280';
      ctx.beginPath();ctx.ellipse(0,0,boss.w*0.42,boss.h*0.38,0,0,Math.PI*2);ctx.fill();
    } else if(boss.stunTimer>0){
      const ii=img(ikey);
      const dw=dh*(ii.naturalWidth/ii.naturalHeight);
      ctx.globalCompositeOperation='source-atop';
      ctx.fillStyle='rgba(255,50,50,0.55)';ctx.fillRect(-dw/2,-dh/2,dw,dh);
    }
    ctx.restore();

    // Barra HP
    const bw=boss.w*1.6, bx=sx+boss.w/2-bw/2, by=sy-20;
    const ratio=Math.max(0,boss.hp/boss.maxHp);
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.6)';ctx.beginPath();ctx.roundRect(bx,by,bw,10,5);ctx.fill();
    ctx.fillStyle=ratio>0.5?'#9333ea':ratio>0.25?'#f97316':'#ef4444';
    ctx.beginPath();ctx.roundRect(bx,by,bw*ratio,10,5);ctx.fill();
    ctx.font='bold 11px Fredoka,system-ui';ctx.fillStyle='#fff';ctx.textAlign='center';
    ctx.fillText(`👮 Inspector Corrupto — ${boss.hp}/${boss.maxHp}`,bx+bw/2,by-3);
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 10 — CORAZONCITOS
  // ═══════════════════════════════════════════════════
  function drawHearts(ctx) {
    const cam=S.cam;
    for(const h of S.ps.hearts){
      if(!h.active) continue;
      ctx.save();ctx.font=`${h.r*2}px system-ui`;ctx.textAlign='center';
      ctx.fillText('💗',h.x-cam.x,h.y);ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 11 — JUGADOR
  // ═══════════════════════════════════════════════════
  function drawPlayer(ctx) {
    const ps=S.ps, cam=S.cam;
    const ch=S.CHARS[S.selectedChar]||S.CHARS.nina;
    const sx=ps.x-cam.x, sy=ps.y;
    let fn;
    if(!ps.grounded)          fn=`${ch.prefix}_jump${Math.min(ps.jumpFrame,3)}`;
    else if(Math.abs(ps.vx)>20) fn=`${ch.prefix}_run${ps.runFrame}`;
    else                        fn=`${ch.prefix}_run0`;

    ctx.save();
    ctx.globalAlpha=ps.invTimer>0?0.45+Math.sin(S.gameTime*14)*0.45:1;
    ctx.translate(sx+ps.w/2,sy+ps.h/2);
    if(ps.facing===-1) ctx.scale(-1,1);
    if(!drawImgAR(ctx,fn,0,0,ps.h*1.7)){
      ctx.fillStyle=ch.color;ctx.beginPath();ctx.arc(0,0,ps.w/2,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════
  //  CAPA 12 — HUD
  // ═══════════════════════════════════════════════════
  function drawHUD(ctx, W, H) {
    const ps=S.ps, ch=S.CHARS[S.selectedChar]||S.CHARS.nina;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.60)';ctx.fillRect(0,0,W,44);
    ctx.font='bold 14px Fredoka,system-ui';ctx.fillStyle=ch.color;ctx.textAlign='left';
    ctx.fillText(ch.label,14,28);
    let hStr='';
    for(let i=0;i<ps.maxLives;i++) hStr+=i<ps.lives?'❤️':'🖤';
    ctx.font='16px system-ui';ctx.fillText(hStr,14+ch.label.length*9+8,30);
    ctx.font='bold 14px Fredoka,system-ui';ctx.fillStyle='#ffd93d';
    ctx.textAlign='center';ctx.fillText(`⭐ ${ps.score}`,W/2,28);
    ctx.fillStyle='#94a3b8';ctx.textAlign='right';ctx.font='12px Fredoka,system-ui';
    ctx.fillText('↓/🔥 corazoncito | ESC salir',W-12,28);
    ctx.textAlign='center';ctx.font='12px Fredoka,system-ui';
    if(!S.boss.alive&&!S.pablo.freed)       {ctx.fillStyle='#4ade80';ctx.fillText('¡Inspector derrotado! → Liberá a Pablo 🐱',W/2,H-8);}
    else if(S.pablo.freed&&!S.gem.collected){ctx.fillStyle='#ffd93d';ctx.fillText('¡Pablo libre! → Tomá la Gema 💎',W/2,H-8);}
    else if(!S.boss.alive)                  {ctx.fillStyle='#c77dff';ctx.fillText('¡Misión cumplida! Volviendo...',W/2,H-8);}
    else                                    {ctx.fillStyle='#fcd34d';ctx.fillText('→ Derrotá al Inspector para liberar a Pablo 🐱',W/2,H-8);}
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════
  //  TRANSICIONES
  // ═══════════════════════════════════════════════════
  function drawRainbow(ctx, W, H, t) {
    ctx.save();
    const n=S.TRANS_COLORS.length, sw=W/n;
    for(let i=0;i<n+2;i++){
      const xi=i*sw-(t*sw*0.9)%(sw*n);
      ctx.fillStyle=S.TRANS_COLORS[(i+Math.floor(t*3))%n];ctx.globalAlpha=0.87;
      ctx.beginPath();ctx.moveTo(xi,0);ctx.lineTo(xi+sw+H,0);
      ctx.lineTo(xi+sw,H);ctx.lineTo(xi-H,H);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }

  function drawSpiral(ctx, W, H, t) {
    ctx.save();ctx.translate(W/2,H/2);
    for(let i=8;i>=0;i--){
      const r=(i/8)*Math.min(W,H)*0.42, a=t*3+i*0.5;
      ctx.strokeStyle=S.TRANS_COLORS[i%S.TRANS_COLORS.length];
      ctx.lineWidth=5-i*0.4;ctx.globalAlpha=0.55+Math.sin(t*4+i)*0.3;
      ctx.beginPath();ctx.arc(Math.cos(a)*r*0.1,Math.sin(a)*r*0.1,r,0,Math.PI*2);ctx.stroke();
    }
    ctx.globalAlpha=0.9;
    const gc=ctx.createRadialGradient(0,0,0,0,0,55);
    gc.addColorStop(0,'#fff');gc.addColorStop(0.4,'#c77dff');gc.addColorStop(1,'transparent');
    ctx.fillStyle=gc;ctx.beginPath();ctx.arc(0,0,55,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  function drawSelect(ctx, W, H) {
    ctx.fillStyle='#0a0a1a';ctx.fillRect(0,0,W,H);
    const bg=img('fondo_rosario');
    if(bg){ctx.save();ctx.globalAlpha=0.28;ctx.drawImage(bg,0,0,W,H);ctx.restore();}
    ctx.save();ctx.globalAlpha=0.65;ctx.fillStyle='#0a0a1a';ctx.fillRect(0,0,W,H);ctx.restore();
    ctx.save();
    ctx.fillStyle='rgba(8,8,32,0.94)';
    ctx.beginPath();ctx.roundRect(W/2-315,H/2-205,630,410,20);ctx.fill();
    ctx.strokeStyle='#c77dff';ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(W/2-315,H/2-205,630,410,20);ctx.stroke();
    ctx.font='bold 24px Fredoka,system-ui';ctx.textAlign='center';ctx.fillStyle='#ffd93d';
    ctx.fillText('¡Misión en La Tierra!',W/2,H/2-158);
    ctx.font='15px Fredoka,system-ui';ctx.fillStyle='#c4b5fd';
    ctx.fillText('El Inspector Corrupto tiene enjaulado a Pablo 🐱',W/2,H/2-122);
    ctx.fillText('Liberalo y llevate la gema mágica.',W/2,H/2-100);
    ctx.font='18px Fredoka,system-ui';ctx.fillStyle='#ddd6fe';
    ctx.fillText('Elegí tu agente:',W/2,H/2-70);
    // Botones — también registran su zona para touch/click
    _drawCharBtn(ctx,W/2-165,H/2-50,'Nina',  'nina',  '#fde68a');
    _drawCharBtn(ctx,W/2+35, H/2-50,'Jazmín','jazmin','#7dd3fc');
    // Hint teclado — solo en desktop
    ctx.font='13px Fredoka,system-ui';ctx.fillStyle='#666';
    ctx.fillText('N = Nina   |   J = Jazmín',W/2,H/2+170);
    ctx.restore();
  }

  function _drawCharBtn(ctx, x, y, label, id, color) {
    const BW=130, BH=190;
    const sel=S.selectedChar===id;

    // Registrar zona para hit-test táctil (lazy — SubMision se define después)
    if(typeof SubMision !== 'undefined' && SubMision.registerBtnZone){
      SubMision.registerBtnZone(id, x, y, BW, BH);
    }

    ctx.save();
    // Fondo con highlight en hover/selected
    ctx.fillStyle=sel?color:'rgba(255,255,255,0.06)';
    ctx.beginPath();ctx.roundRect(x,y,BW,BH,12);ctx.fill();
    ctx.strokeStyle=color;ctx.lineWidth=sel?3:1;
    ctx.beginPath();ctx.roundRect(x,y,BW,BH,12);ctx.stroke();

    // Sprite del personaje
    const im=img(`${id}_run0`);
    if(im){const ar=im.naturalWidth/im.naturalHeight;const ih=112,iw=ih*ar;ctx.drawImage(im,x+65-iw/2,y+8,iw,ih);}
    else{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+65,y+68,36,0,Math.PI*2);ctx.fill();}

    // Nombre
    ctx.font='bold 16px Fredoka,system-ui';ctx.fillStyle=sel?'#000':'#fff';
    ctx.textAlign='center';ctx.fillText(label,x+65,y+172);

    // "Toca aquí" en móvil si no hay personaje seleccionado aún
    if(!sel && !S.selectedChar){
      ctx.font='11px Fredoka,system-ui';ctx.fillStyle='rgba(255,255,255,0.5)';
      ctx.fillText('Tocá aquí',x+65,y+BH-8);
    }
    ctx.restore();
  }

  return { drawFrame, drawBg, drawTilemap, drawProps, drawPlayer,
           drawEnemies, drawBoss, drawPablo, drawGem, drawKitties,
           drawHearts, drawHUD, drawRainbow, drawSpiral, drawSelect };

})();