import { Client, Room } from 'colyseus.js';
import QRCode from 'qrcode';
import { generateRoomCode } from '@metroville/game-sdk';
import { METROVILLE_FIELDS, MetrovilleModule } from '@metroville/game-metroville';
import { audio } from './audio.js';

const BACKEND_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:2567'
  : `ws://${window.location.hostname}:2567`;

const client = new Client(BACKEND_URL);
let currentRoom: Room<any> | null = null;
let currentSessionToken = localStorage.getItem('metroville_session_token') || ('tok-' + Math.random().toString(36).substring(2, 9));
localStorage.setItem('metroville_session_token', currentSessionToken);

// DOM Elements
const connIndicator = document.getElementById('conn-indicator')!;
const audioToggle = document.getElementById('audio-toggle')!;
const audioVolume = document.getElementById('audio-volume') as HTMLInputElement;
const colorModeToggle = document.getElementById('color-mode-toggle')!;
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
const metrovillePresetSection = document.getElementById('metroville-preset-section')!;
const metrovillePresetSelect = document.getElementById('metroville-preset-select') as HTMLSelectElement;
const metrovillePresetDescription = document.getElementById('metroville-preset-description')!;

const gameStatusBar = document.getElementById('game-status-bar')!;
const gameTitleHeader = document.getElementById('game-title-header')!;
const tictactoeGame = document.getElementById('tictactoe-game')!;
const metrovilleGame = document.getElementById('metroville-game')!;
const metroEventToast = document.getElementById('metro-event-toast')!;
const multiBoard = document.getElementById('multi-board')!;
const metroBoard = document.getElementById('metro-board')!;
const metroTurnName = document.getElementById('metro-turn-name')!;
const metroTurnPhase = document.getElementById('metro-turn-phase')!;
const metroCenterTitle = document.getElementById('metro-center-title')!;
const metroCenterDetail = document.getElementById('metro-center-detail')!;
const metroDice = document.getElementById('metro-dice')!;
const metroDieOne = document.getElementById('metro-die-one')!;
const metroDieTwo = document.getElementById('metro-die-two')!;
const metroCardDraw = document.getElementById('metro-card-draw')!;
const metroCardDrawDeck = document.getElementById('metro-card-draw-deck')!;
const metroCardDrawTitle = document.getElementById('metro-card-draw-title')!;
const metroCardDrawText = document.getElementById('metro-card-draw-text')!;
const metroPropertyCards = document.getElementById('metro-property-cards')!;
const metroCardShelfCount = document.getElementById('metro-card-shelf-count')!;
const metroPropertyOverlay = document.getElementById('metro-property-overlay')!;
const metroPropertyOverlayCard = document.getElementById('metro-property-overlay-card')!;
const metroPropertyClose = document.getElementById('metro-property-close')!;
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
const metroTradeTarget = document.getElementById('metro-trade-target') as HTMLSelectElement;
const metroOfferedMoney = document.getElementById('metro-offered-money') as HTMLInputElement;
const metroOfferedProperties = document.getElementById('metro-offered-properties') as HTMLSelectElement;
const metroRequestedMoney = document.getElementById('metro-requested-money') as HTMLInputElement;
const metroRequestedProperties = document.getElementById('metro-requested-properties') as HTMLSelectElement;
const metroActionOfferTrade = document.getElementById('metro-action-offer-trade')!;
const metroTradeStatus = document.getElementById('metro-trade-status')!;
const metroActionAcceptTrade = document.getElementById('metro-action-accept-trade')!;
const metroActionDeclineTrade = document.getElementById('metro-action-decline-trade')!;
const metroAuctionPanel = document.getElementById('metro-auction-panel')!;
const metroAuctionTitle = document.getElementById('metro-auction-title')!;
const metroAuctionBidder = document.getElementById('metro-auction-bidder')!;
const metroAuctionBid = document.getElementById('metro-auction-bid') as HTMLInputElement;
const metroActionBid = document.getElementById('metro-action-bid')!;
const metroActionPass = document.getElementById('metro-action-pass')!;
let selectedPropertyIndex: number | null = null;
let latestMetroRoomState: any = null;
let latestMetroRuntimeState: any = null;
let previousMetroRuntimeState: any = null;
let previousTicTacToeMoveCount = 0;
let eventToastTimer: number | undefined;
let cardDrawTimer: number | undefined;
let lastCardKey = '';
let lastMetroEventKey = '';

const metrovillePresets = MetrovilleModule.manifest.variants || [];
metrovillePresetSelect.replaceChildren(...metrovillePresets.map((preset) => {
  const option = document.createElement('option');
  option.value = preset.id;
  option.textContent = preset.name;
  return option;
}));

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
  document.body.dataset.view = view;
}

