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
      x: 12, y: 62,
    },
    {
      idx:   1,
      name:  'Castillo de Nuveciela',
      desc:  'Echá al fantasma y sus secuaces.',
      emoji: '🏰',
      color: '#818cf8',
      dark:  '#3730a3',
      x: 32, y: 38,
    },
    {
      idx:   2,
      name:  'Castillo de Ciela',
      desc:  '¡Controlá la invasión de insectos marcianos!',
      emoji: '🐛',
      color: '#34d399',
      dark:  '#065f46',
      x: 56, y: 58,
    },
    {
      idx:   3,
      name:  'Núcleo del Bosque',
      desc:  '¡Derrotá a la Sombra de las Nuvecielas!',
      emoji: '🌑',
      color: '#f472b6',
      dark:  '#831843',
      x: 78, y: 34,
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
      x: 44, y: 78,
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
      <div class="map-bg"></div>
      <div class="map-content">
        <div class="map-header">
          <h2 class="map-title">Bosque Mágico</h2>
          <p class="map-sub" id="mapCharLabel"></p>
        </div>
        <div class="map-stage" id="mapStage">
          <svg class="map-path-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <!-- Path decorativo entre nodos -->
            <path id="mapPathLine"
              d="M12,62 C20,62 24,38 32,38 C40,38 48,58 56,58 C64,58 70,34 78,34"
              fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.2"
              stroke-dasharray="3,2"/>
            <!-- Segmentos desbloqueados (se colorean con JS) -->
            <path id="mapPathUnlocked"
              d="M12,62 C20,62 24,38 32,38 C40,38 48,58 56,58 C64,58 70,34 78,34"
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

      const el = document.createElement('div');
      el.className = 'map-node' +
        (isUnlocked ? ' unlocked'  : ' locked') +
        (isSelected ? ' selected'  : '') +
        (isSpecial  ? ' special'   : '');
      el.style.left = `${node.x}%`;
      el.style.top  = `${node.y}%`;
      el.style.setProperty('--node-color', node.color);
      el.style.setProperty('--node-dark',  node.dark);

      el.innerHTML = isUnlocked
        ? `<div class="map-node-icon">${node.emoji}</div>
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

  function _startSelected() {
    if(_selectedLevel === null || !_selectedChar) return;

    // Nodo especial de submisión
    if(_selectedLevel === 'sub'){
      hide();
      SubMision.start({}, {
        onReturn: () => {
          try {
            const ps = Player.getState();
            if(ps) ps.lives = 5;
            UI && UI.updateHUD && UI.updateHUD();
          } catch(e) {}
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
    if(charData) UI.showAbilityBadge(`✨ ${charData.label}: ${charData.ability}`, 3000);
  }

  function _starsHtml(n) {
    return '⭐'.repeat(n) + (n < 3 ? '☆'.repeat(3-n) : '');
  }

  function _updatePath(unlocked) {
    // Segmentos del path SVG entre nodos 0→1→2→3
    const segments = [
      'M12,62 C20,62 24,38 32,38',
      'M32,38 C40,38 48,58 56,58',
      'M56,58 C64,58 70,34 78,34',
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

  function _startSelected() {
    if(_selectedLevel === null || !_selectedChar) return;
    hide();
    UI.showGame();
    Engine.startGame(_selectedChar, _selectedLevel);
    UI.updateHUD();
    const charData = Player.getChar();
    if(charData) UI.showAbilityBadge(`✨ ${charData.label}: ${charData.ability}`, 3000);
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