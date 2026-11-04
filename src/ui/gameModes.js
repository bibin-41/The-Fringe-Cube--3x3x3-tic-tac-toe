import { state } from '../state.js';

// Controls
// ═══════════════════════════════════════════════════════════════

state.setViewMode = function setViewMode(mode) {
  state.viewMode = mode;
  document
    .getElementById('btnView3D')
    .classList.toggle('active', mode === '3d');
  document
    .getElementById('btnView2D')
    .classList.toggle('active', mode === '2d');
  document
    .getElementById('flat-view')
    .classList.toggle('active', mode === '2d');
  document.getElementById('three-canvas').style.display =
    mode === '3d' ? 'block' : 'none';
  document.getElementById('viewModeBadge').textContent =
    mode === '3d' ? '3D SPATIAL' : '2D PLANES';
  document.getElementById('panel3DControls').style.display =
    mode === '3d' ? 'block' : 'none';

  // Mobile controls
  const mobBtnIcon = document.getElementById('mobBtnViewIcon');
  if (mobBtnIcon) mobBtnIcon.textContent = mode === '3d' ? '▦ 2D' : '◈ 3D';

  const mob3dDock = document.getElementById('mobile3DDock');
  if (mob3dDock) {
    if (mode === '3d') {
      mob3dDock.classList.add('visible');
    } else {
      mob3dDock.classList.remove('visible');
    }
  }

  if (mode === '2d') state.updateFlatView();
  if (mode === '3d') state.onResize();
};

state.toggleViewModeMobile = function toggleViewModeMobile() {
  state.setViewMode(state.viewMode === '3d' ? '2d' : '3d');
};

state.setPrimaryMode = function setPrimaryMode(mode) {
  state.primaryMode = mode;
  const b2p = document.getElementById('btnMode2P');
  const b3p = document.getElementById('btnMode3P');
  if (b2p) b2p.classList.toggle('active', mode === '2p');
  if (b3p) b3p.classList.toggle('active', mode === '3p');

  const is2P = mode === '2p';
  const is3P = mode === '3p';

  const sub2P = document.getElementById('submenu2P');
  const sub3P = document.getElementById('submenu3P');
  if (sub2P) sub2P.style.display = is2P ? 'block' : 'none';
  if (sub3P) sub3P.style.display = is3P ? 'block' : 'none';

  const cardTri = document.getElementById('scoreCardTri');
  if (cardTri) cardTri.style.display = is3P ? 'flex' : 'none';

  const mobTriWrap = document.getElementById('mobScoreTriWrap');
  if (mobTriWrap) mobTriWrap.style.display = is3P ? 'inline-flex' : 'none';

  if (is2P) {
    state.gameMode = state.mode2P === 'ai' ? 'ai' : 'pvp';
  } else {
    state.gameMode = '3p';
  }

  state.updateAISettingsVisibility();
  state.updateHumanPlaySetupVisibility();
  state.resetGame();
};

state.set2PMode = function set2PMode(type) {
  state.mode2P = type; // 'human' or 'ai'
  state.gameMode = type === 'ai' ? 'ai' : 'pvp';
  const bHuman = document.getElementById('btn2pHuman');
  const bAI = document.getElementById('btn2pAI');
  if (bHuman) bHuman.classList.toggle('active', type === 'human');
  if (bAI) bAI.classList.toggle('active', type === 'ai');
  state.updateAISettingsVisibility();
  state.updateHumanPlaySetupVisibility();
  state.resetGame();
};

state.set3PMode = function set3PMode(val) {
  state.botMode3P = val; // '0': 3 Humans, '1': 2 Humans & 1Bot, '2': 1 Human and 2 Bots
  state.gameMode = '3p';
  const b0 = document.getElementById('btn3pHumans');
  const b1 = document.getElementById('btn3p1Bot');
  const b2 = document.getElementById('btn3p2Bots');
  if (b0) b0.classList.toggle('active', val === '0');
  if (b1) b1.classList.toggle('active', val === '1');
  if (b2) b2.classList.toggle('active', val === '2');
  state.updateAISettingsVisibility();
  state.updateHumanPlaySetupVisibility();
  state.resetGame();
};