function syncAudioControls() {
  const muted = audio.muted;
  audioToggle.textContent = muted ? 'Sound aus' : 'Sound an';
  audioToggle.setAttribute('aria-label', muted ? 'Sound einschalten' : 'Sound ausschalten');
  audioToggle.setAttribute('aria-pressed', String(!muted));
  audioVolume.value = String(audio.volume);
}

function syncColorMode() {
  const enabled = document.body.classList.contains('colorblind-mode');
  colorModeToggle.setAttribute('aria-pressed', String(enabled));
  colorModeToggle.setAttribute('aria-label', enabled ? 'Farbseh-Hilfe ausschalten' : 'Farbseh-Hilfe einschalten');
}

syncAudioControls();
if (localStorage.getItem('metroville_color_mode') === 'on') document.body.classList.add('colorblind-mode');
syncColorMode();

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
    previousMetroRuntimeState = null;
    previousTicTacToeMoveCount = 0;
    lastCardKey = '';
    lastMetroEventKey = '';
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
  const isMetroville = state.gameId === MetrovilleModule.manifest.id;
  metrovillePresetSection.toggleAttribute('hidden', !isMetroville);
  if (isMetroville) {
    const selectedPreset = metrovillePresets.find((preset) => preset.id === state.gamePreset) || metrovillePresets[0];
    if (selectedPreset) {
      metrovillePresetSelect.value = selectedPreset.id;
      metrovillePresetDescription.textContent = selectedPreset.description;
    }
    metrovillePresetSelect.disabled = !meIsHost;
  }

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
  if (runtimeState.moveHistory.length > previousTicTacToeMoveCount) {
    audio.play('click');
    previousTicTacToeMoveCount = runtimeState.moveHistory.length;
  }

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
  latestMetroRoomState = roomState;
  latestMetroRuntimeState = runtimeState;
  const mySessionId = currentRoom?.sessionId;
  const currentPlayer = runtimeState.players.find((player: any) => player.id === mySessionId);
  const turnPlayer = runtimeState.players.find((player: any) => player.id === runtimeState.currentTurnPlayerId);
  const isMyTurn = roomState.currentTurnPlayerId === mySessionId;
  const currentField = currentPlayer ? METROVILLE_FIELDS[currentPlayer.position] : null;
  playMetroSound(runtimeState);

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
  metroDieOne.textContent = String(runtimeState.dice[0]);
  metroDieTwo.textContent = String(runtimeState.dice[1]);

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
    const isCurrentField = currentPlayer?.position === field.index;
    tile.className = `metro-tile tile-${field.type}${selectedPropertyIndex === field.index ? ' is-selected' : ''}${isCurrentField ? ' is-current' : ''}`;
    tile.dataset.field = String(field.index);
    tile.style.gridRow = String(getMetroGridPosition(field.index).row);
    tile.style.gridColumn = String(getMetroGridPosition(field.index).column);
    tile.type = 'button';
    tile.setAttribute('aria-label', `${field.name}${field.cost ? `, ${field.cost} Taler` : ''}${property?.ownerId ? ', besetzt' : ''}`);
    tile.setAttribute('aria-pressed', String(selectedPropertyIndex === field.index));
    tile.title = field.name;
    if (field.district) tile.dataset.district = field.district;
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
        token.setAttribute('aria-label', player.name);
        tile.appendChild(token);
      });
    tile.addEventListener('click', () => {
        if (property) openPropertyOverlay(field.index);
    });
    metroBoard.appendChild(tile);
  });

  renderPropertyCards(runtimeState, mySessionId);
  renderCardDraw(runtimeState);
  showLatestMetroEvent(runtimeState);

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

  renderTradeControls(roomState, runtimeState, mySessionId, isMyTurn);
  renderAuctionControls(roomState, runtimeState, mySessionId);

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

function selectMetroProperty(propertyIndex: number) {
  selectedPropertyIndex = latestMetroRuntimeState?.properties[propertyIndex] ? propertyIndex : null;
  metroBoard.querySelectorAll<HTMLElement>('.metro-tile').forEach((tile) => {
    const selected = tile.dataset.field === String(selectedPropertyIndex);
    tile.classList.toggle('is-selected', selected);
    tile.setAttribute('aria-pressed', String(selected));
  });
  metroPropertyCards.querySelectorAll<HTMLElement>('[data-property-index]').forEach((card) => {
    card.classList.toggle('is-detail', card.dataset.propertyIndex === String(selectedPropertyIndex));
  });
}

