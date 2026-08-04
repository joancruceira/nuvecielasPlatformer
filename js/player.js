// ═══════════════════════════════════════════════════════
//  PLAYER.JS — Física, movimiento, habilidades y proyectiles
//  Depende de: player_characters.js (define CHARACTERS)
//
//  Principio de escalabilidad:
//  - Agregar un personaje nuevo → solo tocar player_characters.js
//  - player.js NO tiene if/else por personaje en los proyectiles
//  - Las habilidades especiales se leen de flags en CHARACTERS
//    (canFloat, canFly, canGroundPound, usesFireball, etc.)
// ═══════════════════════════════════════════════════════

const Player = (() => {

  const TS = 48;  // TILE_SIZE
  const PLAYER_W = 58;
  const PLAYER_H = 72;

  const state = {
    x:0, y:0, vx:0, vy:0,
    w: PLAYER_W, h: PLAYER_H,
    grounded:false, jumping:false,
    doubleJumped:false, canDoubleJump:true,
    sliding:false, slideTimer:0,
    floating:false, floatTimer:0, floatUsed:false,
    facing:1, facingX:0, facingY:0,
    charId: 'nuveciela',
    lives:5, stars:0,
    checkpointX:0, checkpointY:0,
    invincible:false, invTimer:0,
    groundPounding:false, wasGrounded:false,
    dead:false,
    flying:false, colorIdx:0,
    fireballs:[],       fireballCooldown:0,
    projectiles:[],     projectileCooldown:0,
    immuneTimer:0,
    maxLives: 5,
    onIce: false,
    // Súper Árbol Mágico (ajuste de balance): tamaño +50% visual (jugador y
    // disparos) + daño extra al Rey Escarcha, mientras superTimer > 0.
    // sizeMult NUNCA toca w/h (hitbox) — es puramente visual/render.
    superTimer: 0,
    sizeMult: 1,
    // Coyote time / jump buffer — ver _consumeJump()
    coyoteTimer: 0,
    jumpBufferTimer: 0,
  };

  // Ventanas de gracia del salto (segundos). Son EL detalle que separa un
  // plataformas que responde de uno que "se come" los saltos:
  //  - coyote: podés saltar hasta 100ms después de dejar el borde
  //  - buffer: si apretás saltar poco antes de aterrizar, se ejecuta al tocar suelo
  const COYOTE_TIME = 0.10;
  const JUMP_BUFFER = 0.12;

  // ── Contexto de nivel ────────────────────────────────
  // El nivel activo declara sus propios modificadores de física en
  // `levelData.physics`. Antes esto se resolvía con
  // `typeof currentLevelIdx !== 'undefined' && currentLevelIdx === 4`,
  // pero currentLevelIdx es un `let` dentro de la IIFE del Engine: nunca
  // fue global, así que la condición era SIEMPRE falsa y el nivel
  // subacuático se jugaba con la física de tierra firme.
  const DEFAULT_PHYSICS = null;
  function _levelPhysics() {
    if (typeof Engine === 'undefined' || !Engine.getLevelData) return DEFAULT_PHYSICS;
    const data = Engine.getLevelData();
    return (data && data.physics) || DEFAULT_PHYSICS;
  }

  // ── Getters ──────────────────────────────────────────
  function getChar()       { return CHARACTERS[state.charId]; }
  function getState()      { return state; }
  function getCharacters() { return CHARACTERS; }
  function getFireballs()  { return state.fireballs;   }
  function getProjectiles(){ return state.projectiles; }
  function getBounds()     { return { x:state.x, y:state.y, w:state.w, h:state.h }; }

  // ── Init / Respawn ────────────────────────────────────
  function init(charId, spawnX, spawnY) {
    state.charId = charId || 'nuveciela';
    state.x = spawnX; state.y = spawnY;
    state.vx=0; state.vy=0;
    state.grounded=false; state.jumping=false;
    state.doubleJumped=false; state.canDoubleJump=true;
    state.sliding=false; state.slideTimer=0;
    state.floating=false; state.floatTimer=0; state.floatUsed=false;
    state.facing=1;
    state.lives=5; state.stars=0; state.maxLives=5;
    state.checkpointX=spawnX; state.checkpointY=spawnY;
    state.invincible=false; state.invTimer=0;
    state.groundPounding=false; state.wasGrounded=false;
    state.dead=false;
    state.flying=false; state.colorIdx=0;
    state.fireballs=[]; state.fireballCooldown=0;
    state.projectiles=[]; state.projectileCooldown=0;
    state.immuneTimer=0;
    state.onIce=false;
    state.superTimer=0; state.sizeMult=1;
    state.coyoteTimer=0; state.jumpBufferTimer=0;
  }

  function respawn() {
    state.x=state.checkpointX; state.y=state.checkpointY;
    state.vx=0; state.vy=0;
    state.grounded=false; state.jumping=false;
    state.doubleJumped=false; state.canDoubleJump=true;
    state.sliding=false; state.floating=false;
    state.invincible=true; state.invTimer=2.0;
    state.groundPounding=false; state.dead=false;
    state.flying=false; state.floatUsed=false;
    state.fireballs=[]; state.fireballCooldown=0;
    state.projectiles=[]; state.projectileCooldown=0;
    state.onIce=false;
    state.superTimer=0; state.sizeMult=1;
    state.coyoteTimer=0; state.jumpBufferTimer=0;
  }

  // ═══════════════════════════════════════════════════
  //  UPDATE PRINCIPAL
  // ═══════════════════════════════════════════════════
  function update(dt, input, map, onLand) {
    if (state.dead) return;
    const ch = getChar();
    state.wasGrounded = state.grounded;

    _updateTimers(dt);
    _updateMovement(dt, input, ch);
    _updateGravity(dt, input, ch);

    state.x += state.vx * dt;
    state.y += state.vy * dt;

    state.grounded = false;
    _resolveCollisions(map);
    _handleLanding(ch, onLand);

    // El salto se resuelve DESPUÉS de las colisiones: en ese punto ya sabemos
    // si el jugador está realmente en el suelo este frame.
    _updateJumpWindows(dt);
    _consumeJump(ch);

    _updateAbilities(dt, input, ch);
    _updateProjectiles(dt, map);

    if (state.x < 0) { state.x = 0; state.vx = 0; }
    if (map && state.y > map.length * TS + 100) takeDamage();
  }

  // ── Timers ───────────────────────────────────────────
  function _updateTimers(dt) {
    if (state.invTimer > 0) {
      state.invTimer -= dt;
      if (state.invTimer <= 0) { 
        state.invTimer=0; 
        if (!(state.immuneTimer > 0)) state.invincible=false; 
      }
    }
    if (state.slideTimer > 0) {
      state.slideTimer -= state.onIce ? dt * 0.6 : dt;
    } else {
      state.sliding = false;
    }

    if (state.fireballCooldown   > 0) state.fireballCooldown   -= dt;
    if (state.projectileCooldown > 0) state.projectileCooldown -= dt;
    if (state.immuneTimer > 0) {
      state.immuneTimer -= dt;
      if (state.immuneTimer <= 0) {
        state.immuneTimer=0;
        if (!(state.invTimer > 0)) state.invincible=false;
      }
    }

    // Súper Árbol Mágico — cuenta regresiva + tamaño (crece rápido, vuelve
    // suave). sizeMult es solo visual: no toca w/h ni el radio de colisión
    // de los disparos.
    if (state.superTimer > 0) state.superTimer = Math.max(0, state.superTimer - dt);
    const targetSize = state.superTimer > 0 ? 1.5 : 1;
    state.sizeMult += (targetSize - state.sizeMult) * Math.min(1, dt * 6);
  }

  // ── Movimiento horizontal ────────────────────────────
  function _updateMovement(dt, input, ch) {
    const phys    = _levelPhysics();
    const isWater = !!(phys && phys.swim);
    if (state.sliding) {
      state.vx = state.facing * (state.onIce ? ch.slideSpeed * 1.15 : ch.slideSpeed);
    } else {
      let targetVx = input.right ? ch.speed : input.left ? -ch.speed : 0;
      if (isWater) targetVx *= (phys.hDrag ?? 0.65); // Arrastre horizontal en agua

      let acc = state.grounded ? 18 : 10;
      if (isWater) {
        acc = phys.accel ?? 6.0; // Desaceleración/Aceleración por flotabilidad
      } else if (state.grounded && state.onIce) {
        // En hielo aceleramos y cambiamos de dirección más lento, y patinamos mucho más al frenar
        acc = targetVx === 0 ? 1.5 : 3.0;
      }
      state.vx += (targetVx - state.vx) * acc * dt;
      if (Math.abs(state.vx) < 1) state.vx = 0;
    }
    if (state.vx > 5)  state.facing =  1;
    if (state.vx < -5) state.facing = -1;
  }

  // ── Gravedad ─────────────────────────────────────────
  function _updateGravity(dt, input, ch) {
    let gravity = ch.gravity;

    // Niveles subacuáticos: gravedad reducida (declarada en levelData.physics)
    const phys    = _levelPhysics();
    const isWater = !!(phys && phys.swim);
    if (isWater) {
      gravity = phys.gravity ?? 320;
    }

    // Flotación (Lunaria y cualquier char con canFloat)
    if (!isWater && ch.canFloat && !state.grounded && input.jumpHeld
        && state.vy > 0 && !state.floatUsed) {
      state.floating   = true;
      state.floatTimer += dt;
      const maxFloat = ch.floatDuration || 1.5;
      if (state.floatTimer >= maxFloat) {
        state.floating  = false;
        state.floatUsed = true;
      } else {
        gravity = ch.floatGravity || 240;
      }
    } else {
      state.floating = false;
      if (!input.jumpHeld || state.grounded) state.floatTimer = 0;
    }

    // Caída rápida al soltar el salto
    if (!isWater && !input.jumpHeld && state.vy < 0) gravity *= 1.5;

    const maxFallSpeed = isWater ? (phys.maxFall ?? 250) : 900; // Caer más lento en agua
    state.vy = Math.min(state.vy + gravity * dt, maxFallSpeed);
  }

  // ── Habilidades por frame (vuelo, etc.) ──────────────
  function _updateAbilities(dt, input, ch) {
    // Vuelo (Nuve y cualquier char con canFly)
    if (ch.canFly && !state.grounded && input.jumpHeld) {
      const maxVyUp = ch.flyUnlimited ? -600 : -300;
      if (state.vy > maxVyUp) {
        state.flying = true;
        state.vy = Math.max(state.vy - 1200*dt, maxVyUp);
      }
    } else {
      state.flying = false;
    }
  }

  // ── Aterrizaje ───────────────────────────────────────
  function _handleLanding(ch, onLand) {
    if (!state.wasGrounded && state.grounded) {
      state.jumping=false; state.doubleJumped=false; state.canDoubleJump=true;
      state.floatTimer=0; state.floatUsed=false;

      if (ch.canGroundPound && state.groundPounding) {
        onLand && onLand('groundPound', state.x+state.w/2, state.y+state.h, ch.groundPoundRadius);
        Renderer.flash('rgba(249,200,70,.5)', 0.45);
        Renderer.spawnParticles(state.x+state.w/2, state.y+state.h, '#f97316', 22);
      }
      state.groundPounding = false;
    }
  }

  // ═══════════════════════════════════════════════════
  //  COLISIONES CON TILEMAP
  // ═══════════════════════════════════════════════════
  function _resolveCollisions(map) {
    if (!map) return;
    state.onIce = false; // Resetear al inicio del frame
    const rows=map.length, cols=map[0].length;
    const left=state.x, right=state.x+state.w;
    const top=state.y, bottom=state.y+state.h;

    const c0=Math.max(0,      Math.floor(left        / TS));
    const c1=Math.min(cols-1, Math.floor((right-1)   / TS));
    const r0=Math.max(0,      Math.floor(top          / TS));
    const r1=Math.min(rows-1, Math.floor((bottom-1)  / TS));

    // ── Vertical ────────────────────────────────────
    for (let r=r0; r<=r1; r++) {
      for (let c=c0; c<=c1; c++) {
        const tile = map[r][c];
        const isSolid    = tile===TILE.GROUND || tile===TILE.BLOCK || tile===TILE.ICE;
        const isPlatform = tile===TILE.PLATFORM;
        if (!isSolid && !isPlatform) continue;

        const tileTop=r*TS, tileBottom=tileTop+TS;
        const tileLeft=c*TS, tileRight=tileLeft+TS;

        // Desde arriba (aterrizaje)
        if (state.vy>=0 && bottom>tileTop && top<tileTop &&
            right>tileLeft+2 && left<tileRight-2) {
          if (isPlatform && bottom - state.vy*0.02 <= tileTop+12) {
            state.y=tileTop-state.h; state.vy=0; state.grounded=true;
            if (tile === TILE.ICE) state.onIce = true;
          } else if (isSolid) {
            state.y=tileTop-state.h; state.vy=0; state.grounded=true;
            if (tile === TILE.ICE) state.onIce = true;
          }
        }
        // Desde abajo (techo) — solo sólidos
        if (isSolid && state.vy<0 && top<tileBottom && bottom>tileBottom &&
            right>tileLeft+2 && left<tileRight-2) {
          state.y=tileBottom; state.vy=0;
        }
      }
    }

    // ── Horizontal ──────────────────────────────────
    const r0h=Math.max(0,      Math.floor((state.y+2)        / TS));
    const r1h=Math.min(rows-1, Math.floor((state.y+state.h-2)/ TS));
    const c0h=Math.max(0,      Math.floor(state.x             / TS));
    const c1h=Math.min(cols-1, Math.floor((state.x+state.w-1) / TS));

    for (let r=r0h; r<=r1h; r++) {
      for (let c=c0h; c<=c1h; c++) {
        const tile=map[r][c];
        if (tile!==TILE.GROUND && tile!==TILE.BLOCK) continue;
        const tileLeft=c*TS, tileRight=tileLeft+TS;
        if (state.vx>0 && (state.x+state.w)>tileLeft && state.x<tileLeft) {
          state.x=tileLeft-state.w; state.vx=0;
          if (state.sliding) { state.sliding=false; state.slideTimer=0; }
        }
        if (state.vx<0 && state.x<tileRight && (state.x+state.w)>tileRight) {
          state.x=tileRight; state.vx=0;
          if (state.sliding) { state.sliding=false; state.slideTimer=0; }
        }
      }
    }

    // ── Pinchos ─────────────────────────────────────
    const rs0=Math.max(0,      Math.floor(state.y        / TS));
    const rs1=Math.min(rows-1, Math.floor((state.y+state.h-1) / TS));
    const cs0=Math.max(0,      Math.floor(state.x        / TS));
    const cs1=Math.min(cols-1, Math.floor((state.x+state.w-1) / TS));
    for (let r=rs0; r<=rs1; r++) {
      for (let c=cs0; c<=cs1; c++) {
        if (map[r][c]===TILE.SPIKES || map[r][c]===TILE.ICE_SPIKES) { takeDamage(); return; }
      }
    }
  }

  // ═══════════════════════════════════════════════════
  //  ACCIONES
  // ═══════════════════════════════════════════════════
  // tryJump() ya no salta: registra la INTENCIÓN de saltar.
  // El salto real lo resuelve _consumeJump() después de las colisiones.
  function tryJump() {
    if (state.dead || state.sliding) return;

    // Niveles subacuáticos: brazada infinita, sin ventanas de gracia
    const phys = _levelPhysics();
    if (phys && phys.swim) {
      state.vy = phys.strokeVy ?? -300;
      state.grounded = false;
      state.jumping = true;
      if (typeof Renderer !== 'undefined') {
        Renderer.spawnParticles(state.x + state.w/2, state.y + state.h, '#7dd3fc', 5);
      }
      return;
    }

    state.jumpBufferTimer = JUMP_BUFFER;
  }

  function _updateJumpWindows(dt) {
    // Coyote: se recarga mientras estés en el suelo y se consume al caer
    if (state.grounded) state.coyoteTimer = COYOTE_TIME;
    else                state.coyoteTimer = Math.max(0, state.coyoteTimer - dt);
    state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);
  }

  function _consumeJump(ch) {
    if (state.jumpBufferTimer <= 0 || state.dead || state.sliding) return;

    if (state.grounded || state.coyoteTimer > 0) {
      state.vy = ch.jumpForce;
      state.grounded = false; state.jumping = true;
      state.canDoubleJump = true; state.floatTimer = 0;
      state.coyoteTimer = 0;
      state.jumpBufferTimer = 0;
    } else if (state.canDoubleJump && !state.doubleJumped) {
      state.vy = ch.dblJumpForce;
      state.doubleJumped = true; state.canDoubleJump = false;
      state.floating = false; state.floatTimer = 0;
      state.jumpBufferTimer = 0;
      Renderer.spawnParticles(state.x+state.w/2, state.y+state.h, ch.color, 12);
    }
  }

  function trySlide() {
    if (state.dead || !state.grounded || state.sliding) return;
    state.sliding=true; state.slideTimer=0.55;
    Renderer.spawnParticles(state.x+state.w/2, state.y+state.h, '#fff', 8);
  }

  function tryGroundPound() {
    const ch = getChar();
    if (!ch.canGroundPound || state.grounded || state.groundPounding) return;
    state.groundPounding=true; state.vy=900; state.floating=false;
  }

  function takeDamage(sourceX = null) {
    if (state.invincible || state.dead) return;
    state.lives -= 1;
    Renderer.flash('#ef4444', 0.6);
    Renderer.spawnParticles(state.x+state.w/2, state.y+state.h/2, '#ef4444', 18);
    if (state.lives <= 0) {
      state.dead = true;
    } else {
      const kbDir = sourceX !== null
        ? (state.x+state.w/2 > sourceX ? 1 : -1)
        : state.facing * -1;
      state.vx=kbDir*320; state.vy=-280; state.grounded=false;
      respawn();
    }
  }

  function collectStar() {
    state.stars += 1;
    if (typeof AudioManager !== 'undefined') AudioManager.sfx('grab_star');
    Renderer.spawnParticles(state.x+state.w/2, state.y, '#f9c846', 16);
    Renderer.spawnText(state.x+state.w/2, state.y-10, '+⭐', '#f9c846');
  }

  function activateCheckpoint(x, y) {
    state.checkpointX=x; state.checkpointY=y;
    Renderer.flash('rgba(74,222,128,.4)', 0.5);
    Renderer.spawnText(x, y-20, '✅ Checkpoint', '#4ade80');
  }

  function activateImmunity(duration = 5.0) {
    state.immuneTimer=duration; state.invincible=true;
    if (typeof AudioManager !== 'undefined') AudioManager.sfx('get_tree');
    Renderer.flash('rgba(74,222,128,.5)', 0.6);
    Renderer.spawnParticles(state.x+state.w/2, state.y, '#4ade80', 24);
    Renderer.spawnText(state.x+state.w/2, state.y-20, '🌳 ¡Inmune 5s!', '#4ade80');
  }

  // Súper Árbol Mágico — secreto raro y poderoso (ajuste de balance).
  function activateSuperMode(duration = 25.0) {
    state.superTimer = duration;
    // Mismo efecto que el árbol normal: inmune + daña enemigos al tocarlos.
    state.immuneTimer = duration; state.invincible = true;
    if (typeof AudioManager !== 'undefined') AudioManager.sfx('get_tree');
    Renderer.flash('rgba(196,132,252,.55)', 0.8);
    const rainbow = ['#f97316','#f9c846','#4ade80','#38bdf8','#a78bfa','#f472b6'];
    for (const c of rainbow) Renderer.spawnParticles(state.x+state.w/2, state.y, c, 8);
    Renderer.spawnText(state.x+state.w/2, state.y-24, '🌈 ¡SÚPER MODO!', '#f9c846');
  }

  // ═══════════════════════════════════════════════════
  //  PROYECTILES — sistema genérico
  //
  //  tryFireball()   → solo Nuveciela (sistema legacy, física especial)
  //  tryProjectile() → lee projectileDef del personaje activo.
  //                    Sin if/else por personaje.
  //                    Para agregar un char nuevo: solo definir
  //                    su projectileDef en player_characters.js.
  // ═══════════════════════════════════════════════════

  // Bolas de fuego de Nuveciela — sistema propio (rebotan diferente)
  function tryFireball() {
    const ch = getChar();
    if (!ch.usesFireball) return;
    if (state.fireballCooldown > 0) return;
    const dir = state.facing;
    state.fireballs.push({
      x:  state.x+(dir>0?state.w:0),
      y:  state.y+state.h*0.35,
      vx: dir*480, vy:0,
      r:10, life:2.2, active:true,
    });
    state.fireballCooldown = ch.fireballCooldown || 0.55;
    Renderer.spawnParticles(state.x+state.w/2, state.y+state.h*0.35, '#f97316', 8);
  }

  // Proyectil genérico — lee projectileDef del personaje
  function tryProjectile() {
    const ch = getChar();

    // Si el personaje usa fireballs, redirigir
    if (ch.usesFireball) { tryFireball(); return; }

    const def = ch.projectileDef;
    if (!def || state.projectileCooldown > 0) return;

    const dir = state.facing;
    const cx  = state.x + (dir>0 ? state.w : 0);
    const cy  = state.y + state.h*0.35;

    // Color: fijo o dinámico (bolas de Nuve)
    let color = def.color;
    let vyFinal = def.vy;
    if (def.vyRandom) vyFinal = (Math.random()-0.5) * def.vyRandom;
    if (!color && ch.colorPalette) {
      color = ch.colorPalette[state.colorIdx % ch.colorPalette.length];
      state.colorIdx++;
    }

    state.projectiles.push({
      kind:   def.kind,
      x:cx, y:cy,
      vx: dir * def.vxMult,
      vy: vyFinal,
      r:  def.r,
      life: def.life,
      active: true,
      color,
    });

    state.projectileCooldown = def.cooldown;
    if (typeof AudioManager !== 'undefined' && def.kind === 'ray')
      AudioManager.sfx('lunaria_shoot');
    Renderer.spawnParticles(cx, cy, def.particleColor || color, def.particleCount || 8);
  }

  // ── Update proyectiles ────────────────────────────────
  function _updateProjectiles(dt, map) {
    _updateFireballs(dt, map);
    _updateGenericProjectiles(dt, map);
  }

  function _updateFireballs(dt, map) {
    if (!map) return;
    const rows=map.length, cols=map[0].length;
    for (let i=state.fireballs.length-1; i>=0; i--) {
      const fb=state.fireballs[i];
      if (!fb.active) { state.fireballs.splice(i,1); continue; }
      fb.life -= dt;
      if (fb.life<=0) { fb.active=false; continue; }
      fb.vy += 280*dt;
      fb.x  += fb.vx*dt; fb.y += fb.vy*dt;
      const c=Math.floor(fb.x/TS), r=Math.floor(fb.y/TS);
      if (r>=0&&r<rows&&c>=0&&c<cols) {
        const t=map[r][c];
        if (t===TILE.GROUND||t===TILE.BLOCK||t===TILE.PLATFORM) {
          if (!fb.bounced) {
            fb.bounced=true; fb.vx=-fb.vx*0.55;
            fb.vy=-Math.abs(fb.vy)*0.5-50;
            fb.life=Math.min(fb.life,0.55);
            Renderer.spawnParticles(fb.x,fb.y,'#f97316',4);
          } else {
            Renderer.spawnParticles(fb.x,fb.y,'#f97316',6);
            fb.active=false; continue;
          }
        }
      }
      if (fb.x<0||fb.x>cols*TS||fb.y>rows*TS) fb.active=false;
    }
  }

  function _updateGenericProjectiles(dt, map) {
    if (!map) return;
    const rows=map.length, cols=map[0].length;
    for (let i=state.projectiles.length-1; i>=0; i--) {
      const p=state.projectiles[i];
      if (!p.active) { state.projectiles.splice(i,1); continue; }
      p.life -= dt;
      if (p.life<=0) { p.active=false; continue; }
      // Gravedad según tipo
      if      (p.kind==='ice')  p.vy += 120*dt;
      else if (p.kind==='ray')  p.vy  = 0;
      else                      p.vy += 200*dt;
      p.x+=p.vx*dt; p.y+=p.vy*dt;
      const c=Math.floor(p.x/TS), r=Math.floor(p.y/TS);
      if (r>=0&&r<rows&&c>=0&&c<cols) {
        const t=map[r][c];
        if (t===TILE.GROUND||t===TILE.BLOCK||t===TILE.PLATFORM) {
          if (!p.bounced) {
            p.bounced=true; p.vx=-p.vx*0.6;
            p.vy=-Math.abs(p.vy)*0.55-60;
            p.life=Math.min(p.life,0.6);
            Renderer.spawnParticles(p.x,p.y,p.color,4);
          } else {
            Renderer.spawnParticles(p.x,p.y,p.color,5);
            p.active=false; continue;
          }
        }
      }
      if (p.x<0||p.x>cols*TS||p.y>rows*TS) p.active=false;
    }
  }

  return {
    CHARACTERS,
    init, update, respawn,
    tryJump, trySlide, tryGroundPound, tryFireball, tryProjectile,
    takeDamage, collectStar, activateCheckpoint, activateImmunity, activateSuperMode,
    getState, getChar, getCharacters, getBounds, getFireballs, getProjectiles,
  };

})();