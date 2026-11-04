import { state } from '../state.js';

// Game Logic
// ═══════════════════════════════════════════════════════════════

state.makeMove = function makeMove(cellIndex, { fromNetwork = false } = {}) {
  if (state.board[cellIndex] !== state.EMPTY || state.gameOver) return;
  const supportsRemotePlay =
    (state.primaryMode === '2p' && state.mode2P === 'human') ||
    (state.primaryMode === '3p' && state.botMode3P !== '2');
  if (
    !fromNetwork &&
    ((state.humanPlaySetup === 'remote' && supportsRemotePlay) || state.network)
  ) {
    if (!state.network) {
      state.showWarning?.('Cannot play: Create or join an online room first!');
      return;
    }
    const disconnectedPlayer = state.remotePlayers.find(
      (p) => !p.connected && p.symbol !== null,
    );
    if (disconnectedPlayer) {
      state.showWarning?.(
        `Cannot play: ${disconnectedPlayer.name} left the match!`,
      );
      return;
    }
    if (!state.remoteReadyToPlay) {
      const connectedCount = state.remotePlayers.filter(
        (p) => p.connected,
      ).length;
      const expected = state.remoteExpectedPlayers || 2;
      state.showWarning?.(
        `Cannot play: Waiting for all players to join (${connectedCount}/${expected})!`,
      );
      return;
    }
    if (
      state.currentPlayer !== state.localPlayerSymbol &&
      !(state.remoteIsHost && state.isCurrentPlayerBot())
    ) {
      state.showWarning?.("It is not your turn! Waiting for opponent's move.");
      return;
    }
  }

  state.board[cellIndex] = state.currentPlayer;
  state.moveHistory.push({ player: state.currentPlayer, cell: cellIndex });
  if (state.network && !fromNetwork) {
    state.broadcastRemoteMessage({
      type: 'move',
      cell: cellIndex,
      player: state.currentPlayer,
      sequence: state.moveHistory.length,
    });
  }

  state.playSound(
    state.currentPlayer === state.X
      ? 'moveX'
      : state.currentPlayer === state.O
        ? 'moveO'
        : 'moveTri',
  );

  // Update 3D
  state.placeGlyph3D(cellIndex);
  state.updateCellHighlights();
  state.updateGhostPreview();

  // Update 2D
  state.updateFlatView();

  // Check win
  const result = state.checkWin(state.board);
  if (result) {
    state.gameOver = true;
    state.winLine = result.line;
    const winner = result.winner;

    // Update score
    if (winner === state.X) state.scores.x++;
    else if (winner === state.O) state.scores.o++;
    else if (winner === state.TRIANGLE) state.scores.tri++;
    state.updateScoreboard();

    // Win visuals
    state.drawWinLine3D(result.line);
    state.updateCellHighlights();
    state.updateFlatView();
    state.updateStatusDisplay();
    state.updateLinesChecklist();
    state.playSound('win');

    setTimeout(() => {
      state.showGameOverModal({
        isDraw: false,
        winner: winner,
        winLine: result.line,
        lineIndex: result.lineIndex,
      });
    }, 600);
    return;
  }

  if (state.isBoardFull(state.board)) {
    state.gameOver = true;
    state.scores.draw++;
    state.updateScoreboard();
    state.updateStatusDisplay();
    state.playSound('draw');

    setTimeout(() => {
      state.showGameOverModal({
        isDraw: true,
      });
    }, 600);
    return;
  }

  // Switch player
  if (state.gameMode === '3p') {
    if (state.currentPlayer === state.X) state.currentPlayer = state.O;
    else if (state.currentPlayer === state.O)
      state.currentPlayer = state.TRIANGLE;
    else state.currentPlayer = state.X;
  } else {
    state.currentPlayer = state.currentPlayer === state.X ? state.O : state.X;
  }
  state.updateTurnDisplay();
  state.updateMoveLog();
  state.updateRemoteConnectionStatus?.();

  // AI move
  if (
    state.isCurrentPlayerBot() &&
    !state.gameOver &&
    (!state.network || state.remoteIsHost)
  ) {
    setTimeout(() => {
      const aiMove = state.getAIMove();
      if (aiMove !== -1) state.makeMove(aiMove);
    }, 400);
  }
};

state.resetGame = function resetGame({ broadcast = true } = {}) {
  if (state.network && broadcast) {
    state.broadcastRemoteMessage({ type: 'reset' });
  }
  state.board = new Array(27).fill(state.EMPTY);
  state.currentPlayer = state.X;
  state.gameOver = false;
  state.winLine = null;
  state.moveHistory = [];
  state.hoveredCell = -1;
  state.lastGameResult = null;
  state.closeGameOverModal();
  const mobBtnResult = document.getElementById('mobBtnResult');
  if (mobBtnResult) mobBtnResult.style.display = 'none';

  state.clearWinLines3D();

  state.buildCells();
  state.updateCellPositions();
  state.updateFlatView();
  state.updateTurnDisplay();
  state.updateStatusDisplay();
  state.updateMoveLog();
  state.updateLinesChecklist();

  state.playSound('draw');

  document.getElementById('historyLog').innerHTML = '';
};

// ═══════════════════════════════════════════════════════════════
