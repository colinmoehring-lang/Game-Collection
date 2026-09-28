import { describe, it, expect } from 'vitest';
import { TicTacToeModule } from './index.js';
import type { Player } from '@metroville/game-sdk';

const p1: Player = { id: 'p1', name: 'Alice' };
const p2: Player = { id: 'p2', name: 'Bob' };

describe('TicTacToeModule', () => {
  it('creates initial state correctly', () => {
    const state = TicTacToeModule.createInitialState({}, [p1, p2], 'seed-123');
    expect(state.board.length).toBe(9);
    expect(state.board.every(cell => cell === null)).toBe(true);
    expect(state.currentTurn).toBe('X');
    expect(state.winner).toBeNull();
  });

  it('validates player turns and cell vacancy', () => {
    const state = TicTacToeModule.createInitialState({}, [p1, p2], 'seed');
    
    // Player 2 cannot move on Player 1's turn
    const valP2 = TicTacToeModule.validateAction(state, { type: 'MAKE_MOVE', index: 0 }, 'p2');
    expect(valP2.valid).toBe(false);

    // Player 1 can move
    const valP1 = TicTacToeModule.validateAction(state, { type: 'MAKE_MOVE', index: 0 }, 'p1');
    expect(valP1.valid).toBe(true);

    // Apply move
    const s1 = TicTacToeModule.applyAction(state, { type: 'MAKE_MOVE', index: 0 });
    expect(s1.board[0]).toBe('X');
    expect(s1.currentTurn).toBe('O');

    // Field 0 cannot be played again
    const valOver = TicTacToeModule.validateAction(s1, { type: 'MAKE_MOVE', index: 0 }, 'p2');
    expect(valOver.valid).toBe(false);
  });

  it('detects winning line and game over', () => {
    let state = TicTacToeModule.createInitialState({}, [p1, p2], 'seed');
    // Moves: X:0, O:3, X:1, O:4, X:2 -> X wins top row [0, 1, 2]
    state = TicTacToeModule.applyAction(state, { type: 'MAKE_MOVE', index: 0 }); // X
    state = TicTacToeModule.applyAction(state, { type: 'MAKE_MOVE', index: 3 }); // O
    state = TicTacToeModule.applyAction(state, { type: 'MAKE_MOVE', index: 1 }); // X
    state = TicTacToeModule.applyAction(state, { type: 'MAKE_MOVE', index: 4 }); // O
    state = TicTacToeModule.applyAction(state, { type: 'MAKE_MOVE', index: 2 }); // X

    expect(TicTacToeModule.isGameOver(state)).toBe(true);
    expect(state.winner).toBe('X');
    expect(state.winningLine).toEqual([0, 1, 2]);

    const res = TicTacToeModule.computeResult(state);
    expect(res.winnerId).toBe('p1');
  });

  it('detects a draw', () => {
    let state = TicTacToeModule.createInitialState({}, [p1, p2], 'seed');
    /*
      X O X
      X O O
      O X X
    */
    const moves = [0, 1, 2, 4, 3, 5, 7, 6, 8];
    for (const m of moves) {
      state = TicTacToeModule.applyAction(state, { type: 'MAKE_MOVE', index: m });
    }

    expect(TicTacToeModule.isGameOver(state)).toBe(true);
    expect(state.winner).toBe('draw');
    const res = TicTacToeModule.computeResult(state);
    expect(res.winnerId).toBeNull();
  });
});
