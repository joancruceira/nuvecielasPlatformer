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
    //  Suelo amplio, plataformas opcionales.
    //  Sin gaps. El jugador aprende los controles.
    // ════════════════════════════════════════════════════
    ground(0, 45);

    plat(6,  4, 8, 'stone');  // banco/kiosco
    plat(14, 4, 8, 'stone');  // segundo banco
    plat(24, 5, 8, 'stone');  // techo kiosco
    plat(33, 3, 8, 'stone');  // salida
    plat(26, 2, 6, 'stone');  // extra alta — coleccionables

    // ════════════════════════════════════════════════════
    //  ZONA 2 — Zona urbana (cols 45-89)
    //  Bus abandonado como plataforma principal.
    //  Suelo continuo. Gap de 2 tiles al final.
    // ════════════════════════════════════════════════════
    ground(45, 45);

    plat(48, 10, 8, 'stone'); // techo bus (cols 48-57)
    plat(62,  4, 8, 'wood');
    plat(68,  4, 7, 'wood');
    plat(74,  4, 8, 'wood');
    plat(80,  3, 7, 'wood');
    plat(86,  3, 8, 'wood');

    // Gap cols 90-91 con agua visible
    water(90, 2, GROUND_ROW);
    water(90, 2, GROUND_ROW+1);

    // ════════════════════════════════════════════════════
    //  ZONA 3 — Sector deteriorado (cols 92-129)
    //  Suelo fragmentado. Gaps de 3 tiles con agua.
    //  Cada gap tiene una plataforma de madera encima.
    //  El jugador SIEMPRE ve el tablón antes del vacío.
    // ════════════════════════════════════════════════════
    ground(92, 10);                   // bloque 1
    water(102, 3, GROUND_ROW);
    water(102, 3, GROUND_ROW+1);
    plat(101, 5, 8, 'wood');          // tablón sobre gap 1

    ground(105, 10);                  // bloque 2
    water(115, 3, GROUND_ROW);
    water(115, 3, GROUND_ROW+1);
    plat(114, 5, 8, 'wood');          // tablón sobre gap 2

    ground(118,  9);                  // bloque 3
    water(127, 3, GROUND_ROW);
    water(127, 3, GROUND_ROW+1);
    plat(126, 5, 8, 'wood');          // tablón sobre gap 3

    plat(94,  3, 6, 'stone');         // altas opcionales
    plat(107, 3, 6, 'stone');
    plat(120, 3, 6, 'stone');

    // ════════════════════════════════════════════════════
    //  ZONA 4 — Río Paraná / Tormenta (cols 130-159)
    //  Todo es agua. Plataformas de metal en fila 9.
    //  Gap = 2 tiles entre cada plataforma → salto cómodo.
    //  Última plataforma llega al borde de la zona dark.
    // ════════════════════════════════════════════════════
    water(130, 30, GROUND_ROW);
    water(130, 30, GROUND_ROW+1);

    plat(130, 4, 9, 'metal');
    plat(136, 4, 9, 'metal');
    plat(142, 4, 9, 'metal');
    plat(148, 4, 9, 'metal');
    plat(154, 6, 9, 'metal');         // más larga → llega a col 159

    // ════════════════════════════════════════════════════
    //  ZONA 5 — Arena del jefe (cols 160-189)
    //  Suelo dark (morado) — contraste total con el resto.
    //  Plataformas en fila 7 (sobre la cabeza del boss).
    //  Boss: y = GROUND_ROW*TS-96 = 384px, tope ~310px.
    //  Fila 7 = 336px → plataformas sobre el boss ✓
    // ════════════════════════════════════════════════════
    darkGround(160, 30);

    plat(163, 4, 7, 'dark');          // L
    plat(183, 4, 7, 'dark');          // R
    plat(172, 4, 6, 'dark');          // centro alto

    // ════════════════════════════════════════════════════
    //  ZONA 6 — Rescate de Pablo (cols 190-199)
    //  Suelo normal = alivio visual post-boss.
    //  Pedestal cols 191-194, pablo centrado en 192.
    // ════════════════════════════════════════════════════
    ground(190, 10);
    plat(191, 4, 8, 'stone');         // pedestal de la jaula

    S.subMap = M;
  }

  return { preload, build };

})();