import { Client, Room } from 'colyseus.js';
import QRCode from 'qrcode';
import { generateRoomCode } from '@metroville/game-sdk';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:2567'
  : `ws://${window.location.hostname}:2567`;

const client = new Client(BACKEND_URL);
let currentRoom: Room<any> | null = null;
let currentSessionToken = localStorage.getItem('metroville_session_token') || ('tok-' + Math.random().toString(36).substring(2, 9));
localStorage.setItem('metroville_session_token', currentSessionToken);

// DOM Elements
const connIndicator = document.getElementById('conn-indicator')!;
const viewLanding = document.getElementById('view-landing')!;
const viewLobby = document.getElementById('view-lobby')!;
const viewGame = document.getElementById('view-game')!;

const playerNameInput = document.getElementById('player-name-input') as HTMLInputElement;
const roomCodeInput = document.getElementById('room-code-input') as HTMLInputElement;
const btnCreateRoom = document.getElementById('btn-create-room')!;
const btnJoinRoom = document.getElementById('btn-join-room')!;

const lobbyRoomCode = document.getElementById('lobby-room-code')!;
const shareLinkInput = document.getElementById('share-link-input') as HTMLInputElement;
const btnCopyLink = document.getElementById('btn-copy-link')!;
const qrcodeCanvas = document.getElementById('qrcode-canvas') as HTMLCanvasElement;
const lobbyPlayerList = document.getElementById('lobby-player-list')!;
const btnToggleReady = document.getElementById('btn-toggle-ready')!;
const btnAddBot = document.getElementById('btn-add-bot')!;
const btnStartGame = document.getElementById('btn-start-game')!;
const btnLeaveRoom = document.getElementById('btn-leave-room')!;

const gameStatusBar = document.getElementById('game-status-bar')!;
const multiBoard = document.getElementById('multi-board')!;
const btnGameLeave = document.getElementById('btn-game-leave')!;

// Restore player name
playerNameInput.value = localStorage.getItem('metroville_player_name') || `Spieler-${Math.floor(100 + Math.random() * 900)}`;

// Check URL query for room param
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) {
  roomCodeInput.value = roomParam.toUpperCase();
}

function showView(view: 'landing' | 'lobby' | 'game') {
  viewLanding.style.display = view === 'landing' ? 'block' : 'none';
  viewLobby.style.display = view === 'lobby' ? 'block' : 'none';
  viewGame.style.display = view === 'game' ? 'block' : 'none';
}

function getPlayerName(): string {
  const name = playerNameInput.value.trim() || 'Spieler';
  localStorage.setItem('metroville_player_name', name);
  return name;
}

async function joinRoom(roomCode: string, isCreate: boolean = false) {
  try {
    connIndicator.textContent = '● Verbinde...';
    connIndicator.style.color = 'var(--mustard)';

    const options = {
      roomCode: roomCode.toUpperCase(),
      gameId: 'tictactoe',
      name: getPlayerName(),
      sessionToken: currentSessionToken
    };

    if (isCreate) {
      currentRoom = await client.create('game_room', options);
    } else {
      currentRoom = await client.joinOrCreate('game_room', options);
    }

    setupRoomListeners(currentRoom);

    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('room', currentRoom.state.roomCode || roomCode);
    window.history.pushState({}, '', url);

    connIndicator.textContent = '● Verbunden';
    connIndicator.style.color = 'var(--teal)';
  } catch (err: any) {
    alert(`Fehler beim Beitreten des Raums: ${err.message}`);
    connIndicator.textContent = '● Fehler';
    connIndicator.style.color = '#E74C3C';
  }
}

function setupRoomListeners(room: Room<any>) {
  room.onStateChange((state) => {
    if (state.status === 'lobby') {
      showView('lobby');
      renderLobby(state);
    } else if (state.status === 'playing' || state.status === 'gameover') {
      showView('game');
      renderGame(state);
    }
  });

  room.onLeave(() => {
    connIndicator.textContent = '● Getrennt';
    connIndicator.style.color = 'var(--warm-grey)';
    currentRoom = null;
    showView('landing');
  });
}

