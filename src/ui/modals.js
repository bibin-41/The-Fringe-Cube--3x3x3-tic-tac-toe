import { state } from '../state.js';

// Mobile Telemetry Modal & Handlers
// ═══════════════════════════════════════════════════════════════

state.openStatsModal = function openStatsModal() {
  const modal = document.getElementById('statsModal');
  if (modal) {
    modal.classList.add('open');
    state.updateMoveLog();
    state.updateLinesChecklist();
  }
};

state.closeStatsModal = function closeStatsModal() {
  const modal = document.getElementById('statsModal');
  if (modal) modal.classList.remove('open');
};

state.onStatsModalClick = function onStatsModalClick(e) {
  if (e.target.id === 'statsModal') {
    state.closeStatsModal();
  }
};

state.switchModalTab = function switchModalTab(tab) {
  const isMoves = tab === 'moves';
  const tabM = document.getElementById('modalTabMoves');
  const tabL = document.getElementById('modalTabLines');
  const viewM = document.getElementById('modalMoveLogView');
  const viewL = document.getElementById('modalLinesView');
  if (tabM) tabM.classList.toggle('active', isMoves);
  if (tabL) tabL.classList.toggle('active', !isMoves);
  if (viewM) viewM.classList.toggle('active', isMoves);
  if (viewL) viewL.classList.toggle('active', !isMoves);
};

// ═══════════════════════════════════════════════════════════════
// Game Over / Match Result Modal Handlers
// ═══════════════════════════════════════════════════════════════

state.getDifficultyDisplay = function getDifficultyDisplay(diff) {
  if (diff === 'easy') return 'Easy';
  if (diff === 'medium') return 'Medium';
  if (diff === 'hard') return 'Hard';
  return 'Medium';
};

state.getGameModeDisplayString = function getGameModeDisplayString() {
  const diffStr = state.getDifficultyDisplay(state.aiDifficulty);
  if (
    state.primaryMode === '2p' ||
    state.gameMode === 'ai' ||
    state.gameMode === 'pvp'
  ) {
    if (state.mode2P === 'ai' || state.gameMode === 'ai') {
      return `2P vs AI (${diffStr})`;
    } else {
      return `2P vs Human`;
    }
  } else {
    // 3P mode
    if (state.botMode3P === '0') {
      return `3P: 3 Humans`;
    } else if (state.botMode3P === '1') {
      return `3P: 2 Humans & 1Bot (${diffStr})`;
    } else if (state.botMode3P === '2') {
      return `3P: 1 Human and 2 Bots (${diffStr})`;
    }
    return `3P Mode`;
  }
};

