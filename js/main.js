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

  // Sincronizar el canvas con el viewport.
  // El tamaño del buffer lo decide Renderer.resize() —que aplica densidad de
  // píxeles y zoom—; acá sólo hay que avisarle. Antes esto escribía
  // canvas.width/height a mano y pisaba ese cálculo.
  window.addEventListener('resize', () => Renderer.resize());
  Renderer.resize();

  console.log('🌿 Nuvecielas Platformer — Motor listo.');
  console.log('Teclas: ← → mover | ↑ / Z / Espacio saltar | ↓ agacharse/deslizar | P / Esc pausa');
});
