// ═══════════════════════════════════════════════════════
//  PLAYER_CHARACTERS.JS — Definición de personajes
//  Cargá este archivo ANTES de player.js.
//
//  Cada personaje define:
//  - Stats de movimiento (speed, gravity, jump, slide)
//  - Habilidades especiales (flags)
//  - Proyectil propio (projectileDef) — player.js lo usa
//    genéricamente sin if/else por personaje
//
//  Para agregar un personaje nuevo:
//  1. Agregarlo acá con sus stats y projectileDef
//  2. Agregar su imagen en img/
//  3. Listo — player.js y engine.js no necesitan cambios
// ═══════════════════════════════════════════════════════

const CHARACTERS = {

  nuveciela: {
    label:   'Nuveciela',
    ability: 'Doble salto + Bola de fuego',
    desc:    'Doble salto alto. ← ← lanza bola de fuego.',
    color:   '#a78bfa',
    img:     'img/nuveciela.png',

    // ── Stats de movimiento ───────────────────────────
    speed:        280,
    jumpForce:   -620,
    dblJumpForce:-580,
    gravity:     1380,
    slideSpeed:   420,

    // ── Habilidades especiales ────────────────────────
    // Nuveciela usa el sistema de fireballs separado (tryFireball)
    // Sus proyectiles son fireballs, no el sistema genérico
    usesFireball: true,
    fireballCooldown: 0.55,
  },

  ciela: {
    label:   'Ciela',
    ability: '← ← Bola de hielo',
    desc:    'Deslizamiento veloz. ← ← congela enemigos 2s.',
    color:   '#38bdf8',
    img:     'img/ciela.png',

    speed:        300,
    jumpForce:   -590,
    dblJumpForce:-490,
    gravity:     1400,
    slideSpeed:   560,

    // ── Proyectil ─────────────────────────────────────
    projectileDef: {
      kind:     'ice',
      vxMult:   520,    // se multiplica por facing (-1 o 1)
      vy:       -20,
      r:        10,
      life:     1.8,
      color:    '#7dd3fc',
      cooldown: 0.7,
      particleColor: '#bae6fd',
      particleCount: 8,
    },
  },

  lunaria: {
    label:   'Lunaria',
    ability: '← ← Rayo de luz',
    desc:    'Flotación mágica. ← ← dispara rayo que quema.',
    color:   '#fbbf24',
    img:     'img/lunaria.png',

    speed:        270,
    jumpForce:   -600,
    dblJumpForce:-480,
    gravity:     1360,
    slideSpeed:   380,

    // ── Habilidad especial: flotación ─────────────────
    canFloat:    true,
    floatGravity: 240,
    floatDuration: 1.5,

    // ── Proyectil ─────────────────────────────────────
    projectileDef: {
      kind:     'ray',
      vxMult:   700,
      vy:       0,       // sin gravedad
      r:        8,
      life:     1.2,
      color:    '#fde68a',
      cooldown: 0.6,
      particleColor: '#fde68a',
      particleCount: 10,
    },
  },

  nuve: {
    label:   'Nuve',
    ability: 'Volar + ← ← Bolas de colores',
    desc:    '↑↑ para volar. ← ← dispara bolas de colores.',
    color:   '#f97316',
    img:     'img/nuve.png',

    speed:        265,
    jumpForce:   -600,
    dblJumpForce:-490,
    gravity:     1450,
    slideSpeed:   380,

    // ── Habilidades especiales ────────────────────────
    canFly:            true,
    canGroundPound:    true,
    groundPoundRadius: 110,

    // ── Proyectil (bolas de colores — usa colorIdx) ───
    projectileDef: {
      kind:         'colorball',
      vxMult:       450,
      vyRandom:     80,   // vy = (random-0.5) * vyRandom
      r:            10,
      life:         2.0,
      color:        null, // se calcula en runtime con NUVE_COLORS[colorIdx]
      cooldown:     0.45,
      particleCount: 8,
    },
    colorPalette: ['#f97316','#a78bfa','#38bdf8','#4ade80','#f9c846','#f472b6'],
  },

  // ════════════════════════════════════════════════════
  //  PERSONAJES FUTUROS — agregar acá
  // ════════════════════════════════════════════════════

  // supernatan: {
  //   label:   'SuperNatan',
  //   ability: 'Volar libremente',
  //   desc:    'Niño superhéroe. Vuela sin límite. Lleva a Cleopatra.',
  //   color:   '#3b82f6',
  //   img:     'img/supernatan.png',
  //   speed:        300,
  //   jumpForce:   -650,
  //   dblJumpForce:-600,
  //   gravity:     1200,
  //   slideSpeed:   350,
  //   canFly:       true,
  //   flyUnlimited: true,   // a diferencia de Nuve, vuela sin límite de vy
  //   carrier:      true,   // lleva a Cleopatra — modifica hitbox y animación
  //   projectileDef: {
  //     kind:     'star',
  //     vxMult:   500,
  //     vy:       -30,
  //     r:        10,
  //     life:     1.5,
  //     color:    '#fbbf24',
  //     cooldown: 0.5,
  //     particleColor: '#fbbf24',
  //     particleCount: 8,
  //   },
  // },

};