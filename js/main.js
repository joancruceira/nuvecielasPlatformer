// ═══════════════════════════════════════════════════════
//  MAIN.JS — Punto de entrada, conecta todo
// ═══════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {

  const canvas = document.getElementById('gameCanvas');

  // Inicializar en orden de dependencias
  Engine.init(canvas, {
    onGameOver:   (stars, win) => UI.onGameOver(stars, win),
    onLevelClear: (nextIdx, stars) => UI.onLevelClear(nextIdx, stars),
    onPause:      (paused) => UI.onPause(paused),
  });

  UI.init();

  // Redimensionar canvas cuando cambia el viewport
  function resizeCanvas() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    Renderer.resize();
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Mostrar hint de habilidad al iniciar juego (se inyecta desde engine via UI)
  // Los character abilities se muestran en el HUD y en el badge inicial

  console.log('🌿 Nuvecielas Platformer — Motor listo.');
  console.log('Teclas: ← → mover | ↑ / Z / Espacio saltar | ↓ agacharse/deslizar | P / Esc pausa');
});