function renderPropertyCards(runtimeState: any, playerId: string | undefined) {
  const ownedIndices = Object.entries(runtimeState.properties)
    .filter(([, property]: any) => property.ownerId === playerId)
    .map(([index]) => Number(index));
  metroCardShelfCount.textContent = `${ownedIndices.length} Grundstück${ownedIndices.length === 1 ? '' : 'e'}`;
  metroPropertyCards.innerHTML = '';
  if (ownedIndices.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'metro-card-empty';
    empty.textContent = 'Deine erworbenen Grundstücke erscheinen hier.';
    metroPropertyCards.appendChild(empty);
    return;
  }
  ownedIndices.forEach((index) => {
    const card = createPropertyCard(runtimeState, index);
    card.addEventListener('click', () => openPropertyOverlay(index));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPropertyOverlay(index);
      }
    });
    metroPropertyCards.appendChild(card);
  });
}

function createPropertyCard(runtimeState: any, index: number) {
  const field = METROVILLE_FIELDS[index];
  const property = runtimeState.properties[index];
  const card = document.createElement('article');
  card.className = 'metro-property-card';
  card.dataset.propertyIndex = String(index);
  card.tabIndex = 0;
  card.setAttribute('aria-label', `Grundstückskarte ${field.name}`);
  card.innerHTML = `<div class="property-card-strip" style="background:${field.color || 'var(--charcoal)'}"></div>`;
  const header = document.createElement('div');
  header.className = 'property-card-header';
  header.textContent = field.type === 'station' ? 'BAHNHOF' : field.type === 'utility' ? 'VERSORGUNG' : 'GRUNDSTÜCK';
  const name = document.createElement('h3');
  name.textContent = field.name;
  const district = document.createElement('p');
  district.className = 'property-card-district';
  district.textContent = field.district || 'MetroVille';
  const prices = document.createElement('div');
  prices.className = 'property-card-prices';
  addPropertyPrice(prices, 'Kaufpreis', field.cost ? `${field.cost} Taler` : '-');
  addPropertyPrice(prices, 'Miete', field.baseRent ? `${field.baseRent} Taler` : '-');
  if (field.rents && field.type === 'property') {
    addPropertyPrice(prices, 'Ausbau', `${property.houses} / 5`);
    addPropertyPrice(prices, 'Aktuelle Miete', `${field.rents[property.houses] || field.rents[0]} Taler`);
  }
  const footer = document.createElement('div');
  footer.className = 'property-card-footer';
  footer.textContent = field.houseCost ? `Wohnblock: ${field.houseCost} Taler · Hypothek: ${Math.round((field.cost || 0) * 0.5)} Taler` : 'Hypothek nicht verfügbar';
  card.append(header, name, district, prices, footer);
  return card;
}

function openPropertyOverlay(propertyIndex: number) {
  if (!latestMetroRuntimeState?.properties[propertyIndex]) return;
  selectedPropertyIndex = propertyIndex;
  selectMetroProperty(propertyIndex);
  metroPropertyOverlayCard.innerHTML = '';
  const card = createPropertyCard(latestMetroRuntimeState, propertyIndex);
  card.classList.add('is-detail');
  card.tabIndex = -1;
  metroPropertyOverlayCard.appendChild(card);
  metroPropertyOverlay.hidden = false;
  document.body.classList.add('overlay-open');
  metroPropertyClose.focus();
}

function closePropertyOverlay() {
  metroPropertyOverlay.hidden = true;
  document.body.classList.remove('overlay-open');
}

function addPropertyPrice(container: HTMLElement, label: string, value: string) {
  const row = document.createElement('div');
  row.className = 'property-card-price-row';
  row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  container.appendChild(row);
}

function renderCardDraw(runtimeState: any) {
  const card = runtimeState.lastDrawnCard;
  if (!card) {
    metroCardDraw.hidden = true;
    return;
  }
  const key = `${card.deck}:${card.title}:${card.text}`;
  metroCardDrawDeck.textContent = card.deck === 'chance' ? 'CHANCE' : 'GEMEINSCHAFT';
  metroCardDrawTitle.textContent = card.title;
  metroCardDrawText.textContent = card.text;
  if (key !== lastCardKey) {
    metroCardDraw.hidden = false;
    metroCardDraw.classList.remove('is-revealing');
    void metroCardDraw.offsetWidth;
    metroCardDraw.classList.add('is-revealing');
    if (cardDrawTimer) window.clearTimeout(cardDrawTimer);
    cardDrawTimer = window.setTimeout(() => { metroCardDraw.hidden = true; }, 2800);
    lastCardKey = key;
  }
}

