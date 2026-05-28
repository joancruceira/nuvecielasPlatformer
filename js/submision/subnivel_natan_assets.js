// ═══════════════════════════════════════════════════════
//  SUBNIVEL_NATAN_ASSETS.JS — Carga de imágenes.
// ═══════════════════════════════════════════════════════

const SubNivelNatanAssets = (() => {
  const C = SubNivelNatanConfig;
  const _imgs = new Map();

  function _load(key, src) {
    if (_imgs.has(key)) return;
    const img = new Image();
    img.src = src;
    _imgs.set(key, img);
  }

  function preload() {
    // Fondos tierra — 8 segmentos
    C.BACKGROUNDS.tierra.forEach((file, i) => {
      _load(`bg_tierra_${i}`, C.ASSET_BASE + file);
    });
    // Fondo cielo
    _load('bg_cielo', C.ASSET_BASE + C.BACKGROUNDS.cielo);

    const base = C.ASSET_BASE;

    // Natan — run, fly, attack, hurt, landing, idle (run0 sirve de idle)
    for (let i = 0; i < 6; i++) _load(`natan_run${i}`,     `${base}natan_run${i}.png`);
    for (let i = 0; i < 4; i++) _load(`natan_fly${i}`,     `${base}natan_fly${i}.png`);
    for (let i = 0; i < 4; i++) _load(`natan_attack${i}`,  `${base}natan_attack${i}.png`);
    for (let i = 0; i < 3; i++) _load(`natan_hurt${i}`,    `${base}natan_hurt${i}.png`);
    for (let i = 0; i < 2; i++) _load(`natan_landing${i}`, `${base}natan_landing${i}.png`);
    // idle = alias de run0 (parado en frame 0, no anima)
    _load('natan_idle', `${base}natan_run0.png`);
  }

  function get(key) {
    const img = _imgs.get(key);
    return (img && img.complete && img.naturalWidth > 0) ? img : null;
  }

  return { preload, get };
})();
