// ═══════════════════════════════════════════════════════
//  LEVEL4.JS — Núcleo del Bosque (oscuro)
//  195 tiles ancho × 16 alto
//  Depende de: levels_const.js
// ═══════════════════════════════════════════════════════

const Level4 = {

  data: {
    id:        4,
    name:      'Núcleo del Bosque',
    desc:      '¡Derrotá a la Sombra de las Nuvecielas!',
    skyTop:    '#080a12',
    skyBot:    '#0d1428',
    groundCol: '#1a2a40',
    blockCol:  '#0a1525',
    bgTrees:   false,
    dark:      true,
    glowing:   true,
    bossName:  'Sombra de las Nuvecielas',
    bossEmoji: '👤',
    map: null,
  },

  buildMap() {
    const W = 195, H = 16;
    const map = emptyMap(W, H);
    const { ground, platform, spikes, star, walker, flyer } = MapBuilder;
    const g  = (x,l,y=13)=>ground(map,x,l,y);
    const p  = (x,l,y)=>platform(map,x,l,y);
    const s  = (x,l,y=13)=>spikes(map,x,l,y);
    const st = (x,y)=>star(map,x,y);
    const w  = (x,y=12)=>walker(map,x,y);
    const f  = (x,y=5)=>flyer(map,x,y);

    // ── Suelo (más fosos, más difícil) ───────────────
    g(0,18);   g(20,8);  g(32,6);
    g(42,10);  g(56,8);  g(68,6);
    g(78,14);  g(96,10); g(110,8);
    g(122,10); g(136,60);

    // ── Plataformas ───────────────────────────────────
    p(18,3,10); p(22,3,7);  p(28,3,10);
    p(30,3,7);  p(38,4,9);  p(42,3,6);
    p(52,4,10); p(58,3,7);  p(64,3,4);
    p(66,4,10); p(72,3,7);  p(76,3,4);
    p(92,5,10); p(98,4,7);  p(106,3,4);
    p(108,5,10);p(116,4,7); p(120,3,4);
    p(130,4,10);p(134,3,7);

    // ── Pinchos ───────────────────────────────────────
    s(28,4); s(40,3); s(54,4); s(66,3);
    s(76,4); s(94,3); s(108,4);s(120,3); s(134,4);

    // ── Estrellas ─────────────────────────────────────
    for(let x=5;  x<17; x+=4) st(x,11);
    for(let x=19; x<30; x+=3) st(x,6);
    for(let x=43; x<55; x+=3) st(x,7);
    for(let x=67; x<78; x+=3) st(x,6);
    for(let x=79; x<92; x+=4) st(x,7);
    for(let x=93; x<108;x+=3) st(x,6);
    for(let x=139;x<190;x+=5) st(x,11);

    // ── Enemigos ──────────────────────────────────────
    w(8);  w(22); w(44); w(58); w(70);
    w(80); w(98); w(112);w(124);w(138);
    w(150);w(162);w(174);
    f(30,4);f(55,4);f(78,4);
    f(100,4);f(128,4);f(155,4);f(172,4);

    // ── Especiales ────────────────────────────────────
    map[12][98] = TILE.CHECKPOINT;
    map[12][189]= TILE.BOSS;
    map[12][192]= TILE.PORTAL;

    return map;
  },
};