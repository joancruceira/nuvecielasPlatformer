// ═══════════════════════════════════════════════════════
//  LEVEL3.JS — Sendero Nocturno
//  200 tiles ancho × 16 alto
//  Depende de: levels_const.js
// ═══════════════════════════════════════════════════════

const Level3 = {

  data: {
    id:        3,
    name:      'Sendero Nocturno',
    desc:      'Camino al Castillo de Ciela.',
    skyTop:    '#0a0520',
    skyBot:    '#1a0a4a',
    groundCol: '#2a1a0a',
    blockCol:  '#1a0a05',
    bgTrees:   false,
    dark:      true,
    senderoNocturno: true,
    bossName:  'Lechuza Guardiana',
    bossEmoji: '🦉',
    map: null,
  },

  buildMap() {
    const W = 200, H = 16;
    const map = emptyMap(W, H);
    const { ground, platform, spikes, star,
            oruga, arbusto, murcielago, lechuza } = MapBuilder;

    const g  = (x,l)   => ground(map, x, l, 13);
    const p  = (x,l,y) => platform(map, x, l, y);
    const s  = (x,l)   => spikes(map, x, l, 13);
    const st = (x,y)   => star(map, x, y);
    // Shortcuts — enemigos en fila 12 (AIR sobre el suelo en fila 13)
    // spawnFromMap hace: y = r*TS - H → 12*48 - H = 576 - H
    // La gravedad los baja hasta apoyarse en el suelo (fila 13, y=624)
    const or = (x)     => map[12][x] = TILE.ORUGA;
    const ar = (x)     => map[12][x] = TILE.ARBUSTO;
    const mu = (x,y=7) => map[y][x]  = TILE.MURCIELAGO;
    const le = (x)     => map[12][x] = TILE.LECHUZA;

    // ══ SUELO — continuo con 2 fosos pequeños ══
    // Zona 1: col 0-65 con 1 foso
    g(0, 30);         // col 0-29
    g(32, 34);        // col 32-65  (foso en col 30-31)
    // Zona 2: col 68-119 con 1 foso
    g(68, 52);        // col 68-119  (foso en col 66-67)
    // Zona 3 (cueva): col 122-139 continuo
    g(122, 18);       // col 122-139
    // Zona 4: col 142-167 con 1 foso
    g(142, 26);       // col 142-167  (foso en col 140-141)
    // Zona 5 (boss): col 168-199 continuo
    g(168, 32);       // col 168-199

    // ══ PLATAFORMAS ══
    // Zona 1
    p(20, 4, 10); p(26, 4, 8); p(34, 4, 10);
    p(46, 5, 9);  p(54, 4, 7);
    // Zona 2
    p(72, 4, 10); p(78, 4, 8);  p(84, 4, 10);
    p(96, 5, 9);  p(104, 4, 7); p(110, 4, 9);
    // Zona 3 (cueva)
    p(124, 4, 9); p(130, 4, 8);
    // Zona 4
    p(146, 4, 10); p(152, 4, 8); p(158, 4, 10);
    // Zona 5 (boss) — plataformas para el combate
    p(174, 5, 9); p(182, 5, 9); p(190, 4, 9);

    // ══ PINCHOS — solo en zonas seguras (no en bordes) ══
    s(10, 3);  s(42, 3);  s(58, 3);
    s(74, 3);  s(88, 3);  s(100, 3);
    s(144, 3); s(158, 3);

    // ══ ESTRELLAS ══
    // Zona 1
    st(5, 11);  st(12, 11); st(18, 11);
    st(21, 9);  st(27, 7);  st(35, 9);
    st(48, 8);  st(55, 6);
    // Zona 2
    st(70, 11); st(76, 9);  st(82, 7);
    st(90, 9);  st(98, 8);  st(106, 6);
    st(112, 9);
    // Zona 3
    st(125, 8); st(132, 7);
    // Zona 4
    st(143, 11); st(148, 9); st(154, 7);
    st(160, 9); st(164, 11);
    // Zona 5
    st(172, 11); st(178, 11); st(185, 11); st(192, 11);

    // ══ ENEMIGOS ══
    // Zona 1 (suelo en cols 0-29 y 32-65)
    // Pinchos en cols 10-12 y 42-44 y 58-60 — evitar esas cols
    or(8);   or(25);  or(37);   // alejados de bordes de fosos (30-31) y pinchos
    ar(16);  ar(52);
    mu(30, 6); mu(56, 5);

    // Zona 2 (suelo en cols 68-119)
    // Pinchos en cols 74-76, 88-90, 100-102
    or(72);  or(93);  or(112);
    ar(82);  ar(105);
    mu(76, 5); mu(97, 6); mu(116, 5);

    // Zona 3 (cueva, suelo 122-139)
    ar(130);
    mu(128, 8);

    // Zona 4 (suelo 142-167)
    // Pinchos en cols 144-146, 158-160
    or(148); or(155); or(164);
    ar(151); ar(163);
    mu(150, 6); mu(161, 5);

    // Zona 5 — solo boss
    le(183);

    // ══ ESPECIALES ══
    // Cueva a mitad del nivel
    // Cueva — col 128, fila 12 (aire sobre suelo firme de zona 3)
    // spawnFromMap usará y = groundRow*TS - H_DOOR para ponerla al ras
    map[12][128] = TILE.MAGIC_DOOR;

    // Checkpoints
    map[12][62]  = TILE.CHECKPOINT;   // fin zona 1
    map[12][138] = TILE.CHECKPOINT;   // fin zona 3
    map[12][167] = TILE.CHECKPOINT;   // antes del boss

    // Árboles de inmunidad
    map[9][18]   = TILE.MAGIC_TREE;   // zona 1
    map[8][92]   = TILE.MAGIC_TREE;   // zona 2
    map[9][162]  = TILE.MAGIC_TREE;   // zona 4 (antes del boss)

    // Portal al final
    map[12][197] = TILE.PORTAL;

    return map;
  },
};