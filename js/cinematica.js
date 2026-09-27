// ═══════════════════════════════════════════════════════
//  CINEMATICA.JS — Sistema de cinemáticas narrativas
//  Se muestra entre la selección de personaje y el juego.
//  Cada cinemática tiene escenas con imagen + texto animado.
// ═══════════════════════════════════════════════════════

const Cinematica = (() => {

  let _onComplete = () => {};
  let _currentScene = 0;
  let _scenes = [];
  let _textIndex = 0;
  let _textTimer = null;
  let _el = null;
  let _skipAll = false;

  // ── Datos de cinemáticas ──────────────────────────────

  const CINEMATICAS = {

    // ── PRÓLOGO: antes de empezar el juego ───────────────
    prologo: {
      titulo: 'Manolandia',
      escenas: [
        {
          imagen: 'img/cinematica1_escena2.jpg',
          texto: [
            'Había una vez un mundo mágico llamado Manolandia.',
            'Un lugar alegre y lleno de color, hecho a mano con mucho cariño.',
            'Allí viven las Nuvecielas, siempre listas para una aventura.',
          ],
        },
        {
          imagen: 'img/cinematica1_escena1.jpg',
          texto: [
            'Pero una tarde, una sombra traviesa se sintió sola.',
            '«¿Por qué nadie juega conmigo?», suspiró.',
            'Y en una travesura, escondió la magia del bosque.',
          ],
        },
        {
          imagen: 'img/cinematica1_escena2.jpg',
          texto: [
            '🎯 Misión: devolvé la alegría al Bosque y llegá al Castillo de la Nuveciela.',
          ],
        },
      ],
    },

    // ── NIVEL 2 · El Castillo de Nuveciela ───────────────
    cin_nivel2: {
      titulo: 'El castillo embrujado',
      escenas: [
        {
          imagen: 'img/back_castlenc01.png',
          texto: [
            'La sombra no se quedó quieta.',
            'Ahora embrujó el Castillo de Nuveciela, junto con sus secuaces.',
            'Hechizó a las serpientes, y llenó los salones de fantasmas.',
          ],
        },
        {
          imagen: 'img/back_castlenc03.png',
          texto: [
            'Adentro ya nadie se acuerda de cómo era el castillo antes.',
            '🎯 Misión: rompé la maldición y vencé al Fantasma Malvado.',
          ],
        },
      ],
    },

    // ── NIVEL 3 · El Sendero Nocturno ────────────────────
    cin_nivel3: {
      titulo: 'La noche que no terminaba',
      escenas: [
        {
          imagen: 'img/sendero0.png',
          texto: [
            'La sombra hizo otra travesura.',
            'Hechizó el sendero para que la noche fuera eterna.',
            'Y a las orugas, a los murciélagos y a los arbustos los puso en tu contra.',
          ],
        },
        {
          imagen: 'img/sendero1.png',
          texto: [
            'Hasta la Lechuza Guardiana, que cuidaba el camino, cayó bajo el hechizo.',
            'No es mala. Está embrujada, como todos los demás.',
          ],
        },
        {
          imagen: 'img/sendero2.png',
          texto: [
            '🎯 Misión: devolvele el día al sendero y liberá a la Lechuza Guardiana.',
          ],
        },
      ],
    },

    // ── NIVEL 4 · El Castillo de la Ciela ────────────────
    cin_nivel4: {
      titulo: 'El castillo congelado',
      escenas: [
        {
          imagen: 'img/level4/fondo_level4.jpg',
          texto: [
            'Esta vez la sombra hizo una travesura terrible.',
            'Congeló entero el Castillo de la Ciela.',
            'Las armaduras y las gárgolas despertaron hechizadas.',
          ],
        },
        {
          imagen: 'img/level4/fondo_level4.jpg',
          texto: [
            'Y en la última sala, detrás del Rey de Escarcha,',
            'dejó a tus tres amigas encerradas en una jaula de hielo.',
            '🎯 Misión: descongelá el castillo, vencé al Rey de Escarcha y liberalas.',
          ],
        },
      ],
    },

    // ── NIVEL 5 · Atravesando el Lago ────────────────────
    // Sin imagen: el lago no tiene fondo propio, así que la escena se pinta
    // con su misma paleta (ver `gradiente` en _loadScene).
    cin_nivel5: {
      titulo: 'El lago',
      escenas: [
        {
          gradiente: ['#082f49', '#0284c7'],
          texto: [
            'A la sombra ya casi no le quedaban travesuras.',
            'Así que se escondió del otro lado del lago, en lo más hondo.',
            'Y hechizó a todo lo que vive en el agua para que nadie pudiera cruzar.',
          ],
        },
        {
          gradiente: ['#041f33', '#0e7490'],
          texto: [
            'Abajo hay algo más: una Nuveciela de piedra, hundida hace muchísimo.',
            'Al tiburón no lo vas a poder vencer. A ese hay que escaparle.',
            '🎯 Misión: cruzá el lago y llegá hasta la sombra.',
          ],
        },
      ],
    },

    // ── SUBMISIÓN · El rescate de Pablo ──────────────────
    cin_sub: {
      titulo: '¡Misión urgente!',
      escenas: [
        {
          imagen: 'img/submision/cielo_lejano.png',
          texto: [
            '¡Llegó un mensaje urgente desde la Tierra!',
            'La sombra se coló por un portal y se llevó a Pablo, el gato.',
            'Lo tienen encerrado en una jaula, en Rosario.',
          ],
        },
        {
          imagen: 'img/submision/fondo_rosario.png',
          texto: [
            'Nina y Jazmín salen a buscarlo por la costanera.',
            'Ellas no tienen poderes mágicos: tiran corazones.',
            '🎯 Misión: rescatá a Pablo y traelo de vuelta a Manolandia.',
          ],
        },
      ],
    },

  };

  // ── DOM ───────────────────────────────────────────────
  function _buildDOM() {
    if (document.getElementById('screenCinematica')) return;

    const el = document.createElement('div');
    el.id = 'screenCinematica';
    el.className = 'screen';
    el.innerHTML = `
      <div class="cin-container">
        <img class="cin-image" id="cinImage" src="" alt="" />
        <div class="cin-overlay"></div>
        <div class="cin-text-box" id="cinTextBox">
          <p class="cin-text" id="cinText"></p>
          <div class="cin-cursor" id="cinCursor">▼</div>
        </div>
        <div class="cin-controls">
          <button class="cin-btn-skip" id="cinSkip">Saltar ▶▶</button>
          <button class="cin-btn-next" id="cinNext">Siguiente ▶</button>
        </div>
        <div class="cin-progress" id="cinProgress"></div>
      </div>
    `;
    document.body.appendChild(el);
    _el = el;

    document.getElementById('cinNext').addEventListener('click', _next);
    document.getElementById('cinSkip').addEventListener('click', _skipCinematic);
    el.addEventListener('click', (e) => {
      if (!e.target.closest('button')) _next();
    });
  }

  function _onKey(e) {
    // Antes esto exigia la clase .active, que play() NUNCA pone porque
    // gestiona el display a mano: el teclado no funciono nunca en ninguna
    // cinematica. Ahora pregunta si esta realmente visible.
    if (!_el || _el.style.display === 'none' || !_el.style.display) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') _next();
    if (e.key === 'Escape') _skipCinematic();
  }

  // ── Lógica ────────────────────────────────────────────
  function _loadScene(idx) {
    if (idx >= _scenes.length) { _end(); return; }
    _currentScene = idx;
    _textIndex = 0;
    const scene = _scenes[idx];

    const cont = document.querySelector('.cin-container');
    const img  = document.getElementById('cinImage');

    // Escenas sin imagen: se pintan con la paleta del nivel. Sirve para el
    // lago, que no tiene fondo propio, y como red para cualquier cinemática
    // cuyo arte todavía no exista: se ve digna igual y después se reemplaza
    // `gradiente` por `imagen` sin tocar nada más.
    if (!scene.imagen && scene.gradiente) {
      img.style.display = 'none';
      if (cont) cont.style.background =
        `linear-gradient(160deg, ${scene.gradiente[0]}, ${scene.gradiente[1]})`;
    } else {
      if (cont) cont.style.background = '';
      img.style.display = '';
      img.style.opacity = '0';
      img.src = scene.imagen;
      img.onload = () => {
        img.style.transition = 'opacity 0.8s ease';
        img.style.opacity = '1';
      };
      // Si ya estaba cargada (la precargamos al arrancar la cinemática)
      if (img.complete && img.naturalWidth > 0) img.style.opacity = '1';
    }

    _updateProgress();
    _typeText();
  }

  // Precarga de todas las imágenes de la cinemática antes de mostrarla.
  // Sin esto, cada cambio de escena mostraba un parpadeo en negro mientras
  // el navegador iba a buscar la imagen.
  function _precargar(escenas) {
    for (const e of escenas) {
      if (!e.imagen) continue;
      const i = new Image();
      i.src = e.imagen;
    }
  }

  function _typeText() {
    const scene = _scenes[_currentScene];
    if (_textIndex >= scene.texto.length) {
      _showCursor(true);
      return;
    }
    _showCursor(false);
    const fullText = scene.texto[_textIndex];
    const el = document.getElementById('cinText');
    el.textContent = '';
    el.style.opacity = '1';

    let charIdx = 0;
    if (_textTimer) clearInterval(_textTimer);
    _textTimer = setInterval(() => {
      el.textContent += fullText[charIdx];
      charIdx++;
      if (charIdx >= fullText.length) {
        clearInterval(_textTimer);
        _textTimer = null;
        _showCursor(true);
      }
    }, 38); // velocidad de tipeo
  }

  function _next() {
    const scene = _scenes[_currentScene];

    // Si el texto aún está escribiéndose → mostrar completo de golpe
    if (_textTimer) {
      clearInterval(_textTimer);
      _textTimer = null;
      document.getElementById('cinText').textContent = scene.texto[_textIndex];
      _showCursor(true);
      return;
    }

    _textIndex++;
    if (_textIndex < scene.texto.length) {
      // Siguiente línea de texto, misma imagen
      _fadeText(() => _typeText());
    } else {
      // Siguiente escena
      _loadScene(_currentScene + 1);
    }
  }

  function _fadeText(cb) {
    const el = document.getElementById('cinText');
    el.style.transition = 'opacity 0.25s';
    el.style.opacity = '0';
    setTimeout(() => { el.style.opacity = '1'; cb(); }, 260);
  }

  function _showCursor(show) {
    const c = document.getElementById('cinCursor');
    if (c) c.style.opacity = show ? '1' : '0';
  }

  function _updateProgress() {
    const el = document.getElementById('cinProgress');
    if (!el) return;
    el.innerHTML = _scenes.map((_, i) =>
      `<span class="cin-dot ${i === _currentScene ? 'active' : ''}"></span>`
    ).join('');
  }

  function _skipCinematic() {
    if (_textTimer) { clearInterval(_textTimer); _textTimer = null; }
    _end();
  }

  function _end() {
    if (_textTimer) { clearInterval(_textTimer); _textTimer = null; }
    document.removeEventListener('keydown', _onKey);
    const el = document.getElementById('screenCinematica');
    if (!el) { _onComplete(); return; }
    // Fade out — el nivel arranca debajo mientras desaparece
    el.style.transition    = 'opacity 0.5s ease';
    el.style.opacity       = '0';
    el.style.pointerEvents = 'none';
    _onComplete();
    setTimeout(() => {
      el.style.display       = 'none';
      el.style.zIndex        = '';
      el.style.opacity       = '';
      el.style.transition    = '';
      el.style.pointerEvents = '';
      document.body.classList.remove('cinematica-activa');
    }, 520);
  }

  // ── API pública ───────────────────────────────────────
  function play(cinematicaKey, onComplete) {
    _onComplete = onComplete || (() => {});
    const data = CINEMATICAS[cinematicaKey];
    if (!data || !data.escenas || data.escenas.length === 0) {
      _onComplete(); return;
    }

    _buildDOM();
    _scenes = data.escenas;
    _precargar(_scenes);
    _currentScene = 0;
    _textIndex = 0;

    // Marcar que hay cinemática en pantalla. El aviso de "girá el teléfono"
    // vive dentro de #screenGame, y como _end() dispara el callback que lanza
    // el nivel ANTES de terminar su fundido de 520 ms, durante ese rato el
    // aviso aparecía encima de la cinemática.
    document.body.classList.add('cinematica-activa');

    // El teclado se registra en CADA play() y se suelta en _end(). Antes se
    // registraba una sola vez dentro de _buildDOM() —que corta temprano si el
    // DOM ya existe— y _end() lo quitaba: de la segunda cinematica en adelante
    // no habria teclas aunque el guard estuviera bien.
    document.removeEventListener('keydown', _onKey);
    document.addEventListener('keydown', _onKey);

    const el = document.getElementById('screenCinematica');
    // Gestión manual — no depende de .active
    el.style.display       = 'flex';
    el.style.position      = 'fixed';
    el.style.inset         = '0';
    el.style.zIndex        = '9999';
    el.style.opacity       = '0';
    el.style.pointerEvents = 'all';
    el.style.transition    = 'opacity 0.6s ease';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { el.style.opacity = '1'; });
    });

    _loadScene(0);
  }

  // Registrar nueva escena en tiempo de ejecución
  function addScene(cinematicaKey, escena) {
    if (!CINEMATICAS[cinematicaKey]) CINEMATICAS[cinematicaKey] = { escenas: [] };
    CINEMATICAS[cinematicaKey].escenas.push(escena);
  }

  // Verifica si existe una cinemática con escenas definidas
  function _hasCinematica(key) {
    const c = CINEMATICAS[key];
    return !!(c && c.escenas && c.escenas.length > 0);
  }

  return { play, addScene, _hasCinematica };
})();
