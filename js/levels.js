// ═══════════════════════════════════════════════════════
//  LEVELS.JS — Definición de tilemaps y datos de niveles
//  Tile IDs:
//   0  = aire
//   1  = suelo sólido (pasto)
//   2  = plataforma (solo colisión desde arriba)
//   3  = pinchos (daño)
//   4  = bloque sólido (tierra/roca)
//   5  = moneda/estrella coleccionable
//   6  = checkpoint flag
//   7  = portal de salida
//   8  = bloque decorativo (árbol/hongo, sin colisión)
//  10+ = spawn enemigos (ver ENEMIES)
//  10  = walker (camina)
//  11  = flyer (vuela)
//  12  = boss spawn
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
};

const TILE_SIZE = 48; // px

// ─────────────────────────────────────────────────────
//  Helpers para construir tilemaps compactos
// ─────────────────────────────────────────────────────

/** Crea fila de N tiles con valor v */
function row(v, n) { return Array(n).fill(v); }

/** Combina segmentos: seg([AIR,8], [GROUND,4], ...) */
function seg(...pairs) {
  const out = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const val = pairs[i], len = pairs[i+1];
    for (let j = 0; j < len; j++) out.push(val);
  }
  return out;
}

// ─────────────────────────────────────────────────────
//  NIVEL 1 — Pradera Encantada
//  180 tiles ancho × 16 alto = ~4 min caminando
// ─────────────────────────────────────────────────────
function buildLevel1() {
  const W = 180, H = 16;
  const map = Array.from({length: H}, () => row(0, W));

  // Piso base (fila 13–15)
  function ground(x, len, y=13) {
    for (let i=0; i<len; i++) {
      map[y][x+i]   = TILE.GROUND;
      map[y+1][x+i] = TILE.BLOCK;
      map[y+2][x+i] = TILE.BLOCK;
    }
  }
  // Plataforma flotante
  function platform(x, len, y) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.PLATFORM;
  }
  // Pinchos en fila y
  function spikes(x, len, y=13) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.SPIKES;
  }
  // Estrella
  function star(x, y) { map[y][x] = TILE.STAR; }
  // Enemigo
  function walker(x, y=12) { map[y][x] = TILE.WALKER; }
  function flyer(x, y=7)   { map[y][x] = TILE.FLYER;  }

  // ── suelo base ──
  ground(0, 30);        // inicio
  ground(32, 18);       // tras foso
  ground(52, 12);
  ground(66, 8);
  ground(76, 20);
  ground(98, 16);
  ground(116, 10);
  ground(128, 52);      // recta larga hasta el final

  // ── fosos ──
  // foso en 30-31 (aire natural, sin piso)
  // foso en 64-65

  // ── pinchos ──
  spikes(50, 2);
  spikes(74, 2);
  spikes(96, 2);
  spikes(126, 2);

  // ── plataformas ──
  platform(30, 3, 10);
  platform(34, 3, 8);
  platform(38, 3, 10);
  platform(64, 3, 10);
  platform(68, 3, 8);
  platform(80, 5, 9);
  platform(88, 4, 7);
  platform(100, 6, 10);
  platform(110, 4, 8);
  platform(120, 5, 9);

  // ── estrellas ──
  star(5, 11); star(10, 11); star(15, 11);
  star(31, 9); star(35, 7); star(39, 9);
  star(55, 11); star(60, 11);
  star(65, 9); star(69, 7);
  star(83, 8); star(90, 6);
  star(105, 9); star(112, 7);
  star(130, 11); star(140, 11); star(150, 11); star(160, 11);

  // ── enemigos ──
  walker(20); walker(37); walker(55);
  walker(70); walker(85); walker(100);
  walker(115); walker(135); walker(155); walker(165);
  flyer(45, 7); flyer(72, 6); flyer(105, 8); flyer(145, 7);

  // ── checkpoint a mitad ──
  map[12][90] = TILE.CHECKPOINT;

  // ── boss spawn al final ──
  map[12][174] = TILE.BOSS;

  // ── portal (después del boss) ──
  map[12][177] = TILE.PORTAL;

  return map;
}

