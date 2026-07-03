// ═══════════════════════════════════════════════════════
//  RENDERER_ENTITIES.JS — Jugador, proyectiles, árbol mágico
//  Depende de: renderer_core.js
// ═══════════════════════════════════════════════════════

const RendererEntities = (() => {

  // ── Jugador ──────────────────────────────────────────
  function drawPlayer(player, images, ts) {
    const { ctx } = R;
    const { x, y, w, h, charId, facing, sliding, grounded, doubleJumped, floating } = player;
    const sizeMult = player.sizeMult || 1; // Súper Árbol Mágico — solo visual, no toca la hitbox

    ctx.save();

    // Sombra
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x+w/2, y+h+4, w*0.55, 7, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Aura arcoíris — Súper Árbol Mágico activo.
    // En los últimos 4s parpadea (como el aviso clásico de invencibilidad
    // por terminar): es el "indicador de tiempo restante" del efecto.
    if (sizeMult > 1.05) {
      const superTimer = player.superTimer || 0;
      const endingSoon = superTimer > 0 && superTimer < 4;
      const warn = endingSoon ? (0.4 + Math.sin(ts/70) * 0.6) : 1;
      const auraR = w * (0.75 + sizeMult * 0.25);
      const hue = (ts / 8) % 360;
      const pulse = (0.55 + Math.sin(ts / 140) * 0.2) * warn;
      const aura = ctx.createRadialGradient(x+w/2, y+h/2, 0, x+w/2, y+h/2, auraR);
      aura.addColorStop(0,   `hsla(${hue}, 90%, 70%, ${0.35 * pulse})`);
      aura.addColorStop(0.6, `hsla(${(hue+60)%360}, 90%, 65%, ${0.18 * pulse})`);
      aura.addColorStop(1,   'transparent');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(x+w/2, y+h/2, auraR, 0, Math.PI*2); ctx.fill();
    }

    const img = images[charId];
    if (img && img.complete && img.naturalWidth > 0) {
      // Dibujar respetando el aspect ratio del sprite (sin deformar) y un poco
      // más grande, anclado a los pies. La hitbox física (w,h) NO cambia.
      // sizeMult (Súper Árbol Mágico) se suma al mismo escalado visual.
      const ar = img.naturalWidth / img.naturalHeight;
      const dh = h * 1.15 * sizeMult;
      const dw = dh * ar;          // ancho proporcional → no se deforma
      const ox = (w - dw) / 2;     // centrado sobre la hitbox
      const oy = h - dh;           // pies alineados con la base de la hitbox
      ctx.save();
      if (facing === -1) {
        ctx.translate(x+w, y); ctx.scale(-1, 1);
        if (sliding) { ctx.translate(0, h*0.35); ctx.rotate(-0.45); }
        ctx.drawImage(img, ox, oy, dw, dh);
      } else {
        ctx.translate(x, y);
        if (sliding) {
          ctx.translate(w, h*0.35); ctx.scale(-1,1); ctx.rotate(-0.45); ctx.translate(-w, 0);
        }
        ctx.drawImage(img, ox, oy, dw, dh);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#a78bfa';
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${w*0.4}px Fredoka`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(charId ? charId[0].toUpperCase() : '?', x+w/2, y+h/2);
    }

    // Efecto doble salto
    if (doubleJumped && !grounded) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x+w/2, y+h/2, w*0.7, 0, Math.PI*2); ctx.stroke();
    }

    // Efecto float (Lunaria)
    if (floating) {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 2.5;
      ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.arc(x+w/2, y+h/2, w*0.85, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // Súper Árbol Mágico: multiplicador de tamaño SOLO visual para disparos
  // (nunca toca p.r/fb.r, que son el radio real de colisión).
  function _shotSizeMult() {
    return (typeof Player !== 'undefined' && Player.getState) ? (Player.getState().sizeMult || 1) : 1;
  }

  // ── Proyectiles ──────────────────────────────────────
  function drawProjectiles(projectiles, camX, camY, ts) {
    if (!projectiles || !projectiles.length) return;
    const { ctx } = R;
    const mult = _shotSizeMult();
    for (const p of projectiles) {
      if (!p.active) continue;
      const sx = p.x - camX, sy = p.y - camY;
      const r = p.r * mult; // radio VISUAL (el de colisión sigue siendo p.r)
      ctx.save();

      if (p.kind === 'ice') {
        const pulse = 0.7 + Math.sin(ts/80) * 0.3;
        const g = ctx.createRadialGradient(sx,sy,0,sx,sy,r*2.2);
        g.addColorStop(0, `rgba(186,230,253,${0.8*pulse})`);
        g.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(sx,sy,r*2.2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#e0f2fe'; ctx.beginPath();
        for(let i=0;i<6;i++){const a=i*Math.PI/3+ts/400;i===0?ctx.moveTo(sx+Math.cos(a)*r,sy+Math.sin(a)*r):ctx.lineTo(sx+Math.cos(a)*r,sy+Math.sin(a)*r);}
        ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(sx-r*0.25,sy-r*0.3,r*0.3,0,Math.PI*2); ctx.fill();

      } else if (p.kind === 'ray') {
        const alpha = (p.life/1.2)*0.9;
        ctx.globalAlpha=alpha;
        // Glow sin shadowBlur — dos strokes superpuestos
        ctx.strokeStyle='rgba(245,158,11,0.40)'; ctx.lineWidth=10*mult;
        ctx.beginPath(); ctx.moveTo(sx-p.vx*0.04,sy); ctx.lineTo(sx,sy); ctx.stroke();
        ctx.strokeStyle='#fde68a'; ctx.lineWidth=3*mult;
        ctx.beginPath(); ctx.moveTo(sx-p.vx*0.04,sy); ctx.lineTo(sx,sy); ctx.stroke();
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(sx,sy,r*0.55,0,Math.PI*2); ctx.fill();

      } else {
        const pulse = 0.6 + Math.sin(ts/60) * 0.4;
        const g = ctx.createRadialGradient(sx,sy,0,sx,sy,r*2.5);
        g.addColorStop(0,   `rgba(255,255,255,${0.9*pulse})`);
        g.addColorStop(0.4,  p.color+'cc');
        g.addColorStop(1,   p.color+'00');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(sx,sy,r*2.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(sx-r*0.28,sy-r*0.32,r*0.35,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ── Fireballs ─────────────────────────────────────────
  function drawFireballs(fireballs, camX, camY, ts) {
    if (!fireballs || !fireballs.length) return;
    const { ctx } = R;
    const mult = _shotSizeMult();
    for (const fb of fireballs) {
      if (!fb.active) continue;
      const sx=fb.x-camX, sy=fb.y-camY;
      const pulse = 0.7 + Math.sin(ts/60)*0.3;
      const r = fb.r * mult; // radio VISUAL (el de colisión sigue siendo fb.r)
      ctx.save();
      const glow=ctx.createRadialGradient(sx,sy,0,sx,sy,r*2.5);
      glow.addColorStop(0,   `rgba(255,200,50,${0.55*pulse})`);
      glow.addColorStop(0.5, `rgba(249,115,22,${0.35*pulse})`);
      glow.addColorStop(1,   'rgba(249,115,22,0)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(sx,sy,r*2.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#f97316'; ctx.beginPath(); ctx.arc(sx,sy,r*0.9,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(sx,sy,r*0.4,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // ── Árbol Mágico ─────────────────────────────────────
  function drawMagicTrees(trees, camX, camY, ts) {
    if (!trees) return;
    const { ctx } = R;
    for (const t of trees) {
      if (t.used) continue;
      const sx=t.x-camX, sy=t.y-camY;

      if (t.special) { _drawSuperMagicTree(ctx, sx, sy, ts); continue; }

      const bob   = Math.sin(ts/500)*3;
      const pulse = 0.6+Math.sin(ts/380)*0.3;
      ctx.save(); ctx.translate(sx, sy+bob);

      const glow=ctx.createRadialGradient(0,0,0,0,0,42);
      glow.addColorStop(0,   `rgba(74,222,128,${pulse*0.55})`);
      glow.addColorStop(0.5, `rgba(34,197,94,${pulse*0.28})`);
      glow.addColorStop(1,   'rgba(34,197,94,0)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(0,0,42,0,Math.PI*2); ctx.fill();

      ctx.fillStyle='#92400e'; ctx.fillRect(-5,8,10,20);
      ctx.fillStyle='#15803d'; ctx.beginPath(); ctx.arc(0,-4,22,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#16a34a'; ctx.beginPath(); ctx.arc(-8,-10,14,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#22c55e'; ctx.beginPath(); ctx.arc(8,-10,14,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#4ade80'; ctx.beginPath(); ctx.arc(0,-16,11,0,Math.PI*2); ctx.fill();

      ctx.fillStyle=`rgba(74,222,128,${pulse})`;
      for(let i=0;i<5;i++){
        const a=i*Math.PI*2/5+ts/900, r=24+Math.sin(ts/400+i)*4;
        ctx.beginPath(); ctx.arc(Math.cos(a)*r,Math.sin(a)*r-4,3,0,Math.PI*2); ctx.fill();
      }
      ctx.font='bold 13px Fredoka,system-ui'; ctx.textAlign='center';
      ctx.fillStyle='#fff'; ctx.fillText('🌳',0,-32);
      ctx.restore();
    }
  }

  // ── Súper Árbol Mágico — secreto raro y poderoso ─────
  // Mismo lenguaje visual que el Árbol Mágico normal (silueta reconocible),
  // pero arcoíris, mucho más brillante y con más partículas: debe leerse a
  // simple vista como "esto es distinto, esto es especial".
  function _drawSuperMagicTree(ctx, sx, sy, ts) {
    const bob   = Math.sin(ts/420)*4;
    const pulse = 0.7+Math.sin(ts/220)*0.3;
    const hue   = (ts/6) % 360;
    ctx.save(); ctx.translate(sx, sy+bob);

    // Glow — bien más grande y brillante que el árbol normal (radio 42→68)
    const glow=ctx.createRadialGradient(0,0,0,0,0,68);
    glow.addColorStop(0,   `hsla(${hue},95%,70%,${pulse*0.65})`);
    glow.addColorStop(0.5, `hsla(${(hue+40)%360},95%,60%,${pulse*0.35})`);
    glow.addColorStop(1,   'transparent');
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(0,0,68,0,Math.PI*2); ctx.fill();

    ctx.fillStyle='#92400e'; ctx.fillRect(-5,8,10,20);
    // Follaje — cada lóbulo con un matiz distinto del arcoíris (rotan con ts)
    ctx.fillStyle=`hsl(${hue},85%,55%)`;         ctx.beginPath(); ctx.arc(0,-4,22,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=`hsl(${(hue+60)%360},85%,58%)`; ctx.beginPath(); ctx.arc(-8,-10,14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=`hsl(${(hue+180)%360},85%,58%)`;ctx.beginPath(); ctx.arc(8,-10,14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=`hsl(${(hue+280)%360},90%,65%)`;ctx.beginPath(); ctx.arc(0,-16,11,0,Math.PI*2); ctx.fill();

    // Anillo de chispas arcoíris — más numerosas que el árbol normal
    for(let i=0;i<8;i++){
      const a=i*Math.PI*2/8+ts/700, r=28+Math.sin(ts/350+i)*5;
      ctx.fillStyle=`hsla(${(hue+i*45)%360},95%,68%,${pulse})`;
      ctx.beginPath(); ctx.arc(Math.cos(a)*r,Math.sin(a)*r-4,3.4,0,Math.PI*2); ctx.fill();
    }
    ctx.font='bold 15px Fredoka,system-ui'; ctx.textAlign='center';
    ctx.fillStyle='#fff'; ctx.fillText('🌈',0,-34);
    ctx.restore();
  }

  // drawEnemy mantenido por compatibilidad — el render real está en Enemies.drawAll()
  function drawEnemy() {}

  return { drawPlayer, drawProjectiles, drawFireballs, drawMagicTrees, drawEnemy };

})();