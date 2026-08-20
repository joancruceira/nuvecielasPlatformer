// ═══════════════════════════════════════════════════════
//  SUBMISION_MAP.JS — Mapa de tiles y carga de sprites
//  Depende de: submision_const.js
// ═══════════════════════════════════════════════════════

const SubMap = (() => {

  // ── Carga de sprites ──────────────────────────────────
  function preload() {
    const B = 'img/submision/';
    function load(k, src) { const i = new Image(); i.src = src; S.imgs[k] = i; }

    ['nina','jazmin'].forEach(ch => {
      for(let i=0;i<6;i++) load(`${ch}_run${i}`,  `${B}${ch}_run${i}.png`);
      for(let i=0;i<4;i++) load(`${ch}_jump${i}`, `${B}${ch}_jump${i}.png`);
    });
    for(let i=0;i<5;i++) load(`jaula_pablo_${i}`, `${B}jaula_pablo_${i}.png`);
    for(let i=0;i<7;i++) load(`pablo_free_${i}`,  `${B}pablo_free_${i}.png`);
    for(let i=0;i<4;i++) load(`gatito_walk${i}`,  `${B}gatito_walk${i}.png`);
    for(let i=0;i<8;i++) load(`ladron_${i}`,      `${B}ladron_${i}.png`);
    for(let i=0;i<8;i++) load(`perrero_${i}`,     `${B}perrero_${i}.png`);
    for(let i=0;i<4;i++) load(`enemigo_jefe_${i}`,`${B}enemigo_jefe_${i}.png`);

    // Los props y fondos de la segunda ronda
    ['gente0','gente1','gente2','gente3','gente4',
     'obstaculo0','obstaculo1','obstaculo2','obstaculo3',
     'parque0','parque1','parque2','parque3','parque4',
     'peatonal0','peatonal1','peatonal2','peatonal3',
     'corralon0','corralon1','corralon2','corralon3',
     'tunel0','tunel1','tunel2','tunel3','tunel4',
     'bg_parque','bg_peatonal','bg_corralon',
    ].forEach(n => load(n, `${B}${n}.png`));

    ['cielo_lejano','bg_rosario2','fondo_rosario',
     'tile_ground_top','tile_ground_mid','tile_dark_top','tile_dark_mid',
     'tile_water_top','tile_water_mid',
     'plat_wood','plat_stone','plat_metal','plat_dark',
     'prop_lamp','prop_bench','prop_kiosk','prop_tree','bus',
    ].forEach(n => load(n, `${B}${n}.png`));
  }

  // ── Construcción del mapa ─────────────────────────────
  //
  //  TILE IDs:
  //   0 = aire          3 = plataforma (colisión desde arriba)
  //   1 = suelo TOP     4 = agua (mata)
  //   2 = suelo MID     5 = dark TOP    6 = dark MID
  //
  //  ZONAS:
  //   0- 44  Costanera tranquila
  //  45- 89  Zona urbana
  //  90-129  Sector deteriorado + gaps
  // 130-159  Río / Tormenta
  // 160-189  Arena del jefe
  // 190-199  Rescate de Pablo

  function build() {
    const { MAP_W, MAP_H, GROUND_ROW, TS } = S;
    const M = Array.from({ length:MAP_H }, () => new Array(MAP_W).fill(0));
    // FIX: limpiar platMeta antes de cada build para evitar
    // arrastrar tipos de plataforma de runs anteriores
    for(const k in S.platMeta) delete S.platMeta[k];

    // ── helpers ─────────────────────────────────────────

    function ground(x, len, y=GROUND_ROW) {
      for(let c=x; c<x+len; c++) {
        M[y][c] = 1;
        if(y+1 < MAP_H) M[y+1][c] = 2;
      }
    }

    function darkGround(x, len, y=GROUND_ROW) {
      for(let c=x; c<x+len; c++) {
        M[y][c] = 5;
        if(y+1 < MAP_H) M[y+1][c] = 6;
      }
    }

    function plat(x, len, y, type='wood') {
      for(let c=x; c<x+len; c++) {
        M[y][c] = 3;
        S.platMeta[`${c}_${y}`] = type;
      }
    }

    function water(x, len, y=12) {
      for(let c=x; c<x+len; c++) M[y][c] = 4;
    }

    // ════════════════════════════════════════════════════
    //  ZONA 1 — Costanera tranquila (cols 0-44)
    //  Suelo amplio, sin pozos. Se aprenden los controles.
    // ════════════════════════════════════════════════════
    ground(0, 45);
    plat(6,  4, 8, 'stone');
    plat(14, 4, 8, 'stone');
    plat(24, 5, 8, 'stone');
    plat(33, 3, 8, 'stone');
    plat(26, 2, 6, 'stone');

    // ════════════════════════════════════════════════════
    //  ZONA 1b — Parque de la Independencia (45-79)
    //  Verde y abierta. Es el respiro ANTES de la ciudad, no después:
    //  el nivel abre calmo dos veces seguidas y recién ahí aprieta.
    //  Sin pozos a propósito — acá se mira, no se sufre.
    // ════════════════════════════════════════════════════
    ground(45, 35);
    plat(50, 5, 8, 'wood');
    plat(60, 4, 7, 'wood');
    plat(70, 5, 8, 'wood');
    plat(64, 3, 5, 'wood');          // alta, para los gatitos de arriba

    // ════════════════════════════════════════════════════
    //  ZONA 2 — Zona urbana (80-124)
    //  El colectivo abandonado como plataforma principal.
    // ════════════════════════════════════════════════════
    ground(80, 45);
    plat(83, 10, 8, 'stone');        // techo del colectivo
    plat(97,  4, 8, 'wood');
    plat(103, 4, 7, 'wood');
    plat(109, 4, 8, 'wood');
    plat(115, 3, 7, 'wood');
    plat(121, 3, 8, 'wood');

    // ════════════════════════════════════════════════════
    //  ZONA 2b — Peatonal Córdoba (125-159)
    //  La más angosta y la más "ciudad". Las plataformas son los TOLDOS
    //  de los locales, así que van bajas y seguidas: se avanza por arriba
    //  de las vidrieras.
    // ════════════════════════════════════════════════════
    ground(125, 33);
    plat(130, 4, 8, 'wood');
    plat(138, 3, 7, 'wood');
    plat(145, 4, 8, 'wood');
    plat(152, 4, 7, 'wood');
    water(158, 2, GROUND_ROW);       // el cordón antes del sector deteriorado
    water(158, 2, GROUND_ROW+1);

    // ════════════════════════════════════════════════════
    //  ZONA 3 — Sector deteriorado (160-197)
    //  Suelo fragmentado. Pozos de 3 tiles con agua.
    //  Cada pozo tiene su tablón encima: el jugador SIEMPRE ve el
    //  tablón antes del vacío.
    // ════════════════════════════════════════════════════
    ground(160, 10);
    water(170, 3, GROUND_ROW);  water(170, 3, GROUND_ROW+1);
    plat(169, 5, 8, 'wood');

    ground(173, 10);
    water(183, 3, GROUND_ROW);  water(183, 3, GROUND_ROW+1);
    plat(182, 5, 8, 'wood');

    ground(186, 9);
    water(195, 3, GROUND_ROW);  water(195, 3, GROUND_ROW+1);
    plat(194, 5, 8, 'wood');

    plat(162, 3, 6, 'stone');
    plat(175, 3, 6, 'stone');
    plat(188, 3, 6, 'stone');

    // ════════════════════════════════════════════════════
    //  ZONA 3b — Túneles del Parque España (198-227)
    //  Cerrada y oscura, y SIN INVENTAR NADA: es un túnel que existe.
    //  Resuelve la necesidad de un tramo tenso sin romper la regla del
    //  mundo real. Suelo continuo: la tensión la pone el encierro, no
    //  el vacío.
    // ════════════════════════════════════════════════════
    darkGround(198, 30);   // adentro del túnel no hay pasto: es cemento y sombra
    plat(204, 4, 7, 'stone');
    plat(212, 4, 7, 'stone');
    plat(220, 4, 7, 'stone');

    // ════════════════════════════════════════════════════
    //  ZONA 4 — Río Paraná / Tormenta (228-257)
    //  Todo agua. Plataformas de metal con 2 tiles de hueco.
    // ════════════════════════════════════════════════════
    water(228, 30, GROUND_ROW);
    water(228, 30, GROUND_ROW+1);
    plat(228, 4, 9, 'metal');
    plat(234, 4, 9, 'metal');
    plat(240, 4, 9, 'metal');
    plat(246, 4, 9, 'metal');
    plat(252, 6, 9, 'metal');

    // ════════════════════════════════════════════════════
    //  ZONA 5 — El corralón municipal (258-287)
    //  Adonde se llevan a los gatos. Por eso el Inspector está acá.
    // ════════════════════════════════════════════════════
    darkGround(258, 30);
    plat(261, 4, 7, 'dark');
    plat(281, 4, 7, 'dark');
    plat(270, 4, 6, 'dark');

    // ════════════════════════════════════════════════════
    //  ZONA 6 — Rescate de Pablo (288-297)
    //  Suelo normal = alivio visual después del corralón.
    // ════════════════════════════════════════════════════
    ground(288, 10);
    plat(S.COLS.PEDESTAL, 4, 8, 'stone');

    S.subMap = M;
  }

  return { preload, build };

})();