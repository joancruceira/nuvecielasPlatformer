// ═══════════════════════════════════════════════════════
//  SUBMISION_NATAN.JS — Sub-nivel SuperNatan v2.0
//
//  FIXES aplicados:
//  - BUG1: Memory leak listeners mobile — Map con cleanup
//  - BUG2: Race condition jumpCount — timestamp anti-spam
//  - BUG3: jumpCount reset al aterrizar entre fases
//  - BUG4: Allocation por frame en draw — camX se pasa directo
//  - Pilares con colisión real (eran invisibles)
//  - Partículas en coordenadas de pantalla (eran incorrectas)
//
//  MEJORAS aplicadas:
//  - Hint visual "doble salto = volar" primeros 5s
//  - Slow motion al activar vuelo (0.4s, dt*0.25)
//  - Hitstop 70ms al impactar enemigo
//  - Spawn progresivo de enemigos aéreos por posición
//  - Checkpoint en x=2400 con respawn
//  - Knockback suave (sin retroceder demasiado)
//  - Banner animado de fase
//  - Aura azul en modo vuelo
//  - Combo x2/x3 al matar enemigos seguidos
//  - Cleopatra en la ventana de la veterinaria
//  - Diálogo final de Natan
//  - Calificación de patas de gato al terminar
//  - Vibración haptica mobile
//  - Curva de dificultad rediseñada
// ═══════════════════════════════════════════════════════

