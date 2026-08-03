// ═══════════════════════════════════════════════════════
//  RENDERER.JS — Coordinador principal
//
//  Orden de carga en index.html:
//    renderer_core.js       ← primero (define R)
//    renderer_bg.js
//    renderer_tiles.js
//    renderer_entities.js
//    renderer_fx.js
//    renderer.js            ← este archivo (último)
//
//  La API pública es idéntica al renderer.js original.
//  El engine y el resto del juego no necesitan ningún cambio.
// ═══════════════════════════════════════════════════════

const Renderer = (() => {

  // ── Init / resize ─────────────────────────────────────
  function init(canvasEl) {
    R.canvas = canvasEl;
    R.ctx    = canvasEl.getContext('2d');
    resize();
  }

  function resize() {
    if (!R.canvas) return;
    R.W = R.canvas.offsetWidth  || R.canvas.clientWidth  || window.innerWidth;
    R.H = R.canvas.offsetHeight || R.canvas.clientHeight || window.innerHeight;
    if (R.W > 0) R.canvas.width  = R.W;
    if (R.H > 0) R.canvas.height = R.H;
    // Invalidar cache de gradientes al cambiar tamaño
    try {
      if (typeof RendererBg !== 'undefined' && RendererBg._invalidateCache)
        RendererBg._invalidateCache();
    } catch(e) {}
  }

  function getSize() { return { W: R.W, H: R.H }; }
  function getCtx()  { return R.ctx; }

  function clear() {
    if (R.W > 0 && R.H > 0) R.ctx.clearRect(0, 0, R.W, R.H);
  }

  // ── API pública — delega a los módulos ────────────────

  // Fondo
  const drawBackground    = (level, camX, camY, ts) => RendererBg.drawBackground(level, camX, camY, ts);
  const drawBgTreesOverlay = (camX, camY, ts)       => RendererBg.drawOverlay(camX, camY, ts);
  const drawBgTrees        = (camX, camY, ts, dark)  => RendererBg.drawOverlay(camX, camY, ts); // legacy alias
  const showCastle         = ()                       => RendererBg.showCastle();
  const hideCastle         = ()                       => RendererBg.hideCastle();
  const resetCastle        = ()                       => RendererBg.resetCastle();

  // Tiles
  const drawTilemap        = (map, level, camX, camY) => RendererTiles.drawTilemap(map, level, camX, camY);
  const drawStarAnimated   = (x, y, ts, collected)    => RendererTiles.drawStarAnimated(x, y, ts, collected);
  const getTilePalette     = (level)                   => RendererTiles.getTilePalette(level);

  // Entities
  const drawPlayer         = (player, images, ts)             => RendererEntities.drawPlayer(player, images, ts);
  const drawEnemy          = ()                                => {};  // legacy no-op
  const drawProjectiles    = (proj, camX, camY, ts)           => RendererEntities.drawProjectiles(proj, camX, camY, ts);
  const drawFireballs      = (fb, camX, camY, ts)             => RendererEntities.drawFireballs(fb, camX, camY, ts);
  const drawMagicTrees     = (trees, camX, camY, ts)          => RendererEntities.drawMagicTrees(trees, camX, camY, ts);

  // FX
  // OJO: spawnParticles/spawnText reciben coordenadas de MUNDO.
  // El engine llama setFxCamera() una vez por frame y RendererFx
  // resta la cámara al dibujar.
  const setFxCamera             = (camX, camY)           => RendererFx.setCamera(camX, camY);
  const spawnParticles          = (x, y, color, count)  => RendererFx.spawnParticles(x, y, color, count);
  const updateAndDrawParticles  = (dt)                   => RendererFx.updateAndDrawParticles(dt);
  const flash                   = (color, strength)      => RendererFx.flash(color, strength);
  const drawFlash               = (dt)                   => RendererFx.drawFlash(dt);
  const spawnText               = (x, y, text, color)   => RendererFx.spawnText(x, y, text, color);
  const drawFloatingTexts       = (dt)                   => RendererFx.drawFloatingTexts(dt);
  const clearFx                 = ()                     => RendererFx.clear();

  return {
    init, resize, getSize, getCtx, clear,
    drawBackground, drawBgTreesOverlay, drawBgTrees,
    showCastle, hideCastle, resetCastle,
    drawTilemap, drawStarAnimated, getTilePalette,
    drawPlayer, drawEnemy, drawProjectiles, drawFireballs, drawMagicTrees,
    setFxCamera, clearFx,
    spawnParticles, updateAndDrawParticles,
    flash, drawFlash,
    spawnText, drawFloatingTexts,
  };

})();