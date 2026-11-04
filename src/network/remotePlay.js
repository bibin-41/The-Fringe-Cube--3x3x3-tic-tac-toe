import { Network } from '@poki/netlib';
import { state } from '../state.js';

const GAME_ID =
  import.meta.env.VITE_POKI_GAME_ID || '45b0e470-c065-48ce-8df9-713c089064e8';
const PLAYER_SYMBOLS = [state.X, state.O, state.TRIANGLE];

function getExpectedPlayerCount(config = getLocalConfiguration()) {
  return config.gameMode === '3p' && config.botMode3P === '0' ? 3 : 2;
}

function getLocalConfiguration() {
  return {
    gameMode: state.gameMode === '3p' ? '3p' : '2p',
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
  state.remoteReadyToPlay =
    connectedPlayers >= state.remoteExpectedPlayers &&
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
  return PLAYER_SYMBOLS.find((symbol) => !used.has(symbol)) ?? null;
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
  });
  updateConnectionStatus();
}

function addOrUpdatePlayer(id, name, connected = true) {
  let player = state.remotePlayers.find((entry) => entry.id === id);
  if (player) {
    player.name = name || player.name;
    player.connected = connected;
  } else {
    const symbol = getNextSymbol();
    if (symbol === null) return false;
    player = { id, name: name || `Player ${state.remotePlayers.length + 1}`, symbol, connected };
    state.remotePlayers.push(player);
  }
  return true;
}

function setRemoteConfiguration(config) {
  if (!config || !['2p', '3p'].includes(config.gameMode)) {
    setRoomStatus('This room has an invalid game configuration.', true);
    return false;
  }

  state.primaryMode = config.gameMode;
  state.gameMode = config.gameMode === '3p' ? '3p' : 'pvp';
  state.mode2P = 'human';
  state.botMode3P = config.gameMode === '3p' ? config.botMode3P : '0';
  state.aiDifficulty = config.aiDifficulty || 'medium';
  state.remoteExpectedPlayers =
    config.expectedPlayers || getExpectedPlayerCount(config);
  state.humanPlaySetup = 'remote';
  state.remoteConfigApplied = true;

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
  updateConnectionStatus();
  if (state.localPlayerSymbol === null) {
    setRoomStatus('Room is full. You were not assigned a player slot.', true);
  }
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
  startRemoteNetwork('create');
};

state.joinRemoteRoom = function joinRemoteRoom() {
  const input = document.getElementById('joinRoomCode');
  const code = input?.value.trim();
  if (!code) {
    setRoomStatus('Enter a room code to join.', true);
    input?.focus();
    return;
  }
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
  state.remoteConfigApplied = false;
  state.remoteConnecting = false;
  const code = document.getElementById('joinRoomCode');
  if (code) code.value = '';
  setRoomStatus('');
  updateRoomDisplay();
};
