// ═══════════════════════════════════════════════════════
//  ASSET_LOADER.JS — Carga lazy de assets por nivel
//  Cargá este archivo ANTES de renderer.js y enemies.js.
//
//  En lugar de cargar todos los sprites al inicio,
//  cada nivel declara exactamente qué necesita.
//  Al cambiar de nivel se liberan los del anterior.
//
//  Uso:
//    AssetLoader.load(levelIdx, onProgress, onReady)
//    AssetLoader.get(key)   → Image | null
//    AssetLoader.unload(levelIdx)
// ═══════════════════════════════════════════════════════

const AssetLoader = (() => {

  // ── Registro de imágenes cargadas ────────────────────
  const _cache = {};          // key → Image
  let _currentLevel = -1;

  // ── Manifest por nivel ────────────────────────────────
  // Cada array lista los paths de imagen sin extensión.
  // La extensión se infiere (.png por defecto, .jpg si termina en _jpg).
  // Los assets 'shared' se cargan en todos los niveles.

  const SHARED = [
    // UI / personajes — siempre necesarios
    { key:'nuveciela',   src:'img/nuveciela.png'   },
    { key:'ciela',       src:'img/ciela.png'        },
    { key:'lunaria',     src:'img/lunaria.png'      },
    { key:'nuve',        src:'img/nuve.png'         },
    // Efectos comunes
    { key:'castle_bg',   src:'img/castle_bg.jpg'   },
  ];

  const MANIFEST = {

    // ── Nivel 0 — Bosque Mágico ──────────────────────
    0: [
      { key:'bosqueMagico01', src:'img/bosqueMagico01.png' },
      { key:'bosqueMagico02', src:'img/bosqueMagico02.png' },
      { key:'bosqueMagico03', src:'img/bosqueMagico03.png' },
      // Enemigos nivel 1
      { key:'walker_idle0',   src:'img/walker_idle0.png'   },
      { key:'walker_idle1',   src:'img/walker_idle1.png'   },
      { key:'walker_hit',     src:'img/walker_hit.png'     },
      { key:'walker_attack',  src:'img/walker_attack.png'  },
      { key:'serpiente_idle0',src:'img/serpiente_idle0.png'},
      { key:'serpiente_idle1',src:'img/serpiente_idle1.png'},
      { key:'serpiente_attack',src:'img/serpiente_attack.png'},
      { key:'serpiente_walk0',src:'img/serpiente_walk0.png'},
      { key:'serpiente_walk1',src:'img/serpiente_walk1.png'},
      { key:'serpiente_walk2',src:'img/serpiente_walk2.png'},
      { key:'alien',          src:'img/alien.png'          },
      // Mecánicas nivel 1
      { key:'caja_cerrada', src:'img/caja_cerrada.png' },
      { key:'caja_abierta', src:'img/caja_abierta.png' },
      { key:'gatito',       src:'img/gatito.png'       },
    ],

    // ── Nivel 1 — Castillo de Nuveciela ──────────────
    1: [
      { key:'back_castlenc01', src:'img/back_castlenc01.png' },
      { key:'back_castlenc02', src:'img/back_castlenc02.png' },
      { key:'back_castlenc03', src:'img/back_castlenc03.png' },
      { key:'candelabro01',    src:'img/candelabro01.png'    },
      // Enemigos nivel 2
      { key:'fantasma_idle0',  src:'img/fantasma_idle0.png'  },
      { key:'fantasma_idle1',  src:'img/fantasma_idle1.png'  },
      { key:'fantasma_attack', src:'img/fantasma_attack.png' },
      { key:'fantasma_hit',    src:'img/fantasma_hit.png'    },
      // Mecánicas nivel 2
      { key:'magicdoor',       src:'img/magicdoor.png'       },
      { key:'magicdoor_open',  src:'img/magicdoor_open.png'  },
    ],

    // ── Nivel 2 — Sendero Nocturno ───────────────────
    2: [
      { key:'back_sendero01', src:'img/back_sendero01.png' },
      { key:'back_sendero02', src:'img/back_sendero02.png' },
      { key:'back_sendero03', src:'img/back_sendero03.png' },
      { key:'cueva_cerrada',  src:'img/cueva_cerrada.png'  },
      { key:'cueva_abierta',  src:'img/cueva_abierta.png'  },
      // Enemigos nivel 3 — nombres reales: walk0.png, walk01.png, walk02.png...
      ...['0','01','02','03'].map(s=>({key:`oruga_walk${s}`,    src:`img/level3/oruga_walk${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`oruga_attack${s}`,  src:`img/level3/oruga_attack${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`oruga_damage${s}`,  src:`img/level3/oruga_damage${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`oruga_death${s}`,   src:`img/level3/oruga_death${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`arbusto_idle${s}`,  src:`img/level3/arbusto_idle${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`arbusto_damage${s}`,src:`img/level3/arbusto_damage${s}.png`})),
      ...['0','01','02'].map(s=>    ({key:`arbusto_death${s}`,  src:`img/level3/arbusto_death${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`murcielago_fly${s}`,    src:`img/level3/murcielago_fly${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`murcielago_attack${s}`, src:`img/level3/murcielago_attack${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`murcielago_damage${s}`, src:`img/level3/murcielago_damage${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`murcielago_death${s}`,  src:`img/level3/murcielago_death${s}.png`})),
      ...['0','01','02'].map(s=>({key:`cienpies_walk${s}`,   src:`img/level3/cienpies_walk${s}.png`})),
      ...['0','01','02'].map(s=>({key:`cienpies_attack${s}`, src:`img/level3/cienpies_attack${s}.png`})),
      ...['0','01','02'].map(s=>({key:`cienpies_damage${s}`, src:`img/level3/cienpies_damage${s}.png`})),
      ...['0','01'].map(s=>    ({key:`cienpies_death${s}`,   src:`img/level3/cienpies_death${s}.png`})),
    ],

    // ── Nivel 3 — Castillo de Ciela ──────────────────
    3: [
      // Assets pendientes — agregar cuando estén listos
    ],
  };

  // ── API pública ───────────────────────────────────────

  /**
   * Carga los assets del nivel dado.
   * @param {number} levelIdx
   * @param {function} onProgress (loaded, total) → void
   * @param {function} onReady () → void
   */
  function load(levelIdx, onProgress, onReady) {
    // Liberar nivel anterior si cambió
    if(_currentLevel !== -1 && _currentLevel !== levelIdx) {
      unload(_currentLevel);
    }
    _currentLevel = levelIdx;

    const items = [...SHARED, ...(MANIFEST[levelIdx] || [])];

    // Filtrar los que ya están en cache
    const toLoad = items.filter(item => {
      const cached = _cache[item.key];
      return !cached || !cached.complete || !cached.naturalWidth;
    });

    if(toLoad.length === 0) { onReady && onReady(); return; }

    let loaded = 0;
    const total = toLoad.length;

    for(const item of toLoad) {
      const img = new Image();
      img.onload = () => {
        loaded++;
        onProgress && onProgress(loaded, total);
        if(loaded >= total) onReady && onReady();
      };
      img.onerror = () => {
        // No bloquear si un asset falla — continuar
        loaded++;
        console.warn(`AssetLoader: no se pudo cargar ${item.src}`);
        onProgress && onProgress(loaded, total);
        if(loaded >= total) onReady && onReady();
      };
      img.src = item.src;
      _cache[item.key] = img;
    }
  }

  /**
   * Libera las imágenes de un nivel (no las shared).
   * @param {number} levelIdx
   */
  function unload(levelIdx) {
    const items = MANIFEST[levelIdx] || [];
    for(const item of items) {
      if(_cache[item.key]) {
        // Vaciar src libera la referencia en memoria
        _cache[item.key].src = '';
        delete _cache[item.key];
      }
    }
  }

  /**
   * Obtiene una imagen cargada por su key.
   * Retorna null si no está lista.
   */
  function get(key) {
    const img = _cache[key];
    return (img && img.complete && img.naturalWidth > 0) ? img : null;
  }

  /**
   * Precarga el nivel siguiente en background (opcional).
   * Llamar cuando el jugador está a 2/3 del nivel actual.
   */
  function preloadNext(levelIdx) {
    const next = levelIdx + 1;
    if(!MANIFEST[next]) return;
    const items = MANIFEST[next];
    for(const item of items) {
      if(_cache[item.key]) continue;
      const img = new Image();
      img.src = item.src;
      _cache[item.key] = img;
    }
  }

  /**
   * Agrega assets a un nivel en runtime (para mods/expansiones).
   */
  function registerAssets(levelIdx, assets) {
    if(!MANIFEST[levelIdx]) MANIFEST[levelIdx] = [];
    MANIFEST[levelIdx].push(...assets);
  }

  return { load, unload, get, preloadNext, registerAssets };

})();