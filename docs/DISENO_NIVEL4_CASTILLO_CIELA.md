# ❄️ NIVEL 4 — "El Castillo de la Ciela" · Documento de Level Design

> **Rol:** Senior Level Design — plataformas 2D (escuela Nintendo: Wonder / Tropical Freeze / Rayman Legends).
> **Estado:** documento de diseño para el equipo. **Sin código.**
> **Restricciones respetadas:** motor actual (tilemap horizontal, 16 tiles de alto, TILE=48px),
> solo los 3 enemigos existentes + Rey Escarcha, solo las mecánicas existentes.
> **Hallazgo clave del motor** (ya implementado, hoy subutilizado): la **gota congelada es un
> bloque de hielo EMPUJABLE**, y la **gárgola congelada CAE** y queda como plataforma (y rompe
> pinchos al caer). Estas dos físicas son el corazón del rediseño.

---

## 1. Concepto general — "Volver a casa"

**El giro emocional que lo cambia todo:** este castillo no es una mazmorra. **Es la casa de Ciela.**
El jugador no está invadiendo territorio enemigo — está **volviendo a un hogar que conoce y que
alguien le arrebató**. Cada sala congelada debería doler un poquito: *esto era hermoso, acá se
celebraban banquetes, acá vivía gente*.

**Pilar mecánico único (la identidad jugable):**

> ### "El hielo del Rey es tu herramienta."
> El Rey Escarcha congeló el castillo… y Ciela usa **ese mismo hielo en su contra**. Todo el nivel
> enseña, desarrolla y combina UNA idea: **congelar enemigos los convierte en objetos físicos**
> (bloque empujable, plataforma que cae, pilar para escalar). El jugador termina el nivel pensando
> como el Rey — y por eso está listo para vencerlo.

**Estructura kishōtenketsu por zona** (la fórmula Nintendo): cada zona **introduce** una idea en un
espacio seguro → la **desarrolla** con riesgo → la **combina** con lo anterior → y remata con una
**sorpresa** que la da vuelta.

**Dimensiones propuestas:** ampliar de 210 → **310 tiles** de ancho (6 zonas + antesala + arena).
Mismo alto (16). Es un "nivel castillo" largo tipo fortaleza de Tropical Freeze: 6–8 min la primera
vez.

---

## 2. El castillo cuenta la historia (sin diálogos)

Beats de escenografía, en orden. El jugador entiende TODO sin leer una palabra:

| # | Dónde | Qué ve | Qué entiende |
|---|---|---|---|
| 1 | Puente | La **fuente congelada a mitad del chorro**, estandartes de Ciela rígidos de escarcha | "El ataque fue repentino — el tiempo se detuvo" |
| 2 | Puente | Estatuas de gárgola en pedestales (decorativas)… | …que **foreshadowean** a las gárgolas reales de adentro |
| 3 | Gran Salón | La **mesa del banquete servida**, copas y tortas congeladas a medio comer | "Estaban celebrando cuando llegó el Rey" |
| 4 | Biblioteca | Libros caídos, un retrato de **Ciela con sus amigas** cubierto de escarcha | "Esta es SU casa. Esto es personal" |
| 5 | Invernadero | Todo congelado… **salvo UNA flor que aún brilla** | "El castillo sigue vivo. Hay esperanza" |
| 6 | Antesala | **Los habitantes congelados como estatuas** alineados en el pasillo | Resuelve el misterio: "no desaparecieron — están acá" y da el motivo final para ganar |
| 7 | Trono | El Rey Escarcha **sentado en el trono de Ciela** | El insulto final. Ahora es personal para el JUGADOR |
| 8 | Victoria | El hielo se derrite en cascada, el cielo pasa de azul ártico a cálido | El payoff visual de todo el nivel |

*(Implementación: tiles DECO + parallax existente; los "habitantes congelados" son sprites
decorativos estáticos — sin IA ni lógica.)*

---

## 3. Las zonas

