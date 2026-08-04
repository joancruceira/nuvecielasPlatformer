// ═══════════════════════════════════════════════════════
//  SUBNIVEL_NATAN_CONFIG.JS
// ═══════════════════════════════════════════════════════

const SubNivelNatanConfig = (() => {

  const ASSET_BASE = 'img/level3/subnivel/';

  // Anchos DIBUJADOS reales a H=768 (img.naturalWidth * 768/img.naturalHeight)
  // Necesario porque algunas imágenes tienen altura distinta y se escalan diferente
  const BG_WIDTHS  = [1387, 1365, 1446, 1421, 2583, 1286, 1288, 1367];
  const BG_TOTAL_W = BG_WIDTHS.reduce((a,b)=>a+b, 0); // 12143

  // Ruido determinístico. Las alturas de los juguetes usaban Math.random() en
  // tiempo de módulo: el nivel cambiaba en cada recarga, así que era imposible
  // balancearlo o reproducir un problema.
  function _rnd(i) { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); }

  const WORLD = {
    width:             BG_TOTAL_W + 4000,
    groundPct:         0.80,
    tierraEndX:        BG_TOTAL_W,
    vueloStartX:       BG_TOTAL_W,
    vetX:              BG_TOTAL_W + 3500,
    finishDelay:       4.0,
    transitionDuration:1.8,
  };

  const PHASE = {
    TRANSITION:'transition', TIERRA:'tierra',
    VUELO:'vuelo', FINAL:'final',
  };

  const PLAYER = {
    name:'SUPER NATAN', w:94, h:104,
    startX:150, hp:5,
    speedX:230, flySpeedY:200,
    gravity:900, jumpVy:-480, maxFall:720,
    fireCooldown:0.55, invincibleTime:1.8,
  };

  // Los fondos sin transparencia van en JPEG (pesaban ~2.7 MB cada uno en PNG).
  // fondo4/5/6 tienen alpha y siguen en PNG.
  const BACKGROUNDS = {
    tierra:['fondo0.jpg','fondo1.jpg','fondo2.jpg','fondo3.jpg',
            'fondo4.png','fondo5.png','fondo6.png','fondo7.jpg'],
    cielo:'fondo_aire.jpg',
  };

  const BACKGROUND_SEGMENTS = (() => {
    let x=0;
    return BACKGROUNDS.tierra.map((file,i)=>{
      const seg={file,index:i,worldX:x,w:BG_WIDTHS[i]};
      x+=BG_WIDTHS[i]; return seg;
    });
  })();

  const PLATFORMS = [
    {x:600,   yRel:0.14, w:130, h:16},{x:1100,  yRel:0.10, w:110, h:16},
    {x:1700,  yRel:0.13, w:120, h:16},{x:2300,  yRel:0.08, w:100, h:16},
    {x:2900,  yRel:0.15, w:130, h:16},{x:3600,  yRel:0.11, w:110, h:16},
    {x:4400,  yRel:0.10, w:120, h:16},{x:5200,  yRel:0.13, w:130, h:16},
    {x:6100,  yRel:0.09, w:100, h:16},{x:7000,  yRel:0.14, w:120, h:16},
    {x:7900,  yRel:0.11, w:110, h:16},{x:8800,  yRel:0.10, w:130, h:16},
    {x:9700,  yRel:0.13, w:110, h:16},{x:10500, yRel:0.08, w:120, h:16},
  ];

  const OBSTACLES = [
    {type:'poste', x:500,   w:22, h:170},
    {type:'banco', x:1200,  w:120,h:36 },
    {type:'poste', x:2500,  w:22, h:160},
    {type:'caja',  x:3800,  w:70, h:52 },
    {type:'poste', x:5500,  w:22, h:170},
    {type:'banco', x:7200,  w:120,h:36 },
    {type:'caja',  x:9100,  w:70, h:52 },
    {type:'poste', x:10800, w:22, h:160},
  ];

  // ── Juguetes coleccionables ───────────────────────────
  // Distribuidos en toda la fase tierra (x:300 a x:11000)
  // y en la fase vuelo (x: BG_TOTAL_W + 200 a + 3200)
  const TOYS = (() => {
    const list=[];
    const tipos=['🚂','⚽','🎮','🎲','🪀','🎯','🧸','🚗','🎸','🪁'];
    // Tierra: cada ~400px, en distintas alturas
    const xsTierra=[350,750,1100,1450,1900,2350,2800,3300,3900,4500,
                    5100,5700,6400,7100,7800,8500,9200,9900,10500,11000];
    xsTierra.forEach((x,i)=>{
      list.push({id:`t${i}`,x,yPct:0.55+_rnd(i)*0.18,
                 icon:tipos[i%tipos.length],zone:'tierra',collected:false,score:50});
    });
    // Algunos en plataformas (más altos)
    [600,1700,2900,4400,6100,8800].forEach((x,i)=>{
      list.push({id:`tp${i}`,x:x+40,yPct:0.60,
                 icon:tipos[(i+3)%tipos.length],zone:'tierra',collected:false,score:100,onPlatform:true});
    });
    // Vuelo: flotando por el cielo
    const xsVuelo=[200,600,1000,1400,1800,2200,2800,3100];
    xsVuelo.forEach((xOff,i)=>{
      list.push({id:`v${i}`,x:BG_TOTAL_W+xOff,yPct:0.20+_rnd(i+100)*0.45,
                 icon:tipos[(i+5)%tipos.length],zone:'vuelo',collected:false,score:150});
    });
    return list;
  })();

  // ── Spawns terrestres — fase tierra (0 → 12143 px) ────
  //
  // El reparto anterior era un metrónomo: ladrón→oficinista→perrero en bucle,
  // uno cada 553±68 px de punta a punta. Sin introducción, sin clusters y sin
  // respiros: 12.000 px de la misma frase repetida veinte veces.
  //
  // Ahora hay una curva. Cada tipo se presenta SOLO antes de mezclarse, los
  // grupos se alternan con huecos vacíos de verdad (el respiro es parte del
  // ritmo, no tiempo muerto), y la tensión sube hacia el final.
  //
  //  A 0-2200     presentación: cada enemigo aislado y legible
  //  B 2200-4800  desarrollo: primeras parejas + primer helicóptero
  //  C 4800-7200  combinación: cluster de tres, respiro largo, aire+suelo
  //  D 7200-9600  presión: grupos más apretados
  //  E 9600-11400 clímax terrestre
  //  F 11400-12143 valle vacío: respiro antes de despegar
  const GROUND_SPAWNS = [
    // ── A · presentación ──
    {id:'g01', type:'ladron',     x:900  },                    // el primero, solo
    {id:'g02', type:'oficinista', x:1750 },                    // tipo nuevo, aislado

    // ── B · desarrollo ──
    {id:'g03', type:'perrero',    x:2500 },                    // tipo nuevo, aislado
    {id:'g04', type:'ladron',     x:3250 },
    {id:'g05', type:'ladron',     x:3480 },                    // primera pareja
    {id:'ga1', type:'heli_bajo',  x:3900, yPct:0.50},          // primer aéreo
    {id:'g06', type:'oficinista', x:4550 },

    // ── C · combinación ──
    {id:'g07', type:'ladron',     x:5150 },
    {id:'g08', type:'perrero',    x:5380 },
    {id:'g09', type:'oficinista', x:5600 },                    // cluster de tres
    //            (hueco de 1200 px — respiro deliberado)
    {id:'ga2', type:'heli_bajo',  x:6800, yPct:0.47},
    {id:'g10', type:'perrero',    x:7050 },                    // aire + suelo a la vez

    // ── D · presión ──
    {id:'g11', type:'ladron',     x:7800 },
    {id:'g12', type:'oficinista', x:8000 },
    {id:'ga3', type:'heli_bajo',  x:8350, yPct:0.52},
    {id:'g13', type:'perrero',    x:8900 },
    {id:'g14', type:'ladron',     x:9100 },
    {id:'g15', type:'ladron',     x:9300 },

    // ── E · clímax terrestre ──
    {id:'ga4', type:'heli_bajo',  x:9900, yPct:0.48},
    {id:'g16', type:'oficinista', x:10200},
    {id:'g17', type:'perrero',    x:10420},
    {id:'g18', type:'ladron',     x:10640},
    {id:'g19', type:'perrero',    x:11050},
    {id:'g20', type:'oficinista', x:11280},
    {id:'ga5', type:'heli_bajo',  x:11400, yPct:0.50},

    // ── F · valle: nada entre 11400 y el despegue ──
  ];

  // ── Spawns aéreos — fase vuelo (12143 → 15643 px) ─────
  //
  // Antes eran 9 helicópteros repartidos uniformemente cada ~375 px: la fase
  // de vuelo quedaba un 56% más densa que la de tierra justo donde el jugador
  // es más frágil, y sin ninguna estructura.
  //
  // Ahora son tres oleadas separadas por cielo despejado. Dentro de cada
  // oleada las alturas se abren para obligar a elegir por dónde pasar.
  const AIR_SPAWNS = [
    // Oleada 1 — dos, alturas separadas: se aprende a esquivar
    {id:'a01', type:'helicoptero', x:BG_TOTAL_W+500,  yPct:0.22},
    {id:'a02', type:'helicoptero', x:BG_TOTAL_W+780,  yPct:0.38},
    //            (cielo despejado)
    // Oleada 2 — tres en abanico
    {id:'a03', type:'helicoptero', x:BG_TOTAL_W+1650, yPct:0.16},
    {id:'a04', type:'helicoptero', x:BG_TOTAL_W+1870, yPct:0.30},
    {id:'a05', type:'helicoptero', x:BG_TOTAL_W+2090, yPct:0.44},
    //            (cielo despejado)
    // Oleada 3 — el muro final antes de la veterinaria
    {id:'a06', type:'helicoptero', x:BG_TOTAL_W+2950, yPct:0.20},
    {id:'a07', type:'helicoptero', x:BG_TOTAL_W+3120, yPct:0.34},
  ];

  return {
    ASSET_BASE, WORLD, PHASE, PLAYER,
    BACKGROUNDS, BACKGROUND_SEGMENTS, BG_WIDTHS,
    PLATFORMS, OBSTACLES, TOYS, GROUND_SPAWNS, AIR_SPAWNS,
  };
})();
