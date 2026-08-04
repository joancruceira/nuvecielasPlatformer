// ═══════════════════════════════════════════════════════
//  RENDERER_CORE.JS — Contexto compartido
//  Cargá este archivo PRIMERO.
//  Todos los módulos del renderer leen/escriben sobre R.
// ═══════════════════════════════════════════════════════

const R = {
  canvas: null,
  ctx:    null,
  // W/H son el viewport en UNIDADES DE MUNDO (ya divididas por el zoom),
  // no en píxeles del canvas. Todo el juego dibuja en unidades de mundo y
  // la transformación del contexto se encarga de dpr y zoom.
  W:      0,
  H:      0,
  dpr:    1,   // densidad de píxeles real del dispositivo (tope 2)
  zoom:   1,   // <1 en pantallas chicas: aleja la cámara para ver más nivel
};