### ZONA 1 · El Puente de los Estandartes (tiles 0–35) — *aprender a pisar*
**Identidad:** exterior, tormenta de nieve en el parallax, el castillo enorme al fondo. Silencio.
**Introduce:** suelo de hielo (resbalar) **sin castigo** — el primer tramo helado no tiene fosos:
resbalar acá es gracioso, no mortal. 1 sola gota patrullando el puente para conocerla.
**Desarrolla:** foso corto de carámbanos con plataforma — primer salto real.
**Momento de diseño:** las "estatuas" de gárgola del puente NO se mueven… todavía. Puro presagio.
**Secreto #1:** dejarse caer por un hueco bajo el puente → alcoba con 3 estrellas y salida con
doble salto. Premia al que mira hacia abajo (regla DKC: el primer secreto se regala casi gratis
para enseñar que ESTE nivel esconde cosas).
**Enemigos:** 1 gota. **Ritmo:** valle. **Checkpoint:** no (aún).

### ZONA 2 · El Gran Salón del Banquete (35–95) — *el hielo es tu herramienta*
**Identidad:** salón interior gigante, mesa servida congelada (la mesa = plataformas largas a media
altura), candelabros arriba con estrellas.
**Introduce (LA mecánica):** una gota patrulla frente a un murito que Ciela no alcanza ni con doble
salto. Congelarla → **empujar el bloque de hielo** contra el muro → escalón. Espacio seguro, sin
tiempo límite (la gota descongela: si falla, reintenta — el error enseña la segunda regla: *el
hielo es temporal*).
**Desarrolla:** empujar un bloque-gota **sobre suelo resbaladizo** → el bloque se desliza lejos y
tapa un foso de carámbanos → puente improvisado. (La física de empuje + hielo ya existe: esto es
puro placement.)
**Combina:** el **Guardián del Hielo** aparece como "puerta viviente": patrulla lento frente a la
única salida. No se lo puede romper de frente (tanque). Solución enseñada por el espacio: congelarlo
→ es **alto** → usarlo de pilar y saltarle por encima. El Guardián no es un muro: es una escalera
que camina.
**Sorpresa / WOW #1 — "La mesa pone la mesa":** al cruzar la mitad del salón, tres gotas caen EN
FILA desde el candelabro sobre la mesa (spawn coreografiado). Leíble, gracioso, y de paso deja 3
gotas = 3 bloques potenciales para farmear el acceso a las estrellas altas.
**Enemigos:** 3–4 gotas, 1 guardián. **Ritmo:** sube. **Checkpoint:** al final de la zona.

### ZONA 3 · La Biblioteca de los Recuerdos (95–150) — *el cielo se cae*
**Identidad:** estanterías monumentales = plataformas apiladas en columnas (verticalidad simulada
en 16 tiles: subir-bajar en zigzag). Pasadizos de **slide** entre estantes (techo bajo — mecánica
existente, ahora con narrativa: gatear por los huecos de los libros).
**Introduce:** la **gárgola congelada cae como bloque**. Primera cita diseñada: una gárgola
patrulla sobre un foso de carámbanos intransitable. Congelarla en el momento justo → cae → **rompe
los pinchos** → camino abierto. El "¡AH!" del nivel.
**Desarrolla:** foso ancho con 3 gárgolas a distintas alturas → congelarlas EN ORDEN para que caigan
donde las necesitás como escalones (el timing del disparo de Ciela se vuelve puntería de
construcción).
**Combina:** gárgola + slide: congelar la gárgola que patrulla sobre la entrada del túnel para que
al caer NO te bloquee (aprender que también podés crear el problema).
**Sorpresa / WOW #2 — "La estantería dominó":** al pisar la última repisa, la fila de estanterías
del fondo (decorado) se derrumba en cadena de parallax mientras el suelo tiembla (shake de cámara
existente) y caen 2 gárgolas reales. El escenario "reacciona" al jugador.
**Secreto #2:** un túnel de slide falso (entra por detrás de un retrato) → **Sala de los
Retratos**: cofre regalo + 4 estrellas + el cuadro de Ciela con sus amigas (story beat 4).
**Enemigos:** 4 gárgolas, 1 gota. **Ritmo:** pico técnico. **Checkpoint:** sí, antes del foso grande.

