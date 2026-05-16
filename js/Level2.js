// ═══════════════════════════════════════════════════════
//  LEVEL2.JS — Castillo de Nuveciela
//  185 tiles ancho × 16 alto
//  Depende de: levels_const.js
// ═══════════════════════════════════════════════════════

const Level2 = {

  data: {
    id:        2,
    name:      'Castillo de Nuveciela',
    desc:      'Echá al fantasma y sus secuaces.',
    skyTop:    '#0a0010',
    skyBot:    '#1a0020',
    groundCol: '#2a1040',
    blockCol:  '#3d1a60',
    bgTrees:   false,
    dark:      true,
    crystals:  false,
    castleNC:  true,
    bossName:  'Fantasma Malvado',
    bossEmoji: '👻',
    map: null,
  },

  buildMap() {
    const W = 185, H = 16;
    const map = emptyMap(W, H);
    const { ground, platform, spikes, ceiling, star,
            walker, flyer, serpiente, fantasma } = MapBuilder;
    const g  = (x,l,y=13)=>ground(map,x,l,y);
    const p  = (x,l,y)=>platform(map,x,l,y);
    const s  = (x,l,y=13)=>spikes(map,x,l,y);
    const c  = (x,l,y=1)=>ceiling(map,x,l,y);
    const st = (x,y)=>star(map,x,y);
    const w  = (x,y=12)=>walker(map,x,y);
    const f  = (x,y=6)=>flyer(map,x,y);
    const se = (x,y=12)=>serpiente(map,x,y);
    const fa = (x,y=7)=>fantasma(map,x,y);

    // ── Suelo ─────────────────────────────────────────
    g(0,25); g(27,20); g(50,15);
    g(68,12); g(83,10); g(96,18);
    g(117,15); g(135,50);

    // ── Techo ─────────────────────────────────────────
    c(0,60); c(70,50); c(130,55);

    // ── Pinchos (arriba y abajo) ──────────────────────
    s(20,5,2); s(80,8,2); s(140,6,2);  // pinchos en techo
    s(47,3); s(65,3); s(80,2); s(114,3); s(133,2);

    // ── Plataformas ───────────────────────────────────
    p(25,4,10); p(29,4,8);  p(33,4,10);
    p(48,5,9);  p(66,4,10); p(70,4,8);
    p(90,6,10); p(100,5,8);
    p(115,4,9); p(120,4,7);

    // ── Estrellas ─────────────────────────────────────
    st(8,11); st(14,11); st(20,11);
    st(26,9); st(30,7);  st(34,9);
    st(52,11); st(57,11);
    st(69,9); st(73,7);
    st(92,9); st(97,7);
    st(105,11); st(118,9);
    st(138,11); st(148,11); st(158,11); st(168,11);

    // ── Enemigos ──────────────────────────────────────
    w(12); w(55); w(105); w(160);
    se(30); se(72); se(120); se(172);
    f(40,5); f(98,5); f(150,5);
    fa(50,6); fa(90,6); fa(135,6); fa(165,6);

    // ── Especiales ────────────────────────────────────
    map[4][92]  = TILE.MAGIC_TREE;
    map[11][104]= TILE.MAGIC_DOOR;
    map[12][101]= TILE.CHECKPOINT;
    map[12][179]= TILE.BOSS;
    map[12][182]= TILE.PORTAL;

    return map;
  },
};