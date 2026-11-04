import { Network } from '@poki/netlib';
import { state } from '../state.js';

const GAME_ID =
  import.meta.env.VITE_POKI_GAME_ID || '45b0e470-c065-48ce-8df9-713c089064e8';

function getHumanSymbols(config = getLocalConfiguration()) {
  if (config.gameMode !== '3p') return [state.X, state.O];
  if (config.botMode3P === '0') {
    return [state.X, state.O, state.TRIANGLE];
  }
  if (config.botMode3P === '1') return [state.X, state.O];
  return [state.X];
}

function getExpectedPlayerCount(config = getLocalConfiguration()) {
  return getHumanSymbols(config).length;
}

function getLocalConfiguration() {
  return {
    gameMode: state.primaryMode === '3p' ? '3p' : '2p',
    botMode3P: state.botMode3P,
    aiDifficulty: state.aiDifficulty,
    playerName: getPlayerName(),
  };
}

function getPlayerName() {
  return (
    document.getElementById('remotePlayerName')?.value.trim().slice(0, 20) ||
    'Player'
  );
}

function setRoomStatus(message, isError = false) {
  state.remoteRoomStatus = message;
  const status = document.getElementById('remoteRoomStatus');
  if (status) {
    status.textContent = message;
    status.classList.toggle('error', isError);
  }
}

function getRoomErrorMessage(error, fallback) {
  if (error?.code === 'lobby-not-found') {
    return 'Room not found. The host may have left or changed modes. Ask them to create a new room and share its code.';
  }
  return error?.message || fallback;
}

function updateRoomDisplay() {
  const controls = document.getElementById('remoteRoomControls');
  const joinControls = document.getElementById('joinRoomControls');
  const createdRoomInfo = document.getElementById('createdRoomInfo');
  const playersSection = document.getElementById('remotePlayersSection');
  const leaveButton = document.getElementById('leaveRemoteRoom');
  const code = document.getElementById('remoteRoomCode');
  const list = document.getElementById('remotePlayers');

  if (controls) controls.style.display = 'block';
  if (joinControls) {
    joinControls.style.display =
      state.remoteRoomAction === 'join' && !state.remoteRoomCode
        ? 'block'
        : 'none';
  }
  if (createdRoomInfo) {
    createdRoomInfo.style.display =
      state.remoteIsHost && state.remoteRoomCode ? 'block' : 'none';
  }
  if (code) code.textContent = state.remoteRoomCode;
  if (playersSection) {
    playersSection.style.display = state.network ? 'block' : 'none';
  }
  if (leaveButton) leaveButton.style.display = state.network ? 'block' : 'none';
  if (list) {
    list.replaceChildren();
    for (const player of state.remotePlayers) {
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = `${player.name} (${symbolName(player.symbol)})`;
      const status = document.createElement('span');
      status.className = 'remote-player-status';
      status.textContent = player.id === state.network?.id ? 'YOU' : '';
      if (!player.connected) status.textContent += ' · DISCONNECTED';
      item.append(name, status);
      list.appendChild(item);
    }
    const botSymbols =
      state.primaryMode === '3p' && state.botMode3P === '1'
        ? [state.TRIANGLE]
        : state.primaryMode === '3p' && state.botMode3P === '2'
          ? [state.O, state.TRIANGLE]
          : [];
    for (const symbol of botSymbols) {
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = `AI (${symbolName(symbol)})`;
      const status = document.createElement('span');
      status.className = 'remote-player-status';
      status.textContent = 'BOT';
      item.append(name, status);
      list.appendChild(item);
    }
  }
  const createButton = document.getElementById('btnCreateRoom');
  const joinButton = document.getElementById('btnJoinRoom');
  const joinSubmit = document.getElementById('confirmJoinRoom');
  const isConnecting = state.remoteConnecting;
  if (createButton) createButton.disabled = isConnecting;
  if (joinButton) joinButton.disabled = isConnecting;
  if (joinSubmit) joinSubmit.disabled = isConnecting;
}

function symbolName(symbol) {
  if (symbol === state.X) return 'X';
  if (symbol === state.O) return 'O';
  if (symbol === state.TRIANGLE) return '△';
  return '…';
}