function renderLobby(state: any) {
  const code = state.roomCode;
  lobbyRoomCode.textContent = code;

  // Share URL & QR Code
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
  shareLinkInput.value = shareUrl;
  QRCode.toCanvas(qrcodeCanvas, shareUrl, { width: 90, margin: 1 });

  // Players list
  lobbyPlayerList.innerHTML = '';
  const mySessionId = currentRoom?.sessionId;
  let meIsHost = false;
  let allReady = true;

  state.playerOrder.forEach((pid: string) => {
    const p = state.players.get(pid);
    if (!p) return;

    if (pid === mySessionId && p.isHost) {
      meIsHost = true;
    }

    if (!p.isReady) {
      allReady = false;
    }

    const item = document.createElement('div');
    item.className = 'player-item';

    const info = document.createElement('div');
    info.className = 'player-info';

    const dot = document.createElement('div');
    dot.className = 'player-dot';
    dot.style.background = p.color;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    nameSpan.style.fontWeight = '600';

    info.appendChild(dot);
    info.appendChild(nameSpan);

    if (p.isHost) {
      const tag = document.createElement('span');
      tag.className = 'player-tag tag-host';
      tag.textContent = 'HOST';
      info.appendChild(tag);
    }

    if (p.isBot) {
      const tag = document.createElement('span');
      tag.className = 'player-tag tag-bot';
      tag.textContent = 'BOT';
      info.appendChild(tag);
    }

    const statusTag = document.createElement('span');
    statusTag.className = `player-tag ${p.isReady ? 'tag-ready' : 'tag-wait'}`;
    statusTag.textContent = p.isReady ? 'BEREIT' : 'WARTET';
    info.appendChild(statusTag);

    item.appendChild(info);

    // Host kick control
    if (meIsHost && pid !== mySessionId) {
      const btnKick = document.createElement('button');
      btnKick.className = 'danger';
      btnKick.textContent = 'Entfernen';
      btnKick.addEventListener('click', () => {
        currentRoom?.send('KICK_PLAYER', { targetId: pid });
      });
      item.appendChild(btnKick);
    }

    lobbyPlayerList.appendChild(item);
  });

  // Host buttons
  if (meIsHost) {
    btnAddBot.style.display = 'inline-block';
    btnStartGame.style.display = 'inline-block';
    btnStartGame.toggleAttribute('disabled', state.playerOrder.length < 2 || !allReady);
  } else {
    btnAddBot.style.display = 'none';
    btnStartGame.style.display = 'none';
  }

  // Ready button text
  const myPlayer = state.players.get(mySessionId);
  if (myPlayer) {
    btnToggleReady.textContent = myPlayer.isReady ? 'Bereit zurücknehmen' : 'Bereit melden';
  }
}

function renderGame(state: any) {
  let runtimeState: any = null;
  try {
    runtimeState = JSON.parse(state.gameStateJson);
  } catch {
    return;
  }

  const mySessionId = currentRoom?.sessionId;
  const isMyTurn = state.currentTurnPlayerId === mySessionId;

  // Status message
  if (state.status === 'gameover') {
    if (state.winnerId) {
      const winnerPlayer = state.players.get(state.winnerId);
      const name = winnerPlayer ? winnerPlayer.name : 'Ein Spieler';
      gameStatusBar.textContent = `🎉 Sieg für ${name}! (${state.winReason})`;
    } else {
      gameStatusBar.textContent = `🤝 Unentschieden!`;
    }
  } else {
    const turnPlayer = state.players.get(state.currentTurnPlayerId);
    const turnName = turnPlayer ? turnPlayer.name : 'Unbekannt';
    gameStatusBar.textContent = isMyTurn
      ? `👉 Du bist am Zug! (${runtimeState.currentTurn})`
      : `Warten auf ${turnName}... (${runtimeState.currentTurn})`;
  }

  // Board rendering
  multiBoard.innerHTML = '';
  runtimeState.board.forEach((val: string | null, idx: number) => {
    const cell = document.createElement('button');
    cell.className = `cell ${val ? val.toLowerCase() : ''}`;
    if (runtimeState.winningLine && runtimeState.winningLine.includes(idx)) {
      cell.classList.add('winning');
    }
    cell.textContent = val || '';
    cell.disabled = val !== null || !isMyTurn || state.status === 'gameover';

    cell.addEventListener('click', () => {
      currentRoom?.send('GAME_ACTION', { type: 'MAKE_MOVE', index: idx });
    });

    multiBoard.appendChild(cell);
  });
}

// Event Listeners
btnCreateRoom.addEventListener('click', () => {
  const code = generateRoomCode();
  joinRoom(code, true);
});

btnJoinRoom.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 5) {
    alert('Bitte gib einen 5-stelligen Raumcode ein.');
    return;
  }
  joinRoom(code, false);
});

btnToggleReady.addEventListener('click', () => {
  if (!currentRoom) return;
  const myPlayer = currentRoom.state.players.get(currentRoom.sessionId);
  if (myPlayer) {
    currentRoom.send('SET_READY', { ready: !myPlayer.isReady });
  }
});

btnAddBot.addEventListener('click', () => {
  currentRoom?.send('ADD_BOT');
});

btnStartGame.addEventListener('click', () => {
  currentRoom?.send('START_GAME');
});

btnLeaveRoom.addEventListener('click', () => {
  currentRoom?.leave();
});

btnGameLeave.addEventListener('click', () => {
  currentRoom?.leave();
});

btnCopyLink.addEventListener('click', () => {
  navigator.clipboard.writeText(shareLinkInput.value).then(() => {
    btnCopyLink.textContent = 'Kopiert!';
    setTimeout(() => { btnCopyLink.textContent = 'Link kopieren'; }, 2000);
  });
});
