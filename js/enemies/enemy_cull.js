// ═══════════════════════════════════════════════════════
//  ENEMY_CULL.JS — ¿hace falta simular este enemigo?
//  Sin dependencias. Cargar ANTES de los sistemas de enemigos.
//
//  En el nivel 4 hay 22 enemigos y como mucho 3 entran en pantalla: los
//  otros 19 se simulaban igual, cada frame, durante todo el nivel.
//
//  El criterio es la distancia al JUGADOR, no a la cámara, por dos razones:
//  la cámara va anclada a él (así que da casi lo mismo) y `ps` ya llega a
//  todos los update() sin tocar ninguna firma.
// ═══════════════════════════════════════════════════════

const EnemyCull = (() => {

  // El viewport más ancho que dibujamos ronda los 1300 px de mundo, con el
  // jugador al 42%: ve ~550 a la izquierda y ~750 a la derecha. 1200 deja
  // margen de sobra para que nada despierte a la vista.
  const RADIO = 1200;

  /**
   * ¿Este enemigo está lo bastante cerca como para simularlo?
   * Los que están muriendo siguen activos siempre: su animación de muerte
   * es la que los saca del array, y si la congelamos quedan de estatua.
   */
  function activo(e, ps) {
    if (!ps) return true;
    if (e.state === 'death') return true;
    return Math.abs((e.x + (e.w || 0) / 2) - (ps.x + (ps.w || 0) / 2)) < RADIO;
  }

  return { activo, RADIO };

})();
