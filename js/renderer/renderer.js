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

  // Mínimo de mundo que queremos ver, en tiles. Por debajo de esto el juego
  // se vuelve injusto: los enemigos entran en cuadro sin tiempo de reacción y
  // no ves ni la plataforma de arriba ni el foso de abajo.
  const MIN_TILES_ANCHO = 17;
  const MIN_TILES_ALTO  = 12.5;
  const TS_REF          = 48;
  const DPR_MAX         = 2;   // más de 2x no se nota y cuesta el doble de fill-rate

  function resize() {
    if (!R.canvas) return;
    const cssW = R.canvas.offsetWidth  || R.canvas.clientWidth  || window.innerWidth;
    const cssH = R.canvas.offsetHeight || R.canvas.clientHeight || window.innerHeight;
    if (cssW <= 0 || cssH <= 0) return;

    // ── Densidad de píxeles ──
    // El buffer valía lo mismo que el tamaño CSS, así que en un teléfono de
    // DPR 2-3 el juego se dibujaba a 1x y lo escalaba el navegador: todo
    // borroso. Ahora el buffer va a resolución real de dispositivo.
    R.dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);

    // ── Zoom ──
    // El mundo se dibujaba 1 px = 1 px de pantalla. En un teléfono apaisado de
    // 375 px de alto eso son 7.8 tiles de un mapa de 16: no veías media
    // pantalla de nivel. Ahora, si la pantalla es chica, se aleja la cámara
    // hasta mostrar el mínimo jugable. En desktop el zoom queda en 1.
    R.zoom = Math.min(1,
      cssW / (MIN_TILES_ANCHO * TS_REF),
      cssH / (MIN_TILES_ALTO  * TS_REF));

    R.canvas.width  = Math.round(cssW * R.dpr);
    R.canvas.height = Math.round(cssH * R.dpr);

    // W/H son el viewport en UNIDADES DE MUNDO: cámara, culling y fondos
    // siguen razonando igual que antes sin enterarse del zoom ni del dpr.
    R.W = cssW / R.zoom;
    R.H = cssH / R.zoom;

    _aplicarTransform();

    // Invalidar cache de gradientes al cambiar tamaño
    try {
      if (typeof RendererBg !== 'undefined' && RendererBg._invalidateCache)
        RendererBg._invalidateCache();
    } catch(e) {}
  }

  function _aplicarTransform() {
    const k = R.dpr * R.zoom;
    R.ctx.setTransform(k, 0, 0, k, 0, 0);
  }

  function getSize() { return { W: R.W, H: R.H }; }
  function getCtx()  { return R.ctx; }
  function getZoom() { return R.zoom; }

  function clear() {
    if (!(R.W > 0 && R.H > 0)) return;
    // Limpiar el buffer COMPLETO en píxeles de dispositivo, no en unidades de
    // mundo: si no, con zoom < 1 quedaría una franja sin borrar.
    R.ctx.setTransform(1, 0, 0, 1, 0, 0);
    R.ctx.clearRect(0, 0, R.canvas.width, R.canvas.height);
    _aplicarTransform();
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
    init, resize, getSize, getCtx, getZoom, clear,
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