// ─────────────────────────────────────────────────────
//  NIVEL 2 — Caverna de Cristales
// ─────────────────────────────────────────────────────
function buildLevel2() {
  const W = 185, H = 16;
  const map = Array.from({length: H}, () => row(0, W));

  function ground(x, len, y=13) {
    for (let i=0; i<len; i++) {
      map[y][x+i]   = TILE.GROUND;
      if (y+1 < H) map[y+1][x+i] = TILE.BLOCK;
      if (y+2 < H) map[y+2][x+i] = TILE.BLOCK;
    }
  }
  function ceiling(x, len, y=2) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.BLOCK;
  }
  function platform(x, len, y) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.PLATFORM;
  }
  function spikes(x, len, y=13) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.SPIKES;
  }
  function spikesUp(x, len, y=2) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.SPIKES;
  }
  function star(x, y) { map[y][x] = TILE.STAR; }
  function walker(x, y=12) { map[y][x] = TILE.WALKER; }
  function flyer(x, y=6)   { map[y][x] = TILE.FLYER;  }

  ground(0, 25);
  ground(27, 20);
  ground(50, 15);
  ground(68, 12);
  ground(83, 10);
  ground(96, 18);
  ground(117, 15);
  ground(135, 50);

  ceiling(0, 60, 1);
  ceiling(70, 50, 1);
  ceiling(130, 55, 1);

  spikesUp(20, 5, 2);
  spikesUp(80, 8, 2);
  spikesUp(140, 6, 2);

  spikes(47, 3);
  spikes(65, 3);
  spikes(80, 2);
  spikes(114, 3);
  spikes(133, 2);

  platform(25, 4, 10);
  platform(29, 4, 8);
  platform(33, 4, 10);
  platform(48, 5, 9);
  platform(66, 4, 10);
  platform(70, 4, 8);
  platform(90, 6, 10);
  platform(100, 5, 8);
  platform(115, 4, 9);
  platform(120, 4, 7);

  star(8, 11); star(14, 11); star(20, 11);
  star(26, 9); star(30, 7); star(34, 9);
  star(52, 11); star(57, 11);
  star(69, 9); star(73, 7);
  star(92, 9); star(97, 7);
  star(105, 11); star(118, 9);
  star(138, 11); star(148, 11); star(158, 11); star(168, 11);

  walker(12); walker(30); walker(55);
  walker(72); walker(88); walker(105);
  walker(120); walker(140); walker(160); walker(172);
  flyer(40, 5); flyer(68, 5); flyer(98, 5); flyer(150, 5);

  map[12][93] = TILE.CHECKPOINT;
  map[12][179] = TILE.BOSS;
  map[12][182] = TILE.PORTAL;

  return map;
}

// ─────────────────────────────────────────────────────
//  NIVEL 3 — Árbol Colosal
// ─────────────────────────────────────────────────────
function buildLevel3() {
  const W = 190, H = 16;
  const map = Array.from({length: H}, () => row(0, W));

  function ground(x, len, y=13) {
    for (let i=0; i<len; i++) {
      map[y][x+i] = TILE.GROUND;
      if (y+1 < H) map[y+1][x+i] = TILE.BLOCK;
      if (y+2 < H) map[y+2][x+i] = TILE.BLOCK;
    }
  }
  function platform(x, len, y) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.PLATFORM;
  }
  function spikes(x, len, y=13) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.SPIKES;
  }
  function star(x, y) { map[y][x] = TILE.STAR; }
  function walker(x, y=12) { map[y][x] = TILE.WALKER; }
  function flyer(x, y=5)   { map[y][x] = TILE.FLYER;  }

  ground(0, 22);
  ground(24, 12);
  ground(38, 8);
  ground(50, 16);
  ground(70, 8);
  ground(82, 14);
  ground(100, 12);
  ground(116, 10);
  ground(130, 60);

  // Muchas plataformas altas - sensación de árbol colosal
  platform(22, 4, 10); platform(26, 3, 7); platform(30, 4, 4);
  platform(36, 4, 10); platform(40, 3, 7);
  platform(48, 5, 11); platform(54, 4, 8); platform(60, 3, 5);
  platform(68, 4, 10); platform(72, 4, 7); platform(76, 3, 4);
  platform(80, 5, 11); platform(86, 4, 8);
  platform(98, 6, 10); platform(106, 4, 7); platform(112, 3, 4);
  platform(114, 5, 10); platform(120, 4, 7); platform(126, 3, 4);

  spikes(35, 3); spikes(46, 4); spikes(66, 3);
  spikes(78, 2); spikes(96, 3); spikes(112, 2); spikes(128, 3);

  for (let x=5; x<20; x+=5)  star(x, 11);
  for (let x=27; x<36; x+=3) star(x, 6);
  for (let x=51; x<66; x+=4) star(x, 7);
  for (let x=69; x<80; x+=3) star(x, 6);
  for (let x=83; x<97; x+=4) star(x, 7);
  for (let x=99; x<115; x+=4) star(x, 6);
  for (let x=135; x<185; x+=6) star(x, 11);

  walker(10); walker(28); walker(52);
  walker(70); walker(84); walker(102);
  walker(118); walker(135); walker(155); walker(170);
  flyer(35, 5); flyer(62, 4); flyer(90, 4); flyer(125, 5); flyer(160, 5);

  map[12][95] = TILE.CHECKPOINT;
  map[12][184] = TILE.BOSS;
  map[12][187] = TILE.PORTAL;

  return map;
}

