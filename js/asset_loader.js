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
      // ── Ambientación del Bosque Mágico (la maneja bosque.js) ──
      ...[0,1,2,3,4,5].map(i=>({key:`suelo${i}`,       src:`img/bosque/suelo${i}.png`})),
      ...[0,1,2].map(i=>      ({key:`tierra${i}`,      src:`img/bosque/tierra${i}.png`})),
      ...[0,1,2].map(i=>      ({key:`zarza${i}`,       src:`img/bosque/zarza${i}.png`})),
      ...[0,1,2,3,4].map(i=>  ({key:`hongo_salto${i}`, src:`img/bosque/hongo_salto${i}.png`})),
      ...[0,1,2,3,4,5].map(i=>({key:`flor${i}`,        src:`img/bosque/flor${i}.png`})),
      ...[0,1,2,3,4,5].map(i=>({key:`luciernaga${i}`,  src:`img/bosque/luciernaga${i}.png`})),
      ...Array.from({length:12},(_,i)=>({key:`hongo_deco${i}`, src:`img/bosque/hongo_deco${i}.png`})),
      ...Array.from({length:10},(_,i)=>({key:`planta${i}`,     src:`img/bosque/planta${i}.png`})),
      ...[0,1,2,3].map(i=>    ({key:`arbol${i}`,       src:`img/bosque/arbol${i}.png`})),
      // Slime — salta por el bosque
      { key:'slime_idle0', src:'img/slime_idle0.png' },
      { key:'slime_crouch0', src:'img/slime_crouch0.png' },
      { key:'slime_air0', src:'img/slime_air0.png' },
      { key:'slime_land0', src:'img/slime_land0.png' },
      // El flyer (mosquito) — se usa en los niveles 1 y 2
      { key:'flyer_fly0', src:'img/flyer_fly0.png' },
      { key:'flyer_fly1', src:'img/flyer_fly1.png' },
      { key:'flyer_fly2', src:'img/flyer_fly2.png' },
      { key:'flyer_fly3', src:'img/flyer_fly3.png' },
      // Jefe del bosque: el Hongo Gigante (antes cargaba alien.png)
      { key:'hongo_idle0', src:'img/hongo_idle0.png' },
      { key:'hongo_idle01', src:'img/hongo_idle01.png' },
      { key:'hongo_walk0', src:'img/hongo_walk0.png' },
      { key:'hongo_walk01', src:'img/hongo_walk01.png' },
      { key:'hongo_walk02', src:'img/hongo_walk02.png' },
      { key:'hongo_walk03', src:'img/hongo_walk03.png' },
      { key:'hongo_attack0', src:'img/hongo_attack0.png' },
      { key:'hongo_attack01', src:'img/hongo_attack01.png' },
      { key:'hongo_attack02', src:'img/hongo_attack02.png' },
      { key:'hongo_hit0', src:'img/hongo_hit0.png' },
      // Mecánicas nivel 1
      { key:'caja_cerrada', src:'img/caja_cerrada.png' },
      { key:'caja_abierta', src:'img/caja_abierta.png' },
      { key:'gatito',       src:'img/gatito.png'       },
    ],

    // ── Nivel 1 — Castillo de Nuveciela ──────────────
    1: [
      // Araña — cuelga del techo del castillo
      { key:'arana_hang0', src:'img/arana_hang0.png' },
      { key:'arana_hang1', src:'img/arana_hang1.png' },
      { key:'arana_drop0', src:'img/arana_drop0.png' },
      { key:'arana_drop1', src:'img/arana_drop1.png' },
      { key:'flyer_fly0', src:'img/flyer_fly0.png' },
      { key:'flyer_fly1', src:'img/flyer_fly1.png' },
      { key:'flyer_fly2', src:'img/flyer_fly2.png' },
      { key:'flyer_fly3', src:'img/flyer_fly3.png' },
      { key:'back_castlenc01', src:'img/back_castlenc01.png' },
      { key:'back_castlenc02', src:'img/back_castlenc02.png' },
      { key:'back_castlenc03', src:'img/back_castlenc03.png' },
      { key:'candelabro01',    src:'img/candelabro01.png'    },
      // Enemigos nivel 2
      // La serpiente vive acá, no en el Bosque: estaba declarada en el
      // manifest del nivel 0, donde no hay ninguna.
      { key:'serpiente_idle0',src:'img/serpiente_idle0.png'},
      { key:'serpiente_idle1',src:'img/serpiente_idle1.png'},
      { key:'serpiente_attack',src:'img/serpiente_attack.png'},
      { key:'serpiente_walk0',src:'img/serpiente_walk0.png'},
      { key:'serpiente_walk1',src:'img/serpiente_walk1.png'},
      { key:'fantasma_idle0',  src:'img/fantasma_idle0.png'  },
      { key:'fantasma_idle1',  src:'img/fantasma_idle1.png'  },
      { key:'fantasma_attack', src:'img/fantasma_attack.png' },
      { key:'fantasma_hit',    src:'img/fantasma_hit.png'    },
      // Mecánicas nivel 2 — el sprite real que usa MagicDoor.
      // Antes acá figuraban magicdoor.png / magicdoor_open.png, que no
      // existen: daban 404 y un console.warn en cada carga del nivel.
      { key:'puerta_cerrada',  src:'img/puerta_cerrada.png'  },
    ],

    // ── Nivel 2 — Sendero Nocturno ───────────────────
    2: [
      // Enemigos nivel 3 — nombres reales: walk0.png, walk01.png, walk02.png...
      ...['0','01','02','03'].map(s=>({key:`oruga_walk${s}`,    src:`img/level3/oruga_walk${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`oruga_attack${s}`,  src:`img/level3/oruga_attack${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`oruga_damage${s}`,  src:`img/level3/oruga_damage${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`oruga_death${s}`,   src:`img/level3/oruga_death${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`arbusto_idle${s}`,  src:`img/level3/arbusto_idle${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`arbusto_damage${s}`,src:`img/level3/arbusto_damage${s}.png`})),
      ...['0','01','02'].map(s=>    ({key:`arbusto_death${s}`,  src:`img/level3/arbusto_death${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`murcielago_fly${s}`,    src:`img/level3/murcielago_fly${s}.png`})),
      ...['0','01','02'].map(s=>({key:`murcielago_attack${s}`, src:`img/level3/murcielago_attack${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`murcielago_damage${s}`, src:`img/level3/murcielago_damage${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`murcielago_death${s}`,  src:`img/level3/murcielago_death${s}.png`})),
      ...['0','01'].map(s=>       ({key:`lechuza_posado${s}`,     src:`img/level3/lechuza_posado${s}.png`})),
      ...['0','01','02','03'].map(s=>({key:`lechuza_vuelo${s}`,     src:`img/level3/lechuza_vuelo${s}.png`})),
      ...['0','01','02'].map(s=>  ({key:`lechuza_picada${s}`,     src:`img/level3/lechuza_picada${s}.png`})),
      ...['0','01'].map(s=>       ({key:`lechuza_aterrizado${s}`, src:`img/level3/lechuza_aterrizado${s}.png`})),
      ...['0','01'].map(s=>       ({key:`lechuza_grito${s}`,      src:`img/level3/lechuza_grito${s}.png`})),
      ...['0','01'].map(s=>       ({key:`lechuza_damage${s}`,     src:`img/level3/lechuza_damage${s}.png`})),
      ...['0','01','02'].map(s=>  ({key:`lechuza_death${s}`,      src:`img/level3/lechuza_death${s}.png`})),
    ],

    // ── Nivel 3 — Castillo de Ciela ──────────────────
    3: [
      // Assets pendientes — agregar cuando estén listos
    ],

    // ── Nivel 4 — Atravesando el Lago ────────────────
    4: [
      { key:'aguja_dash0', src:'img/level5/aguja_dash0.png' },
      { key:'aguja_dash01', src:'img/level5/aguja_dash01.png' },
      { key:'aguja_death0', src:'img/level5/aguja_death0.png' },
      { key:'aguja_death01', src:'img/level5/aguja_death01.png' },
      { key:'aguja_idle0', src:'img/level5/aguja_idle0.png' },
      { key:'aguja_idle01', src:'img/level5/aguja_idle01.png' },
      { key:'alga0', src:'img/level5/alga0.png' },
      { key:'alga01', src:'img/level5/alga01.png' },
      { key:'alga02', src:'img/level5/alga02.png' },
      { key:'almeja0', src:'img/level5/almeja0.png' },
      { key:'almeja01', src:'img/level5/almeja01.png' },
      { key:'cangrejo_attack0', src:'img/level5/cangrejo_attack0.png' },
      { key:'cangrejo_attack01', src:'img/level5/cangrejo_attack01.png' },
      { key:'cangrejo_damage0', src:'img/level5/cangrejo_damage0.png' },
      { key:'cangrejo_death0', src:'img/level5/cangrejo_death0.png' },
      { key:'cangrejo_death01', src:'img/level5/cangrejo_death01.png' },
      { key:'cangrejo_walk0', src:'img/level5/cangrejo_walk0.png' },
      { key:'cangrejo_walk01', src:'img/level5/cangrejo_walk01.png' },
      { key:'cangrejo_walk02', src:'img/level5/cangrejo_walk02.png' },
      { key:'coral0', src:'img/level5/coral0.png' },
      { key:'coral01', src:'img/level5/coral01.png' },
      { key:'coral02', src:'img/level5/coral02.png' },
      { key:'coral03', src:'img/level5/coral03.png' },
      { key:'coral_punzante0', src:'img/level5/coral_punzante0.png' },
      { key:'coral_punzante01', src:'img/level5/coral_punzante01.png' },
      { key:'estatua0', src:'img/level5/estatua0.png' },
      { key:'medusa_float0', src:'img/level5/medusa_float0.png' },
      { key:'medusa_float01', src:'img/level5/medusa_float01.png' },
      { key:'medusa_float02', src:'img/level5/medusa_float02.png' },
      { key:'medusa_float03', src:'img/level5/medusa_float03.png' },
      { key:'medusa_glow0', src:'img/level5/medusa_glow0.png' },
      { key:'medusa_glow01', src:'img/level5/medusa_glow01.png' },
      { key:'pecesito_swim0', src:'img/level5/pecesito_swim0.png' },
      { key:'pecesito_swim01', src:'img/level5/pecesito_swim01.png' },
      { key:'ruina0', src:'img/level5/ruina0.png' },
      { key:'ruina01', src:'img/level5/ruina01.png' },
      { key:'tiburon_charge0', src:'img/level5/tiburon_charge0.png' },
      { key:'tiburon_charge01', src:'img/level5/tiburon_charge01.png' },
      { key:'tiburon_charge02', src:'img/level5/tiburon_charge02.png' },
      { key:'tiburon_death0', src:'img/level5/tiburon_death0.png' },
      { key:'tiburon_death01', src:'img/level5/tiburon_death01.png' },
      { key:'tiburon_death02', src:'img/level5/tiburon_death02.png' },
      { key:'tiburon_swim0', src:'img/level5/tiburon_swim0.png' },
      { key:'tiburon_swim01', src:'img/level5/tiburon_swim01.png' },
      { key:'tiburon_swim02', src:'img/level5/tiburon_swim02.png' },
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
      const img = _cache[item.key];
      if(!img) continue;
      // Soltar los handlers ANTES de vaciar src. Asignar src='' aborta la
      // descarga en curso y dispara `error`: sin esto, cada cambio de nivel
      // llenaba la consola de "no se pudo cargar" sobre imágenes que estaban
      // perfectamente bien, y adelantaba el contador de progreso.
      img.onload = null;
      img.onerror = null;
      img.src = '';
      delete _cache[item.key];
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