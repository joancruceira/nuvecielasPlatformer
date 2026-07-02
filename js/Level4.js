// ═══════════════════════════════════════════════════════
//  LEVEL4.JS — El Castillo de la Ciela (rediseño "volver a casa")
//  310 tiles ancho × 16 alto
//
//  7 zonas con curva Nintendo (introducir→desarrollar→combinar→sorprender):
//   Z1 Puente Exterior · Z2 Gran Salón · Z3 Biblioteca · Z4 Invernadero
//   Z5 Campanario · Z6 Antesala · Z7 Sala del Trono (Boss)
//
//  Reglas de diseño respetadas:
//   • Completable con CUALQUIER Nuveciela (solo correr/saltar/doble salto/slide).
//     Congelar (Ciela) abre rutas alternativas y facilita secretos, nunca es
//     obligatorio.
//   • Saltos requeridos: ≤3 tiles de subida por paso, huecos ≤5 tiles.
//   • Los secretos no matan: premian mirar, explorar y dominar mecánicas.
//   • Storytelling solo con tiles existentes (hielo, mesa, candelabros,
//     árbol mágico, pilares de hielo = habitantes congelados).
//
//  Depende de: levels_const.js
// ═══════════════════════════════════════════════════════

const Level4 = {

  data: {
    id:        4, // 4to nivel (id = número que ve el jugador en el HUD)
    name:      'El Castillo de la Ciela',
    desc:      '¡El castillo de Ciela fue congelado por el Rey Escarcha! Recorrelo sala por sala y devolvele la vida.',
    skyTop:    '#0b1a30', // Azul noche ártico
    skyBot:    '#172554', // Azul marino helado
    groundCol: '#93c5fd', // Suelo de nieve/hielo
    blockCol:  '#1e293b', // Piedra oscura del castillo
    bgTrees:   false,
    dark:      false,
    glowing:   false,
    castleCiela: true,   // fondo img/level4/fondo_level4.png + nevada
    bossName:  'Rey de Escarcha',
    bossEmoji: '👑',
    map: null,
  },

  buildMap() {
    const W = 310, H = 16;
    const map = emptyMap(W, H);

    const {
      ground, platform, spikes, star,
      ice, iceSpikes, caballeroHelado, gargolaHielo, gotaViviente, reyEscarcha
    } = MapBuilder;

    // Aliases
    const g   = (x,l,y=13)=>ground(map,x,l,y);
    const p   = (x,l,y)=>platform(map,x,l,y);
    const st  = (x,y)=>star(map,x,y);
    const ic  = (x,l,y=13)=>ice(map,x,l,y);
    const isp = (x,l,y=13)=>iceSpikes(map,x,l,y);
    const blk = (x,y)=>{ map[y][x] = TILE.BLOCK; };

    // Enemigos
    const caballero = (x,y=12)=>caballeroHelado(map,x,y);
    const gargola   = (x,y=7)=>gargolaHielo(map,x,y);
    const gota      = (x,y=12)=>gotaViviente(map,x,y);

    // Arco de puerta: 2 columnas de bloques con abertura abajo (y10-12 libre)
    const gate = (x)=>{ for (let y=3; y<10; y++){ blk(x,y); blk(x+1,y); } };

    // ══════════════════════════════════════════════════════
    // ZONA 1 · EL PUENTE DE LOS ESTANDARTES (0–41) — calma
    //   La fuente congelada, el foso, y el primer secreto.
    // ══════════════════════════════════════════════════════
    g(0, 16);                        // explanada de entrada (x0-15)
    gota(10);                        // única gota: conocerla sin riesgo

    // El puente elevado (ruta escénica con estrellas)
    p(16, 2, 11);                    // escalón 1  (13→11)
    p(19, 2, 9);                     // escalón 2  (11→9)
    p(21, 12, 8);                    // tablero del puente (x21-32, y8)
    st(23, 6); st(26, 6); st(29, 6); // estrellas del puente

    // El foso bajo el puente — SECRETO #1: la alcoba
    isp(16, 3);                      // pinchos x16-18
    g(19, 9);                        // alcoba segura x19-27
    st(21, 12); st(23, 12); st(25, 12); // 3 estrellas del secreto
    isp(28, 3);                      // pinchos x28-30
    p(28, 2, 10);                    // salida de la alcoba (13→10→8 o seguir)

    // Acercamiento helado al castillo (primer hielo, SIN peligro)
    ic(31, 11);                      // x31-41 resbaladizo inofensivo
    gate(40);                        // portón exterior del castillo

    // ══════════════════════════════════════════════════════
    // ZONA 2 · EL GRAN SALÓN DEL BANQUETE (42–100)
    //   Hielo + gotas (materia prima), la mesa servida, candelabro,
    //   y el Guardián como "puerta viviente".
    // ══════════════════════════════════════════════════════
    ic(42, 26);                      // gran suelo helado x42-67
    isp(68, 5);                      // foso de carámbanos x68-72
    ic(73, 23);                      // hielo x73-95
    g(96, 5);                        // descanso de piedra x96-100

    // La mesa del banquete (plataforma larga) con platos congelados (ICE 1×1)
    p(48, 15, 10);                   // mesa x48-62, y10
    ice(map, 52, 1, 9);              // plato congelado (salta encima)
    ice(map, 57, 1, 9);              // otro plato
    st(50, 8); st(59, 8);            // estrellas sobre la mesa

    // El candelabro (plataforma colgante + estrellas altas)
    p(52, 3, 6);                     // candelabro y6 (mesa y10 → 9→6 con doble)
    st(52, 4); st(54, 4);

    // Cruce del foso (requerido, sin congelar): saltos cortos
    p(67, 2, 10); p(70, 2, 10);
    st(68, 8); st(70, 8);

    // Gotas del salón: patrullan el hielo (congelarlas = bloques empujables)
    gota(45); gota(63); gota(78);

    // El Guardián custodia la salida (lento: esquivable, atacable o pilar)
    caballero(88);
    st(81, 11); st(85, 11);

    gate(99);                        // puerta al ala de la biblioteca
    map[12][97] = TILE.CHECKPOINT;   // ✅ CHECKPOINT 1

    // ══════════════════════════════════════════════════════
    // ZONA 3 · LA BIBLIOTECA DE LOS RECUERDOS (101–158)
    //   Estanterías (verticalidad), túnel de slide, gárgolas que
    //   caen congeladas, y la sala secreta del ático.
    // ══════════════════════════════════════════════════════
    g(101, 58);                      // piso de la biblioteca x101-158

    // Estanterías escalonadas (subida en zigzag, pasos de ≤3)
    p(104, 3, 10);
    p(108, 3, 7);
    p(112, 3, 10);
    p(116, 3, 7);
    p(120, 3, 4);                    // estante más alto → ruta al ático
    st(109, 5); st(117, 5); st(113, 8);

    // Gárgolas vigilando entre estantes
    gargola(107, 5);
    gargola(115, 4);

    // SECRETO #2 · El ático tras el retrato (techo de la estantería)
    p(126, 11, 3);                   // pasarela alta x126-136, y3
    map[2][130] = TILE.GIFT_BOX;     // cofre del ático
    st(128, 2); st(133, 2);

    // Túnel de slide entre estanterías (gatear por el hueco de los libros)
    for (let x = 126; x <= 136; x++) { blk(x, 9); blk(x, 10); }
    ic(126, 11);                     // suelo helado del túnel x126-136
    st(128, 12); st(131, 12); st(134, 12);

    // Franja de carámbanos post-túnel: saltable, o congelá la gárgola
    // de arriba para que caiga y los rompa (lección estrella de Ciela)
    isp(138, 4);                     // x138-141
    gargola(139, 6);

    gota(144);
    map[12][145] = TILE.CHECKPOINT;  // ✅ CHECKPOINT 2

    // El gran foso de la biblioteca: plataformas (requerido) o
    // gárgolas congeladas que caen y rompen los pinchos (creativo)
    isp(147, 6);                     // x147-152
    p(147, 2, 10); p(150, 2, 10);
    gargola(148, 4); gargola(152, 5);
    st(148, 8); st(151, 8);

    // ══════════════════════════════════════════════════════
    // ZONA 4 · EL INVERNADERO DE CRISTAL (159–192) — VALLE
    //   Cero enemigos. Cristales, y la única planta viva del
    //   castillo: el Árbol Mágico (esperanza + inmunidad).
    // ══════════════════════════════════════════════════════
    g(159, 34);                      // x159-192, piedra (sin hielo: refugio)

    // Formaciones de cristal (hielo decorativo escalable)
    ice(map, 163, 1, 12);
    ice(map, 166, 1, 12); ice(map, 166, 1, 11);
    ice(map, 186, 1, 12); ice(map, 186, 1, 11);

    // La flor viva (Árbol Mágico existente: brillo + inmunidad)
    map[12][175] = TILE.MAGIC_TREE;

    // SECRETO #3 · La flor de estrellas (acercarse a mirar = premio)
    p(172, 2, 10); p(177, 2, 10);    // pétalos-plataforma
    st(173, 8); st(177, 8);          // pétalos laterales
    st(174, 7); st(176, 7);
    st(175, 6);                      // corona de la flor

    map[12][190] = TILE.CHECKPOINT;  // ✅ CHECKPOINT 3

    // ══════════════════════════════════════════════════════
    // ZONA 5 · LA ESCALERA DEL CAMPANARIO (193–252) — EXAMEN
    //   Ascenso por repisas heladas, la campana, oleadas de
    //   gárgolas, el Guardián final y el atajo secreto.
    // ══════════════════════════════════════════════════════
    g(193, 60);                      // piso de la torre x193-252
    gota(200);                       // repaso en la base

    // Repisas heladas ascendentes (pasos de 2, resbaladizas)
    ic(205, 3, 11);
    ic(209, 3, 9);
    ic(213, 3, 7);
    p(217, 8, 5);                    // paso de la campana x217-224, y5
    st(206, 9); st(210, 7); st(214, 5);

    // La campana congelada (bloques) y sus estrellas
    blk(219, 1); blk(220, 1); blk(221, 1);
    st(219, 3); st(222, 3);

    // Oleadas de gárgolas del campanario
    gargola(209, 3);
    gargola(215, 3);
    gargola(227, 4);

    // Descenso (ruta normal): baja al piso y enfrenta la guardia
    p(226, 3, 7);
    p(230, 2, 9);
    caballero(238);                  // el Guardián del descansillo
    gota(234); gota(246);

    // SECRETO #4 · El atajo de las alturas (ruta de maestría):
    // desde y7 un doble salto preciso alcanza la cornisa y4 y se
    // saltea toda la guardia del piso.
    p(231, 3, 4); p(236, 3, 4); p(241, 3, 4);
    st(237, 2); st(242, 2);

    map[12][250] = TILE.CHECKPOINT;  // ✅ CHECKPOINT 4 (antes del boss)

    // ══════════════════════════════════════════════════════
    // ZONA 6 · LA ANTESALA DE LOS CONGELADOS (253–276)
    //   Sin enemigos. Los habitantes del castillo, congelados en
    //   pilares de hielo. Silencio. El cofre. La puerta del trono.
    // ══════════════════════════════════════════════════════
    g(253, 24);                      // x253-276

    // Techo bajo del pasillo (opresión suave)
    for (let x = 256; x <= 272; x++) blk(x, 5);

    // Los habitantes congelados (pilares de hielo 1×2, esquivables)
    for (const x of [257, 260, 263, 266, 269, 272]) {
      ice(map, x, 1, 12);
      ice(map, x, 1, 11);
    }

    map[12][274] = TILE.GIFT_BOX;    // el cofre antes del trono
    gate(275);                       // la puerta del trono

    // ══════════════════════════════════════════════════════
    // ZONA 7 · LA SALA DEL TRONO (277–309) — REY ESCARCHA
    //   Arena con entorno: plataformas laterales, gotas (escudo/
    //   escalón si las congelás) y una gárgola que puede caer.
    // ══════════════════════════════════════════════════════
    g(277, 33);                      // x277-309

    // Muro derecho: cierra la arena
    for (let y = 1; y < 13; y++) blk(308, y);

    // Plataformas laterales (esquivar oleadas y carámbanos)
    p(281, 3, 9);
    p(297, 3, 9);
    st(282, 7); st(298, 7);

    // El trono usurpado (estrado)
    blk(301, 12); blk(302, 12); blk(302, 11);

    // El entorno participa: materia prima congelable en plena pelea
    gota(284); gota(298);
    gargola(288, 4);

    // SECRETO #5 · Detrás del trono (para quien no corre al portal)
    st(304, 11); st(306, 11);

    // El Rey de Escarcha (arena automática ±15 tiles: x277-307)
    map[9][292] = TILE.REY_ESCARCHA;

    // Portal al Nivel 5 (se activa al vencer al Rey)
    map[12][305] = TILE.PORTAL;

    return map;
  },
};
