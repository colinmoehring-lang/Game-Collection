import type {
  GameManifest,
  GameModule,
  Player,
  ValidationResult,
  GameResult,
  BotStrategy,
  BotDifficulty
} from '@metroville/game-sdk';

export type CellValue = 'X' | 'O' | null;

export interface TicTacToeState {
  board: CellValue[]; // 9 elements, 0-8
  players: {
    X: Player;
    O: Player;
  };
  currentTurn: 'X' | 'O';
  winner: 'X' | 'O' | 'draw' | null;
  winningLine: number[] | null;
  moveHistory: Array<{ player: 'X' | 'O'; index: number }>;
}

export type TicTacToeAction = {
  type: 'MAKE_MOVE';
  index: number;
};

export const TicTacToeManifest: GameManifest = {
  id: 'tictactoe',
  name: 'Tic-Tac-Toe',
  description: {
    de: 'Klassisches 3x3-Strategiespiel. Setze drei deiner Symbole in eine Reihe!',
    en: 'Classic 3x3 strategy game. Align three of your symbols in a row!'
  },
  minPlayers: 2,
  maxPlayers: 2,
  estimatedDurationMinutes: [2, 5],
  coverArtwork: '/games/tictactoe.png',
  variants: [
    {
      id: 'standard',
      name: 'Standard 3x3',
      description: 'Standard 3x3 grid'
    }
  ],
  settings: []
};

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Zeilen
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Spalten
  [0, 4, 8], [2, 4, 6]             // Diagonalen
];

function checkWinner(board: CellValue[]): { winner: 'X' | 'O' | 'draw' | null; line: number[] | null } {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: combo };
    }
  }

  if (board.every(cell => cell !== null)) {
    return { winner: 'draw', line: null };
  }

  return { winner: null, line: null };
}

export class TicTacToeBot implements BotStrategy<TicTacToeState, TicTacToeAction> {
  constructor(private difficulty: BotDifficulty = 'medium') {}

  chooseAction(state: TicTacToeState, playerId: string): TicTacToeAction {
    const symbol: 'X' | 'O' = state.players.X.id === playerId ? 'X' : 'O';
    const opponent: 'X' | 'O' = symbol === 'X' ? 'O' : 'X';

    const availableIndices = state.board
      .map((val, idx) => (val === null ? idx : null))
      .filter((idx): idx is number => idx !== null);

    if (availableIndices.length === 0) {
      return { type: 'MAKE_MOVE', index: 0 };
    }

    if (this.difficulty === 'easy') {
      const randIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      return { type: 'MAKE_MOVE', index: randIdx };
    }

    // Prüfe Gewinnzug
    for (const idx of availableIndices) {
      const nextBoard = [...state.board];
      nextBoard[idx] = symbol;
      if (checkWinner(nextBoard).winner === symbol) {
        return { type: 'MAKE_MOVE', index: idx };
      }
    }

    // Prüfe Block-Zug
    for (const idx of availableIndices) {
      const nextBoard = [...state.board];
      nextBoard[idx] = opponent;
      if (checkWinner(nextBoard).winner === opponent) {
        return { type: 'MAKE_MOVE', index: idx };
      }
    }

    if (this.difficulty === 'hard') {
      // Bevorzuge Zentrum
      if (state.board[4] === null) {
        return { type: 'MAKE_MOVE', index: 4 };
      }
      // Bevorzuge Ecken
      const corners = [0, 2, 6, 8].filter(c => state.board[c] === null);
      if (corners.length > 0) {
        return { type: 'MAKE_MOVE', index: corners[Math.floor(Math.random() * corners.length)] };
      }
    }

    const randIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    return { type: 'MAKE_MOVE', index: randIdx };
  }
}

export const TicTacToeModule: GameModule<TicTacToeState, TicTacToeAction> = {
  manifest: TicTacToeManifest,

  createInitialState(config, players, seed): TicTacToeState {
    if (players.length < 2) {
      throw new Error('Tic-Tac-Toe requires exactly 2 players');
    }

    return {
      board: Array(9).fill(null),
      players: {
        X: players[0],
        O: players[1]
      },
      currentTurn: 'X',
      winner: null,
      winningLine: null,
      moveHistory: []
    };
  },

  validateAction(state, action, playerId): ValidationResult {
    if (state.winner !== null) {
      return { valid: false, error: 'Spiel ist bereits beendet' };
    }

    const expectedPlayer = state.currentTurn === 'X' ? state.players.X : state.players.O;
    if (expectedPlayer.id !== playerId) {
      return { valid: false, error: 'Du bist nicht am Zug' };
    }

    if (action.type !== 'MAKE_MOVE') {
      return { valid: false, error: 'Unbekannte Aktion' };
    }

    if (action.index < 0 || action.index > 8 || !Number.isInteger(action.index)) {
      return { valid: false, error: 'Ungültiges Feld' };
    }

    if (state.board[action.index] !== null) {
      return { valid: false, error: 'Feld ist bereits belegt' };
    }

    return { valid: true };
  },

  applyAction(state, action): TicTacToeState {
    if (action.type !== 'MAKE_MOVE') return state;

    const newBoard = [...state.board];
    const playerSymbol = state.currentTurn;
    newBoard[action.index] = playerSymbol;

    const { winner, line } = checkWinner(newBoard);
    const nextTurn = playerSymbol === 'X' ? 'O' : 'X';

    return {
      ...state,
      board: newBoard,
      currentTurn: nextTurn,
      winner,
      winningLine: line,
      moveHistory: [...state.moveHistory, { player: playerSymbol, index: action.index }]
    };
  },

  getPlayerView(state, _playerId) {
    // Öffentlicher vollständiger Zustand bei Tic-Tac-Toe
    return state;
  },

  isGameOver(state): boolean {
    return state.winner !== null;
  },

  computeResult(state): GameResult {
    if (state.winner === 'draw') {
      return {
        winnerId: null,
        reason: 'Unentschieden'
      };
    }

    if (state.winner === 'X' || state.winner === 'O') {
      const winnerPlayer = state.players[state.winner];
      return {
        winnerId: winnerPlayer.id,
        reason: `${winnerPlayer.name} hat gewonnen!`
      };
    }

    return {};
  },

  createBot(difficulty: BotDifficulty = 'medium') {
    return new TicTacToeBot(difficulty);
  }
};
