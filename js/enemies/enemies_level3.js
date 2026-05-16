// ═══════════════════════════════════════════════════════
//  ENEMIES_LEVEL3.JS — Coordinador de enemigos nivel 3
// ═══════════════════════════════════════════════════════

const EnemiesLevel3 = (() => {

  let _enemies = [];
  let _ts      = 0;

  function preload() {
    Oruga.preload(); Arbusto.preload();
    Murcielago.preload(); Cienpies.preload();
  }

  // ── Spawn ─────────────────────────────────────────────
  // FIX 1: _enemies = [] siempre → no quedan cadáveres entre niveles
  // FIX 4: y = r*TS - e.H → spawn encima del tile, no incrustado
  function spawnFromMap(map, TS) {
    _enemies = [];
    const rows = map.length, cols = map[0].length;

    for(let r=0; r<rows; r++) {
      for(let c=0; c<cols; c++) {
        const tile = map[r][c];
        const x = c * TS;
        const pL = Math.max(0, (c-6)*TS);
        const pR = Math.min((cols-1)*TS, (c+6)*TS);

        if(tile === TILE.ORUGA) {
          // Tile en fila 13 → y = 13*48 - 48 = 576 = exactamente encima del suelo
          _enemies.push(Oruga.spawn(x, r*TS - (Oruga.H||48), pL, pR));
          map[r][c] = TILE.AIR;
        }
        else if(tile === TILE.ARBUSTO) {
          _enemies.push(Arbusto.spawn(x, r*TS - (Arbusto.H||56)));
          map[r][c] = TILE.AIR;
        }
        else if(tile === TILE.MURCIELAGO) {
          // Murciélago: y es la altura de vuelo (fila 7 → y = 336px)
          _enemies.push(Murcielago.spawn(x, r*TS, pL, pR));
          map[r][c] = TILE.AIR;
        }
        else if(tile === TILE.CIENPIES) {
          const arenaL = Math.max(0, (c-20)*TS);
          const arenaR = Math.min((cols-1)*TS, (c+20)*TS);
          _enemies.push(Cienpies.spawn(x, r*TS - (Cienpies.H||128), arenaL, arenaR));
          map[r][c] = TILE.AIR;
        }
      }
    }
  }

  // ── Update ────────────────────────────────────────────
  // FIX 2: gravedad aplica también durante 'death'
  // FIX 3: limpiar del array cuando termina animación de muerte
  function update(dt, map, ps, onEnemyCollision) {
    _ts += dt;

    for(let i = _enemies.length-1; i >= 0; i--) {
      const e = _enemies[i];

      // Eliminar del array cuando murió Y terminó la animación
      if(!e.alive && e.state !== 'death') {
        _enemies.splice(i, 1);
        continue;
      }

      const handler = _getHandler(e);
      if(handler) handler.update(e, dt, ps);

      // Si el handler marcó alive=false (fin de animación death), marcar 'gone'
      if(!e.alive && e.state === 'death') e.state = 'gone';

      // Gravedad para terrestres — también aplica durante death
      if(e.type !== 'murcielago') {
        _applyGravity(e, dt, map);
      }

      // Colisión con jugador — detecta stomp (pisar) vs daño
      if(!e.alive || ps.invincible || e.state === 'death') continue;
      if(_collidesWithPlayer(e, ps)) {
        const isBoss     = e.type === 'cienpies';
        const stompThresh = isBoss ? 60 : 30;
        const stomping   = ps.vy >= 0
          && (ps.y + ps.h) < (e.y + stompThresh)
          && !ps.wasGrounded;

        if(stomping) {
          // Pisar al enemigo — lo golpea y hace rebotar al jugador
          const handler = _getHandler(e);
          if(handler) handler.hit(e);
          onEnemyCollision && onEnemyCollision('stomp', e);
        } else {
          onEnemyCollision && onEnemyCollision('damage', e);
        }
      }

      // Chispas del arbusto
      if(e.type === 'arbusto') {
        const sparks = Arbusto.getSparks(e);
        for(const s of sparks) {
          if(s.hitPlayer) onEnemyCollision && onEnemyCollision('damage', e);
        }
      }
    }
  }

  function _applyGravity(e, dt, map) {
    if(!map) return;
    const TS   = 48;
    const rows = map.length, cols = map[0].length;

    // Acumular gravedad y mover
    if(!e.onGround) {
      e.vy = Math.min((e.vy||0) + 900*dt, 900);
      e.y += e.vy * dt;
    }
    e.onGround = false;

    const c0 = Math.max(0,      Math.floor((e.x + 4)      / TS));
    const c1 = Math.min(cols-1, Math.floor((e.x + e.w - 4) / TS));

    // Revisar las dos filas que pueden tener suelo (la del pie y la siguiente)
    // Esto evita que el enemigo "caiga a través" cuando vy es grande
    for(let rCheck = Math.floor((e.y + e.h - 1) / TS);
            rCheck <= Math.floor((e.y + e.h + e.vy * dt + 4) / TS) && rCheck < rows;
            rCheck++) {
      if(rCheck < 0) continue;
      for(let c = c0; c <= c1; c++) {
        const t = map[rCheck]?.[c];
        if(t === TILE.GROUND || t === TILE.BLOCK) {
          // Snapear encima del tile solo si estamos cayendo
          if(e.vy >= 0) {
            e.y = rCheck * TS - e.h;
            e.vy = 0;
            e.onGround = true;
          }
          break;
        }
      }
      if(e.onGround) break;
    }

    // Caída al vacío → eliminar
    if(e.y > rows * TS + 100) {
      e.alive = false; e.state = 'gone';
    }
  }

  function _collidesWithPlayer(e, ps) {
    return (ps.x+ps.w) > e.x && ps.x < (e.x+e.w) &&
           (ps.y+ps.h) > e.y && ps.y < (e.y+e.h);
  }

  function hitEnemy(e) {
    const handler = _getHandler(e);
    if(handler) handler.hit(e);
  }

  function drawAll(ctx, camX, camY, ts) {
    for(const e of _enemies) {
      // Solo dibujar vivos o en animación de death activa
      if(!e.alive && e.state !== 'death') continue;
      if(e.state === 'gone') continue;
      const handler = _getHandler(e);
      if(handler) handler.draw(ctx, e, camX, camY);
    }
  }

  function getEnemies()  { return _enemies; }
  function getBoss()     { return _enemies.find(e => e.type==='cienpies'); }
  function allDefeated() { return _enemies.every(e => !e.alive); }

  function stunNearby(cx, cy, radius) {
    for(const e of _enemies) {
      if(!e.alive) continue;
      if(Math.hypot(e.x+e.w/2-cx, e.y+e.h/2-cy) < radius) {
        e.state='damage'; e.stateTimer=0; e.frameIdx=0; e.frameTick=0;
      }
    }
  }

  function _getHandler(e) {
    switch(e.type) {
      case 'oruga':      return Oruga;
      case 'arbusto':    return Arbusto;
      case 'murcielago': return Murcielago;
      case 'cienpies':   return Cienpies;
      default:           return null;
    }
  }

  return { preload, spawnFromMap, update, drawAll, hitEnemy,
           getEnemies, getBoss, allDefeated, stunNearby };

})();