### ZONA 4 · El Invernadero de Cristal (150–185) — *el latido del castillo*
**Identidad:** EL VALLE. Sin enemigos (o 1 gota inofensiva lejos). Cristales, plantas congeladas,
luz distinta (glowing ya soportado). En el centro, **la única flor viva del castillo**, brillando.
**Función de diseño:** respiro emocional antes del asalto final (regla Wonder/Tropical Freeze: el
mejor pico necesita un valle antes). Acá el jugador baja las pulsaciones, explora y absorbe la
historia.
**Coreografía de estrellas:** las estrellas dibujan **la forma de una flor** alrededor de la flor
viva — coleccionarlas es "regar" el lugar. Sin mecánica nueva: es solo placement con intención.
**Secreto #3:** tocar la flor (pasar por su tile) hace brotar 5 estrellas en arco (spawn simple).
El jugador que se acerca a mirar —curiosidad, no habilidad— recibe el premio. Apego puro.
**Enemigos:** 0–1. **Ritmo:** valle profundo. **Checkpoint:** sí (barato, es la calma).

### ZONA 5 · La Escalera del Campanario (185–245) — *el examen*
**Identidad:** ascenso en zigzag (plataformas que suben hacia la derecha, techo que baja: sensación
de torre dentro de las 16 filas), viento visual en parallax, campana congelada arriba del fondo.
**El examen combina TODO sin enseñar nada nuevo** (regla de oro: antes del boss no se introduce
mecánica nueva, se rinde examen):
- tramo 1: hielo resbaladizo + gotas en plataformas angostas (Z1+Z2),
- tramo 2: gárgolas sobre fosos → congelar y usarlas de escalón bajo presión (Z3),
- tramo 3: un guardián en la plataforma clave → pilar-escalera con timing (Z2), con carámbanos abajo.
**Sorpresa / WOW #3 — "La Campanada":** cada ~6 segundos la campana congelada "late" (flash +
shake sutil + sfx grave) y **todas las gárgolas de la zona se lanzan en picada a la vez**. Una
oleada perfectamente leíble y predecible — el jugador aprende a moverse **al ritmo de la campana**
(plataformeo rítmico estilo Tropical Freeze, con spawns coordinados — código ligero, no mecánica
nueva).
**Secreto #4 (atajo):** congelar a la gárgola más alta de la última oleada hace que caiga
rompiendo un suelo de carámbanos que esconde un **pasadizo directo a la antesala** — el atajo se
fabrica con la mecánica estrella. Los que dominan el congelamiento "hackean" el final de la zona.
**Enemigos:** 3 gotas, 4 gárgolas, 1 guardián. **Ritmo:** EL pico. **Checkpoint:** al inicio y al
final de la zona (generosidad Nintendo: el examen nunca se repite entero).

### ZONA 6 · La Antesala + La Sala del Trono (245–310) — *el silencio y la furia*
**Antesala (245–270):** pasillo recto, SIN enemigos, música baja (o silencio). A los costados, los
**habitantes del castillo congelados como estatuas** (story beat 6 — el momento más fuerte del
nivel y cuesta cero mecánicas). Cofre regalo. Última pausa. La puerta del trono al fondo.
**Este pasillo ES la preparación psicológica:** después del caos del campanario, caminar despacio
entre los congelados convierte el miedo en determinación. El jugador no llega agitado — llega
*decidido*.

**La Sala del Trono (270–310):** arena cerrada. El Rey Escarcha **sentado en el trono de Ciela**
(story beat 7) se levanta al entrar el jugador (spawn + flash).

