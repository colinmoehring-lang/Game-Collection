import type { Player } from '@metroville/game-sdk';

export type PokerStage = 'preflop' | 'flop' | 'turn' | 'river' | 'hand_over' | 'gameover';
export type PokerActionType = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALL_IN' | 'NEXT_HAND';

export interface PokerPlayer extends Player {
  chips: number;
  hand: string[];
  folded: boolean;
  allIn: boolean;
  currentBet: number;
  totalCommitted: number;
  actedThisRound: boolean;
  raiseLocked: boolean;
}

export interface PokerConfig {
  startingChips?: number;
  smallBlind?: number;
  bigBlind?: number;
}

export interface PokerState {
  seed: string;
  randomIndex: number;
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
  | { type: 'RAISE'; raiseTo: number };

export interface EvaluatedHand {
  score: number[];
  name: string;
}