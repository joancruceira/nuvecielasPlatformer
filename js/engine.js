// ═══════════════════════════════════════════════════════
//  ENGINE.JS — Game loop, cámara, coleccionables, niveles
// ═══════════════════════════════════════════════════════

const Engine = (() => {

  const TILE_SIZE_C = 48;
  const CAM_LERP = 8;

  let running   = false;
  let paused    = false;
  let lastTs    = 0;
  let rafId     = null; // BUG FIX: guardar el ID del RAF para poder cancelarlo

  let currentLevelIdx = 0;
  let levelData = null;
  let map       = null;

  const cam = { x: 0, y: 0, targetX: 0, targetY: 0 };

  let collectibles = [];
  let magicTrees    = [];
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
  const _keys    = {};
  const _dirTap  = { dir: '', time: 0 };
  const DIR_TAP_MS = 320;

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
    setupCanvasTouch();
    setupOrientationHandler();
    window.addEventListener('bossDefeated', () => { if (running) handleBossDefeated(); });
  }

  // ──────────────────────────────────────────
  //  EMPEZAR JUEGO
  // ──────────────────────────────────────────
  function startGame(charId, levelIdx = 0) {
    // BUG FIX: Cancelar RAF anterior antes de iniciar uno nuevo para evitar loops dobles
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    currentLevelIdx = levelIdx;
    loadLevel(levelIdx);
    // BUG FIX: Preservar estrellas y vidas al cambiar de nivel (solo resetear en nivel 0)
    const prevStars = levelIdx > 0 ? Player.getState().stars : 0;
    const prevLives = levelIdx > 0 ? Player.getState().lives : 5;
    Player.init(charId, 2 * TILE_SIZE_C, (13 - 2) * TILE_SIZE_C);
    if (levelIdx > 0) {
      Player.getState().stars = prevStars;
      Player.getState().lives = prevLives;
    }
    running = true;
    paused  = false;
    lastTs  = 0;
    resetInput();
    // Mostrar/ocultar botón de fuego según personaje
    const fb = document.getElementById('mcFire');
    if (fb) fb.style.display = ''; // todos los chars pueden disparar
    // Resetear cooldowns al iniciar nivel
    Player.getState().fireballCooldown    = 0;
    Player.getState().projectileCooldown  = 0;
    Player.getState().immuneTimer         = 0;
    Player.getState().flying              = false;
    rafId = requestAnimationFrame(loop);
  }

  function loadLevel(idx) {
    levelData = LEVELS[idx];
    // copia profunda del mapa para no modificar el original
    map = levelData.map.map(r => [...r]);
    Enemies.init();
    Enemies.spawnFromMap(map, idx);
    Renderer.resetCastle();
    GiftBox.init();
    GiftBox.spawnFromMap(map);
    GiftBox.preload();
    MagicDoor.init();
    MagicDoor.spawnFromMap(map);
    MagicDoor.preload(); // limpiar el fondo del castillo al iniciar nivel
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
    magicTrees  = [];
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        if (map[r][c] === TILE.CHECKPOINT) {
          checkpoints.push({
            x: c * TILE_SIZE_C + TILE_SIZE_C / 2,
            y: (r - 1) * TILE_SIZE_C,
            col: c, row: r,
            activated: false,
          });
          map[r][c] = TILE.AIR;
        }
        if (map[r][c] === TILE.MAGIC_TREE) {
          magicTrees.push({
            x: c * TILE_SIZE_C + TILE_SIZE_C / 2,
            y: r * TILE_SIZE_C + TILE_SIZE_C / 2,
            col: c, row: r, used: false,
          });
          map[r][c] = TILE.AIR;
        }
        if (map[r][c] === TILE.PORTAL) {
          portals.push({
            x: c * TILE_SIZE_C + TILE_SIZE_C / 2,
            y: r * TILE_SIZE_C + TILE_SIZE_C / 2,
            col: c, row: r,
            active: false,
            triggered: false,
          });
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

    if (!paused) {
      update(dt);
    }

    render(timestamp);
    rafId = requestAnimationFrame(loop);
  }

  // ──────────────────────────────────────────
  //  UPDATE
  // ──────────────────────────────────────────
  function update(dt) {
    const ps = Player.getState();
    if (ps.dead && ps.lives <= 0) return; // no actualizar si ya game over

    // Jump: procesar ANTES del update para que la física lo aplique este frame
    if (input.jumpPressed) {
      Player.tryJump();
      input.jumpPressed = false;
    }

    // ── Jugador ──
    Player.update(dt, input, map, handlePlayerLand);
    // slide: abajo + movimiento
    if (input.down && (input.left || input.right) && !ps.sliding) {
      Player.trySlide();
    }
    // ground pound (Nuve): abajo en el aire
    if (input.down && !ps.grounded && ps.charId === 'nuve') {
      Player.tryGroundPound();
    }

    // ── Enemigos ──
    Enemies.update(dt, map, ps, handleEnemyCollision, handleBossDefeated);

    // ── Cámara ──
    updateCamera(dt, ps);

    // ── Coleccionables ──
    checkCollectibles(ps);

    // ── Checkpoints ──
    checkCheckpoints(ps);

    // ── Portal ──
    checkPortal(ps);

    // ── Árbol mágico ──
    checkMagicTrees(ps);

    // ── Puerta mágica ──
    MagicDoor.update(dt);
    MagicDoor.checkProjectileHits(Player.getProjectiles(), Player.getFireballs());

    // ── Caja sorpresa ──
    GiftBox.update(dt, ps, (box) => {
      UI.showAbilityBadge('🐱 ¡Salió el gatito!', 3000);
    });

    // ── Proyectiles de otros chars ──
    checkProjectiles();

    // ── Bolas de fuego ──
    checkFireballs();

    // ── Game over ──
    if (ps.dead && ps.lives <= 0) {
      running = false;
      setTimeout(() => onGameOver(ps.stars, false), 600);
    }
  }

  // ──────────────────────────────────────────
  //  CÁMARA
  // ──────────────────────────────────────────
  function updateCamera(dt, ps) {
    const { W, H } = Renderer.getSize();
    // BUG FIX: Verificar que W y H sean válidos (pueden ser 0 antes del primer resize)
    if (!W || !H) return;

    const mapW = map[0].length * TILE_SIZE_C;
    const mapH = map.length    * TILE_SIZE_C;

    cam.targetX = ps.x + ps.w / 2 - W * 0.42;
    cam.targetY = ps.y + ps.h / 2 - H * 0.55;

    cam.x += (cam.targetX - cam.x) * CAM_LERP * dt;
    cam.y += (cam.targetY - cam.y) * CAM_LERP * dt;

    cam.x = Math.max(0, Math.min(cam.x, Math.max(0, mapW - W)));
    cam.y = Math.max(0, Math.min(cam.y, Math.max(0, mapH - H)));
  }

  // ──────────────────────────────────────────
  //  COLISIONES JUEGO
  // ──────────────────────────────────────────
  function handleEnemyCollision(type, enemy) {
    const ps = Player.getState();
    if (type === 'stomp') {
      ps.vy = -400;
      ps.grounded = false;
      UI.updateHUD();
    } else if (type === 'damage') {
      // Pasar posición del enemigo para knockback direccional
      const sourceX = enemy ? (enemy.x + (enemy.w || 0) / 2) : null;
      Player.takeDamage(sourceX);
      UI.updateHUD();
    }
  }

  function handlePlayerLand(type, cx, cy, radius) {
    if (type === 'groundPound') {
      Enemies.stunNearby(cx, cy, radius);
    }
  }

  function handleBossDefeated() {
    for (const p of portals) p.active = true;
    Renderer.flash('#f9c846', 0.75);
    const ps = Player.getState();
    Renderer.spawnText(ps.x + ps.w / 2, ps.y - 30, '¡JEFE DERROTADO!', '#f9c846');
    UI.showAbilityBadge('¡Portal abierto! →', 3000);

    // Solo mostrar el castillo en el nivel 1 (boss Alien derrotado)
    if (currentLevelIdx === 0) {
      Renderer.showCastle();
      // Partículas rojas dramáticas alrededor del portal
      setTimeout(() => {
        for (const p of portals) {
          Renderer.spawnParticles(p.x - cam.x, p.y - cam.y, '#dc2626', 40);
          Renderer.spawnParticles(p.x - cam.x, p.y - cam.y, '#ef4444', 30);
          Renderer.flash('rgba(139,0,0,0.45)', 0.9);
        }
      }, 200);
    }
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
    // BUG FIX: Usar flag para evitar disparar el portal múltiples veces en frames consecutivos
    for (const portal of portals) {
      if (!portal.active || portal.triggered) continue;
      const dx = ps.x + ps.w / 2 - portal.x;
      const dy = ps.y + ps.h / 2 - portal.y;
      if (Math.hypot(dx, dy) < TILE_SIZE_C * 1.2) {
        portal.triggered = true;
        Renderer.hideCastle();
        running = false;
        setTimeout(() => {
          const nextIdx = currentLevelIdx + 1;
          if (nextIdx < LEVELS.length) {
            onLevelClear(nextIdx, Player.getState().stars);
          } else {
            onGameOver(Player.getState().stars, true);
          }
        }, 600);
      }
    }
  }

  // ──────────────────────────────────────────
  //  FIREBALLS — colisión con enemigos
  // ──────────────────────────────────────────
  function checkFireballs() {
    const fireballs = Player.getFireballs();
    const enemies   = Enemies.getEnemies();

    for (const fb of fireballs) {
      if (!fb.active) continue;
      for (const e of enemies) {
        if (!e.alive) continue;
        // AABB simple con radio de la fireball
        if (fb.x + fb.r > e.x && fb.x - fb.r < e.x + e.w &&
            fb.y + fb.r > e.y && fb.y - fb.r < e.y + e.h) {
          fb.active = false;
          Renderer.spawnParticles(fb.x, fb.y, '#f97316', 12);
          // Al boss le quita 1 HP y lo aturde brevemente
          // Delegar siempre a hitEnemy — el módulo enemies dispara bossDefeated via evento
          Enemies.hitEnemy(e);
          if (e.type === 'boss') {
            Renderer.spawnText(fb.x, e.y - 10, '-1 🔥', '#f97316');
          }
          break;
        }
      }
    }
  }

  function checkMagicTrees(ps) {
    for (const t of magicTrees) {
      if (t.used) continue;
      const dx = ps.x + ps.w/2 - t.x;
      const dy = ps.y + ps.h/2 - t.y;
      if (Math.hypot(dx, dy) < TILE_SIZE_C * 1.0) {
        t.used = true;
        Player.activateImmunity(5.0);
        UI.showAbilityBadge('🌳 ¡Inmunidad 5 segundos!', 2800);
      }
    }
  }

  function checkProjectiles() {
    const projs   = Player.getProjectiles();
    const enemies = Enemies.getEnemies();
    for (const p of projs) {
      if (!p.active) continue;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (p.x + p.r > e.x && p.x - p.r < e.x + e.w &&
            p.y + p.r > e.y && p.y - p.r < e.y + e.h) {
          p.active = false;
          Renderer.spawnParticles(p.x, p.y, p.color, 10);

          if (p.kind === 'ice') {
            const isBossType = e.type === 'boss' || e.type === 'fantasma';
            if (isBossType) {
              // Boss: hielo lo aturde y quita 1 HP
              e.stunTimer = 1.8;
              e.hp = Math.max(0, (e.hp || 0) - 1);
              Renderer.spawnText(p.x, e.y - 10, '❄️ -1', '#7dd3fc');
              if (e.hp <= 0 && e.alive) {
                e.alive = false;
                window.dispatchEvent(new CustomEvent('bossDefeated'));
              }
            } else {
              // Enemigo normal: congela 2 segundos
              e.frozenTimer = (e.frozenTimer || 0) + 2.0;
              Renderer.spawnText(p.x, e.y - 10, '❄️ Congelado!', '#7dd3fc');
            }
          } else if (p.kind === 'ray') {
            // Rayo: quema (daño directo)
            Enemies.hitEnemy(e);
            Renderer.spawnText(p.x, e.y - 10, '☀️ ¡Quemado!', '#fde68a');
          } else if (p.kind === 'colorball') {
            // Bola de color: mata normales, daña boss
            Enemies.hitEnemy(e);
            Renderer.spawnText(p.x, e.y - 10, '💥', p.color);
          }
          break;
        }
      }
    }
  }

    // ──────────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────────
  function render(timestamp) {
    Renderer.clear();
    Renderer.drawBackground(levelData, cam.x, cam.y, timestamp);
    // Fondos multicolor (caja gatito + puerta mágica)
    GiftBox.drawRainbowBg(Renderer.getCtx(), Renderer.getSize().W, Renderer.getSize().H, timestamp);
    MagicDoor.drawRainbowBg(Renderer.getCtx(), Renderer.getSize().W, Renderer.getSize().H, timestamp);
    Renderer.drawTilemap(map, levelData, cam.x, cam.y);
    // Árboles DESPUÉS del tilemap para que se asienten en el suelo real
    Renderer.drawBgTreesOverlay(cam.x, cam.y, timestamp);

    const ctx = Renderer.getCtx();

    // coleccionables
    for (const col of collectibles) {
      if (col.collected) continue;
      const sx = col.x - cam.x;
      const sy = col.y - cam.y;
      Renderer.drawStarAnimated(sx, sy, timestamp, false);
    }

    // checkpoints
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

    // portales
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

    // enemigos — cada módulo dibuja a sí mismo
    GiftBox.draw(Renderer.getCtx(), cam.x, cam.y, timestamp);
    MagicDoor.draw(Renderer.getCtx(), cam.x, cam.y, timestamp);
    Enemies.drawAll(Renderer.getCtx(), cam.x, cam.y, timestamp);

    // jugador
    const ps = Player.getState();
    const images = UI.getImages();
    const visible = !ps.invincible || Math.floor(timestamp / 90) % 2 === 0;
    if (visible) {
      Renderer.drawPlayer({
        ...ps,
        x: ps.x - cam.x,
        y: ps.y - cam.y,
      }, images, timestamp);
    }

    // BUG FIX: Calcular dt real para partículas en lugar de usar lastTs directamente
    // Todos los proyectiles
    Renderer.drawFireballs(Player.getFireballs(), cam.x, cam.y, timestamp);
    Renderer.drawProjectiles(Player.getProjectiles(), cam.x, cam.y, timestamp);
    Renderer.drawMagicTrees(magicTrees, cam.x, cam.y, timestamp);

    Renderer.updateAndDrawParticles(Math.min(1 / 30, 1 / 60));
    Renderer.drawFloatingTexts(Math.min(1 / 30, 1 / 60));
    Renderer.drawFlash();
  }

  // ──────────────────────────────────────────
  //  PAUSA
  // ──────────────────────────────────────────
  function pause()  { paused = true;  onPause(true);  }
  function resume() {
    paused = false;
    onPause(false);
    lastTs = 0; // BUG FIX: resetear lastTs al reanudar para evitar spike de dt
  }
  function isPaused() { return paused; }

  // ── Doble tap de dirección → bola de fuego ──
  function handleDirTap(dir) {
    const now = performance.now();
    if (_dirTap.dir === dir && now - _dirTap.time < DIR_TAP_MS) {
      const cid = Player.getState().charId;
      if (cid === 'nuveciela') Player.tryFireball();
      else Player.tryProjectile();
      _dirTap.dir  = '';
      _dirTap.time = 0;
    } else {
      _dirTap.dir  = dir;
      _dirTap.time = now;
    }
  }

  // ──────────────────────────────────────────
  //  INPUTS TECLADO
  // ──────────────────────────────────────────
  function setupKeyboard() {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      _keys[e.key] = true;
      if (!running || paused) {
        // BUG FIX: Solo procesar pausa/resume cuando el juego está activo
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          if (running) { isPaused() ? resume() : pause(); }
        }
        return;
      }
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') {
        input.left = true;
        handleDirTap('left');
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        input.right = true;
        handleDirTap('right');
      }
      if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') input.down  = true;
      if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W' ||
          e.key === 'z' || e.key === 'Z' || e.key === ' ') {
        input.jumpPressed = true;
        input.jumpHeld    = true;
      }
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (running) { isPaused() ? resume() : pause(); }
      }
    });
    window.addEventListener('keyup', e => {
      _keys[e.key] = false;
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') input.left  = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = false;
      if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') input.down  = false;
      if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W' ||
          e.key === 'z' || e.key === 'Z' || e.key === ' ') {
        input.jumpHeld = false;
      }
    });
  }

  // ──────────────────────────────────────────
  //  INPUTS MÓVIL
  // ──────────────────────────────────────────

  function setupMobileControls() {
    function bindBtn(id, onDown, onUp) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        btn.setPointerCapture(ev.pointerId);
        btn.classList.add('pressed');
        onDown();
      }, { passive: false });
      btn.addEventListener('pointerup', ev => {
        ev.preventDefault();
        btn.classList.remove('pressed');
        onUp();
      }, { passive: false });
      btn.addEventListener('pointercancel', () => { btn.classList.remove('pressed'); onUp(); });
    }

    bindBtn('mcLeft',  () => input.left  = true,  () => input.left  = false);
    bindBtn('mcRight', () => input.right = true,  () => input.right = false);
    bindBtn('mcDown',  () => input.down  = true,  () => input.down  = false);
    bindBtn('mcJump',
      () => { input.jumpPressed = true; input.jumpHeld = true; },
      () => { input.jumpHeld = false; }
    );
    // Bola de fuego: solo visible y activo si el personaje es Nuveciela
    const fireBtn = document.getElementById('mcFire');
    if (fireBtn) {
      fireBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        fireBtn.setPointerCapture(e.pointerId);
        fireBtn.classList.add('pressed');
        const cid = Player.getState().charId;
        if (cid === 'nuveciela') Player.tryFireball(); else Player.tryProjectile();
      }, { passive: false });
      fireBtn.addEventListener('pointerup',     () => fireBtn.classList.remove('pressed'));
      fireBtn.addEventListener('pointercancel', () => fireBtn.classList.remove('pressed'));
    }
  }


  function setupCanvasTouch() {
    const canvasEl = document.getElementById('gameCanvas');
    if (!canvasEl) return;
    let lastTapTime = 0, lastTapSide = '';
    canvasEl.addEventListener('pointerdown', ev => {
      if (!running || paused) return;
      const controls = document.getElementById('mobileControls');
      if (controls && getComputedStyle(controls).display !== 'none') return;
      const side = ev.clientX < window.innerWidth / 2 ? 'left' : 'right';
      const now  = performance.now();
      if (side === lastTapSide && now - lastTapTime < 300) {
        input.jumpPressed = true; input.jumpHeld = true;
        setTimeout(() => { input.jumpHeld = false; }, 200);
        lastTapTime = 0;
      } else {
        if (side === 'left') { input.left = true; canvasEl.addEventListener('pointerup', () => { input.left = false; }, { once: true }); }
        else { input.right = true; canvasEl.addEventListener('pointerup', () => { input.right = false; }, { once: true }); }
        lastTapTime = now; lastTapSide = side;
      }
    }, { passive: true });
  }

  function setupOrientationHandler() {
    const handleResize = () => { Renderer.resize(); };
    window.addEventListener('resize', handleResize);
    if (screen.orientation) screen.orientation.addEventListener('change', handleResize);
    else window.addEventListener('orientationchange', () => setTimeout(handleResize, 120));
  }

    function resetInput() {
    input.left = false; input.right = false;
    input.down = false; input.jumpPressed = false; input.jumpHeld = false;
  }

  // ──────────────────────────────────────────
  //  GETTERS PARA UI
  // ──────────────────────────────────────────
  function getCurrentLevel() { return currentLevelIdx; }
  function getLevelData()    { return levelData; }
  function isRunning()       { return running; }
  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    resetInput();
  }

  return {
    init, startGame, loadLevel, stop,
    pause, resume, isPaused, isRunning,
    getCurrentLevel, getLevelData,
  };

})();