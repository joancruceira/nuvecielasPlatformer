// ═══════════════════════════════════════════════════════
//  UI.JS — Pantallas, HUD, menús, transiciones
// ═══════════════════════════════════════════════════════

const UI = (() => {

  const images = {};

  let elMenu, elChar, elHow, elGame, elOverlay;
  let elHudLives, elHudStars, elHudLevel, elHudChar;
  let elOverlayEmoji, elOverlayTitle, elOverlaySub, elOverlayActions;
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

    _bindBtn('btnPlay',      showChar);
    _bindBtn('btnHow',       showHow);
    _bindBtn('btnHowBack',   showMenu);
    _bindBtn('btnCharBack',  showMenu);
    _bindBtn('btnCharStart', startGame);

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
    if (typeof AudioManager !== 'undefined') AudioManager.playMenu();
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
    // En vez de ir directo al juego, mostrar el mapa de niveles
    showMap();
  }

  function showMap() {
    if (!selectedChar) return;
    hideAll();
    LevelMap.show(selectedChar);
  }

  function showOverlay(emoji, title, sub, actions) {
    elOverlayEmoji.textContent   = emoji;
    elOverlayTitle.textContent   = title;
    elOverlaySub.textContent     = sub;
    elOverlayActions.innerHTML   = '';

    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = a.primary ? 'btn-main' : 'btn-secondary';
      btn.textContent = a.label;
      btn.addEventListener('click', a.onClick);
      elOverlayActions.appendChild(btn);
    });

    elOverlay.removeAttribute('hidden');
    elOverlay.classList.add('active');
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
  //  HUD
  // ──────────────────────────────────────────
  function updateHUD() {
    const ps = Player.getState();
    const levelData = Engine.getLevelData();

    if (elHudLives) {
      const lives = Math.max(0, ps.lives);
      const empty = Math.max(0, 5 - lives);
      elHudLives.textContent = '♥'.repeat(lives) + '♡'.repeat(empty);
    }
    if (elHudStars)  elHudStars.textContent  = ps.stars;
    if (elHudLevel && levelData) elHudLevel.textContent = `Nivel ${levelData.id} — ${levelData.name}`;
    if (elHudChar) {
      // Mostrar el personaje seleccionado — puede no coincidir con Player.getChar()
      // si el juego acaba de arrancar
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
        `Completaste el Bosque Mágico con ${stars} estrellas ⭐`,
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
        ]
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
      `${nextLevel ? 'Siguiente: ' + nextLevel.name : '¡Todos los niveles completados!'} — ⭐ ${stars}`,
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
      ]
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