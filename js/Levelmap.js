// ═══════════════════════════════════════════════════════
//  LEVELMAP.JS — Pantalla de mapa de niveles
//
//  Flujo:
//    showChar → LevelMap.show(charId) → Engine.startGame
//    onLevelClear → LevelMap.unlockNext(idx) → LevelMap.show()
//
//  Estado persistido en localStorage:
//    nuvecielas_unlocked  = máximo nivel desbloqueado (0-based)
//    nuvecielas_stars_N   = estrellas del nivel N
// ═══════════════════════════════════════════════════════

const LevelMap = (() => {

  // ── Datos de los niveles ────────────────────────────
  // Posiciones en el mapa SVG (path sinuoso de izquierda a derecha)
  const NODES = [
    {
      idx:   0,
      name:  'Bosque Mágico',
      desc:  'Encuentra el castillo de Nuveciela.',
      emoji: '🌿',
      color: '#4ade80',
      dark:  '#166534',
      x: 12, y: 64,
    },
    {
      idx:   1,
      name:  'Castillo de Nuveciela',
      desc:  'Echá al fantasma y sus secuaces.',
      emoji: '🏰',
      color: '#818cf8',
      dark:  '#3730a3',
      x: 30, y: 40,
    },
    {
      idx:   2,
      name:  'Sendero Nocturno',
      desc:  'Orugas, arbustos y el Ciempiés gigante. 🐛',
      emoji: '🌙',
      color: '#a78bfa',
      dark:  '#4c1d95',
      x: 50, y: 60,
    },
    {
      idx:   3,
      name:  'El Castillo de la Ciela',
      desc:  '¡Vencé al Rey de Escarcha! ❄️',
      emoji: '❄️',
      color: '#67e8f9',
      dark:  '#0e7490',
      x: 70, y: 38,
    },
    {
      idx:   4,
      name:  'Atravesando el Lago',
      desc:  'Nado libre entre medusas. 🪼',
      emoji: '🌊',
      color: '#38bdf8',
      dark:  '#075985',
      x: 88, y: 58,
    },
    // Submisión — nodo especial, no es un nivel regular
    // Aparece desbloqueado siempre, marcado visualmente distinto
    {
      idx:   'sub',
      name:  '¡Misión urgente!',
      desc:  '¡Han atrapado a Pablo! Volvé a la Tierra y rescatalo.',
      emoji: '🐱',
      color: '#fbbf24',
      dark:  '#92400e',
      x: 40, y: 84,
      special: true,
    },
  ];

  // ── Estado ──────────────────────────────────────────
  let _selectedChar  = null;
  let _selectedLevel = null;
  let _el            = null;  // el elemento DOM del mapa

  // ── Persistencia ────────────────────────────────────
  function _getUnlocked() {
    try { return parseInt(localStorage.getItem('nuvecielas_unlocked') || '0', 10); }
    catch(e) { return 0; }
  }

  function _setUnlocked(idx) {
    try { localStorage.setItem('nuvecielas_unlocked', String(idx)); }
    catch(e) {}
  }

  function _getStars(idx) {
    try { return parseInt(localStorage.getItem(`nuvecielas_stars_${idx}`) || '0', 10); }
    catch(e) { return 0; }
  }

  function _setStars(idx, stars) {
    try {
      const prev = _getStars(idx);
      if(stars > prev) localStorage.setItem(`nuvecielas_stars_${idx}`, String(stars));
    } catch(e) {}
  }

  // ── Construcción del DOM ────────────────────────────
  function _build() {
    if(_el) return;

    _el = document.createElement('div');
    _el.id = 'screenMap';
    _el.className = 'screen';
    _el.innerHTML = `
      <div class="map-bg"><div class="map-sparkles" aria-hidden="true"></div></div>
      <div class="map-content">
        <div class="map-header">
          <h2 class="map-title">Bosque Mágico</h2>
          <p class="map-sub" id="mapCharLabel"></p>
        </div>
        <div class="map-stage" id="mapStage">
          <svg class="map-path-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <!-- Path decorativo entre nodos -->
            <path id="mapPathLine"
              d="M12,64 C20,64 24,40 30,40 C38,40 44,60 50,60 C58,60 64,38 70,38 C78,38 82,58 88,58"
              fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.2"
              stroke-dasharray="3,2"/>
            <!-- Segmentos desbloqueados (se colorean con JS) -->
            <path id="mapPathUnlocked"
              d="M12,64 C20,64 24,40 30,40 C38,40 44,60 50,60 C58,60 64,38 70,38 C78,38 82,58 88,58"
              fill="none" stroke="rgba(255,255,255,0)" stroke-width="1.8"/>
          </svg>
          <div class="map-nodes" id="mapNodes"></div>
        </div>
        <div class="map-detail" id="mapDetail">
          <div class="map-detail-inner">
            <span class="map-detail-emoji" id="mapDetailEmoji">🌿</span>
            <div class="map-detail-info">
              <div class="map-detail-name" id="mapDetailName">Pradera Encantada</div>
              <div class="map-detail-boss" id="mapDetailBoss">🍄 Hongo Gigante</div>
              <div class="map-detail-stars" id="mapDetailStars"></div>
            </div>
            <button class="btn-main map-play-btn" id="mapPlayBtn">¡Jugar!</button>
          </div>
        </div>
        <button class="btn-secondary map-back-btn" id="mapBackBtn">← Volver</button>
      </div>
    `;

    document.body.appendChild(_el);

    document.getElementById('mapBackBtn').addEventListener('click', () => {
      hide();
      UI.showChar();
    });

    document.getElementById('mapPlayBtn').addEventListener('click', _startSelected);
  }

  function _renderNodes() {
    const unlocked  = _getUnlocked();
    const container = document.getElementById('mapNodes');
    if(!container) return;
    container.innerHTML = '';

    NODES.forEach(node => {
      const isSpecial  = node.special === true;
      const isUnlocked = isSpecial || node.idx <= unlocked;
      const isSelected = _selectedLevel === node.idx;
      // "Frontera" = el último nivel desbloqueado (a dónde ir ahora)
      const isFrontier = isUnlocked && !isSpecial && node.idx === unlocked;

      const el = document.createElement('div');
      el.className = 'map-node' +
        (isUnlocked ? ' unlocked'  : ' locked') +
        (isSelected ? ' selected'  : '') +
        (isSpecial  ? ' special'   : '') +
        (isFrontier ? ' frontier'  : '');
      el.style.left = `${node.x}%`;
      el.style.top  = `${node.y}%`;
      el.style.setProperty('--node-color', node.color);
      el.style.setProperty('--node-dark',  node.dark);

      el.innerHTML = isUnlocked
        ? `${isFrontier ? '<div class="map-node-here" aria-hidden="true">▼</div>' : ''}
           <div class="map-node-icon">${node.emoji}</div>
           <div class="map-node-stars">${isSpecial ? '' : _starsHtml(_getStars(node.idx))}</div>
           <div class="map-node-label">${isSpecial ? '!' : node.idx + 1}</div>`
        : `<div class="map-node-icon">🔒</div>
           <div class="map-node-label">${node.idx + 1}</div>`;

      if(isUnlocked){
        el.addEventListener('click',      () => _selectNode(node.idx));
        el.addEventListener('touchstart', () => _selectNode(node.idx), { passive:true });
      }
      container.appendChild(el);
    });

    _updatePath(unlocked);
  }

  // Mapa nivel → clave de cinemática (se muestra solo la primera vez)
  const LEVEL_CINEMATICA = {
    0:     'prologo',       // Bosque Mágico
    1:     'cin_nivel2',    // Castillo de Nuveciela
    2:     'cin_nivel3',    // Sendero Nocturno
    3:     'cin_nivel4',    // El Castillo de la Ciela
    4:     'cin_nivel5',    // Atravesando el Lago
    'sub': 'cin_sub',       // Misión Pablo
  };

  function _cinVista(key) {
    try { return !!localStorage.getItem(`nuve_cin_${key}`); } catch(e) { return false; }
  }
  function _marcarCinVista(key) {
    try { localStorage.setItem(`nuve_cin_${key}`, '1'); } catch(e) {}
  }

  function _startSelected() {
    if (_selectedLevel === null || !_selectedChar) return;

    const cinKey = LEVEL_CINEMATICA[_selectedLevel];
    const yaVista = !cinKey || _cinVista(cinKey);

    const launch = () => {
      // Nodo especial de submisión
      if (_selectedLevel === 'sub') {
        hide();
        SubMision.start({}, {
          onReturn: () => {
            try { const ps = Player.getState(); if (ps) ps.lives = 5; UI && UI.updateHUD && UI.updateHUD(); } catch(e) {}
            UI.showMap && UI.showMap();
          }
        });
        return;
      }
      // Nivel normal
      hide();
      UI.showGame();
      Engine.startGame(_selectedChar, _selectedLevel);
      UI.updateHUD();
      const charData = Player.getChar();
      if (charData) UI.showAbilityBadge(`✨ ${charData.label}: ${charData.ability}`, 3000);
    };

    if (!yaVista && cinKey && typeof Cinematica !== 'undefined' &&
        Cinematica._hasCinematica && Cinematica._hasCinematica(cinKey)) {
      Cinematica.play(cinKey, () => {
        _marcarCinVista(cinKey);
        launch();
      });
    } else {
      launch();
    }
  }

  function _starsHtml(n) {
    // Solo gráfico: una estrella + el número atrapado (no una estrella por cada una).
    return n > 0 ? `⭐ ${n}` : '';
  }

  function _updatePath(unlocked) {
    // Segmentos del path SVG entre nodos 0→1→2→3
    const segments = [
      'M12,64 C20,64 24,40 30,40',
      'M30,40 C38,40 44,60 50,60',
      'M50,60 C58,60 64,38 70,38',
      'M70,38 C78,38 82,58 88,58',
    ];
    const pathEl = document.getElementById('mapPathUnlocked');
    if(!pathEl) return;
    // Construir path hasta el nodo desbloqueado
    const d = segments.slice(0, unlocked).join(' ');
    pathEl.setAttribute('d', d || 'M0,0');
    pathEl.setAttribute('stroke', unlocked > 0 ? 'rgba(250,204,21,0.65)' : 'rgba(0,0,0,0)');
  }

  function _selectNode(idx) {
    _selectedLevel = idx;
    _renderNodes();
    _updateDetail(idx);
  }

  function _updateDetail(idx) {
    const node   = NODES.find(n => n.idx === idx);
    if(!node) return;
    const stars  = typeof idx === 'number' ? _getStars(idx) : 0;

    const nameEl = document.getElementById('mapDetailName');
    const descEl = document.getElementById('mapDetailBoss');
    const emEl   = document.getElementById('mapDetailEmoji');
    const starEl = document.getElementById('mapDetailStars');
    const playEl = document.getElementById('mapPlayBtn');
    const detail = document.getElementById('mapDetail');
    if(!nameEl) return;

    nameEl.textContent = node.name;
    descEl.textContent = node.desc;
    emEl.textContent   = node.emoji;

    if(node.special){
      starEl.textContent = '';
      playEl.textContent = '¡Ir a la Tierra!';
    } else {
      starEl.textContent = stars > 0 ? `Mejor: ${_starsHtml(stars)}` : 'Sin completar aún';
      playEl.textContent = '¡Jugar!';
    }

    detail.style.setProperty('--node-color', node.color);
    detail.style.setProperty('--node-dark',  node.dark);

    detail.classList.remove('map-detail-in');
    void detail.offsetWidth;
    detail.classList.add('map-detail-in');
  }

  // ── API pública ──────────────────────────────────────

  function show(charId) {
    _build();
    _selectedChar  = charId;
    // Seleccionar por defecto el primer nivel numérico no completado
    const unlocked = _getUnlocked();
    _selectedLevel = Math.min(unlocked, NODES.filter(n=>!n.special).length - 1);

    const label = document.getElementById('mapCharLabel');
    if(label) label.textContent = `Jugando como ${Player.getCharacters()[charId]?.label || charId}`;

    _renderNodes();
    _updateDetail(_selectedLevel);

    // Mostrar pantalla
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    _el.classList.add('active');
  }

  function hide() {
    if(_el) _el.classList.remove('active');
  }

  // Llamar desde ui.js → onLevelClear
  function onLevelComplete(levelIdx, stars) {
    _setStars(levelIdx, stars);
    const next = levelIdx + 1;
    if(next < NODES.length && next > _getUnlocked()){
      _setUnlocked(next);
    }
  }

  // Reset completo (debug)
  function resetProgress() {
    try {
      localStorage.removeItem('nuvecielas_unlocked');
      NODES.forEach(n => localStorage.removeItem(`nuvecielas_stars_${n.idx}`));
    } catch(e) {}
  }

  return { show, hide, onLevelComplete, resetProgress };

})();