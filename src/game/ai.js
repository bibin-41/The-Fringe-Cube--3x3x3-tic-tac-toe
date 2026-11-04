import { state } from '../state.js';

// AI Engine
// ═══════════════════════════════════════════════════════════════

state.getAIMove = function getAIMove() {
  const available = [];
  for (let i = 0; i < 27; i++) {
    if (state.board[i] === state.EMPTY) available.push(i);
  }
  if (available.length === 0) return -1;

  if (state.aiDifficulty === 'easy') {
    return available[Math.floor(Math.random() * available.length)];
  }

  if (state.gameMode === '3p') {
    return state.threePlayerAI(
      available,
      state.currentPlayer,
      state.aiDifficulty,
    );
  }

  if (state.aiDifficulty === 'medium') {
    return state.tacticalAI(available);
  }

  return state.cyberCoreAI(available);
};

state.threePlayerAI = function threePlayerAI(available, aiPlayer, diff) {
  // 1. Can AI win immediately?
  for (const move of available) {
    state.board[move] = aiPlayer;
    const win = state.checkWin(state.board);
    state.board[move] = state.EMPTY;
    if (win) return move;
  }

  // 2. Can any opponent win on their next turn? Block!
  const opponents = [state.X, state.O, state.TRIANGLE].filter(
    (p) => p !== aiPlayer,
  );
  for (const opp of opponents) {
    for (const move of available) {
      state.board[move] = opp;
      const win = state.checkWin(state.board);
      state.board[move] = state.EMPTY;
      if (win) return move;
    }
  }

  // 3. Medium: take center if free, else random corner/move
  if (diff === 'medium') {
    if (state.board[13] === state.EMPTY) return 13;
    const corners = [0, 2, 6, 8, 18, 20, 24, 26].filter(
      (c) => state.board[c] === state.EMPTY,
    );
    if (corners.length > 0 && Math.random() < 0.75) {
      return corners[Math.floor(Math.random() * corners.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  }

  // 4. Cyber (Tactical positional scoring):
  let bestScore = -Infinity;
  let bestMove = available[0];
  const corners = new Set([0, 2, 6, 8, 18, 20, 24, 26]);

  for (const move of available) {
    let score = 0;
    if (move === 13) score += 15;
    else if (corners.has(move)) score += 6;

    for (const line of state.WIN_LINES) {
      if (line.includes(move)) {
        const [a, b, c] = line;
        const vals = [state.board[a], state.board[b], state.board[c]];
        const aiCount = vals.filter((v) => v === aiPlayer).length;
        const oppCount = vals.filter(
          (v) => v !== state.EMPTY && v !== aiPlayer,
        ).length;

        if (oppCount === 0) {
          if (aiCount === 1) score += 9;
          else if (aiCount === 0) score += 3;
        } else if (aiCount === 0) {
          if (oppCount === 1) score += 4;
        }
      }
    }
    score += Math.random() * 0.6;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
};

state.tacticalAI = function tacticalAI(available) {
  // 1. Win if possible
  for (const move of available) {
    state.board[move] = state.O;
    if (state.checkWin(state.board)) {
      state.board[move] = state.EMPTY;
      return move;
    }
    state.board[move] = state.EMPTY;
  }

  // 2. Block opponent win
  for (const move of available) {
    state.board[move] = state.X;
    if (state.checkWin(state.board)) {
      state.board[move] = state.EMPTY;
      return move;
    }
    state.board[move] = state.EMPTY;
  }

  // 3. Center
  if (state.board[13] === state.EMPTY) return 13;

  // 4. Random
  return available[Math.floor(Math.random() * available.length)];
};

state.scoreCandidateMove = function scoreCandidateMove(b, m, player) {
  let score = 0;
  if (m === 13) score += 50;
  else if (state.CORNERS.indexOf(m) !== -1) score += 20;

  const lines = state.CELL_WIN_LINES[m];
  const opp = player === state.O ? state.X : state.O;
  for (let i = 0; i < lines.length; i++) {
    const line = state.WIN_LINES[lines[i]];
    const c1 = b[line[0]],
      c2 = b[line[1]],
      c3 = b[line[2]];
    const pCount =
      (c1 === player ? 1 : 0) +
      (c2 === player ? 1 : 0) +
      (c3 === player ? 1 : 0);
    const oppCount =
      (c1 === opp ? 1 : 0) + (c2 === opp ? 1 : 0) + (c3 === opp ? 1 : 0);
    if (oppCount === 0) {
      score += pCount === 2 ? 15 : 5;
    } else if (pCount === 0 && oppCount === 2) {
      score += 40; // Critical block line
    }
  }
  return score;
};

state.cyberCoreAI = function cyberCoreAI(available) {
  // 1. Immediate Win (1-ply instant strike)
  for (let i = 0; i < available.length; i++) {
    const m = available[i];
    state.board[m] = state.O;
    if (state.fastCheckWin(state.board) === state.O) {
      state.board[m] = state.EMPTY;
      return m;
    }
    state.board[m] = state.EMPTY;
  }

  // 2. Immediate Block (1-ply critical counter)
  for (let i = 0; i < available.length; i++) {
    const m = available[i];
    state.board[m] = state.X;
    if (state.fastCheckWin(state.board) === state.X) {
      state.board[m] = state.EMPTY;
      return m;
    }
    state.board[m] = state.EMPTY;
  }

  // 3. Opening book for first response: instant optimal anchor (0ms)
  if (available.length >= 26) {
    if (state.board[13] === state.EMPTY) return 13;
    for (let i = 0; i < state.CORNERS.length; i++) {
      if (state.board[state.CORNERS[i]] === state.EMPTY)
        return state.CORNERS[i];
    }
  }

  // 4. Score and order candidate moves for high alpha-beta pruning efficiency
  const scoredMoves = [];
  for (let i = 0; i < available.length; i++) {
    const m = available[i];
    scoredMoves.push({
      move: m,
      score: state.scoreCandidateMove(state.board, m, state.O),
    });
  }
  scoredMoves.sort((a, b) => b.score - a.score);

  // Search top candidate moves (up to 12) to avoid evaluating non-strategic cells
  const candidateCount = Math.min(12, scoredMoves.length);
  const candidates = [];
  for (let i = 0; i < candidateCount; i++) {
    candidates.push(scoredMoves[i].move);
  }

  // Adaptive depth: fast opening/midgame, deeper endgame
  const maxDepth = available.length >= 18 ? 2 : available.length >= 10 ? 3 : 4;

  let bestScore = -Infinity;
  let bestMove = candidates[0];

  for (let i = 0; i < candidates.length; i++) {
    const move = candidates[i];
    state.board[move] = state.O;
    const score = state.minimax(
      state.board,
      0,
      false,
      -Infinity,
      Infinity,
      maxDepth,
    );
    state.board[move] = state.EMPTY;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
};

state.minimax = function minimax(
  b,
  depth,
  isMaximizing,
  alpha,
  beta,
  maxDepth,
) {
  const winner = state.fastCheckWin(b);
  if (winner !== 0) {
    return winner === state.O ? 1000 - depth : -1000 + depth;
  }
  if (depth >= maxDepth || state.isBoardFull(b)) {
    return state.evaluateBoard(b);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let i = 0; i < 27; i++) {
      if (b[i] !== state.EMPTY) continue;
      b[i] = state.O;
      const ev = state.minimax(b, depth + 1, false, alpha, beta, maxDepth);
      b[i] = state.EMPTY;
      if (ev > maxEval) maxEval = ev;
      if (ev > alpha) alpha = ev;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let i = 0; i < 27; i++) {
      if (b[i] !== state.EMPTY) continue;
      b[i] = state.X;
      const ev = state.minimax(b, depth + 1, true, alpha, beta, maxDepth);
      b[i] = state.EMPTY;
      if (ev < minEval) minEval = ev;
      if (ev < beta) beta = ev;
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

state.evaluateBoard = function evaluateBoard(b) {
  let score = 0;
  for (let i = 0; i < state.WIN_LINES.length; i++) {
    const line = state.WIN_LINES[i];
    const c1 = b[line[0]],
      c2 = b[line[1]],
      c3 = b[line[2]];
    const oCount =
      (c1 === state.O ? 1 : 0) +
      (c2 === state.O ? 1 : 0) +
      (c3 === state.O ? 1 : 0);
    const xCount =
      (c1 === state.X ? 1 : 0) +
      (c2 === state.X ? 1 : 0) +
      (c3 === state.X ? 1 : 0);

    if (oCount > 0 && xCount === 0) {
      score += oCount === 2 ? 25 : 3;
    } else if (xCount > 0 && oCount === 0) {
      score -= xCount === 2 ? 30 : 3;
    }
  }
  // Center bonus
  if (b[13] === state.O) score += 10;
  else if (b[13] === state.X) score -= 10;
  return score;
};

// ═══════════════════════════════════════════════════════════════
