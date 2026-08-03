// ═══════════════════════════════════════════════════════
//  CUEVA.JS — Cueva sellada del Sendero Nocturno
//
//  Se coloca en el mapa con TILE.MAGIC_DOOR.
//  Con 5 disparos se abre (puerta0→puerta1 + portal).
//  El jugador entra con ↓ → lanza SubMisionNatan.
//
//  Sprites: img/level3/subnivel/puerta0.png (sellada)
//            img/level3/subnivel/puerta1.png (abierta con portal)
// ═══════════════════════════════════════════════════════

const Cueva = (() => {

  const W_DOOR = 96, H_DOOR = 128;
  const SHOTS_NEEDED = 5;

  const imgs = {};
  function _img(k) { const i=imgs[k]; return(i&&i.complete&&i.naturalWidth>0)?i:null; }

  function preload() {
    ['puerta0','puerta1'].forEach(n => {
      const m = new Image();
      m.src = `img/level3/subnivel/${n}.png`;
      imgs[n] = m;
    });
  }

  // ── Estado ────────────────────────────────────────────
  let _doors = [];   // { x, y, hits, opened, glowPhase }

  function init()  { _doors = []; }

  function spawnFromMap(map, TS) {
    const rows=map.length, cols=map[0].length;

    // Busca la primera fila sólida desde startRow hacia abajo
    function findGround(c, startRow) {
      for(let r = startRow; r < rows; r++) {
        const t = map[r]?.[c];
        if(t === TILE.GROUND || t === TILE.BLOCK) return r;
      }
      return rows - 2;
    }

    for(let r=0;r<rows;r++) {
      for(let c=0;c<cols;c++) {
        if(map[r][c] === TILE.MAGIC_DOOR) {
          const groundRow = findGround(c, r);
          const y = groundRow * TS - H_DOOR;  // base de la puerta al ras del suelo
          _doors.push({
            x: c*TS, y,
            hits: 0, opened: false, glowPhase: 0,
          });
          map[r][c] = TILE.AIR;
        }
      }
    }
  }

  // ── Update ────────────────────────────────────────────
  function update(dt) {
    for(const d of _doors) d.glowPhase += dt * 2.5;
  }

  // Recibe un proyectil o fireball y chequea colisión
  function checkProjectileHits(projectiles, fireballs) {
    for(const d of _doors) {
      if(d.opened) continue;

      const allProj = [...(projectiles||[]), ...(fireballs||[])];
      for(const p of allProj) {
        if(!p.active) continue;
        if(p.x > d.x && p.x < d.x+W_DOOR && p.y > d.y && p.y < d.y+H_DOOR) {
          p.active = false;
          d.hits++;
          Renderer.spawnParticles(p.x, p.y, '#a78bfa', 10);
          Renderer.spawnText(d.x+W_DOOR/2, d.y-10, `${d.hits}/${SHOTS_NEEDED} 💥`, '#a78bfa');
          if(d.hits >= SHOTS_NEEDED) {
            d.opened = true;
            Renderer.flash('#a78bfa', 0.6);
            Renderer.spawnText(d.x+W_DOOR/2, d.y-30, '¡Portal abierto!', '#38bdf8');
          }
          break;
        }
      }
    }
  }

  // ── Draw ──────────────────────────────────────────────
  function draw(ctx, camX, camY, ts) {
    for(const d of _doors) {
      const sx = d.x - camX, sy = d.y - camY;
      const canvasW = ctx.canvas ? ctx.canvas.width : 1920;
      if(sx < -W_DOOR-20 || sx > canvasW+20) continue;

      if(d.opened) {
        // Portal abierto con glow pulsante
        const pulse = 0.85 + Math.sin(d.glowPhase)*0.15;
        ctx.save();
        ctx.globalAlpha = pulse;
        const im = _img('puerta1');
        if(im) ctx.drawImage(im, sx, sy, W_DOOR, H_DOOR);
        else {
          // Fallback portal canvas
          const g = ctx.createRadialGradient(sx+W_DOOR/2,sy+H_DOOR/2,10,sx+W_DOOR/2,sy+H_DOOR/2,W_DOOR/2);
          g.addColorStop(0,'rgba(56,189,248,0.9)'); g.addColorStop(1,'rgba(99,102,241,0)');
          ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(sx+W_DOOR/2,sy+H_DOOR/2,W_DOOR/2,H_DOOR/2,0,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
        // Texto de instrucción
        ctx.save();
        ctx.textAlign='center'; ctx.font='bold 13px Fredoka,system-ui';
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillText('↓ Entrar',sx+W_DOOR/2+1,sy-5);
        ctx.fillStyle='#fff'; ctx.fillText('↓ Entrar',sx+W_DOOR/2,sy-6);
        ctx.restore();
      } else {
        // Puerta sellada
        const im = _img('puerta0');
        ctx.save();
        if(im) {
          ctx.drawImage(im, sx, sy, W_DOOR, H_DOOR);
        } else {
          ctx.fillStyle='#312e81'; ctx.fillRect(sx,sy,W_DOOR,H_DOOR);
          ctx.strokeStyle='#818cf8'; ctx.lineWidth=3; ctx.strokeRect(sx+3,sy+3,W_DOOR-6,H_DOOR-6);
        }
        // Contador de disparos si tiene alguno
        if(d.hits > 0) {
          ctx.textAlign='center'; ctx.font='bold 14px Fredoka,system-ui';
          ctx.fillStyle='#fbbf24';
          ctx.fillText(`${d.hits}/${SHOTS_NEEDED}`, sx+W_DOOR/2, sy+H_DOOR+18);
        }
        ctx.restore();
      }
    }
  }

  function getDoors() { return _doors; }

  return { preload, init, spawnFromMap, update, checkProjectileHits, draw, getDoors };

})();