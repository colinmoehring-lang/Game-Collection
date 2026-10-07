import { Client, Room } from 'colyseus.js';
import QRCode from 'qrcode';
import { generateRoomCode } from '@metroville/game-sdk';
import { METROVILLE_FIELDS, MetrovilleModule } from '@metroville/game-metroville';
import { audio } from './audio.js';
import { METRO_CARD_BOT_OVERLAY_MS, METRO_EVENT_TOAST_MS, METRO_EVENT_TOAST_QUEUE_MAX } from './metroConstants.js';
import {
  createMetroPresentationState,
  getDisplayPosition,
  syncMetroPresentation,
  type MetroPresentationState
} from './metroPresentation.js';

// VITE_BACKEND_URL kommt aus der Deploy-Umgebung (siehe render.yaml).
// Lokal wird der Colyseus-Server auf demselben Host wie die Seite erwartet.
const localBackendProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const DEFAULT_BACKEND_URL = `${localBackendProtocol}://${window.location.hostname}:2567`;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.trim() || DEFAULT_BACKEND_URL;
const BACKEND_HTTP_URL = BACKEND_URL.replace(/^wss?:/, 'http:');

const client = new Client(BACKEND_URL);
let currentRoom: Room<any> | null = null;
let lanShareAddress: string | null = null;
let currentSessionToken = sessionStorage.getItem('metroville_session_token') || ('tok-' + Math.random().toString(36).substring(2, 9));
sessionStorage.setItem('metroville_session_token', currentSessionToken);

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
const gameSelect = document.getElementById('game-select') as HTMLInputElement;
const gameModePicker = document.getElementById('game-mode-picker')!;
const gameModeTrigger = document.getElementById('game-select-trigger')!;
const gameModeValue = document.getElementById('game-select-value')!;
const gameModeOptions = document.getElementById('game-mode-options')!;
const gameModeOptionButtons = [...gameModeOptions.querySelectorAll<HTMLButtonElement>('[role="option"]')];
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
const metrovillePresetValue = document.getElementById('metroville-preset-value') as HTMLInputElement;
const metrovillePresetPicker = document.getElementById('metroville-preset-picker')!;
const metrovillePresetTrigger = document.getElementById('metroville-preset-trigger')!;
const metrovillePresetDisplay = document.getElementById('metroville-preset-display')!;
const metrovillePresetOptions = document.getElementById('metroville-preset-options')!;
const metrovillePresetDescription = document.getElementById('metroville-preset-description')!;

const gameStatusBar = document.getElementById('game-status-bar')!;
const gameTitleHeader = document.getElementById('game-title-header')!;
const tictactoeGame = document.getElementById('tictactoe-game')!;
const metrovilleGame = document.getElementById('metroville-game')!;
const texasHoldemGame = document.getElementById('texasholdem-game')!;
const pokerCommunity = document.getElementById('poker-community')!;
const pokerSeats = document.getElementById('poker-seats')!;
const pokerHoleCards = document.getElementById('poker-hole-cards')!;
const pokerCardsToggle = document.getElementById('poker-cards-toggle')!;
const pokerBettingActions = document.getElementById('poker-betting-actions')!;
const pokerDrawActions = document.getElementById('poker-draw-actions')!;
const pokerDrawHint = document.getElementById('poker-draw-hint')!;
const pokerDrawExchange = document.getElementById('poker-draw-exchange')!;
const pokerDrawKeep = document.getElementById('poker-draw-keep')!;
const pokerHandNumber = document.getElementById('poker-hand-number')!;
const pokerStageLabel = document.getElementById('poker-stage-label')!;
const pokerBlinds = document.getElementById('poker-blinds')!;
const pokerPot = document.getElementById('poker-pot')!;
const pokerTurnNote = document.getElementById('poker-turn-note')!;
const pokerPlayerList = document.getElementById('poker-player-list')!;
const pokerResult = document.getElementById('poker-result')!;
const pokerLog = document.getElementById('poker-log')!;
const pokerRaiseTo = document.getElementById('poker-raise-to') as HTMLInputElement;
const pokerFold = document.getElementById('poker-fold')!;
const pokerCheck = document.getElementById('poker-check')!;
const pokerCall = document.getElementById('poker-call')!;
const pokerRaise = document.getElementById('poker-raise')!;
const pokerAllIn = document.getElementById('poker-all-in')!;
const pokerNextHand = document.getElementById('poker-next-hand')!;
const metroEventToast = document.getElementById('metro-event-toast')!;
const multiBoard = document.getElementById('multi-board')!;
const metroBoard = document.getElementById('metro-board')!;
const metroTurnName = document.getElementById('metro-turn-name')!;
const metroTurnPhase = document.getElementById('metro-turn-phase')!;
const metroActionContext = document.getElementById('metro-action-context')!;
const metroCenterTitle = document.getElementById('metro-center-title')!;
const metroCenterDetail = document.getElementById('metro-center-detail')!;
const metroDice = document.getElementById('metro-dice')!;
const metroDieOne = document.getElementById('metro-die-one')!;
const metroDieTwo = document.getElementById('metro-die-two')!;
const metroCardOverlay = document.getElementById('metro-card-overlay')!;
const metroCardOverlayClose = document.getElementById('metro-card-overlay-close')!;
const metroCardOverlayDeck = document.getElementById('metro-card-overlay-deck')!;
const metroCardOverlayTitle = document.getElementById('metro-card-overlay-title')!;
const metroCardOverlayText = document.getElementById('metro-card-overlay-text')!;
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
const metroTradeLease = document.getElementById('metro-trade-lease') as HTMLInputElement;
const metroTradeLeaseLabel = document.getElementById('metro-trade-lease-label')!;
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
let latestPrivatePokerView: { revision: number; state: any } | null = null;
let pokerCardsHidden = localStorage.getItem('texasholdem_cards_hidden') === 'true';
let pokerDrawSelection = new Set<number>();
let pokerDrawSelectionKey = '';
let previousMetroRuntimeState: any = null;
let previousTicTacToeMoveCount = 0;
let eventToastTimer: number | undefined;
let cardDrawTimer: number | undefined;
let lastCardKey = '';
let lastMetroEventKey = '';
let metroPresentation: MetroPresentationState = createMetroPresentationState();
let metroPresentationRuntime: any = null;
let metroRenderQueue: Promise<void> = Promise.resolve();
let metroPresetOptionButtons: HTMLButtonElement[] = [];

const metrovillePresets = MetrovilleModule.manifest.variants || [];

function closeMetroPresetMenu(restoreFocus = false) {
  metrovillePresetOptions.hidden = true;
  metrovillePresetTrigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) metrovillePresetTrigger.focus();
}

