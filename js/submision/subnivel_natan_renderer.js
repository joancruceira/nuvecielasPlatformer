// ═══════════════════════════════════════════════════════
//  SUBNIVEL_NATAN_RENDERER.JS — Solo dibuja.
//  No decide física, no lee input.
//  SCROLL REAL: worldX - camX para todo elemento del mundo.
// ═══════════════════════════════════════════════════════

const SubNivelNatanRenderer = (() => {
  const C = SubNivelNatanConfig;
  const A = SubNivelNatanAssets;

  // ── Entry point ───────────────────────────────────────
  function draw(ctx, v) {
    const { W, H } = v;
    ctx.clearRect(0, 0, W, H);

    if (v.phase === C.PHASE.TRANSITION) { _drawTransition(ctx, v); return; }

    _drawBackgrounds(ctx, v);
    _drawGround(ctx, v);
    _drawPlatforms(ctx, v);
    _drawObstacles(ctx, v);
    _drawToys(ctx, v);
    _drawVeterinaria(ctx, v);
    _drawParticles(ctx, v);
    _drawEnemies(ctx, v);
    _drawRays(ctx, v);
    _drawNatan(ctx, v);
    _drawHUD(ctx, v);
    _drawMessage(ctx, v);
    if (v.phase === C.PHASE.FINAL) _drawFinalOverlay(ctx, v);
  }

  // ── TRANSICIÓN DE ENTRADA ─────────────────────────────
  function _drawTransition(ctx, { W, H, transitionT, particles }) {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Texto intro
    const alpha = Math.min(1, transitionT * 2.5);
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${Math.min(W * 0.08, 52)}px Fredoka,system-ui`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#facc15';
    ctx.fillText('⚡ SUPER NATAN ⚡', W / 2, H * 0.38);
    ctx.font = `${Math.min(W * 0.038, 22)}px Fredoka,system-ui`;
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Entrando al pasadizo secreto...', W / 2, H * 0.52);

    // Barra de carga
    const bw = Math.min(380, W * 0.58);
    const bx = (W - bw) / 2;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    _roundRect(ctx, bx, H * 0.65, bw, 10, 5, true);
    ctx.fillStyle = '#38bdf8';
    _roundRect(ctx, bx, H * 0.65, bw * Math.min(1, transitionT), 10, 5, true);
    ctx.restore();

    _drawParticles(ctx, { particles });
  }

  function _drawBackgrounds(ctx, v) {
    const { W, H, camX, phase } = v;

    if (phase === C.PHASE.FINAL) {
      _drawSky(ctx, v); return;
    }

    if (phase === C.PHASE.VUELO) {
      // Transición gradual: skyAlpha va de 0→1 mientras Natan sube
      const alpha = v.skyAlpha != null ? v.skyAlpha : 1;
      if (alpha >= 1) { _drawSky(ctx, v); return; }
      // Dibuja tierra debajo, cielo encima con alpha
      _drawTierraSegments(ctx, v);
      ctx.save();
      ctx.globalAlpha = alpha;
      _drawSky(ctx, v);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // Fase tierra: fondo normal
    _drawTierraSegments(ctx, v);
  }

  function _drawTierraSegments(ctx, v) {
    const { W, H, camX } = v;

    // Color de fondo: tomamos el color del cielo de la última imagen para que no haya corte
    ctx.fillStyle = '#3b6e9e';
    ctx.fillRect(0, 0, W, H);

    // Posicionamos cada segmento acumulando el ancho REAL dibujado (escala por altura),
    // no BG_WIDTHS (que son anchos de imagen sin escalar). Así no hay gaps.
    let worldCursor = 0;
    C.BACKGROUND_SEGMENTS.forEach(seg => {
      const img = A.get(`bg_tierra_${seg.index}`);
      if (!img || !img.naturalHeight) return;

      const scale = H / img.naturalHeight;
      const drawW = img.naturalWidth * scale;

      const screenX = worldCursor - camX;
      worldCursor += drawW;

      if (screenX > W + 10 || screenX + drawW < -10) return;

      ctx.drawImage(img, screenX, 0, drawW, H);
    });
  }

  function _drawSky(ctx, v) {
    const { W, H, camX } = v;
    const img = A.get('bg_cielo');
    if (img) {
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth  * scale;
      const dh = img.naturalHeight * scale;
      // Parallax lento para el cielo
      const off = ((camX * 0.15) % dw + dw) % dw;
      ctx.drawImage(img, -off,      (H - dh) / 2, dw, dh);
      ctx.drawImage(img, -off + dw, (H - dh) / 2, dw, dh);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0284c7');
      g.addColorStop(1, '#bae6fd');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function _drawFallbackSeg(ctx, x, y, w, h, idx) {
    const colors = ['#7dd3fc','#6ee7b7','#fde68a','#c4b5fd','#fca5a5','#86efac','#93c5fd','#fdba74'];
    ctx.fillStyle = colors[idx % colors.length] || '#7dd3fc';
    ctx.fillRect(x, y, w, h);
  }

  // ── SUELO ─────────────────────────────────────────────
  function _drawGround(ctx, v) {
    if (v.phase === C.PHASE.VUELO) return;
    const { W, H, groundY, natan } = v;
    const surfaceY = groundY + natan.h;
    ctx.save();
    // Franja de pasto
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, surfaceY - 6, W, 6);
    // Tierra debajo
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, surfaceY, W, H - surfaceY);
    ctx.restore();
  }

  // ── PLATAFORMAS ───────────────────────────────────────
  function _drawPlatforms(ctx, v) {
    if (v.phase !== C.PHASE.TIERRA) return;
    const { H, groundY, natan, camX } = v;
    const surfaceY = groundY + natan.h;
    ctx.save();
    C.PLATFORMS.forEach(p => {
      const sx = p.x - camX;
      if (sx + p.w < -10 || sx > v.W + 10) return;
      const py = surfaceY - H * p.yRel - p.h;
      ctx.fillStyle = '#78350f';
      ctx.fillRect(sx, py, p.w, p.h);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(sx, py, p.w, 4);
    });
    ctx.restore();
  }

  // ── OBSTÁCULOS DECORATIVOS ────────────────────────────
  function _drawObstacles(ctx, v) {
    if (v.phase !== C.PHASE.TIERRA) return;
    const { H, groundY, natan, camX } = v;
    const surfaceY = groundY + natan.h;

    C.OBSTACLES.forEach(o => {
      const sx = o.x - camX;
      if (sx + o.w < -80 || sx > v.W + 80) return;
      ctx.save();
      if (o.type === 'poste') {
        ctx.fillStyle = '#5b3a1d';
        ctx.fillRect(sx, surfaceY - o.h, o.w, o.h);
        // Cable eléctrico
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 180, surfaceY - o.h + 22);
        ctx.quadraticCurveTo(sx, surfaceY - o.h + 45, sx + 220, surfaceY - o.h + 28);
        ctx.stroke();
      } else if (o.type === 'banco') {
        ctx.fillStyle = '#92400e';
        ctx.fillRect(sx, surfaceY - o.h, o.w, o.h);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(sx+5, surfaceY - o.h + 5, o.w-10, 6);
        // Patas
        ctx.fillRect(sx + 8,  surfaceY - o.h + o.h - 6, 14, 6);
        ctx.fillRect(sx + o.w - 22, surfaceY - o.h + o.h - 6, 14, 6);
      } else if (o.type === 'caja') {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(sx, surfaceY - o.h, o.w, o.h);
        ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2;
        ctx.strokeRect(sx+3, surfaceY - o.h + 3, o.w-6, o.h-6);
      } else if (o.type === 'cartel') {
        _drawCartel(ctx, sx, surfaceY - o.h - 15, o.w, o.h, o.text, o.subtext);
      }
      ctx.restore();
    });
  }

  function _drawCartel(ctx, x, y, w, h, text, sub) {
    // Postes
    ctx.fillStyle = '#5b3a1d';
    ctx.fillRect(x + 20, y + h, 14, 70);
    ctx.fillRect(x + w - 34, y + h, 14, 70);
    // Panel
    ctx.fillStyle = '#fde68a';
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 4;
    _roundRect(ctx, x, y, w, h, 8, true, true);
    // Texto
    ctx.font = `bold ${Math.min(w * 0.13, 22)}px Fredoka,system-ui`;
    ctx.textAlign = 'center'; ctx.fillStyle = '#1f2937';
    ctx.fillText(text, x + w / 2, y + h * 0.48);
    if (sub) {
      ctx.font = `${Math.min(w * 0.10, 16)}px Fredoka,system-ui`;
      ctx.fillStyle = '#1d4ed8';
      ctx.fillText(sub, x + w / 2, y + h * 0.78);
    }
  }

  // ── JUGUETES ──────────────────────────────────────────
  function _drawToys(ctx, v) {
    if (!v.toys) return;
    const { H, groundY, natan, camX, time, phase } = v;
    const toyZone = phase === C.PHASE.VUELO ? 'vuelo' : 'tierra';

    v.toys.forEach(t => {
      if (t.collected) return;
      if (t.zone !== toyZone && t.zone !== 'tierra') return;

      const sx = t.x - camX;
      if (sx < -60 || sx > v.W + 60) return;

      const ty = t.onPlatform
        ? groundY + natan.h - H * 0.60
        : H * t.yPct - 20;

      // Flotación suave
      const bob = Math.sin(time * 3.5 + t.x * 0.01) * 5;
      const sy = ty + bob;

      ctx.save();
      // Sombra
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(sx + 18, ty + 38, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Brillo pulsante
      const pulse = 0.55 + Math.sin(time * 4 + t.x * 0.02) * 0.20;
      const glow = ctx.createRadialGradient(sx+18, sy+18, 0, sx+18, sy+18, 28);
      glow.addColorStop(0, `rgba(255,255,180,${pulse})`);
      glow.addColorStop(1, 'rgba(255,255,180,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sx+18, sy+18, 28, 0, Math.PI*2); ctx.fill();

      // Emoji del juguete
      ctx.font = '36px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.icon, sx + 18, sy + 16);

      // Puntuación flotante pequeña
      ctx.font = 'bold 11px Fredoka,system-ui';
      ctx.fillStyle = '#facc15';
      ctx.fillText(`+${t.score}`, sx + 18, sy + 40);
      ctx.restore();
    });
  }

  // ── VETERINARIA ───────────────────────────────────────
  function _drawVeterinaria(ctx, v) {
    const { camX, groundY, natan, time, H, W, phase } = v;
    const vetScreenX = C.WORLD.vetX - camX;
    if (vetScreenX > W + 20 || vetScreenX + 340 < -20) return;

    const surfaceY = groundY + natan.h;
    const vw = 320, vh = 300;
    const x = vetScreenX;
    const vy = surfaceY - vh;

    // Imagen PNG de la veterinaria
    const img = A.get('veterinaria');
    ctx.save();
    if (img) {
      // Fondo negro → transparent: la imagen tiene fondo negro, hacemos destination-out
      // Simplemente la dibujamos — tiene fondo negro, usamos globalCompositeOperation
      ctx.drawImage(img, x, vy, vw, vh);
    } else {
      // Fallback si aún no cargó
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x, vy, vw, vh);
      ctx.font = 'bold 16px system-ui';
      ctx.fillStyle = '#334155';
      ctx.textAlign = 'center';
      ctx.fillText('🐾 VETERINARIA', x + vw/2, vy + vh/2);
    }

    // Cleopatra asomándose cuando Natan se acerca
    if (natan.x > C.WORLD.vetX - 800) {
      const bob = Math.sin(time * 5) * 4;
      ctx.font = '32px serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐱', x + vw * 0.5, vy + vh * 0.38 + bob);
    }
    ctx.restore();

    // ── FLECHA "sube aquí" al final de fase tierra ─────
    if (phase === C.PHASE.TIERRA) {
      const arrowX = vetScreenX - 80;
      if (arrowX > -60 && arrowX < W + 60) {
        const bob = Math.sin(time * 4) * 10;
        const alpha = 0.6 + Math.sin(time * 4) * 0.4;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        // Flecha hacia arriba
        const ax = arrowX, ay = surfaceY - 80 + bob;
        ctx.beginPath();
        ctx.moveTo(ax,      ay);
        ctx.lineTo(ax - 22, ay + 36);
        ctx.lineTo(ax - 10, ay + 36);
        ctx.lineTo(ax - 10, ay + 68);
        ctx.lineTo(ax + 10, ay + 68);
        ctx.lineTo(ax + 10, ay + 36);
        ctx.lineTo(ax + 22, ay + 36);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Texto
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 13px Fredoka,system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('¡Sube!', ax, ay + 86);
        ctx.restore();
      }
    }
  }

  // ── ENEMIGOS ──────────────────────────────────────────
  function _drawEnemies(ctx, v) {
    v.enemies.forEach(e => {
      // Dibujar si está vivo O si está en estado death (explosión en curso)
      if (!e.alive && e.state !== 'death') return;
      SNEnemies.drawEnemy(ctx, e, v.camX, 0);
    });
  }

  // ── RAYOS ─────────────────────────────────────────────
  function _drawRays(ctx, v) {
    v.rays.forEach(r => {
      if (!r.active) return;
      const sx = r.x - v.camX;
      ctx.save();
      ctx.globalAlpha = Math.min(1, r.life * 2.2);
      // Glow exterior
      const g = ctx.createRadialGradient(sx, r.y, 0, sx, r.y, r.r * 3.2);
      g.addColorStop(0,   'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(250,204,21,0.85)');
      g.addColorStop(1,   'rgba(250,204,21,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, r.y, r.r * 3.2, 0, Math.PI*2); ctx.fill();
      // Núcleo blanco
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(sx, r.y, r.r * 0.55, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
  }

  // ── NATAN ─────────────────────────────────────────────
  function _drawNatan(ctx, v) {
    const { natan:N, flying, camX, time } = v;
    if (N.invTimer > 0 && Math.floor(time * 12) % 2 === 0) return;

    const sx = N.x - camX;

    // Aura de vuelo
    if (flying) {
      ctx.save();
      const pulse = 0.28 + Math.sin(time * 4) * 0.12;
      const glow = ctx.createRadialGradient(sx+N.w/2, N.y+N.h/2, 0, sx+N.w/2, N.y+N.h/2, 64);
      glow.addColorStop(0, `rgba(56,189,248,${pulse})`);
      glow.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sx+N.w/2, N.y+N.h/2, 64, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Seleccionar animación — BUG 5 FIX: estado idle
    let key;
    const fi = N.fi;
    if      (N.state === 'attack')  key = `natan_attack${fi % 4}`;
    else if (N.state === 'hurt')    key = `natan_hurt${fi % 3}`;
    else if (N.state === 'landing') key = `natan_landing${fi % 2}`;
    else if (flying)                key = `natan_fly${fi % 4}`;
    else if (N.state === 'idle')    key = 'natan_idle';
    else                            key = `natan_run${fi % 6}`;

    const img = A.get(key);
    ctx.save();
    ctx.translate(sx + N.w/2, N.y + N.h/2);
    if (N.facing === -1) ctx.scale(-1, 1);
    if (img) {
      ctx.drawImage(img, -N.w/2, -N.h/2, N.w, N.h);
    } else {
      ctx.font = `${N.h * 0.85}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(flying ? '🦸' : '🏃', 0, 0);
    }
    ctx.restore();
  }

  // ── PARTÍCULAS ────────────────────────────────────────
  function _drawParticles(ctx, { particles }) {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle   = p.color;
      if (p.star) {
        ctx.font = `${p.r * 2.8}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✦', p.x, p.y);
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    });
  }

  // ── HUD ───────────────────────────────────────────────
  function _drawHUD(ctx, v) {
    const { W, H, natan:N, flying, score, phase } = v;
    ctx.save();

    // Panel fondo HUD
    ctx.fillStyle = 'rgba(15,23,42,0.70)';
    _roundRect(ctx, 12, 10, Math.min(460, W - 24), 60, 10, true, false);

    // Nombre + corazones
    ctx.font = 'bold 15px Fredoka,system-ui';
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff';
    ctx.fillText(C.PLAYER.name, 26, 34);
    let hearts = '';
    for (let i = 0; i < N.maxHp; i++) hearts += i < N.hp ? '❤️' : '🖤';
    ctx.fillText(hearts, 175, 34);

    // Score
    ctx.font = 'bold 13px Fredoka,system-ui';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`⭐ ${String(score).padStart(5,'0')}`, 26, 58);

    // Fase label
    const phaseLabel = {
      tierra:'BARRIO ALBERDI', vuelo:'VOLANDO A LA VETERINARIA',
      final:'¡VICTORIA!', transition:'PASADIZO SECRETO',
    }[phase] || '';
    ctx.textAlign = 'right'; ctx.fillStyle = '#38bdf8';
    ctx.fillText(phaseLabel, Math.min(460, W - 24), 58);

    // Barra de progreso
    const prog    = Math.max(0, Math.min(1, N.x / C.WORLD.vetX));
    const bx = 16, by = 78, bw = W - 38, bh = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    _roundRect(ctx, bx, by, bw, bh, 5, true, false);
    ctx.fillStyle = phase === 'vuelo' ? '#38bdf8' : '#22c55e';
    _roundRect(ctx, bx, by, bw * prog, bh, 5, true, false);
    // Iconos
    ctx.font = '16px serif'; ctx.textAlign = 'center';
    ctx.fillText('🦸', bx + bw * prog, by + 22);
    ctx.fillText('🐾', bx + bw + 8,    by + 14);
    ctx.font = '11px Fredoka,system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(`${Math.round(prog * 100)}%`, bx + bw - 26, by + 24);

    // Hint modo
    const hint = flying
      ? '↑ subir  ↓ bajar  ← → avanzar  Z disparar'
      : '← → correr  ↑ saltar  ↑↑ = volar (desde x=2400)  Z disparar';
    ctx.textAlign = 'center'; ctx.font = '11px Fredoka,system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(hint, W / 2, H - 10);

    ctx.restore();
  }

  // ── MENSAJE CENTRAL ───────────────────────────────────
  function _drawMessage(ctx, v) {
    if (!v.message) return;
    const { W, H } = v;
    const m = v.message;
    ctx.save();
    ctx.globalAlpha = m.alpha;
    ctx.font = `bold ${Math.min(W * 0.065, 42)}px Fredoka,system-ui`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(m.text, W/2+2, H*0.28+2);
    ctx.fillStyle = m.color;
    ctx.fillText(m.text, W/2, H*0.28);
    ctx.restore();
  }

  // ── OVERLAY FINAL ─────────────────────────────────────
  function _drawFinalOverlay(ctx, v) {
    const { W, H, time, natan:N } = v;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const pulse = 1 + Math.sin(time * 4) * 0.03;
    ctx.font = `bold ${Math.min(W*0.08,46)*pulse}px Fredoka,system-ui`;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText('¡Cleopatra está a salvo!', W/2+2, H*0.36+2);
    ctx.fillStyle = '#facc15';
    ctx.fillText('¡Cleopatra está a salvo!', W/2, H*0.36);
    ctx.font = `${Math.min(W*0.042,26)}px serif`;
    ctx.fillText('🐱  🦸  🐾', W/2, H*0.48);
    if (v.finalTimer > 1.2) {
      ctx.font = `${Math.min(W*0.036,20)}px Fredoka,system-ui`;
      ctx.fillStyle = 'rgba(255,220,80,0.95)';
      ctx.fillText('"Cleopatra, ya llegué! Manolandia puede esperar."', W/2, H*0.60);
    }
    if (v.finalTimer > 2.2) {
      const patas = N.hp >= 5 ? 3 : N.hp >= 3 ? 2 : 1;
      ctx.font = `${Math.min(W*0.055,32)}px serif`;
      ctx.fillText('🐾'.repeat(patas) + '🤍'.repeat(3-patas), W/2, H*0.72);
    }
    ctx.font = `${Math.min(W*0.03,16)}px Fredoka,system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('Volviendo al Sendero Nocturno...', W/2, H*0.84);
    ctx.restore();
  }

  // ── Helper ────────────────────────────────────────────
  function _roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (w <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
    if (fill)   ctx.fill();
    if (stroke) ctx.stroke();
  }

  return { draw };
})();