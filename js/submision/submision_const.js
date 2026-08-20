// ═══════════════════════════════════════════════════════
//  SUBMISION_CONST.JS — Constantes y estado compartido
//  Todos los módulos leen/escriben sobre este objeto S.
//  Cargá este archivo PRIMERO en index.html.
// ═══════════════════════════════════════════════════════

const S = {

  // ── Constantes de mapa ────────────────────────────────
  TS:         48,
  MAP_W:      298,

  //  Las columnas del tramo final. Estaban como números sueltos repartidos en
  //  submision_entities.js, y al alargar el mapa había que cazarlas una por una.
  //  Acá viven una sola vez.
  COLS: {
    PEDESTAL: 289,   // plat(PEDESTAL,4,8) — la tarima de la jaula
    PABLO:    290,
    GEMA:     294,
    BOSS:     286,
    BOSS_IZQ: 280,
    BOSS_DER: 293,
  },
  MAP_H:      14,
  GROUND_ROW: 10,   // fila 10 = y 480px = suelo principal

  // ── IDs de tiles ──────────────────────────────────────
  // 0 = aire     1 = suelo TOP   2 = suelo MID
  // 3 = plat     4 = agua        5 = dark TOP   6 = dark MID
  TILE: { AIR:0, GROUND:1, FILL:2, PLAT:3, WATER:4, DARK:5, DARK_FILL:6 },

  // ── Paleta de gameplay ────────────────────────────────
  PAL: {
    GROUND_TOP:  '#6ecf3a',
    PLAT_TOP:    '#f0c840',
    WATER_TOP:   '#7a4e1a',
    WATER_MID:   '#5a3610',
    WATER_ANIM:  '#c8902a',
    // Era violeta mágico y era LO ÚNICO del subnivel que no podía existir en
    // Rosario — justo en el tramo donde el nivel se pone serio. Ahora es la
    // franja de un corralón municipal iluminado por faroles de sodio.
    DARK_GLOW:   '#ff9a3c',
  },

  // ── Personajes ────────────────────────────────────────
  CHARS: {
    nina:   { label:'Nina',   prefix:'nina',   color:'#fde68a' },
    jazmin: { label:'Jazmín', prefix:'jazmin', color:'#7dd3fc' },
  },

  // ── Transiciones ─────────────────────────────────────
  TRANS_COLORS: ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff','#ff9f1c','#fff'],

  // ── Sprites ───────────────────────────────────────────
  imgs: {},

  // ── Fase del subnivel ─────────────────────────────────
  phase:        'idle',   // idle | transition_in | select | playing | transition_out
  selectedChar: null,
  onComplete:   null,
  transTimer:   0,
  gameTime:     0,

  // ── Mapa ──────────────────────────────────────────────
  subMap:   null,
  platMeta: {},   // "col_row" → 'wood'|'stone'|'metal'|'dark'

  // ── Cámara ────────────────────────────────────────────
  cam: { x:0, y:0 },

  // ── Jugador ───────────────────────────────────────────
  ps: {
    x:0, y:0, vx:0, vy:0, w:44, h:68,
    grounded:false, facing:1,
    lives:5, maxLives:5, invTimer:0,
    runFrame:0, runTick:0, jumpFrame:0,
    score:0, hearts:[], heartCooldown:0,
  },

  // ── Input ─────────────────────────────────────────────
  inp: { left:false, right:false, jump:false, jumpPressed:false, fire:false, firePressed:false },

  // ── Enemigos ──────────────────────────────────────────
  enemies: [],

  ENEMY_DEF: [
    { type:'ladron', speed:110, hp:1, pts:100, label:'🕵️ Ladrón', range:360, h:68 },
    { type:'perrero',speed:92,  hp:1, pts:150, label:'🦺 Perrero', range:300, h:68 },
  ],

  //  Recolocados al alargar el mapa de 200 a 298 columnas. El parque, la
  //  peatonal y el túnel son zonas nuevas y traen los suyos.
  ENEMY_SPAWNS: [
    [10,0],[20,1],[34,0],                    // costanera
    [52,1],[64,0],[74,1],                    // parque
    [85,0],[98,1],[110,0],[119,1],           // urbana
    [132,0],[143,1],[154,0],                 // peatonal
    [162,0],[176,1],[188,0],                 // deteriorado
    [204,1],[213,0],[222,1],                 // túnel
    [262,0],[268,1],[276,0],[282,1],         // corralón
    [290,0],[294,1],                         // rescate
  ],

  // ── Gatitos coleccionables ────────────────────────────
  kitties: [],
  // Los rescatados, en orden. Caminan atrás del jugador como patitos.
  fila: [],
  // Sin cols sobre el río (228-257): ahí no hay dónde pararse.
  KITTY_COLS: [8,18,26,  55,68,76,  87,101,115,  134,148,
               163,178,190,  208,219,  263,270,278,  291,294],

  // ── Pablo (jaula/libre) ───────────────────────────────
  pablo: {
    x:0, y:0, w:64, h:72,
    state:        'caged',  // 'caged' | 'idle' | 'pickup' | 'gone'
    freed:        false,
    glowPhase:    0,
    frameIdx:     0,
    frameTick:    0,
    freeFrameIdx:  0,
    freeFrameTick: 0,
    freeVx:       40,
    freeFacing:   1,
    pickupTimer:  0,
  },
  JAULA_CYCLE: [0,0,0,0,1,0,0,0,2,0,0,0,3,0,0,0,0,4,0,0],

  // ── Gema ─────────────────────────────────────────────
  gem: { x:0, y:0, w:32, h:32, collected:false, glowPhase:0 },

  // ── Boss ─────────────────────────────────────────────
  boss: {
    x:0, y:0, w:80, h:96,
    hp:8, maxHp:8, vx:0, facing:-1,
    alive:true, activated:false, stunTimer:0,
    frameIdx:0, frameTick:0,
    state:'patrol', stateTimer:0,
    patrolLeft:0, patrolRight:0,
    bossPhase:1,
  },

};