function showLatestMetroEvent(runtimeState: any) {
  const latestEvent = runtimeState.log[runtimeState.log.length - 1];
  if (!latestEvent || !lastMetroEventKey) {
    lastMetroEventKey = latestEvent || '';
    return;
  }
  if (latestEvent === lastMetroEventKey) return;
  lastMetroEventKey = latestEvent;
  metroEventToast.textContent = latestEvent.replace(/^[^A-Za-zÄÖÜäöüß]*/, '');
  metroEventToast.hidden = false;
  metroEventToast.classList.remove('is-visible');
  void metroEventToast.offsetWidth;
  metroEventToast.classList.add('is-visible');
  if (eventToastTimer) window.clearTimeout(eventToastTimer);
  eventToastTimer = window.setTimeout(() => {
    metroEventToast.classList.remove('is-visible');
    window.setTimeout(() => { metroEventToast.hidden = true; }, 180);
  }, 2600);
}

function playMetroSound(runtimeState: any) {
  if (!previousMetroRuntimeState) {
    previousMetroRuntimeState = runtimeState;
    return;
  }
  if (runtimeState.dice[0] !== previousMetroRuntimeState.dice[0] || runtimeState.dice[1] !== previousMetroRuntimeState.dice[1]) {
    audio.play('roll');
    metroDice.classList.remove('is-rolling');
    void metroDice.offsetWidth;
    metroDice.classList.add('is-rolling');
  }
  const previousLogLength = previousMetroRuntimeState.log.length;
  if (runtimeState.log.length > previousLogLength) {
    const latestLog = runtimeState.log[runtimeState.log.length - 1] || '';
    if (latestLog.includes('kauft') || latestLog.includes('ersteigert')) audio.play('buy');
    else if (latestLog.includes('Handel') || latestLog.includes('Handelsangebot')) audio.play('trade');
    else if (latestLog.includes('Versteigerung') || latestLog.includes('bietet')) audio.play('auction');
    else if (runtimeState.phase === 'gameover') audio.play('win');
  }
  previousMetroRuntimeState = runtimeState;
}

function renderTradeControls(roomState: any, runtimeState: any, mySessionId: string | undefined, isMyTurn: boolean) {
  const currentPlayer = runtimeState.players.find((player: any) => player.id === mySessionId);
  const targets = runtimeState.players.filter((player: any) => player.id !== mySessionId && !player.bankrupt);
  const selectedTarget = metroTradeTarget.value;
  metroTradeTarget.innerHTML = '';
  targets.forEach((player: any) => {
    const option = document.createElement('option');
    option.value = player.id;
    option.textContent = player.name;
    option.selected = player.id === selectedTarget || (!selectedTarget && player.id === targets[0]?.id);
    metroTradeTarget.appendChild(option);
  });

  const target = targets.find((player: any) => player.id === metroTradeTarget.value) || targets[0];
  populatePropertySelect(metroOfferedProperties, runtimeState, mySessionId);
  populatePropertySelect(metroRequestedProperties, runtimeState, target?.id);

  const pendingTrade = runtimeState.pendingTrade;
  const pendingForMe = pendingTrade?.toPlayerId === mySessionId;
  const canOffer = isMyTurn && roomState.status === 'playing' && runtimeState.phase === 'turn_end' && !pendingTrade && Boolean(target);
  setMetroActionState(metroActionOfferTrade, canOffer);
  metroActionAcceptTrade.toggleAttribute('disabled', !pendingForMe);
  metroActionDeclineTrade.toggleAttribute('disabled', !pendingForMe);
  if (!pendingTrade) {
    metroTradeStatus.textContent = currentPlayer ? 'Kein offenes Angebot.' : '';
  } else if (pendingForMe) {
    const offerer = runtimeState.players.find((player: any) => player.id === pendingTrade.fromPlayerId);
    metroTradeStatus.textContent = `Angebot von ${offerer?.name || 'Mitspieler'} wartet auf Antwort.`;
  } else if (pendingTrade.fromPlayerId === mySessionId) {
    const recipient = runtimeState.players.find((player: any) => player.id === pendingTrade.toPlayerId);
    metroTradeStatus.textContent = `Angebot an ${recipient?.name || 'Mitspieler'} wartet.`;
  } else {
    metroTradeStatus.textContent = 'Ein Handelsangebot ist offen.';
  }
}

function populatePropertySelect(select: HTMLSelectElement, runtimeState: any, ownerId: string | undefined) {
  select.innerHTML = '';
  if (!ownerId) return;
  Object.entries(runtimeState.properties)
    .filter(([, property]: any) => property.ownerId === ownerId)
    .forEach(([index]) => {
      const field = METROVILLE_FIELDS[Number(index)];
      if (!field) return;
      const option = document.createElement('option');
      option.value = index;
      option.textContent = field.name;
      select.appendChild(option);
    });
}

