#!/usr/bin/env node
// ═══════════════════════════════════════════════════════
//  Optimizador de audio de Nuvecielas.
//
//  Los MP3 originales están a 320 kb/s (calidad de masterizado) para música
//  de fondo que se escucha en loop, casi siempre por el parlante de un
//  teléfono y por debajo de los efectos.
//
//  Destino: AAC-LC en .m4a
//    · lo decodifica por HARDWARE todo teléfono moderno (menos batería y
//      menos CPU que Opus, que va por software)
//    · soporte universal: iOS Safari, Chrome, Firefox, Edge
//
//  Uso:  node tools/optimizar-audio.js [--aplicar]
// ═══════════════════════════════════════════════════════
const fs    = require('fs');
const path  = require('path');
const { execFileSync } = require('child_process');
const FF    = require('ffmpeg-static');

const ROOT    = path.join(__dirname, '..');
const DIR     = path.join(ROOT, 'audio');
const APLICAR = process.argv.includes('--aplicar');

// Música de fondo (loops largos) vs efectos (golpes cortos)
const MUSICA = ['cancion_nuve', 'castillo_nuveciela', 'nuvecielas_portada', 'sendero_nocturno'];

const PERFIL = {
  // 96 kb/s AAC-LC ≈ 128 kb/s MP3. De sobra para un loop de fondo.
  musica: ['-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-ac', '2'],
  // Los efectos duran ~1 s y se mezclan con todo: mono a 64k es indistinguible.
  efecto: ['-c:a', 'aac', '-b:a', '64k', '-ar', '44100', '-ac', '1'],
};

const kb = n => (n / 1024).toFixed(0).padStart(6) + ' KB';

const archivos = fs.readdirSync(DIR).filter(f => f.endsWith('.mp3'));
let antes = 0, despues = 0;
const filas = [];

for (const f of archivos) {
  const src  = path.join(DIR, f);
  const base = f.replace(/\.mp3$/, '');
  const dst  = path.join(DIR, base + '.m4a');
  const tipo = MUSICA.includes(base) ? 'musica' : 'efecto';
  const a    = fs.statSync(src).size;

  const tmp = dst + '.tmp.m4a';
  execFileSync(FF, ['-y', '-loglevel', 'error', '-i', src, ...PERFIL[tipo], tmp]);
  const d = fs.statSync(tmp).size;

  if (APLICAR) { fs.renameSync(tmp, dst); fs.unlinkSync(src); }
  else fs.unlinkSync(tmp);

  antes += a; despues += d;
  filas.push({ f: base, tipo, a, d });
}

filas.sort((x, y) => y.a - x.a);
console.log(APLICAR ? '── APLICADO ──' : '── SIMULACIÓN (usá --aplicar) ──');
for (const r of filas)
  console.log(`  ${kb(r.a)} → ${kb(r.d)}  (-${Math.round((1 - r.d / r.a) * 100)}%)  [${r.tipo}]  ${r.f}`);
console.log(`\n  TOTAL ${kb(antes)} → ${kb(despues)}   ahorro ${kb(antes - despues)} (${((1 - despues / antes) * 100).toFixed(1)}%)`);
