// ═══════════════════════════════════════════════════════
//  SUBNIVEL_NATAN_CONFIG.JS
// ═══════════════════════════════════════════════════════

const SubNivelNatanConfig = (() => {

  const ASSET_BASE = 'img/level3/subnivel/';

  // Anchos DIBUJADOS reales a H=768 (img.naturalWidth * 768/img.naturalHeight)
  // Necesario porque algunas imágenes tienen altura distinta y se escalan diferente
  const BG_WIDTHS  = [1387, 1365, 1446, 1421, 2583, 1286, 1288, 1367];
  const BG_TOTAL_W = BG_WIDTHS.reduce((a,b)=>a+b, 0); // 11697

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

  const BACKGROUNDS = {
    tierra:['fondo0.png','fondo1.png','fondo2.png','fondo3.png',
            'fondo4.png','fondo5.png','fondo6.png','fondo7.png'],
    cielo:'fondo_aire.png',
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
      list.push({id:`t${i}`,x,yPct:0.55+Math.random()*0.18,
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
      list.push({id:`v${i}`,x:BG_TOTAL_W+xOff,yPct:0.20+Math.random()*0.45,
                 icon:tipos[(i+5)%tipos.length],zone:'vuelo',collected:false,score:150});
    });
    return list;
  })();

  // ── Spawns terrestres — toda la fase tierra ───────────
  // ~24 enemigos en 11697px de recorrido
  const GROUND_SPAWNS = [
    {id:'g01',type:'ladron',     x:700  },{id:'g02',type:'oficinista',x:1100 },
    {id:'g03',type:'perrero',    x:1600 },{id:'g04',type:'ladron',    x:2100 },
    {id:'g05',type:'oficinista', x:2600 },{id:'g06',type:'perrero',   x:3100 },
    {id:'g07',type:'ladron',     x:3700 },{id:'g08',type:'oficinista',x:4300 },
    {id:'g09',type:'perrero',    x:4900 },{id:'g10',type:'ladron',    x:5500 },
    {id:'g11',type:'oficinista', x:6100 },{id:'g12',type:'perrero',   x:6700 },
    {id:'g13',type:'ladron',     x:7300 },{id:'g14',type:'oficinista',x:7900 },
    {id:'g15',type:'perrero',    x:8500 },{id:'g16',type:'ladron',    x:9100 },
    {id:'g17',type:'oficinista', x:9700 },{id:'g18',type:'perrero',   x:10300},
    {id:'g19',type:'ladron',     x:10800},{id:'g20',type:'oficinista',x:11200},
    // Helicópteros bajos que atacan en fase tierra
    {id:'ga1',type:'heli_bajo', x:1800, yPct:0.52},
    {id:'ga2',type:'heli_bajo', x:3500, yPct:0.49},
    {id:'ga3',type:'heli_bajo', x:5200, yPct:0.52},
    {id:'ga4',type:'heli_bajo', x:7000, yPct:0.49},
    {id:'ga5',type:'heli_bajo', x:9000, yPct:0.52},
    {id:'ga6',type:'heli_bajo', x:11000,yPct:0.49},
  ];

  // ── Spawns aéreos — fase vuelo ────────────────────────
  const AIR_SPAWNS = [
    {id:'a01',type:'helicoptero', x:BG_TOTAL_W+300,  yPct:0.20},
    {id:'a02',type:'helicoptero', x:BG_TOTAL_W+700,  yPct:0.30},
    {id:'a03',type:'helicoptero', x:BG_TOTAL_W+1100, yPct:0.15},
    {id:'a04',type:'helicoptero', x:BG_TOTAL_W+1400, yPct:0.35},
    {id:'a05',type:'helicoptero', x:BG_TOTAL_W+1800, yPct:0.22},
    {id:'a06',type:'helicoptero', x:BG_TOTAL_W+2200, yPct:0.18},
    {id:'a07',type:'helicoptero', x:BG_TOTAL_W+2600, yPct:0.32},
    {id:'a08',type:'helicoptero', x:BG_TOTAL_W+3000, yPct:0.25},
    {id:'a09',type:'helicoptero', x:BG_TOTAL_W+3300, yPct:0.14},
  ];

  return {
    ASSET_BASE, WORLD, PHASE, PLAYER,
    BACKGROUNDS, BACKGROUND_SEGMENTS, BG_WIDTHS,
    PLATFORMS, OBSTACLES, TOYS, GROUND_SPAWNS, AIR_SPAWNS,
  };
})();
