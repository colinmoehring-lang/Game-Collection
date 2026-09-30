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
import type { EvaluatedHand, PokerAction, PokerConfig, PokerPlayer, PokerState } from './types.js';

export type { EvaluatedHand, PokerAction, PokerConfig, PokerPlayer, PokerStage, PokerState } from './types.js';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['S', 'H', 'D', 'C'];
const RANK_VALUE: Record<string, number> = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 2]));
const HAND_NAMES = ['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];

export const TexasHoldemManifest: GameManifest = {
  id: 'texasholdem',
  name: "Texas Hold'em",
  description: {
    de: 'Der Pokerklassiker: zwei verdeckte Karten, fünf Gemeinschaftskarten und ein gemeinsamer Pot.',
    en: 'The poker classic: two hole cards, five community cards, and a shared pot.'
  },
  minPlayers: 2,
  maxPlayers: 8,
  estimatedDurationMinutes: [15, 60],
  variants: [{ id: 'standard', name: 'Texas Hold’em', description: 'No-Limit Texas Hold’em mit Small Blind 10 und Big Blind 20.' }],
  settings: [
    { id: 'startingChips', name: 'Startchips', type: 'number', default: 1000, min: 100, max: 10000, step: 100 },
    { id: 'smallBlind', name: 'Small Blind', type: 'number', default: 10, min: 1, max: 500, step: 1 },
    { id: 'bigBlind', name: 'Big Blind', type: 'number', default: 20, min: 2, max: 1000, step: 1 }
  ]
};

function cardValue(card: string): number {
  return RANK_VALUE[card[0]] || 0;
}

function compareScores(left: number[], right: number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function evaluateFive(cards: string[]): EvaluatedHand {
  if (cards.length !== 5 || cards.some(card => !RANK_VALUE[card[0]] || !SUITS.includes(card[1]))) {
    throw new Error('A poker hand must contain five valid cards');
  }
  const values = cards.map(cardValue).sort((left, right) => right - left);
  const counts = new Map<number, number>();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  const groups = [...counts.entries()].sort((left, right) => right[1] - left[1] || right[0] - left[0]);
  const distinct = [...counts.keys()].sort((left, right) => right - left);
  const flush = cards.every(card => card[1] === cards[0][1]);
  const straightHigh = distinct.length === 5
    ? distinct[0] - distinct[4] === 4 ? distinct[0]
      : distinct.join(',') === '14,5,4,3,2' ? 5 : 0
    : 0;

  if (flush && straightHigh) return { score: [8, straightHigh], name: HAND_NAMES[8] };
  if (groups[0][1] === 4) return { score: [7, groups[0][0], groups[1][0]], name: HAND_NAMES[7] };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { score: [6, groups[0][0], groups[1][0]], name: HAND_NAMES[6] };
  if (flush) return { score: [5, ...values], name: HAND_NAMES[5] };
  if (straightHigh) return { score: [4, straightHigh], name: HAND_NAMES[4] };
  if (groups[0][1] === 3) return { score: [3, groups[0][0], ...groups.slice(1).map(group => group[0]).sort((a, b) => b - a)], name: HAND_NAMES[3] };
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = groups.slice(0, 2).map(group => group[0]).sort((a, b) => b - a);
    return { score: [2, ...pairs, groups[2][0]], name: HAND_NAMES[2] };
  }
  if (groups[0][1] === 2) return { score: [1, groups[0][0], ...groups.slice(1).map(group => group[0]).sort((a, b) => b - a)], name: HAND_NAMES[1] };
  return { score: [0, ...values], name: HAND_NAMES[0] };
}

function combinations(cards: string[], size: number): string[][] {
  const result: string[][] = [];
  const walk = (start: number, current: string[]) => {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let index = start; index <= cards.length - (size - current.length); index++) {
      current.push(cards[index]);
      walk(index + 1, current);
      current.pop();
    }
  };
  walk(0, []);
  return result;
}

export function evaluateBestHand(cards: string[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) throw new Error('Texas Hold’em hands require five to seven cards');
  return combinations(cards, 5)
    .map(evaluateFive)
    .reduce((best, candidate) => compareScores(candidate.score, best.score) > 0 ? candidate : best);
}

function cloneState(state: PokerState): PokerState {
  return {
    ...state,
    players: state.players.map(player => ({ ...player, hand: [...player.hand] })),
    playerOrder: [...state.playerOrder],
    deck: [...state.deck],
    communityCards: [...state.communityCards],
    handWinner: state.handWinner ? { ...state.handWinner, playerIds: [...state.handWinner.playerIds], names: [...state.handWinner.names] } : null,
    log: [...state.log]
  };
}

