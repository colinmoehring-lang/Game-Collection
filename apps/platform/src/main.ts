import { Client, Room } from 'colyseus.js';
import QRCode from 'qrcode';
import { generateRoomCode } from '@metroville/game-sdk';
import { METROVILLE_FIELDS } from '@metroville/game-metroville';

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
const gameSelect = document.getElementById('game-select') as HTMLSelectElement;
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
const gameTitleHeader = document.getElementById('game-title-header')!;
const tictactoeGame = document.getElementById('tictactoe-game')!;
const metrovilleGame = document.getElementById('metroville-game')!;
const multiBoard = document.getElementById('multi-board')!;
const metroBoard = document.getElementById('metro-board')!;
const metroTurnName = document.getElementById('metro-turn-name')!;
const metroTurnPhase = document.getElementById('metro-turn-phase')!;
const metroCenterTitle = document.getElementById('metro-center-title')!;
const metroCenterDetail = document.getElementById('metro-center-detail')!;
const metroPlayerList = document.getElementById('metro-player-list')!;
const metroLog = document.getElementById('metro-log')!;
const btnGameLeave = document.getElementById('btn-game-leave')!;
const metroActionRoll = document.getElementById('metro-action-roll')!;
const metroActionBuy = document.getElementById('metro-action-buy')!;
const metroActionDecline = document.getElementById('metro-action-decline')!;
const metroActionEnd = document.getElementById('metro-action-end')!;
const metroActionJailFine = document.getElementById('metro-action-jail-fine')!;
const metroActionJailCard = document.getElementById('metro-action-jail-card')!;
const metroActionBuild = document.getElementById('metro-action-build')!;
const metroActionSell = document.getElementById('metro-action-sell')!;
const metroActionMortgage = document.getElementById('metro-action-mortgage')!;
const metroActionUnmortgage = document.getElementById('metro-action-unmortgage')!;
let selectedPropertyIndex: number | null = null;

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
      gameId: gameSelect.value,
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

  if (state.gameId === 'metroville') {
    renderMetroville(state, runtimeState);
    return;
  }

  tictactoeGame.hidden = false;
  metrovilleGame.hidden = true;
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

function renderMetroville(roomState: any, runtimeState: any) {
  tictactoeGame.hidden = true;
  metrovilleGame.hidden = false;
  const mySessionId = currentRoom?.sessionId;
  const currentPlayer = runtimeState.players.find((player: any) => player.id === mySessionId);
  const turnPlayer = runtimeState.players.find((player: any) => player.id === runtimeState.currentTurnPlayerId);
  const isMyTurn = roomState.currentTurnPlayerId === mySessionId;
  const currentField = currentPlayer ? METROVILLE_FIELDS[currentPlayer.position] : null;

  gameStatusBar.textContent = roomState.status === 'gameover'
    ? `Spiel beendet: ${runtimeState.winReason || 'Endstand erreicht'}`
    : isMyTurn
      ? 'Du bist am Zug.'
      : `Warten auf ${turnPlayer?.name || 'den nächsten Spieler'}.`;

  gameTitleHeader.textContent = 'MetroVille: City of Fortune';
  metroTurnName.textContent = turnPlayer?.name || 'Unbekannt';
  metroTurnPhase.textContent = formatMetroPhase(runtimeState.phase);
  metroCenterTitle.textContent = runtimeState.phase === 'gameover'
    ? 'Die Stadt hat entschieden'
    : currentField?.name || 'Stadt der Möglichkeiten';
  metroCenterDetail.textContent = runtimeState.phase === 'gameover'
    ? runtimeState.winReason || 'Spiel beendet'
    : `Würfel ${runtimeState.dice[0]} + ${runtimeState.dice[1]} · Runde ${runtimeState.turnCount + 1}`;

  metroBoard.innerHTML = '';
  const center = document.createElement('div');
  center.className = 'metro-center';
  center.innerHTML = '<span class="metro-center-kicker">METROVILLE</span>';
  const centerTitle = document.createElement('strong');
  centerTitle.textContent = metroCenterTitle.textContent;
  const centerDetail = document.createElement('span');
  centerDetail.textContent = metroCenterDetail.textContent;
  center.append(centerTitle, centerDetail);
  metroBoard.appendChild(center);

  METROVILLE_FIELDS.forEach((field) => {
    const tile = document.createElement('button');
    const property = runtimeState.properties[field.index];
    tile.className = `metro-tile tile-${field.type}${selectedPropertyIndex === field.index ? ' is-selected' : ''}`;
    tile.style.gridRow = String(getMetroGridPosition(field.index).row);
    tile.style.gridColumn = String(getMetroGridPosition(field.index).column);
    tile.type = 'button';
    if (field.color) {
      const colorBar = document.createElement('span');
      colorBar.className = 'metro-tile-color';
      colorBar.style.backgroundColor = field.color;
      tile.appendChild(colorBar);
    }
    const tileIndex = document.createElement('span');
    tileIndex.className = 'metro-tile-index';
    tileIndex.textContent = String(field.index).padStart(2, '0');
    const tileName = document.createElement('strong');
    tileName.textContent = field.name;
    tile.append(tileIndex, tileName);
    if (field.cost) {
      const tileCost = document.createElement('span');
      tileCost.className = 'metro-tile-cost';
      tileCost.textContent = `${field.cost} Taler`;
      tile.appendChild(tileCost);
    }
    if (property?.ownerId) {
      const owner = runtimeState.players.find((player: any) => player.id === property.ownerId);
      tile.dataset.owner = owner?.name || 'Belegt';
      tile.style.setProperty('--owner-color', owner?.color || 'var(--charcoal)');
    }
    runtimeState.players
      .filter((player: any) => player.position === field.index && !player.bankrupt)
      .forEach((player: any) => {
        const token = document.createElement('span');
        token.className = 'metro-token';
        token.style.backgroundColor = player.color || 'var(--terracotta)';
        token.title = player.name;
        tile.appendChild(token);
      });
    tile.addEventListener('click', () => {
      selectedPropertyIndex = property ? field.index : null;
      renderMetroville(roomState, runtimeState);
    });
    metroBoard.appendChild(tile);
  });

  metroPlayerList.innerHTML = '';
  runtimeState.players.forEach((player: any) => {
    const item = document.createElement('div');
    item.className = `metro-player ${player.id === runtimeState.currentTurnPlayerId ? 'is-turn' : ''}`;
    const propertyCount = Object.values(runtimeState.properties)
      .filter((property: any) => property.ownerId === player.id).length;
    item.innerHTML = `<span class="metro-player-swatch" style="background:${player.color || 'var(--terracotta)'}"></span>`;
    const details = document.createElement('span');
    details.className = 'metro-player-details';
    const name = document.createElement('strong');
    name.textContent = player.name;
    const stats = document.createElement('small');
    stats.textContent = `${player.money} Taler · ${propertyCount} Grundstücke`;
    details.append(name, stats);
    item.appendChild(details);
    metroPlayerList.appendChild(item);
  });

  metroLog.innerHTML = '';
  runtimeState.log.slice(-5).reverse().forEach((entry: string) => {
    const line = document.createElement('p');
    line.textContent = entry;
    metroLog.appendChild(line);
  });

  const canAct = isMyTurn && roomState.status === 'playing';
  const selectedProperty = selectedPropertyIndex === null ? null : runtimeState.properties[selectedPropertyIndex];
  setMetroActionState(metroActionRoll, canAct && runtimeState.phase === 'roll');
  setMetroActionState(metroActionBuy, canAct && runtimeState.phase === 'tile_action' && Boolean(currentField?.cost && !runtimeState.properties[currentPlayer?.position]?.ownerId));
  setMetroActionState(metroActionDecline, canAct && runtimeState.phase === 'tile_action');
  setMetroActionState(metroActionEnd, canAct && runtimeState.phase === 'turn_end');
  setMetroActionState(metroActionJailFine, canAct && currentPlayer?.inJail === true);
  setMetroActionState(metroActionJailCard, canAct && currentPlayer?.inJail === true && currentPlayer.getOutOfJailCards > 0);
  setMetroActionState(metroActionBuild, canAct && Boolean(selectedProperty?.ownerId === mySessionId));
  setMetroActionState(metroActionSell, canAct && Boolean(selectedProperty?.ownerId === mySessionId && selectedProperty.houses > 0));
  setMetroActionState(metroActionMortgage, canAct && Boolean(selectedProperty?.ownerId === mySessionId && !selectedProperty.isMortgaged));
  setMetroActionState(metroActionUnmortgage, canAct && Boolean(selectedProperty?.ownerId === mySessionId && selectedProperty.isMortgaged));
}

