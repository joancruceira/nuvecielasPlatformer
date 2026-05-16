// ═══════════════════════════════════════════════════════
//  RENDERER_TILES.JS — Tilemap y tiles individuales
//  Depende de: renderer_core.js
// ═══════════════════════════════════════════════════════

const RendererTiles = (() => {

  function getTilePalette(level) {
    return {
      groundTop:  level.groundCol,
      groundFill: level.blockCol,
      platform:   level.dark ? '#7a5fb0' : '#c8a04a',
      spikes:     '#e84a5a',
      star:       '#f9c846',
      checkpoint: '#4ade80',
      portal:     '#a78bfa',
    };
  }

  function drawTilemap(map, level, camX, camY) {
    if (!map || !level) return;
    const { ctx, W, H } = R;
    const pal      = getTilePalette(level);
    const rows     = map.length;
    const cols     = map[0].length;
    const startCol = Math.max(0,      Math.floor(camX / TILE_SIZE) - 1);
    const endCol   = Math.min(cols-1, Math.ceil((camX + W) / TILE_SIZE) + 1);
    const startRow = Math.max(0,      Math.floor(camY / TILE_SIZE) - 1);
    const endRow   = Math.min(rows-1, Math.ceil((camY + H) / TILE_SIZE) + 1);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tile = map[r][c];
        if (tile === TILE.AIR) continue;
        const x = Math.floor(c * TILE_SIZE - camX);
        const y = Math.floor(r * TILE_SIZE - camY);
        _drawTile(tile, x, y, TILE_SIZE, pal, level);
      }
    }
  }

  function _drawTile(tile, x, y, T, pal, level) {
    const { ctx } = R;
    ctx.save();
    switch (tile) {

      case TILE.GROUND: {
        ctx.fillStyle = pal.groundTop;  ctx.fillRect(x, y, T, T * 0.3);
        ctx.fillStyle = pal.groundFill; ctx.fillRect(x, y + T*0.3, T, T*0.7);
        if (!level.dark) {
          ctx.fillStyle = 'rgba(255,255,255,.15)';
          ctx.fillRect(x+2, y+2, T-4, 4);
        }
        break;
      }

      case TILE.BLOCK: {
        ctx.fillStyle = pal.groundFill; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = 'rgba(0,0,0,.12)';
        ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y, 2, T);
        break;
      }

      case TILE.PLATFORM: {
        const grad = ctx.createLinearGradient(x, y, x, y+14);
        grad.addColorStop(0, pal.platform); grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(x+2, y, T-4, 14, 5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.30)';
        ctx.fillRect(x+4, y+2, T-8, 3);
        break;
      }

      case TILE.SPIKES: {
        ctx.fillStyle = pal.spikes;
        const n=3, sw=T/n;
        for (let i=0; i<n; i++) {
          ctx.beginPath();
          ctx.moveTo(x+i*sw, y+T);
          ctx.lineTo(x+i*sw+sw/2, y+T*0.25);
          ctx.lineTo(x+i*sw+sw, y+T);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(200,30,40,.4)';
        ctx.fillRect(x, y+T*0.82, T, T*0.18);
        break;
      }

      case TILE.STAR: {
        _drawStarTile(x+T/2, y+T/2, T*0.38, pal.star);
        break;
      }

      case TILE.CHECKPOINT: {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(x+T/2-2, y+4, 4, T-8);
        ctx.beginPath();
        ctx.moveTo(x+T/2+2, y+6);
        ctx.lineTo(x+T/2+20, y+14);
        ctx.lineTo(x+T/2+2, y+22);
        ctx.closePath(); ctx.fill();
        break;
      }

      case TILE.PORTAL: {
        _drawPortal(x+T/2, y+T/2, T*0.44);
        break;
      }
    }
    ctx.restore();
  }

  function _drawStarTile(cx, cy, r, col) {
    const { ctx } = R;
    ctx.save();
    ctx.fillStyle = col + '80';
    ctx.beginPath(); ctx.arc(cx, cy, r*2.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = col;
    _drawStarShape(cx, cy, r);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath(); ctx.arc(cx-r*0.2, cy-r*0.25, r*0.32, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function _drawStarShape(cx, cy, r) {
    const { ctx } = R;
    ctx.beginPath();
    const spikes=5, inner=r*0.45;
    let rot = -Math.PI/2;
    for (let i=0; i<spikes*2; i++) {
      const radius = i%2===0 ? r : inner;
      ctx.lineTo(cx+Math.cos(rot)*radius, cy+Math.sin(rot)*radius);
      rot += Math.PI/spikes;
    }
    ctx.closePath(); ctx.fill();
  }

  function _drawPortal(cx, cy, r) {
    const { ctx } = R;
    ctx.save();
    const g = ctx.createRadialGradient(cx,cy,r*0.3,cx,cy,r*1.4);
    g.addColorStop(0,   'rgba(255,255,255,.90)');
    g.addColorStop(0.4, 'rgba(167,139,250,.80)');
    g.addColorStop(0.8, 'rgba(99,102,241,.55)');
    g.addColorStop(1,   'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx,cy,r*1.4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(cx,cy,r*0.45,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // Estrella animada coleccionable (fuera del tilemap)
  function drawStarAnimated(x, y, ts, collected) {
    if (collected) return;
    const bounce = Math.sin(ts / 500) * 3;
    _drawStarTile(x, y + bounce, TILE_SIZE * 0.38, '#f9c846');
  }

  return { getTilePalette, drawTilemap, drawStarAnimated };

})();