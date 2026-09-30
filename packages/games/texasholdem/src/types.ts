import type { Player } from '@metroville/game-sdk';

export type PokerGameType = 'texasholdem' | 'fivecarddraw';
export type PokerStage = 'preflop' | 'flop' | 'turn' | 'river' | 'draw_bet1' | 'draw' | 'draw_bet2' | 'hand_over' | 'gameover';
export type PokerActionType = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALL_IN' | 'DRAW' | 'NEXT_HAND';

export interface PokerPlayer extends Player {
  chips: number;
  hand: string[];
  folded: boolean;
  allIn: boolean;
  currentBet: number;
  totalCommitted: number;
  actedThisRound: boolean;
  raiseLocked: boolean;
  drewCards: boolean;
}

export interface PokerConfig {
  gameType?: PokerGameType;
  startingChips?: number;
  smallBlind?: number;
  bigBlind?: number;
}

export interface PokerState {
  seed: string;
  randomIndex: number;
  gameType: PokerGameType;
  players: PokerPlayer[];
  playerOrder: string[];
  currentTurnPlayerId: string;
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  stage: PokerStage;
  handNumber: number;
  showdown: boolean;
  deck: string[];
  communityCards: string[];
  pot: number;
  currentBet: number;
  minRaise: number;
  handWinner: { playerIds: string[]; names: string[]; handName: string; amount: number } | null;
  log: string[];
}

export type PokerAction =
  | { type: 'FOLD' | 'CHECK' | 'CALL' | 'ALL_IN' | 'NEXT_HAND' }
  | { type: 'DRAW'; indices: number[] }
  | { type: 'RAISE'; raiseTo: number };

export interface EvaluatedHand {
  score: number[];
  name: string;
}