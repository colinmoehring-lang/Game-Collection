import { describe, it, expect } from 'vitest';
import { MetrovilleModule, calculateRent } from './index.js';
import { METROVILLE_FIELDS, DISTRICT_MAP } from './board.js';
import { EXPRESS_CARDS, STADTRAT_CARDS } from './cards.js';
import { createRNG, type Player } from '@metroville/game-sdk';

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

  it('bot ends turn after a failed jail roll instead of rolling again', () => {
    const bot = MetrovilleModule.createBot!('medium');
    let state = MetrovilleModule.createInitialState({ preset: 'standard' }, [p1, p2], 'seed-jail-bot');
    state.players[0].inJail = true;
    state.players[0].jailTurns = 1;
    state.phase = 'turn_end';
    state.currentTurnPlayerId = 'p1';
    const action = bot.chooseAction(state, 'p1');
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

  it('simulates 100 bot games per preset without crashing', async () => {
    const presets: Array<'blitz' | 'standard' | 'classic_light'> = ['blitz', 'standard', 'classic_light'];

    for (const preset of presets) {
      let gamesCompleted = 0;
      for (let g = 0; g < 100; g++) {
        let state = MetrovilleModule.createInitialState({ preset }, [p1, p2, p3], `sim-${preset}-${g}`);
        const bot = MetrovilleModule.createBot!('medium');

        let steps = 0;
        while (!MetrovilleModule.isGameOver(state) && steps < 300) {
          steps++;
          const curPid = state.phase === 'auction' && state.auction
            ? state.auction.activePlayerIds[state.auction.currentBidderIndex]
            : state.currentTurnPlayerId;

          const action = await bot.chooseAction(state, curPid);
          const val = MetrovilleModule.validateAction(state, action, curPid);
          if (val.valid) {
            state = MetrovilleModule.applyAction(state, action);
          } else {
            // Fallback for simulation progress
            if (state.phase === 'roll') {
              state = MetrovilleModule.applyAction(state, { type: 'ROLL_DICE' });
            } else if (state.phase === 'tile_action') {
              state = MetrovilleModule.applyAction(state, { type: 'DECLINE_BUY_PROPERTY' });
            } else if (state.phase === 'turn_end') {
              state = MetrovilleModule.applyAction(state, { type: 'END_TURN' });
            } else if (state.phase === 'auction') {
              state = MetrovilleModule.applyAction(state, { type: 'PASS_AUCTION' });
            }
          }
        }

        expect(steps).toBeGreaterThan(0);
        gamesCompleted++;
      }
      expect(gamesCompleted).toBe(100);
    }
  });
});