function updateConnectionStatus() {
  const connectedPlayers = state.remotePlayers.filter(
    (player) => player.connected,
  ).length;
  const requiredSymbols = getHumanSymbols();
  const connectedSymbols = new Set(
    state.remotePlayers
      .filter((player) => player.connected)
      .map((player) => player.symbol),
  );
  state.remoteReadyToPlay =
    state.remoteGameStateReady &&
    requiredSymbols.every((symbol) => connectedSymbols.has(symbol)) &&
    state.localPlayerSymbol !== null;

  if (state.remoteReadyToPlay) {
    const turn =
      state.currentPlayer === state.localPlayerSymbol ? 'Your turn.' : 'Opponent turn.';
    setRoomStatus(`All players connected. ${turn}`);
  } else {
    setRoomStatus(
      `Waiting for players (${connectedPlayers}/${state.remoteExpectedPlayers})…`,
    );
  }
  updateRoomDisplay();
}
state.updateRemoteConnectionStatus = updateConnectionStatus;

function getNextSymbol() {
  const used = new Set(state.remotePlayers.map((player) => player.symbol));
  return getHumanSymbols().find((symbol) => !used.has(symbol)) ?? null;
}

function getGameStateSnapshot() {
  const result = state.gameOver ? state.checkWin(state.board) : null;
  return {
    moveHistory: state.moveHistory,
    currentPlayer: state.currentPlayer,
    gameOver: state.gameOver,
    winLine: result?.line ?? null,
    scores: state.scores,
  };
}

function broadcastRoster() {
  if (!state.network || !state.remoteIsHost) return;
  state.broadcastRemoteMessage({
    type: 'roster',
    players: state.remotePlayers,
    config: {
      gameMode: state.primaryMode,
      botMode3P: state.botMode3P,
      aiDifficulty: state.aiDifficulty,
      expectedPlayers: state.remoteExpectedPlayers,
    },
    gameState: getGameStateSnapshot(),
  });
  updateConnectionStatus();
}

function addOrUpdatePlayer(id, name, connected = true) {
  let player = state.remotePlayers.find((entry) => entry.id === id);
  if (player) {
    player.name = name || player.name;
    player.connected = connected;
  } else {
    player = state.remotePlayers.find(
      (entry) => !entry.connected && getHumanSymbols().includes(entry.symbol),
    );
    if (player) {
      player.id = id;
      player.name = name || player.name;
      player.connected = connected;
    } else {
      const symbol = getNextSymbol();
      if (symbol === null) return false;
      const playerNumber = getHumanSymbols().indexOf(symbol) + 1;
      player = {
        id,
        name: name || `Player ${playerNumber}`,
        symbol,
        connected,
      };
      state.remotePlayers.push(player);
    }
  }
  return true;
}

function setRemoteConfiguration(config) {
  if (
    !config ||
    !['2p', '3p'].includes(config.gameMode) ||
    (config.gameMode === '3p' && !['0', '1', '2'].includes(config.botMode3P))
  ) {
    setRoomStatus('This room has an invalid game configuration.', true);
    return false;
  }

  state.primaryMode = config.gameMode;
  state.gameMode = config.gameMode === '3p' ? '3p' : 'pvp';
  state.mode2P = 'human';
  state.botMode3P = config.gameMode === '3p' ? config.botMode3P : '0';
  state.aiDifficulty = config.aiDifficulty || 'medium';
  state.remoteExpectedPlayers = getExpectedPlayerCount(config);
  state.humanPlaySetup = 'remote';
  state.remoteConfigApplied = true;
  state.remoteGameStateReady = state.remoteIsHost;

  document.getElementById('btnMode2P')?.classList.toggle('active', config.gameMode === '2p');
  document.getElementById('btnMode3P')?.classList.toggle('active', config.gameMode === '3p');
  document.getElementById('submenu2P').style.display =
    config.gameMode === '2p' ? 'block' : 'none';
  document.getElementById('submenu3P').style.display =
    config.gameMode === '3p' ? 'block' : 'none';
  document.getElementById('btn2pHuman')?.classList.toggle('active', config.gameMode === '2p');
  document.getElementById('btn2pAI')?.classList.toggle('active', false);
  document.getElementById('btn3pHumans')?.classList.toggle(
    'active',
    config.gameMode === '3p' && config.botMode3P === '0',
  );
  document.getElementById('btn3p1Bot')?.classList.toggle(
    'active',
    config.gameMode === '3p' && config.botMode3P === '1',
  );
  document.getElementById('btn3p2Bots')?.classList.toggle('active', false);
  state.updateAISettingsVisibility();
  state.updateHumanPlaySetupVisibility();
  state.resetGame({ broadcast: false });
  return true;
}