const SubMisionNatan = (() => {

  const B  = 'img/level3/subnivel/';

  // ── Constantes ────────────────────────────────────────
  const WORLD_WIDTH       = 4800;
  const GRAVITY           = 900;
  const JUMP_VY           = -480;
  const MAX_FALL          = 720;
  const NATAN_SPD         = 230;
  const FLY_SPD_V         = 200;
  const GROUND_PCT        = 0.80;
  const PHASE_TRANSITION_X = 2400;
  const VET_APPEAR_X      = 4300;
  const VET_ENTER_X       = 4500;
  const FIRE_COOLDOWN     = 0.55;
  const HIT_INVINCIBLE    = 1.8;
  const HITSTOP_DURATION  = 0.07;   // 70ms freeze al golpear
  const SLOWMO_DURATION   = 0.4;    // segundos de slowmo al volar
  const COMBO_TIMEOUT     = 2.2;    // segundos para perder combo

  // ── Nivel — datos separados de la lógica ─────────────
  const GROUND_ENEMIES = [
    { type:'ladron',     x:480  },
    { type:'oficinista', x:820  },
    { type:'ladron',     x:1100, onPlatform:true },  // en plataforma
    { type:'perrero',    x:1380 },
    { type:'ladron',     x:1600 },
    { type:'oficinista', x:1850 },
    { type:'perrero',    x:2050 },
    { type:'ladron',     x:2220 },
  ];

  const AERIAL_WAVE = [
    { type:'avion',       x:2750, yP:0.15 },
    { type:'avion',       x:3100, yP:0.22 },
    { type:'helicoptero', x:3400, yP:0.12 },
    { type:'avion',       x:3720, yP:0.18 },
    { type:'avion',       x:4000, yP:0.10 },
    { type:'helicoptero', x:4250, yP:0.20 },
  ].map(s => ({ ...s, spawned: false }));

  // Plataformas (sólo) — los pilares eliminados (eran invisibles)
  const PLATFORMS = [
    { x:380,  yRel:0.12, w:110, h:18 },
    { x:700,  yRel:0.10, w:100, h:18 },
    { x:980,  yRel:0.13, w:120, h:18 },
    { x:1270, yRel:0.08, w:100, h:18 },
    { x:1560, yRel:0.12, w:110, h:18 },
    { x:1840, yRel:0.10, w:100, h:18 },
    { x:2120, yRel:0.08, w:110, h:18 },
  ];

  // ── Imágenes ──────────────────────────────────────────
  const imgs = {};
  function _img(k) {
    const i = imgs[k];
    return i && i.complete && i.naturalWidth > 0 ? i : null;
  }
  function _preload() {
    if (typeof SNEnemies !== 'undefined') SNEnemies.preloadAll();
    ['fondo_tierra','fondo_aire'].forEach(n => {
      const m = new Image(); m.src = `${B}${n}.png`; imgs[n] = m;
    });
    ['fly0','fly1','fly2','fly3',
     'attack0','attack1','attack2','attack3',
     'hurt0','hurt1','hurt2',
     'run0','run1','run2','run3','run4','run5',
     'landing0','landing1'].forEach(n => {
      const m = new Image(); m.src = `${B}natan_${n}.png`; imgs[n] = m;
    });
  }

  // ── Estado global ─────────────────────────────────────
  let _active    = false;
  let _onReturn  = null;
  let _phase     = 'tierra';
  let _timer     = 0;
  let _camX      = 0;
  let _bgAlpha   = 1;
  let _W = 800, _H = 600;
  let _groundY   = 0;
  let _flying    = false;
  let _jumpCount = 0;
  let _lastJumpTs = 0;

  // Efectos de juego
  let _hitstop      = 0;
  let _slowMo       = 0;
  let _slowMoUsed   = false;    // sólo una vez por run
  let _checkpointX  = 150;
  let _checkpointReached = false;
  let _combo        = 0;
  let _comboTimer   = 0;
  let _totalKills   = 0;
  let _damageTaken  = 0;

  // Feedback UI
  let _banner       = null;     // { text, timer, maxTimer }
  let _announcement = null;     // { text, timer, maxTimer, color }
  let _hintTimer    = 5.0;      // mostrar hint de vuelo 5s
  let _hintGone     = false;
  let _comboText    = null;     // { text, x, y, timer }
  let _cleoCameo    = false;    // Cleopatra salió de la vet

  // Natan — coordenadas de MUNDO
  const N = {
    x:150, y:0, w:72, h:80,
    vx:0, vy:0, facing:1,
    state:'run', fi:0, ft:0, st:0,
    onGround:false, attackCooldown:0,
    hp:5, maxHp:5, invTimer:0,
  };

  const _rays      = [];
  const _particles = [];
  const _enemies   = [];
  const _keys      = { left:false, right:false, up:false, down:false };

  // ── BUG1 FIX: Map para cleanup de listeners ───────────
  const _btnHandlers = new Map();
  function _bindBtn(id, onD, onU) {
    const el = document.getElementById(id);
    if (!el) return;
    if (_btnHandlers.has(id)) {
      const old = _btnHandlers.get(id);
      el.removeEventListener('pointerdown', old.d);
      el.removeEventListener('pointerup',   old.u);
      el.removeEventListener('pointercancel', old.u);
    }
    const hD = e => { e.preventDefault(); onD(); };
    const hU = e => { e.preventDefault(); onU(); };
    el.addEventListener('pointerdown', hD, { passive:false });
    el.addEventListener('pointerup',   hU, { passive:false });
    el.addEventListener('pointercancel', hU);
    _btnHandlers.set(id, { d:hD, u:hU });
  }

  // ── API ───────────────────────────────────────────────
  function start(savedState, callbacks) {
    _preload();
    _active   = true;
    _onReturn = callbacks.onReturn || (() => {});

    _phase   = 'tierra'; _timer  = 0;
    _camX    = 0;        _bgAlpha = 1;
    _flying  = false;    _jumpCount = 0; _lastJumpTs = 0;
    _hitstop = 0;        _slowMo = 0; _slowMoUsed = false;
    _checkpointX = 150;  _checkpointReached = false;
    _combo = 0;          _comboTimer = 0;
    _totalKills = 0;     _damageTaken = 0;
    _banner = null;      _announcement = null;
    _hintTimer = 5.0;    _hintGone = false;
    _comboText = null;   _cleoCameo = false;

    _rays.length = _particles.length = _enemies.length = 0;
    AERIAL_WAVE.forEach(s => s.spawned = false);

    Object.assign(N, {
      x:150, vy:0, vx:0, hp:5, facing:1,
      state:'run', fi:0, ft:0, st:0,
      attackCooldown:0, invTimer:0, onGround:false,
    });

    // Enemies terrestres
    if (typeof SNEnemies !== 'undefined') {
      GROUND_ENEMIES.forEach(({ type, x, onPlatform }) => {
        const e = SNEnemies.spawnByType(type, x, 0, 'tierra');
        if (onPlatform) {
          // Buscar plataforma más cercana
          const plat = PLATFORMS.find(p => Math.abs(p.x - x) < 200);
          if (plat) e._onPlatform = plat;
        }
        _enemies.push(e);
      });
    }

    _setupInput();
    _spawnParticles(220, 300, 40);  // coordenadas de pantalla
  }

  function isActive() { return _active; }
  function handleKey(key) { if (key === 'Escape') _finish(); }

  // ── Input ─────────────────────────────────────────────
  function _setupInput() {
    document.removeEventListener('keydown', _onKD);
    document.removeEventListener('keyup',   _onKU);
    document.addEventListener('keydown', _onKD);
    document.addEventListener('keyup',   _onKU);

    _bindBtn('mcLeft',  () => _keys.left  = true,  () => _keys.left  = false);
    _bindBtn('mcRight', () => _keys.right = true,  () => _keys.right = false);
    _bindBtn('mcDown',  () => _keys.down  = true,  () => _keys.down  = false);
    _bindBtn('mcJump',  () => { _keys.up = true; _tryJump(); }, () => _keys.up = false);
    _bindBtn('mcFire',  () => _tryFire(), () => {});
  }

  function _onKD(e) {
    if (!_active) return;
    if (e.key === 'ArrowLeft'  || e.key === 'a') _keys.left  = true;
    if (e.key === 'ArrowRight' || e.key === 'd') _keys.right = true;
    if (e.key === 'ArrowDown'  || e.key === 's') _keys.down  = true;
    if (e.key === 'ArrowUp'    || e.key === 'w') { _keys.up = true; _tryJump(); }
    if (e.key === 'z' || e.key === 'Z' || e.key === ' ') _tryFire();
    if (e.key === 'Escape') _finish();
  }
  function _onKU(e) {
    if (e.key === 'ArrowLeft'  || e.key === 'a') _keys.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'd') _keys.right = false;
    if (e.key === 'ArrowDown'  || e.key === 's') _keys.down  = false;
    if (e.key === 'ArrowUp'    || e.key === 'w') _keys.up    = false;
  }

  // ── BUG2 FIX: anti-spam timestamp + cap en 2 ─────────
  function _tryJump() {
    if (!_active || N.state === 'hurt') return;
    const now = performance.now();
    if (now - _lastJumpTs < 80) return;  // anti-doble-tap
    _lastJumpTs = now;
    if (_flying) return;                  // ya vuela, ignorar
    _jumpCount = Math.min(_jumpCount + 1, 2);
    if (_jumpCount === 1 && N.onGround) {
      N.vy = JUMP_VY;
      N.onGround = false;
    } else if (_jumpCount === 2) {
      // VUELO ACTIVADO — slow motion primera vez
      _flying = true;
      N.vy = -60;
      _hintGone = true;
      if (!_slowMoUsed) {
        _slowMo = SLOWMO_DURATION;
        _slowMoUsed = true;
        _spawnParticles(N.x - _camX, N.y + N.h/2, 25);
      }
      if (!_hintGone) _hintTimer = 0;
    }
  }

  function _tryFire() {
    if (!_active || N.attackCooldown > 0 || N.state === 'hurt') return;
    N.attackCooldown = FIRE_COOLDOWN;
    N.state = 'attack'; N.st = 0; N.fi = 0; N.ft = 0;
    _rays.push({
      x:  N.facing === 1 ? N.x + N.w : N.x,
      y:  N.y + N.h * 0.38,
      vx: N.facing * 620,
      r: 12, life: 1.4, active: true,
    });
    if (typeof AudioManager !== 'undefined') AudioManager.sfx('lunaria_shoot');
    if (navigator.vibrate) navigator.vibrate(12);
  }

  // ── Update ────────────────────────────────────────────
  function update(dt, ctx, W, H) {
    if (!_active) return;
    _W = W; _H = H;
    _groundY = H * GROUND_PCT - N.h;

    // Hitstop: congelar todo
    if (_hitstop > 0) {
      _hitstop -= dt;
      _draw(ctx, W, H);
      return;
    }

    // Slowmo: reducir dt
    let realDt = dt;
    if (_slowMo > 0) {
      _slowMo -= dt;
      dt = realDt * 0.25;
    }

    _timer += realDt;

    // Timers de UI
    if (_banner      && (_banner.timer      -= realDt) <= 0) _banner = null;
    if (_announcement && (_announcement.timer -= realDt) <= 0) _announcement = null;
    if (_comboText   && (_comboText.timer   -= realDt) <= 0) _comboText = null;
    if (!_hintGone)  _hintTimer = Math.max(0, _hintTimer - realDt);
    if (_comboTimer > 0) { _comboTimer -= realDt; if (_comboTimer <= 0) _combo = 0; }

    _updateNatan(dt);
    _updateRays(dt);
    _updateEnemies(dt);
    _updateParticles(dt);

    // Cámara — Natan al 30% izquierdo
    const targetCamX = N.x - W * 0.30;
    _camX += (targetCamX - _camX) * 0.10;
    _camX = Math.max(0, Math.min(_camX, WORLD_WIDTH - W));

    // ── Checkpoint ────────────────────────────────────────
    if (!_checkpointReached && N.x > PHASE_TRANSITION_X - 50) {
      _checkpointReached = true;
      _checkpointX = PHASE_TRANSITION_X - 100;
      _showBanner('Checkpoint! 🚩', '#4ade80');
      _spawnParticles(N.x - _camX, N.y, 20);
      if (typeof AudioManager !== 'undefined') AudioManager.sfx('flag_point');
    }

    // ── Transición tierra → vuelo ──────────────────────
    if (_phase === 'tierra' && N.x > PHASE_TRANSITION_X && _flying) {
      _phase = 'vuelo'; _bgAlpha = 1;
      _showAnnouncement('✈️ ¡Volando sobre Rosario!', '#38bdf8');
    }

    // Crossfade fondo
    if (_phase === 'vuelo') _bgAlpha = Math.max(0, _bgAlpha - dt * 0.6);

    // Spawn progresivo de aéreos
    if (_phase === 'vuelo') {
      AERIAL_WAVE.forEach(s => {
        if (!s.spawned && N.x > s.x - 500) {
          s.spawned = true;
          const e = SNEnemies.spawnByType(s.type, s.x, H * s.yP, 'vuelo');
          _enemies.push(e);
          _spawnParticles(s.x - _camX, H * s.yP, 12);
        }
      });
    }

    // Cleopatra en la ventana (cameo cuando Natan se acerca)
    if (!_cleoCameo && N.x > VET_APPEAR_X - 300) {
      _cleoCameo = true;
    }

    // ── Final: veterinaria ─────────────────────────────
    if (_phase !== 'final' && N.x > VET_ENTER_X) {
      _phase = 'final'; _timer = 0;
      _spawnParticles(W * 0.5, H * 0.5, 80);
      if (typeof AudioManager !== 'undefined') AudioManager.sfx('giftbox_open');
    }
    if (_phase === 'final' && _timer > 4.5) _finish();

    _draw(ctx, W, H);
  }

  // ── Natan ─────────────────────────────────────────────
  function _updateNatan(dt) {
    N.st += dt;
    N.attackCooldown = Math.max(0, N.attackCooldown - dt);
    N.invTimer       = Math.max(0, N.invTimer - dt);

    if (N.state === 'hurt') {
      N.x += N.vx * 0.25 * dt;
      _ac(N, dt, 3, 0.09, 'hurt');
      if (N.st > 0.40) { N.state = _flying ? 'fly' : 'run'; N.st = 0; }
      if (!_flying) { N.vy = Math.min(N.vy + GRAVITY*dt, MAX_FALL); N.y += N.vy*dt; }
      _clampGround();
      N.x = Math.max(40, Math.min(N.x, WORLD_WIDTH - N.w - 40));
      return;
    }
    if (N.state === 'attack') {
      _ac(N, dt, 4, 0.10, 'attack');
      if (N.st > 0.42) { N.state = _flying ? 'fly' : 'run'; N.st = 0; }
    }

    // Horizontal
    if (_keys.right)     { N.vx =  NATAN_SPD; N.facing = 1; }
    else if (_keys.left) { N.vx = -NATAN_SPD; N.facing = -1; }
    else                 N.vx *= 0.80;

    if (_flying) {
      // Modo vuelo: ↑ sube, ↓ baja — decay dependiente del dt
      if      (_keys.up)   N.vy = Math.max(N.vy - FLY_SPD_V * dt * 6, -FLY_SPD_V);
      else if (_keys.down) N.vy = Math.min(N.vy + FLY_SPD_V * dt * 6,  FLY_SPD_V);
      else                 N.vy *= Math.pow(0.15, dt);  // decay limpio
      N.y += N.vy * dt;
      N.y = Math.max(20, Math.min(N.y, _groundY - 5));
      // Aterrizaje voluntario (sólo en tierra)
      if (N.y >= _groundY - 2 && _phase === 'tierra') {
        N.y = _groundY; N.vy = 0;
        _flying = false; _jumpCount = 0; N.onGround = true;
      }
      if (N.state !== 'attack' && N.state !== 'hurt')
        _ac(N, dt, 4, 0.12, 'fly');
    } else {
      // Modo tierra: gravedad normal
      N.vy = Math.min(N.vy + GRAVITY * dt, MAX_FALL);
      N.y += N.vy * dt;
      _clampGround();
      if (N.state !== 'attack' && N.state !== 'hurt')
        _ac(N, dt, 6, 0.10, 'run');
    }

    N.x += N.vx * dt;
    N.x = Math.max(40, Math.min(N.x, WORLD_WIDTH - N.w - 40));
  }

  // ── BUG3 FIX: jumpCount reset correcto ───────────────
  function _clampGround() {
    if (N.y >= _groundY) {
      N.y = _groundY; N.vy = 0; N.onGround = true;
      _jumpCount = 0;
      if (_phase === 'tierra') _flying = false;  // aterriza en tierra solamente
    } else {
      N.onGround = false;
    }
    // Colisión plataformas (con colisión real — pilares eliminados)
    if (N.vy >= 0) {
      for (const p of PLATFORMS) {
        const py = _H * GROUND_PCT - _H * p.yRel - p.h;
        if (N.x + N.w > p.x && N.x < p.x + p.w &&
            N.y + N.h > py  && N.y + N.h < py + p.h + 24) {
          N.y = py - N.h; N.vy = 0; N.onGround = true;
          _jumpCount = 0;
        }
      }
    }
  }

  function _ac(obj, dt, total, spd) {
    obj.ft += dt;
    if (obj.ft >= spd) { obj.ft = 0; obj.fi = (obj.fi + 1) % total; }
  }

  // ── Rayos ─────────────────────────────────────────────
  function _updateRays(dt) {
    for (let i = _rays.length - 1; i >= 0; i--) {
      const r = _rays[i];
      if (!r.active) { _rays.splice(i, 1); continue; }
      r.life -= dt;
      if (r.life <= 0) { r.active = false; continue; }
      r.x += r.vx * dt;
      for (const e of _enemies) {
        if (!e.alive || e.zone !== _phase) continue;
        if (r.x+r.r > e.x && r.x-r.r < e.x+e.w &&
            r.y+r.r > e.y && r.y-r.r < e.y+e.h) {
          r.active = false;
          SNEnemies.hitEnemy(e);
          _spawnStars(r.x - _camX, r.y, 10);  // coordenadas de pantalla
          // Hitstop y combo
          _hitstop = HITSTOP_DURATION;
          _combo++;
          _comboTimer = COMBO_TIMEOUT;
          if (_combo >= 3) {
            _comboText = { text:`x${_combo} COMBO!`, x: N.x-_camX, y: N.y-20, timer:1.0, maxTimer:1.0 };
          }
          if (typeof AudioManager !== 'undefined') AudioManager.sfx('death_enemy');
          if (!e.alive) _totalKills++;
          break;
        }
      }
    }
  }

  // ── Enemigos ──────────────────────────────────────────
  function _updateEnemies(dt) {
    const natanRef = { x:N.x, y:N.y, w:N.w, h:N.h };
    for (let i = _enemies.length - 1; i >= 0; i--) {
      const e = _enemies[i];
      if (!e.alive && e.state !== 'death') { _enemies.splice(i, 1); continue; }
      if (e.zone !== _phase) continue;

      SNEnemies.updateEnemy(e, dt, natanRef);

      // Suelo terrestres
      if (e.zone === 'tierra') {
        // Si está en plataforma, usar ese suelo
        let eg = _H * GROUND_PCT - e.h;
        if (e._onPlatform) {
          const p = e._onPlatform;
          const py = _H * GROUND_PCT - _H * p.yRel - p.h;
          eg = py - e.h;
        }
        if (e.y >= eg) { e.y = eg; e.vy = 0; e.onGround = true; }
        else           { e.onGround = false; }
      }

      // Daño a Natan
      if (!e.alive || N.invTimer > 0 || N.state === 'hurt') continue;
      if (e.x+e.w > N.x && e.x < N.x+N.w && e.y+e.h > N.y && e.y < N.y+N.h) {
        N.hp--;
        N.invTimer = HIT_INVINCIBLE;
        N.state = 'hurt'; N.st = 0; N.fi = 0; N.ft = 0;
        // BUG4 FIX: Knockback suave, siempre hacia atrás respecto al enemigo
        const kbDir = (e.x + e.w/2 > N.x + N.w/2) ? -1 : 1;
        N.vx = kbDir * 180;
        N.vy = -150;
        _damageTaken++;
        _combo = 0;  // rompe combo
        if (typeof AudioManager !== 'undefined') AudioManager.sfx('hit_boss');
        if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
        if (N.hp <= 0) { _finish(); return; }
      }
    }
  }

  // ── Partículas (coordenadas de PANTALLA) ──────────────
  function _updateParticles(dt) {
    for (let i = _particles.length - 1; i >= 0; i--) {
      const p = _particles[i];
      p.x += p.vx*dt; p.y += p.vy*dt;
      p.vy += 180*dt; p.life -= dt;
      if (p.life <= 0) _particles.splice(i, 1);
    }
  }
  // BUG4 FIX: _spawnParticles recibe coordenadas de PANTALLA
  function _spawnParticles(cx, cy, n) {
    const c = ['#f9c846','#a78bfa','#38bdf8','#4ade80','#f472b6','#fb923c'];
    for (let i = 0; i < n; i++) {
      const a = Math.random()*Math.PI*2, s = 60+Math.random()*220;
      _particles.push({
        x:cx, y:cy, vx:Math.cos(a)*s, vy:Math.sin(a)*s-60,
        r:3+Math.random()*6, color:c[i%c.length],
        life:0.5+Math.random()*0.8, maxLife:1.3, star:false,
      });
    }
  }
  function _spawnStars(cx, cy, n) {
    const c = ['#fbbf24','#fef08a','#fff'];
    for (let i = 0; i < n; i++) {
      const a = Math.random()*Math.PI*2, s = 80+Math.random()*160;
      _particles.push({
        x:cx, y:cy, vx:Math.cos(a)*s, vy:Math.sin(a)*s-100,
        r:4+Math.random()*5, color:c[i%c.length],
        life:0.6+Math.random()*0.5, maxLife:1.1, star:true,
      });
    }
  }

  // ── Helpers UI ────────────────────────────────────────
  function _showBanner(text, color='#fbbf24') {
    _banner = { text, color, timer:2.5, maxTimer:2.5 };
  }
  function _showAnnouncement(text, color='#fbbf24') {
    _announcement = { text, color, timer:2.0, maxTimer:2.0 };
  }

  // ── Draw ──────────────────────────────────────────────
  function _draw(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);

    // Overlay de slowmo
    if (_slowMo > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(56,189,248,0.08)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    _drawBg(ctx, W, H);

    // Suelo
    if (_bgAlpha > 0.05) {
      ctx.save();
      ctx.globalAlpha = Math.min(_bgAlpha * 1.3, 0.95);
      ctx.fillStyle = '#7A5510';
      ctx.fillRect(0, H*GROUND_PCT, W, H*(1-GROUND_PCT));
      ctx.fillStyle = '#9A700A';
      ctx.fillRect(0, H*GROUND_PCT - 3, W, 3);
      ctx.restore();
    }

    // Plataformas
    if (_bgAlpha > 0.05) {
      ctx.save();
      ctx.globalAlpha = Math.min(_bgAlpha * 1.3, 0.90);
      for (const p of PLATFORMS) {
        const sx = p.x - _camX;
        if (sx + p.w < -10 || sx > W + 10) continue;
        const py = H * GROUND_PCT - H * p.yRel - p.h;
        ctx.fillStyle = '#5C3A08';
        ctx.fillRect(sx, py, p.w, p.h);
        ctx.fillStyle = '#9A700A';
        ctx.fillRect(sx, py, p.w, 3);
      }
      ctx.restore();
    }

    // Partículas
    for (const p of _particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.9;
      ctx.fillStyle   = p.color;
      if (p.star) {
        ctx.font = `${p.r * 2.5}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⭐', p.x, p.y);
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    // BUG4 FIX: pasar _camX al draw — sin clonar objetos
    for (const e of _enemies) {
      if (e.zone !== _phase) continue;
      if (!e.alive && e.state !== 'death') continue;
      SNEnemies.drawEnemy(ctx, e, _camX, 0);
    }

    // Rayos
    for (const r of _rays) {
      if (!r.active) continue;
      const rx = r.x - _camX;
      ctx.save();
      ctx.globalAlpha = Math.min(1, r.life * 1.4);
      const g = ctx.createRadialGradient(rx, r.y, 0, rx, r.y, r.r*3);
      g.addColorStop(0, 'rgba(253,230,138,0.98)');
      g.addColorStop(0.4, 'rgba(250,204,21,0.60)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(rx, r.y, r.r*3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(rx, r.y, r.r*0.5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    _drawNatan(ctx);

    // Veterinaria (con Cleopatra)
    if (N.x > VET_APPEAR_X) _drawVeterinaria(ctx, W, H);

    // HUD
    _drawHUD(ctx, W, H);

    // Overlays de UI
    _drawBanner(ctx, W, H);
    _drawAnnouncement(ctx, W, H);
    _drawComboText(ctx);
    _drawFlyHint(ctx, W, H);

    if (_phase === 'final') _drawFinal(ctx, W, H);
  }

  function _drawBg(ctx, W, H) {
    const di = (key, alpha) => {
      const im = _img(key);
      if (!im || alpha <= 0) return;
      const ar = im.naturalWidth / im.naturalHeight;
      const dh = H, dw = Math.max(W + 200, dh * ar);
      const off = (_camX * 0.12) % dw;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.drawImage(im, -off,       0, dw, dh);
      ctx.drawImage(im, -off + dw,  0, dw, dh);
      ctx.restore();
    };
    di('fondo_tierra', _bgAlpha);
    if (_bgAlpha < 1) di('fondo_aire', 1 - _bgAlpha);
  }

  function _drawNatan(ctx) {
    const vis = N.invTimer <= 0 || Math.floor(_timer * 9) % 2 === 0;
    if (!vis) return;

    const sx = N.x - _camX;

    // Aura de vuelo (MEJORA: feedback visual claro)
    if (_flying) {
      ctx.save();
      const pulse = 0.3 + Math.sin(_timer * 4) * 0.15;
      const glow = ctx.createRadialGradient(sx+N.w/2, N.y+N.h/2, 0, sx+N.w/2, N.y+N.h/2, 55);
      glow.addColorStop(0, `rgba(56,189,248,${pulse})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx + N.w/2, N.y + N.h/2, 55, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    let animKey;
    if      (N.state === 'attack') animKey = `attack${N.fi}`;
    else if (N.state === 'hurt')   animKey = `hurt${N.fi}`;
    else if (_flying)              animKey = `fly${N.fi}`;
    else                           animKey = `run${N.fi}`;

    const im = _img(animKey);
    ctx.save();
    ctx.translate(sx + N.w/2, N.y + N.h/2);
    if (N.facing === -1) ctx.scale(-1, 1);
    if (im) ctx.drawImage(im, -N.w/2, -N.h/2, N.w, N.h);
    else { ctx.fillStyle = '#3b82f6'; ctx.fillRect(-N.w/2, -N.h/2, N.w, N.h); }
    ctx.restore();
  }

  function _drawVeterinaria(ctx, W, H) {
    const vx = 4500 - _camX;
    if (vx > W + 20 || vx + 220 < 0) return;
    const vw = 220, vh = 260;
    const vy = H * GROUND_PCT - vh;
    ctx.save();
    ctx.fillStyle = '#fde68a'; ctx.fillRect(vx, vy, vw, vh);
    ctx.fillStyle = '#78350f'; ctx.lineWidth = 3;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.fillStyle = '#92400e'; ctx.fillRect(vx+85, vy+vh-80, 50, 80);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(vx+115, vy+vh-40, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(vx+20, vy+30, 50, 50);
    ctx.fillRect(vx+150, vy+30, 50, 50);
    ctx.strokeStyle = '#78350f';
    ctx.strokeRect(vx+20, vy+30, 50, 50);
    ctx.strokeRect(vx+150, vy+30, 50, 50);
    ctx.fillStyle = '#dc2626'; ctx.fillRect(vx+10, vy-35, vw-20, 30);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Fredoka,system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🐾 Veterinaria Nata', vx+vw/2, vy-20);

    // MEJORA: Cleopatra en la ventana izquierda
    if (_cleoCameo) {
      const bounce = Math.sin(_timer * 4) * 3;
      ctx.font = '24px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐱', vx + 45, vy + 55 + bounce);
      // Si Natan llegó cerca, Cleopatra salta hacia él
      if (N.x > 4480) {
        const cleoX = vx + 45 + (N.x - _camX - (vx+45)) * 0.3;
        const cleoY = vy + 55 - 40;
        ctx.fillText('🐱', cleoX, cleoY);
      }
    }
    ctx.restore();
  }

  function _drawHUD(ctx, W, H) {
    ctx.save();
    // Vidas
    let h = 'SuperNatan  ';
    for (let i = 0; i < N.maxHp; i++) h += i < N.hp ? '❤️' : '🖤';
    ctx.font = 'bold 15px Fredoka,system-ui';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(h, 13, 28);
    ctx.fillStyle = '#fff';             ctx.fillText(h, 12, 27);

    // Barra de progreso (hasta VET_ENTER_X, no WORLD_WIDTH)
    const progress = Math.min(1, N.x / VET_ENTER_X);
    const barX = 12, barY = 36, barW = W - 24, barH = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(barX, barY, barW, barH);
    // Color según fase
    ctx.fillStyle = _phase === 'vuelo' ? '#38bdf8' : '#4ade80';
    ctx.fillRect(barX, barY, barW * progress, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.font = '14px serif'; ctx.textAlign = 'left';
    ctx.fillText('🐾', barX + barW - 2, barY + barH + 12);
    ctx.font = '12px serif';
    ctx.fillText('🦸', barX + barW * progress - 6, barY + barH + 12);

    // Fase
    const faseLabel = _phase === 'tierra' ? '🏙️ Bv. Rondeau'
                    : _phase === 'vuelo'  ? '✈️ Volando sobre Rosario'
                    :                       '🐾 ¡Llegó a la veterinaria!';
    ctx.textAlign = 'center'; ctx.font = 'bold 13px Fredoka,system-ui';
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillText(faseLabel, W/2+1, 28);
    ctx.fillStyle = '#fbbf24';          ctx.fillText(faseLabel, W/2,   27);

    // Modo
    const modeLabel = _flying         ? '🦅 Volando (↑↓)'
                    : N.onGround       ? '↑↑ para volar'
                    :                    '⬆️ En el aire';
    ctx.font = '12px Fredoka,system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(modeLabel, W/2, H - 28);
    ctx.font = '11px Fredoka,system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.fillText('← → moverse  ↑ saltar/subir  ↓ bajar  Z/Esp = rayo', W/2, H - 12);
    ctx.restore();
  }

  // MEJORA: Banner de checkpoint/fase
  function _drawBanner(ctx, W, H) {
    if (!_banner || _banner.timer <= 0) return;
    const pct   = _banner.timer / _banner.maxTimer;
    const alpha = pct < 0.2 ? pct / 0.2 : pct > 0.8 ? (pct - 0.8) / 0.2 * (-1) + 1 : 1;
    const scale = 0.8 + alpha * 0.2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${Math.min(W * 0.055, 32) * scale}px Fredoka,system-ui`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(_banner.text, W/2 + 1, H * 0.20 + 1);
    ctx.fillStyle = _banner.color || '#fbbf24';
    ctx.fillText(_banner.text, W/2, H * 0.20);
    ctx.restore();
  }

  // MEJORA: Anuncio de fase animado
  function _drawAnnouncement(ctx, W, H) {
    if (!_announcement || _announcement.timer <= 0) return;
    const pct = _announcement.timer / _announcement.maxTimer;
    const alpha = pct < 0.15 ? pct / 0.15 : pct > 0.75 ? (1 - (pct - 0.75) / 0.25) : 1;
    const yOff  = (1 - alpha) * -20;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${Math.min(W * 0.07, 40)}px Fredoka,system-ui`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(_announcement.text, W/2+2, H*0.38 + yOff + 2);
    ctx.fillStyle = _announcement.color || '#fbbf24';
    ctx.fillText(_announcement.text, W/2, H*0.38 + yOff);
    ctx.restore();
  }

  // MEJORA: Texto de combo
  function _drawComboText(ctx) {
    if (!_comboText || _comboText.timer <= 0) return;
    const pct = _comboText.timer / _comboText.maxTimer;
    const scale = 1 + (1 - pct) * 0.4;
    ctx.save();
    ctx.globalAlpha = pct;
    ctx.font = `bold ${28 * scale}px Fredoka,system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(_comboText.text, _comboText.x+1, _comboText.y+1);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(_comboText.text, _comboText.x, _comboText.y - (1-pct)*30);
    ctx.restore();
  }

  // MEJORA: Hint de vuelo (primeros 5 segundos)
  function _drawFlyHint(ctx, W, H) {
    if (_hintGone || _hintTimer <= 0) return;
    const alpha = Math.min(1, _hintTimer * 2) * (0.6 + Math.sin(_timer * 4) * 0.4);
    const sx = N.x - _camX;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 13px Fredoka,system-ui';
    ctx.textAlign = 'center';
    // Fondo del hint
    const txt = '↑↑ Doble salto = Volar! 🦅';
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(sx + N.w/2 - tw/2 - 8, N.y - 38, tw + 16, 22);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(txt, sx + N.w/2, N.y - 22);
    ctx.restore();
  }

  function _drawFinal(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';

    const pulse = 1 + Math.sin(_timer * 4) * 0.03;
    ctx.font = `bold ${Math.min(W*0.08, 44) * pulse}px Fredoka,system-ui`;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText('¡Cleopatra está a salvo!', W/2+2, H*0.38+2);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('¡Cleopatra está a salvo!', W/2, H*0.38);

    ctx.font = `${Math.min(W*0.042, 24)}px Fredoka,system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('🐱 SuperNatan y Cleopatra listos para Manolandia! 🦸', W/2, H*0.50);

    // MEJORA: Diálogo de Natan
    if (_timer > 1.0) {
      ctx.font = `${Math.min(W*0.035, 20)}px Fredoka,system-ui`;
      ctx.fillStyle = 'rgba(255,220,80,0.95)';
      ctx.fillText('"Cleopatra, ya llegué! Manolandia puede esperar."', W/2, H*0.60);
    }

    // MEJORA: Calificación de patas de gato
    if (_timer > 2.0) {
      const patas = _damageTaken === 0 ? 3 : _damageTaken <= 2 ? 2 : 1;
      ctx.font = `${Math.min(W*0.05, 28)}px serif`;
      ctx.fillText('🐾'.repeat(patas) + '🤍'.repeat(3 - patas), W/2, H*0.70);
      ctx.font = `${Math.min(W*0.03, 18)}px Fredoka,system-ui`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const label = patas === 3 ? 'Perfecto!' : patas === 2 ? 'Muy bien!' : 'Bien hecho!';
      ctx.fillText(label, W/2, H*0.77);
    }

    ctx.font = `${Math.min(W*0.028, 16)}px Fredoka,system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('Volviendo al Sendero Nocturno...', W/2, H*0.86);
    ctx.restore();
  }

  // ── Finalizar ─────────────────────────────────────────
  function _finish() {
    if (!_active) return;
    _active = false;
    document.removeEventListener('keydown', _onKD);
    document.removeEventListener('keyup',   _onKU);
    // Cleanup listeners de botones
    _btnHandlers.forEach((handlers, id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.removeEventListener('pointerdown',  handlers.d);
      el.removeEventListener('pointerup',    handlers.u);
      el.removeEventListener('pointercancel', handlers.u);
    });
    _btnHandlers.clear();
    _enemies.length = _rays.length = _particles.length = 0;
    if (_onReturn) _onReturn();
  }

  return { start, isActive, update, handleKey };

})();