// ═══════════════════════════════════════════════════════
//  MAIN.JS — Punto de entrada, conecta todo
// ═══════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {

  const canvas = document.getElementById('gameCanvas');

  // Inicializar engine primero (Renderer.init se llama dentro)
  Engine.init(canvas, {
    onGameOver:   (stars, win) => UI.onGameOver(stars, win),
    onLevelClear: (nextIdx, stars) => UI.onLevelClear(nextIdx, stars),
    onPause:      (paused) => UI.onPause(paused),
  });

  UI.init();

  // Sincronizar tamaño del canvas con el viewport
  function resizeCanvas() {
    const W = canvas.offsetWidth  || window.innerWidth;
    const H = canvas.offsetHeight || window.innerHeight;
    if (W > 0 && H > 0) {
      canvas.width  = W;
      canvas.height = H;
      Renderer.resize();
    }
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas(); // ajustar por si el CSS ya tiene el tamaño

  console.log('🌿 Nuvecielas Platformer — Motor listo.');
  console.log('Teclas: ← → mover | ↑ / Z / Espacio saltar | ↓ agacharse/deslizar | P / Esc pausa');
});