state.showGameOverModal = function showGameOverModal(info) {
  state.lastGameResult = info;
  const modal = document.getElementById('gameOverModal');
  const dialog = document.getElementById('gameOverDialog');
  const avatar = document.getElementById('gameOverAvatar');
  const title = document.getElementById('gameOverTitle');
  const subtitle = document.getElementById('gameOverSubtitle');
  const modeVal = document.getElementById('gameOverMode');
  const lineCard = document.getElementById('cardWinLine');
  const lineVal = document.getElementById('gameOverLine');
  const movesVal = document.getElementById('gameOverMoves');
  const scoreVal = document.getElementById('gameOverScoreTally');
  const tag = document.getElementById('gameOverTag');

  if (!modal || !dialog) return;

  dialog.className = 'game-over-dialog';

  if (info.isDraw) {
    dialog.classList.add('winner-draw');
    if (avatar) avatar.textContent = '⚖';
    if (title) title.textContent = 'MATCH DRAW';
    if (subtitle)
      subtitle.textContent = 'Grid saturated. No alignment achieved.';
    if (tag) tag.textContent = 'STALEMATE';
    if (lineCard) lineCard.style.display = 'none';
  } else {
    const winner = info.winner;
    let winnerName = 'PLAYER X';
    let winClass = 'winner-x';
    let winSymbol = '✕';

    if (winner === state.X) {
      winnerName = 'PLAYER X';
      winClass = 'winner-x';
      winSymbol = '✕';
    } else if (winner === state.O) {
      winnerName =
        state.gameMode === 'ai'
          ? 'AI [O]'
          : state.gameMode === '3p' && state.botMode3P === '2'
            ? 'BOT [O]'
            : 'PLAYER O';
      winClass = 'winner-o';
      winSymbol = '◯';
    } else if (winner === state.TRIANGLE) {
      winnerName =
        state.gameMode === '3p' &&
        (state.botMode3P === '1' || state.botMode3P === '2')
          ? 'BOT [△]'
          : 'PLAYER △';
      winClass = 'winner-tri';
      winSymbol = '△';
    }

    dialog.classList.add(winClass);
    if (avatar) avatar.textContent = winSymbol;
    if (title) title.textContent = `${winnerName} WINS!`;
    if (subtitle) {
      if (
        (state.primaryMode === '2p' || state.gameMode === 'ai') &&
        (state.mode2P === 'ai' || state.gameMode === 'ai') &&
        winner === state.O
      ) {
        subtitle.textContent = `AI (${state.getDifficultyDisplay(state.aiDifficulty)}) triumphs over player`;
      } else if (
        (state.primaryMode === '2p' || state.gameMode === 'ai') &&
        (state.mode2P === 'ai' || state.gameMode === 'ai') &&
        winner === state.X
      ) {
        subtitle.textContent = `Human player overcomes AI (${state.getDifficultyDisplay(state.aiDifficulty)})!`;
      } else if (
        (state.primaryMode === '3p' || state.gameMode === '3p') &&
        (state.botMode3P === '1' || state.botMode3P === '2') &&
        (winner === state.O || winner === state.TRIANGLE)
      ) {
        subtitle.textContent = `AI Bot (${state.getDifficultyDisplay(state.aiDifficulty)}) claims the 3D grid!`;
      } else {
        subtitle.textContent = 'Three-dimensional alignment confirmed';
      }
    }
    if (tag) tag.textContent = 'VICTORY';

    if (lineCard) {
      lineCard.style.display = 'flex';
      const lineLabel =
        info.lineIndex !== undefined && state.WIN_LINE_LABELS[info.lineIndex]
          ? state.WIN_LINE_LABELS[info.lineIndex]
          : 'Linear Trio';
      if (lineVal) lineVal.textContent = lineLabel;
    }
  }

  if (modeVal) modeVal.textContent = state.getGameModeDisplayString();
  if (movesVal) movesVal.textContent = `${state.moveHistory.length} / 27 MOVES`;
  if (scoreVal) {
    if (state.gameMode === '3p') {
      scoreVal.textContent = `X: ${state.scores.x} · O: ${state.scores.o} · △: ${state.scores.tri} · D: ${state.scores.draw}`;
    } else {
      scoreVal.textContent = `X: ${state.scores.x} · O: ${state.scores.o} · D: ${state.scores.draw}`;
    }
  }

  modal.classList.add('open');

  const mobBtnResult = document.getElementById('mobBtnResult');
  if (mobBtnResult) mobBtnResult.style.display = 'inline-flex';
};

state.closeGameOverModal = function closeGameOverModal() {
  const modal = document.getElementById('gameOverModal');
  if (modal) modal.classList.remove('open');
};

state.reopenGameOverModal = function reopenGameOverModal() {
  if (state.lastGameResult) {
    state.showGameOverModal(state.lastGameResult);
  }
};

state.resetGameFromModal = function resetGameFromModal() {
  state.closeGameOverModal();
  state.resetGame();
};

state.onGameOverModalClick = function onGameOverModalClick(e) {
  if (e.target.id === 'gameOverModal') {
    state.closeGameOverModal();
  }
};

// ═══════════════════════════════════════════════════════════════
// Detailed Guide Modal Handlers
// ═══════════════════════════════════════════════════════════════

state.openGuideModal = function openGuideModal() {
  const modal = document.getElementById('guideModal');
  if (modal) modal.classList.add('open');
};

state.closeGuideModal = function closeGuideModal() {
  const modal = document.getElementById('guideModal');
  if (modal) modal.classList.remove('open');
};

state.onGuideModalClick = function onGuideModalClick(e) {
  if (e.target.id === 'guideModal') {
    state.closeGuideModal();
  }
};

state.switchGuideTab = function switchGuideTab(tabId) {
  const tabs = ['overview', 'lines', 'modes', 'controls', 'tactics'];
  tabs.forEach((t) => {
    const btn = document.getElementById(
      'tabGuide' + t.charAt(0).toUpperCase() + t.slice(1),
    );
    const content = document.getElementById('guideTabContent-' + t);
    const isActive = t === tabId;
    if (btn) {
      btn.classList.toggle('active', isActive);
      if (isActive && typeof btn.scrollIntoView === 'function') {
        btn.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
    if (content) content.classList.toggle('active', isActive);
  });
  const body = document.getElementById('guideModalBody');
  if (body) body.scrollTop = 0;
};

// ═══════════════════════════════════════════════════════════════
