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
    
    const { ground, platform, spikes, star, flyer } = MapBuilder;
    const g  = (x,l,y=13)=>ground(map,x,l,y);
    const p  = (x,l,y)=>platform(map,x,l,y);
    const s  = (x,l,y=13)=>spikes(map,x,l,y);
    const st = (x,y)=>star(map,x,y);
    const f  = (x,y=7)=>flyer(map,x,y); // Voladores actúan como medusas/peces

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

    // ── Enemigos (Medusas flotantes y peces de patrulla) ──
    f(12, 6);  // flyer actúa como pez volador/nadador
    f(28, 5);
    f(48, 6);
    f(70, 7);
    f(78, 6);
    f(105, 5);
    f(115, 6);
    f(138, 7);
    f(148, 5);
    f(158, 8);

    // ── Checkpoints y Portal ────────────────────────────
    map[12][63]  = TILE.CHECKPOINT;
    map[12][129] = TILE.CHECKPOINT;
    map[12][172] = TILE.PORTAL; // Portal final del juego

    return map;
  },
};
