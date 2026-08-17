// ═══════════════════════════════════════════════════════
//  LEVEL5.JS — Atravesando el lago (subacuático)
//  180 tiles ancho × 16 alto
//  Depende de: levels_const.js
// ═══════════════════════════════════════════════════════

const Level5 = {

  data: {
    id:        5, // 5to nivel (id = número que ve el jugador en el HUD)
    name:      'Atravesando el Lago',
    desc:      '¡Nivel subacuático! Nada para esquivar los peligros de las profundidades.',
    skyTop:    '#082f49', // Azul océano profundo
    skyBot:    '#0284c7', // Azul lago claro
    groundCol: '#0e7490', // Cyan oscuro para el fondo marino
    blockCol:  '#155e75', // Roca marina verdosa
    bgTrees:   false,
    dark:      false,
    glowing:   true,
    bossName:  null,
    bossEmoji: null,

    // Nivel sin boss: el portal se abre al cargar, no al derrotar a nadie.
    // Sin esto el portal quedaba active:false para siempre (los portales sólo
    // se activaban en _handleBossDefeated) y el nivel era imposible de terminar.
    winCondition: 'reachPortal',

    // Física subacuática — la lee player.js vía Engine.getLevelData().physics
    physics: {
      swim:     true,
      gravity:  320,   // vs 1380 en tierra
      maxFall:  250,   // vs 900
      hDrag:    0.65,  // arrastre horizontal
      accel:    6.0,   // aceleración por flotabilidad
      strokeVy: -300,  // impulso de cada brazada
    },

    map: null,
  },

  buildMap() {
    const W = 180, H = 16;
    const map = emptyMap(W, H);
    
    const { ground, platform, spikes, star } = MapBuilder;
    const g  = (x,l,y=13)=>ground(map,x,l,y);
    const p  = (x,l,y)=>platform(map,x,l,y);
    const s  = (x,l,y=13)=>spikes(map,x,l,y);
    const st = (x,y)=>star(map,x,y);

    // Habitantes del lago. Cada uno enseña algo distinto, y ninguno se reusa
    // de otro nivel (ver docs/NIVEL_LAGO.md).
    const cangrejo = (x,y=12)=>{ map[y][x] = TILE.CANGREJO;  };  // camina el fondo
    const medusa   = (x,y=7) =>{ map[y][x] = TILE.MEDUSA;    };  // sube y baja
    const aguja    = (x,y=8) =>{ map[y][x] = TILE.PEZ_AGUJA; };  // embiste en línea
    const tiburon  = (x,y=7) =>{ map[y][x] = TILE.TIBURON;   };  // no se mata
    const cardumen = (x,y=6) =>{ map[y][x] = TILE.CARDUMEN;  };  // empuja, no daña

    // ── Suelo del fondo del lago ───────────────────────
    g(0, 20);
    g(24, 15);
    g(45, 12);
    g(62, 30);
    g(98, 25);
    g(128, 50);

    // Pinchos (corales y trampas)
    s(20, 4);
    s(39, 6);
    s(57, 5);
    s(92, 6);
    s(123, 5);

    // ── Estructura de Techo (cuevas submarinas) ─────────
    for (let x = 65; x < 85; x++) {
      map[2][x] = TILE.BLOCK;
      map[3][x] = TILE.BLOCK;
      // Añadir algunos pinchos en el techo!
      if (x % 3 === 0) map[4][x] = TILE.SPIKES;
    }

    // ── Plataformas flotantes (corales flotantes) ───────
    p(22, 3, 9);
    p(26, 3, 6);
    p(41, 4, 8);
    p(48, 3, 9);
    p(53, 3, 6);
    
    // Laberinto submarino
    p(68, 4, 10);
    p(75, 4, 8);
    p(81, 4, 11);

    p(104, 3, 9);
    p(110, 3, 6);
    p(116, 4, 8);

    // Camino final
    p(135, 5, 9);
    p(145, 5, 7);
    p(155, 5, 10);

    // ── Estrellas burbujeantes ──────────────────────────
    st(10, 11); st(14, 9); st(18, 11);
    st(23, 7);  st(27, 4);  st(31, 7);
    st(43, 6);  st(49, 7);  st(54, 4);

    // Estrellas en el laberinto
    for (let x = 66; x < 84; x += 4) {
      st(x, 7);
      st(x + 2, 12);
    }

    // Estrellas de salida
    for (let x = 130; x < 170; x += 5) st(x, 11);

    // ── Habitantes ──────────────────────────────────────
    //
    //  ACTO 1 · la bajada (0-45)  — se aprende a nadar, nada castiga todavía
    cardumen(12, 6);
    cangrejo(12, 12);
    cardumen(30, 5);
    medusa(36, 6);
    cangrejo(30, 12);

    //  ACTO 2 · el jardín de coral (45-105) — aparece el que no se puede pisar
    cangrejo(50, 12);
    aguja(56, 8);
    medusa(60, 5);
    cangrejo(68, 11);
    aguja(74, 7);
    cangrejo(80, 11);
    medusa(88, 6);
    cardumen(95, 5);
    aguja(100, 9);

    //  ACTO 3 · la fosa (105-150) — oscuro, medusas que iluminan
    medusa(108, 5);
    medusa(114, 8);
    cangrejo(110, 12);
    medusa(127, 6);
    aguja(134, 7);
    medusa(140, 9);
    cardumen(146, 5);

    //  ACTO 4 · el tiburón (150-180) — agua abierta, no se pelea: se escapa
    cangrejo(140, 12);
    tiburon(158, 7);
    medusa(166, 9);
    tiburon(172, 6);

    // ── Checkpoints y Portal ────────────────────────────
    map[12][63]  = TILE.CHECKPOINT;
    map[12][129] = TILE.CHECKPOINT;
    map[12][172] = TILE.PORTAL; // Portal final del juego

    return map;
  },
};
