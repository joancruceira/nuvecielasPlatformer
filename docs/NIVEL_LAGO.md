# 🌊 NIVEL 5 — "Atravesando el Lago" · Documento de Level Design

> **Rol:** Senior Level Design — plataformas 2D.
> **Estado:** este documento describe el nivel **tal como está construido hoy**, no una propuesta.
> Cada número que aparece acá está leído del código, no estimado. Lo que falta o no cierra está
> en el [Anexo](#anexo--honestidad-técnica), separado a propósito.
> **Dónde vive:** [`js/level5.js`](../js/level5.js) (mapa y física) ·
> [`js/lago.js`](../js/lago.js) (agua, géiseres, burbujas, corrientes, almejas, paisaje) ·
> [`js/enemies/enemies_level5.js`](../js/enemies/enemies_level5.js) (los cinco habitantes).
> **Medidas:** 180 tiles de ancho × 16 de alto · TILE = 48 px · sin boss.

---

## 1. Concepto — "El agua te mueve a vos"

En los cuatro niveles anteriores **lo único que empuja a la jugadora es la jugadora**. Ella corre,
ella salta, ella se desliza; el mundo es quieto y reacciona. El lago rompe eso, y ése es todo el
nivel:

> ### El verbo nuevo: **ser llevada.**
> El géiser te sube. La burbuja te sube más despacio. La corriente te arrastra hacia atrás, o te
> regala velocidad. El cardumen te empuja al pasar. Por primera vez el escenario tiene voluntad,
> y aprender el nivel es aprender a **usar** esa voluntad en vez de pelearla.

El corazón técnico de esa idea está en una decisión de una línea, en `lago.js`: **todo empuje se
aplica con `Math.min` sobre `vy`, nunca como posición**. El agua te *sostiene*, no te secuestra.
Podés nadar más rápido que el géiser si querés; lo que no puede pasar es que el agua te hunda
mientras estás adentro. Un chico que quiere subir, sube. Uno que se queda flotando, también.

Y por eso el sistema corre **después** de `Player.update()` y sólo toca velocidad: el empuje lo
integra la jugadora en el frame siguiente con su propia colisión, así que es imposible que el agua
la meta dentro de una pared.

**No hay barra de oxígeno.** A propósito. En el nivel donde queremos que exploren, las burbujas son
un regalo y no una cuenta regresiva. Una barra de aire convierte cada segundo de curiosidad en un
segundo de castigo — es exactamente lo contrario de lo que este nivel quiere.

---

## 2. Las cuatro reglas que el lago rompe

El lago es el nivel de las excepciones, y todas están puestas juntas a propósito: se juega distinto
porque *es* distinto, no porque tenga bichos nuevos.

| Regla de los 4 niveles anteriores | Qué hace el lago |
|---|---|
| Saltás una vez y esperás a caer | **Brazada infinita.** Cada toque de salto es `vy = -300`, sin coyote time ni jump buffer: en el agua no hay bordes de los que caerse |
| Si lo pisás, lo matás | **El cangrejo está blindado arriba.** Pisarlo lastima. Es el enemigo que rompe el reflejo aprendido en cuatro niveles |
| Todo enemigo se puede vencer | **Tres de cinco son invencibles** (`hp: 999`): medusa, tiburón y cardumen. No son obstáculos con vida, son geografía que se mueve |
| El nivel termina cuando cae el boss | **No hay boss.** `winCondition: 'reachPortal'` — el portal está abierto desde el primer frame. El lago no es una pelea, es un cruce |

---

## 3. La física del agua

Declarada en `Level5.data.physics` y leída por `player.js` vía `Engine.getLevelData().physics`.

| | Tierra | Lago | Efecto real |
|---|---|---|---|
| `gravity` | 1340–1450 (según la Nuveciela) | **320** | Caés ~4× más lento. Hay tiempo de corregir en el aire |
| `maxFall` | 900 | **250** | Nunca te precipitás: se hunde, no se cae |
| `accel` | 18 en piso / 10 en aire | **6.0** | Arrancar y frenar cuesta. El agua tiene inercia |
| `hDrag` | — | **0.65** | Tope horizontal al 65 %: 265–300 px/s pasan a 172–195 |
| `strokeVy` | `jumpForce` −590…−620, una vez | **−300, infinitas veces** | La mitad de fuerza, disponible siempre |

**Consecuencia de diseño que conviene tener presente:** bajo el agua la gravedad y la brazada son
**iguales para todas**. Lo único que sigue distinguiendo a una Nuveciela de otra es su velocidad
horizontal, y el arrastre además acerca ese rango (35 px/s de diferencia en tierra → 23 en agua).
El lago es el nivel más **parejo** del juego: la que peor nada y la que mejor nada están más cerca
que nunca. Eso lo hace el más accesible para la hermana menor — y le quita la ventaja a quien ya
tiene su personaje favorito elegido.

---

## 4. Los cuatro actos

El fondo del lago **no es continuo**: son seis tramos de suelo (`g(0,20) g(24,15) g(45,12) g(62,30)
g(98,25) g(128,50)`) separados por cinco camas de coral punzante, no por vacíos. Es una diferencia
importante: **caerse abajo nunca te mata en este nivel, te lastima**. No hay pozo sin fondo en todo
el lago excepto los dos tiles finales, ya pasado el portal.

| Cama de coral | Tiles | Ancho |
|---|---|---|
| 1 | 20–23 | 4 |
| 2 | 39–44 | 6 |
| 3 | 57–61 | 5 |
| 4 | 92–97 | 6 |
| 5 | 123–127 | 5 |

El 84 % de la fila 13 tiene suelo. El lago se lee como un fondo, no como un abismo.

### ACTO 1 · La bajada (tiles 0–45) — *aprender a flotar, nada castiga todavía*

**9 ⭐ · 2 cardúmenes, 2 cangrejos, 1 medusa.**

La primera lección del nivel es un regalo: **el géiser del tile 18, con una estrella arriba que sólo
se agarra subiendo** (`geiser(18); st(18,4)`). No hay texto, no hay cartel. Hay una columna de
burbujas y algo brillante en el techo, y a los cuatro segundos la jugadora entendió el verbo del
nivel entero sin que nadie le explicara nada.

Después, y en este orden:

1. **El cardumen del 12**, que es lo primero que la toca y **no le hace daño**: la empuja. Primera
   vez en el juego que un bicho se choca y no pasa nada malo. Ahí se aprende que acá el contacto no
   es necesariamente amenaza.
2. **El cangrejo del 12**, abajo, caminando el fondo. Acá alguien va a intentar pisarlo. Va a doler.
   Es el momento más importante del acto y está puesto en el tramo más seguro del nivel a propósito:
   la lección se paga barata.
3. **La almeja del 26 con su perla** (`almeja(26); st(26,11)`): la estrella está justo sobre una boca
   que se abre 2 s y se cierra 1,4 s. Primera vez que el premio pide **tiempo**, no habilidad.
4. **La medusa del 36**, que sube y baja y no se puede matar. Primer obstáculo puramente geográfico.

### ACTO 2 · El jardín de coral (tiles 45–105) — *denso, se explora, muerde*

**14 ⭐ (el acto más rico del nivel) · 3 cangrejos, 3 peces aguja, 2 medusas, 1 cardumen.**

Acá entra el **pez aguja**, el único habitante del lago que *acecha*: está quieto, apuntando, y si
cruzás su línea de vista (±520 px, misma altura ±46) se lanza recto a **620 px/s**. Tiene 0,45 s de
aviso con chispas amarillas antes de salir: la embestida nunca es sorpresa, y ésa es la regla.

El acto está construido sobre **la cueva de techo bajo de los tiles 65–85**: dos filas de roca
maciza arriba, con coral punzante colgando cada tres tiles. Abajo, un laberinto de tres plataformas
a distintas alturas (`p(68,4,10) p(75,4,8) p(81,4,11)`). Es el único tramo del lago con **techo**,
y por eso el único donde la brazada infinita deja de ser una solución universal: subir por reflejo
te clava en el coral. El verbo del nivel se vuelve peligroso justo cuando ya te acostumbraste.

Las 10 estrellas del laberinto están repartidas en dos alturas (filas 7 y 12) a lo largo de los 18
tiles: hay que hacer el recorrido dos veces, o elegir. Y en el medio, **la primera burbuja montable**
(`burbuja(76,10); st(76,4)`) con su premio arriba: el ascensor lento, frágil, que sube a 70 px/s y
revienta a los 14 segundos o contra el primer coral.

Dos almejas más (70 y 84), un géiser (88) con su estrella, y se sale a la cama de coral 4.

**Checkpoint en el tile 63**, justo antes de la cueva.

### ACTO 3 · La fosa (tiles 105–150) — *lo que hay que ver*

**7 ⭐ (el acto más pobre en premios, a propósito) · 4 medusas, 2 cangrejos, 1 pez aguja, 1 cardumen.**

Este acto tiene un solo trabajo y no es jugable.

**En el tile 112 hay una Nuveciela de piedra, hundida en el fondo del lago.** Mide 4,5 tiles de alto
—es lo más grande del nivel después del tiburón— y está anclada por la base al suelo. No tiene
cartel. No dispara una cinemática. No da estrellas. No hay logro por encontrarla. Está ahí, y la
jugadora la va a ver porque **el nivel la obliga a mirarla despacio**:

> La corriente de la fosa (tiles 104–115, filas 4–11) empuja **hacia atrás** a −120 px/s. Es un muro
> blando: se pasa remando. Y la estatua está clavada en la columna 112, en el medio exacto de esa
> corriente, subiendo hasta la fila 8 y media.
>
> No podés atravesar la fosa rápido. Mientras remás contra el agua, lo único que tenés delante es
> una Nuveciela de piedra del tamaño de una casa.

Eso es todo el storytelling del acto, y funciona porque no se anuncia. La cinemática del nivel la
menciona una sola vez —*"Abajo hay algo más: una Nuveciela de piedra, hundida hace muchísimo"*— y
después nunca más. El juego no explica quién es. **No hay que explicarlo.**

El resto del acto acompaña: dos ruinas (106 y 118) a los costados de la estatua, algas, y el único
tramo donde las medusas se juntan (4 en 45 tiles) porque son lo que ilumina.

**Checkpoint en el tile 129.**

### ACTO 4 · El tiburón (tiles 150–180) — *no se pelea: se escapa*

**5 ⭐ · 2 tiburones, 1 medusa. Casi sin adornos.**

Agua abierta. El acto es una fuga, y está armado con tres piezas:

1. **La corriente de regalo** (tiles 130–145, filas 5–10, **+190 px/s**, tope 285). Es la única del
   juego que te da velocidad, y termina exactamente donde empieza la zona de patrulla del primer
   tiburón (tile 144). El agua te escupe dentro del peligro a toda velocidad.
2. **El primer tiburón (tile 158)**, que patrulla 144–172 y mide 180 × 64 px: el bicho más grande
   del juego. No se puede matar (`hp: 999`). Cuando te tiene a tiro embiste a **520 px/s**, con
   0,7 s de aviso en el que se frena y apunta, y un temblor de pantalla cuando decide. Después de
   cada embestida **descansa 2,6 s**: no encadena, deja respirar. Se le escapa, no se le gana.
3. **El segundo tiburón (tile 172)**, que patrulla exactamente **sobre el portal de salida**.

Ese último detalle es el final del nivel y del juego: la puerta está abierta desde el primer frame,
y hay un animal invencible dando vueltas encima. No hay pelea final. Hay que **medir el momento** y
pasar. Un géiser a mano (tile 168) para el último tirón.

---

## 5. El bestiario — cada uno enseña una cosa distinta

Ninguno de los cinco se reusa de los otros niveles, y no es un lujo: en el agua las reglas cambian,
así que los bichos de tierra directamente no significan lo mismo acá.

| | Qué enseña | hp | Tamaño | Números |
|---|---|---|---|---|
| 🦀 **cangrejo** | **Que el reflejo aprendido puede estar mal.** Camina el fondo, blindado arriba | 2 | 68×40 | 46 px/s · patrulla ±5 tiles · levanta las pinzas a 110 px y se frena: avisa antes de doler |
| 🪼 **medusa** | Que hay cosas que sólo se esquivan | 999 | 46×56 | Sube y baja 70–120 px según dónde nació · el resplandor va por código, así que late de verdad |
| 🐟 **aguja** | Que la amenaza puede estar quieta | 1 | 132×26 | Vista ±520 px a ±46 de altura · 0,45 s de aviso · embiste a 620 px/s durante 1,1 s · vuelve a su puesto a 150 px/s |
| 🦈 **tiburón** | Que a veces la respuesta es huir | 999 | **180×64** | Patrulla ±14 tiles a 58 px/s · embiste a 520 px/s con 0,7 s de aviso · 2,6 s de descanso obligatorio |
| 🐠 **cardumen** | Que el contacto no siempre es daño | 999 | 130×80 | **Empuja, no lastima** · 52 px/s · se dispersa cuando te acercás a 150 px y se vuelve a juntar atrás |

**El cardumen resuelto como una sola entidad** merece una nota: son 7 peces dibujados alrededor de
un único objeto, no 7 enemigos. Así el banco se mueve como un solo cuerpo y no hay nada que
sincronizar. Las posiciones de los 7 salen de `EnemyCommon.ruido()`, no de `Math.random()`, así que
cada cardumen del nivel se ve distinto pero **siempre el mismo** entre partidas.

**El cangrejo y el mensaje explícito:** cuando lo pisás, el rebote hacia arriba ya lo hace
`takeDamage`. Lo que agrega el código en ese momento no es física, es **el aviso de por qué no
funcionó**. La regla se enseña en el instante en que se rompe, que es el único momento en que
alguien está prestando atención.

---

## 6. Los objetos del lago

| | Qué hace | Números |
|---|---|---|
| **Géiser** ×4 (18, 88, 132, 168) | Ascensor gratis. La columna llega hasta el primer sólido de arriba, máximo 9 tiles | **−430 px/s** — más rápido que la brazada (−300), así que subir con él es *mejor* que nadar |
| **Burbuja montable** ×4 (76, 120, 142, 162) | Ascensor lento y frágil. El emisor escupe una nueva cada 4,5 s | Sube a **−70 px/s** · vive **14 s** · revienta contra techo, coral, o al salirse por arriba |
| **Almeja** ×3 (26, 70, 84) | Paisaje que muerde. La boca es la mitad de arriba: pasar por al lado no muerde | **2 s abierta, 1,4 s cerrada** · las tres desfasadas para que no muerdan juntas · 1,5 s de enfriamiento |
| **Corrientes** ×2 | Ver abajo | |
| **Paisaje** (17 algas, 11 corales, 2 ruinas, 1 estatua) | Sin lógica. Las algas se mecen desde la base | Anclados **por la base** al piso del tile: ponés una estatua en la fila 12 y queda parada sobre el suelo de la 13, mida lo que mida el sprite |

Las tres estrellas de las almejas (`st(26,11)`, `st(70,11)`, `st(84,11)`) están todas sobre la boca:
el patrón se enseña una vez y se cobra tres.

**Los géiseres y las burbujas siempre llevan premio arriba** (`st(18,4)`, `st(88,4)`, `st(132,4)`,
`st(76,4)`, `st(120,3)`, `st(142,3)`, `st(162,3)`). Sin excepción, en los ocho casos. Es una promesa
que el nivel nunca rompe: **si algo te sube, arriba hay algo.**

### Las dos corrientes, que hacen cosas opuestas a propósito

```
  tiles 104 ─────── 115              tiles 130 ─────── 145
   ◄◄◄  −120 px/s                     +190 px/s  ►►►
   "muro blando: remá"                "regalo: agarrate"
   (la fosa, la estatua)              (justo antes del tiburón)
```

Es el mismo sistema con el signo cambiado, y significa dos cosas distintas porque está puesto en
dos lugares distintos. Una te **frena donde queremos que mires**; la otra te **acelera donde
queremos que corras**. Nada más que eso, y el nivel entero de la mitad para adelante se apoya ahí.

El empuje está topeado en `|vx| × 1.5` y se aplica a 2,4× por segundo: **es una corriente, no una
catapulta**. El tope deja que la jugadora siga siendo la que manda si rema en contra — incluso en
la fosa, donde el diseño quiere que le cueste, nunca deja de poder avanzar.

Y no se dibuja ningún rectángulo: el agua en movimiento se cuenta **sólo con las motas
arrastrándose**. Pintar la zona dejaba una caja celeste con bordes rectos flotando en el agua, que
se lee como un error de dibujo y no como una corriente.

---

## 7. Curva, ritmo y muerte

```
Intensidad
  ▲                                                      ████ TIBURÓN
  │              ████ cueva 65-85                       ██████
  │        ██ aguja    ██████ laberinto    ▂▂ la fosa   ████████
  │  ▁▁ la bajada     ████████            (silencio)   ██████████
  └───────────────────────────────────────────────────────────────▶
    0        45                105              150          180
    regalo   acecho   técnica + techo bajo   VALLE + historia   fuga
     9⭐         14⭐                    7⭐              5⭐
```

**El valle está diseñado.** La fosa es el tramo con menos premios de todo el nivel (7 ⭐ en 45 tiles,
contra 14 en los 60 anteriores) y su única amenaza real es una corriente que no mata. Eso no es un
bajón de diseño: es el silencio que hace que el tiburón se sienta enorme. El pico final viene del
silencio, no del ruido continuo.

**La cantidad de estrellas cae acto por acto** (9 → 14 → 7 → 5) y eso es correcto: el acto 2 es para
explorar, el 3 para mirar, el 4 para **no parar**. Poner coleccionables en el tramo del tiburón
sería pedirle a la jugadora que se quede justo donde le dijimos que huya.

**Muerte barata:** 2 checkpoints (tiles 63 y 129), uno antes de la cueva y uno antes de la fosa.
Y el detalle que más importa: **en el lago casi no se puede morir de caída**. El 84 % del fondo es
suelo y el resto es coral que lastima. Es el nivel más perdonador del juego, en el nivel donde
queremos que prueben cosas.

**El piso de habilidad es bajo y el techo es alto:** cruzar el lago es accesible (portal abierto
desde el frame 1, sin boss, física pareja entre personajes, caídas que no matan); las 35 estrellas
piden aprender el ritmo de las almejas, el timing de las burbujas de 14 segundos, y pasar dos veces
por el laberinto.

---

## 8. Por qué se va a recordar este nivel

No por el tiburón. Por **la estatua**.

Cuatro niveles de travesuras: un castillo embrujado, un sendero de noche eterna, un castillo
congelado. Todas reversibles, todas con un culpable al final al que se le gana. Y en el quinto, en
el fondo de un lago, sin cartel y sin música especial, **hay una Nuveciela de piedra que nadie
salvó**.

El nivel no dice quién es. No da un premio por encontrarla. Sólo pone una corriente en contra para
que la jugadora tenga que quedarse ahí un rato, mirándola, remando.

Eso es lo que va a quedar.

---

## Anexo · Honestidad técnica

### Implementado y andando

| Elemento | |
|---|---|
| Física subacuática completa (`physics.swim`) leída por `player.js` | ✅ |
| Brazada infinita, sin coyote/buffer | ✅ |
| Géiseres, burbujas montables, almejas con ciclo, corrientes | ✅ `lago.js` |
| Paisaje anclado por la base (coral, alga, ruina, estatua) | ✅ |
| Los 5 habitantes con sus máquinas de estado y sprites | ✅ `enemies_level5.js` |
| Cangrejo blindado arriba + aviso al pisarlo | ✅ |
| `winCondition: 'reachPortal'` (sin esto el nivel era **imposible de terminar**) | ✅ corregido |
| Aleatoriedad determinista (`EnemyCommon.ruido` / `fase`) en medusas y cardúmenes | ✅ |
| Cinemática de entrada (`cin_nivel5`) | ✅ con gradiente, sin arte propio todavía |

### Lo que no cierra

| | Estado |
|---|---|
| **Dos estrellas pisadas por otros tiles.** Se llaman 37 `st()` y sobreviven 35: el `aguja(74,7)` se come la estrella de la fila 7 columna 74, y el `almeja(84)` se come la de la fila 12 columna 84. No rompe nada, pero el conteo de completista no es el que dice el código | 🐛 Arreglo trivial: mover esas dos estrellas una fila |
| **El acto 3 está documentado en el código como "oscuro, medusas que iluminan", pero `dark: false`.** El resplandor de la medusa existe y late, pero la fosa se ve igual que el resto del lago: la lectura de "acá abajo no se ve" no está | 🔧 Decisión pendiente: o `dark` por zona, o sacar la promesa del comentario |
| **La zona de patrulla del tiburón del 172 llega al tile 186**, seis tiles más allá del mapa (180). Nada se rompe, pero el bicho más grande del juego puede irse a nadar fuera de la pantalla | 🔧 Acotar `zonaR` al ancho del mapa |
| **`cangrejo(140,12)` está escrito bajo el encabezado del ACTO 4** pero cae en territorio del acto 3 (el límite es 150). Es prolijidad de código, no de juego | 🧹 Mover la línea |
| **Lunaria pierde su flotación en el lago.** `ch.canFloat` está explícitamente desactivado bajo el agua (`!isWater && ch.canFloat`). Defendible —la brazada infinita ya es flotar— pero es la única Nuveciela que se queda sin su habilidad distintiva, y en ninguna parte está escrito que sea a propósito | ❓ Confirmar que es la decisión buscada |
| **Arte de la cinemática del nivel 5.** Hoy usa un gradiente `#082f49 → #0284c7` en lugar de una ilustración | 🎨 Assets |
| **Sin secretos ni cofre.** Los otros niveles tienen escondites que premian a distintos tipos de jugadora; el lago tiene 35 estrellas y nada más. La estatua es el único "hallazgo" y no da nada (lo cual está bien) — pero falta al menos un secreto de verdad | 🎯 Diseño pendiente |

### Nota sobre el determinismo

Las medusas y los cardúmenes del lago usan `EnemyCommon.ruido()` y `EnemyCommon.fase()` en lugar de
`Math.random()`, así que el nivel entero es **reproducible**: la misma partida da los mismos
resultados frame por frame. Eso importa menos para quien juega que para nosotros — es lo que permite
comparar el comportamiento de los bichos antes y después de un refactor y saber si lo rompimos.

Las burbujitas de clima y los chorros de los géiseres **sí** usan `Math.random()`, y está bien: son
puramente visuales y no tocan nada que se pueda medir.