function handleRoster(peer, data) {
  if (state.remoteIsHost || peer.id !== state.remoteHostId) return;
  if (!Array.isArray(data.players)) return;
  if (!state.remoteConfigApplied && !setRemoteConfiguration(data.config)) return;
  state.remotePlayers = data.players;
  const localPlayer = state.remotePlayers.find(
    (player) => player.id === state.network.id,
  );
  state.localPlayerSymbol = localPlayer?.symbol ?? null;
  if (!applyGameStateSnapshot(data.gameState)) {
    state.remoteGameStateReady = false;
    updateConnectionStatus();
    setRoomStatus('Unable to synchronize the current match state.', true);
    return;
  }
  updateConnectionStatus();
  if (state.localPlayerSymbol === null) {
    setRoomStatus('Room is full. You were not assigned a player slot.', true);
  }
}

function applyGameStateSnapshot(snapshot) {
  const scoreKeys = ['x', 'o', 'tri', 'draw'];
  if (
    !snapshot ||
    !Array.isArray(snapshot.moveHistory) ||
    snapshot.moveHistory.length > state.board.length ||
    !snapshot.scores ||
    !scoreKeys.every(
      (key) =>
        Number.isInteger(snapshot.scores[key]) && snapshot.scores[key] >= 0,
    )
  ) return false;

  const board = new Array(state.board.length).fill(state.EMPTY);
  let currentPlayer = state.X;
  let result = null;
  let isDraw = false;
  const moveHistory = [];

  for (let index = 0; index < snapshot.moveHistory.length; index++) {
    const move = snapshot.moveHistory[index];
    if (
      !move ||
      move.player !== currentPlayer ||
      !Number.isInteger(move.cell) ||
      move.cell < 0 ||
      move.cell >= board.length ||
      board[move.cell] !== state.EMPTY
    ) return false;

    board[move.cell] = move.player;
    moveHistory.push({ player: move.player, cell: move.cell });
    result = state.checkWin(board);
    isDraw = !result && state.isBoardFull(board);
    if (result || isDraw) {
      if (index !== snapshot.moveHistory.length - 1) return false;
    } else if (state.gameMode === '3p') {
      currentPlayer =
        currentPlayer === state.X
          ? state.O
          : currentPlayer === state.O
            ? state.TRIANGLE
            : state.X;
    } else {
      currentPlayer = currentPlayer === state.X ? state.O : state.X;
    }
  }

  const gameOver = Boolean(result || isDraw);
  if (
    typeof snapshot.gameOver !== 'boolean' ||
    snapshot.currentPlayer !== currentPlayer ||
    snapshot.gameOver !== gameOver ||
    !sameArray(snapshot.winLine, result?.line ?? null)
  ) return false;

  const sameMatch =
    state.currentPlayer === currentPlayer &&
    state.gameOver === gameOver &&
    sameArray(state.board, board) &&
    state.moveHistory.length === moveHistory.length &&
    state.moveHistory.every(
      (move, index) =>
        move.player === moveHistory[index].player &&
        move.cell === moveHistory[index].cell,
    );

  if (!sameMatch) {
    state.resetGame({ broadcast: false });
    state.board = board;
    state.currentPlayer = currentPlayer;
    state.gameOver = gameOver;
    state.winLine = result?.line ?? null;
    state.moveHistory = moveHistory;
    state.lastGameResult = result
      ? {
          isDraw: false,
          winner: result.winner,
          winLine: result.line,
          lineIndex: result.lineIndex,
        }
      : isDraw
        ? { isDraw: true }
        : null;

    for (let cell = 0; cell < board.length; cell++) {
      if (board[cell] !== state.EMPTY) state.placeGlyph3D(cell);
    }
    if (result) state.drawWinLine3D(result.line);
    state.updateCellHighlights();
    state.updateGhostPreview();
    state.updateFlatView();
    state.updateTurnDisplay();
    state.updateStatusDisplay();
    state.updateMoveLog();
    state.updateLinesChecklist();
  }

  state.scores = { ...snapshot.scores };
  state.updateScoreboard();
  state.remoteGameStateReady = true;
  return true;
}

