// ═══════════════════════════════════════════════════════
//  RENDERER_CORE.JS — Contexto compartido
//  Cargá este archivo PRIMERO.
//  Todos los módulos del renderer leen/escriben sobre R.
// ═══════════════════════════════════════════════════════

const R = {
  canvas: null,
  ctx:    null,
  W:      0,
  H:      0,
};