#### El combate — 3 fases que rinden homenaje al nivel
El boss se gana **con las tres lecciones del nivel**, no a golpes:
- **Fase 1 — "Las gotas sirven":** el Rey invoca gotas rápidas. Congelarlas → **empujar los bloques
  contra el Rey** cuando carga su embestida (el bloque lo frena/aturde → ventana de daño). Lección
  de la Zona 2, ahora épica.
- **Fase 2 — "El cielo sirve":** el Rey se vuelve intocable a ras de suelo (aura de escarcha) y
  llama 2 gárgolas. Congelarlas → caen → **subirse al bloque caído** para alcanzar su corona con
  el salto. Lección de la Zona 3.
- **Fase 3 — "El ritmo sirve":** desesperado, el Rey golpea el suelo **al ritmo de la campana**
  (que se oye desde el campanario): lluvia de carámbanos por oleadas telegrafiadas + suelo cada
  vez más helado. Esquivar al compás (lección de la Zona 5) hasta las dos últimas ventanas.
**Derrota:** el Rey se agrieta como hielo y estalla en copos. **El deshielo en cascada** (cielo
azul-ártico → cálido, partículas, los "habitantes" del pasillo cambian a sprites descongelados
al volver a pasar si el jugador retrocede — detalle opcional pero inolvidable). Portal al Nivel 5.

---

## 4. Distribución de enemigos (cada aparición enseña algo)

| Zona | Enemigo | Cant. | Rol de diseño |
|---|---|---:|---|
| 1 Puente | Gota | 1 | Conocerla sin riesgo (velocidad, patrón) |
| 2 Salón | Gota | 3–4 | **Materia prima**: congelar → bloque → empujar |
| 2 Salón | Guardián | 1 | "Puerta viviente" → congelar = pilar escalable |
| 3 Biblioteca | Gárgola | 4 | **Grúa de demolición**: congelar → cae → rompe/plataforma |
| 3 Biblioteca | Gota | 1 | Repaso en contexto nuevo |
| 4 Invernadero | — | 0–1 | El valle. La ausencia también es diseño |
| 5 Campanario | Mezcla | 8 | Examen combinado al ritmo de la campana |
| 6 Antesala | — | 0 | Silencio = tensión |
| 6 Trono | Rey + invocaciones | 1+ | Boss que evalúa las 3 lecciones |

**Total ≈ 18 enemigos** (el nivel actual tiene 13, colocados sin curricular). No es "más difícil
por cantidad": es más claro por **propósito**.

## 5. Secretos (5)

| # | Dónde | Cómo | Premio | A quién premia |
|---|---|---|---|---|
| 1 | Bajo el puente | Dejarse caer donde falta una baranda | 3⭐ | Al que mira hacia abajo |
| 2 | Biblioteca | Slide por detrás de un retrato | Cofre + 4⭐ + story | Al que explora túneles |
| 3 | Invernadero | Acercarse a la flor viva | 5⭐ en arco | A la curiosidad (no a la habilidad) |
| 4 | Campanario | Congelar la gárgola más alta → rompe piso | **Atajo** a la antesala | Al que domina la mecánica |
| 5 | Sala del trono | Detrás del trono, tras vencer al Rey | 3⭐ + (futuro: cromo del Rey) | Al que no corre al portal |

Regla: **ningún secreto castiga** (no hay muertes por buscar). Y cada uno premia un *tipo de
jugadora* distinto: mirona, exploradora, curiosa, experta, completista.

## 6. Curva de dificultad y 7. Ritmo

```
Intensidad
  ▲                                    ████ Campanario
  │                          ██ Biblioteca   ▂▂ Antesala   ████ BOSS
  │            ██ Salón     ████             (silencio)   ██████
  │  ▁▁ Puente ████        ██████    ▁▁ Invernadero      ████████
  └──────────────────────────────────────────────────────────────▶
     calma    aprender    técnica     VALLE      examen   pausa  clímax
```
- **Dos valles diseñados** (Invernadero, Antesala): el pico del boss se siente enorme porque viene
  del silencio, no del ruido continuo. El nivel actual es una línea plana — este respira.
