// ═══════════════════════════════════════════════════════
//  LEVEL4.JS — El Castillo de la Ciela (nivel premium)
//  210 tiles ancho × 16 alto
//  Depende de: levels_const.js
// ═══════════════════════════════════════════════════════

const Level4 = {

  data: {
    id:        4, // 4to nivel (id = número que ve el jugador en el HUD)
    name:      'El Castillo de la Ciela',
    desc:      '¡Domina las salas heladas y desafía al Rey de Escarcha!',
    skyTop:    '#0b1a30', // Azul noche ártico
    skyBot:    '#172554', // Azul marino helado
    groundCol: '#93c5fd', // Suelo de nieve/hielo
    blockCol:  '#1e293b', // Piedra oscura del castillo
    bgTrees:   false,
    dark:      false,
    glowing:   true,
    bossName:  'Rey de Escarcha',
    bossEmoji: '👑',
    map: null,
  },

  buildMap() {
    const W = 210, H = 16;
    const map = emptyMap(W, H);
    
    // Desestructurar constructores
    const { 
      ground, platform, spikes, star, 
      ice, iceSpikes, caballeroHelado, gargolaHielo, gotaViviente, reyEscarcha 
    } = MapBuilder;

    // Aliases para construcción rápida
    const g  = (x,l,y=13)=>ground(map,x,l,y);
    const p  = (x,l,y)=>platform(map,x,l,y);
    const s  = (x,l,y=13)=>spikes(map,x,l,y);
    const st = (x,y)=>star(map,x,y);
    const ic = (x,l,y=13)=>ice(map,x,l,y);
    const isp = (x,l,y=13)=>iceSpikes(map,x,l,y);
    
    // Enemigos
    const caballero = (x,y=12)=>caballeroHelado(map,x,y);
    const gargola   = (x,y=7)=>gargolaHielo(map,x,y);
    const gota      = (x,y=12)=>gotaViviente(map,x,y);

    // ── ESTRUCTURA SUELO Y PLATAFORMAS ───────────────────
    
    // Zona 1: Entrada del Castillo (Exterior y Puente)
    g(0, 15);               // Suelo inicial
    g(18, 12);              // Puente de entrada
    isp(15, 3);             // Foso de pinchos helados
    p(14, 3, 10);           // Plataforma flotante

    // Entrada del castillo (Muro exterior y puerta)
    g(30, 20);
    // Arco de entrada (bloques de techo)
    for (let y = 4; y < 10; y++) {
      map[y][34] = TILE.BLOCK;
      map[y][35] = TILE.BLOCK;
    }
    
    // Zona 2: Salón de Hielo Resbaladizo (Interior)
    ic(50, 18);             // Primer gran suelo de hielo!
    isp(68, 6);             // Foso de pinchos en medio del salón
    ic(74, 16);             // Continuación del hielo

    // Plataformas interiores flotantes para evitar los pinchos
    p(65, 4, 9);
    p(71, 4, 9);
    p(68, 3, 6);

    // Zona 3: El laberinto de túneles (Slides obligatorios)
    g(90, 35);
    // Techo bajo para forzar el deslizamiento (slide)
    for(let x=93; x<112; x++) {
      map[10][x] = TILE.BLOCK;
      map[9][x]  = TILE.BLOCK;
    }
    // Suelo deslizante en el túnel
    for(let x=93; x<112; x++) {
      map[13][x] = TILE.ICE;
    }

    // Checkpoint a mitad de camino
    map[12][91] = TILE.CHECKPOINT;

    // Zona 4: El Gran Pozo y las Gárgolas
    g(125, 8);
    isp(133, 15);           // Foso de pinchos súper largo
    g(148, 10);
    
    // Plataformas flotantes heladas sobre el pozo
    // Aquí el jugador usará las gárgolas congeladas o plataformas
    p(134, 2, 10);
    p(138, 2, 7);
    p(142, 2, 10);
    p(145, 2, 7);

    // Zona 5: Sala del Trono (El Boss Arena)
    g(158, 52);             // Suelo de piedra sólida para el combate
    // Paredes del fondo para encerrar la arena de combate
    for (let y = 1; y < 13; y++) {
      map[y][208] = TILE.BLOCK;
    }
    
    // ── ENEMIGOS ─────────────────────────────────────────
    
    // Caballero Helado resguardando el puente de entrada
    caballero(24);
    
    // Gotas de agua escurridizas en la entrada
    gota(38);
    gota(45);

    // Salón de hielo: Caballero + Gotas que resbalan rápido
    caballero(58);
    gota(62);
    gota(78);
    caballero(84);

    // Gárgolas vigilando en el techo del túnel
    gargola(96, 6);
    gargola(108, 6);

    // Gárgolas sobre el pozo de pinchos (se pueden congelar para pisarlas/romper pinchos!)
    gargola(135, 5);
    gargola(140, 4);
    gargola(144, 5);

    // Zona previa al boss: Guardia pesada
    caballero(164);
    caballero(172);
    gota(176);

    // ── ESTRELLAS (RECOMPENSAS PREMIUM) ──────────────────
    
    // Estrellas en la entrada
    st(6, 10); st(9, 8); st(12, 10);
    
    // Estrellas flotando en el salón de hielo (requiere impulso en resbalón)
    st(55, 9); st(58, 7); st(61, 9);
    st(77, 8); st(80, 8);

    // Estrellas dentro del túnel de slide
    for(let x=96; x<110; x+=3) st(x, 12);

    // Estrellas en el pozo
    st(135, 8); st(139, 5); st(143, 8);
    
    // Estrellas flotando en la arena del jefe
    for (let x = 165; x < 185; x += 4) st(x, 9);

    // ── ELEMENTOS ESPECIALES ─────────────────────────────
    
    // Cofre de regalo previo al combate
    map[12][160] = TILE.GIFT_BOX;

    // El Rey de Escarcha (Jefe)
    map[9][192] = TILE.REY_ESCARCHA; // Spawnea en x = 192 (192 * 48px)

    // El Portal final que lleva al Nivel 5 (Lago Subacuático)
    map[12][204] = TILE.PORTAL;

    return map;
  },
};