function getMetroGridPosition(index: number) {
  if (index <= 10) return { row: 11, column: 11 - index };
  if (index <= 20) return { row: 21 - index, column: 1 };
  if (index <= 30) return { row: 1, column: index - 19 };
  return { row: index - 29, column: 11 };
}

function formatMetroPhase(phase: string) {
  const labels: Record<string, string> = {
    roll: 'Würfel bereit',
    tile_action: 'Feldaktion wählen',
    turn_end: 'Zug abschließen',
    auction: 'Auktion läuft',
    gameover: 'Spiel beendet'
  };
  return labels[phase] || phase;
}

function setMetroActionState(button: HTMLElement, enabled: boolean) {
  button.toggleAttribute('disabled', !enabled);
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

function sendMetroAction(action: any) {
  currentRoom?.send('GAME_ACTION', action);
}

metroActionRoll.addEventListener('click', () => sendMetroAction({ type: 'ROLL_DICE' }));
metroActionBuy.addEventListener('click', () => sendMetroAction({ type: 'BUY_PROPERTY' }));
metroActionDecline.addEventListener('click', () => sendMetroAction({ type: 'DECLINE_BUY_PROPERTY' }));
metroActionEnd.addEventListener('click', () => sendMetroAction({ type: 'END_TURN' }));
metroActionJailFine.addEventListener('click', () => sendMetroAction({ type: 'PAY_JAIL_FINE' }));
metroActionJailCard.addEventListener('click', () => sendMetroAction({ type: 'USE_JAIL_CARD' }));
metroActionBuild.addEventListener('click', () => {
  if (selectedPropertyIndex !== null) sendMetroAction({ type: 'BUILD_HOUSE', propertyIndex: selectedPropertyIndex });
});
metroActionSell.addEventListener('click', () => {
  if (selectedPropertyIndex !== null) sendMetroAction({ type: 'SELL_HOUSE', propertyIndex: selectedPropertyIndex });
});
metroActionMortgage.addEventListener('click', () => {
  if (selectedPropertyIndex !== null) sendMetroAction({ type: 'MORTGAGE', propertyIndex: selectedPropertyIndex });
});
metroActionUnmortgage.addEventListener('click', () => {
  if (selectedPropertyIndex !== null) sendMetroAction({ type: 'UNMORTGAGE', propertyIndex: selectedPropertyIndex });
});

btnCopyLink.addEventListener('click', () => {
  navigator.clipboard.writeText(shareLinkInput.value).then(() => {
    btnCopyLink.textContent = 'Kopiert!';
    setTimeout(() => { btnCopyLink.textContent = 'Link kopieren'; }, 2000);
  });
});
