import { describe, it, expect } from 'vitest';
import {
  METROVILLE_PRESET_MECHANICS,
  MetrovilleModule,
  calculateRent,
  remapMetrovillePlayerId
} from './index.js';
import { METROVILLE_FIELDS, DISTRICT_MAP } from './board.js';
import { EXPRESS_CARDS, STADTRAT_CARDS } from './cards.js';
import { createRNG, type Player } from '@metroville/game-sdk';
import type { MetrovilleAction } from './types.js';

const p1: Player = { id: 'p1', name: 'Alice', color: '#C84B2F' };
const p2: Player = { id: 'p2', name: 'Bob', color: '#1D7A72' };
const p3: Player = { id: 'p3', name: 'Charlie', color: '#D4930A' };

function seedForDiceTotal(total: number) {
  for (let index = 0; index < 10000; index++) {
    const seed = `card-roll-${index}`;
    const rng = createRNG(`${seed}:0`);
    const first = Math.floor(rng() * 6) + 1;
    const second = Math.floor(rng() * 6) + 1;
    if (first + second === total) return seed;
  }
  throw new Error(`No seed found for dice total ${total}`);
}

describe('MetroVille Rule Engine', () => {
  it('initializes standard board with 40 fields correctly', () => {
    expect(METROVILLE_FIELDS.length).toBe(40);
    const state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-test');
    expect(state.players.length).toBe(2);
    expect(state.players[0].money).toBe(1500);
    expect(state.players[0].position).toBe(0);
    expect(state.phase).toBe('roll');
    expect(state.config.mechanics).toEqual({
      cityParkJackpot: false,
      lowestWealthBonus: false,
      propertyLeases: false,
      botTrading: false
    });
    expect(state.config.goPassSalary).toBe(200);
    expect(state.config.taxMultiplier).toBe(1);
    expect(state.cityParkJackpot).toBe(0);
    expect(METROVILLE_PRESET_MECHANICS.standard).toEqual(state.config.mechanics);
  });

  it('initializes Blitz preset with 3 random properties per player', () => {
    const state = MetrovilleModule.createInitialState({ preset: 'blitz' }, [p1, p2], 'seed-blitz');
    expect(state.players[0].money).toBe(1000);
    expect(state.config.turnLimit).toBe(40);
    
    // Check owned properties
    const p1Props = Object.values(state.properties).filter(p => p.ownerId === 'p1');
    const p2Props = Object.values(state.properties).filter(p => p.ownerId === 'p2');
    expect(p1Props.length).toBe(3);
    expect(p2Props.length).toBe(3);
  });

  it('counts the Blitz limit as 40 player-turn endings rather than 40 full rounds', () => {
    const fourthPlayer: Player = { id: 'p4', name: 'Dana', color: '#3B7FC4' };
    let state = MetrovilleModule.createInitialState(
      { preset: 'blitz' },
      [p1, p2, p3, fourthPlayer],
      'seed-blitz-turn-count'
    );
    state.phase = 'turn_end';

    while (!MetrovilleModule.isGameOver(state)) {
      state = MetrovilleModule.applyAction(state, { type: 'END_TURN' });
    }

    expect(state.turnCount).toBe(40);
    expect(state.roundCount).toBe(9);
    expect(state.winReason).toContain('Spielzuglimit');
  });

  it('initializes Klassisch Light with its advertised starting money and without auctions', () => {
    let state = MetrovilleModule.createInitialState({ preset: 'classic_light' }, [p1, p2], 'seed-light');
    expect(state.players[0].money).toBe(1200);
    expect(state.config.turnLimit).toBeUndefined();

    state.players[0].position = 1;
    state.phase = 'tile_action';
    state = MetrovilleModule.applyAction(state, { type: 'DECLINE_BUY_PROPERTY' });
    expect(state.phase).toBe('turn_end');
    expect(state.auction).toBeNull();
  });

  it('handles buying properties and updating funds', () => {
    let state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-1');
    state.players[0].position = 1; // Alte Allee (cost 60)
    state.phase = 'tile_action';

    const val = MetrovilleModule.validateAction(state, { type: 'BUY_PROPERTY' }, 'p1');
    expect(val.valid).toBe(true);

    state = MetrovilleModule.applyAction(state, { type: 'BUY_PROPERTY' });
    expect(state.properties[1].ownerId).toBe('p1');
    expect(state.players[0].money).toBe(1500 - 60);
    expect(state.phase).toBe('turn_end');
  });

  it('rejects buying a property when the player cannot afford it', () => {
    const state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-low-funds');
    state.players[0].position = 1;
    state.players[0].money = 59;
    state.phase = 'tile_action';

    const result = MetrovilleModule.validateAction(state, { type: 'BUY_PROPERTY' }, 'p1');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Nicht genug Taler zum Kauf');
  });

  it('calculates rents with single, full district and house upgrades', () => {
    let state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-1');
    state.properties[1].ownerId = 'p1'; // Alte Allee (base rent: 2)

    // Single property: base rent 2
    expect(calculateRent(1, state)).toBe(2);

    // Full Altstadt district (1 and 3): doubled base rent = 4
    state.properties[3].ownerId = 'p1';
    expect(calculateRent(1, state)).toBe(4);

    // 1 house on Alte Allee: rent = 10
    state.properties[1].houses = 1;
    expect(calculateRent(1, state)).toBe(10);

    // Skyscraper (5 houses): rent = 250
    state.properties[1].houses = 5;
    expect(calculateRent(1, state)).toBe(250);
  });

  it('validates house building only when full district is owned', () => {
    let state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-1');
    state.properties[1].ownerId = 'p1';

    // Player only owns 1/2 of Altstadt -> cannot build
    const valIncomplete = MetrovilleModule.validateAction(state, { type: 'BUILD_HOUSE', propertyIndex: 1 }, 'p1');
    expect(valIncomplete.valid).toBe(false);

    // Owns both -> can build
    state.properties[3].ownerId = 'p1';
    const valComplete = MetrovilleModule.validateAction(state, { type: 'BUILD_HOUSE', propertyIndex: 1 }, 'p1');
    expect(valComplete.valid).toBe(true);
  });

  it('handles mortgaging and unmortgaging correctly', () => {
    let state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-1');
    state.properties[1].ownerId = 'p1'; // cost 60, mortgage value = 30

    // Mortgage
    state = MetrovilleModule.applyAction(state, { type: 'MORTGAGE', propertyIndex: 1 });
    expect(state.properties[1].isMortgaged).toBe(true);
    expect(state.players[0].money).toBe(1500 + 30);
    expect(calculateRent(1, state)).toBe(0);

    // Unmortgage (33 Taler = 55%)
    state = MetrovilleModule.applyAction(state, { type: 'UNMORTGAGE', propertyIndex: 1 });
    expect(state.properties[1].isMortgaged).toBe(false);
    expect(state.players[0].money).toBe(1530 - 33);
  });

  it('keeps dice deterministic for the same seed', () => {
    const first = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'same-seed');
    const second = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'same-seed');

    const firstRolled = MetrovilleModule.applyAction(first, { type: 'ROLL_DICE' });
    const secondRolled = MetrovilleModule.applyAction(second, { type: 'ROLL_DICE' });

    expect(firstRolled.dice).toEqual(secondRolled.dice);
    expect(first.lastRollerId).toBeNull();
    expect(firstRolled.lastRollerId).toBe('p1');
    expect(firstRolled.players[0].position).toBe(secondRolled.players[0].position);
    expect(first.randomIndex).toBe(0);
    expect(firstRolled.randomIndex).toBe(1);
  });

  it('does not mutate the previous state when changing a property', () => {
    const state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-copy');
    state.properties[1].ownerId = 'p1';
    state.phase = 'turn_end';

    const nextState = MetrovilleModule.applyAction(state, { type: 'MORTGAGE', propertyIndex: 1 });

    expect(state.properties[1].isMortgaged).toBe(false);
    expect(nextState.properties[1].isMortgaged).toBe(true);
  });

  it('bot ends turn after a failed jail roll instead of rolling again', async () => {
    const bot = MetrovilleModule.createBot!('medium');
    let state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-jail-bot');
    state.players[0].inJail = true;
    state.players[0].jailTurns = 1;
    state.phase = 'turn_end';
    state.currentTurnPlayerId = 'p1';
    const action = await bot.chooseAction(state, 'p1');
    expect(action.type).toBe('END_TURN');
  });

  it('handles paying a jail fine and using a jail card', () => {
    let state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-jail');
    state.players[0].inJail = true;
    state.players[0].jailTurns = 2;
    state.phase = 'roll';

    expect(MetrovilleModule.validateAction(state, { type: 'PAY_JAIL_FINE' }, 'p1').valid).toBe(true);
    state = MetrovilleModule.applyAction(state, { type: 'PAY_JAIL_FINE' });
    expect(state.players[0].money).toBe(1450);
    expect(state.players[0].inJail).toBe(false);
    expect(state.phase).toBe('roll');

    state.players[0].inJail = true;
    state.players[0].getOutOfJailCards = 1;
    state = MetrovilleModule.applyAction(state, { type: 'USE_JAIL_CARD' });
    expect(state.players[0].getOutOfJailCards).toBe(0);
    expect(state.players[0].inJail).toBe(false);
  });

  it('routes tax and renovation payments into the capped city park jackpot and pays it out on landing', () => {
    let state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { cityParkJackpot: true }
    }, [p1, p2], seedForDiceTotal(2));
    state.players[0].position = 2;
    state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });
    expect(state.players[0].money).toBe(1300);
    expect(state.cityParkJackpot).toBe(200);

    state.properties[1].ownerId = 'p1';
    state.properties[1].houses = 5;
    state.cityParkJackpot = 450;
    EXPRESS_CARDS.find(card => card.id === 'exp-6')?.action(state, 'p1');
    expect(state.players[0].money).toBe(1200);
    expect(state.cityParkJackpot).toBe(500);

    state.seed = seedForDiceTotal(2);
    state.randomIndex = 0;
    state.players[0].position = 18;
    state.currentTurnPlayerId = 'p1';
    state.phase = 'roll';
    state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });
    expect(state.players[0].position).toBe(20);
    expect(state.cityParkJackpot).toBe(0);
    expect(state.players[0].money).toBe(1700);
    expect(state.log.some(entry => entry.includes('Stadtpark-Jackpot'))).toBe(true);

    let classicState = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], seedForDiceTotal(2));
    classicState.players[0].position = 2;
    classicState = MetrovilleModule.applyAction(classicState, { type: 'ROLL_DICE' });
    expect(classicState.players[0].money).toBe(1300);
    expect(classicState.cityParkJackpot).toBe(0);
  });

  it('credits the jackpot before a tax payer goes bankrupt', () => {
    let state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { cityParkJackpot: true }
    }, [p1, p2], seedForDiceTotal(2));
    state.cityParkJackpot = 450;
    state.players[0].money = 0;
    state.players[0].position = 2;
    state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });

    expect(state.players[0].money).toBe(-200);
    expect(state.players[0].bankrupt).toBe(true);
    expect(state.cityParkJackpot).toBe(500);
  });

  it('awards the gate bonus only to a unique lowest-wealth player', () => {
    let state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { lowestWealthBonus: true }
    }, [p1, p2], seedForDiceTotal(2));
    state.players[0].money = 100;
    state.players[1].money = 400;
    state.players[0].position = 39;
    state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });
    expect(state.players[0].money).toBe(350);
    expect(state.log.some(entry => entry.includes('Förderprogramm'))).toBe(true);

    state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { lowestWealthBonus: true }
    }, [p1, p2], seedForDiceTotal(2));
    state.players[0].money = 100;
    state.players[1].money = 100;
    state.players[0].position = 39;
    state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });
    expect(state.players[0].money).toBe(300);
    expect(state.log.some(entry => entry.includes('Förderprogramm'))).toBe(false);

    state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { lowestWealthBonus: true }
    }, [p1, p2], seedForDiceTotal(2));
    state.players[0].money = 400;
    state.players[1].money = 100;
    state.players[0].position = 39;
    state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });
    expect(state.players[0].money).toBe(600);
    expect(state.log.some(entry => entry.includes('Förderprogramm'))).toBe(false);

    state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { lowestWealthBonus: true }
    }, [p1, p2], seedForDiceTotal(2));
    state.players[0].money = 100;
    state.players[1].money = 120;
    state.properties[1].ownerId = 'p1';
    state.properties[1].isMortgaged = true;
    state.players[0].position = 39;
    state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });
    expect(state.players[0].money).toBe(300);
    expect(state.log.some(entry => entry.includes('Förderprogramm'))).toBe(false);
  });

  it('creates fixed-term leases through trades, redirects rent, and expires them after full table rounds', () => {
    const players = [p1, p2, p3];
    let state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { propertyLeases: true }
    }, players, seedForDiceTotal(2));
    state.phase = 'turn_end';
    state.properties[1].ownerId = 'p1';
    state.properties[3].ownerId = 'p1';
    const offer = {
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      offeredMoney: 0,
      offeredPropertyIndices: [1],
      offeredLeasePropertyIndices: [1],
      requestedMoney: 40,
      requestedPropertyIndices: [],
      requestedLeasePropertyIndices: []
    };
    expect(MetrovilleModule.validateAction(state, { type: 'OFFER_TRADE', offer }, 'p1').valid).toBe(true);
    state = MetrovilleModule.applyAction(state, { type: 'OFFER_TRADE', offer });
    expect(MetrovilleModule.validateAction(state, { type: 'ACCEPT_TRADE', tradeId: 'trade-1' }, 'p2').valid).toBe(true);
    state = MetrovilleModule.applyAction(state, { type: 'ACCEPT_TRADE', tradeId: 'trade-1' });
    expect(state.properties[1].ownerId).toBe('p1');
    expect(state.players[0].money).toBe(1540);
    expect(state.players[1].money).toBe(1460);
    expect(state.leases[1]).toEqual({
      propertyIndex: 1,
      ownerId: 'p1',
      tenantId: 'p2',
      expiresAtRound: 5
    });
    expect(MetrovilleModule.validateAction(state, { type: 'BUILD_HOUSE', propertyIndex: 1 }, 'p1').valid).toBe(false);
    expect(MetrovilleModule.validateAction(state, { type: 'MORTGAGE', propertyIndex: 1 }, 'p1').valid).toBe(false);

    state.players[2].position = 39;
    state.currentTurnPlayerId = 'p3';
    state.phase = 'roll';
    state.seed = seedForDiceTotal(2);
    state.randomIndex = 0;
    state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });
    expect(state.players[2].money).toBe(1696);
    expect(state.players[1].money).toBe(1464);
    expect(state.players[0].money).toBe(1540);

    state.doublesRolledCount = 0;
    for (let turn = 0; turn < 15; turn++) {
      state.phase = 'turn_end';
      state = MetrovilleModule.applyAction(state, { type: 'END_TURN' });
    }
    expect(state.roundCount).toBe(5);
    expect(state.leases[1]).toBeUndefined();
    expect(state.properties[1].ownerId).toBe('p1');
    expect(state.log.some(entry => entry.includes('Pacht') && entry.includes('endet'))).toBe(true);
  });

  it('supports requesting a lease and rejects lease terms when the preset flag is off', () => {
    const defaultState = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-lease-off');
    defaultState.phase = 'turn_end';
    defaultState.properties[1].ownerId = 'p1';
    const leaseOffer = {
      fromPlayerId: 'p2',
      toPlayerId: 'p1',
      offeredMoney: 40,
      offeredPropertyIndices: [],
      requestedMoney: 0,
      requestedPropertyIndices: [1],
      requestedLeasePropertyIndices: [1]
    };
    expect(MetrovilleModule.validateAction(defaultState, { type: 'OFFER_TRADE', offer: leaseOffer }, 'p2').valid).toBe(false);

    let state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { propertyLeases: true }
    }, [p1, p2], 'seed-lease-request');
    state.phase = 'turn_end';
    state.currentTurnPlayerId = 'p2';
    state.properties[1].ownerId = 'p1';
    expect(MetrovilleModule.validateAction(state, { type: 'OFFER_TRADE', offer: leaseOffer }, 'p2').valid).toBe(true);
    state = MetrovilleModule.applyAction(state, { type: 'OFFER_TRADE', offer: leaseOffer });
    state = MetrovilleModule.applyAction(state, { type: 'ACCEPT_TRADE', tradeId: 'trade-1' });
    expect(state.properties[1].ownerId).toBe('p1');
    expect(state.leases[1].tenantId).toBe('p2');
    expect(state.players[0].money).toBe(1540);
    expect(state.players[1].money).toBe(1460);
  });

  it('ends a tenant’s lease immediately on bankruptcy and remaps lease ids on reconnect', () => {
    let state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { propertyLeases: true }
    }, [p1, p2, p3], 'seed-lease-bankruptcy');
    state.properties[1].ownerId = 'p1';
    state.leases[1] = { propertyIndex: 1, ownerId: 'p1', tenantId: 'p2', expiresAtRound: 6 };
    state.players[1].money = -1;
    state.currentTurnPlayerId = 'p2';
    state.phase = 'turn_end';
    state = MetrovilleModule.applyAction(state, { type: 'DECLARE_BANKRUPTCY' });
    expect(state.players[1].bankrupt).toBe(true);
    expect(state.leases[1]).toBeUndefined();
    expect(state.properties[1].ownerId).toBe('p1');
    expect(MetrovilleModule.validateAction(state, { type: 'END_TURN' }, 'p2').valid).toBe(true);
    state = MetrovilleModule.applyAction(state, { type: 'END_TURN' });
    expect(state.currentTurnPlayerId).toBe('p3');

    state.leases[1] = { propertyIndex: 1, ownerId: 'p1', tenantId: 'p2', expiresAtRound: 6 };
    state.playersActedThisRound = ['p2'];
    state.pendingTrade = {
      id: 'trade-reconnect',
      fromPlayerId: 'p2',
      toPlayerId: 'p3',
      offeredMoney: 0,
      offeredPropertyIndices: [],
      requestedMoney: 0,
      requestedPropertyIndices: [1],
      requestedLeasePropertyIndices: [1]
    };
    const remapped = remapMetrovillePlayerId(state, 'p2', 'p2-new');
    expect(remapped.players.find(player => player.id === 'p2-new')).toBeTruthy();
    expect(remapped.playersActedThisRound).toEqual(['p2-new']);
    expect(remapped.leases[1].tenantId).toBe('p2-new');
    expect(remapped.pendingTrade?.fromPlayerId).toBe('p2-new');
    expect(state.leases[1].tenantId).toBe('p2');

    let reconnectState = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { propertyLeases: true }
    }, [p1, p2, p3], seedForDiceTotal(2));
    reconnectState.properties[1].ownerId = 'p1';
    reconnectState.leases[1] = { propertyIndex: 1, ownerId: 'p1', tenantId: 'p2', expiresAtRound: 6 };
    reconnectState = remapMetrovillePlayerId(reconnectState, 'p2', 'p2-reconnected');
    reconnectState.players.find(player => player.id === 'p2-reconnected')!.money = 1000;
    reconnectState.players.find(player => player.id === 'p3')!.position = 39;
    reconnectState.currentTurnPlayerId = 'p3';
    reconnectState = MetrovilleModule.applyAction(reconnectState, { type: 'ROLL_DICE' });
    expect(reconnectState.players.find(player => player.id === 'p2-reconnected')?.money).toBe(1002);
    expect(reconnectState.players.find(player => player.id === 'p1')?.money).toBe(1500);
  });

  it('ends the lease and returns the property when the landlord goes bankrupt', () => {
    let state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { propertyLeases: true }
    }, [p1, p2, p3], 'seed-landlord-bankruptcy');
    state.properties[1].ownerId = 'p1';
    state.leases[1] = { propertyIndex: 1, ownerId: 'p1', tenantId: 'p2', expiresAtRound: 6 };
    state.players[0].money = -1;
    state.currentTurnPlayerId = 'p1';
    state.phase = 'turn_end';
    state = MetrovilleModule.applyAction(state, { type: 'DECLARE_BANKRUPTCY' });
    expect(state.players[0].bankrupt).toBe(true);
    expect(state.leases[1]).toBeUndefined();
    expect(state.properties[1].ownerId).toBeNull();
    expect(state.log.some(entry => entry.includes('Pacht') && entry.includes('endet'))).toBe(true);
  });

  it('automatically declines a lease offer received by a bot and preserves the Blitz turn limit', () => {
    const bot = MetrovilleModule.createBot!('medium');
    const state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { propertyLeases: true }
    }, [p1, p2], 'seed-bot-lease');
    state.pendingTrade = {
      id: 'trade-bot-lease',
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      offeredMoney: 0,
      offeredPropertyIndices: [1],
      offeredLeasePropertyIndices: [1],
      requestedMoney: 10,
      requestedPropertyIndices: [],
      requestedLeasePropertyIndices: []
    };
    expect(bot.chooseAction(state, 'p2')).toEqual({ type: 'DECLINE_TRADE', tradeId: 'trade-bot-lease' });

    let blitz = MetrovilleModule.createInitialState({ preset: 'blitz', turnLimit: 1 }, [p1, p2], 'seed-limit');
    blitz.phase = 'turn_end';
    blitz.cityParkJackpot = 120;
    blitz = MetrovilleModule.applyAction(blitz, { type: 'END_TURN' });
    expect(blitz.phase).toBe('gameover');
    expect(blitz.cityParkJackpot).toBe(120);
  });

  it('enforces even building and selling within a district', () => {
    let state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-build');
    state.properties[1].ownerId = 'p1';
    state.properties[3].ownerId = 'p1';
    state.properties[1].houses = 1;
    state.phase = 'turn_end';

    expect(MetrovilleModule.validateAction(state, { type: 'BUILD_HOUSE', propertyIndex: 1 }, 'p1').valid).toBe(false);
    expect(MetrovilleModule.validateAction(state, { type: 'BUILD_HOUSE', propertyIndex: 3 }, 'p1').valid).toBe(true);

    state = MetrovilleModule.applyAction(state, { type: 'BUILD_HOUSE', propertyIndex: 3 });
    expect(state.properties[3].houses).toBe(1);
    expect(MetrovilleModule.validateAction(state, { type: 'SELL_HOUSE', propertyIndex: 1 }, 'p1').valid).toBe(true);
    state = MetrovilleModule.applyAction(state, { type: 'SELL_HOUSE', propertyIndex: 1 });
    expect(state.properties[1].houses).toBe(0);
  });

  it('starts an auction with a ten-taler minimum bid', () => {
    let state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-auction');
    state.players[0].position = 1;
    state.phase = 'tile_action';
    state = MetrovilleModule.applyAction(state, { type: 'DECLINE_BUY_PROPERTY' });

    expect(state.auction?.highestBid).toBe(0);
    expect(MetrovilleModule.validateAction(state, { type: 'BID_AUCTION', bidAmount: 9 }, 'p1').valid).toBe(false);
    expect(MetrovilleModule.validateAction(state, { type: 'BID_AUCTION', bidAmount: 10 }, 'p1').valid).toBe(true);
    state = MetrovilleModule.applyAction(state, { type: 'BID_AUCTION', bidAmount: 10 });
    state = MetrovilleModule.applyAction(state, { type: 'PASS_AUCTION' });

    expect(state.properties[1].ownerId).toBe('p1');
    expect(state.players[0].money).toBe(1490);
    expect(state.auction).toBeNull();
  });

  it('keeps auction bids close to property value and values a district completion', async () => {
    const bot = MetrovilleModule.createBot!('medium');
    const state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-auction-bot');
    state.phase = 'auction';
    state.auction = {
      propertyIndex: 6,
      initiatorId: 'p2',
      highestBid: 0,
      highestBidderId: null,
      activePlayerIds: ['p1', 'p2'],
      currentBidderIndex: 0
    };

    const standaloneBid = await bot.chooseAction(state, 'p1');
    expect(standaloneBid).toEqual({ type: 'BID_AUCTION', bidAmount: 10 });
    if (standaloneBid.type === 'BID_AUCTION') expect(standaloneBid.bidAmount).toBeLessThanOrEqual(130);

    state.properties[8].ownerId = 'p1';
    state.properties[9].ownerId = 'p1';
    const completionBid = await bot.chooseAction(state, 'p1');
    expect(completionBid).toEqual({ type: 'BID_AUCTION', bidAmount: 10 });

    state.auction.highestBid = 170;
    expect(await bot.chooseAction(state, 'p1')).toEqual({ type: 'BID_AUCTION', bidAmount: 180 });
    state.auction.highestBid = 180;
    expect(await bot.chooseAction(state, 'p1')).toEqual({ type: 'PASS_AUCTION' });
  });

  it('executes and declines player trades atomically', () => {
    let state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-trade');
    state.properties[1].ownerId = 'p1';
    state.properties[3].ownerId = 'p2';
    state.phase = 'turn_end';
    const offer = {
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      offeredMoney: 100,
      offeredPropertyIndices: [1],
      requestedMoney: 50,
      requestedPropertyIndices: [3]
    };

    expect(MetrovilleModule.validateAction(state, { type: 'OFFER_TRADE', offer }, 'p1').valid).toBe(true);
    state = MetrovilleModule.applyAction(state, { type: 'OFFER_TRADE', offer });
    expect(state.pendingTrade?.id).toBe('trade-1');
    expect(MetrovilleModule.validateAction(state, { type: 'ACCEPT_TRADE', tradeId: 'trade-1' }, 'p2').valid).toBe(true);
    state = MetrovilleModule.applyAction(state, { type: 'ACCEPT_TRADE', tradeId: 'trade-1' });
    expect(state.properties[1].ownerId).toBe('p2');
    expect(state.properties[3].ownerId).toBe('p1');
    expect(state.players[0].money).toBe(1450);
    expect(state.players[1].money).toBe(1550);
    expect(state.pendingTrade).toBeNull();

    state.phase = 'turn_end';
    expect(MetrovilleModule.validateAction(state, { type: 'OFFER_TRADE', offer }, 'p1').valid).toBe(false);
  });

  it('lets a configured bot trade to complete a colour district and explains the value', async () => {
    const botPlayer = { ...p1, isBot: true };
    const humanPlayer = { ...p2, isBot: false };
    let state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { botTrading: true }
    }, [botPlayer, humanPlayer], 'seed-bot-trade');
    state.currentTurnPlayerId = botPlayer.id;
    state.phase = 'turn_end';
    state.properties[1].ownerId = botPlayer.id;
    state.properties[3].ownerId = humanPlayer.id;

    const bot = MetrovilleModule.createBot!('medium');
    const offerAction = await bot.chooseAction(state, botPlayer.id);
    expect(offerAction.type).toBe('OFFER_TRADE');
    if (offerAction.type !== 'OFFER_TRADE') return;
    expect(offerAction.offer.requestedPropertyIndices).toEqual([3]);
    expect(offerAction.offer.offeredMoney).toBeGreaterThan(60);
    expect(MetrovilleModule.validateAction(state, offerAction, botPlayer.id).valid).toBe(true);

    state = MetrovilleModule.applyAction(state, offerAction);
    expect(state.botTradeOfferRounds[botPlayer.id]).toBe(state.roundCount);
    expect(await bot.chooseAction(state, botPlayer.id)).toEqual({ type: 'END_TURN' });
    expect(await bot.chooseAction(state, humanPlayer.id)).toEqual({
      type: 'ACCEPT_TRADE',
      tradeId: 'trade-1'
    });

    state = MetrovilleModule.applyAction(state, { type: 'ACCEPT_TRADE', tradeId: 'trade-1' });
    expect(state.properties[1].ownerId).toBe(botPlayer.id);
    expect(state.properties[3].ownerId).toBe(botPlayer.id);
    expect(state.log.some(entry => entry.includes('geschätzter Gegenwert: +'))).toBe(true);
  });

  it('rejects invalid bot offers, enforces the per-round limit, and keeps bot trading opt-in', () => {
    const botPlayer = { ...p1, isBot: true };
    let state = MetrovilleModule.createInitialState({
      preset: 'standard'
    }, [botPlayer, p2], 'seed-bot-trade-validation');
    state.currentTurnPlayerId = botPlayer.id;
    state.phase = 'turn_end';
    state.properties[1].ownerId = botPlayer.id;
    state.properties[3].ownerId = p2.id;
    const offer = {
      fromPlayerId: botPlayer.id,
      toPlayerId: p2.id,
      offeredMoney: 70,
      offeredPropertyIndices: [],
      requestedMoney: 0,
      requestedPropertyIndices: [3]
    };
    expect(MetrovilleModule.validateAction(state, { type: 'OFFER_TRADE', offer }, botPlayer.id).valid).toBe(false);

    state.config.mechanics.botTrading = true;
    state.botTradeOfferRounds[botPlayer.id] = state.roundCount;
    expect(MetrovilleModule.validateAction(state, { type: 'OFFER_TRADE', offer }, botPlayer.id).valid).toBe(false);
    delete state.botTradeOfferRounds[botPlayer.id];
    expect(MetrovilleModule.validateAction(state, {
      type: 'OFFER_TRADE',
      offer: { ...offer, offeredPropertyIndices: [1, 1] }
    }, botPlayer.id).valid).toBe(false);
  });

  it('makes easy bots less willing to trade than medium bots', async () => {
    const botPlayer = { ...p1, isBot: true };
    const state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { botTrading: true }
    }, [botPlayer, p2], 'seed-bot-trade-difficulty');
    state.currentTurnPlayerId = botPlayer.id;
    state.players[0].money = 220;
    state.phase = 'turn_end';
    state.properties[1].ownerId = botPlayer.id;
    state.properties[3].ownerId = p2.id;

    expect(await MetrovilleModule.createBot!('easy').chooseAction(state, botPlayer.id))
      .toEqual({ type: 'END_TURN' });
    expect((await MetrovilleModule.createBot!('medium').chooseAction(state, botPlayer.id)).type)
      .toBe('OFFER_TRADE');
  });

  it('declines a trade that became unaffordable before the bot could answer', async () => {
    const botPlayer = { ...p2, isBot: true };
    const state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { botTrading: true }
    }, [p1, botPlayer], 'seed-stale-bot-trade');
    state.players[0].money = 0;
    state.properties[3].ownerId = botPlayer.id;
    state.pendingTrade = {
      id: 'trade-stale',
      fromPlayerId: p1.id,
      toPlayerId: botPlayer.id,
      offeredMoney: 100,
      offeredPropertyIndices: [],
      requestedMoney: 0,
      requestedPropertyIndices: [3]
    };

    expect(await MetrovilleModule.createBot!('medium').chooseAction(state, botPlayer.id))
      .toEqual({ type: 'DECLINE_TRADE', tradeId: 'trade-stale' });
    expect(MetrovilleModule.validateAction(state, {
      type: 'ACCEPT_TRADE',
      tradeId: 'trade-stale'
    }, botPlayer.id).valid).toBe(false);
  });

  it('makes bot trades without disturbing an unrelated active lease', async () => {
    const botPlayer = { ...p1, isBot: true };
    let state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { botTrading: true, propertyLeases: true }
    }, [botPlayer, p2, p3], 'seed-bot-trade-lease');
    state.currentTurnPlayerId = botPlayer.id;
    state.phase = 'turn_end';
    state.properties[1].ownerId = botPlayer.id;
    state.properties[3].ownerId = p2.id;
    state.properties[16].ownerId = botPlayer.id;
    state.leases[16] = {
      propertyIndex: 16,
      ownerId: botPlayer.id,
      tenantId: p3.id,
      expiresAtRound: 5
    };

    const bot = MetrovilleModule.createBot!('medium');
    const offerAction = await bot.chooseAction(state, botPlayer.id);
    expect(offerAction.type).toBe('OFFER_TRADE');
    if (offerAction.type !== 'OFFER_TRADE') return;
    state = MetrovilleModule.applyAction(state, offerAction);
    state = MetrovilleModule.applyAction(state, { type: 'ACCEPT_TRADE', tradeId: 'trade-1' });
    expect(state.properties[3].ownerId).toBe(botPlayer.id);
    expect(state.leases[16]).toEqual({
      propertyIndex: 16,
      ownerId: botPlayer.id,
      tenantId: p3.id,
      expiresAtRound: 5
    });
  });

  it('remaps an open bot trade and its per-round marker after reconnect', async () => {
    const botPlayer = { ...p1, isBot: true };
    let state = MetrovilleModule.createInitialState({
      preset: 'standard',
      mechanics: { botTrading: true }
    }, [botPlayer, p2], 'seed-bot-trade-reconnect');
    state.currentTurnPlayerId = botPlayer.id;
    state.phase = 'turn_end';
    state.properties[1].ownerId = botPlayer.id;
    state.properties[3].ownerId = p2.id;
    const offerAction = await MetrovilleModule.createBot!('medium').chooseAction(state, botPlayer.id);
    expect(offerAction.type).toBe('OFFER_TRADE');
    if (offerAction.type !== 'OFFER_TRADE') return;
    state = MetrovilleModule.applyAction(state, offerAction);

    state = remapMetrovillePlayerId(state, botPlayer.id, 'bot-reconnected');
    expect(state.pendingTrade?.fromPlayerId).toBe('bot-reconnected');
    expect(state.botTradeOfferRounds['bot-reconnected']).toBe(state.roundCount);
    expect(MetrovilleModule.validateAction(state, {
      type: 'ACCEPT_TRADE',
      tradeId: state.pendingTrade!.id
    }, p2.id).valid).toBe(true);
    state = MetrovilleModule.applyAction(state, {
      type: 'ACCEPT_TRADE',
      tradeId: state.pendingTrade!.id
    });
    expect(state.properties[1].ownerId).toBe('bot-reconnected');
    expect(state.properties[3].ownerId).toBe('bot-reconnected');
  });

  it('applies configured salary and tax values without changing the existing defaults', () => {
    let state = MetrovilleModule.createInitialState({
      preset: 'standard',
      goPassSalary: 50,
      taxMultiplier: 1.5
    }, [p1, p2], seedForDiceTotal(2));
    state.players[0].position = 39;
    state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });
    expect(state.players[0].money).toBe(1550);

    state = MetrovilleModule.createInitialState({
      preset: 'standard',
      taxMultiplier: 1.5
    }, [p1, p2], seedForDiceTotal(4));
    state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });
    expect(state.players[0].money).toBe(1200);
    expect(state.log.some(entry => entry.includes('zahlt 300 Taler Bürgersteuer'))).toBe(true);
  });

  it('declares bankruptcy after emergency mortgages cannot cover debt', () => {
    let state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-bankruptcy');
    state.properties[1].ownerId = 'p1';
    state.players[0].money = -100;
    state.phase = 'turn_end';

    expect(MetrovilleModule.validateAction(state, { type: 'DECLARE_BANKRUPTCY' }, 'p1').valid).toBe(true);
    state = MetrovilleModule.applyAction(state, { type: 'DECLARE_BANKRUPTCY' });
    expect(state.players[0].bankrupt).toBe(true);
    expect(state.properties[1].ownerId).toBeNull();
    expect(state.winnerId).toBe('p2');
    expect(state.phase).toBe('gameover');
  });

  it('initializes and applies Chance and Gemeinschaft cards', () => {
    const state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-cards');
    expect(state.chanceDeck).toHaveLength(EXPRESS_CARDS.length);
    expect(state.communityDeck).toHaveLength(STADTRAT_CARDS.length);

    const chanceState = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], seedForDiceTotal(2));
    chanceState.players[0].position = 5;
    const afterChance = MetrovilleModule.applyAction(chanceState, { type: 'ROLL_DICE' });
    expect(afterChance.lastDrawnCard?.deck).toBe('chance');
    expect(afterChance.phase).toBe('card_reveal');
    expect(afterChance.pendingCard?.cardId).toBeTruthy();
    const afterDismiss = MetrovilleModule.applyAction(afterChance, { type: 'DISMISS_CARD' });
    expect(afterDismiss.phase).toBe('turn_end');
    expect(afterDismiss.pendingCard).toBeNull();

    const communityState = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], seedForDiceTotal(2));
    communityState.players[0].position = 0;
    const afterCommunity = MetrovilleModule.applyAction(communityState, { type: 'ROLL_DICE' });
    expect(afterCommunity.lastDrawnCard?.deck).toBe('community');

    const cardState = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-card-effect');
    const technologyCard = EXPRESS_CARDS.find(card => card.id === 'exp-4');
    const communityCard = STADTRAT_CARDS.find(card => card.id === 'stadt-1');
    technologyCard?.action(cardState, 'p1');
    communityCard?.action(cardState, 'p1');
    expect(cardState.players[0].money).toBe(1750);
  });

  it('measures 200 fixed-seed bot games per preset with and without Etappe 1 mechanics', async () => {
    const presets: Array<'blitz' | 'standard' | 'classic_light'> = ['blitz', 'standard', 'classic_light'];
    const mechanics = { cityParkJackpot: true, lowestWealthBonus: true, propertyLeases: true };
    const maxActions = 6000;
    const sampleSeeds = new Set([0, 42, 199]);

    for (const preset of presets) {
      for (const enabled of [false, true]) {
        const turnCounts: number[] = [];
        const roundCounts: number[] = [];
        const finishedRounds: number[] = [];
        const actionCounts: number[] = [];
        let ended = 0;
        let totalInvalidActions = 0;
        let maxInvalidActions = 0;
        let gamesWithBankruptcies = 0;
        const samples: string[] = [];

        for (let gameIndex = 0; gameIndex < 200; gameIndex++) {
          let state = MetrovilleModule.createInitialState({
            preset,
            mechanics: enabled ? mechanics : undefined
          }, [p1, p2, p3], `sim-${preset}-${gameIndex}`);
          const bot = MetrovilleModule.createBot!('medium');
          let steps = 0;
          let invalidActions = 0;
          const sampleRounds = [25, 100, 250, 500, 750, 1000];
          let nextSampleIndex = 0;
          const sampledProgress: string[] = [];

          while (!MetrovilleModule.isGameOver(state) && steps < maxActions) {
            steps++;
            const curPid = state.phase === 'auction' && state.auction
              ? state.auction.activePlayerIds[state.auction.currentBidderIndex]
              : state.currentTurnPlayerId;
            const action = await bot.chooseAction(state, curPid);
            if (MetrovilleModule.validateAction(state, action, curPid).valid) {
              state = MetrovilleModule.applyAction(state, action);
            } else {
              invalidActions++;
              if (state.phase === 'roll') {
                state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });
              } else if (state.phase === 'tile_action') {
                state = MetrovilleModule.applyAction(state, { type: 'DECLINE_BUY_PROPERTY' });
              } else if (state.phase === 'turn_end') {
                state = MetrovilleModule.applyAction(state, { type: 'END_TURN' });
              } else if (state.phase === 'auction') {
                state = MetrovilleModule.applyAction(state, { type: 'PASS_AUCTION' });
              } else if (state.phase === 'card_reveal') {
                state = MetrovilleModule.applyAction(state, { type: 'DISMISS_CARD' });
              }
            }

            while (nextSampleIndex < sampleRounds.length
              && state.roundCount >= sampleRounds[nextSampleIndex]
              && sampleSeeds.has(gameIndex)) {
              const sampleRound = sampleRounds[nextSampleIndex];
              const wealth = state.players.map(player =>
                `${player.id}:${player.money + Object.entries(state.properties)
                  .filter(([, property]) => property.ownerId === player.id)
                  .reduce((total, [index, property]) => {
                    const field = METROVILLE_FIELDS[Number(index)];
                    return total + (field.cost || 0) + property.houses * Math.floor((field.houseCost || 0) / 2);
                  }, 0)}`
              ).join(',');
              const cash = state.players.map(player => `${player.id}:${player.money}`).join(',');
              const ownedProperties = state.players.map(player =>
                `${player.id}:${Object.values(state.properties).filter(property => property.ownerId === player.id).length}`
              ).join(',');
              const buildings = Object.values(state.properties).reduce((total, property) => total + property.houses, 0);
              const completeDistricts = state.players.map(player =>
                `${player.id}:${Object.entries(DISTRICT_MAP)
                  .filter(([district, indices]) => district !== 'station' && district !== 'utility' && district !== 'special'
                    && indices.every(index => state.properties[index]?.ownerId === player.id)).length}`
              ).join(',');
              const bankrupt = state.players.filter(player => player.bankrupt).length;
              sampledProgress.push(`r${sampleRound}[cash ${cash}; wealth ${wealth}; properties ${ownedProperties}; completeSets ${completeDistricts}; buildings ${buildings}; bankrupt ${bankrupt}]`);
              nextSampleIndex++;
            }
            if (steps % 1000 === 0) await new Promise(resolve => setTimeout(resolve, 0));
          }

          expect(steps).toBeGreaterThan(0);
          const isEnded = MetrovilleModule.isGameOver(state);
          if (isEnded) ended++;
          if (state.players.some(player => player.bankrupt)) gamesWithBankruptcies++;
          totalInvalidActions += invalidActions;
          maxInvalidActions = Math.max(maxInvalidActions, invalidActions);
          turnCounts.push(state.turnCount);
          roundCounts.push(state.roundCount);
          actionCounts.push(steps);
          if (isEnded) finishedRounds.push(state.roundCount);
          if (sampleSeeds.has(gameIndex)) {
            const buildings = Object.values(state.properties).reduce((total, property) => total + property.houses, 0);
            samples.push(
              `seed ${gameIndex}: rounds=${state.roundCount}, turnEnds=${state.turnCount}, bankrupt=${state.players.filter(player => player.bankrupt).length}, buildings=${buildings}, ${sampledProgress.join(' ')}`
            );
          }
        }

        const sorted = [...roundCounts].sort((left, right) => left - right);
        const medianRounds = (sorted[99] + sorted[100]) / 2;
        const completedSortedRounds = [...finishedRounds].sort((left, right) => left - right);
        const completedAverageRounds = finishedRounds.length
          ? finishedRounds.reduce((sum, count) => sum + count, 0) / finishedRounds.length
          : null;
        const completedMedianRounds = finishedRounds.length
          ? (completedSortedRounds[Math.floor((finishedRounds.length - 1) / 2)]
            + completedSortedRounds[Math.ceil((finishedRounds.length - 1) / 2)]) / 2
          : null;
        console.info(
          `[MetroVille baseline] ${preset} mechanics=${enabled ? 'on' : 'off'} actionsLimit=${maxActions}: ` +
          `observed rounds avg=${(roundCounts.reduce((sum, count) => sum + count, 0) / 200).toFixed(1)} median=${medianRounds} max=${Math.max(...roundCounts)}; ` +
          `ended rounds avg=${completedAverageRounds === null ? 'n/a' : completedAverageRounds.toFixed(1)} median=${completedMedianRounds ?? 'n/a'} max=${completedSortedRounds.at(-1) ?? 'n/a'}; ` +
          `actions avg=${(actionCounts.reduce((sum, count) => sum + count, 0) / 200).toFixed(1)} max=${Math.max(...actionCounts)}; ` +
          `turnEnds avg=${(turnCounts.reduce((sum, count) => sum + count, 0) / 200).toFixed(1)} max=${Math.max(...turnCounts)}; ` +
          `ended=${ended}/200; gamesWithBankruptcies=${gamesWithBankruptcies}/200; invalidBotActions=${totalInvalidActions} (max ${maxInvalidActions})`
        );
        samples.forEach(sample => console.info(`[MetroVille sample] ${preset} mechanics=${enabled ? 'on' : 'off'} ${sample}`));
        expect(roundCounts).toHaveLength(200);
      }
    }
  }, 120000);

  it('compares 200 fixed-seed Standard and Klassisch Light games with bot trading and Etappe 1 toggled', async () => {
    const presets: Array<'standard' | 'classic_light'> = ['standard', 'classic_light'];
    const mechanics = { cityParkJackpot: true, lowestWealthBonus: true, propertyLeases: true };
    const botPlayers = [p1, p2, p3].map(player => ({ ...player, isBot: true }));
    const maxActions = 6000;

    for (const preset of presets) {
      for (const tradeEnabled of [false, true]) {
        for (const mechanicsEnabled of [false, true]) {
          const observedRounds: number[] = [];
          const finishedRounds: number[] = [];
          let ended = 0;
          let gamesWithCompleteDistrict = 0;
          let builtBuildings = 0;
          let bankruptcies = 0;
          let invalidBotActions = 0;
          const invalidReasons = new Map<string, number>();

          for (let gameIndex = 0; gameIndex < 200; gameIndex++) {
            let state = MetrovilleModule.createInitialState({
              preset,
              mechanics: {
                ...mechanics,
                botTrading: tradeEnabled,
                ...(mechanicsEnabled ? {} : {
                  cityParkJackpot: false,
                  lowestWealthBonus: false,
                  propertyLeases: false
                })
              }
            }, botPlayers, `sim-${preset}-${gameIndex}`);
            const bot = MetrovilleModule.createBot!('medium');
            let actions = 0;

            while (!MetrovilleModule.isGameOver(state) && actions < maxActions) {
              const actingPlayerId = state.phase === 'auction' && state.auction
                ? state.auction.activePlayerIds[state.auction.currentBidderIndex]
                : state.currentTurnPlayerId;
              const action = await bot.chooseAction(state, actingPlayerId);
              const validation = MetrovilleModule.validateAction(state, action, actingPlayerId);
              if (validation.valid) {
                const previousBuildings = Object.values(state.properties)
                  .reduce((sum, property) => sum + property.houses, 0);
                state = MetrovilleModule.applyAction(state, action);
                const nextBuildings = Object.values(state.properties)
                  .reduce((sum, property) => sum + property.houses, 0);
                builtBuildings += Math.max(0, nextBuildings - previousBuildings);
              } else {
                invalidBotActions++;
                const reason = `${action.type}: ${validation.error}`;
                invalidReasons.set(reason, (invalidReasons.get(reason) || 0) + 1);
                const fallback: MetrovilleAction = state.phase === 'roll' ? { type: 'ROLL_DICE' }
                  : state.phase === 'tile_action' ? { type: 'DECLINE_BUY_PROPERTY' }
                    : state.phase === 'turn_end' ? { type: 'END_TURN' }
                      : state.phase === 'auction' ? { type: 'PASS_AUCTION' }
                        : { type: 'DISMISS_CARD' };
                state = MetrovilleModule.applyAction(state, fallback);
              }
              actions++;
              if (actions % 1000 === 0) await new Promise(resolve => setTimeout(resolve, 0));
            }

            const finished = MetrovilleModule.isGameOver(state);
            if (finished) {
              ended++;
              finishedRounds.push(state.roundCount);
            }
            observedRounds.push(state.roundCount);
            bankruptcies += state.players.filter(player => player.bankrupt).length;
            const hasCompleteDistrict = state.players.some(player =>
              Object.entries(DISTRICT_MAP).some(([district, indices]) =>
                district !== 'station' && district !== 'utility' && district !== 'special'
                && indices.every(index => state.properties[index]?.ownerId === player.id)
              )
            );
            if (hasCompleteDistrict) gamesWithCompleteDistrict++;
          }

          const sortedObservedRounds = [...observedRounds].sort((left, right) => left - right);
          const sortedFinishedRounds = [...finishedRounds].sort((left, right) => left - right);
          const median = (values: number[]) => values.length
            ? (values[Math.floor((values.length - 1) / 2)] + values[Math.ceil((values.length - 1) / 2)]) / 2
            : null;
          const average = (values: number[]) => values.length
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : null;
          console.info(
            `[MetroVille trade matrix] ${preset} trade=${tradeEnabled ? 'on' : 'off'} etappe1=${mechanicsEnabled ? 'on' : 'off'} ` +
            `ended=${ended}/200 finishedRounds=${average(finishedRounds)?.toFixed(1) ?? 'n/a'}/${median(sortedFinishedRounds) ?? 'n/a'}/${sortedFinishedRounds.at(-1) ?? 'n/a'} ` +
            `observedRounds=${average(observedRounds)?.toFixed(1)}/${median(sortedObservedRounds)}/${sortedObservedRounds.at(-1)} ` +
            `completeDistrictGames=${gamesWithCompleteDistrict}/200 builtBuildings=${builtBuildings} bankruptcies=${bankruptcies} invalidBotActions=${invalidBotActions} reasons=${JSON.stringify(Object.fromEntries(invalidReasons))}`
          );
          expect(observedRounds).toHaveLength(200);
          expect(invalidBotActions).toBe(0);
        }
      }
    }
  }, 240000);
});