function selectMetroPreset(presetId: string, notifyServer = false) {
  const preset = metrovillePresets.find((entry) => entry.id === presetId) || metrovillePresets[0];
  if (!preset) return;
  metrovillePresetValue.value = preset.id;
  metrovillePresetDisplay.textContent = preset.name;
  metrovillePresetDescription.textContent = preset.description;
  metroPresetOptionButtons.forEach((button) => {
    const selected = button.dataset.presetId === preset.id;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  closeMetroPresetMenu(true);
  if (notifyServer) currentRoom?.send('SET_GAME_PRESET', { preset: preset.id });
}

metrovillePresetOptions.replaceChildren(...metrovillePresets.map((preset) => {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'game-mode-option';
  option.role = 'option';
  option.dataset.presetId = preset.id;
  option.textContent = preset.name;
  option.addEventListener('click', () => selectMetroPreset(preset.id, true));
  return option;
}));
metroPresetOptionButtons = [...metrovillePresetOptions.querySelectorAll<HTMLButtonElement>('[role="option"]')];
selectMetroPreset(metrovillePresets[0]?.id || 'standard');

metrovillePresetTrigger.addEventListener('click', () => {
  if (metrovillePresetTrigger.hasAttribute('disabled')) return;
  if (metrovillePresetOptions.hidden) {
    metrovillePresetOptions.hidden = false;
    metrovillePresetTrigger.setAttribute('aria-expanded', 'true');
    metroPresetOptionButtons.find((button) => button.classList.contains('is-selected'))?.focus();
  } else {
    closeMetroPresetMenu();
  }
});

document.addEventListener('pointerdown', (event) => {
  if (!metrovillePresetPicker.contains(event.target as Node)) closeMetroPresetMenu();
});

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

function getRoomShareUrl(roomCode: string): string {
  const url = new URL(window.location.href);
  if (lanShareAddress && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    url.hostname = lanShareAddress;
  }
  url.searchParams.set('room', roomCode);
  return url.toString();
}

async function resolveLanShareAddress() {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return;
  try {
    const response = await fetch(`${BACKEND_HTTP_URL}/network-address`);
    if (!response.ok) return;
    const result = await response.json() as { address?: string | null };
    if (!result.address) return;
    lanShareAddress = result.address;
    if (currentRoom?.state.status === 'lobby') renderLobby(currentRoom.state);
  } catch {
    lanShareAddress = null;
  }
}

syncAudioControls();
void resolveLanShareAddress();
if (localStorage.getItem('metroville_color_mode') === 'on') document.body.classList.add('colorblind-mode');
syncColorMode();

function closeGameModeMenu(restoreFocus = false) {
  gameModeOptions.hidden = true;
  gameModeTrigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) gameModeTrigger.focus();
}

function selectGameMode(value: string) {
  const option = gameModeOptionButtons.find(button => button.dataset.gameId === value);
  if (!option) return;
  gameSelect.value = value;
  gameModeValue.textContent = option.textContent || '';
  gameModeOptionButtons.forEach(button => {
    const selected = button === option;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  closeGameModeMenu(true);
}

function openGameModeMenu() {
  gameModeOptions.hidden = false;
  gameModeTrigger.setAttribute('aria-expanded', 'true');
  const selected = gameModeOptionButtons.find(button => button.dataset.gameId === gameSelect.value) || gameModeOptionButtons[0];
  selected?.focus();
}

gameModeTrigger.addEventListener('click', () => {
  if (gameModeOptions.hidden) openGameModeMenu();
  else closeGameModeMenu();
});

gameModeTrigger.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openGameModeMenu();
  }
});

gameModeOptionButtons.forEach((option, index) => {
  option.addEventListener('click', () => selectGameMode(option.dataset.gameId || ''));
  option.addEventListener('keydown', event => {
    let nextIndex = index;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % gameModeOptionButtons.length;
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + gameModeOptionButtons.length) % gameModeOptionButtons.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = gameModeOptionButtons.length - 1;
    else if (event.key === 'Escape') {
      event.preventDefault();
      closeGameModeMenu(true);
      return;
    } else if (event.key === 'Tab') {
      closeGameModeMenu(true);
      return;
    } else return;
    event.preventDefault();
    gameModeOptionButtons[nextIndex]?.focus();
  });
});

document.addEventListener('pointerdown', event => {
  if (!gameModePicker.contains(event.target as Node)) closeGameModeMenu();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !gameModeOptions.hidden) closeGameModeMenu(true);
});

function getPlayerName(): string {
  const name = playerNameInput.value.trim() || 'Spieler';
  localStorage.setItem('metroville_player_name', name);
  return name;
}

