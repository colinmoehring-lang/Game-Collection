import type {
  BotDifficulty,
  BotStrategy,
  GameManifest,
  GameModule,
  GameResult,
  Player,
  ValidationResult
} from '@metroville/game-sdk';
import { createRNG } from '@metroville/game-sdk';

export interface MenschTokenState {
  id: string;
  progress: number;
  finished: boolean;
}

export interface MenschPlayerState extends Player {
  tokens: MenschTokenState[];
}

export interface MenschState {
  players: MenschPlayerState[];
  currentTurnPlayerId: string;
  turnIndex: number;
  pendingRoll: boolean;
  lastRoll: number | null;
  winnerId: string | null;
  seed: string;
  randomIndex: number;
  moveHistory: Array<{ playerId: string; tokenId: string; from: number; to: number; roll: number }>; 
}

export type MenschAction =
  | { type: 'ROLL_DICE' }
  | { type: 'MOVE_TOKEN'; tokenId: string };

const PLAYER_STARTS = [0, 10, 20, 30];
const BOARD_LENGTH = 40;
const HOME_LENGTH = 6;
const FINISH_PROGRESS = BOARD_LENGTH + HOME_LENGTH;

function getPlayerStart(playerIndex: number): number {
  return PLAYER_STARTS[playerIndex % PLAYER_STARTS.length];
}

function getTokenBoardIndex(player: MenschPlayerState, token: MenschTokenState): number | null {
  if (token.progress <= 0 || token.progress > BOARD_LENGTH) return null;
  const startIndex = getPlayerStart(playerIndexById(player.id));
  return (startIndex + token.progress - 1 + BOARD_LENGTH) % BOARD_LENGTH;
}

function playerIndexById(playerId: string, players: MenschPlayerState[] = []): number {
  const index = players.findIndex(player => player.id === playerId);
  return index === -1 ? 0 : index;
}

function getCurrentPlayer(state: MenschState): MenschPlayerState | undefined {
  return state.players[state.turnIndex];
}

function getLegalMoves(state: MenschState, player: MenschPlayerState, roll: number): string[] {
  if (roll <= 0) return [];

  return player.tokens
    .filter(token => !token.finished)
    .filter(token => {
      const startProgress = token.progress;
      if (startProgress === 0) return roll === 6;
      if (startProgress >= FINISH_PROGRESS) return false;
      return startProgress + roll <= FINISH_PROGRESS;
    })
    .map(token => token.id);
}

function moveTokenForPlayer(player: MenschPlayerState, tokenId: string, roll: number): MenschPlayerState {
  const token = player.tokens.find(candidate => candidate.id === tokenId);
  if (!token) return player;

  const startProgress = token.progress;
  const targetProgress = startProgress === 0 ? (roll === 6 ? 1 : 0) : startProgress + roll;
  const movedToken: MenschTokenState = {
    ...token,
    progress: targetProgress,
    finished: targetProgress >= FINISH_PROGRESS
  };

  return {
    ...player,
    tokens: player.tokens.map(candidate => candidate.id === tokenId ? movedToken : candidate)
  };
}

function advanceTurn(state: MenschState): MenschState {
  const nextTurnIndex = (state.turnIndex + 1) % state.players.length;
  return {
    ...state,
    turnIndex: nextTurnIndex,
    currentTurnPlayerId: state.players[nextTurnIndex]?.id ?? '',
    pendingRoll: true,
    lastRoll: null
  };
}

function evaluateWinner(state: MenschState): string | null {
  const winner = state.players.find(player => player.tokens.every(token => token.finished));
  return winner?.id ?? null;
}

export const MenschAergereDichNichtManifest: GameManifest = {
  id: 'mensch-aerger-dich-nicht',
  name: 'Mensch ärgere dich nicht',
  description: {
    de: 'Ein klassisches Würfel- und Zugspiel mit vier Figuren pro Spieler auf einem gemeinsamen Rundkurs.',
    en: 'A classic dice-and-movement board game with four tokens per player on a shared track.'
  },
  minPlayers: 2,
  maxPlayers: 4,
  estimatedDurationMinutes: [10, 30],
  coverArtwork: '/games/mensch.png',
  variants: [
    {
      id: 'standard',
      name: 'Standard',
      description: 'Klassische 2–4-Spieler-Version mit vier Figuren pro Spieler.'
    }
  ],
  settings: []
};

export class MenschBot implements BotStrategy<MenschState, MenschAction> {
  constructor(private difficulty: BotDifficulty = 'medium') {}

  chooseAction(state: MenschState, playerId: string): MenschAction {
    if (state.pendingRoll) return { type: 'ROLL_DICE' };
    if (state.lastRoll === null) return { type: 'ROLL_DICE' };

    const player = state.players.find(candidate => candidate.id === playerId);
    if (!player) return { type: 'ROLL_DICE' };

    const moves = getLegalMoves(state, player, state.lastRoll);
    if (moves.length === 0) return { type: 'ROLL_DICE' };

    if (this.difficulty === 'easy') {
      const tokenId = moves[Math.floor(Math.random() * moves.length)];
      return { type: 'MOVE_TOKEN', tokenId };
    }

    const preferred = [...moves].sort((left, right) => {
      const leftPlayer = player.tokens.find(token => token.id === left)!;
      const rightPlayer = player.tokens.find(token => token.id === right)!;
      return (rightPlayer.progress || 0) - (leftPlayer.progress || 0);
    })[0];

    return { type: 'MOVE_TOKEN', tokenId: preferred ?? moves[0] };
  }
}

