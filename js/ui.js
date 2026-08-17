// ═══════════════════════════════════════════════════════
//  UI.JS — Pantallas, HUD, menús, transiciones
// ═══════════════════════════════════════════════════════

const UI = (() => {

  const images = {};

  let elMenu, elChar, elHow, elGame, elOverlay;
  let elHudLives, elHudStars, elHudLevel, elHudChar;
  let elOverlayEmoji, elOverlayTitle, elOverlaySub, elOverlayActions, elOverlayCard;
  let elAbilityBadge, elCheckpointFlash;
  let abilityBadgeTimer = null;

  const CHAR_IDS = ['nuveciela', 'ciela', 'lunaria', 'nuve'];
  const CHARS = {
    nuveciela: { emoji: '🌈', ability: '← ← Bola de fuego 🔥' },
    ciela:     { emoji: '💧', ability: '← ← Hielo ❄️ congela' },
    lunaria:   { emoji: '✨', ability: '← ← Rayo de luz ☀️' },
    nuve:      { emoji: '🔥', ability: '↑↑ Volar + ← ← Bolas 🎨' },
  };

  let selectedChar = null;

  function _bindBtn(id, fn) {
    const el = document.getElementById(id);
    if(el) el.addEventListener('click', fn);
    else console.warn(`UI: botón #${id} no encontrado`);
  }

  function init() {
    elMenu    = document.getElementById('screenMenu');
    elChar    = document.getElementById('screenChar');
    elHow     = document.getElementById('screenHow');
    elGame    = document.getElementById('screenGame');
    elOverlay = document.getElementById('screenOverlay');

    elHudLives  = document.getElementById('hudLives');
    elHudStars  = document.getElementById('hudStars');
    elHudLevel  = document.getElementById('hudLevel');
    elHudChar   = document.getElementById('hudChar');

    elOverlayEmoji   = document.getElementById('overlayEmoji');
    elOverlayTitle   = document.getElementById('overlayTitle');
    elOverlaySub     = document.getElementById('overlaySub');
    elOverlayActions = document.getElementById('overlayActions');
    elOverlayCard    = document.getElementById('overlayCard');

    const abilityBadge = document.createElement('div');
    abilityBadge.id = 'abilityBadge';
    elGame.appendChild(abilityBadge);
    elAbilityBadge = abilityBadge;

    const cpFlash = document.createElement('div');
    cpFlash.id = 'checkpointFlash';
    elGame.appendChild(cpFlash);
    elCheckpointFlash = cpFlash;

    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'btnPause';
    pauseBtn.textContent = '⏸';
    elGame.appendChild(pauseBtn);
    pauseBtn.addEventListener('click', () => {
      if (Engine.isPaused()) Engine.resume();
      else Engine.pause();
    });

    preloadImages();

    // Aviso de rotar: descartable por si no pueden girar la pantalla
    _bindBtn('rotDismiss', () => {
      const el = document.getElementById('rotateHint');
      if (el) el.classList.add('oculto');
    });

    _bindBtn('btnPlay',      showChar);
    _bindBtn('btnHow',       showHow);
    _bindBtn('btnHowBack',   showMenu);
    _bindBtn('btnCharBack',  showMenu);
    _bindBtn('btnCharStart', startGame);

    // Botón de audio — menú y juego
    function _setupAudioBtn(id) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        if (typeof AudioManager === 'undefined') return;
        // Primer click también desbloquea el audio en mobile
        const muted = AudioManager.toggleMute();
        // Actualizar ícono en todos los botones de audio
        document.querySelectorAll('.audio-btn').forEach(b => {
          b.textContent = muted ? '🔇' : '🔊';
          b.classList.toggle('muted', muted);
        });
        // Si la música no arrancó todavía, arrancarla ahora
        if (!muted) AudioManager.playMenu();
      });
    }
    _setupAudioBtn('btnAudio');
    _setupAudioBtn('btnAudioGame');

    // Reflejar el estado de mute persistido en los íconos al arrancar
    if (typeof AudioManager !== 'undefined' && AudioManager.isMuted()) {
      document.querySelectorAll('.audio-btn').forEach(b => {
        b.textContent = '🔇';
        b.classList.add('muted');
      });
    }

    buildCharGrid();

    showMenu();
  }

  function preloadImages() {
    CHAR_IDS.forEach(id => {
      const img = new Image();
      // BUG FIX: Usar ruta relativa correcta desde index.html (img/ no img/)
      img.src = `img/${id}.png`;
      images[id] = img;
    });
  }

  function getImages() { return images; }

  // ──────────────────────────────────────────
  //  PANTALLAS
  // ──────────────────────────────────────────
  function hideAll() {
    [elMenu, elChar, elHow, elGame].forEach(s => { if (s) s.classList.remove('active'); });
    if (elOverlay) elOverlay.hidden = true;
    // Ocultar el mapa si estaba visible
    const mapEl = document.getElementById('screenMap');
    if (mapEl) mapEl.classList.remove('active');
  }

  function showMenu() {
    Engine.stop();
    hideAll();
    elMenu.classList.add('active');
    _greetPlayer();
    if (typeof AudioManager !== 'undefined') AudioManager.playMenu();
  }

  /**
   * Si el mundo ya sabe quién está jugando, el Bosque lo saluda por su nombre
   * en vez de tratarlo como un desconocido. Sin mundo compartido (deploy suelto
   * en su propio dominio) queda el texto de siempre.
   */
  function _greetPlayer() {
    const hint = elMenu && elMenu.querySelector('.menu-hint');
    if (!hint) return;

    const player = window.NuveWorld ? window.NuveWorld.currentPlayer() : null;
    hint.textContent = player
      ? `¡Hola, ${player.name}! Elegí tu Nuveciela`
      : 'Seleccioná tu Nuveciela para comenzar';
  }

  function showChar() {
    hideAll();
    elChar.classList.add('active');
    buildCharGrid();   // siempre regenerar — garantiza que Player esté listo
  }

  function showHow() {
    hideAll();
    elHow.classList.add('active');
  }

  function showGame() {
    hideAll();
    elGame.classList.add('active');
    if (elOverlay) elOverlay.hidden = true;
  }

  function startGame() {
    if (!selectedChar) return;
    showMap();
  }

  function showMap() {
    if (!selectedChar) return;
    hideAll();
    LevelMap.show(selectedChar);
  }

  /**
   * @param {object} [opts]
   * @param {'win'|'clear'|'lose'|''} [opts.variant]  clase temática de la card
   * @param {boolean} [opts.confetti]  lanza confetti (celebración)
   * @param {number}  [opts.countTo]   si el sub incluye <span id="overlayCount">, cuenta hasta este número
   */
  function showOverlay(emoji, title, sub, actions, opts = {}) {
    elOverlayEmoji.textContent   = emoji;
    elOverlayTitle.textContent   = title;
    if (opts.countTo != null) elOverlaySub.innerHTML = sub;  // sub controlado (incluye <span>)
    else                      elOverlaySub.textContent = sub;
    elOverlayActions.innerHTML   = '';

    if (elOverlayCard) elOverlayCard.className = 'overlay-card' + (opts.variant ? ' overlay-' + opts.variant : '');

    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = a.primary ? 'btn-main' : 'btn-secondary';
      btn.textContent = a.label;
      btn.addEventListener('click', a.onClick);
      elOverlayActions.appendChild(btn);
    });

    elOverlay.removeAttribute('hidden');
    elOverlay.classList.add('active');

    // Re-disparar animaciones de entrada aunque el overlay ya existiera en el DOM
    _retriggerAnim(elOverlayCard);
    _retriggerAnim(elOverlayEmoji);

    // Efectos de celebración
    if (opts.confetti) _burstConfetti();
    if (opts.countTo != null) {
      const el = document.getElementById('overlayCount');
      if (el) _countUp(el, opts.countTo, 900);
    }
  }

  // Fuerza el reinicio de la animación CSS de un elemento (reflow)
  function _retriggerAnim(el) {
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  // Conteo animado 0 → target (ease-out)
  function _countUp(el, target, dur) {
    const start = performance.now();
    (function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = target;
    })(start);
  }

  // Ráfaga de confetti sobre el overlay (DOM, se limpia sola)
  function _burstConfetti() {
    if (!elOverlay) return;
    const colors = ['#f9c846', '#ff6b9d', '#6be6c1', '#5b8af5', '#c26bff', '#ff9a3c', '#4ade80'];
    const layer = document.createElement('div');
    layer.className = 'overlay-confetti';
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('i');
      p.style.left = (Math.random() * 100).toFixed(1) + '%';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (Math.random() * 2 - 1).toFixed(2));
      p.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      p.style.animationDelay = (Math.random() * 0.25).toFixed(2) + 's';
      p.style.animationDuration = (1.6 + Math.random() * 1.2).toFixed(2) + 's';
      layer.appendChild(p);
    }
    elOverlay.appendChild(layer);
    setTimeout(() => layer.remove(), 3000);
  }

  function hideOverlay() {
    elOverlay.hidden = true;
    elOverlay.classList.remove('active');
  }

  // ──────────────────────────────────────────
  //  GRILLA DE PERSONAJES
  // ──────────────────────────────────────────
  function buildCharGrid() {
    const grid = document.getElementById('charGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const charsData = Player.getCharacters();
    CHAR_IDS.forEach(id => {
      const ch = charsData[id];
      const extra = CHARS[id];

      const card = document.createElement('div');
      card.className = 'char-card';
      card.dataset.id = id;

      const av = document.createElement('div');
      av.className = 'char-avatar';
      const img = document.createElement('img');
      img.src = `img/${id}.png`;
      img.alt = ch.label;
      img.onerror = () => { av.innerHTML = `<span style="font-size:32px">${extra.emoji}</span>`; };
      av.appendChild(img);

      const name = document.createElement('div');
      name.className = 'char-name';
      name.textContent = ch.label;

      const ability = document.createElement('div');
      ability.className = 'char-ability';
      ability.textContent = extra.ability;

      card.appendChild(av);
      card.appendChild(name);
      card.appendChild(ability);

      card.addEventListener('click', () => selectChar(id));
      grid.appendChild(card);
    });
  }

  function selectChar(id) {
    selectedChar = id;
    document.querySelectorAll('.char-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.id === id);
    });
    const startBtn = document.getElementById('btnCharStart');
    if (startBtn) startBtn.disabled = false;

    // Mostrar nombre del personaje seleccionado en el botón
    const ch = Player.getCharacters()[id];
    if (startBtn && ch) startBtn.textContent = `▶ Jugar con ${ch.label}`;
  }

  // ──────────────────────────────────────────
  //  HUD — con corazones individuales y animaciones
  // ──────────────────────────────────────────
  let _prevStars = -1;

  function updateHUD() {
    const ps = Player.getState();
    const levelData = Engine.getLevelData();

    if (elHudLives) {
      const lives = Math.max(0, ps.lives);
      const maxLives = 5;

      // Generar corazones como spans individuales
      let heartsHTML = '';
      for (let i = 0; i < maxLives; i++) {
        if (i < lives) {
          heartsHTML += '<span class="hud-heart">♥</span>';
        } else {
          heartsHTML += '<span class="hud-heart empty">♡</span>';
        }
      }
      elHudLives.innerHTML = heartsHTML;

      // Aplicar clases de heartbeat según vidas
      elHudLives.classList.remove('low-hp', 'critical-hp');
      if (lives <= 1) {
        elHudLives.classList.add('critical-hp');
      } else if (lives <= 2) {
        elHudLives.classList.add('low-hp');
      }
    }

    if (elHudStars) {
      elHudStars.textContent = ps.stars;
      // Animación de bounce al recoger estrella
      if (_prevStars >= 0 && ps.stars > _prevStars) {
        const starsContainer = elHudStars.closest('.hud-stars');
        if (starsContainer) {
          starsContainer.classList.remove('star-collect');
          // Force reflow para reiniciar animación
          void starsContainer.offsetWidth;
          starsContainer.classList.add('star-collect');
        }
      }
      _prevStars = ps.stars;
    }

    if (elHudLevel && levelData) elHudLevel.textContent = `Nivel ${levelData.id} — ${levelData.name}`;
    if (elHudChar) {
      const ch = Player.getChar();
      elHudChar.textContent = ch?.label || '';
    }
  }

  // ──────────────────────────────────────────
  //  EFECTOS UI
  // ──────────────────────────────────────────
  function showAbilityBadge(text, duration = 2200) {
    if (!elAbilityBadge) return;
    elAbilityBadge.textContent = text;
    elAbilityBadge.classList.add('show');
    clearTimeout(abilityBadgeTimer);
    abilityBadgeTimer = setTimeout(() => {
      elAbilityBadge.classList.remove('show');
    }, duration);
  }

  function showCheckpointFlash() {
    if (!elCheckpointFlash) return;
    elCheckpointFlash.classList.add('show');
    setTimeout(() => elCheckpointFlash.classList.remove('show'), 600);
    showAbilityBadge('✅ ¡Checkpoint guardado!', 2000);
  }

  // ──────────────────────────────────────────
  //  CALLBACKS DEL ENGINE
  // ──────────────────────────────────────────
  function onGameOver(stars, win = false) {
    if (typeof AudioManager !== 'undefined') {
      if (!win) AudioManager.sfx('game_over');
      AudioManager.stop();
    }
    if (win) {
      showOverlay('🎉', '¡Felicitaciones!',
        `Completaste el Bosque Mágico con <span id="overlayCount" class="overlay-count">0</span> estrellas ⭐`,
        [
          {
            label: '▶ Jugar de nuevo', primary: true,
            onClick: () => {
              hideOverlay();
              // BUG FIX: Usar selectedChar en lugar de llamar startGame() recursivo
              showGame();
              Engine.startGame(selectedChar || 'nuveciela', 0);
              updateHUD();
            }
          },
          { label: '🏠 Menú principal', primary: false, onClick: () => { hideOverlay(); showMenu(); } },
        ],
        { variant: 'win', confetti: true, countTo: stars }
      );
    } else {
      const currentLevel = Engine.getCurrentLevel();
      showOverlay('💀', 'Game Over',
        `Nivel ${currentLevel + 1} — ${stars} estrellas ⭐`,
        [
          {
            label: '↩ Reintentar nivel', primary: true,
            onClick: () => {
              hideOverlay();
              showGame();
              Engine.startGame(selectedChar || Player.getState().charId, currentLevel);
              updateHUD();
            }
          },
          {
            label: '🗺️ Ver mapa', primary: false,
            onClick: () => { hideOverlay(); showMap(); }
          },
          { label: '🏠 Menú', primary: false, onClick: () => { hideOverlay(); showMenu(); } },
        ]
      );
    }
  }

  function onLevelClear(nextIdx, stars) {
    // Guardar progreso y desbloquear siguiente nivel
    LevelMap.onLevelComplete(nextIdx - 1, stars);

    const nextLevel = LEVELS[nextIdx];
    showOverlay('🌟', `¡Nivel ${nextIdx} completado!`,
      `${nextLevel ? 'Siguiente: ' + nextLevel.name : '¡Todos los niveles completados!'} — ⭐ <span id="overlayCount" class="overlay-count">0</span>`,
      [
        {
          label: nextLevel ? `🗺️ Ver mapa` : `🎉 Ver logros`,
          primary: true,
          onClick: () => {
            hideOverlay();
            showMap();
          }
        },
        { label: '🏠 Menú principal', primary: false, onClick: () => { hideOverlay(); showMenu(); } },
      ],
      { variant: 'clear', confetti: true, countTo: stars }
    );
  }

  function onPause(paused) {
    if (paused) {
      showOverlay('⏸', 'Pausa', '',
        [
          { label: '▶ Continuar', primary: true, onClick: () => { hideOverlay(); Engine.resume(); } },
          {
            label: '🔁 Reiniciar', primary: false,
            onClick: () => {
              hideOverlay();
              showGame();
              Engine.startGame(Player.getState().charId, Engine.getCurrentLevel());
              updateHUD();
            }
          },
          { label: '🏠 Menú', primary: false, onClick: () => { hideOverlay(); showMenu(); } },
        ]
      );
    } else {
      hideOverlay();
    }
  }

  return {
    init,
    showMenu, showChar, showHow, showGame, showMap,
    showOverlay, hideOverlay,
    updateHUD,
    showAbilityBadge, showCheckpointFlash,
    onGameOver, onLevelClear, onPause,
    getImages,
  };

})();