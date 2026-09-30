import { describe, expect, it } from 'vitest';
import type { Player } from '@metroville/game-sdk';
import { evaluateBestHand, evaluateFive, FiveCardDrawModule, TexasHoldemModule } from './index.js';

const players: Player[] = [
  { id: 'p1', name: 'Ada', color: '#C84B2F' },
  { id: 'p2', name: 'Turing', color: '#1D7A72' }
];

describe('Texas Hold’em', () => {
  it('deals a deterministic hand and keeps previous state immutable', () => {
    const first = TexasHoldemModule.createInitialState({}, players, 'seed-test');
    const repeated = TexasHoldemModule.createInitialState({}, players, 'seed-test');
    expect(first.players.map(player => player.hand)).toEqual(repeated.players.map(player => player.hand));
    expect(first.players.every(player => player.hand.length === 2)).toBe(true);
    expect(first.pot).toBe(30);

    const actor = first.players.find(player => player.id === first.currentTurnPlayerId)!;
    const action = actor.currentBet === first.currentBet ? { type: 'CHECK' as const } : { type: 'CALL' as const };
    const next = TexasHoldemModule.applyAction(first, action);
    expect(first.stage).toBe('preflop');
    expect(first.log).toHaveLength(1);
    expect(next.log).toHaveLength(2);
  });

  it('validates turn order, check/call requirements, and minimum raises', () => {
    const state = TexasHoldemModule.createInitialState({}, players, 'seed-turn');
    const actor = state.players.find(player => player.id === state.currentTurnPlayerId)!;
    const other = state.players.find(player => player.id !== actor.id)!;
    expect(TexasHoldemModule.validateAction(state, { type: 'CALL' }, other.id).valid).toBe(false);
    expect(TexasHoldemModule.validateAction(state, { type: 'CHECK' }, actor.id).valid).toBe(false);
    expect(TexasHoldemModule.validateAction(state, { type: 'RAISE', raiseTo: state.currentBet + state.bigBlind - 1 }, actor.id).valid).toBe(false);
    expect(TexasHoldemModule.validateAction(state, { type: 'CALL' }, actor.id).valid).toBe(true);
  });

  it('posts blinds clockwise at a three-player table and keeps fold wins in the tournament', () => {
    const threePlayers = [...players, { id: 'p3', name: 'Grace', color: '#D4930A' }];
    const threePlayerState = TexasHoldemModule.createInitialState({}, threePlayers, 'seed-blinds');
    expect(threePlayerState.players.map(player => player.currentBet)).toEqual([0, 10, 20]);

    const headsUp = TexasHoldemModule.createInitialState({}, players, 'seed-fold');
    const folded = TexasHoldemModule.applyAction(headsUp, { type: 'FOLD' });
    expect(folded.stage).toBe('hand_over');
    expect(TexasHoldemModule.isGameOver(folded)).toBe(false);
  });

  it('runs all four betting streets and awards the pot at showdown', () => {
    let state = TexasHoldemModule.createInitialState({}, players, 'seed-showdown');
    const act = (action: { type: 'CALL' | 'CHECK' }) => {
      state = TexasHoldemModule.applyAction(state, action);
    };
    act({ type: 'CALL' });
    act({ type: 'CHECK' });
    expect(state.stage).toBe('flop');
    for (const street of ['flop', 'turn', 'river']) {
      expect(state.stage).toBe(street);
      act({ type: 'CHECK' });
      act({ type: 'CHECK' });
    }
    expect(state.stage).toBe('hand_over');
    expect(state.showdown).toBe(true);
    expect(state.communityCards).toHaveLength(5);
    expect(state.handWinner).not.toBeNull();
    expect(state.players.reduce((sum, player) => sum + player.chips, 0)).toBe(2000);
    const showdownView = TexasHoldemModule.getPlayerView(state, 'p1') as typeof state;
    expect(showdownView.players.find(player => player.id === 'p2')?.hand).toHaveLength(2);
  });

  it('does not reveal folded cards after a fold win', () => {
    const state = TexasHoldemModule.createInitialState({}, players, 'seed-fold-private');
    const folded = TexasHoldemModule.applyAction(state, { type: 'FOLD' });
    const view = TexasHoldemModule.getPlayerView(folded, 'p1') as typeof state;
    expect(folded.showdown).toBe(false);
    expect(view.players.find(player => player.id === 'p2')?.hand).toHaveLength(0);
  });

  it('awards main and side pots only to players eligible for each contribution level', () => {
    const threePlayers = [...players, { id: 'p3', name: 'Grace', color: '#D4930A' }];
    let state = TexasHoldemModule.createInitialState({ startingChips: 200 }, threePlayers, 'seed-side-pot');
    state.players[0].chips = 80;
    state.players[0].hand = ['AS', 'AD'];
    state.players[1].hand = ['KS', 'KD'];
    state.players[2].hand = ['QS', 'QD'];
    state.deck = ['2H', '3C', '5S', '4C', '8D', '6C', 'JC', '7C', '9H', 'TC'];

    state = TexasHoldemModule.applyAction(state, { type: 'ALL_IN' });
    state = TexasHoldemModule.applyAction(state, { type: 'RAISE', raiseTo: 160 });
    state = TexasHoldemModule.applyAction(state, { type: 'CALL' });
    for (let index = 0; index < 6; index++) state = TexasHoldemModule.applyAction(state, { type: 'CHECK' });

    expect(state.stage).toBe('hand_over');
    expect(state.players.map(player => player.chips)).toEqual([240, 200, 40]);
    expect(state.players.reduce((sum, player) => sum + player.chips, 0)).toBe(480);
  });

  it('keeps deck and opponent cards out of personalized views', () => {
    const state = TexasHoldemModule.createInitialState({}, players, 'seed-private');
    const view = TexasHoldemModule.getPlayerView(state, 'p1') as typeof state;
    expect(view.deck).toHaveLength(0);
    expect(view.seed).toBe('');
    expect(view.players.find(player => player.id === 'p1')?.hand).toHaveLength(2);
    expect(view.players.find(player => player.id === 'p2')?.hand).toHaveLength(0);
    expect(state.players.find(player => player.id === 'p2')?.hand).toHaveLength(2);
  });

  it('ranks wheel straights and kicker ties correctly', () => {
    expect(evaluateFive(['AS', '2D', '3H', '4C', '5S']).score).toEqual([4, 5]);
    expect(evaluateBestHand(['AS', 'KD', 'QH', 'JC', 'TS', '2D', '3H']).name).toBe('Straight');
    expect(evaluateFive(['AS', 'AH', 'KD', 'KC', 'QS']).score).toEqual([2, 14, 13, 12]);
  });

  it('plays a complete Five Card Draw hand with a validated draw round', () => {
    let state = FiveCardDrawModule.createInitialState({}, players, 'seed-draw');
    expect(state.gameType).toBe('fivecarddraw');
    expect(state.stage).toBe('draw_bet1');
    expect(state.players.every(player => player.hand.length === 5)).toBe(true);
    expect(state.communityCards).toHaveLength(0);

    const act = (action: { type: 'CALL' | 'CHECK' } | { type: 'DRAW'; indices: number[] }) => {
      const currentPlayer = state.players.find(player => player.id === state.currentTurnPlayerId)!;
      expect(FiveCardDrawModule.validateAction(state, action, currentPlayer.id).valid).toBe(true);
      state = FiveCardDrawModule.applyAction(state, action);
    };

    act({ type: 'CALL' });
    act({ type: 'CHECK' });
    expect(state.stage).toBe('draw');
    const firstDrawer = state.players.find(player => player.id === state.currentTurnPlayerId)!;
    const firstHand = [...firstDrawer.hand];
    expect(FiveCardDrawModule.validateAction(state, { type: 'DRAW', indices: [1, 1] }, firstDrawer.id).valid).toBe(false);
    act({ type: 'DRAW', indices: [] });
    const secondDrawer = state.players.find(player => player.id === state.currentTurnPlayerId)!;
    const secondHand = [...secondDrawer.hand];
    act({ type: 'DRAW', indices: [0, 1] });
    expect(state.stage).toBe('draw_bet2');
    expect(state.players.every(player => player.hand.length === 5)).toBe(true);
    expect(state.players.find(player => player.id === firstDrawer.id)?.hand).toEqual(firstHand);
    expect(state.players.find(player => player.id === secondDrawer.id)?.hand.slice(0, 3)).toEqual(secondHand.slice(2));

    act({ type: 'CHECK' });
    act({ type: 'CHECK' });
    expect(state.stage).toBe('hand_over');
    expect(state.showdown).toBe(true);
    expect(state.handWinner).not.toBeNull();
    expect(state.players.reduce((sum, player) => sum + player.chips, 0)).toBe(2000);
  });
});