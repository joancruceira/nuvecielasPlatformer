// ═══════════════════════════════════════════════════════
//  RENDERER_FX.JS — Efectos visuales
//  Depende de: renderer_core.js
//
//  Responsabilidades:
//  - Partículas (spawn + update + draw)
//  - Screen flash
//  - Texto flotante
//
//  ── CONVENCIÓN DE COORDENADAS ──────────────────────────
//  spawnParticles() y spawnText() reciben SIEMPRE coordenadas
//  de MUNDO. El módulo resta la cámara al dibujar.
//  El engine llama setCamera(camX, camY) una vez por frame,
//  antes de updateAndDrawParticles/drawFloatingTexts.
//
//  Antes esto no existía: el 96% de los call sites pasaba
//  coordenadas de mundo pero el draw las trataba como
//  coordenadas de pantalla, así que todas las partículas y
//  todos los textos flotantes se dibujaban fuera del canvas.
//
//  Partículas y textos usan POOLS de tamaño fijo (ring buffer):
//  cero allocations y cero splice() dentro del game loop.
// ═══════════════════════════════════════════════════════

const RendererFx = (() => {

  // ── Cámara del frame ──────────────────────────────────
  let _camX = 0, _camY = 0;
  function setCamera(x, y) { _camX = x || 0; _camY = y || 0; }

  // ── Partículas (pool) ─────────────────────────────────
  const MAX_PARTICLES = 300;
  const _particles = new Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    _particles[i] = { x:0, y:0, vx:0, vy:0, r:0, color:'#fff',
                      life:0, maxLife:1, active:false };
  }
  let _pCursor = 0;   // ring buffer: al llenarse pisa la más vieja

  function spawnParticles(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const p = _particles[_pCursor];
      _pCursor = (_pCursor + 1) % MAX_PARTICLES;
      const ang  = Math.random() * Math.PI * 2;
      const spd  = 60 + Math.random() * 200;
      p.x = x; p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 60;
      p.r  = 3 + Math.random() * 5;
      p.color   = color;
      p.maxLife = p.life = 0.5 + Math.random() * 0.5;
      p.active  = true;
    }
  }

  function updateAndDrawParticles(dt) {
    const { ctx, W, H } = R;
    ctx.save();
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = _particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 320 * dt;
      p.vx *= 1 - dt * 3;

      const sx = p.x - _camX, sy = p.y - _camY;
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;

      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0, p.r * alpha), 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Screen flash ──────────────────────────────────────
  let _flashAlpha = 0;
  let _flashColor = '#fff';

  function flash(color = '#fff', strength = 0.7) {
    _flashAlpha = strength;
    _flashColor = color;
  }

  // dt real → el flash dura lo mismo a 30, 60 o 144 Hz.
  // Antes era `-= 0.05` por frame (2.4x más rápido a 144 Hz).
  const FLASH_DECAY_PER_SEC = 3.0;
  function drawFlash(dt = 1/60) {
    if (_flashAlpha <= 0) return;
    const { ctx, W, H } = R;
    ctx.save();
    ctx.globalAlpha = _flashAlpha;
    ctx.fillStyle   = _flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    _flashAlpha = Math.max(0, _flashAlpha - FLASH_DECAY_PER_SEC * dt);
  }

  // ── Texto flotante (pool) ─────────────────────────────
  const MAX_TEXTS = 48;
  const _texts = new Array(MAX_TEXTS);
  for (let i = 0; i < MAX_TEXTS; i++) {
    _texts[i] = { x:0, y:0, text:'', color:'#f9c846', life:0, vy:-60, active:false };
  }
  let _tCursor = 0;

  function spawnText(x, y, text, color = '#f9c846') {
    const t = _texts[_tCursor];
    _tCursor = (_tCursor + 1) % MAX_TEXTS;
    t.x = x; t.y = y; t.text = text; t.color = color;
    t.life = 1.0; t.vy = -60; t.active = true;
  }

  function drawFloatingTexts(dt) {
    const { ctx, W, H } = R;
    ctx.save();
    ctx.font         = '900 16px Fredoka, system-ui';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    for (let i = 0; i < MAX_TEXTS; i++) {
      const t = _texts[i];
      if (!t.active) continue;
      t.life -= dt * 1.8;
      if (t.life <= 0) { t.active = false; continue; }
      t.y += t.vy * dt;

      const sx = t.x - _camX, sy = t.y - _camY;
      if (sx < -120 || sx > W + 120 || sy < -60 || sy > H + 60) continue;

      ctx.globalAlpha = Math.max(0, t.life);
      ctx.fillStyle   = '#000';
      ctx.fillText(t.text, sx+1, sy+1);
      ctx.fillStyle   = t.color;
      ctx.fillText(t.text, sx, sy);
    }
    ctx.restore();
  }

  // ── Limpieza ──────────────────────────────────────────
  // Al entrar/salir de una submisión o al cargar un nivel: los FX
  // pendientes son de otro espacio de coordenadas y no deben aparecer.
  function clear() {
    for (let i = 0; i < MAX_PARTICLES; i++) _particles[i].active = false;
    for (let i = 0; i < MAX_TEXTS; i++)     _texts[i].active     = false;
    _flashAlpha = 0;
  }

  return { setCamera, spawnParticles, updateAndDrawParticles,
           flash, drawFlash, spawnText, drawFloatingTexts, clear };

})();