function renderAuctionControls(roomState: any, runtimeState: any, mySessionId: string | undefined) {
  const auction = runtimeState.auction;
  metroAuctionPanel.toggleAttribute('hidden', !auction);
  if (!auction) return;
  const field = METROVILLE_FIELDS[auction.propertyIndex];
  const bidderId = auction.activePlayerIds[auction.currentBidderIndex];
  const bidder = runtimeState.players.find((player: any) => player.id === bidderId);
  metroAuctionTitle.textContent = field?.name || 'Grundstück';
  metroAuctionBidder.textContent = `${bidder?.name || 'Unbekannt'} ist am Zug · Höchstgebot ${auction.highestBid} Taler`;
  metroAuctionBid.min = String(Math.max(10, auction.highestBid + 1));
  if (Number(metroAuctionBid.value) < Number(metroAuctionBid.min)) metroAuctionBid.value = metroAuctionBid.min;
  const canBid = roomState.status === 'playing' && bidderId === mySessionId;
  setMetroActionState(metroAuctionBid, canBid);
  setMetroActionState(metroActionBid, canBid);
  setMetroActionState(metroActionPass, canBid);
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

metrovillePresetSelect.addEventListener('change', () => {
  currentRoom?.send('SET_GAME_PRESET', { preset: metrovillePresetSelect.value });
});

btnLeaveRoom.addEventListener('click', () => {
  currentRoom?.leave();
});

btnGameLeave.addEventListener('click', () => {
  currentRoom?.leave();
});

function sendMetroAction(action: any) {
  audio.play('click');
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
metroTradeTarget.addEventListener('change', () => {
  if (latestMetroRuntimeState) renderTradeControls(latestMetroRoomState, latestMetroRuntimeState, currentRoom?.sessionId, latestMetroRoomState.currentTurnPlayerId === currentRoom?.sessionId);
});
metroActionOfferTrade.addEventListener('click', () => {
  sendMetroAction({
    type: 'OFFER_TRADE',
    offer: {
      fromPlayerId: currentRoom?.sessionId,
      toPlayerId: metroTradeTarget.value,
      offeredMoney: Number(metroOfferedMoney.value) || 0,
      offeredPropertyIndices: [...metroOfferedProperties.selectedOptions].map(option => Number(option.value)),
      requestedMoney: Number(metroRequestedMoney.value) || 0,
      requestedPropertyIndices: [...metroRequestedProperties.selectedOptions].map(option => Number(option.value))
    }
  });
});
metroActionAcceptTrade.addEventListener('click', () => {
  if (latestMetroRuntimeState?.pendingTrade) {
    sendMetroAction({ type: 'ACCEPT_TRADE', tradeId: latestMetroRuntimeState.pendingTrade.id });
  }
});
metroActionDeclineTrade.addEventListener('click', () => {
  if (latestMetroRuntimeState?.pendingTrade) {
    sendMetroAction({ type: 'DECLINE_TRADE', tradeId: latestMetroRuntimeState.pendingTrade.id });
  }
});
metroActionBid.addEventListener('click', () => {
  sendMetroAction({ type: 'BID_AUCTION', bidAmount: Number(metroAuctionBid.value) });
});
metroActionPass.addEventListener('click', () => sendMetroAction({ type: 'PASS_AUCTION' }));
metroPropertyClose.addEventListener('click', closePropertyOverlay);
metroPropertyOverlay.addEventListener('click', (event) => {
  if (event.target === metroPropertyOverlay) closePropertyOverlay();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !metroPropertyOverlay.hidden) closePropertyOverlay();
});

btnCopyLink.addEventListener('click', () => {
  navigator.clipboard.writeText(shareLinkInput.value).then(() => {
    btnCopyLink.textContent = 'Kopiert!';
    setTimeout(() => { btnCopyLink.textContent = 'Link kopieren'; }, 2000);
  });
});

audioToggle.addEventListener('click', () => {
  audio.toggleMuted();
  syncAudioControls();
  if (!audio.muted) audio.play('click');
});

audioVolume.addEventListener('input', () => {
  audio.setVolume(Number(audioVolume.value));
  syncAudioControls();
});

colorModeToggle.addEventListener('click', () => {
  const enabled = !document.body.classList.contains('colorblind-mode');
  document.body.classList.toggle('colorblind-mode', enabled);
  localStorage.setItem('metroville_color_mode', enabled ? 'on' : 'off');
  syncColorMode();
});