function sameArray(first, second) {
  if (first === null || second === null) return first === second;
  return (
    Array.isArray(first) &&
    Array.isArray(second) &&
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function handleMessage(peer, message) {
  let data;
  try {
    data = typeof message === 'string' ? JSON.parse(message) : message;
  } catch {
    return;
  }
  if (!data || typeof data.type !== 'string') return;

  if (data.type === 'hello' && state.remoteIsHost) {
    if (addOrUpdatePlayer(peer.id, data.name)) broadcastRoster();
    return;
  }
  if (data.type === 'roster') {
    handleRoster(peer, data);
    return;
  }
  if (data.type === 'move') {
    const player = state.remotePlayers.find((entry) => entry.id === peer.id);
    if (
      !player ||
      (player.symbol !== data.player && peer.id !== state.remoteHostId) ||
      data.player !== state.currentPlayer ||
      data.sequence !== state.moveHistory.length + 1 ||
      !Number.isInteger(data.cell) ||
      data.cell < 0 ||
      data.cell >= state.board.length
    ) return;

    state.makeMove(data.cell, { fromNetwork: true });
    if (state.remoteIsHost) {
      const relay = JSON.stringify(data);
      for (const [peerId, connectedPeer] of state.network.peers) {
        if (peerId !== peer.id) connectedPeer.send('reliable', relay);
      }
    }
    return;
  }
  if (data.type === 'reset' && state.remotePlayers.some((player) => player.id === peer.id)) {
    state.resetGame({ broadcast: false });
  }
}

function startRemoteNetwork(action, roomCode = '') {
  state.closeRemotePlay();
  const session = ++state.networkSession;
  const network = new Network(GAME_ID);
  const config = getLocalConfiguration();
  const expectedPlayers = getExpectedPlayerCount(config);
  state.network = network;
  state.remoteRoomCode = '';
  state.remotePlayers = [];
  state.remoteExpectedPlayers = expectedPlayers;
  state.remoteIsHost = false;
  state.localPlayerSymbol = null;
  state.remoteReadyToPlay = false;
  state.remoteGameStateReady = false;
  state.remoteConfigApplied = false;
  state.remoteConnecting = true;
  setRoomStatus('Connecting to Poki Netlib…');
  updateRoomDisplay();

  network.on('ready', async () => {
    if (session !== state.networkSession) {
      network.close('cancelled');
      return;
    }
    try {
      if (action === 'create') {
        const code = await network.create({
          public: false,
          maxPlayers: expectedPlayers,
          customData: {
            gameMode: config.gameMode,
            botMode3P: config.botMode3P,
            aiDifficulty: config.aiDifficulty,
            expectedPlayers,
          },
        });
        if (session !== state.networkSession) {
          network.close('cancelled');
          return;
        }
        if (!code && session === state.networkSession) {
          failRemoteSession('Unable to create the room. Try again.');
        }
      } else {
        const lobby = await network.join(roomCode);
        if (session !== state.networkSession) {
          if (network.currentLobby) await network.leave();
          network.close('cancelled');
          return;
        }
        if (!lobby && session === state.networkSession) {
          failRemoteSession('Room not found or no longer available.');
        }
      }
    } catch (error) {
      if (session !== state.networkSession) {
        network.close('cancelled');
        return;
      }
      console.error('Unable to enter Poki Netlib room:', error);
      failRemoteSession(getRoomErrorMessage(error, 'Unable to enter room.'));
    }
  });

  network.on('lobby', (code, info) => {
    if (session !== state.networkSession) return;
    state.remoteRoomCode = code;
    state.remoteConnecting = false;
    state.remoteIsHost = info.creator === network.id;
    state.remoteHostId = info.creator;

    if (state.remoteIsHost && !setRemoteConfiguration(config)) return;
    if (state.remoteIsHost) {
      state.localPlayerSymbol = state.X;
      state.remotePlayers = [
        { id: network.id, name: config.playerName, symbol: state.X, connected: true },
      ];
      setRoomStatus('Room created. Share the code to invite players.');
    } else {
      state.remotePlayers = [
        { id: network.id, name: config.playerName, symbol: null, connected: true },
      ];
      setRoomStatus('Joined room. Waiting for the host to assign players…');
      for (const peer of network.peers.values()) {
        network.send('reliable', peer.id, JSON.stringify({ type: 'hello', name: config.playerName }));
      }
    }
    updateRoomDisplay();
    if (state.remoteIsHost) broadcastRoster();
  });

  network.on('connected', (peer) => {
    if (session !== state.networkSession) return;
    if (state.remoteIsHost) {
      if (addOrUpdatePlayer(peer.id, `Player ${state.remotePlayers.length + 1}`)) {
        broadcastRoster();
      }
    } else {
      network.send('reliable', peer.id, JSON.stringify({ type: 'hello', name: config.playerName }));
    }
  });

  network.on('left', () => {
    if (session !== state.networkSession) return;
    state.closeRemotePlay();
    state.resetGame({ broadcast: false });
    setRoomStatus('The room was closed.');
    updateRoomDisplay();
  });

  network.on('disconnected', (peer) => {
    if (session !== state.networkSession) return;
    if (!state.remoteIsHost && peer.id === state.remoteHostId) {
      state.closeRemotePlay();
      state.resetGame({ broadcast: false });
      setRoomStatus('The host disconnected. The room is no longer available.');
      updateRoomDisplay();
      return;
    }
    const player = state.remotePlayers.find((entry) => entry.id === peer.id);
    if (player) player.connected = false;
    if (state.remoteIsHost) broadcastRoster();
    updateConnectionStatus();
  });

  network.on('reconnected', (peer) => {
    if (session !== state.networkSession) return;
    const player = state.remotePlayers.find((entry) => entry.id === peer.id);
    if (player) player.connected = true;
    if (state.remoteIsHost) broadcastRoster();
    updateConnectionStatus();
  });

  network.on('message', (peer, channel, data) => {
    if (session === state.networkSession && channel === 'reliable') {
      handleMessage(peer, data);
    }
  });

  network.on('signalingerror', (error) => {
    if (session !== state.networkSession) {
      network.close('cancelled');
      return;
    }
    console.error('Poki Netlib signaling error:', error);
    state.remoteConnecting = false;
    setRoomStatus(getRoomErrorMessage(error, 'Poki Netlib signaling error.'), true);
    updateRoomDisplay();
  });
  network.on('rtcerror', (error) => {
    if (session !== state.networkSession) {
      network.close('cancelled');
      return;
    }
    console.error('Poki Netlib peer connection error:', error);
    setRoomStatus('A peer connection error occurred.', true);
  });
  network.on('failed', () => {
    if (session !== state.networkSession) {
      network.close('cancelled');
      return;
    }
    state.remoteConnecting = false;
    setRoomStatus('Connection failed. Try creating or joining the room again.', true);
    updateRoomDisplay();
  });
}

function failRemoteSession(message) {
  state.closeRemotePlay();
  setRoomStatus(message, true);
  updateRoomDisplay();
}

state.broadcastRemoteMessage = function broadcastRemoteMessage(message) {
  if (!state.network) return;
  state.network.broadcast('reliable', JSON.stringify(message));
};

state.createRemoteRoom = function createRemoteRoom() {
  if (
    state.network &&
    (state.remoteConnecting ||
      (state.remoteIsHost && state.remoteRoomCode))
  ) return;
  startRemoteNetwork('create');
};

state.joinRemoteRoom = function joinRemoteRoom() {
  const input = document.getElementById('joinRoomCode');
  const code = input?.value.trim().toLowerCase();
  if (!code) {
    setRoomStatus('Enter a room code to join.', true);
    input?.focus();
    return;
  }
  input.value = code;
  startRemoteNetwork('join', code);
};

state.copyRemoteRoomCode = async function copyRemoteRoomCode() {
  try {
    await navigator.clipboard.writeText(state.remoteRoomCode);
    setRoomStatus('Room code copied. Share it with your players.');
  } catch (error) {
    console.error('Unable to copy the room code:', error);
    setRoomStatus('Copy failed. Select and copy the room code manually.', true);
  }
};

state.leaveRemoteRoom = function leaveRemoteRoom() {
  state.closeRemotePlay();
  state.resetGame({ broadcast: false });
  setRoomStatus('You left the room.');
  updateRoomDisplay();
};

state.closeRemotePlay = function closeRemotePlay() {
  state.networkSession++;
  if (state.network) state.network.close('left room');
  state.network = null;
  state.remoteRoomCode = '';
  state.remotePlayers = [];
  state.remoteIsHost = false;
  state.remoteHostId = null;
  state.localPlayerSymbol = null;
  state.remoteExpectedPlayers = 0;
  state.remoteReadyToPlay = false;
  state.remoteGameStateReady = false;
  state.remoteConfigApplied = false;
  state.remoteConnecting = false;
  const code = document.getElementById('joinRoomCode');
  if (code) code.value = '';
  setRoomStatus('');
  updateRoomDisplay();
};
