#!/usr/bin/env node
// ═══════════════════════════════════════════════════════
//  Inventario de assets: dimensión real vs tamaño dibujado.
//  Uso: node tools/analizar-assets.js
// ═══════════════════════════════════════════════════════
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');

// Alto máximo al que cada grupo se dibuja EN PANTALLA, leído del código.
// Guardamos 2x para pantallas retina y para que el downscale no se note.
const RETINA = 2;

const GRUPOS = [
  // [regex de ruta, alto dibujado en px, nota]
  [/^img\/(nuveciela|ciela|lunaria|nuve)\.png$/,          124, 'jugador: h*1.15*sizeMult(1.5)'],
  [/^img\/walker_/,                                        84, 'walker: h*1.9'],
  [/^img\/alien\.png$/,                                   112, 'boss nivel 1: 96 * scale 1.16'],
  [/^img\/serpiente_/,                                     96, 'serpiente'],
  [/^img\/fantasma_/,                                     160, 'fantasma (boss nivel 2)'],
  [/^img\/(caja_cerrada|caja_abierta)\.png$/,              82, 'giftbox: h*1.7'],
  [/^img\/gatito\.png$/,                                   72, 'gatito'],
  [/^img\/puerta_cerrada\.png$/,                          120, 'puerta mágica: TS*2.5'],
  [/^img\/melli_/,                                        140, 'mellis'],
  [/^img\/candelabro01\.png$/,                            180, 'candelabro'],
  [/^img\/level2\//,                                       48, 'tiles nivel 2: TS'],
  [/^img\/level3\/oruga_/,                                 64, 'oruga'],
  [/^img\/level3\/arbusto_/,                               72, 'arbusto'],
  [/^img\/level3\/murcielago_/,                            40, 'murciélago: H=40'],
  [/^img\/level3\/cienpies_/,                             128, 'ciempiés (boss nivel 3)'],
  [/^img\/level4\/(guardia|gota)_/,                        60, 'caballero/gota nivel 4'],
  [/^img\/level4\/gargola_/,                               56, 'gárgola'],
  [/^img\/level4\/boss_/,                                 128, 'Rey Escarcha'],
  [/^img\/level3\/subnivel\/natan_/,                      104, 'SuperNatan: PLAYER.h'],
  [/^img\/level3\/subnivel\/(helicoptero|ladron|oficinista|perrero)\//, 110, 'enemigos subnivel Natan'],
  [/^img\/level3\/subnivel\/puerta/,                      128, 'puerta cueva: H_DOOR'],
  [/^img\/level3\/subnivel\/veterinaria\.png$/,           400, 'veterinaria'],
  [/^img\/submision\/(nina|jazmin)_/,                      68, 'Nina/Jazmín: ps.h'],
  [/^img\/submision\/(ladron|perrero)_/,                   68, 'enemigos submisión'],
  [/^img\/submision\/enemigo_jefe_/,                       96, 'jefe submisión'],
  [/^img\/submision\/(jaula_pablo|pablo_free)_/,           72, 'Pablo'],
  [/^img\/submision\/gatito_walk/,                         48, 'gatitos'],
  [/^img\/submision\/(tile_|plat_)/,                       48, 'tiles submisión'],
  [/^img\/submision\/prop_/,                              120, 'props submisión'],
  [/^img\/submision\/bus\.png$/,                          160, 'bus'],
];

// Fondos: se dibujan a pantalla completa. Tope razonable 1080p.
const FONDOS = [
  /^img\/bosqueMagico0/, /^img\/back_castlenc0/, /^img\/sendero[012]\.png$/,
  /^img\/castle_bg\.jpg$/, /^img\/level4\/fondo_level4\.png$/,
  /^img\/level3\/subnivel\/fondo/, /^img\/submision\/(bg_rosario2|cielo_lejano|fondo_rosario)\./,
  /^img\/cinematica1_/, /^img\/FLYER_/,
];
const ALTO_FONDO_MAX = 1080;

function clasificar(rel) {
  for (const [re, alto, nota] of GRUPOS) if (re.test(rel)) return { tipo: 'sprite', altoObjetivo: alto * RETINA, nota };
  for (const re of FONDOS)               if (re.test(rel)) return { tipo: 'fondo',  altoObjetivo: ALTO_FONDO_MAX, nota: 'fondo pantalla completa' };
  return { tipo: 'sin-clasificar', altoObjetivo: null, nota: '' };
}

(async () => {
  const usadas = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').filter(Boolean);
  const filas = [];
  for (const rel of usadas) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const bytes = fs.statSync(abs).size;
    let meta;
    try { meta = await sharp(abs).metadata(); } catch (e) { continue; }
    const c = clasificar(rel);
    const necesitaResize = c.altoObjetivo && meta.height > c.altoObjetivo * 1.15;
    filas.push({ rel, w: meta.width, h: meta.height, bytes, alpha: meta.hasAlpha,
                 ...c, necesitaResize });
  }
  const fmt = n => (n/1024/1024).toFixed(2) + ' MB';
  const total = filas.reduce((a,f) => a+f.bytes, 0);
  const aResize = filas.filter(f => f.necesitaResize);
  const sinClasificar = filas.filter(f => f.tipo === 'sin-clasificar');

  console.log(`Analizadas: ${filas.length}  ·  total ${fmt(total)}`);
  console.log(`Necesitan resize: ${aResize.length}  ·  ${fmt(aResize.reduce((a,f)=>a+f.bytes,0))}`);
  console.log(`Sin clasificar:   ${sinClasificar.length}`);
  if (sinClasificar.length) sinClasificar.forEach(f => console.log('   ? ' + f.rel));
  console.log('\n── Top 20 por desperdicio ──');
  aResize.sort((a,b) => b.bytes - a.bytes).slice(0,20).forEach(f => {
    const factor = (f.h / f.altoObjetivo).toFixed(1);
    console.log(`  ${String(f.w+'x'+f.h).padEnd(11)} → alto ${String(f.altoObjetivo).padEnd(5)} (${factor}x)  ${fmt(f.bytes).padStart(9)}  ${f.rel}`);
  });
  fs.writeFileSync(path.join(__dirname, 'plan.json'), JSON.stringify(filas, null, 1));
  console.log('\nPlan escrito en tools/plan.json');
})();