function shuffledDeck(state: PokerState): string[] {
  const rng = createRNG(`${state.seed}:${state.randomIndex}`);
  state.randomIndex++;
  const deck = SUITS.flatMap(suit => RANKS.map(rank => `${rank}${suit}`));
  for (let index = deck.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function nextSeat(state: PokerState, start: number, predicate: (player: PokerPlayer) => boolean): number {
  for (let offset = 1; offset <= state.playerOrder.length; offset++) {
    const index = (start + offset) % state.playerOrder.length;
    const player = state.players.find(candidate => candidate.id === state.playerOrder[index]);
    if (player && predicate(player)) return index;
  }
  return -1;
}

function playerAt(state: PokerState, index: number): PokerPlayer | undefined {
  return state.players.find(player => player.id === state.playerOrder[index]);
}

function addLog(state: PokerState, message: string) {
  state.log.push(message);
  if (state.log.length > 30) state.log.shift();
}

function activePlayers(state: PokerState): PokerPlayer[] {
  return state.players.filter(player => player.chips > 0 && !player.folded);
}

function playersInHand(state: PokerState): PokerPlayer[] {
  return state.players.filter(player => !player.folded);
}

function ablePlayers(state: PokerState): PokerPlayer[] {
  return state.players.filter(player => !player.folded && !player.allIn && player.chips > 0);
}

function postBlind(state: PokerState, player: PokerPlayer, amount: number) {
  const paid = Math.min(player.chips, amount);
  player.chips -= paid;
  player.currentBet += paid;
  player.totalCommitted += paid;
  state.pot += paid;
  if (player.chips === 0) player.allIn = true;
}

function dealCommunityCards(state: PokerState, count: number) {
  state.deck.pop();
  for (let index = 0; index < count; index++) {
    const card = state.deck.pop();
    if (card) state.communityCards.push(card);
  }
}

function settlePot(state: PokerState, handName: string, scores: Map<string, number[]> | null) {
  const contributionLevels = [...new Set(state.players.map(player => player.totalCommitted).filter(amount => amount > 0))].sort((a, b) => a - b);
  let previousLevel = 0;
  const winnings = new Map<string, number>();

  for (const level of contributionLevels) {
    const contributors = state.players.filter(player => player.totalCommitted >= level);
    const amount = (level - previousLevel) * contributors.length;
    previousLevel = level;
    const eligible = contributors.filter(player => !player.folded);
    if (eligible.length === 0) continue;
    let winners = eligible;
    if (scores) {
      const best = eligible.map(player => scores.get(player.id) || []).reduce((current, score) => compareScores(score, current) > 0 ? score : current, [] as number[]);
      winners = eligible.filter(player => compareScores(scores.get(player.id) || [], best) === 0);
    }
    const orderedWinners = winners.sort((left, right) => state.playerOrder.indexOf(left.id) - state.playerOrder.indexOf(right.id));
    const share = Math.floor(amount / orderedWinners.length);
    let remainder = amount % orderedWinners.length;
    orderedWinners.forEach(player => {
      winnings.set(player.id, (winnings.get(player.id) || 0) + share + (remainder > 0 ? 1 : 0));
      if (remainder > 0) remainder--;
    });
  }

  winnings.forEach((amount, playerId) => {
    const player = state.players.find(candidate => candidate.id === playerId);
    if (player) player.chips += amount;
  });
  const winnerIds = [...winnings.keys()];
  const winners = winnerIds.map(id => state.players.find(player => player.id === id)).filter((player): player is PokerPlayer => Boolean(player));
  const potAmount = state.pot;
  state.handWinner = {
    playerIds: winnerIds,
    names: winners.map(player => player.name),
    handName,
    amount: potAmount
  };
  state.pot = 0;
  state.stage = state.players.filter(player => player.chips > 0).length <= 1 ? 'gameover' : 'hand_over';
  state.currentTurnPlayerId = '';
  addLog(state, `${winners.map(player => player.name).join(', ')} gewinnt ${potAmount} Chips mit ${handName}.`);
}

function showDown(state: PokerState) {
  state.showdown = true;
  const eligible = playersInHand(state);
  const scores = new Map(eligible.map(player => [player.id, evaluateBestHand([...player.hand, ...state.communityCards]).score]));
  const best = eligible.map(player => scores.get(player.id) || []).reduce((current, score) => compareScores(score, current) > 0 ? score : current, [] as number[]);
  const bestPlayer = eligible.find(player => compareScores(scores.get(player.id) || [], best) === 0);
  settlePot(state, bestPlayer ? evaluateBestHand([...bestPlayer.hand, ...state.communityCards]).name : 'High Card', scores);
}

function finishByFolds(state: PokerState) {
  const winner = playersInHand(state)[0];
  if (winner) settlePot(state, 'Alle anderen passen', null);
}

function roundComplete(state: PokerState): boolean {
  const actors = ablePlayers(state);
  return actors.length === 0 || actors.every(player => player.actedThisRound && player.currentBet === state.currentBet);
}

function runOutBoard(state: PokerState) {
  if (state.communityCards.length < 5) dealCommunityCards(state, 5 - state.communityCards.length);
  showDown(state);
}

function advanceStreet(state: PokerState) {
  for (const player of state.players) {
    player.currentBet = 0;
    player.actedThisRound = false;
    player.raiseLocked = false;
  }
  state.currentBet = 0;
  state.minRaise = state.bigBlind;

  if (state.stage === 'preflop') {
    state.stage = 'flop';
    dealCommunityCards(state, 3);
  } else if (state.stage === 'flop') {
    state.stage = 'turn';
    dealCommunityCards(state, 1);
  } else if (state.stage === 'turn') {
    state.stage = 'river';
    dealCommunityCards(state, 1);
  } else {
    showDown(state);
    return;
  }

  if (ablePlayers(state).length <= 1) {
    runOutBoard(state);
    return;
  }
  state.currentTurnPlayerId = playerAt(state, nextSeat(state, state.dealerIndex, player => !player.folded && !player.allIn && player.chips > 0))?.id || '';
}

function startHand(state: PokerState, rotateDealer: boolean) {
  if (rotateDealer) {
    const nextDealer = nextSeat(state, state.dealerIndex, player => player.chips > 0);
    if (nextDealer !== -1) state.dealerIndex = nextDealer;
  }
  state.handNumber++;
  state.deck = shuffledDeck(state);
  state.communityCards = [];
  state.pot = 0;
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.handWinner = null;
  state.showdown = false;
  state.stage = 'preflop';

  state.players.forEach(player => {
    player.hand = [];
    player.folded = player.chips <= 0;
    player.allIn = false;
    player.currentBet = 0;
    player.totalCommitted = 0;
    player.actedThisRound = false;
    player.raiseLocked = false;
  });

  const active = activePlayers(state);
  if (active.length <= 1) {
    state.stage = 'gameover';
    state.currentTurnPlayerId = '';
    return;
  }
  for (let round = 0; round < 2; round++) {
    for (let offset = 0; offset < state.playerOrder.length; offset++) {
      const player = playerAt(state, (state.dealerIndex + offset) % state.playerOrder.length);
      if (player && !player.folded) {
        const card = state.deck.pop();
        if (card) player.hand.push(card);
      }
    }
  }

  const smallBlindIndex = active.length === 2
    ? state.dealerIndex
    : nextSeat(state, state.dealerIndex, player => !player.folded);
  const bigBlindIndex = nextSeat(state, smallBlindIndex, player => !player.folded);
  const smallBlindPlayer = playerAt(state, smallBlindIndex);
  const bigBlindPlayer = playerAt(state, bigBlindIndex);
  if (!smallBlindPlayer || !bigBlindPlayer) {
    state.stage = 'gameover';
    return;
  }
  postBlind(state, smallBlindPlayer, state.smallBlind);
  postBlind(state, bigBlindPlayer, state.bigBlind);
  state.currentBet = bigBlindPlayer.currentBet;
  state.currentTurnPlayerId = playerAt(state, nextSeat(state, bigBlindIndex, player => !player.folded && !player.allIn && player.chips > 0))?.id || '';
  addLog(state, `Hand ${state.handNumber}: ${smallBlindPlayer.name} Small Blind ${smallBlindPlayer.currentBet}, ${bigBlindPlayer.name} Big Blind ${bigBlindPlayer.currentBet}.`);
}

function reduceAction(state: PokerState, action: PokerAction): PokerState {
  const next = cloneState(state);
  if (action.type === 'NEXT_HAND') {
    startHand(next, true);
    return next;
  }
  const player = next.players.find(candidate => candidate.id === next.currentTurnPlayerId);
  if (!player) return state;
  const toCall = Math.max(0, next.currentBet - player.currentBet);

  if (action.type === 'FOLD') {
    player.folded = true;
    addLog(next, `${player.name} passt.`);
  } else if (action.type === 'CHECK') {
    player.actedThisRound = true;
    player.raiseLocked = true;
    addLog(next, `${player.name} checkt.`);
  } else if (action.type === 'CALL') {
    const paid = Math.min(player.chips, toCall);
    player.chips -= paid;
    player.currentBet += paid;
    player.totalCommitted += paid;
    next.pot += paid;
    player.allIn = player.chips === 0;
    player.actedThisRound = true;
    player.raiseLocked = true;
    addLog(next, `${player.name} callt ${paid}.`);
  } else if (action.type === 'ALL_IN') {
    const previousBet = next.currentBet;
    const paid = player.chips;
    player.chips = 0;
    player.currentBet += paid;
    player.totalCommitted += paid;
    next.pot += paid;
    player.allIn = true;
    player.actedThisRound = true;
    player.raiseLocked = true;
    if (player.currentBet > previousBet) {
      const raiseSize = player.currentBet - previousBet;
      next.currentBet = player.currentBet;
      if (raiseSize >= next.minRaise) {
        next.minRaise = raiseSize;
        next.players.filter(candidate => candidate.id !== player.id && !candidate.folded && !candidate.allIn).forEach(candidate => {
          candidate.actedThisRound = false;
          candidate.raiseLocked = false;
        });
      }
    }
    addLog(next, `${player.name} geht All-in.`);
  } else if (action.type === 'RAISE') {
    const minTarget = next.currentBet + next.minRaise;
    const maxTarget = player.currentBet + player.chips;
    const target = action.raiseTo;
    if (!Number.isInteger(target) || target < minTarget || target > maxTarget || player.raiseLocked) return state;
    const paid = target - player.currentBet;
    const raiseSize = target - next.currentBet;
    player.chips -= paid;
    player.currentBet = target;
    player.totalCommitted += paid;
    next.pot += paid;
    player.allIn = player.chips === 0;
    player.actedThisRound = true;
    player.raiseLocked = true;
    next.currentBet = target;
    next.minRaise = raiseSize;
    next.players.filter(candidate => candidate.id !== player.id && !candidate.folded && !candidate.allIn).forEach(candidate => {
      candidate.actedThisRound = false;
      candidate.raiseLocked = false;
    });
    addLog(next, `${player.name} erhöht auf ${target}.`);
  }

  const remaining = playersInHand(next);
  if (remaining.length <= 1) {
    finishByFolds(next);
    return next;
  }
  if (roundComplete(next)) {
    advanceStreet(next);
    return next;
  }
  const actorIndex = next.playerOrder.indexOf(player.id);
  next.currentTurnPlayerId = playerAt(next, nextSeat(next, actorIndex, candidate => !candidate.folded && !candidate.allIn && candidate.chips > 0))?.id || '';
  if (!next.currentTurnPlayerId) advanceStreet(next);
  return next;
}

export class TexasHoldemBot implements BotStrategy<PokerState, PokerAction> {
  constructor(private difficulty: BotDifficulty = 'medium') {}

  chooseAction(state: PokerState, playerId: string): PokerAction {
    if (state.stage === 'hand_over') return { type: 'NEXT_HAND' };
    const player = state.players.find(candidate => candidate.id === playerId);
    if (!player) return { type: 'CHECK' };
    const callAmount = Math.max(0, state.currentBet - player.currentBet);
    const handStrength = state.communityCards.length >= 3
      ? evaluateBestHand([...player.hand, ...state.communityCards]).score[0]
      : (cardValue(player.hand[0]) === cardValue(player.hand[1]) ? 3 : 0)
        + (Math.max(cardValue(player.hand[0]), cardValue(player.hand[1])) >= 12 ? 2 : 0)
        + (player.hand[0]?.[1] === player.hand[1]?.[1] ? 1 : 0);
    if (callAmount === 0) {
      if (this.difficulty !== 'easy' && handStrength >= 5 && !player.raiseLocked && player.chips >= state.minRaise) {
        return { type: 'RAISE', raiseTo: state.currentBet + state.minRaise };
      }
      return { type: 'CHECK' };
    }
    if (handStrength < 2 && callAmount > state.pot / 2) return { type: 'FOLD' };
    if (callAmount >= player.chips && handStrength >= 6) return { type: 'ALL_IN' };
    return { type: 'CALL' };
  }
}

export const TexasHoldemModule: GameModule<PokerState, PokerAction, Partial<PokerConfig>> = {
  manifest: TexasHoldemManifest,

  createInitialState(config, players, seed): PokerState {
    if (players.length < TexasHoldemManifest.minPlayers || players.length > TexasHoldemManifest.maxPlayers) {
      throw new Error(`Texas Hold’em requires ${TexasHoldemManifest.minPlayers}-${TexasHoldemManifest.maxPlayers} players`);
    }
    const smallBlind = Math.max(1, Math.floor(config.smallBlind ?? 10));
    const bigBlind = Math.max(smallBlind + 1, Math.floor(config.bigBlind ?? 20));
    const state: PokerState = {
      seed: seed || 'texasholdem-default',
      randomIndex: 0,
      players: players.map(player => ({
        ...player,
        chips: Math.max(bigBlind, Math.floor(config.startingChips ?? 1000)),
        hand: [],
        folded: false,
        allIn: false,
        currentBet: 0,
        totalCommitted: 0,
        actedThisRound: false,
        raiseLocked: false
      })),
      playerOrder: players.map(player => player.id),
      currentTurnPlayerId: '',
      dealerIndex: 0,
      smallBlind,
      bigBlind,
      stage: 'preflop',
      handNumber: 0,
      showdown: false,
      deck: [],
      communityCards: [],
      pot: 0,
      currentBet: 0,
      minRaise: bigBlind,
      handWinner: null,
      log: []
    };
    startHand(state, false);
    return state;
  },

  validateAction(state, action, playerId): ValidationResult {
    const player = state.players.find(candidate => candidate.id === playerId);
    if (!player) return { valid: false, error: 'Spieler nicht gefunden' };
    if (action.type === 'NEXT_HAND') {
      return state.stage === 'hand_over' && player.chips > 0
        ? { valid: true }
        : { valid: false, error: 'Keine neue Hand möglich' };
    }
    if (state.stage !== 'preflop' && state.stage !== 'flop' && state.stage !== 'turn' && state.stage !== 'river') {
      return { valid: false, error: 'Diese Hand ist beendet' };
    }
    if (state.currentTurnPlayerId !== playerId) return { valid: false, error: 'Du bist nicht am Zug' };
    if (player.folded || player.allIn) return { valid: false, error: 'Du kannst nicht mehr setzen' };
    const toCall = Math.max(0, state.currentBet - player.currentBet);
    if (action.type === 'CHECK' && toCall > 0) return { valid: false, error: 'Checken ist bei offenem Einsatz nicht möglich' };
    if (action.type === 'CALL' && toCall === 0) return { valid: false, error: 'Es gibt keinen Einsatz zu bezahlen' };
    if (action.type === 'RAISE') {
      if (player.raiseLocked) return { valid: false, error: 'Eine Erhöhung ist nach deiner Aktion nicht erneut möglich' };
      const minTarget = state.currentBet + state.minRaise;
      const maxTarget = player.currentBet + player.chips;
      if (!Number.isInteger(action.raiseTo) || action.raiseTo < minTarget || action.raiseTo > maxTarget) {
        return { valid: false, error: `Erhöhung muss zwischen ${minTarget} und ${maxTarget} liegen` };
      }
    }
    return { valid: true };
  },

  applyAction(state, action): PokerState {
    if (action.type === 'NEXT_HAND') {
      const next = cloneState(state);
      startHand(next, true);
      return next;
    }
    return reduceAction(state, action);
  },

  getPlayerView(state, playerId) {
    const view = cloneState(state);
    view.deck = [];
    view.seed = '';
    view.randomIndex = 0;
    if (!state.showdown) {
      view.players.forEach(player => {
        if (player.id !== playerId) player.hand = [];
      });
    }
    return view;
  },

  isGameOver(state): boolean {
    return state.stage === 'gameover' || state.players.filter(player => player.chips > 0).length <= 1;
  },

  computeResult(state): GameResult {
    const winner = activePlayers(state)[0];
    return winner ? { winnerId: winner.id, reason: `${winner.name} gewinnt das Turnier.` } : { winnerId: null, reason: 'Kein Spieler hat Chips.' };
  },

  createBot(difficulty = 'medium') {
    return new TexasHoldemBot(difficulty);
  }
};