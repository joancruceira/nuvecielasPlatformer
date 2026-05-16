// ═══════════════════════════════════════════════════════
//  RENDERER_FX.JS — Efectos visuales
//  Depende de: renderer_core.js
//
//  Responsabilidades:
//  - Partículas (spawn + update + draw)
//  - Screen flash
//  - Texto flotante
// ═══════════════════════════════════════════════════════

const RendererFx = (() => {

  // ── Partículas ────────────────────────────────────────
  const _particles = [];

  function spawnParticles(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const ang  = Math.random() * Math.PI * 2;
      const spd  = 60 + Math.random() * 200;
      const life = 0.5 + Math.random() * 0.5;
      _particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 60,
        r:  3 + Math.random() * 5,
        color, life, maxLife: life,
      });
    }
  }

  function updateAndDrawParticles(dt) {
    const { ctx } = R;
    for (let i = _particles.length-1; i >= 0; i--) {
      const p = _particles[i];
      p.life -= dt;
      if (p.life <= 0) { _particles.splice(i, 1); continue; }
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 320 * dt;
      p.vx *= 1 - dt * 3;
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0, p.r * alpha), 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Screen flash ──────────────────────────────────────
  let _flashAlpha = 0;
  let _flashColor = '#fff';

  function flash(color = '#fff', strength = 0.7) {
    _flashAlpha = strength;
    _flashColor = color;
  }

  function drawFlash() {
    if (_flashAlpha <= 0) return;
    const { ctx, W, H } = R;
    ctx.save();
    ctx.globalAlpha = _flashAlpha;
    ctx.fillStyle   = _flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    _flashAlpha = Math.max(0, _flashAlpha - 0.05);
  }

  // ── Texto flotante ────────────────────────────────────
  const _floatingTexts = [];

  function spawnText(x, y, text, color = '#f9c846') {
    _floatingTexts.push({ x, y, text, color, life: 1.0, vy: -60 });
  }

  function drawFloatingTexts(dt) {
    const { ctx } = R;
    for (let i = _floatingTexts.length-1; i >= 0; i--) {
      const t = _floatingTexts[i];
      t.life -= dt * 1.8;
      if (t.life <= 0) { _floatingTexts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      ctx.save();
      ctx.globalAlpha   = Math.max(0, t.life);
      ctx.font          = '900 16px Fredoka, system-ui';
      ctx.textAlign     = 'center';
      ctx.textBaseline  = 'bottom';
      ctx.fillStyle     = '#000';
      ctx.fillText(t.text, t.x+1, t.y+1);
      ctx.fillStyle     = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  return { spawnParticles, updateAndDrawParticles, flash, drawFlash, spawnText, drawFloatingTexts };

})();