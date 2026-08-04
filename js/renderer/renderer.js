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
  // Bajados de 17x12.5 a 13x9.5: con 12.5 tiles de alto, en un teléfono de
  // 365 px el personaje quedaba de 35 px y "se veía muy chiquito". Y el ancho
  // de 17 no servía de nada si lo que se ve es diminuto. Además el HUD y los
  // controles tapan ~189 de esos 365 px, así que la franja de juego real es
  // la mitad de lo que decía la cuenta.
  const MIN_TILES_ANCHO = 13;
  const MIN_TILES_ALTO  = 9.5;
  const TS_REF          = 48;
  const DPR_MAX         = 2;   // más de 2x no se nota y cuesta el doble de fill-rate

  // Alto real de todos los niveles. Es el techo duro del alejamiento: pedir
  // más mundo del que el mapa tiene sólo agrega franjas vacías.
  const ALTO_MAPA_TILES = 16;
  const ZOOM_MAX        = 1.7;   // tope de acercamiento en pantallas angostas

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
    // El mundo se dibujaba 1 px = 1 px de pantalla, sin importar el tamaño de
    // la pantalla. Si es chica, hay que alejar la cámara para mostrar un
    // mínimo jugable; en desktop el zoom queda en 1.
    const deseado = Math.min(1,
      cssW / (MIN_TILES_ANCHO * TS_REF),
      cssH / (MIN_TILES_ALTO  * TS_REF));

    // Techo duro del alejamiento: NUNCA mostrar más alto de mundo del que el
    // mapa realmente tiene.
    //
    // Sin esto, en un teléfono en VERTICAL el mínimo de 17 tiles de ancho
    // forzaba un zoom de 0.50, y con ese zoom entraban 35 tiles de alto en un
    // mapa de 16: casi 20 tiles de fondo vacío arriba y abajo, y todo dibujado
    // a la mitad de tamaño. Es lo que se veía "muy chiquito".
    //
    // En pantallas angostas esto obliga a ACERCAR (zoom > 1), que es lo
    // correcto: se ve menos ancho pero a tamaño legible y sin franjas muertas.
    const minParaLlenarAlto = cssH / (ALTO_MAPA_TILES * TS_REF);
    R.zoom = Math.max(deseado, Math.min(minParaLlenarAlto, ZOOM_MAX));

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