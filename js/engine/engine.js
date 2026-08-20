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

  const TS = 48;

  let lastTs  = 0;
  let rafId   = null;

  let currentLevelIdx = 0;
  let levelData       = null;
  let map             = null;

  // La cámara vive en EngineCamera; `cam` son sus valores de render
  // (enteros, con shake ya aplicado). Ver js/engine/engine_camera.js
  const cam = EngineCamera.cam;

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

    let started  = false;
    let guardId  = null;

    function doStart() {
      if(started) return;
      started = true;
      if (guardId !== null) { clearTimeout(guardId); guardId = null; }
      LoadingScreen.hide();
      _startGameInternal(charId, levelIdx);
    }

    LoadingScreen.show();
    AssetLoader.load(
      levelIdx,
      (loaded, total) => LoadingScreen.setProgress(loaded, total),
      doStart
    );

    // Timeout de seguridad — si los assets tardan más de 8s, arrancar igual.
    // Se cancela al arrancar: si no, quedaba pendiente y disparaba durante
    // la carga siguiente cuando el jugador reiniciaba rápido el nivel.
    guardId = setTimeout(doStart, 8000);
  }

  // Cortar cualquier submisión en curso, sin disparar sus callbacks.
  // Es obligatorio antes de parar el motor o de cargar otro nivel: mientras
  // una submisión siga "activa", _loop no vuelve a llamar a _update() y el
  // nivel queda congelado para siempre (jugador inmóvil, enemigos quietos).
  function _abortSubLevels() {
    if (SubMision.isActive()) SubMision.stop();
    if (typeof SubMisionNatan !== 'undefined' && SubMisionNatan.isActive() && SubMisionNatan.abort) {
      SubMisionNatan.abort();
    }
  }

  function _startGameInternal(charId, levelIdx) {
    _abortSubLevels();
    currentLevelIdx = levelIdx;
    _loadLevel(levelIdx);

    const prevStars = levelIdx > 0 ? Player.getState().stars : 0;
    let prevLives = levelIdx > 0 ? Player.getState().lives : 5;
    if (prevLives <= 0) prevLives = 5; // Reset to 5 lives if dead
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

    // Encuadrar al jugador desde el primer frame (si no, la cámara arrancaba
    // en 0,0 y viajaba hasta él a la vista del jugador)
    {
      const { W, H } = Renderer.getSize();
      EngineCamera.snapTo(ps, W, H, map[0].length * TS, map.length * TS);
      _lastPlayerX = ps.x; _lastPlayerY = ps.y;
    }

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
    Renderer.clearFx();   // los FX pendientes son del nivel anterior

    // Resetear TODAS las mecánicas en cada nivel, no sólo la del nivel entrante.
    // draw()/update() de MagicDoor y Cueva se llaman en todos los niveles, así que
    // sin este reset la puerta del nivel 2 seguía dibujándose flotando en los
    // niveles 3, 4 y 5, y el fondo arcoíris quedaba activo para siempre.
    GiftBox.init();
    if (typeof MagicDoor !== 'undefined') MagicDoor.init();
    if (typeof Cueva     !== 'undefined') Cueva.init();
    if (typeof Lago      !== 'undefined') Lago.init();
    if (typeof Bosque    !== 'undefined') Bosque.init();
    if (typeof Castillo  !== 'undefined') Castillo.init();

    GiftBox.spawnFromMap(map); GiftBox.preload();
    // Nivel 2: puerta mágica (Pablo) — Nivel 3: cueva (SuperNatan)
    if (idx === 1 && typeof MagicDoor !== 'undefined') {
      MagicDoor.spawnFromMap(map); MagicDoor.preload();
    }
    if (idx === 2 && typeof Cueva !== 'undefined') {
      Cueva.spawnFromMap(map, TS); Cueva.preload();
    }
    // Nivel 5: el lago (burbujas, géiseres, corrientes, almejas, paisaje)
    if (idx === 4 && typeof Lago !== 'undefined') {
      Lago.spawnFromMap(map, levelData);
    }
    // Nivel 1: el bosque (hongos trampolín, flores, luciérnagas, paisaje)
    if (idx === 0 && typeof Bosque !== 'undefined') {
      Bosque.spawnFromMap(map, levelData);
    }
    // Nivel 2: el castillo (piso frágil, antorchas, llamaradas, retratos)
    if (idx === 1 && typeof Castillo !== 'undefined') {
      Castillo.spawnFromMap(map, levelData);
    }
    _extractCollectibles();
    _extractSpecials();

    // Niveles sin boss declaran winCondition:'reachPortal' → el portal nace abierto.
    if (levelData.winCondition === 'reachPortal') {
      for (const p of portals) p.active = true;
    }

    EngineCamera.reset();
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
          magicTrees.push({ x:c*TS+TS/2, y:r*TS+TS/2, col:c, row:r, used:false, special:false });
          map[r][c] = TILE.AIR;
        }
        if (map[r][c] === TILE.SUPER_MAGIC_TREE) {
          magicTrees.push({ x:c*TS+TS/2, y:r*TS+TS/2, col:c, row:r, used:false, special:true });
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
    const inSubLevel  = SubMision.isActive() || natanActive;

    if (!inSubLevel && !EngineState.paused) _update(dt);

    // SubMision.update() y SubMisionNatan.update() son update+draw, no sólo draw.
    // Con dt=0 en pausa, las submisiones quedan realmente congeladas detrás del
    // overlay en vez de seguir simulando física, enemigos y daño.
    const frameDt = EngineState.paused ? 0 : dt;
    EngineRender.frame(timestamp, frameDt, { map, levelData, cam, collectibles, checkpoints, portals, magicTrees });
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
    _checkSubMisionEntry(ps, dt);
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
    // Después de Player.update() a propósito: el lago empuja tocando la
    // velocidad, y la posición la integra el jugador en el frame siguiente
    // con su propia colisión.
    if (currentLevelIdx === 4 && typeof Lago   !== 'undefined') Lago.update(dt, ps, map);
    if (currentLevelIdx === 0 && typeof Bosque   !== 'undefined') Bosque.update(dt, ps, map);
    if (currentLevelIdx === 1 && typeof Castillo !== 'undefined') {
      Castillo.update(dt, ps, map);
      Castillo.checkProjectileHits(Player.getProjectiles(), Player.getFireballs());
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
  // Si el jugador aparece de golpe en otro sitio (respawn en checkpoint,
  // vuelta de una submisión, carga de nivel) la cámara debe SALTAR, no
  // recorrer medio nivel interpolando.
  let _lastPlayerX = 0, _lastPlayerY = 0;
  const TELEPORT_PX = 260;

  function _updateCamera(dt, ps) {
    const { W, H } = Renderer.getSize();
    const mapW = map[0].length * TS, mapH = map.length * TS;

    const salto = Math.abs(ps.x - _lastPlayerX) > TELEPORT_PX ||
                  Math.abs(ps.y - _lastPlayerY) > TELEPORT_PX;
    _lastPlayerX = ps.x; _lastPlayerY = ps.y;

    if (salto) EngineCamera.snapTo(ps, W, H, mapW, mapH);
    else       EngineCamera.update(dt, ps, W, H, mapW, mapH);
  }

  // ── COLISIONES ─────────────────────────────────────────
  function _handleEnemyCollision(type, enemy) {
    const ps = Player.getState();
    if (type === 'stomp') {
      // Rebote variable: manteniendo salto rebotás más alto. Es lo que permite
      // encadenar pisotones y convierte a los enemigos en algo divertido en
      // lugar de un obstáculo. El pisotón además devuelve el doble salto.
      ps.vy = input.jumpHeld ? -560 : -380;
      ps.grounded = false;
      ps.doubleJumped = false;
      ps.canDoubleJump = true;
      EngineCamera.shake(5, 0.12);
      UI.updateHUD();
    } else if (type === 'damage') {
      Player.takeDamage(enemy ? enemy.x + (enemy.w||0)/2 : null);
      EngineCamera.shake(8, 0.24);
      UI.updateHUD();
    }
  }

  function _handlePlayerLand(type, cx, cy, radius) {
    if (type === 'groundPound') {
      Enemies.stunNearby(cx, cy, radius);
      EngineCamera.shake(11, 0.28);
    }
  }

  function _handleBossDefeated() {
    for (const p of portals) p.active = true;
    EngineCamera.shake(18, 0.65);
    Renderer.flash('#f9c846', 0.75);
    const ps = Player.getState();
    Renderer.spawnText(ps.x+ps.w/2, ps.y-30, '¡JEFE DERROTADO!', '#f9c846');
    UI.showAbilityBadge('¡Portal abierto! →', 3000);
    if (currentLevelIdx === 0) {
      Renderer.showCastle();
      setTimeout(() => {
        // Coordenadas de MUNDO: RendererFx resta la cámara al dibujar.
        for (const p of portals) {
          Renderer.spawnParticles(p.x, p.y, '#dc2626', 40);
          Renderer.spawnParticles(p.x, p.y, '#ef4444', 30);
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

  // Bloqueo de re-entrada tras volver de una submisión.
  //
  // El jugador vuelve exactamente a la puerta por la que entró, así que si
  // `input.down` sigue activo al regresar, _checkSubMisionEntry dispara de
  // nuevo en el primer frame y el jugador queda atrapado entrando y saliendo.
  // Pasa sobre todo con SuperNatan: adentro se usa ↓ para descender, y el
  // listener de teclado del engine sigue vivo durante el subnivel.
  let subMisionLockout = 0;
  const SUBMISION_LOCKOUT = 0.75; // segundos

  function _checkSubMisionEntry(ps, dt) {
    if (subMisionLockout > 0) { subMisionLockout -= dt; return; }
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

  // Estado común al volver de cualquier submisión.
  // El jugador reaparece en la misma puerta por la que entró (su posición nunca
  // se toca), así que hay que soltar el input y bloquear la re-entrada.
  function _onReturnFromSubMision() {
    lastTs = 0;
    EngineInput.reset();               // suelta ↓ y limpia el buffer de saltos
    subMisionLockout = SUBMISION_LOCKOUT;
    Renderer.clearFx();                // FX pendientes en coordenadas de la submisión
  }

  function _launchSubMision(ps) {
    const savedState = {
      camX: cam.x, camY: cam.y,
      levelIdx: currentLevelIdx,
      stars: ps.stars, lives: ps.lives,
      charId: ps.charId,
    };
    Renderer.clearFx();
    SubMision.start(savedState, {
      onReturn: () => {
        _onReturnFromSubMision();
        const ps = Player.getState();
        ps.lives = ps.maxLives || 5;
        UI.updateHUD();
        UI.showAbilityBadge('✨ ¡De vuelta en Manolandia! ❤️❤️❤️❤️❤️', 3000);
      },
    });
  }

  function _launchSubMisionNatan(ps) {
    if (typeof SubMisionNatan === 'undefined') return;
    Renderer.clearFx();
    SubMisionNatan.start(
      { camX: cam.x, camY: cam.y, levelIdx: currentLevelIdx },
      {
        onReturn: () => {
          _onReturnFromSubMision();
          Player.activateImmunity(3.0);
          UI.showAbilityBadge('🦸 ¡SuperNatan pasó por acá!', 3000);
        },
        onGameOver: () => {
          // Natan perdió todas las vidas → volver al nivel 3 en la puerta de la cueva
          _onReturnFromSubMision();
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
        if (t.special) {
          Player.activateSuperMode(25.0);
          UI.showAbilityBadge('🌈 ¡SÚPER ÁRBOL MÁGICO! 25s', 3200);
        } else {
          Player.activateImmunity(10.0);
          UI.showAbilityBadge('🌳 ¡Inmunidad 10 segundos!', 2800);
        }
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
    _abortSubLevels();
    EngineInput.reset();
    Renderer.clearFx();
  }

  function getCurrentLevel() { return currentLevelIdx; }
  function getLevelData()    { return levelData; }

  // ── SUBMISIÓN STANDALONE (entrada desde el mapa de niveles) ──
  //
  // La entrada canónica a la submisión de Pablo es la puerta mágica del
  // nivel 2. El nodo "¡Misión urgente!" del mapa es una entrada alternativa
  // que llamaba SubMision.start() sin canvas visible y sin game loop:
  // SubMision.update() sólo se invoca desde Engine._loop, así que la pantalla
  // quedaba negra y congelada. Esto arranca el loop mínimo que necesita.
  function startSubMision(onDone) {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }

    EngineState.running = true;
    EngineState.paused  = false;
    lastTs = 0;
    EngineInput.reset();
    Renderer.resize();
    Renderer.clearFx();

    SubMision.start({}, {
      onReturn: () => {
        EngineState.running = false;
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        EngineInput.reset();
        Renderer.clearFx();
        onDone && onDone();
      },
    });

    rafId = requestAnimationFrame(_loop);
  }

  return {
    init, startGame, startSubMision, loadLevel: _loadLevel, stop,
    pause, resume, isPaused, isRunning,
    getCurrentLevel, getLevelData,
  };

})();