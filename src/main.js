import './style.css';
import { state } from './state.js';
import './game/rules.js';
import './game/game.js';
import './game/ai.js';
import './views/board3d.js';
import './views/board2d.js';
import './ui/gameModes.js';
import './ui/scoreboard.js';
import './ui/modals.js';
import './ui/audio.js';
import './ui/effects.js';
import './network/remotePlay.js';

// Initialization
// ═══════════════════════════════════════════════════════════════

state.init = function init() {
  state.createParticles();
  state.init3D();
  state.buildFlatView();
  state.updateFlatView();
  state.updateTurnDisplay();
  state.updateStatusDisplay();
  state.updateScoreboard();
  state.updateMoveLog();
  state.updateLinesChecklist();
  state.setExplode(document.getElementById('explodeSlider').value);
  state.setViewMode('2d');

  // Ensure default mode is 2P vs AI (Medium)
  state.setPrimaryMode('2p');
  state.set2PMode('ai');
  state.setDifficulty('medium');

  const badge = document.getElementById('statusBadge');
  if (badge) {
    badge.addEventListener('click', () => {
      if (state.gameOver && state.lastGameResult) {
        state.showGameOverModal(state.lastGameResult);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      state.closeGameOverModal();
      state.closeStatsModal();
      state.closeGuideModal();
    }
  });
};

const inlineHandlers = [
  'closeGameOverModal',
  'closeGuideModal',
  'closeStatsModal',
  'copyRemoteRoomCode',
  'isolateLayer',
  'joinRemoteRoom',
  'leaveRemoteRoom',
  'onGameOverModalClick',
  'onGuideModalClick',
  'onStatsModalClick',
  'openGuideModal',
  'openStatsModal',
  'reopenGameOverModal',
  'resetGame',
  'resetGameFromModal',
  'set2PMode',
  'set3PMode',
  'setCameraPreset',
  'setDifficulty',
  'setExplode',
  'setHumanPlaySetup',
  'setPrimaryMode',
  'setRemoteRoomAction',
  'setViewMode',
  'switchGuideTab',
  'switchModalTab',
  'toggleAudio',
  'toggleSidebar',
  'toggleViewModeMobile',
];
for (const handler of inlineHandlers) window[handler] = state[handler];
window.addEventListener('DOMContentLoaded', state.init);
