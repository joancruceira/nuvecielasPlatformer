// ═══════════════════════════════════════════════════════
//  PLAYER.JS — Física, movimiento y habilidades únicas
// ═══════════════════════════════════════════════════════

const Player = (() => {

  // ── Datos de personajes ──
  const CHARACTERS = {
    nuveciela: {
      label:   'Nuveciela',
      ability: 'Doble salto + Bola de fuego',
      desc:    'Doble salto alto. ← ← lanza bola de fuego.',
      fireballCooldown: 0.55,
      color:   '#a78bfa',
      img:     'img/nuveciela.png',
      speed:       280,
      jumpForce:   -620,
      dblJumpForce:-580,
      gravity:     1380,
      slideSpeed:  420,
    },
    ciela: {
      label:   'Ciela',
      ability: '← ← Bola de hielo',
      desc:    'Deslizamiento veloz. ← ← congela enemigos 2s.',
      iceballCooldown: 0.7,
      color:   '#38bdf8',
      img:     'img/ciela.png',
      speed:       300,
      jumpForce:   -590,
      dblJumpForce:-490,
      gravity:     1400,
      slideSpeed:  560,
    },
    lunaria: {
      label:   'Lunaria',
      ability: '← ← Rayo de luz',
      desc:    'Flotación mágica. ← ← dispara rayo que quema.',
      rayoCooldown: 0.6,
      color:   '#fbbf24',
      img:     'img/lunaria.png',
      speed:       270,
      jumpForce:   -600,
      dblJumpForce:-480,
      gravity:     1360,
      floatGravity:240,
      slideSpeed:  380,
    },
    nuve: {
      label:   'Nuve',
      ability: 'Volar + ← ← Bolas de colores',
      desc:    '↑↑ para volar. ← ← dispara bolas de colores.',
      colorballCooldown: 0.45,
      canFly: true,
      color:   '#f97316',
      img:     'img/nuve.png',
      speed:       265,
      jumpForce:   -600,
      dblJumpForce:-490,
      gravity:     1450,
      groundPoundRadius: 110,
      slideSpeed:  380,
    },
  };

  const TILE_SIZE_P = 48;
  const PLAYER_W = 58;
  const PLAYER_H = 72;

  const state = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    w: PLAYER_W, h: PLAYER_H,
    grounded: false,
    jumping: false,
    doubleJumped: false,
    canDoubleJump: true,
    sliding: false,
    slideTimer: 0,
    floating: false,
    floatTimer: 0,
    facingX: 0,
    facingY: 0,
    facing: 1,
    charId: 'nuveciela',
    lives: 5,
    stars: 0,
    checkpointX: 0,
    checkpointY: 0,
    invincible: false,
    invTimer: 0,
    groundPounding: false,
    wasGrounded: false,
    dead: false,
    fireballs: [],
    fireballCooldown: 0,
    projectiles: [],     // todos los proyectiles (hielo, rayo, bolas)
    projectileCooldown: 0,
    immuneTimer: 0,
    flying: false,
    colorIdx: 0,
    floatUsed: false,    // Lunaria: bloqueado tras agotar 1.5s
  };

  function getChar() { return CHARACTERS[state.charId]; }
  function getState() { return state; }
  function getCharacters() { return CHARACTERS; }

  function init(charId, spawnX, spawnY) {
    state.charId = charId || 'nuveciela';
    state.x = spawnX;
    state.y = spawnY;
    state.vx = 0; state.vy = 0;
    state.grounded = false;
    state.jumping = false;
    state.doubleJumped = false;
    state.canDoubleJump = true;
    state.sliding = false;
    state.slideTimer = 0;
    state.floating = false;
    state.floatTimer = 0;
    state.facing = 1;
    state.lives = 5;
    state.stars = 0;
    state.checkpointX = spawnX;
    state.checkpointY = spawnY;
    state.invincible = false;
    state.invTimer = 0;
    state.groundPounding = false;
    state.wasGrounded = false;
    state.dead = false;
    state.fireballs = [];
    state.fireballCooldown = 0;
    state.projectiles = [];
    state.projectileCooldown = 0;
    state.immuneTimer = 0;
    state.flying   = false;
    state.colorIdx = 0;
    state.floatUsed = false;
  }

  function respawn() {
    state.x = state.checkpointX;
    state.y = state.checkpointY;
    state.vx = 0; state.vy = 0;
    state.grounded = false;
    state.jumping = false;
    state.doubleJumped = false;
    state.canDoubleJump = true;
    state.sliding = false;
    state.floating = false;
    state.invincible = true;
    state.invTimer = 2.0;
    state.groundPounding = false;
    state.dead = false;
    state.fireballs = [];
    state.fireballCooldown = 0;
    state.projectiles = [];
    state.projectileCooldown = 0;
    state.flying    = false;
    state.floatUsed = false;
  }

  // ── Update principal ──
  function update(dt, input, map, onLand) {
    if (state.dead) return;

    const ch = getChar();
    state.wasGrounded = state.grounded;

    // timers
    if (state.invTimer > 0) {
      state.invTimer -= dt;
      if (state.invTimer <= 0) {
        state.invTimer = 0;
        state.invincible = false;
      }
    }
    if (state.slideTimer > 0) state.slideTimer -= dt;
    else state.sliding = false;

    // ── Movimiento horizontal ──
    if (state.sliding) {
      // BUG FIX: Ciela hace slide en la dirección que mira, no en la del input
      state.vx = state.facing * ch.slideSpeed;
    } else {
      const targetVx = input.right ? ch.speed : input.left ? -ch.speed : 0;
      const acc = state.grounded ? 18 : 10;
      state.vx += (targetVx - state.vx) * acc * dt;
      if (Math.abs(state.vx) < 1) state.vx = 0;
    }

    // dirección del personaje
    if (state.vx > 5)  state.facing = 1;
    if (state.vx < -5) state.facing = -1;

    // ── Gravedad ──
    let gravity = ch.gravity;

    // Lunaria: flotar manteniendo jump — se bloquea hasta el próximo salto
    if (state.charId === 'lunaria' && !state.grounded && input.jumpHeld
        && state.vy > 0 && !state.floatUsed) {
      state.floating    = true;
      state.floatTimer += dt;
      if (state.floatTimer >= 1.5) {
        state.floating  = false;
        state.floatUsed = true; // bloqueado hasta aterrizar
      } else {
        gravity = ch.floatGravity;
      }
    } else {
      state.floating = false;
      // Solo resetear el timer si suelta la tecla o toca el suelo
      if (!input.jumpHeld || state.grounded) state.floatTimer = 0;
    }

    // caída rápida si soltó el salto
    if (!input.jumpHeld && state.vy < 0) gravity *= 1.5;

    state.vy += gravity * dt;
    state.vy = Math.min(state.vy, 900);

    // ── Aplicar velocidades ──
    state.x += state.vx * dt;
    state.y += state.vy * dt;

    // ── Colisiones con el mapa ──
    state.grounded = false;
    resolveCollisions(map);

    // ── Aterrizaje ──
    if (!state.wasGrounded && state.grounded) {
      state.jumping = false;
      state.doubleJumped = false;
      state.canDoubleJump = true;
      state.floatTimer = 0;
      state.floatUsed  = false; // puede volver a flotar en el próximo salto

      // Nuve: golpe de tierra
      if (state.charId === 'nuve' && state.groundPounding) {
        onLand && onLand('groundPound', state.x + state.w / 2, state.y + state.h, ch.groundPoundRadius);
        Renderer.flash('rgba(249,200,70,.5)', 0.45);
        Renderer.spawnParticles(state.x + state.w / 2, state.y + state.h, '#f97316', 22);
      }
      state.groundPounding = false;
    }

    // Cooldowns
    if (state.fireballCooldown   > 0) state.fireballCooldown   -= dt;
    if (state.projectileCooldown > 0) state.projectileCooldown -= dt;
    if (state.immuneTimer        > 0) {
      state.immuneTimer -= dt;
      if (state.immuneTimer <= 0) { state.immuneTimer = 0; state.invincible = false; }
    }

    // Nuve: volar si tiene canFly y está en el aire manteniendo ↑
    if (state.charId === 'nuve' && getChar().canFly) {
      if (!state.grounded && input.jumpHeld && state.vy > -200) {
        state.flying = true;
        state.vy     = Math.max(state.vy - 1200 * dt, -300);
      } else {
        state.flying = false;
      }
    }

    // Actualizar todos los proyectiles
    updateFireballs(dt, map);
    updateProjectiles(dt, map);

    // límite izquierdo
    if (state.x < 0) { state.x = 0; state.vx = 0; }

    // caída al vacío
    if (state.y > map.length * TILE_SIZE_P + 100) {
      takeDamage();
    }
  }

  // ── Colisiones con tilemap ──
  function resolveCollisions(map) {
    if (!map) return;
    const rows = map.length;
    const cols = map[0].length;

    // BUG FIX: Guardar posición previa para resolver colisiones horizontales
    // con la posición Y ya resuelta (evita tunneling en slides rápidos)
    const left   = state.x;
    const right  = state.x + state.w;
    const top    = state.y;
    const bottom = state.y + state.h;

    const c0 = Math.max(0, Math.floor(left / TILE_SIZE_P));
    const c1 = Math.min(cols - 1, Math.floor((right - 1) / TILE_SIZE_P));
    const r0 = Math.max(0, Math.floor(top / TILE_SIZE_P));
    const r1 = Math.min(rows - 1, Math.floor((bottom - 1) / TILE_SIZE_P));

    // ── Vertical (suelo y techo) ──
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const tile = map[r][c];
        const isSolid    = tile === TILE.GROUND || tile === TILE.BLOCK;
        const isPlatform = tile === TILE.PLATFORM;

        if (isSolid || isPlatform) {
          const tileTop    = r * TILE_SIZE_P;
          const tileBottom = tileTop + TILE_SIZE_P;
          const tileLeft   = c * TILE_SIZE_P;
          const tileRight  = tileLeft + TILE_SIZE_P;

          // colisión desde arriba (aterrizaje)
          if (state.vy >= 0 && bottom > tileTop && top < tileTop &&
              right > tileLeft + 2 && left < tileRight - 2) {
            if (isPlatform && state.vy >= 0 && bottom - state.vy * 0.02 <= tileTop + 12) {
              state.y = tileTop - state.h;
              state.vy = 0;
              state.grounded = true;
            } else if (isSolid) {
              state.y = tileTop - state.h;
              state.vy = 0;
              state.grounded = true;
            }
          }
          // colisión desde abajo (techo) — solo sólidos
          if (isSolid && state.vy < 0 && top < tileBottom && bottom > tileBottom &&
              right > tileLeft + 2 && left < tileRight - 2) {
            state.y = tileBottom;
            state.vy = 0;
          }
        }
      }
    }

    // ── Horizontal (paredes) ──
    // BUG FIX: Recalcular filas con la Y ya corregida para evitar falsos positivos
    const r0h = Math.max(0, Math.floor((state.y + 2) / TILE_SIZE_P));
    const r1h = Math.min(rows - 1, Math.floor((state.y + state.h - 2) / TILE_SIZE_P));
    // BUG FIX: Recalcular columnas con la X actual
    const c0h = Math.max(0, Math.floor(state.x / TILE_SIZE_P));
    const c1h = Math.min(cols - 1, Math.floor((state.x + state.w - 1) / TILE_SIZE_P));

    for (let r = r0h; r <= r1h; r++) {
      for (let c = c0h; c <= c1h; c++) {
        const tile = map[r][c];
        const isSolid = tile === TILE.GROUND || tile === TILE.BLOCK;
        if (!isSolid) continue;

        const tileLeft  = c * TILE_SIZE_P;
        const tileRight = tileLeft + TILE_SIZE_P;

        // pared derecha
        if (state.vx > 0 && (state.x + state.w) > tileLeft && state.x < tileLeft) {
          state.x = tileLeft - state.w;
          state.vx = 0;
          if (state.sliding) { state.sliding = false; state.slideTimer = 0; }
        }
        // pared izquierda
        if (state.vx < 0 && state.x < tileRight && (state.x + state.w) > tileRight) {
          state.x = tileRight;
          state.vx = 0;
          if (state.sliding) { state.sliding = false; state.slideTimer = 0; }
        }
      }
    }

    // ── Pinchos: daño de contacto ──
    // BUG FIX: Los pinchos no causaban daño; se chequea aquí directamente
    const rSpike0 = Math.max(0, Math.floor(state.y / TILE_SIZE_P));
    const rSpike1 = Math.min(rows - 1, Math.floor((state.y + state.h - 1) / TILE_SIZE_P));
    const cSpike0 = Math.max(0, Math.floor(state.x / TILE_SIZE_P));
    const cSpike1 = Math.min(cols - 1, Math.floor((state.x + state.w - 1) / TILE_SIZE_P));

    for (let r = rSpike0; r <= rSpike1; r++) {
      for (let c = cSpike0; c <= cSpike1; c++) {
        if (map[r][c] === TILE.SPIKES) {
          takeDamage();
          return; // un solo daño por frame
        }
      }
    }
  }

  // ── Inputs de acción ──
  function tryJump() {
    if (state.dead || state.sliding) return;
    const ch = getChar();

    if (state.grounded) {
      state.vy = ch.jumpForce;
      state.grounded = false;
      state.jumping = true;
      state.canDoubleJump = true;
      state.floatTimer = 0;
    } else if (state.canDoubleJump && !state.doubleJumped) {
      state.vy = ch.dblJumpForce;
      state.doubleJumped = true;
      state.canDoubleJump = false;
      state.floating = false;
      state.floatTimer = 0;
      Renderer.spawnParticles(
        state.x + state.w / 2,
        state.y + state.h,
        CHARACTERS[state.charId].color, 12
      );
    }
  }

  function trySlide() {
    if (state.dead || !state.grounded || state.sliding) return;
    state.sliding = true;
    state.slideTimer = 0.55;
    Renderer.spawnParticles(
      state.x + state.w / 2,
      state.y + state.h,
      '#fff', 8
    );
  }

  function tryGroundPound() {
    if (state.charId !== 'nuve') return;
    if (state.grounded || state.groundPounding) return;
    state.groundPounding = true;
    state.vy = 900;
    state.floating = false;
  }

  function takeDamage(sourceX = null) {
    if (state.invincible || state.dead) return;
    state.lives -= 1;
    Renderer.flash('#ef4444', 0.6);
    Renderer.spawnParticles(state.x + state.w / 2, state.y + state.h / 2, '#ef4444', 18);
    if (state.lives <= 0) {
      state.dead = true;
    } else {
      // Knockback: empujar en dirección contraria a la fuente de daño
      const kbDir = (sourceX !== null)
        ? (state.x + state.w / 2 > sourceX ? 1 : -1)
        : (state.facing * -1);
      state.vx        = kbDir * 320;
      state.vy        = -280;
      state.grounded  = false;
      respawn();
    }
  }

  function collectStar() {
    state.stars += 1;
    Renderer.spawnParticles(state.x + state.w / 2, state.y, '#f9c846', 16);
    Renderer.spawnText(state.x + state.w / 2, state.y - 10, '+⭐', '#f9c846');
  }

  function activateCheckpoint(x, y) {
    state.checkpointX = x;
    state.checkpointY = y;
    Renderer.flash('rgba(74,222,128,.4)', 0.5);
    Renderer.spawnText(x, y - 20, '✅ Checkpoint', '#4ade80');
  }

  // ── Bolas de fuego (Nuveciela) ──
  function tryFireball() {
    if (state.charId !== 'nuveciela') return;
    if (state.fireballCooldown > 0) return;
    const ch = getChar();
    const dir = state.facing; // 1=derecha, -1=izquierda
    state.fireballs.push({
      x:  state.x + (dir > 0 ? state.w : 0),
      y:  state.y + state.h * 0.35,
      vx: dir * 480,
      vy: 0,
      r:  10,
      life: 2.2,
      active: true,
    });
    state.fireballCooldown = ch.fireballCooldown || 0.55;
    // Partículas al disparar
    Renderer.spawnParticles(
      state.x + state.w / 2,
      state.y + state.h * 0.35,
      '#f97316', 8
    );
  }

  function updateFireballs(dt, map) {
    if (!map) return;
    const rows = map.length;
    const cols = map[0].length;
    const TILE_SIZE_F = 48;

    for (let i = state.fireballs.length - 1; i >= 0; i--) {
      const fb = state.fireballs[i];
      if (!fb.active) { state.fireballs.splice(i, 1); continue; }

      fb.life -= dt;
      if (fb.life <= 0) { fb.active = false; continue; }

      // Gravedad leve para arco natural
      fb.vy += 280 * dt;
      fb.x  += fb.vx * dt;
      fb.y  += fb.vy * dt;

      // Colisión con tiles sólidos — rebota una vez
      const c = Math.floor(fb.x / TILE_SIZE_F);
      const r = Math.floor(fb.y / TILE_SIZE_F);
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        const t = map[r][c];
        if (t === TILE.GROUND || t === TILE.BLOCK || t === TILE.PLATFORM) {
          if (!fb.bounced) {
            fb.bounced = true;
            fb.vx = -fb.vx * 0.55;
            fb.vy = -Math.abs(fb.vy) * 0.5 - 50;
            fb.life = Math.min(fb.life, 0.55);
            Renderer.spawnParticles(fb.x, fb.y, '#f97316', 4);
          } else {
            Renderer.spawnParticles(fb.x, fb.y, '#f97316', 6);
            fb.active = false;
            continue;
          }
        }
      }
      if (fb.x < 0 || fb.x > cols * TILE_SIZE_F || fb.y > rows * TILE_SIZE_F) {
        fb.active = false;
      }
    }
  }

  function getFireballs() { return state.fireballs; }

  // ── Proyectil universal (Ciela=hielo, Lunaria=rayo, Nuve=bolas de colores) ──
  const NUVE_COLORS = ['#f97316','#a78bfa','#38bdf8','#4ade80','#f9c846','#f472b6'];

  function tryProjectile() {
    const ch = getChar();
    const id = state.charId;
    if (id === 'nuveciela') { tryFireball(); return; }
    if (state.projectileCooldown > 0) return;

    const dir = state.facing;
    const cx  = state.x + (dir > 0 ? state.w : 0);
    const cy  = state.y + state.h * 0.35;

    if (id === 'ciela') {
      state.projectiles.push({
        kind: 'ice', x: cx, y: cy,
        vx: dir * 520, vy: -20,
        r: 10, life: 1.8, active: true,
        color: '#7dd3fc',
      });
      state.projectileCooldown = ch.iceballCooldown || 0.7;
      Renderer.spawnParticles(cx, cy, '#bae6fd', 8);
    } else if (id === 'lunaria') {
      // Rayo: más rápido y recto, sin gravedad
      state.projectiles.push({
        kind: 'ray', x: cx, y: cy,
        vx: dir * 700, vy: 0,
        r: 8, life: 1.2, active: true,
        color: '#fde68a',
      });
      state.projectileCooldown = ch.rayoCooldown || 0.6;
      Renderer.spawnParticles(cx, cy, '#fde68a', 10);
    } else if (id === 'nuve') {
      const col = NUVE_COLORS[state.colorIdx % NUVE_COLORS.length];
      state.colorIdx++;
      state.projectiles.push({
        kind: 'colorball', x: cx, y: cy,
        vx: dir * 450, vy: (Math.random() - 0.5) * 80,
        r: 10, life: 2.0, active: true,
        color: col,
      });
      state.projectileCooldown = ch.colorballCooldown || 0.45;
      Renderer.spawnParticles(cx, cy, col, 8);
    }
  }

  function updateProjectiles(dt, map) {
    if (!map) return;
    const rows = map.length, cols = map[0].length;
    const TS   = 48;

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      if (!p.active) { state.projectiles.splice(i, 1); continue; }

      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }

      // Rayo: sin gravedad. Hielo: poca. Bola: normal
      if (p.kind === 'ice')       p.vy += 120 * dt;
      else if (p.kind === 'ray')  p.vy  = 0;
      else                        p.vy += 200 * dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Colisión con tiles — rebotan una vez antes de destruirse
      const c = Math.floor(p.x / TS), r = Math.floor(p.y / TS);
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        const t = map[r][c];
        if (t === TILE.GROUND || t === TILE.BLOCK || t === TILE.PLATFORM) {
          if (!p.bounced) {
            p.bounced = true;
            p.vx = -p.vx * 0.6;
            p.vy = -Math.abs(p.vy) * 0.55 - 60;
            p.life = Math.min(p.life, 0.6);
            Renderer.spawnParticles(p.x, p.y, p.color, 4);
          } else {
            Renderer.spawnParticles(p.x, p.y, p.color, 5);
            p.active = false; continue;
          }
        }
      }
      if (p.x < 0 || p.x > cols*TS || p.y > rows*TS) p.active = false;
    }
  }

  function getProjectiles() { return state.projectiles; }

  // Activar inmunidad del Árbol Mágico
  function activateImmunity(duration = 5.0) {
    state.immuneTimer = duration;
    state.invincible  = true;
    Renderer.flash('rgba(74,222,128,.5)', 0.6);
    Renderer.spawnParticles(state.x + state.w/2, state.y, '#4ade80', 24);
    Renderer.spawnText(state.x + state.w/2, state.y - 20, '🌳 ¡Inmune 5s!', '#4ade80');
  }

    function getBounds() {
    return { x: state.x, y: state.y, w: state.w, h: state.h };
  }

  return {
    CHARACTERS,
    init, update, respawn,
    tryJump, trySlide, tryGroundPound, tryFireball, tryProjectile,
    takeDamage, collectStar, activateCheckpoint,
    getState, getChar, getCharacters, getBounds, getFireballs, getProjectiles, activateImmunity,
  };

})();
