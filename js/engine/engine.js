// ═══════════════════════════════════════════════════════
//  ENGINE.JS — Coordinador principal
//
//  Orden de carga en index.html:
//    engine_input.js   ← primero
//    engine_render.js  ← segundo
//    engine.js         ← este archivo (último)
//
//  Responsabilidades:
//  - Game loop (RAF)
//  - Update: física, cámara, colisiones, checkpoints
//  - Carga de niveles
//  - Comunicación con UI (game over, level clear)
//
//  EngineState y EngineActions son objetos compartidos
//  que engine_input.js necesita para leer running/paused
//  y llamar a togglePause sin dependencia circular.
// ═══════════════════════════════════════════════════════

// Estado compartido — lo lee engine_input.js
const EngineState = { running: false, paused: false };

// Acciones compartidas — las llama engine_input.js
const EngineActions = {
  togglePause: () => {
    if (EngineState.paused) Engine.resume();
    else                    Engine.pause();
  },
};

const Engine = (() => {

  const TS      = 48;
  const CAM_LERP = 8;

  let lastTs  = 0;
  let rafId   = null;

  let currentLevelIdx = 0;
  let levelData       = null;
  let map             = null;

  const cam = { x:0, y:0, targetX:0, targetY:0 };

  let collectibles = [];
  let magicTrees   = [];
  let checkpoints  = [];
  let portals      = [];

  let onGameOver   = null;
  let onLevelClear = null;
  let onPause      = null;

  const input = {
    left:false, right:false, down:false,
    jumpPressed: 0, jumpHeld: false,
  };

  // ── INIT ───────────────────────────────────────────────
  function init(canvasEl, callbacks = {}) {
    Renderer.init(canvasEl);
    initLevels();

    onGameOver   = callbacks.onGameOver   || (() => {});
    onLevelClear = callbacks.onLevelClear || (() => {});
    onPause      = callbacks.onPause      || (() => {});

    EngineInput.setup(input);
    window.addEventListener('bossDefeated', () => {
      if (EngineState.running) _handleBossDefeated();
    });
  }

  // ── START GAME ─────────────────────────────────────────
  function startGame(charId, levelIdx = 0) {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }

    let started = false;

    function doStart() {
      if(started) return;
      started = true;
      LoadingScreen.hide();
      _startGameInternal(charId, levelIdx);
    }

    LoadingScreen.show();
    AssetLoader.load(
      levelIdx,
      (loaded, total) => LoadingScreen.setProgress(loaded, total),
      doStart
    );

    // Timeout de seguridad — si los assets tardan más de 8s, arrancar igual
    setTimeout(doStart, 8000);
  }

  function _startGameInternal(charId, levelIdx) {
    currentLevelIdx = levelIdx;
    _loadLevel(levelIdx);

    const prevStars = levelIdx > 0 ? Player.getState().stars : 0;
    const prevLives = levelIdx > 0 ? Player.getState().lives : 5;
    Player.init(charId, 2*TS, (13-2)*TS);
    if (levelIdx > 0) {
      Player.getState().stars = prevStars;
      Player.getState().lives = prevLives;
    }

    EngineState.running = true;
    EngineState.paused  = false;
    lastTs = 0;
    EngineInput.reset();

    const ps = Player.getState();
    ps.fireballCooldown   = 0;
    ps.projectileCooldown = 0;
    ps.immuneTimer        = 0;
    ps.flying             = false;

    const fb = document.getElementById('mcFire');
    if (fb) fb.style.display = '';

    // Precargar el siguiente nivel en background
    AssetLoader.preloadNext(levelIdx);

    // Música de fondo del nivel
    if (typeof AudioManager !== 'undefined') AudioManager.play(levelIdx);

    rafId = requestAnimationFrame(_loop);
  }

  function _loadLevel(idx) {
    levelData = LEVELS[idx];
    map       = levelData.map.map(r => [...r]);
    Enemies.init();
    Enemies.spawnFromMap(map, idx);
    Renderer.resetCastle();
    GiftBox.init();  GiftBox.spawnFromMap(map);  GiftBox.preload();
    // Nivel 2: puerta mágica (Pablo) — Nivel 3: cueva (SuperNatan)
    if (idx === 1 && typeof MagicDoor !== 'undefined') {
      MagicDoor.init(); MagicDoor.spawnFromMap(map); MagicDoor.preload();
    }
    if (idx === 2 && typeof Cueva !== 'undefined') {
      Cueva.init(); Cueva.spawnFromMap(map, TS); Cueva.preload();
    }
    _extractCollectibles();
    _extractSpecials();
    cam.x = 0; cam.y = 0; cam.targetX = 0; cam.targetY = 0;
  }

  function _extractCollectibles() {
    collectibles = [];
    for (let r=0; r<map.length; r++) {
      for (let c=0; c<map[r].length; c++) {
        if (map[r][c] === TILE.STAR) {
          collectibles.push({
            x: c*TS + TS/2, y: r*TS + TS/2,
            r: TS*0.38, collected: false,
          });
          map[r][c] = TILE.AIR;
        }
      }
    }
  }

  function _extractSpecials() {
    checkpoints = []; portals = []; magicTrees = [];
    for (let r=0; r<map.length; r++) {
      for (let c=0; c<map[r].length; c++) {
        if (map[r][c] === TILE.CHECKPOINT) {
          checkpoints.push({ x:c*TS+TS/2, y:(r-1)*TS, col:c, row:r, activated:false });
          map[r][c] = TILE.AIR;
        }
        if (map[r][c] === TILE.MAGIC_TREE) {
          magicTrees.push({ x:c*TS+TS/2, y:r*TS+TS/2, col:c, row:r, used:false });
          map[r][c] = TILE.AIR;
        }
        if (map[r][c] === TILE.PORTAL) {
          portals.push({ x:c*TS+TS/2, y:r*TS+TS/2, col:c, row:r, active:false, triggered:false });
          map[r][c] = TILE.AIR;
        }
      }
    }
  }

  // ── GAME LOOP ──────────────────────────────────────────
  function _loop(timestamp) {
    if (!EngineState.running) { rafId = null; return; }
    const rawDt = lastTs ? (timestamp - lastTs) / 1000 : 0;
    lastTs = timestamp;
    const dt = Math.min(rawDt, 0.05);

    const natanActive = typeof SubMisionNatan !== 'undefined' && SubMisionNatan.isActive();
    if (!SubMision.isActive() && !natanActive && !EngineState.paused) _update(dt);

    EngineRender.frame(timestamp, dt, { map, levelData, cam, collectibles, checkpoints, portals, magicTrees });
    rafId = requestAnimationFrame(_loop);
  }

  // ── UPDATE ─────────────────────────────────────────────
  function _update(dt) {
    const ps = Player.getState();
    if (ps.dead && ps.lives <= 0) return;

    // Jump antes del update — usar contador para no perder taps rápidos
    if (input.jumpPressed > 0) {
      Player.tryJump();
      input.jumpPressed--;
    }

    Player.update(dt, input, map, _handlePlayerLand);

    if (input.down && (input.left || input.right) && !ps.sliding) Player.trySlide();
    if (input.down && !ps.grounded && ps.charId === 'nuve')        Player.tryGroundPound();

    Enemies.update(dt, map, ps, _handleEnemyCollision, _handleBossDefeated);

    _updateCamera(dt, ps);
    _checkCollectibles(ps);
    _checkCheckpoints(ps);
    _checkPortal(ps);
    _checkSubMisionEntry(ps);
    _checkMagicTrees(ps);
    _checkPlayerProjectiles();

    if (currentLevelIdx === 1 && typeof MagicDoor !== 'undefined') {
      MagicDoor.update(dt);
      MagicDoor.checkProjectileHits(Player.getProjectiles(), Player.getFireballs());
    }
    if (currentLevelIdx === 2 && typeof Cueva !== 'undefined') {
      Cueva.update(dt);
      Cueva.checkProjectileHits(Player.getProjectiles(), Player.getFireballs());
    }
    GiftBox.update(dt, ps, () => {
      if (typeof AudioManager !== 'undefined') AudioManager.sfx('giftbox_open');
      UI.showAbilityBadge('🐱 ¡Salió el gatito!', 3000);
    });

    if (ps.dead && ps.lives <= 0) {
      EngineState.running = false;
      setTimeout(() => onGameOver(ps.stars, false), 600);
    }
  }

  // ── CÁMARA ─────────────────────────────────────────────
  function _updateCamera(dt, ps) {
    const { W, H } = Renderer.getSize();
    if (!W || !H) return;
    const mapW = map[0].length * TS;
    const mapH = map.length    * TS;
    cam.targetX = ps.x + ps.w/2 - W*0.42;
    cam.targetY = ps.y + ps.h/2 - H*0.55;
    cam.x += (cam.targetX - cam.x) * CAM_LERP * dt;
    cam.y += (cam.targetY - cam.y) * CAM_LERP * dt;
    cam.x = Math.max(0, Math.min(cam.x, Math.max(0, mapW-W)));
    cam.y = Math.max(0, Math.min(cam.y, Math.max(0, mapH-H)));
  }

  // ── COLISIONES ─────────────────────────────────────────
  function _handleEnemyCollision(type, enemy) {
    const ps = Player.getState();
    if (type === 'stomp') {
      ps.vy = -400; ps.grounded = false; UI.updateHUD();
    } else if (type === 'damage') {
      Player.takeDamage(enemy ? enemy.x + (enemy.w||0)/2 : null);
      UI.updateHUD();
    }
  }

  function _handlePlayerLand(type, cx, cy, radius) {
    if (type === 'groundPound') Enemies.stunNearby(cx, cy, radius);
  }

  function _handleBossDefeated() {
    for (const p of portals) p.active = true;
    Renderer.flash('#f9c846', 0.75);
    const ps = Player.getState();
    Renderer.spawnText(ps.x+ps.w/2, ps.y-30, '¡JEFE DERROTADO!', '#f9c846');
    UI.showAbilityBadge('¡Portal abierto! →', 3000);
    if (currentLevelIdx === 0) {
      Renderer.showCastle();
      setTimeout(() => {
        for (const p of portals) {
          Renderer.spawnParticles(p.x-cam.x, p.y-cam.y, '#dc2626', 40);
          Renderer.spawnParticles(p.x-cam.x, p.y-cam.y, '#ef4444', 30);
          Renderer.flash('rgba(139,0,0,0.45)', 0.9);
        }
      }, 200);
    }
  }

  // ── COLECCIONABLES ─────────────────────────────────────
  function _checkCollectibles(ps) {
    const pr = ps.w/2 + 8;
    for (const col of collectibles) {
      if (col.collected) continue;
      const dx = ps.x+ps.w/2 - col.x;
      const dy = ps.y+ps.h/2 - col.y;
      if (Math.hypot(dx,dy) < pr+col.r) {
        col.collected = true;
        Player.collectStar();
        UI.updateHUD();
      }
    }
  }

  // ── CHECKPOINTS ────────────────────────────────────────
  function _checkCheckpoints(ps) {
    for (const cp of checkpoints) {
      if (cp.activated) continue;
      const dx = ps.x+ps.w/2 - cp.x;
      const dy = ps.y+ps.h   - cp.y;
      if (Math.abs(dx) < TS && Math.abs(dy) < TS*1.5) {
        cp.activated = true;
        Player.activateCheckpoint(cp.x, cp.y);
        if(typeof AudioManager !== 'undefined') AudioManager.sfx('flag_point');
        UI.showCheckpointFlash();
      }
    }
  }

  // ── PORTAL ─────────────────────────────────────────────
  function _checkPortal(ps) {
    for (const portal of portals) {
      if (!portal.active || portal.triggered) continue;
      const dx = ps.x+ps.w/2 - portal.x;
      const dy = ps.y+ps.h/2 - portal.y;
      if (Math.hypot(dx,dy) < TS*1.2) {
        portal.triggered = true;
        Renderer.hideCastle();
        EngineState.running = false;
        setTimeout(() => {
          const nextIdx = currentLevelIdx + 1;
          if (nextIdx < LEVELS.length) onLevelClear(nextIdx, Player.getState().stars);
          else                          onGameOver(Player.getState().stars, true);
        }, 600);
      }
    }
  }

  // ── PROYECTILES — unificado (fireballs + todos los proyectiles) ──
  // Antes eran checkFireballs() y checkProjectiles() por separado.
  // Ahora una sola función itera todos los proyectiles activos del jugador.
  function _checkPlayerProjectiles() {
    const enemies = Enemies.getEnemies();

    // Proyectiles tipados (hielo, rayo, bola de color)
    for (const p of Player.getProjectiles()) {
      if (!p.active) continue;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (!_aabb(p.x, p.y, p.r, e)) continue;

        p.active = false;
        Renderer.spawnParticles(p.x, p.y, p.color, 10);

        if (typeof Enemies.hitByProjectile === 'function' && Enemies.hitByProjectile(e, p.kind, p.color)) {
          break;
        }

        if (p.kind === 'ice') {
          const isBoss = e.type === 'boss' || e.type === 'fantasma';
          if (isBoss) {
            e.stunTimer = 1.8;
            e.hp = Math.max(0, (e.hp||0) - 1);
            Renderer.spawnText(p.x, e.y-10, '❄️ -1', '#7dd3fc');
            if (e.hp <= 0 && e.alive) { e.alive = false; window.dispatchEvent(new CustomEvent('bossDefeated')); }
          } else {
            e.frozenTimer = (e.frozenTimer||0) + 2.0;
            Renderer.spawnText(p.x, e.y-10, '❄️ Congelado!', '#7dd3fc');
          }
        } else if (p.kind === 'ray') {
          Enemies.hitEnemy(e);
          Renderer.spawnText(p.x, e.y-10, '☀️ ¡Quemado!', '#fde68a');
        } else {
          Enemies.hitEnemy(e);
          Renderer.spawnText(p.x, e.y-10, '💥', p.color);
        }
        break;
      }
    }

    // Fireballs
    for (const fb of Player.getFireballs()) {
      if (!fb.active) continue;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (!_aabb(fb.x, fb.y, fb.r, e)) continue;
        fb.active = false;
        Renderer.spawnParticles(fb.x, fb.y, '#f97316', 12);
        Enemies.hitEnemy(e);
        if (e.type === 'boss') Renderer.spawnText(fb.x, e.y-10, '-1 🔥', '#f97316');
        break;
      }
    }
  }

  // AABB circular vs rect
  function _aabb(px, py, pr, e) {
    return px+pr > e.x && px-pr < e.x+e.w &&
           py+pr > e.y && py-pr < e.y+e.h;
  }

  function _checkSubMisionEntry(ps) {
    if (!input.down) return;
    if (ps.invincible) return;
    if (Math.abs(ps.vx) > 200 || ps.vy < -100) return;

    // Nivel 2 — Puerta mágica → submisión Pablo
    if (currentLevelIdx === 1 && typeof MagicDoor !== 'undefined') {
      const DOOR_W = TS*2, DOOR_H = TS*2.5;
      for (const door of MagicDoor.getDoors()) {
        if (!door.opened) continue;
        const dx = Math.abs(ps.x+ps.w/2 - (door.x+DOOR_W/2));
        const dy = Math.abs(ps.y+ps.h/2 - (door.y+DOOR_H/2));
        if (dx < 60 && dy < 80 && ps.grounded) {
          _launchSubMision(ps);
          input.down = false;
          return;
        }
      }
    }

    // Nivel 3 — Cueva → submisión SuperNatan
    if (currentLevelIdx === 2 && typeof Cueva !== 'undefined') {
      for (const door of Cueva.getDoors()) {
        if (!door.opened) continue;
        const dx = Math.abs(ps.x+ps.w/2 - (door.x+48));
        const dy = Math.abs(ps.y+ps.h/2 - (door.y+64));
        if (dx < 70 && dy < 90 && ps.grounded) {
          _launchSubMisionNatan(ps);
          input.down = false;
          return;
        }
      }
    }
  }

  function _launchSubMision(ps) {
    const savedState = {
      camX: cam.x, camY: cam.y,
      levelIdx: currentLevelIdx,
      stars: ps.stars, lives: ps.lives,
      charId: ps.charId,
    };
    SubMision.start(savedState, {
      onReturn: () => {
        const ps = Player.getState();
        ps.lives = ps.maxLives || 5;
        UI.updateHUD();
        UI.showAbilityBadge('✨ ¡De vuelta en Manolandia! ❤️❤️❤️❤️❤️', 3000);
      },
    });
  }

  function _launchSubMisionNatan(ps) {
    if (typeof SubMisionNatan === 'undefined') return;
    SubMisionNatan.start(
      { camX: cam.x, camY: cam.y, levelIdx: currentLevelIdx },
      {
        onReturn: () => {
          lastTs = 0;
          Player.activateImmunity(3.0);
          UI.showAbilityBadge('🦸 ¡SuperNatan pasó por acá!', 3000);
        },
        onGameOver: () => {
          // Natan perdió todas las vidas → volver al nivel 3 en la puerta de la cueva
          lastTs = 0;
          currentLevelIdx = 2;
          _loadLevel(2);
          // Posicionar jugador cerca de la puerta de la cueva
          const doors = (typeof Cueva !== 'undefined') ? Cueva.getDoors() : [];
          const ps2 = Player.getState();
          if (doors.length > 0) {
            const door = doors[0];
            ps2.x = door.x + 20;
            ps2.y = door.y + 20;
            ps2.vx = 0; ps2.vy = 0;
            ps2.dead = false;
          }
          Player.activateImmunity(3.0);
          UI.showAbilityBadge('💀 Natan cayó... volvé a intentarlo', 3500);
        },
      }
    );
  }

  // ── ÁRBOL MÁGICO ───────────────────────────────────────
  function _checkMagicTrees(ps) {
    for (const t of magicTrees) {
      if (t.used) continue;
      const dx = ps.x+ps.w/2 - t.x;
      const dy = ps.y+ps.h/2 - t.y;
      if (Math.hypot(dx,dy) < TS) {
        t.used = true;
        Player.activateImmunity(5.0);
        UI.showAbilityBadge('🌳 ¡Inmunidad 5 segundos!', 2800);
      }
    }
  }

  // ── PAUSA ──────────────────────────────────────────────
  function pause()  {
    EngineState.paused = true;
    onPause(true);
    if (typeof AudioManager !== 'undefined') AudioManager.pause();
  }
  function resume() {
    EngineState.paused = false;
    onPause(false);
    lastTs = 0;
    if (typeof AudioManager !== 'undefined') AudioManager.resume();
  }
  function isPaused()  { return EngineState.paused;   }
  function isRunning() { return EngineState.running;  }

  function stop() {
    EngineState.running = false;
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    EngineInput.reset();
  }

  function getCurrentLevel() { return currentLevelIdx; }
  function getLevelData()    { return levelData; }

  return {
    init, startGame, loadLevel: _loadLevel, stop,
    pause, resume, isPaused, isRunning,
    getCurrentLevel, getLevelData,
  };

})();