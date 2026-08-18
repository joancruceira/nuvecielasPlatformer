// ═══════════════════════════════════════════════════════
//  LEVELS_CONST.JS — Constantes y helpers compartidos
//  Cargá este archivo PRIMERO, antes de cualquier level.
// ═══════════════════════════════════════════════════════

const TILE = {
  AIR:        0,
  GROUND:     1,
  PLATFORM:   2,
  SPIKES:     3,
  BLOCK:      4,
  STAR:       5,
  CHECKPOINT: 6,
  PORTAL:     7,
  DECO:       8,
  WALKER:    10,
  FLYER:     11,
  BOSS:      12,
  SERPIENTE: 13,
  FANTASMA:  14,
  MAGIC_TREE:15,
  GIFT_BOX:  16,
  MAGIC_DOOR:17,
  ARANA:     18,   // Castillo de Nuveciela
  SLIME:     19,   // Bosque Mágico
  // Nivel 3 — Sendero Nocturno
  ORUGA:     20,
  ARBUSTO:   21,
  MURCIELAGO:22,
  LECHUZA:   23,   // jefe — reemplaza al ciempiés, que era una oruga grande
  // Nivel 4 — El Castillo de la Ciela
  ICE:             30,
  ICE_SPIKES:      31,
  CABALLERO_HELADO:32,
  GARGO_HIELO:     33,
  GOTA_VIVIENTE:   34,
  REY_ESCARCHA:    35,
  SUPER_MAGIC_TREE:36, // Súper Árbol Mágico — secreto raro (ajuste de balance)
  // Nivel 5 — Atravesando el Lago
  CANGREJO:  40,
  MEDUSA:    41,
  PEZ_AGUJA: 42,
  TIBURON:   43,
  CARDUMEN:  44,
  // Lago — objetos y paisaje (los maneja lago.js, no enemies.js)
  GEISER:    45,
  BURBUJA:   46,   // emisor de burbujas montables
  ALMEJA:    47,
  CORAL:     48,
  ALGA:      49,
  RUINA:     50,
  ESTATUA:   51,
  // Bosque Mágico — objetos y paisaje (los maneja bosque.js, no enemies.js)
  HONGO_SALTO: 60,   // trampolín
  HONGO_DECO:  61,
  PLANTA:      62,   // helechos, pastos, tronco caído
  FLOR:        63,   // se abre y se cierra
  ARBOL_MANOS: 64,   // el gancho: huellas de manos en la corteza
};

const TILE_SIZE = 48; // px

// ─────────────────────────────────────────────────────
//  Helpers para construir tilemaps compactos
//  Disponibles globalmente para todos los level*.js
// ─────────────────────────────────────────────────────

/** Crea una fila de N tiles con valor v */
function row(v, n) { return Array(n).fill(v); }

/** Combina segmentos: seg(AIR,8, GROUND,4, ...) */
function seg(...pairs) {
  const out = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const val = pairs[i], len = pairs[i+1];
    for (let j = 0; j < len; j++) out.push(val);
  }
  return out;
}

/**
 * Crea un mapa vacío de W×H tiles lleno de AIR.
 * @param {number} W ancho en tiles
 * @param {number} H alto en tiles
 */
function emptyMap(W, H) {
  return Array.from({length: H}, () => row(0, W));
}

/**
 * Helpers de construcción reutilizables.
 * Reciben el mapa como primer argumento para ser portables.
 */
const MapBuilder = {
  ground(map, x, len, y=13) {
    const H = map.length;
    for (let i=0; i<len; i++) {
      map[y][x+i]   = TILE.GROUND;
      if (y+1 < H) map[y+1][x+i] = TILE.BLOCK;
      if (y+2 < H) map[y+2][x+i] = TILE.BLOCK;
    }
  },
  platform(map, x, len, y) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.PLATFORM;
  },
  spikes(map, x, len, y=13) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.SPIKES;
  },
  ceiling(map, x, len, y=2) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.BLOCK;
  },
  star(map, x, y)    { map[y][x] = TILE.STAR;       },
  walker(map, x, y=12){ map[y][x] = TILE.WALKER;    },
  flyer(map, x, y=7) { map[y][x] = TILE.FLYER;      },
  serpiente(map,x,y=12){ map[y][x]=TILE.SERPIENTE;  },
  fantasma(map,x,y=7){ map[y][x] = TILE.FANTASMA;   },
  oruga(map,x,y=12)  { map[y][x] = TILE.ORUGA;      },
  arbusto(map,x,y=12){ map[y][x] = TILE.ARBUSTO;    },
  murcielago(map,x,y=7){ map[y][x]=TILE.MURCIELAGO; },
  lechuza(map,x,y=12){ map[y][x]=TILE.LECHUZA;     },
  ice(map, x, len, y=13) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.ICE;
  },
  iceSpikes(map, x, len, y=13) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.ICE_SPIKES;
  },
  caballeroHelado(map, x, y=12) { map[y][x] = TILE.CABALLERO_HELADO; },
  gargolaHielo(map, x, y=7)     { map[y][x] = TILE.GARGO_HIELO; },
  gotaViviente(map, x, y=12)    { map[y][x] = TILE.GOTA_VIVIENTE; },
  reyEscarcha(map, x, y=12)     { map[y][x] = TILE.REY_ESCARCHA; },
};