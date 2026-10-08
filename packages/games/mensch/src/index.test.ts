import { describe, expect, it } from 'vitest';
import type { Player } from '@metroville/game-sdk';
import { MenschAergereDichNichtModule } from './index.js';

const players: Player[] = [
  { id: 'p1', name: 'Alice', color: '#C84B2F' },
  { id: 'p2', name: 'Bob', color: '#1D7A72' }
];

describe('MenschAergereDichNichtModule', () => {
  it('creates a valid starting state', () => {
    const state = MenschAergereDichNichtModule.createInitialState({}, players, 'seed-42');

    expect(state.players).toHaveLength(2);
    expect(state.currentTurnPlayerId).toBe('p1');
    expect(state.pendingRoll).toBe(true);
    expect(state.lastRoll).toBeNull();
    expect(state.players.every(player => player.tokens.length === 4)).toBe(true);
  });

  it('allows a token to leave the base on a six and advances turn after a move', () => {
    let state = MenschAergereDichNichtModule.createInitialState({}, players, 'seed-42');
    state.lastRoll = 6;
    state.pendingRoll = false;

    const token = state.players[0].tokens.find(candidate => candidate.progress === 0) ?? state.players[0].tokens[0];
    state = MenschAergereDichNichtModule.applyAction(state, { type: 'MOVE_TOKEN', tokenId: token.id });

    expect(state.players[0].tokens.find(candidate => candidate.id === token.id)?.progress).toBe(1);
    expect(state.currentTurnPlayerId).toBe('p2');
  });

  it('detects a winner when all tokens are finished', () => {
    const state = MenschAergereDichNichtModule.createInitialState({}, players, 'seed-7');
    state.players[0].tokens = state.players[0].tokens.map(token => ({ ...token, progress: 46, finished: true }));
    state.winnerId = 'p1';

    expect(MenschAergereDichNichtModule.isGameOver(state)).toBe(true);
    expect(MenschAergereDichNichtModule.computeResult(state).winnerId).toBe('p1');
  });
});
