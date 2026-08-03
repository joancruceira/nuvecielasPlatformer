#!/usr/bin/env node
// ═══════════════════════════════════════════════════════
//  Optimizador de assets de Nuvecielas.
//
//  Reglas:
//   · sprite  → redimensionar a 2x el alto al que se dibuja + PNG con paleta
//   · fondo   → tope 1080px de alto
//               · sin alpha → JPEG q82 (son fotográficos, PNG es un desperdicio)
//               · con alpha → PNG con paleta (son capas de parallax)
//
//  Uso:  node tools/optimizar-assets.js [--aplicar]
//        Sin --aplicar sólo simula y reporta.
// ═══════════════════════════════════════════════════════
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const ROOT    = path.join(__dirname, '..');
const APLICAR = process.argv.includes('--aplicar');
const plan    = require('./plan.json');

const fmt = n => (n / 1048576).toFixed(2).padStart(7) + ' MB';

(async () => {
  let antes = 0, despues = 0, tocados = 0;
  const renombrados = [];   // [viejo, nuevo] cuando cambia la extensión
  const errores = [];

  for (const f of plan) {
    const abs = path.join(ROOT, f.rel);
    if (!fs.existsSync(abs)) continue;
    antes += f.bytes;

    const esFondoOpaco = f.tipo === 'fondo' && !f.alpha;
    const alto = f.altoObjetivo;
    const necesitaEscalar = alto && f.h > alto * 1.15;

    // Nada que hacer: ya está en tamaño y ya es JPEG (o es un PNG chico con alpha)
    if (!necesitaEscalar && !esFondoOpaco && f.bytes < 60 * 1024) { despues += f.bytes; continue; }

    try {
      let img = sharp(abs);
      if (necesitaEscalar) img = img.resize({ height: alto, fit: 'inside', kernel: 'lanczos3' });

      let destino = abs, buf;
      if (esFondoOpaco && path.extname(abs).toLowerCase() !== '.jpg') {
        destino = abs.replace(/\.(png|jpeg)$/i, '.jpg');
        buf = await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      } else if (esFondoOpaco) {
        buf = await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      } else {
        // Sprites y capas con alpha: PNG con paleta (los dibujos planos
        // quedan casi idénticos y pesan una fracción)
        buf = await img.png({ palette: true, quality: 90, effort: 8 }).toBuffer();
      }

      // Nunca empeorar: si el resultado pesa más y no hubo que escalar, dejar el original
      if (buf.length >= f.bytes && !necesitaEscalar && destino === abs) { despues += f.bytes; continue; }

      if (APLICAR) {
        fs.writeFileSync(destino, buf);
        if (destino !== abs) { fs.unlinkSync(abs); renombrados.push([f.rel, path.relative(ROOT, destino).replace(/\\/g, '/')]); }
      } else if (destino !== abs) {
        renombrados.push([f.rel, path.relative(ROOT, destino).replace(/\\/g, '/')]);
      }
      despues += buf.length;
      tocados++;
    } catch (e) {
      errores.push(f.rel + ': ' + e.message);
      despues += f.bytes;
    }
  }

  console.log(APLICAR ? '── APLICADO ──' : '── SIMULACIÓN (usá --aplicar) ──');
  console.log(`archivos procesados : ${tocados}`);
  console.log(`antes               : ${fmt(antes)}`);
  console.log(`después             : ${fmt(despues)}`);
  console.log(`ahorro              : ${fmt(antes - despues)}  (${((1 - despues/antes) * 100).toFixed(1)}%)`);
  if (renombrados.length) {
    console.log(`\ncambian de extensión (hay que tocar el código): ${renombrados.length}`);
    renombrados.forEach(([a, b]) => console.log(`   ${a}  →  ${b}`));
    fs.writeFileSync(path.join(__dirname, 'renombrados.json'), JSON.stringify(renombrados, null, 1));
  }
  if (errores.length) { console.log('\nerrores:'); errores.forEach(e => console.log('   ' + e)); }
})();
