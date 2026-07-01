// ═══════════════════════════════════════════════════════
//  LEVELS.JS — Coordinador de niveles
//  Orden de carga en index.html:
//    levels_const.js  ← primero (TILE, helpers)
//    level1.js
//    level2.js
//    level3.js
//    level4.js
//    levels.js        ← este archivo (último)
//
//  Para agregar un nivel nuevo:
//  1. Crear level5.js con Level5 = { data, buildMap }
//  2. Agregarlo al array LEVELS acá
//  3. Cargarlo en index.html antes de levels.js
// ═══════════════════════════════════════════════════════

const LEVELS = [
  { ...Level1.data },
  { ...Level2.data },
  { ...Level3.data },
  { ...Level4.data },
  { ...Level5.data },
];

function initLevels() {
  LEVELS[0].map = Level1.buildMap();
  LEVELS[1].map = Level2.buildMap();
  LEVELS[2].map = Level3.buildMap();
  LEVELS[3].map = Level4.buildMap();
  LEVELS[4].map = Level5.buildMap();
}