// ─────────────────────────────────────────────────────
//  NIVEL 4 — Núcleo del Bosque (oscuro)
// ─────────────────────────────────────────────────────
function buildLevel4() {
  const W = 195, H = 16;
  const map = Array.from({length: H}, () => row(0, W));

  function ground(x, len, y=13) {
    for (let i=0; i<len; i++) {
      map[y][x+i] = TILE.GROUND;
      if (y+1 < H) map[y+1][x+i] = TILE.BLOCK;
      if (y+2 < H) map[y+2][x+i] = TILE.BLOCK;
    }
  }
  function platform(x, len, y) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.PLATFORM;
  }
  function spikes(x, len, y=13) {
    for (let i=0; i<len; i++) map[y][x+i] = TILE.SPIKES;
  }
  function star(x, y) { map[y][x] = TILE.STAR; }
  function walker(x, y=12) { map[y][x] = TILE.WALKER; }
  function flyer(x, y=5)   { map[y][x] = TILE.FLYER;  }

  // Nivel más difícil: más fosos, más pinchos, plataformas más separadas
  ground(0, 18);
  ground(20, 8);
  ground(32, 6);
  ground(42, 10);
  ground(56, 8);
  ground(68, 6);
  ground(78, 14);
  ground(96, 10);
  ground(110, 8);
  ground(122, 10);
  ground(136, 60);

  platform(18, 3, 10); platform(22, 3, 7); platform(28, 3, 10);
  platform(30, 3, 7);  platform(38, 4, 9); platform(42, 3, 6);
  platform(52, 4, 10); platform(58, 3, 7); platform(64, 3, 4);
  platform(66, 4, 10); platform(72, 3, 7); platform(76, 3, 4);
  platform(92, 5, 10); platform(98, 4, 7); platform(106, 3, 4);
  platform(108, 5, 10); platform(116, 4, 7); platform(120, 3, 4);
  platform(130, 4, 10); platform(134, 3, 7);

  spikes(28, 4); spikes(40, 3); spikes(54, 4);
  spikes(66, 3); spikes(76, 4); spikes(94, 3);
  spikes(108, 4); spikes(120, 3); spikes(134, 4);

  for (let x=5; x<17; x+=4) star(x, 11);
  for (let x=19; x<30; x+=3) star(x, 6);
  for (let x=43; x<55; x+=3) star(x, 7);
  for (let x=67; x<78; x+=3) star(x, 6);
  for (let x=79; x<92; x+=4) star(x, 7);
  for (let x=93; x<108; x+=3) star(x, 6);
  for (let x=139; x<190; x+=5) star(x, 11);

  walker(8); walker(22); walker(44);
  walker(58); walker(70); walker(80);
  walker(98); walker(112); walker(124); walker(138);
  walker(150); walker(162); walker(174);
  flyer(30, 4); flyer(55, 4); flyer(78, 4);
  flyer(100, 4); flyer(128, 4); flyer(155, 4); flyer(172, 4);

  map[12][98] = TILE.CHECKPOINT;
  map[12][189] = TILE.BOSS;
  map[12][192] = TILE.PORTAL;

  return map;
}

// ─────────────────────────────────────────────────────
//  DATOS DE NIVELES
// ─────────────────────────────────────────────────────
const LEVELS = [
  {
    id: 1,
    name: "Pradera Encantada",
    skyTop:    "#87ceeb",
    skyBot:    "#c5eeff",
    groundCol: "#5bb87a",
    blockCol:  "#7a5230",
    bgTrees:   true,
    dark:      false,
    bossName:  "Hongo Gigante",
    bossEmoji: "🍄",
    map: null, // se rellena en init
  },
  {
    id: 2,
    name: "Caverna de Cristales",
    skyTop:    "#1a0a3a",
    skyBot:    "#2d1065",
    groundCol: "#4a3080",
    blockCol:  "#6b4fa0",
    bgTrees:   false,
    dark:      true,
    crystals:  true,
    bossName:  "Murciélago Enorme",
    bossEmoji: "🦇",
    map: null,
  },
  {
    id: 3,
    name: "Árbol Colosal",
    skyTop:    "#2d6a1f",
    skyBot:    "#4a9e30",
    groundCol: "#3a7a20",
    blockCol:  "#5a3010",
    bgTrees:   true,
    dark:      false,
    bossName:  "Oruga Mecánica",
    bossEmoji: "🐛",
    map: null,
  },
  {
    id: 4,
    name: "Núcleo del Bosque",
    skyTop:    "#080a12",
    skyBot:    "#0d1428",
    groundCol: "#1a2a40",
    blockCol:  "#0a1525",
    bgTrees:   false,
    dark:      true,
    glowing:   true,
    bossName:  "Sombra de las Nuvecielas",
    bossEmoji: "👤",
    map: null,
  },
];

// ─────────────────────────────────────────────────────
//  INIT — genera los mapas
// ─────────────────────────────────────────────────────
function initLevels() {
  LEVELS[0].map = buildLevel1();
  LEVELS[1].map = buildLevel2();
  LEVELS[2].map = buildLevel3();
  LEVELS[3].map = buildLevel4();
}