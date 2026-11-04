import { state } from '../state.js';

state.toggleSidebar = function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const btn = document.getElementById('hamburgerBtn');
  const isOpen = sidebar.classList.contains('open');

  if (isOpen) {
    sidebar.classList.remove('open');
    btn.classList.remove('open');
    overlay.classList.remove('visible');
    setTimeout(() => overlay.classList.remove('open'), 300);
  } else {
    overlay.classList.add('open');
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      sidebar.classList.add('open');
      btn.classList.add('open');
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// UI Updates
// ═══════════════════════════════════════════════════════════════

state.updateTurnDisplay = function updateTurnDisplay() {
  const el = document.getElementById('turnIndicator');
  const text = document.getElementById('turnText');
  el.className =
    'turn-indicator ' +
    (state.currentPlayer === state.X
      ? 'x-turn'
      : state.currentPlayer === state.O
        ? 'o-turn'
        : 'tri-turn');
  let label = 'PLAYER X';
  if (state.currentPlayer === state.O) {
    label =
      state.gameMode === 'ai'
        ? 'AI [O]'
        : state.gameMode === '3p' && state.botMode3P === '2'
          ? 'BOT [O]'
          : 'PLAYER O';
  } else if (state.currentPlayer === state.TRIANGLE) {
    label =
      state.gameMode === '3p' &&
      (state.botMode3P === '1' || state.botMode3P === '2')
        ? 'BOT [△]'
        : 'PLAYER △';
  }
  text.textContent = label;
};

state.updateStatusDisplay = function updateStatusDisplay() {
  const badge = document.getElementById('statusBadge');
  if (state.gameOver) {
    if (state.winLine) {
      const winner = state.board[state.winLine[0]];
      let winClass = 'win-x';
      let winText = '✕ WINS';
      if (winner === state.O) {
        winClass = 'win-o';
        winText = '◯ WINS';
      } else if (winner === state.TRIANGLE) {
        winClass = 'win-tri';
        winText = '△ WINS';
      }
      badge.className = 'status-badge ' + winClass;
      badge.textContent = winText;
    } else {
      badge.className = 'status-badge draw';
      badge.textContent = 'DRAW';
    }
    badge.title = 'Click to view match summary';
  } else {
    badge.className = 'status-badge active';
    badge.textContent = 'ACTIVE';
    badge.title = '';
  }
};

state.updateScoreboard = function updateScoreboard() {
  document.getElementById('scoreX').textContent = state.scores.x;
  document.getElementById('scoreO').textContent = state.scores.o;
  const scoreTriEl = document.getElementById('scoreTri');
  if (scoreTriEl) scoreTriEl.textContent = state.scores.tri;
  document.getElementById('scoreDraw').textContent = state.scores.draw;

  // Mobile Quick Ribbon
  const mobX = document.getElementById('mobScoreX');
  const mobO = document.getElementById('mobScoreO');
  const mobTri = document.getElementById('mobScoreTri');
  const mobDraw = document.getElementById('mobScoreDraw');
  if (mobX) mobX.textContent = state.scores.x;
  if (mobO) mobO.textContent = state.scores.o;
  if (mobTri) mobTri.textContent = state.scores.tri;
  if (mobDraw) mobDraw.textContent = state.scores.draw;
};

state.updateMoveLog = function updateMoveLog() {
  const moveStr = `${state.moveHistory.length} / 27`;
  document.getElementById('moveCount').textContent = moveStr;
  const modalMoveCount = document.getElementById('modalMoveCount');
  if (modalMoveCount)
    modalMoveCount.textContent = `${state.moveHistory.length}/27`;

  const log = document.getElementById('historyLog');
  const modalLog = document.getElementById('modalHistoryLog');
  if (log) log.innerHTML = '';
  if (modalLog) modalLog.innerHTML = '';

  state.moveHistory.forEach((m, i) => {
    const pClass =
      m.player === state.X
        ? 'x-move'
        : m.player === state.O
          ? 'o-move'
          : 'tri-move';
    const html = `
          <span class="move-num">#${i + 1}</span>
          <span class="move-player">${state.getPlayerSymbol(m.player)}</span>
          <span class="move-pos">${state.coordLabel(m.cell)}</span>
        `;
    if (log) {
      const entry = document.createElement('div');
      entry.className = `history-entry ${pClass}`;
      entry.innerHTML = html;
      log.prepend(entry);
    }
    if (modalLog) {
      const mEntry = document.createElement('div');
      mEntry.className = `history-entry ${pClass}`;
      mEntry.innerHTML = html;
      modalLog.prepend(mEntry);
    }
  });
};

state.updateLinesChecklist = function updateLinesChecklist() {
  const container = document.getElementById('linesChecklist');
  const modalContainer = document.getElementById('modalLinesChecklist');
  if (container) container.innerHTML = '';
  if (modalContainer) modalContainer.innerHTML = '';

  state.WIN_LINES.forEach((line, i) => {
    const [a, b, c] = line;
    const item = document.createElement('div');
    const label = state.WIN_LINE_LABELS[i];
    const isWon =
      state.board[a] !== state.EMPTY &&
      state.board[a] === state.board[b] &&
      state.board[b] === state.board[c];
    const wonClass = isWon
      ? state.board[a] === state.X
        ? 'x-won'
        : state.board[a] === state.O
          ? 'o-won'
          : 'tri-won'
      : '';
    const text = isWon ? `✓ ${label}` : label;

    if (container) {
      const cItem = document.createElement('div');
      cItem.className = 'line-item' + (wonClass ? ' ' + wonClass : '');
      cItem.textContent = text;
      container.appendChild(cItem);
    }
    if (modalContainer) {
      const mItem = document.createElement('div');
      mItem.className = 'line-item' + (wonClass ? ' ' + wonClass : '');
      mItem.textContent = text;
      modalContainer.appendChild(mItem);
    }
  });
};

// ═══════════════════════════════════════════════════════════════
