// ═══════════════════════════════════════════════════════
//  ENGINE.JS — Game loop, cámara, coleccionables, niveles
//  Mobile-optimized: multi-touch, double-tap jump,
//  orientation handling, performance tweaks
// ═══════════════════════════════════════════════════════

const Engine = (() => {

  const TILE_SIZE_C = 48;
  const CAM_LERP    = 8;

  let running  = false;
  let paused   = false;
  let lastTs   = 0;
  let rafId    = null;

  let currentLevelIdx = 0;
  let levelData = null;
  let map       = null;

  const cam = { x: 0, y: 0, targetX: 0, targetY: 0 };

  let collectibles = [];
  let checkpoints  = [];
  let portals      = [];

  let onGameOver   = null;
  let onLevelClear = null;
  let onPause      = null;

  const input = {
    left: false, right: false,
    jumpPressed: false, jumpHeld: false,
    down: false,
  };
  const _keys = {};

  // ── Multi-touch tracking ──
  // Cada botón puede tener su propio pointerId activo
  const _touchMap = {}; // pointerId → buttonId

  // ── Double-tap para doble salto en zona derecha del canvas ──
  let _lastTapTime  = 0;
  let _lastTapSide  = ''; // 'left' | 'right'
  const DBL_TAP_MS  = 280;

  // ──────────────────────────────────────────
  //  INIT
  // ──────────────────────────────────────────
  function init(canvasEl, callbacks = {}) {
    Renderer.init(canvasEl);
    initLevels();

    onGameOver   = callbacks.onGameOver   || (() => {});
    onLevelClear = callbacks.onLevelClear || (() => {});
    onPause      = callbacks.onPause      || (() => {});

    setupKeyboard();
    setupMobileControls();
    setupCanvasTouch(canvasEl);
    setupOrientationHandler();
  }

  // ──────────────────────────────────────────
  //  EMPEZAR JUEGO
  // ──────────────────────────────────────────
  function startGame(charId, levelIdx = 0) {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }

    currentLevelIdx = levelIdx;
    loadLevel(levelIdx);

    const prevStars = levelIdx > 0 ? Player.getState().stars : 0;
    const prevLives = levelIdx > 0 ? Player.getState().lives : 3;
    Player.init(charId, 2 * TILE_SIZE_C, (13 - 2) * TILE_SIZE_C);
    if (levelIdx > 0) {
      Player.getState().stars = prevStars;
      Player.getState().lives = prevLives;
    }

    running = true;
    paused  = false;
    lastTs  = 0;
    resetInput();
    rafId = requestAnimationFrame(loop);
  }

  function loadLevel(idx) {
    levelData = LEVELS[idx];
    map = levelData.map.map(r => [...r]);
    Enemies.init();
    Enemies.spawnFromMap(map);
    extractCollectibles();
    extractSpecials();
    cam.x = 0; cam.y = 0;
    cam.targetX = 0; cam.targetY = 0;
  }

  function extractCollectibles() {
    collectibles = [];
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        if (map[r][c] === TILE.STAR) {
          collectibles.push({
            x: c * TILE_SIZE_C + TILE_SIZE_C / 2,
            y: r * TILE_SIZE_C + TILE_SIZE_C / 2,
            r: TILE_SIZE_C * 0.38,
            collected: false,
          });
          map[r][c] = TILE.AIR;
        }
      }
    }
  }

  function extractSpecials() {
    checkpoints = [];
    portals     = [];
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        if (map[r][c] === TILE.CHECKPOINT) {
          checkpoints.push({ x: c * TILE_SIZE_C + TILE_SIZE_C / 2, y: (r - 1) * TILE_SIZE_C, col: c, row: r, activated: false });
          map[r][c] = TILE.AIR;
        }
        if (map[r][c] === TILE.PORTAL) {
          portals.push({ x: c * TILE_SIZE_C + TILE_SIZE_C / 2, y: r * TILE_SIZE_C + TILE_SIZE_C / 2, col: c, row: r, active: false, triggered: false });
          map[r][c] = TILE.AIR;
        }
      }
    }
  }

  // ──────────────────────────────────────────
  //  GAME LOOP
  // ──────────────────────────────────────────
  function loop(timestamp) {
    if (!running) { rafId = null; return; }

    const rawDt = lastTs ? (timestamp - lastTs) / 1000 : 0;
    lastTs = timestamp;
    const dt = Math.min(rawDt, 0.05);

    if (!paused) update(dt);

    render(timestamp);
    rafId = requestAnimationFrame(loop);
  }

  // ──────────────────────────────────────────
  //  UPDATE
  // ──────────────────────────────────────────
  function update(dt) {
    const ps = Player.getState();
    if (ps.dead && ps.lives <= 0) return;

    Player.update(dt, input, map, handlePlayerLand);

    if (input.jumpPressed) {
      Player.tryJump();
      input.jumpPressed = false;
    }
    if (input.down && (input.left || input.right) && !ps.sliding) {
      Player.trySlide();
    }
    if (input.down && !ps.grounded && ps.charId === 'nuve') {
      Player.tryGroundPound();
    }

    Enemies.update(dt, map, ps, handleEnemyCollision, handleBossDefeated);
    updateCamera(dt, ps);
    checkCollectibles(ps);
    checkCheckpoints(ps);
    checkPortal(ps);

    if (ps.dead && ps.lives <= 0) {
      running = false;
      setTimeout(() => onGameOver(ps.stars, false), 600);
    }
  }

  // ──────────────────────────────────────────
  //  CÁMARA — con adelanto en dirección de movimiento
  // ──────────────────────────────────────────
  function updateCamera(dt, ps) {
    const { W, H } = Renderer.getSize();
    if (!W || !H) return;

    const mapW = map[0].length * TILE_SIZE_C;
    const mapH = map.length    * TILE_SIZE_C;

    // Adelanto suave en la dirección de movimiento
    const lookAhead = ps.facing * 60;
    cam.targetX = ps.x + ps.w / 2 - W * 0.42 + lookAhead;
    cam.targetY = ps.y + ps.h / 2 - H * 0.52;

    cam.x += (cam.targetX - cam.x) * CAM_LERP * dt;
    cam.y += (cam.targetY - cam.y) * CAM_LERP * dt;

    cam.x = Math.max(0, Math.min(cam.x, Math.max(0, mapW - W)));
    cam.y = Math.max(0, Math.min(cam.y, Math.max(0, mapH - H)));
  }

  // ──────────────────────────────────────────
  //  COLISIONES
  // ──────────────────────────────────────────
  function handleEnemyCollision(type, enemy) {
    if (type === 'stomp') {
      Player.getState().vy = -400;
      Player.getState().grounded = false;
      UI.updateHUD();
    } else if (type === 'damage') {
      Player.takeDamage();
      UI.updateHUD();
    }
  }

  function handlePlayerLand(type, cx, cy, radius) {
    if (type === 'groundPound') Enemies.stunNearby(cx, cy, radius);
  }

  function handleBossDefeated() {
    for (const p of portals) p.active = true;
    Renderer.flash('#f9c846', 0.75);
    const ps = Player.getState();
    Renderer.spawnText(ps.x + ps.w / 2, ps.y - 30, '¡JEFE DERROTADO!', '#f9c846');
    UI.showAbilityBadge('¡Portal abierto! →', 3000);
  }

  function checkCollectibles(ps) {
    const pr = ps.w / 2 + 8;
    for (const col of collectibles) {
      if (col.collected) continue;
      const dx = ps.x + ps.w / 2 - col.x;
      const dy = ps.y + ps.h / 2 - col.y;
      if (Math.hypot(dx, dy) < pr + col.r) {
        col.collected = true;
        Player.collectStar();
        UI.updateHUD();
      }
    }
  }

  function checkCheckpoints(ps) {
    for (const cp of checkpoints) {
      if (cp.activated) continue;
      const dx = ps.x + ps.w / 2 - cp.x;
      const dy = ps.y + ps.h - cp.y;
      if (Math.abs(dx) < TILE_SIZE_C && Math.abs(dy) < TILE_SIZE_C * 1.5) {
        cp.activated = true;
        Player.activateCheckpoint(cp.x, cp.y);
        UI.showCheckpointFlash();
      }
    }
  }

  function checkPortal(ps) {
    for (const portal of portals) {
      if (!portal.active || portal.triggered) continue;
      const dx = ps.x + ps.w / 2 - portal.x;
      const dy = ps.y + ps.h / 2 - portal.y;
      if (Math.hypot(dx, dy) < TILE_SIZE_C * 1.2) {
        portal.triggered = true;
        running = false;
        setTimeout(() => {
          const nextIdx = currentLevelIdx + 1;
          if (nextIdx < LEVELS.length) onLevelClear(nextIdx, Player.getState().stars);
          else onGameOver(Player.getState().stars, true);
        }, 400);
      }
    }
  }

  // ──────────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────────
  function render(timestamp) {
    Renderer.clear();
    Renderer.drawBackground(levelData, cam.x, timestamp);
    Renderer.drawTilemap(map, levelData, cam.x, cam.y);

    const ctx = Renderer.getCtx();

    for (const col of collectibles) {
      if (col.collected) continue;
      Renderer.drawStarAnimated(col.x - cam.x, col.y - cam.y, timestamp, false);
    }

    for (const cp of checkpoints) {
      const sx = cp.x - cam.x;
      const sy = cp.y - cam.y - TILE_SIZE_C;
      ctx.save();
      ctx.fillStyle = cp.activated ? '#4ade80' : '#94a3b8';
      ctx.fillRect(sx - 2, sy + 4, 4, TILE_SIZE_C - 8);
      ctx.beginPath();
      ctx.moveTo(sx + 2, sy + 6);
      ctx.lineTo(sx + (cp.activated ? 22 : 18), sy + (cp.activated ? 14 : 13));
      ctx.lineTo(sx + 2, sy + (cp.activated ? 22 : 20));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (const p of portals) {
      if (!p.active) continue;
      const sx = p.x - cam.x;
      const sy = p.y - cam.y;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(timestamp / 1200);
      ctx.translate(-sx, -sy);
      const gr = ctx.createRadialGradient(sx, sy, 5, sx, sy, 40);
      gr.addColorStop(0, 'rgba(255,255,255,.95)');
      gr.addColorStop(0.3, 'rgba(167,139,250,.85)');
      gr.addColorStop(0.7, 'rgba(99,102,241,.60)');
      gr.addColorStop(1, 'transparent');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(sx, sy, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.90)';
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const e of Enemies.getEnemies()) {
      Renderer.drawEnemy({ ...e, x: e.x - cam.x, y: e.y - cam.y }, timestamp);
    }

    const ps = Player.getState();
    const visible = !ps.invincible || Math.floor(timestamp / 90) % 2 === 0;
    if (visible) {
      Renderer.drawPlayer({ ...ps, x: ps.x - cam.x, y: ps.y - cam.y }, UI.getImages(), timestamp);
    }

    Renderer.updateAndDrawParticles(Math.min(1 / 30, 1 / 60));
    Renderer.drawFloatingTexts(Math.min(1 / 30, 1 / 60));
    Renderer.drawFlash();
  }

  // ──────────────────────────────────────────
  //  PAUSA
  // ──────────────────────────────────────────
  function pause()  { paused = true;  onPause(true);  }
  function resume() { paused = false; lastTs = 0; onPause(false); }
  function isPaused() { return paused; }

  // ──────────────────────────────────────────
  //  TECLADO
  // ──────────────────────────────────────────
  function setupKeyboard() {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      _keys[e.key] = true;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (running) { isPaused() ? resume() : pause(); }
        return;
      }
      if (!running || paused) return;
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') input.left  = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = true;
      if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') input.down  = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'z' || e.key === 'Z' || e.key === ' ') {
        input.jumpPressed = true;
        input.jumpHeld    = true;
      }
    });
    window.addEventListener('keyup', e => {
      _keys[e.key] = false;
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') input.left  = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = false;
      if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') input.down  = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'z' || e.key === 'Z' || e.key === ' ') {
        input.jumpHeld = false;
      }
    });
  }

  // ──────────────────────────────────────────
  //  CONTROLES MÓVIL — pointer events con multi-touch
  // ──────────────────────────────────────────
  function setupMobileControls() {
    function bindBtn(id, onDown, onUp) {
      const btn = document.getElementById(id);
      if (!btn) return;

      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId); // captura el puntero para no perder el up
        _touchMap[e.pointerId] = id;
        btn.classList.add('pressed');
        onDown();
      }, { passive: false });

      btn.addEventListener('pointerup', e => {
        e.preventDefault();
        delete _touchMap[e.pointerId];
        btn.classList.remove('pressed');
        onUp();
      }, { passive: false });

      btn.addEventListener('pointercancel', e => {
        delete _touchMap[e.pointerId];
        btn.classList.remove('pressed');
        onUp();
      });
    }

    bindBtn('mcLeft',  () => input.left  = true,  () => input.left  = false);
    bindBtn('mcRight', () => input.right = true,  () => input.right = false);
    bindBtn('mcDown',  () => input.down  = true,  () => input.down  = false);
    bindBtn('mcJump',
      () => { input.jumpPressed = true; input.jumpHeld = true; },
      () => { input.jumpHeld = false; }
    );
  }

  // ──────────────────────────────────────────
  //  TOQUE EN EL CANVAS — doble tap para saltar
  //  lado izquierdo = moverse, lado derecho = saltar
  // ──────────────────────────────────────────
  function setupCanvasTouch(canvasEl) {
    canvasEl.addEventListener('pointerdown', e => {
      if (!running || paused) return;
      // Solo activar si no hay controles virtuales visibles
      const controls = document.getElementById('mobileControls');
      if (controls && getComputedStyle(controls).display !== 'none') return;

      const side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
      const now  = performance.now();

      if (side === _lastTapSide && now - _lastTapTime < DBL_TAP_MS) {
        // Doble tap → salto
        input.jumpPressed = true;
        input.jumpHeld    = true;
        _lastTapTime = 0;
        setTimeout(() => { input.jumpHeld = false; }, 200);
      } else {
        if (side === 'left') {
          input.left = true;
          canvasEl.addEventListener('pointerup', () => { input.left = false; }, { once: true });
        } else {
          input.right = true;
          canvasEl.addEventListener('pointerup', () => { input.right = false; }, { once: true });
        }
        _lastTapTime = now;
        _lastTapSide = side;
      }
    }, { passive: true });
  }

  // ──────────────────────────────────────────
  //  ORIENTACIÓN — resize al girar el teléfono
  // ──────────────────────────────────────────
  function setupOrientationHandler() {
    const handleResize = () => {
      Renderer.resize();
      // Forzar redibujado del frame actual si estaba pausado
      if (paused && levelData) {
        render(performance.now());
      }
    };

    window.addEventListener('resize', handleResize);

    // API moderna de orientación (más confiable que orientationchange)
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleResize);
    } else {
      window.addEventListener('orientationchange', () => {
        // Pequeño delay: el viewport tarda en actualizarse en iOS
        setTimeout(handleResize, 120);
      });
    }
  }

  function resetInput() {
    input.left = false; input.right = false;
    input.down = false; input.jumpPressed = false; input.jumpHeld = false;
  }

  // ──────────────────────────────────────────
  //  GETTERS
  // ──────────────────────────────────────────
  function getCurrentLevel() { return currentLevelIdx; }
  function getLevelData()    { return levelData; }
  function isRunning()       { return running; }
  function stop() {
    running = false;
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    resetInput();
  }

  return {
    init, startGame, loadLevel, stop,
    pause, resume, isPaused, isRunning,
    getCurrentLevel, getLevelData,
  };

})();