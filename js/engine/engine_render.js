// ═══════════════════════════════════════════════════════
//  ENGINE_RENDER.JS — Render frame del juego principal
//  Depende de: renderer modules, engine.js (EngineState)
//
//  Responsabilidades:
//  - Render completo de un frame del juego
//  - Coleccionables (estrellas)
//  - Checkpoints (bandera)
//  - Portales (vórtice animado)
//  - Jugador, enemigos, proyectiles
//  - FX (partículas, flash, texto flotante)
//
//  Expone: EngineRender.frame(timestamp, dt, state)
//  `state` contiene: map, levelData, cam, collectibles,
//                    checkpoints, portals, magicTrees
// ═══════════════════════════════════════════════════════

const EngineRender = (() => {

  const TS = 48; // TILE_SIZE

  // ── Frame completo ─────────────────────────────────────
  function frame(timestamp, dt, state) {
    const { map, levelData, cam, collectibles, checkpoints, portals, magicTrees } = state;

    Renderer.clear();

    // ── SubMisión activa: delegarle el render completo ──
    if (SubMision.isActive()) {
      const { W, H } = Renderer.getSize();
      SubMision.update(dt, Renderer.getCtx(), W, H);
      return;
    }

    // ── Sub-misión Natan activa ──────────────────────────
    if (typeof SubMisionNatan !== 'undefined' && SubMisionNatan.isActive()) {
      const { W, H } = Renderer.getSize();
      SubMisionNatan.update(dt, Renderer.getCtx(), W, H);
      return;
    }

    // ── Fondo ───────────────────────────────────────────
    Renderer.drawBackground(levelData, cam.x, cam.y, timestamp);
    GiftBox.drawRainbowBg(Renderer.getCtx(), Renderer.getSize().W, Renderer.getSize().H, timestamp);
    MagicDoor.drawRainbowBg(Renderer.getCtx(), Renderer.getSize().W, Renderer.getSize().H, timestamp);

    // ── Tilemap ─────────────────────────────────────────
    Renderer.drawTilemap(map, levelData, cam.x, cam.y);
    Renderer.drawBgTreesOverlay(cam.x, cam.y, timestamp);

    const ctx = Renderer.getCtx();

    // ── Coleccionables (estrellas) ───────────────────────
    for (const col of collectibles) {
      if (col.collected) continue;
      Renderer.drawStarAnimated(col.x - cam.x, col.y - cam.y, timestamp, false);
    }

    // ── Checkpoints (bandera) ────────────────────────────
    _drawCheckpoints(ctx, checkpoints, cam, timestamp);

    // ── Portales ─────────────────────────────────────────
    _drawPortals(ctx, portals, cam, timestamp);

    // ── Mecánicas de nivel (caja sorpresa, puerta mágica) ─
    GiftBox.draw(ctx, cam.x, cam.y, timestamp);
    MagicDoor.draw(ctx, cam.x, cam.y, timestamp);
    if (typeof Cueva !== 'undefined') Cueva.draw(ctx, cam.x, cam.y, timestamp);

    // ── Enemigos ─────────────────────────────────────────
    Enemies.drawAll(ctx, cam.x, cam.y, timestamp);

    // ── Árbol mágico ─────────────────────────────────────
    Renderer.drawMagicTrees(magicTrees, cam.x, cam.y, timestamp);

    // ── Jugador ──────────────────────────────────────────
    const ps      = Player.getState();
    const images  = UI.getImages();
    const visible = !ps.invincible || Math.floor(timestamp / 90) % 2 === 0;
    if (visible) {
      Renderer.drawPlayer({ ...ps, x: ps.x - cam.x, y: ps.y - cam.y }, images, timestamp);
    }

    // ── Proyectiles y fireballs ───────────────────────────
    Renderer.drawFireballs(Player.getFireballs(), cam.x, cam.y, timestamp);
    Renderer.drawProjectiles(Player.getProjectiles(), cam.x, cam.y, timestamp);

    // ── FX ───────────────────────────────────────────────
    Renderer.updateAndDrawParticles(Math.min(1/30, 1/60));
    Renderer.drawFloatingTexts(Math.min(1/30, 1/60));
    Renderer.drawFlash();
  }

  // ── Checkpoints ──────────────────────────────────────
  function _drawCheckpoints(ctx, checkpoints, cam, ts) {
    for (const cp of checkpoints) {
      const sx = cp.x - cam.x;
      const sy = cp.y - cam.y - TS;
      ctx.save();
      ctx.fillStyle = cp.activated ? '#4ade80' : '#94a3b8';
      // Poste de la bandera
      ctx.fillRect(sx-2, sy+4, 4, TS-8);
      // Bandera triangular
      ctx.beginPath();
      ctx.moveTo(sx+2,  sy+6);
      ctx.lineTo(sx + (cp.activated ? 22 : 18), sy + (cp.activated ? 14 : 13));
      ctx.lineTo(sx+2,  sy + (cp.activated ? 22 : 20));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Portales ─────────────────────────────────────────
  function _drawPortals(ctx, portals, cam, ts) {
    for (const p of portals) {
      if (!p.active) continue;
      const sx = p.x - cam.x;
      const sy = p.y - cam.y;

      // Vórtice giratorio
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ts / 1200);
      ctx.translate(-sx, -sy);

      const gr = ctx.createRadialGradient(sx, sy, 5, sx, sy, 40);
      gr.addColorStop(0,   'rgba(255,255,255,.95)');
      gr.addColorStop(0.3, 'rgba(167,139,250,.85)');
      gr.addColorStop(0.7, 'rgba(99,102,241,.60)');
      gr.addColorStop(1,   'transparent');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(sx, sy, 46, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      // Núcleo blanco
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.90)';
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  return { frame };

})();