- **Muerte barata:** 4 checkpoints (fin Z2, medio Z3, Z4, fin Z5). Nunca se repite más de ~45s.
- **El piso de habilidad es bajo, el techo es alto:** pasar el nivel es accesible (para la hermana
  menor); los secretos 4 y 5 y las 3⭐ del rating exigen dominio (para la mayor).

## 8. Ideas cinematográficas (con el motor actual)

1. **Plano de presentación:** al entrar, la cámara arranca 2s adelantada mostrando el arco del
   castillo y "vuelve" al jugador (lerp de cámara ya existente).
2. **La Campanada:** flash blanco frío + shake corto + todas las gárgolas en picada — coreografía,
   no cinemática.
3. **Entrada del Rey:** el trono en pantalla, 1s de quietud, flash, texto flotante «👑 ¡EL REY
   ESCARCHA!» (sistema de textos flotantes existente) y música de boss.
4. **El deshielo:** al morir el boss, transición de paleta skyTop/skyBot al cálido + lluvia de
   partículas doradas — 4 segundos que pagan 8 minutos de azul.
5. **Cinemática de entrada (sistema Cinematica existente, 1 sola vez):** 2 láminas — el castillo
   feliz / el castillo congelado. Ya hay pipeline para esto.

## 9. Por qué se va a recordar este nivel

Un nivel es memorable cuando se puede contar como anécdota en el recreo. Este deja **tres frases**:

1. **"Congelé a la gárgola en el aire y la usé de escalera."** — la mecánica firma. Nadie olvida
   la primera vez que el enemigo se vuelve herramienta.
2. **"Hay una parte donde TODOS se te tiran encima cuando suena la campana."** — la Campanada, el
   set-piece rítmico.
3. **"Al final están todos congelados en un pasillo… y después los salvás."** — el golpe emocional.
   Los niveles de Nintendo que se recuerdan 20 años tienen UN momento de silencio (la luna de
   Mario 3, la nieve de Tropical Freeze). Este es el nuestro.

Y una regla transversal que lo sostiene todo: **nada en el nivel es aleatorio.** Cada gota está
donde está para ser congelada, cada gárgola patrulla exactamente sobre el foso que puede romper,
cada plataforma existe para una decisión. El jugador no lo nota conscientemente — pero lo *siente*
como calidad.

---

## Anexo · Notas de implementación (honestidad técnica)

| Elemento | Estado |
|---|---|
| Hielo resbaladizo, slide con techo bajo, carámbanos, checkpoints, cofre, portal | ✅ Ya existe |
| Gota congelada = bloque empujable (con deslizamiento en hielo) | ✅ Ya existe (`_resolveBlockPushing`) |
| Gárgola congelada cae y rompe pinchos / sirve de plataforma | ✅ Ya existe (estado bloque-cayendo) |
| Guardián congelado como pilar escalable | ⚠️ Verificar que congelado sea sólido pisable (ajuste menor) |
| Spawns coreografiados (gotas del candelabro, oleadas de la Campanada) | 🔧 Código ligero (timers + spawn existente) |
| Latido de campana (flash+shake+sfx periódico en Z5) | 🔧 Código ligero |
| Deco storytelling (fuente, mesa, retratos, habitantes congelados) | 🎨 Assets nuevos (tiles DECO, sin lógica) |
| Fases del boss (invocar gotas / gárgolas / oleadas rítmicas) | 🔧 Extensión del boss actual (patrón por fases) |
| Deshielo final (paleta + partículas) | 🔧 Código ligero |
| Mapa 210 → 310 tiles | ✅ Trivial (el motor no limita W) |

**Orden de construcción sugerido:** Zonas 1-2-3 primero (validan la mecánica estrella con lo que ya
existe) → Z4 (barata) → Z5 (la Campanada) → boss por fases al final.
