import { TicTacToeModule, type TicTacToeState, type TicTacToeAction } from '@metroville/game-tictactoe';
import type { Player } from '@metroville/game-sdk';

const p1: Player = { id: 'player-1', name: 'Spieler 1 (X)', color: '#C84B2F' };
const p2: Player = { id: 'player-2', name: 'Spieler 2 (O)', color: '#1D7A72' };

let state: TicTacToeState;
const bot = TicTacToeModule.createBot ? TicTacToeModule.createBot('medium') : null;

const statusBar = document.getElementById('status-bar')!;
const boardEl = document.getElementById('board')!;
const btnRestart = document.getElementById('btn-restart')!;
const btnBotMove = document.getElementById('btn-bot-move')!;

function initGame() {
  state = TicTacToeModule.createInitialState({}, [p1, p2], 'metro-seed-' + Date.now());
  render();
}

function handleCellClick(index: number) {
  if (TicTacToeModule.isGameOver(state)) return;

  const currentPlayer = state.currentTurn === 'X' ? p1 : p2;
  const action: TicTacToeAction = { type: 'MAKE_MOVE', index };

  const validation = TicTacToeModule.validateAction(state, action, currentPlayer.id);
  if (!validation.valid) {
    statusBar.textContent = `⚠️ ${validation.error}`;
    return;
  }

  state = TicTacToeModule.applyAction(state, action);
  render();
}

function handleBotMove() {
  if (TicTacToeModule.isGameOver(state) || !bot) return;

  const currentPlayer = state.currentTurn === 'X' ? p1 : p2;
  const action = bot.chooseAction(state, currentPlayer.id);

  if (action && action.type === 'MAKE_MOVE') {
    state = TicTacToeModule.applyAction(state, action);
    render();
  }
}

function render() {
  // Update Board
  boardEl.innerHTML = '';
  state.board.forEach((val, idx) => {
    const btn = document.createElement('button');
    btn.className = `cell ${val ? val.toLowerCase() : ''}`;
    if (state.winningLine && state.winningLine.includes(idx)) {
      btn.classList.add('winning');
    }
    btn.textContent = val || '';
    btn.disabled = val !== null || TicTacToeModule.isGameOver(state);
    btn.addEventListener('click', () => handleCellClick(idx));
    boardEl.appendChild(btn);
  });

  // Update Status
  if (TicTacToeModule.isGameOver(state)) {
    const result = TicTacToeModule.computeResult(state);
    if (result.winnerId) {
      const winnerName = result.winnerId === p1.id ? p1.name : p2.name;
      statusBar.textContent = `🎉 Sieg für ${winnerName}!`;
    } else {
      statusBar.textContent = '🤝 Unentschieden!';
    }
  } else {
    const currentName = state.currentTurn === 'X' ? p1.name : p2.name;
    statusBar.textContent = `Am Zug: ${currentName} (${state.currentTurn})`;
  }
}

btnRestart.addEventListener('click', initGame);
btnBotMove.addEventListener('click', handleBotMove);

initGame();