async function joinRoom(roomCode: string, isCreate: boolean = false) {
  try {
    latestPrivatePokerView = null;
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

  room.onMessage('PRIVATE_GAME_VIEW', (message: string) => {
    try {
      latestPrivatePokerView = JSON.parse(message);
      if (currentRoom === room && ['texasholdem', 'five-card-draw'].includes(room.state.gameId) && room.state.status !== 'lobby') {
        renderGame(room.state);
      }
    } catch {
      latestPrivatePokerView = null;
    }
  });

  room.onLeave(() => {
    connIndicator.textContent = '● Getrennt';
    connIndicator.style.color = 'var(--warm-grey)';
    currentRoom = null;
    previousMetroRuntimeState = null;
    metroPresentation = createMetroPresentationState();
    metroPresentationRuntime = null;
    latestPrivatePokerView = null;
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
  const shareUrl = getRoomShareUrl(code);
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
    if (selectedPreset) selectMetroPreset(selectedPreset.id);
    metrovillePresetTrigger.toggleAttribute('disabled', !meIsHost);
    metrovillePresetTrigger.style.pointerEvents = meIsHost ? '' : 'none';
    metrovillePresetTrigger.style.opacity = meIsHost ? '1' : '0.65';
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

  if (state.gameId === 'texasholdem' || state.gameId === 'five-card-draw') {
    renderTexasHoldem(state, runtimeState);
    return;
  }

  texasHoldemGame.hidden = true;
  if (state.gameId === 'metroville') {
    queueMetrovilleRender(state, runtimeState);
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

function renderDiePips(container: HTMLElement, value: number) {
  const pip = container.querySelector('.metro-die-pips') as HTMLElement | null;
  if (!pip) return;
  pip.dataset.value = String(value);
  pip.replaceChildren();
  const positions: Record<number, number[][]> = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [1, 3], [3, 1], [3, 3]],
    5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
    6: [[1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3]]
  };
  (positions[value] || positions[1]).forEach(([row, col]) => {
    const dot = document.createElement('span');
    dot.className = 'metro-die-dot';
    dot.style.gridRow = String(row);
    dot.style.gridColumn = String(col);
    pip.appendChild(dot);
  });
}

function queueMetrovilleRender(roomState: any, runtimeState: any) {
  metroRenderQueue = metroRenderQueue.then(async () => {
    const previous = metroPresentationRuntime;
    await syncMetroPresentation(metroPresentation, previous, runtimeState, () => {
      renderMetroDice();
      if (latestMetroRoomState && latestMetroRuntimeState) {
        paintMetroBoardTokens(latestMetroRoomState, latestMetroRuntimeState);
      }
    });
    metroPresentationRuntime = runtimeState;
    renderMetroville(roomState, runtimeState);
  }).catch(() => {
    metroPresentationRuntime = runtimeState;
    renderMetroville(roomState, runtimeState);
  });
}

function renderMetroDice() {
  renderDiePips(metroDieOne, metroPresentation.diceDisplay[0]);
  renderDiePips(metroDieTwo, metroPresentation.diceDisplay[1]);
  metroDice.classList.toggle('is-rolling', metroPresentation.diceRolling);
}

function paintMetroBoardTokens(roomState: any, runtimeState: any) {
  metroBoard.querySelectorAll<HTMLElement>('.metro-tile').forEach((tile) => {
    const fieldIndex = Number(tile.dataset.field);
    const fieldPlayers = runtimeState.players.filter((player: any) =>
      !player.bankrupt && getDisplayPosition(metroPresentation, player.id, player.position) === fieldIndex
    );
    tile.classList.toggle('has-players', fieldPlayers.length > 0);
    let tokenStack = tile.querySelector('.metro-token-stack');
    if (fieldPlayers.length === 0) {
      tokenStack?.remove();
      return;
    }
    if (!tokenStack) {
      tokenStack = document.createElement('span');
      tokenStack.className = 'metro-token-stack';
      tokenStack.setAttribute('role', 'img');
      tile.appendChild(tokenStack);
    }
    tokenStack.replaceChildren();
    tokenStack.title = fieldPlayers.map((player: any) => player.name).join(', ');
    tokenStack.setAttribute('aria-label', `${fieldPlayers.length} Spieler auf Feld ${fieldIndex}`);
    fieldPlayers.forEach((player: any) => {
      const token = document.createElement('span');
      token.className = `metro-token${metroPresentation.hopTokenId === player.id ? ' is-hopping' : ''}`;
      token.style.backgroundColor = player.color || 'var(--terracotta)';
      token.setAttribute('aria-hidden', 'true');
      tokenStack!.appendChild(token);
    });
  });
}

function describeMetroDecision(runtimeState: any, player: any): string {
  if (runtimeState.phase === 'card_reveal') return 'liest eine Karte';
  if (runtimeState.phase === 'roll') {
    return player?.inJail ? 'würfelt, um die Sicherheitszone zu verlassen' : 'würfelt';
  }
  if (runtimeState.phase === 'tile_action') {
    const field = player ? METROVILLE_FIELDS[player.position] : null;
    return field ? `entscheidet über ${field.name} (kaufen oder passen)` : 'entscheidet über einen Grundstückskauf';
  }
  if (runtimeState.phase === 'auction') {
    const auction = runtimeState.auction;
    return auction ? `bietet mindestens ${auction.highestBid + 10} Taler oder passt` : 'entscheidet über ein Gebot';
  }
  if (runtimeState.phase === 'turn_end') return 'kann den Zug beenden, bauen oder handeln';
  if (runtimeState.phase === 'gameover') return 'das Spiel ist beendet';
  return formatMetroPhase(runtimeState.phase);
}

function groupMetroLogEntries(entries: string[]): string[][] {
  const groups: string[][] = [];
  entries.forEach(entry => {
    const startsRoll = entry.includes(' würfelt [');
    const currentGroup = groups[groups.length - 1];
    const isExtraRoll = currentGroup?.some(event => event.includes('darf noch einmal würfeln')) || false;
    if (startsRoll && currentGroup && !isExtraRoll) groups.push([entry]);
    else if (currentGroup) currentGroup.push(entry);
    else groups.push([entry]);
  });
  return groups;
}

function renderMetroville(roomState: any, runtimeState: any) {
  tictactoeGame.hidden = true;
  texasHoldemGame.hidden = true;
  metrovilleGame.hidden = false;
  latestMetroRoomState = roomState;
  latestMetroRuntimeState = runtimeState;
  const mySessionId = currentRoom?.sessionId;
  const currentPlayer = runtimeState.players.find((player: any) => player.id === mySessionId);
  const turnPlayer = runtimeState.players.find((player: any) => player.id === runtimeState.currentTurnPlayerId);
  const lastRoller = runtimeState.players.find((player: any) => player.id === runtimeState.lastRollerId);
  const isMyTurn = roomState.currentTurnPlayerId === mySessionId;
  const currentField = currentPlayer ? METROVILLE_FIELDS[currentPlayer.position] : null;
  const roomTurnPlayer = runtimeState.players.find((player: any) => player.id === roomState.currentTurnPlayerId);
  const turnField = roomTurnPlayer ? METROVILLE_FIELDS[roomTurnPlayer.position] : null;
  playMetroSound(runtimeState);

  gameStatusBar.textContent = roomState.status === 'gameover'
    ? `Spiel beendet: ${runtimeState.winReason || 'Endstand erreicht'}`
    : isMyTurn
      ? 'Du bist am Zug.'
      : `Warten auf ${roomTurnPlayer?.name || 'den nächsten Spieler'} · ${turnField?.name || 'Standort unbekannt'} · ${describeMetroDecision(runtimeState, roomTurnPlayer)}`;

  gameTitleHeader.textContent = 'MetroVille: City of Fortune';
  metroTurnName.textContent = roomTurnPlayer?.name || 'Unbekannt';
  metroTurnPhase.textContent = isMyTurn
    ? formatMetroPhase(runtimeState.phase)
    : `${turnField?.name || 'Standort unbekannt'} · ${describeMetroDecision(runtimeState, roomTurnPlayer)}`;
  metroCenterTitle.textContent = runtimeState.phase === 'gameover'
    ? 'Die Stadt hat entschieden'
    : (isMyTurn ? currentField?.name : turnField?.name) || 'Stadt der Möglichkeiten';
  metroCenterDetail.textContent = runtimeState.phase === 'gameover'
    ? runtimeState.winReason || 'Spiel beendet'
    : `Runde ${runtimeState.turnCount + 1}`;
  renderMetroDice();
  const diceCaptionText = lastRoller
    ? `Wurf von ${lastRoller.name}: ${runtimeState.dice[0]} + ${runtimeState.dice[1]}`
    : 'Noch kein Wurf';

  metroBoard.innerHTML = '';
  const center = document.createElement('div');
  center.className = 'metro-center';
  center.innerHTML = '<span class="metro-center-kicker">METROVILLE</span>';
  const centerTitle = document.createElement('strong');
  centerTitle.textContent = metroCenterTitle.textContent;
  const centerDetail = document.createElement('span');
  centerDetail.textContent = metroCenterDetail.textContent;
  if (runtimeState.config.mechanics?.cityParkJackpot) {
    const jackpot = document.createElement('span');
    jackpot.className = 'metro-center-jackpot';
    jackpot.textContent = `Stadtpark-Jackpot: ${runtimeState.cityParkJackpot} Taler`;
    center.appendChild(jackpot);
  }
  const diceCaption = document.createElement('span');
  diceCaption.className = 'metro-dice-caption';
  diceCaption.textContent = diceCaptionText;
  diceCaption.setAttribute('aria-label', lastRoller
    ? `Würfelwurf von ${lastRoller.name}: ${runtimeState.dice[0]} und ${runtimeState.dice[1]}`
    : 'Noch kein Würfelwurf');
  const deckStacks = document.createElement('div');
  deckStacks.className = 'metro-deck-stacks';
  deckStacks.setAttribute('aria-hidden', 'true');
  deckStacks.innerHTML = `
    <div class="metro-deck metro-deck-chance" id="metro-deck-chance-live"><span class="metro-deck-label">Chance</span></div>
    <div class="metro-deck metro-deck-community" id="metro-deck-community-live"><span class="metro-deck-label">Gemein-   schaft</span></div>
  `;
  center.append(centerTitle, diceCaption, centerDetail, deckStacks);
  metroBoard.appendChild(center);

  METROVILLE_FIELDS.forEach((field) => {
    const tile = document.createElement('button');
    const property = runtimeState.properties[field.index];
    const isCurrentField = roomTurnPlayer?.position === field.index;
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
    const fieldPlayers = runtimeState.players
      .filter((player: any) =>
        !player.bankrupt && getDisplayPosition(metroPresentation, player.id, player.position) === field.index
      );
    if (fieldPlayers.length > 0) {
      tile.classList.add('has-players');
      const tokenStack = document.createElement('span');
      tokenStack.className = 'metro-token-stack';
      tokenStack.title = fieldPlayers.map((player: any) => player.name).join(', ');
      tokenStack.setAttribute('role', 'img');
      tokenStack.setAttribute('aria-label', `${fieldPlayers.length} Spieler auf ${field.name}: ${fieldPlayers.map((player: any) => player.name).join(', ')}`);
      fieldPlayers.forEach((player: any) => {
        const token = document.createElement('span');
        token.className = `metro-token${metroPresentation.hopTokenId === player.id ? ' is-hopping' : ''}`;
        token.style.backgroundColor = player.color || 'var(--terracotta)';
        token.setAttribute('aria-hidden', 'true');
        tokenStack.appendChild(token);
      });
      tile.appendChild(tokenStack);
    }
    tile.addEventListener('click', () => {
      if (property) openPropertyOverlay(field.index);
    });
    metroBoard.appendChild(tile);
  });

  renderPropertyCards(runtimeState, mySessionId);
  renderCardOverlay(roomState, runtimeState, mySessionId);
  updateDeckStacks(runtimeState);
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
  groupMetroLogEntries(runtimeState.log).slice(-4).reverse().forEach((entries: string[]) => {
    const group = document.createElement('section');
    group.className = 'metro-log-group';
    const rolls = entries.filter(entry => entry.includes(' würfelt [')).map(entry => {
      const match = entry.match(/^(.+?) würfelt \[(.+?)\]/);
      return match ? `${match[1]} · ${match[2].replace(', ', ' + ')}` : entry;
    });
    const heading = document.createElement('strong');
    heading.className = 'metro-log-group-title';
    heading.textContent = rolls.length ? rolls.join(' → ') : 'Spielereignisse';
    group.appendChild(heading);
    const events = document.createElement('div');
    events.className = 'metro-log-group-events';
    entries.filter(entry => !entry.includes(' würfelt [')).forEach((entry: string) => {
      const line = document.createElement('p');
      line.textContent = entry;
      events.appendChild(line);
    });
    if (events.childElementCount > 0) group.appendChild(events);
    metroLog.appendChild(group);
  });

  const awaitingCardDismiss = runtimeState.phase === 'card_reveal' && runtimeState.pendingCard;
  const canAct = isMyTurn && roomState.status === 'playing' && !metroPresentation.movementLocked && !awaitingCardDismiss;
  const selectedProperty = selectedPropertyIndex === null ? null : runtimeState.properties[selectedPropertyIndex];
  const selectedField = selectedPropertyIndex === null ? null : METROVILLE_FIELDS[selectedPropertyIndex];
  const isUnownedBuyableField = Boolean(currentField?.cost && !runtimeState.properties[currentField.index]?.ownerId);
  const buyValidation = currentPlayer && isUnownedBuyableField
    ? MetrovilleModule.validateAction(runtimeState, { type: 'BUY_PROPERTY' }, currentPlayer.id)
    : null;
  const canBuy = canAct && runtimeState.phase === 'tile_action' && Boolean(buyValidation?.valid);
  const buyDisabledReason = !canAct
    ? roomState.status !== 'playing' ? 'Das Spiel läuft nicht.' : 'Warten, bis du am Zug bist.'
    : runtimeState.phase !== 'tile_action'
      ? 'Kaufen ist erst nach der Landung auf einem freien Grundstück möglich.'
      : !isUnownedBuyableField
        ? 'Dieses Feld kann nicht gekauft werden.'
        : buyValidation?.error || 'Kaufen ist derzeit nicht möglich.';
  const buildValidation = currentPlayer && selectedPropertyIndex !== null
    ? MetrovilleModule.validateAction(runtimeState, { type: 'BUILD_HOUSE', propertyIndex: selectedPropertyIndex }, currentPlayer.id)
    : null;
  const canBuild = canAct && runtimeState.phase === 'turn_end' && selectedField?.type === 'property'
    && selectedProperty?.ownerId === mySessionId && Boolean(buildValidation?.valid);
  const buildDisabledReason = !canAct
    ? roomState.status !== 'playing' ? 'Das Spiel läuft nicht.' : 'Warten, bis du am Zug bist.'
    : runtimeState.phase !== 'turn_end'
      ? 'Bauen ist am Ende deines Zuges möglich.'
      : !selectedProperty || selectedProperty.ownerId !== mySessionId
        ? 'Wähle zuerst eines deiner Grundstücke.'
        : selectedField?.type !== 'property'
          ? 'Auf diesem Feld kann nicht gebaut werden.'
          : buildValidation?.error || 'Bauen ist derzeit nicht möglich.';
  setMetroActionState(metroActionRoll, canAct && runtimeState.phase === 'roll');
  setMetroActionState(metroActionBuy, canBuy, buyDisabledReason);
  setMetroActionState(metroActionDecline, canAct && runtimeState.phase === 'tile_action');
  setMetroActionState(metroActionEnd, canAct && runtimeState.phase === 'turn_end', canAct ? 'Deinen Zug kannst du erst nach der Feldaktion beenden.' : buyDisabledReason);
  setMetroActionState(metroActionJailFine, canAct && currentPlayer?.inJail === true);
  setMetroActionState(metroActionJailCard, canAct && currentPlayer?.inJail === true && currentPlayer.getOutOfJailCards > 0);
  setMetroActionState(metroActionBuild, canBuild, buildDisabledReason);
  setMetroActionState(metroActionSell, canAct && Boolean(selectedProperty?.ownerId === mySessionId && selectedProperty.houses > 0));
  setMetroActionState(metroActionMortgage, canAct && Boolean(selectedProperty?.ownerId === mySessionId && !selectedProperty.isMortgaged));
  setMetroActionState(metroActionUnmortgage, canAct && Boolean(selectedProperty?.ownerId === mySessionId && selectedProperty.isMortgaged));
  metroActionContext.textContent = describeMetroActionContext(roomState, runtimeState, isMyTurn, currentPlayer, currentField, buyDisabledReason, buildDisabledReason, canBuy, canBuild);
}

function describeMetroActionContext(
  roomState: any,
  runtimeState: any,
  isMyTurn: boolean,
  currentPlayer: any,
  currentField: any,
  buyDisabledReason: string,
  buildDisabledReason: string,
  canBuy: boolean,
  canBuild: boolean
): string {
  if (roomState.status === 'gameover' || runtimeState.phase === 'gameover') return runtimeState.winReason || 'Das Spiel ist beendet.';
  if (!isMyTurn) {
    const activePlayer = runtimeState.players.find((player: any) => player.id === roomState.currentTurnPlayerId);
    const field = activePlayer ? METROVILLE_FIELDS[activePlayer.position] : null;
    return `Warten auf ${activePlayer?.name || 'den nächsten Spieler'} · ${field?.name || 'Standort unbekannt'} · ${describeMetroDecision(runtimeState, activePlayer)}.`;
  }
  if (runtimeState.phase === 'card_reveal') {
    return 'Lies die Karte und klicke auf Schließen, um fortzufahren.';
  }
  if (runtimeState.phase === 'roll') {
    return currentPlayer?.inJail
      ? 'Würfle, um einen Pasch zu versuchen, oder nutze eine Freikarte beziehungsweise zahle die Gebühr.'
      : 'Würfle, um über dein nächstes Feld zu entscheiden.';
  }
  if (runtimeState.phase === 'tile_action') {
    const passOutcome = runtimeState.config.preset === 'classic_light'
      ? 'Passen, um den Zug zu beenden.'
      : 'Passen, um eine Versteigerung zu starten.';
    if (canBuy) return `${currentField.name} kostet ${currentField.cost} Taler. Kaufen oder ${passOutcome}`;
    if (currentField?.cost && currentPlayer && currentPlayer.money < currentField.cost) {
      return `${currentField.name} kostet ${currentField.cost} Taler; du hast ${currentPlayer.money}. ${passOutcome}`;
    }
    return buyDisabledReason;
  }
  if (runtimeState.phase === 'auction') {
    const auction = runtimeState.auction;
    return auction ? `Gebot für ${METROVILLE_FIELDS[auction.propertyIndex]?.name || 'Grundstück'}: mindestens ${auction.highestBid + 10} Taler.` : 'Entscheide über das aktuelle Gebot.';
  }
  if (runtimeState.phase === 'turn_end') {
    if (selectedPropertyIndex !== null && !canBuild && runtimeState.properties[selectedPropertyIndex]?.ownerId === currentPlayer?.id) {
      return buildDisabledReason;
    }
    if (canBuild) return 'Du kannst bauen oder handeln und danach deinen Zug beenden.';
    const ownsProperty = Object.entries(runtimeState.properties).some(([index, property]: [string, any]) =>
      property.ownerId === currentPlayer?.id && METROVILLE_FIELDS[Number(index)]?.type === 'property' && property.houses < 5
    );
    return ownsProperty
      ? 'Du kannst eines deiner Grundstücke für einen Ausbau auswählen, handeln oder den Zug beenden.'
      : 'Dein Zug ist abgeschlossen. Du kannst noch handeln oder den Zug beenden.';
  }
  return formatMetroPhase(runtimeState.phase);
}

function createPokerCard(card: string | undefined, concealed = false) {
  const element = document.createElement('span');
  element.className = `poker-card${concealed ? ' is-hidden-card' : ''}`;
  if (concealed || !card) {
    element.textContent = 'M';
    element.setAttribute('aria-label', 'Verdeckte Karte');
    return element;
  }
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const rankLabel = rank === 'T' ? '10' : rank;
  const suitGlyph: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const suitName: Record<string, string> = { S: 'Pik', H: 'Herz', D: 'Karo', C: 'Kreuz' };
  const rankName: Record<string, string> = { J: 'Bube', Q: 'Dame', K: 'König', A: 'Ass' };
  element.classList.toggle('is-red-card', suit === 'H' || suit === 'D');
  const corner = document.createElement('span');
  corner.className = 'poker-card-corner';
  corner.textContent = rankLabel;
  const center = document.createElement('strong');
  center.textContent = suitGlyph[suit] || '?';
  element.append(corner, center);
  element.setAttribute('aria-label', `${rankName[rank] || rankLabel} ${suitName[suit] || 'Karte'}`);
  return element;
}

function renderTexasHoldem(roomState: any, publicState: any) {
  tictactoeGame.hidden = true;
  metrovilleGame.hidden = true;
  texasHoldemGame.hidden = false;
  const isFiveCardDraw = publicState.gameType === 'fivecarddraw';
  const isDrawStage = isFiveCardDraw && publicState.stage === 'draw';
  gameTitleHeader.textContent = isFiveCardDraw ? 'Five Card Draw' : "Texas Hold’em";
  texasHoldemGame.querySelector('.poker-table-mark')!.textContent = isFiveCardDraw ? 'FIVE CARD DRAW' : 'TEXAS HOLD’EM';
  texasHoldemGame.querySelector('.poker-heading .panel-kicker')!.textContent = isFiveCardDraw ? 'FIVE CARD DRAW' : 'TEXAS HOLD’EM';

  const privateView = latestPrivatePokerView && latestPrivatePokerView.revision === publicState.revision
    ? latestPrivatePokerView.state
    : null;
  const playerId = currentRoom?.sessionId;
  const privatePlayer = privateView?.players?.find((player: any) => player.id === playerId);
  const players = publicState.players.map((player: any) => {
    const privatePlayerState = privateView?.players?.find((candidate: any) => candidate.id === player.id);
    return privatePlayerState ? { ...player, hand: privatePlayerState.hand } : player;
  });
  const currentPlayer = players.find((player: any) => player.id === playerId);
  const turnPlayer = players.find((player: any) => player.id === roomState.currentTurnPlayerId);
  const isMyTurn = roomState.status === 'playing' && roomState.currentTurnPlayerId === playerId;
  const callAmount = currentPlayer ? Math.max(0, publicState.currentBet - currentPlayer.currentBet) : 0;
  const minRaiseTo = publicState.currentBet + publicState.minRaise;
  const maxRaiseTo = currentPlayer ? currentPlayer.currentBet + currentPlayer.chips : 0;
  const stageNames: Record<string, string> = {
    preflop: 'Preflop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
    draw_bet1: 'Erste Setzrunde',
    draw: 'Kartentausch',
    draw_bet2: 'Zweite Setzrunde',
    hand_over: 'Hand beendet',
    gameover: 'Spiel beendet'
  };

  gameStatusBar.textContent = roomState.status === 'gameover'
    ? roomState.winReason || 'Das Spiel ist beendet.'
    : isMyTurn
      ? 'Du bist am Zug.'
      : `Warten auf ${turnPlayer?.name || 'den nächsten Spieler'}.`;
  pokerHandNumber.textContent = `Hand ${publicState.handNumber}`;
  pokerStageLabel.textContent = stageNames[publicState.stage] || publicState.stage;
  pokerBlinds.textContent = `${publicState.smallBlind} / ${publicState.bigBlind}`;
  pokerPot.textContent = String(publicState.pot);
  const drawSelectionKey = `${publicState.handNumber}:${roomState.currentTurnPlayerId}`;
  if (!isDrawStage || !isMyTurn || drawSelectionKey !== pokerDrawSelectionKey) pokerDrawSelection.clear();
  pokerDrawSelectionKey = drawSelectionKey;
  pokerTurnNote.textContent = isDrawStage
    ? isMyTurn ? 'Wähle die Karten, die du tauschen möchtest.' : `Tausch von ${turnPlayer?.name || 'Warten'}`
    : isMyTurn
      ? callAmount > 0 ? `Noch ${callAmount} Chips zum Mitgehen.` : 'Du kannst checken oder erhöhen.'
      : `Am Zug: ${turnPlayer?.name || 'Warten'}`;
  pokerCardsToggle.textContent = pokerCardsHidden ? 'Karten anzeigen' : 'Karten verstecken';
  pokerCardsToggle.setAttribute('aria-pressed', String(pokerCardsHidden));

  pokerCommunity.replaceChildren();
  pokerCommunity.hidden = isFiveCardDraw;
  for (let index = 0; index < 5; index++) {
    const card = publicState.communityCards[index];
    pokerCommunity.appendChild(card ? createPokerCard(card) : createPokerCard(undefined, true));
  }

  pokerHoleCards.replaceChildren();
  (privatePlayer?.hand || []).forEach((card: string, index: number) => {
    if (!isDrawStage || !isMyTurn) {
      pokerHoleCards.appendChild(createPokerCard(card, pokerCardsHidden));
      return;
    }
    const selected = pokerDrawSelection.has(index);
    const selectCard = document.createElement('button');
    selectCard.type = 'button';
    selectCard.className = `poker-draw-card${selected ? ' is-selected' : ''}`;
    selectCard.setAttribute('aria-pressed', String(selected));
    selectCard.setAttribute('aria-label', `Karte ${index + 1}${selected ? ', zum Tauschen markiert' : ', nicht markiert'}`);
    selectCard.appendChild(createPokerCard(card, pokerCardsHidden));
    selectCard.addEventListener('click', () => {
      if (pokerDrawSelection.has(index)) pokerDrawSelection.delete(index);
      else pokerDrawSelection.add(index);
      if (currentRoom) renderGame(currentRoom.state);
    });
    pokerHoleCards.appendChild(selectCard);
  });
  if (!privatePlayer?.hand?.length) {
    const cardCount = isFiveCardDraw ? 5 : 2;
    for (let index = 0; index < cardCount; index++) pokerHoleCards.appendChild(createPokerCard(undefined, true));
  }

  pokerSeats.dataset.gameType = publicState.gameType;
  pokerSeats.replaceChildren();
  const seatPositions = [
    { left: 50, top: 91 }, { left: 15, top: 76 }, { left: 8, top: 48 }, { left: 19, top: 18 },
    { left: 50, top: 9 }, { left: 81, top: 18 }, { left: 92, top: 48 }, { left: 85, top: 76 }
  ];
  players.forEach((player: any, index: number) => {
    const seat = document.createElement('div');
    seat.className = `poker-seat${player.id === roomState.currentTurnPlayerId ? ' is-turn' : ''}${player.id === playerId ? ' is-self' : ''}${player.folded ? ' is-folded' : ''}${player.allIn ? ' is-all-in' : ''}`;
    const position = seatPositions[index % seatPositions.length];
    seat.style.left = `${position.left}%`;
    seat.style.top = `${position.top}%`;
    const name = document.createElement('strong');
    name.textContent = player.name;
    const chips = document.createElement('span');
    chips.textContent = `${player.chips} Chips`;
    const bet = document.createElement('small');
    bet.textContent = player.folded ? 'PASST' : player.allIn ? 'ALL-IN' : player.currentBet > 0 ? `Einsatz ${player.currentBet}` : 'Am Tisch';
    const cards = document.createElement('span');
    cards.className = 'poker-seat-cards';
    const hand = player.hand?.length ? player.hand : Array.from({ length: isFiveCardDraw ? 5 : 2 }, () => null);
    hand.slice(0, isFiveCardDraw ? 5 : 2).forEach((card: string | null) => cards.appendChild(createPokerCard(card || undefined, !card || (player.id === playerId && pokerCardsHidden))));
    seat.append(name, chips, bet, cards);
    pokerSeats.appendChild(seat);
  });

  pokerPlayerList.replaceChildren();
  players.forEach((player: any) => {
    const row = document.createElement('div');
    row.className = `poker-player-row${player.id === roomState.currentTurnPlayerId ? ' is-turn' : ''}`;
    const name = document.createElement('strong');
    name.textContent = player.name;
    const stack = document.createElement('span');
    stack.textContent = `${player.chips} Chips`;
    row.append(name, stack);
    pokerPlayerList.appendChild(row);
  });

  pokerResult.textContent = publicState.handWinner
    ? `${publicState.handWinner.names.join(', ')} · ${publicState.handWinner.handName} · ${publicState.handWinner.amount} Chips`
    : 'Die Karten werden gegeben.';
  pokerLog.replaceChildren();
  [...publicState.log].reverse().forEach((entry: string) => {
    const line = document.createElement('p');
    line.textContent = entry;
    pokerLog.appendChild(line);
  });

  const canAct = isMyTurn && Boolean(currentPlayer) && !currentPlayer.folded && !currentPlayer.allIn;
  pokerBettingActions.hidden = isDrawStage;
  pokerDrawActions.hidden = !isDrawStage;
  pokerDrawHint.textContent = isMyTurn
    ? `${pokerDrawSelection.size} von 5 Karten zum Tauschen markiert.`
    : `Warten auf ${turnPlayer?.name || 'den nächsten Spieler'}.`;
  pokerDrawExchange.textContent = pokerDrawSelection.size ? `Auswahl tauschen (${pokerDrawSelection.size})` : 'Auswahl tauschen';
  setMetroActionState(pokerDrawExchange, isDrawStage && isMyTurn);
  setMetroActionState(pokerDrawKeep, isDrawStage && isMyTurn);
  setMetroActionState(pokerFold, canAct);
  setMetroActionState(pokerCheck, canAct && callAmount === 0);
  setMetroActionState(pokerCall, canAct && callAmount > 0);
  setMetroActionState(pokerAllIn, canAct && currentPlayer.chips > 0);
  pokerRaiseTo.min = String(minRaiseTo);
  pokerRaiseTo.max = String(maxRaiseTo);
  if (!pokerRaiseTo.value || Number(pokerRaiseTo.value) < minRaiseTo || Number(pokerRaiseTo.value) > maxRaiseTo) {
    pokerRaiseTo.value = String(Math.min(maxRaiseTo, minRaiseTo));
  }
  setMetroActionState(pokerRaise, canAct && !currentPlayer.raiseLocked && maxRaiseTo >= minRaiseTo);
  pokerNextHand.hidden = publicState.stage !== 'hand_over';
  setMetroActionState(pokerNextHand, publicState.stage === 'hand_over' && Boolean(currentPlayer?.chips));
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

function updateDeckStacks(runtimeState: any) {
  const card = runtimeState.pendingCard || runtimeState.lastDrawnCard;
  metroBoard.querySelectorAll('.metro-deck-chance').forEach((deck) => {
    deck.classList.toggle('is-drawing', card?.deck === 'chance');
  });
  metroBoard.querySelectorAll('.metro-deck-community').forEach((deck) => {
    deck.classList.toggle('is-drawing', card?.deck === 'community');
  });
}

function renderCardOverlay(roomState: any, runtimeState: any, mySessionId: string | undefined) {
  const card = runtimeState.pendingCard;
  if (!card) {
    metroCardOverlay.hidden = true;
    document.body.classList.remove('overlay-open');
    return;
  }
  const key = `${card.deck}:${card.title}:${card.text}`;
  metroCardOverlayDeck.textContent = card.deck === 'chance' ? 'CHANCE · EXPRESSKURIER' : 'GEMEINSCHAFT · STADTRAT';
  metroCardOverlayTitle.textContent = card.title;
  metroCardOverlayText.textContent = card.text;
  metroCardOverlay.classList.toggle('metro-card-chance', card.deck === 'chance');
  metroCardOverlay.classList.toggle('metro-card-community', card.deck === 'community');
  const turnPlayer = roomState.players.get(roomState.currentTurnPlayerId);
  const isBotTurn = Boolean(turnPlayer?.isBot);
  const isMyCardTurn = roomState.currentTurnPlayerId === mySessionId;
  if (key !== lastCardKey) {
    lastCardKey = key;
    metroCardOverlay.hidden = false;
    document.body.classList.add('overlay-open');
    metroCardOverlay.classList.remove('is-revealing');
    void metroCardOverlay.offsetWidth;
    metroCardOverlay.classList.add('is-revealing');
    if (cardDrawTimer) window.clearTimeout(cardDrawTimer);
    if (isBotTurn) {
      cardDrawTimer = window.setTimeout(() => {
        if (latestMetroRuntimeState?.pendingCard) {
          metroCardOverlay.hidden = true;
          document.body.classList.remove('overlay-open');
        }
      }, METRO_CARD_BOT_OVERLAY_MS);
    }
  } else if (!isMyCardTurn && !isBotTurn) {
    metroCardOverlay.hidden = false;
  }
}

function dismissMetroCard() {
  if (!latestMetroRuntimeState?.pendingCard) {
    metroCardOverlay.hidden = true;
    document.body.classList.remove('overlay-open');
    return;
  }
  sendMetroAction({ type: 'DISMISS_CARD' });
  metroCardOverlay.hidden = true;
  document.body.classList.remove('overlay-open');
}

let metroEventQueue: string[] = [];
let metroEventToastBusy = false;

function pumpMetroEventQueue() {
  if (metroEventToastBusy) return;
  const next = metroEventQueue.shift();
  if (!next) return;
  metroEventToastBusy = true;
  metroEventToast.textContent = next.replace(/^[^A-Za-zÄÖÜäöüß]*/, '');
  metroEventToast.hidden = false;
  metroEventToast.classList.remove('is-visible');
  void metroEventToast.offsetWidth;
  metroEventToast.classList.add('is-visible');
  if (eventToastTimer) window.clearTimeout(eventToastTimer);
  eventToastTimer = window.setTimeout(() => {
    metroEventToast.classList.remove('is-visible');
    window.setTimeout(() => {
      metroEventToast.hidden = true;
      metroEventToastBusy = false;
      pumpMetroEventQueue();
    }, 180);
  }, METRO_EVENT_TOAST_MS);
}

function showLatestMetroEvent(runtimeState: any) {
  const log: string[] = runtimeState.log || [];
  const latestEvent = log[log.length - 1];
  if (!latestEvent || !lastMetroEventKey) {
    lastMetroEventKey = latestEvent || '';
    return;
  }
  if (latestEvent === lastMetroEventKey) return;

  // Collect ALL new log entries since the last seen one (not just the latest),
  // so buys, rent payments etc. are not skipped when several happen at once.
  const lastSeenIndex = log.lastIndexOf(lastMetroEventKey);
  const fresh = lastSeenIndex >= 0 ? log.slice(lastSeenIndex + 1) : [latestEvent];
  lastMetroEventKey = latestEvent;

  metroEventQueue.push(...fresh);
  if (metroEventQueue.length > METRO_EVENT_TOAST_QUEUE_MAX) {
    metroEventQueue = metroEventQueue.slice(-METRO_EVENT_TOAST_QUEUE_MAX);
  }
  pumpMetroEventQueue();
}

function playMetroSound(runtimeState: any) {
  if (!previousMetroRuntimeState) {
    previousMetroRuntimeState = runtimeState;
    return;
  }
  if (runtimeState.dice[0] !== previousMetroRuntimeState.dice[0] || runtimeState.dice[1] !== previousMetroRuntimeState.dice[1]) {
    audio.play('roll');
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
  const leasesEnabled = Boolean(runtimeState.config.mechanics?.propertyLeases);
  const leaseOption = metroTradeLease.closest('.metro-lease-option') as HTMLElement | null;
  leaseOption?.toggleAttribute('hidden', !leasesEnabled);
  metroTradeLease.disabled = !canOffer || !leasesEnabled;
  if (!leasesEnabled) metroTradeLease.checked = false;
  metroTradeLeaseLabel.textContent = `Ausgewählte Grundstücke als Pacht behandeln (${runtimeState.config.leaseDurationRounds} Runden)`;
  const offerDisabledReason = pendingTrade
    ? 'Es ist bereits ein Handelsangebot offen.'
    : !target
      ? 'Kein Handelspartner verfügbar.'
      : roomState.status !== 'playing'
        ? 'Handeln ist nur während eines laufenden Spiels möglich.'
        : !isMyTurn
          ? 'Handeln kannst du nur am Ende deines eigenen Zuges.'
          : runtimeState.phase !== 'turn_end'
            ? 'Handeln wird nach deiner Feldaktion möglich.'
            : '';
  setMetroActionState(metroActionOfferTrade, canOffer, offerDisabledReason);
  metroActionAcceptTrade.toggleAttribute('disabled', !pendingForMe);
  metroActionAcceptTrade.title = pendingForMe ? '' : 'Es liegt kein Handelsangebot für dich vor.';
  metroActionDeclineTrade.toggleAttribute('disabled', !pendingForMe);
  metroActionDeclineTrade.title = pendingForMe ? '' : 'Es liegt kein Handelsangebot für dich vor.';
  if (!pendingTrade) {
    metroTradeStatus.textContent = currentPlayer ? (canOffer ? 'Kein offenes Angebot.' : offerDisabledReason) : '';
  } else if (pendingForMe) {
    const offerer = runtimeState.players.find((player: any) => player.id === pendingTrade.fromPlayerId);
    const leaseCount = (pendingTrade.offeredLeasePropertyIndices || []).length
      + (pendingTrade.requestedLeasePropertyIndices || []).length;
    metroTradeStatus.textContent = `Angebot von ${offerer?.name || 'Mitspieler'} wartet auf Antwort.${leaseCount ? ` Enthält ${leaseCount} Pacht${leaseCount === 1 ? '' : 'en'} für ${runtimeState.config.leaseDurationRounds} Runden.` : ''}`;
  } else if (pendingTrade.fromPlayerId === mySessionId) {
    const recipient = runtimeState.players.find((player: any) => player.id === pendingTrade.toPlayerId);
    const leaseCount = (pendingTrade.offeredLeasePropertyIndices || []).length
      + (pendingTrade.requestedLeasePropertyIndices || []).length;
    metroTradeStatus.textContent = `Angebot an ${recipient?.name || 'Mitspieler'} wartet.${leaseCount ? ` Enthält ${leaseCount} Pacht${leaseCount === 1 ? '' : 'en'} für ${runtimeState.config.leaseDurationRounds} Runden.` : ''}`;
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
    card_reveal: 'Karte lesen',
    gameover: 'Spiel beendet'
  };
  return labels[phase] || phase;
}

function setMetroActionState(button: HTMLElement, enabled: boolean, disabledReason = '') {
  button.toggleAttribute('disabled', !enabled);
  if (enabled || !disabledReason) button.removeAttribute('title');
  else button.title = disabledReason;
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
  if (metroPresentation.movementLocked && action.type !== 'DISMISS_CARD') return;
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
      offeredLeasePropertyIndices: metroTradeLease.checked
        ? [...metroOfferedProperties.selectedOptions].map(option => Number(option.value))
        : [],
      requestedMoney: Number(metroRequestedMoney.value) || 0,
      requestedPropertyIndices: [...metroRequestedProperties.selectedOptions].map(option => Number(option.value)),
      requestedLeasePropertyIndices: metroTradeLease.checked
        ? [...metroRequestedProperties.selectedOptions].map(option => Number(option.value))
        : []
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
pokerFold.addEventListener('click', () => sendMetroAction({ type: 'FOLD' }));
pokerCheck.addEventListener('click', () => sendMetroAction({ type: 'CHECK' }));
pokerCall.addEventListener('click', () => sendMetroAction({ type: 'CALL' }));
pokerRaise.addEventListener('click', () => sendMetroAction({ type: 'RAISE', raiseTo: Number(pokerRaiseTo.value) }));
pokerAllIn.addEventListener('click', () => sendMetroAction({ type: 'ALL_IN' }));
pokerNextHand.addEventListener('click', () => sendMetroAction({ type: 'NEXT_HAND' }));
pokerDrawExchange.addEventListener('click', () => {
  sendMetroAction({ type: 'DRAW', indices: [...pokerDrawSelection].sort((left, right) => left - right) });
  pokerDrawSelection.clear();
});
pokerDrawKeep.addEventListener('click', () => {
  sendMetroAction({ type: 'DRAW', indices: [] });
  pokerDrawSelection.clear();
});
pokerCardsToggle.addEventListener('click', () => {
  pokerCardsHidden = !pokerCardsHidden;
  localStorage.setItem('texasholdem_cards_hidden', String(pokerCardsHidden));
  if (currentRoom) renderGame(currentRoom.state);
});
metroPropertyClose.addEventListener('click', closePropertyOverlay);
metroPropertyOverlay.addEventListener('click', (event) => {
  if (event.target === metroPropertyOverlay) closePropertyOverlay();
});
metroCardOverlayClose.addEventListener('click', dismissMetroCard);
metroCardOverlay.addEventListener('click', (event) => {
  if (event.target === metroCardOverlay) dismissMetroCard();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !metroPropertyOverlay.hidden) closePropertyOverlay();
  if (event.key === 'Escape' && !metroCardOverlay.hidden) dismissMetroCard();
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