export const MenschAergereDichNichtModule: GameModule<MenschState, MenschAction> = {
  manifest: MenschAergereDichNichtManifest,

  createInitialState(config, players, seed): MenschState {
    if (players.length < 2 || players.length > 4) {
      throw new Error('Mensch ärgere dich nicht requires 2 to 4 players');
    }

    const statePlayers: MenschPlayerState[] = players.map((player, index) => ({
      ...player,
      color: player.color || ['#C84B2F', '#1D7A72', '#D4930A', '#3B7FC4'][index % 4],
      tokens: Array.from({ length: 4 }, (_, tokenIndex) => ({
        id: `${player.id}-token-${tokenIndex + 1}`,
        progress: 0,
        finished: false
      }))
    }));

    return {
      players: statePlayers,
      currentTurnPlayerId: statePlayers[0]?.id ?? '',
      turnIndex: 0,
      pendingRoll: true,
      lastRoll: null,
      winnerId: null,
      seed: seed ?? 'mensch-default-seed',
      randomIndex: 0,
      moveHistory: []
    };
  },

  validateAction(state, action, playerId): ValidationResult {
    if (state.winnerId !== null) {
      return { valid: false, error: 'Das Spiel ist bereits beendet' };
    }

    if (action.type === 'ROLL_DICE') {
      if (!state.pendingRoll) {
        return { valid: false, error: 'Du musst zuerst mit einer Figur ziehen' };
      }
      const current = getCurrentPlayer(state);
      if (!current || current.id !== playerId) {
        return { valid: false, error: 'Du bist nicht am Zug' };
      }
      return { valid: true };
    }

    if (action.type !== 'MOVE_TOKEN') {
      return { valid: false, error: 'Unbekannte Aktion' };
    }

    const current = getCurrentPlayer(state);
    if (!current || current.id !== playerId) {
      return { valid: false, error: 'Du bist nicht am Zug' };
    }

    if (state.pendingRoll || state.lastRoll === null) {
      return { valid: false, error: 'Würfle zuerst eine Zahl' };
    }

    const token = current.tokens.find(candidate => candidate.id === action.tokenId);
    if (!token) {
      return { valid: false, error: 'Diese Figur gehört dir nicht' };
    }

    if (token.finished) {
      return { valid: false, error: 'Diese Figur ist bereits fertig' };
    }

    const legalMoves = getLegalMoves(state, current, state.lastRoll);
    if (!legalMoves.includes(action.tokenId)) {
      return { valid: false, error: 'Diese Figur darf mit der aktuellen Zahl nicht ziehen' };
    }

    return { valid: true };
  },

  applyAction(state, action): MenschState {
    if (state.winnerId !== null) return state;

    if (action.type === 'ROLL_DICE') {
      const rng = createRNG(`${state.seed}:${state.randomIndex}`);
      const roll = 1 + Math.floor(rng() * 6);
      const current = getCurrentPlayer(state);
      const legalMoves = current ? getLegalMoves(state, current, roll) : [];

      if (legalMoves.length === 0) {
        return advanceTurn({
          ...state,
          lastRoll: roll,
          pendingRoll: false,
          randomIndex: state.randomIndex + 1,
          currentTurnPlayerId: current?.id ?? state.currentTurnPlayerId
        });
      }

      return {
        ...state,
        lastRoll: roll,
        pendingRoll: false,
        randomIndex: state.randomIndex + 1,
        moveHistory: [
          ...state.moveHistory,
          ...(current ? [{ playerId: current.id, tokenId: legalMoves[0], from: 0, to: 0, roll }] : [])
        ]
      };
    }

    if (action.type !== 'MOVE_TOKEN') return state;

    const current = getCurrentPlayer(state);
    if (!current || state.lastRoll === null) return state;

    const tokenToMove = current.tokens.find(candidate => candidate.id === action.tokenId);
    if (!tokenToMove || tokenToMove.finished) return state;

    const movedPlayer = moveTokenForPlayer(current, action.tokenId, state.lastRoll);
    const updatedPlayers = state.players.map(player => player.id === current.id ? movedPlayer : player);

    const nextState: MenschState = {
      ...state,
      players: updatedPlayers,
      pendingRoll: true,
      lastRoll: null,
      moveHistory: [
        ...state.moveHistory,
        {
          playerId: current.id,
          tokenId: action.tokenId,
          from: tokenToMove.progress,
          to: movedPlayer.tokens.find(candidate => candidate.id === action.tokenId)?.progress ?? tokenToMove.progress,
          roll: state.lastRoll
        }
      ]
    };

    const winnerId = evaluateWinner(nextState);
    const winnerState = winnerId ? {
      ...nextState,
      winnerId,
      pendingRoll: false,
      currentTurnPlayerId: winnerId
    } : advanceTurn(nextState);

    return winnerState;
  },

  getPlayerView(state, _playerId) {
    return {
      ...state,
      players: state.players.map(player => ({
        ...player,
        tokens: player.tokens.map(token => ({ ...token }))
      }))
    };
  },

  isGameOver(state): boolean {
    return state.winnerId !== null || state.players.some(player => player.tokens.every(token => token.finished));
  },

  computeResult(state): GameResult {
    const winnerId = state.winnerId ?? state.players.find(player => player.tokens.every(token => token.finished))?.id ?? null;
    if (!winnerId) return {};
    return {
      winnerId,
      reason: 'Mensch ärgere dich nicht gewonnen!'
    };
  },

  createBot(difficulty: BotDifficulty = 'medium') {
    return new MenschBot(difficulty);
  }
};

export const MenschModule = MenschAergereDichNichtModule;
