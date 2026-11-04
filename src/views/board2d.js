import { state } from '../state.js';

// 2D Flat View
// ═══════════════════════════════════════════════════════════════

state.buildFlatView = function buildFlatView() {
  const container = document.getElementById('flat-view');
  container.innerHTML = '';

  const planesContainer = document.createElement('div');
  planesContainer.className = 'flat-planes-container';
  planesContainer.id = 'flatPlanesContainer';

  for (let y = 0; y < 3; y++) {
    const plane = document.createElement('div');
    plane.className = 'flat-plane';
    plane.dataset.layerIndex = y;

    const label = document.createElement('div');
    label.className = 'flat-plane-label';
    label.textContent = `LAYER ${y + 1} ${y === 0 ? '(BOTTOM)' : y === 1 ? '(MID)' : '(TOP)'}`;
    plane.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'flat-grid';

    for (let z = 0; z < 3; z++) {
      for (let x = 0; x < 3; x++) {
        const ci = state.idx(x, y, z);
        const cell = document.createElement('div');
        cell.className = 'flat-cell';
        cell.dataset.cellIndex = ci;
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.dataset.z = z;

        cell.addEventListener('click', () => {
          if (
            state.board[ci] === state.EMPTY &&
            !state.gameOver &&
            !state.isCurrentPlayerBot()
          ) {
            state.makeMove(ci);
          }
        });

        cell.addEventListener('mouseenter', () => {
          if (state.board[ci] === state.EMPTY && !state.gameOver) {
            state.playSound('hover');
            state.highlightPillar(x, z, y);
            if (!state.isCurrentPlayerBot()) {
              const ghostClass =
                state.currentPlayer === state.X
                  ? 'ghost-x'
                  : state.currentPlayer === state.O
                    ? 'ghost-o'
                    : 'ghost-tri';
              cell.classList.add(ghostClass);
              cell.textContent = state.getPlayerSymbol(state.currentPlayer);
            }
          }
        });

        cell.addEventListener('mouseleave', () => {
          state.clearPillarHighlights();
          if (state.board[ci] === state.EMPTY) {
            cell.classList.remove('ghost-x', 'ghost-o', 'ghost-tri');
            cell.textContent = '';
          }
        });

        grid.appendChild(cell);
      }
    }

    plane.appendChild(grid);
    planesContainer.appendChild(plane);
  }

  container.appendChild(planesContainer);
};

state.updateFlatView = function updateFlatView() {
  const cells = document.querySelectorAll('.flat-cell');
  cells.forEach((cell) => {
    const ci = parseInt(cell.dataset.cellIndex);
    cell.className = 'flat-cell';
    cell.textContent = '';

    if (state.board[ci] === state.X) {
      cell.classList.add('x-cell');
      cell.textContent = '✕';
    } else if (state.board[ci] === state.O) {
      cell.classList.add('o-cell');
      cell.textContent = '◯';
    } else if (state.board[ci] === state.TRIANGLE) {
      cell.classList.add('tri-cell');
      cell.textContent = '△';
    }

    // Win highlighting
    if (state.winLine && state.winLine.includes(ci)) {
      cell.classList.add('winning-cell');
    } else if (state.winLine) {
      cell.classList.add('dimmed');
    }
  });
};

state.highlightPillar = function highlightPillar(x, z, activeY) {
  const cells = document.querySelectorAll('.flat-cell');
  cells.forEach((cell) => {
    const cx = parseInt(cell.dataset.x);
    const cz = parseInt(cell.dataset.z);
    const cy = parseInt(cell.dataset.y);
    if (cx === x && cz === z && cy !== activeY) {
      cell.classList.add('pillar-highlight');
    }
  });
};

state.clearPillarHighlights = function clearPillarHighlights() {
  document.querySelectorAll('.flat-cell.pillar-highlight').forEach((c) => {
    c.classList.remove('pillar-highlight');
  });
};

// ═══════════════════════════════════════════════════════════════
