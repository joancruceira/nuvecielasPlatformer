// ═══════════════════════════════════════════════════════
//  LEVEL1.JS — Bosque Mágico
//  180 tiles ancho × 16 alto ≈ 4 min caminando
//  Depende de: levels_const.js
// ═══════════════════════════════════════════════════════

const Level1 = {

  // ── Datos del nivel ────────────────────────────────
  data: {
    id:        1,
    name:      'Bosque Mágico',
    desc:      'Encuentra el castillo de Nuveciela.',
    skyTop:    '#1a0a3d',
    skyBot:    '#4a1870',
    groundCol: '#2a6a18',
    blockCol:  '#5a3010',
    bgTrees:      false,
    bosqueMagico: true,
    dark:      false,
    bossName:  'Hongo Gigante',
    bossEmoji: '🍄',
    map: null,  // se rellena en buildMap()
  },

  // ── Constructor del mapa ───────────────────────────
  buildMap() {
    const W = 180, H = 16;
    const map = emptyMap(W, H);
    const { ground, platform, spikes, star, walker, flyer } = MapBuilder;
    const g = (x,l,y)=>ground(map,x,l,y);
    const p = (x,l,y)=>platform(map,x,l,y);
    const s = (x,l,y)=>spikes(map,x,l,y);
    const st= (x,y)=>star(map,x,y);
    const w = (x,y=12)=>walker(map,x,y);
    const f = (x,y=7)=>flyer(map,x,y);
    const sl = (x,y=12)=>{ map[y][x] = TILE.SLIME; };   // salta, no camina

    // Objetos y paisaje del bosque (los levanta bosque.js y borra el tile).
    // Se anclan por la BASE al piso del tile: van en la fila 12 y quedan
    // parados sobre el suelo de la 13, mida lo que mida el sprite.
    const hs  = (x,y=12)=>{ map[y][x] = TILE.HONGO_SALTO; };  // trampolín
    const hd  = (x,y=12)=>{ map[y][x] = TILE.HONGO_DECO;  };
    const pl  = (x,y=12)=>{ map[y][x] = TILE.PLANTA;      };
    const fl  = (x,y=12)=>{ map[y][x] = TILE.FLOR;        };
    const arb = (x,y=12)=>{ map[y][x] = TILE.ARBOL_MANOS; };

    // ── Suelo base ───────────────────────────────────
    g(0,30); g(32,18); g(52,12);
    g(66,8); g(76,20); g(98,16);
    g(116,10); g(128,52);

    // ── Pinchos ──────────────────────────────────────
    s(50,2); s(74,2); s(96,2); s(126,2);

    // ── Plataformas ──────────────────────────────────
    p(30,3,10); p(34,3,8);  p(38,3,10);
    p(64,3,10); p(68,3,8);
    p(80,5,9);  p(88,4,7);
    p(100,6,10); p(110,4,8); p(120,5,9);

    // ── Estrellas ────────────────────────────────────
    st(5,11); st(10,11); st(15,11);
    st(31,9); st(35,7);  st(39,9);
    st(55,11); st(60,11);
    st(65,9); st(69,7);
    st(83,8); st(90,6);
    st(105,9); st(112,7);
    st(130,11); st(140,11); st(150,11); st(160,11);
    // ── Slimes ──────────────────────────────────────────
    // Saltan en vez de caminar: rompen el ritmo de los walkers, que van todos
    // a la misma velocidad y en línea recta.
    sl(22);
    sl(46);
    sl(88);
    sl(124);


    // ── Enemigos ─────────────────────────────────────
    w(20); w(37); w(55); w(70); w(85);
    w(100); w(115); w(135); w(155); w(165);
    f(45,7); f(72,6); f(105,8); f(145,7);

    // ── El bosque ────────────────────────────────────
    //
    //  HONGOS TRAMPOLÍN. Van donde te dan algo: llegar a una estrella alta,
    //  cruzar un foso, subir a una plataforma que si no obliga a doble salto.
    //  El primero está temprano y a la vista, con una estrella justo arriba:
    //  la lección se enseña sola en los primeros veinte segundos.
    hs(12);  st(12, 7);
    hs(28);
    hs(58);  st(58, 7);
    hs(78);
    hs(104); st(104, 6);
    hs(122);
    hs(148); st(148, 7);
    hs(168);

    //  FLORES. Se abren y se cierran, con una estrella adentro.
    fl(42);  st(42, 11);
    fl(94);  st(94, 11);
    fl(160); st(160, 10);

    //  EL ÁRBOL DE LAS MANOS. En el tramo tranquilo justo después del primer
    //  checkpoint, donde no hay nada que esquivar y se puede mirar.
    arb(106);

    //  PLANTAS Y HONGOS QUE BRILLAN. El fondo está lleno; el suelo no tenía uno.
    pl(4);   hd(8);   pl(17);  hd(25);  pl(33);
    hd(40);  pl(48);  hd(53);  pl(61);  hd(67);
    pl(72);  hd(79);  pl(84);  hd(92);  pl(99);
    hd(108); pl(113); hd(119); pl(130); hd(133);
    pl(139); hd(144); pl(152); hd(158); pl(163);
    hd(170); pl(176);

    // ── Especiales ───────────────────────────────────
    map[6][88]  = TILE.MAGIC_TREE;
    map[8][82]  = TILE.GIFT_BOX;
    map[12][90] = TILE.CHECKPOINT;
    map[12][174]= TILE.BOSS;
    map[12][177]= TILE.PORTAL;

    return map;
  },
};