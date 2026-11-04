import { state } from '../state.js';

state.getPlayerColorHex = function getPlayerColorHex(player) {
  if (player === state.X) return state.CYAN;
  if (player === state.O) return state.PINK;
  if (player === state.TRIANGLE) return state.TRI_COLOR;
  return 0x2a3055;
};

state.getPlayerSymbol = function getPlayerSymbol(player) {
  if (player === state.X) return '✕';
  if (player === state.O) return '◯';
  if (player === state.TRIANGLE) return '△';
  return '';
};

state.isCurrentPlayerBot = function isCurrentPlayerBot() {
  if (
    state.primaryMode === '2p' ||
    state.gameMode === 'ai' ||
    state.gameMode === 'pvp'
  ) {
    return (
      (state.mode2P === 'ai' || state.gameMode === 'ai') &&
      state.currentPlayer === state.O
    );
  }
  if (state.primaryMode === '3p' || state.gameMode === '3p') {
    if (state.botMode3P === '1') return state.currentPlayer === state.TRIANGLE;
    if (state.botMode3P === '2')
      return (
        state.currentPlayer === state.O ||
        state.currentPlayer === state.TRIANGLE
      );
  }
  return false;
};

// ── 49 Winning Lines ─────────────────────────────────────────
// index = y*9 + z*3 + x  (layer=y, row=z, col=x)
state.idx = function idx(x, y, z) {
  return y * 9 + z * 3 + x;
};

state.WIN_LINES.length = 0;
state.WIN_LINE_LABELS.length = 0;

// Helper to add a line
state.addLine = function addLine(cells, label) {
  state.WIN_LINES.push(cells);
  state.WIN_LINE_LABELS.push(label);
};

// 9 rows per axis direction × 3 axes = 27 axial lines
// X-axis rows (along x for fixed y,z)
for (let y = 0; y < 3; y++)
  for (let z = 0; z < 3; z++)
    state.addLine(
      [state.idx(0, y, z), state.idx(1, y, z), state.idx(2, y, z)],
      `X-Row L${y + 1} R${z + 1}`,
    );

// Y-axis columns (along y for fixed x,z)
for (let x = 0; x < 3; x++)
  for (let z = 0; z < 3; z++)
    state.addLine(
      [state.idx(x, 0, z), state.idx(x, 1, z), state.idx(x, 2, z)],
      `Y-Col C${x + 1} R${z + 1}`,
    );

// Z-axis columns (along z for fixed x,y)
for (let x = 0; x < 3; x++)
  for (let y = 0; y < 3; y++)
    state.addLine(
      [state.idx(x, y, 0), state.idx(x, y, 1), state.idx(x, y, 2)],
      `Z-Col C${x + 1} L${y + 1}`,
    );

// 18 planar diagonals (2 diagonals × 3 slices × 3 planes)
// XY plane diagonals (fixed z)
for (let z = 0; z < 3; z++) {
  state.addLine(
    [state.idx(0, 0, z), state.idx(1, 1, z), state.idx(2, 2, z)],
    `XY-Diag R${z + 1} ↘`,
  );
  state.addLine(
    [state.idx(2, 0, z), state.idx(1, 1, z), state.idx(0, 2, z)],
    `XY-Diag R${z + 1} ↙`,
  );
}
// XZ plane diagonals (fixed y)
for (let y = 0; y < 3; y++) {
  state.addLine(
    [state.idx(0, y, 0), state.idx(1, y, 1), state.idx(2, y, 2)],
    `XZ-Diag L${y + 1} ↘`,
  );
  state.addLine(
    [state.idx(2, y, 0), state.idx(1, y, 1), state.idx(0, y, 2)],
    `XZ-Diag L${y + 1} ↙`,
  );
}
// YZ plane diagonals (fixed x)
for (let x = 0; x < 3; x++) {
  state.addLine(
    [state.idx(x, 0, 0), state.idx(x, 1, 1), state.idx(x, 2, 2)],
    `YZ-Diag C${x + 1} ↘`,
  );
  state.addLine(
    [state.idx(x, 2, 0), state.idx(x, 1, 1), state.idx(x, 0, 2)],
    `YZ-Diag C${x + 1} ↙`,
  );
}

// 4 space diagonals
state.addLine(
  [state.idx(0, 0, 0), state.idx(1, 1, 1), state.idx(2, 2, 2)],
  'Space Diag 1',
);
state.addLine(
  [state.idx(2, 0, 0), state.idx(1, 1, 1), state.idx(0, 2, 2)],
  'Space Diag 2',
);
state.addLine(
  [state.idx(0, 0, 2), state.idx(1, 1, 1), state.idx(2, 2, 0)],
  'Space Diag 3',
);
state.addLine(
  [state.idx(2, 0, 2), state.idx(1, 1, 1), state.idx(0, 2, 0)],
  'Space Diag 4',
);

// Precomputed cell to winning lines index map & strategic anchors
state.CELL_WIN_LINES = Array.from({ length: 27 }, () => []);
for (let i = 0; i < state.WIN_LINES.length; i++) {
  for (let j = 0; j < 3; j++) {
    state.CELL_WIN_LINES[state.WIN_LINES[i][j]].push(i);
  }
}

// ── Coordinate helpers ───────────────────────────────────────
state.idxToCoord = function idxToCoord(i) {
  const y = Math.floor(i / 9);
  const z = Math.floor((i % 9) / 3);
  const x = i % 3;
  return { x, y, z };
};

state.coordLabel = function coordLabel(i) {
  const c = state.idxToCoord(i);
  return `L${c.y + 1}(${c.x},${c.z})`;
};

// ── Win Detection ────────────────────────────────────────────
state.checkWin = function checkWin(b) {
  for (let i = 0; i < state.WIN_LINES.length; i++) {
    const [a, bb, c] = state.WIN_LINES[i];
    if (b[a] !== state.EMPTY && b[a] === b[bb] && b[bb] === b[c]) {
      return { winner: b[a], line: state.WIN_LINES[i], lineIndex: i };
    }
  }
  return null;
};

state.fastCheckWin = function fastCheckWin(b) {
  for (let i = 0; i < state.WIN_LINES.length; i++) {
    const line = state.WIN_LINES[i];
    const v = b[line[0]];
    if (v !== state.EMPTY && v === b[line[1]] && v === b[line[2]]) {
      return v;
    }
  }
  return 0;
};

state.isBoardFull = function isBoardFull(b) {
  return b.every((c) => c !== state.EMPTY);
};

// ═══════════════════════════════════════════════════════════════
