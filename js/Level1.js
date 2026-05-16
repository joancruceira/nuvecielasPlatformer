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

    // ── Enemigos ─────────────────────────────────────
    w(20); w(37); w(55); w(70); w(85);
    w(100); w(115); w(135); w(155); w(165);
    f(45,7); f(72,6); f(105,8); f(145,7);

    // ── Especiales ───────────────────────────────────
    map[6][88]  = TILE.MAGIC_TREE;
    map[8][82]  = TILE.GIFT_BOX;
    map[12][90] = TILE.CHECKPOINT;
    map[12][174]= TILE.BOSS;
    map[12][177]= TILE.PORTAL;

    return map;
  },
};