state.updateHumanPlaySetupVisibility =
  function updateHumanPlaySetupVisibility() {
    const showSetup =
      (state.primaryMode === '2p' && state.mode2P === 'human') ||
      (state.primaryMode === '3p' && state.botMode3P !== '2');
    const setupPanel = document.getElementById('humanPlaySetup');
    const passButton = document.getElementById('btnPassAndPlay');
    const remoteButton = document.getElementById('btnRemotePlay');
    const roomOptions = document.getElementById('remoteRoomOptions');
    const createRoomButton = document.getElementById('btnCreateRoom');
    const joinRoomButton = document.getElementById('btnJoinRoom');

    if (setupPanel) setupPanel.style.display = showSetup ? 'block' : 'none';
    if (passButton)
      passButton.classList.toggle('active', state.humanPlaySetup === 'pass');
    if (remoteButton)
      remoteButton.classList.toggle(
        'active',
        state.humanPlaySetup === 'remote',
      );
    if (roomOptions)
      roomOptions.style.display =
        showSetup && state.humanPlaySetup === 'remote' ? 'block' : 'none';
    if (createRoomButton)
      createRoomButton.classList.toggle(
        'active',
        state.remoteRoomAction === 'create',
      );
    if (joinRoomButton)
      joinRoomButton.classList.toggle(
        'active',
        state.remoteRoomAction === 'join',
      );
  };

state.setHumanPlaySetup = function setHumanPlaySetup(setup) {
  state.humanPlaySetup = setup;
  state.updateHumanPlaySetupVisibility();
};

state.setRemoteRoomAction = function setRemoteRoomAction(action) {
  state.remoteRoomAction = action;
  state.updateHumanPlaySetupVisibility();
};

state.updateAISettingsVisibility = function updateAISettingsVisibility() {
  const showAI =
    (state.primaryMode === '2p' && state.mode2P === 'ai') ||
    (state.primaryMode === '3p' && state.botMode3P !== '0');
  const aiPanel = document.getElementById('aiSettings');
  if (aiPanel) aiPanel.style.display = showAI ? 'block' : 'none';
};

state.setDifficulty = function setDifficulty(diff) {
  state.aiDifficulty = diff;
  const bEasy = document.getElementById('btnEasy');
  const bMed = document.getElementById('btnMed');
  const bHard = document.getElementById('btnHard');
  if (bEasy) bEasy.classList.toggle('active', diff === 'easy');
  if (bMed) bMed.classList.toggle('active', diff === 'medium');
  if (bHard) bHard.classList.toggle('active', diff === 'hard');
  state.resetGame();
};

// Backward compatibility aliases
state.setGameMode = function setGameMode(mode) {
  if (mode === '3p') {
    state.setPrimaryMode('3p');
  } else if (mode === 'pvp') {
    state.setPrimaryMode('2p');
    state.set2PMode('human');
  } else if (mode === 'ai') {
    state.setPrimaryMode('2p');
    state.set2PMode('ai');
  }
};

state.set3PBotMode = function set3PBotMode(val) {
  state.set3PMode(val);
};

state.setExplode = function setExplode(val) {
  state.explodeAmount = val / 100;
  state.updateCellPositions();
};

state.setCameraPreset = function setCameraPreset(preset) {
  const dur = 600;
  let target;
  switch (preset) {
    case 'front':
      target = { x: 0, y: 0, z: 12 };
      break;
    case 'top':
      target = { x: 0.1, y: 12, z: 0.1 };
      break;
    case 'iso':
      target = { x: 6, y: 5, z: 8 };
      break;
  }
  // Simple tween
  const start = {
    x: state.camera.position.x,
    y: state.camera.position.y,
    z: state.camera.position.z,
  };
  const startTime = Date.now();
  function tweenCam() {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / dur, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    state.camera.position.x = start.x + (target.x - start.x) * ease;
    state.camera.position.y = start.y + (target.y - start.y) * ease;
    state.camera.position.z = start.z + (target.z - start.z) * ease;
    if (t < 1) requestAnimationFrame(tweenCam);
  }
  tweenCam();
};

state.isolateLayer = function isolateLayer(layer) {
  state.isolatedLayer = layer;
  document.getElementById('btnL0').classList.toggle('active', layer === 0);
  document.getElementById('btnL1').classList.toggle('active', layer === 1);
  document.getElementById('btnL2').classList.toggle('active', layer === 2);
  document.getElementById('btnLAll').classList.toggle('active', layer === -1);

  // Mobile 3D dock layer buttons
  const mb0 = document.getElementById('mobL0');
  const mb1 = document.getElementById('mobL1');
  const mb2 = document.getElementById('mobL2');
  const mbAll = document.getElementById('mobLAll');
  if (mb0) mb0.classList.toggle('active', layer === 0);
  if (mb1) mb1.classList.toggle('active', layer === 1);
  if (mb2) mb2.classList.toggle('active', layer === 2);
  if (mbAll) mbAll.classList.toggle('active', layer === -1);

  state.updateCellPositions();
};

// ═══════════════════════════════════════════════════════════════
