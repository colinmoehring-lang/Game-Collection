import type {
  GameManifest,
  GameModule,
  Player,
  ValidationResult,
  GameResult,
  BotStrategy,
  BotDifficulty
} from '@metroville/game-sdk';
import { shuffleArray, createRNG } from '@metroville/game-sdk';
import type {
  MetrovilleState,
  MetrovilleAction,
  MetrovilleConfigInput,
  MetrovilleMechanics,
  MetrovillePlayer,
  PropertyState,
  TradeOffer,
  AuctionState
} from './types.js';
import { METROVILLE_PRESET_MECHANICS, METROVILLE_RULE_DEFAULTS } from './types.js';
import { METROVILLE_FIELDS, DISTRICT_MAP } from './board.js';
import { EXPRESS_CARDS, STADTRAT_CARDS, ALL_CARDS_MAP } from './cards.js';
import { addToCityParkJackpot, grantGoPassSalary } from './economy.js';
export { remapMetrovillePlayerId } from './state.js';
export { METROVILLE_RULE_DEFAULTS } from './types.js';
export { METROVILLE_PRESET_MECHANICS } from './types.js';
export type {
  MetrovilleConfig,
  MetrovilleConfigInput,
  MetrovilleMechanics,
  MetrovilleState,
  PropertyLease,
  TradeOffer
} from './types.js';

export const MetrovilleManifest: GameManifest = {
  id: 'metroville',
  name: 'MetroVille: City of Fortune',
  description: {
    de: 'Retrofuturistisches Wirtschafts- und Immobilienspiel der 1960er Jahre. Errichte Wohnblöcke und Wolkenkratzer!',
    en: 'Retrofuturistic 1960s real estate trading game. Build residential blocks and skyscrapers!'
  },
  minPlayers: 2,
  maxPlayers: 6,
  estimatedDurationMinutes: [20, 60],
  coverArtwork: '/games/metroville-cover.png',
  variants: [
    {
      id: 'blitz',
      name: 'Blitz-Modus (Schnell)',
      description: 'Startkapital 1000 Taler, 3 zufällige Grundstücke zu Spielbeginn, Limit von 40 Spielerzügen.'
    },
    {
      id: 'standard',
      name: 'Standard MetroVille',
      description: 'Startkapital 1500 Taler, klassischer Aufbau mit allen Quartieren.'
    },
    {
      id: 'classic_light',
      name: 'Klassisch Light',
      description: 'Startkapital 1200 Taler, keine Auktionen bei Kaufverzicht.'
    }
  ],
  settings: [
    {
      id: 'startingMoney',
      name: 'Startkapital',
      type: 'number',
      default: 1500,
      min: 500,
      max: 3000,
      step: 100
    }
  ]
};

export { METROVILLE_FIELDS, DISTRICT_MAP } from './board.js';

const BOT_TRADE_DISTRICT_BONUS_RATE = 0.75;
const BOT_TRADE_OFFER_PREMIUM = 10;
const BOT_TRADE_THRESHOLDS = {
  easy: { reserve: 250, minimumGainRate: 0.5 },
  medium: { reserve: 150, minimumGainRate: 0.2 },
  hard: { reserve: 100, minimumGainRate: 0.05 }
} as const;

function portfolioValue(
  state: MetrovilleState,
  playerId: string,
  propertyOwners: Map<number, string | null>
): number {
  let value = 0;
  for (const [index, property] of Object.entries(state.properties)) {
    if (propertyOwners.get(Number(index)) !== playerId) continue;
    const field = METROVILLE_FIELDS[Number(index)];
    if (!field?.cost) continue;
    value += field.cost
      - (property.isMortgaged ? Math.round(field.cost * 0.5) : 0)
      + property.houses * Math.floor((field.houseCost || 0) / 2);
  }

  for (const indices of Object.values(DISTRICT_MAP)) {
    if (indices.length === 0 || METROVILLE_FIELDS[indices[0]]?.type !== 'property') continue;
    if (indices.every(index => propertyOwners.get(index) === playerId)) {
      const districtCost = indices.reduce((sum, index) => sum + (METROVILLE_FIELDS[index].cost || 0), 0);
      value += Math.floor(districtCost * BOT_TRADE_DISTRICT_BONUS_RATE);
    }
  }
  return value;
}

function tradeAssetValueForPlayer(state: MetrovilleState, trade: TradeOffer, playerId: string): number {
  const ownersBefore = new Map<number, string | null>(
    Object.entries(state.properties).map(([index, property]) => [Number(index), property.ownerId])
  );
  const ownersAfter = new Map(ownersBefore);
  (trade.offeredPropertyIndices || [])
    .filter(index => !(trade.offeredLeasePropertyIndices || []).includes(index))
    .forEach(index => ownersAfter.set(index, trade.toPlayerId));
  (trade.requestedPropertyIndices || [])
    .filter(index => !(trade.requestedLeasePropertyIndices || []).includes(index))
    .forEach(index => ownersAfter.set(index, trade.fromPlayerId));

  const cashDelta = playerId === trade.toPlayerId
    ? trade.offeredMoney - trade.requestedMoney
    : playerId === trade.fromPlayerId
      ? trade.requestedMoney - trade.offeredMoney
      : 0;
  return portfolioValue(state, playerId, ownersAfter)
    - portfolioValue(state, playerId, ownersBefore)
    + cashDelta;
}

function tradeAcceptanceError(state: MetrovilleState, trade: TradeOffer, playerId: string): string | null {
  const offerer = state.players.find(candidate => candidate.id === trade.fromPlayerId);
  const recipient = state.players.find(candidate => candidate.id === playerId);
  if (!offerer || offerer.bankrupt || !recipient || recipient.bankrupt) {
    return 'Ein Handelspartner ist nicht mehr im Spiel';
  }
  if (!trade.offeredPropertyIndices.every(index => state.properties[index]?.ownerId === offerer.id)
    || !trade.requestedPropertyIndices.every(index => state.properties[index]?.ownerId === recipient.id)) {
    return 'Ein angebotenes Grundstück hat inzwischen einen anderen Besitzer';
  }
  if (offerer.money + trade.requestedMoney < trade.offeredMoney
    || recipient.money + trade.offeredMoney < trade.requestedMoney) {
    return 'Das Angebot ist nicht mehr finanzierbar';
  }
  const leasedIndices = [
    ...(trade.offeredLeasePropertyIndices || []),
    ...(trade.requestedLeasePropertyIndices || [])
  ];
  if (leasedIndices.some(index => state.leases[index] || state.properties[index]?.isMortgaged)) {
    return 'Ein Grundstück aus dem Pachtangebot ist nicht mehr verfügbar';
  }
  return null;
}

function makeBotTradeOffer(
  state: MetrovilleState,
  playerId: string,
  difficulty: BotDifficulty
): MetrovilleAction | null {
  if (!state.config.mechanics.botTrading || state.pendingTrade) return null;
  if (state.botTradeOfferRounds[playerId] === state.roundCount) return null;
  const bot = state.players.find(player => player.id === playerId);
  if (!bot?.isBot || bot.bankrupt) return null;

  const threshold = BOT_TRADE_THRESHOLDS[difficulty];
  let best: { action: MetrovilleAction; score: number } | null = null;
  const botOwned = new Set(Object.entries(state.properties)
    .filter(([, property]) => property.ownerId === playerId)
    .map(([index]) => Number(index)));

  for (const target of state.players) {
    if (target.id === playerId || target.bankrupt) continue;
    for (const districtIndices of Object.values(DISTRICT_MAP)) {
      if (districtIndices.length === 0 || METROVILLE_FIELDS[districtIndices[0]]?.type !== 'property') continue;
      const botDistrictProperties = districtIndices.filter(index => botOwned.has(index));
      if (botDistrictProperties.length !== districtIndices.length - 1) continue;
      const requestedIndex = districtIndices.find(index => state.properties[index]?.ownerId === target.id);
      if (requestedIndex === undefined) continue;
      const requestedProperty = state.properties[requestedIndex];
      if (!requestedProperty || requestedProperty.isMortgaged || requestedProperty.houses > 0
        || state.leases[requestedIndex]) continue;

      const offeredPropertyOptions: number[][] = [[]];
      for (const offeredIndex of [...botOwned].sort((left, right) => left - right)) {
        const property = state.properties[offeredIndex];
        if (!property || property.isMortgaged || property.houses > 0 || state.leases[offeredIndex]) continue;
        if (offeredIndex !== requestedIndex) offeredPropertyOptions.push([offeredIndex]);
      }

      for (const offeredPropertyIndices of offeredPropertyOptions) {
        const offer: TradeOffer = {
          id: '',
          fromPlayerId: playerId,
          toPlayerId: target.id,
          offeredMoney: 0,
          offeredPropertyIndices,
          requestedMoney: 0,
          requestedPropertyIndices: [requestedIndex]
        };
        const targetAssetDelta = tradeAssetValueForPlayer(state, offer, target.id);
        const botAssetDelta = tradeAssetValueForPlayer(state, offer, playerId);
        const requestedCost = METROVILLE_FIELDS[requestedIndex].cost || 0;
        const requiredPremium = Math.max(
          BOT_TRADE_OFFER_PREMIUM,
          Math.ceil(requestedCost * 0.05 / 10) * 10
        );
        const offeredMoney = Math.ceil(Math.max(0, requiredPremium - targetAssetDelta) / 10) * 10;
        const botGain = botAssetDelta - offeredMoney;
        if (bot.money - offeredMoney < threshold.reserve
          || botGain < requestedCost * threshold.minimumGainRate) continue;

        offer.offeredMoney = offeredMoney;
        const action: MetrovilleAction = {
          type: 'OFFER_TRADE',
          offer: {
            fromPlayerId: offer.fromPlayerId,
            toPlayerId: offer.toPlayerId,
            offeredMoney: offer.offeredMoney,
            offeredPropertyIndices: offer.offeredPropertyIndices,
            requestedMoney: offer.requestedMoney,
            requestedPropertyIndices: offer.requestedPropertyIndices
          }
        };
        const score = botGain + targetAssetDelta;
        if (!best || score > best.score) best = { action, score };
      }
    }
  }
  return best?.action || null;
}

export function calculateRent(fieldIndex: number, state: MetrovilleState): number {
  const field = METROVILLE_FIELDS[fieldIndex];
  const prop = state.properties[fieldIndex];
  if (!field || !prop || !prop.ownerId || prop.isMortgaged) return 0;

  if (field.type === 'station') {
    // 25 * 2^(stations owned - 1)
    const ownerStations = DISTRICT_MAP.station.filter(idx => state.properties[idx]?.ownerId === prop.ownerId);
    return (field.baseRent || 25) * Math.pow(2, ownerStations.length - 1);
  }

  if (field.type === 'utility') {
    // 4x or 10x dice roll
    const ownerUtilities = DISTRICT_MAP.utility.filter(idx => state.properties[idx]?.ownerId === prop.ownerId);
    const diceSum = state.dice[0] + state.dice[1] || 7;
    return ownerUtilities.length > 1 ? diceSum * 10 : diceSum * 4;
  }

  if (field.type === 'property' && field.rents) {
    if (prop.houses > 0) {
      return field.rents[prop.houses] || field.rents[0];
    }
    // Check if full district owned -> double base rent
    if (field.district) {
      const districtFields = DISTRICT_MAP[field.district] || [];
      const ownsAll = districtFields.every(idx => state.properties[idx]?.ownerId === prop.ownerId);
      return ownsAll ? (field.baseRent || 10) * 2 : (field.baseRent || 10);
    }
    return field.baseRent || 10;
  }

  return 0;
}

export class MetrovilleBot implements BotStrategy<MetrovilleState, MetrovilleAction> {
  constructor(private difficulty: BotDifficulty = 'medium') {}

  chooseAction(state: MetrovilleState, playerId: string): MetrovilleAction {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return { type: 'END_TURN' };
    if (player.bankrupt) return { type: 'END_TURN' };

    if (state.pendingTrade?.toPlayerId === playerId) {
      const acceptanceError = tradeAcceptanceError(state, state.pendingTrade, playerId);
      if ((state.pendingTrade.offeredLeasePropertyIndices?.length || 0) > 0
        || (state.pendingTrade.requestedLeasePropertyIndices?.length || 0) > 0
        || acceptanceError
        || tradeAssetValueForPlayer(state, state.pendingTrade, playerId) < 0) {
        return { type: 'DECLINE_TRADE', tradeId: state.pendingTrade.id };
      }
      return { type: 'ACCEPT_TRADE', tradeId: state.pendingTrade.id };
    }

    if (state.phase === 'card_reveal') {
      return { type: 'DISMISS_CARD' };
    }

    // In Jail — only escape actions during roll; after a failed attempt the turn must end.
    if (player.inJail) {
      if (state.phase === 'turn_end') {
        return { type: 'END_TURN' };
      }
      if (state.phase === 'roll') {
        if (player.getOutOfJailCards > 0) return { type: 'USE_JAIL_CARD' };
        if (player.money >= 50 && player.jailTurns >= 2) return { type: 'PAY_JAIL_FINE' };
        return { type: 'ROLL_DICE' };
      }
    }

    // Roll Phase
    if (state.phase === 'roll') {
      return { type: 'ROLL_DICE' };
    }

    // Tile Action Phase (Opportunity to buy property)
    if (state.phase === 'tile_action') {
      const field = METROVILLE_FIELDS[player.position];
      if (field && (field.type === 'property' || field.type === 'station' || field.type === 'utility')) {
        const prop = state.properties[player.position];
        if (prop && prop.ownerId === null && field.cost) {
          // Buy if we have a buffer remaining
          const reserve = this.difficulty === 'hard' ? 200 : 100;
          if (player.money >= field.cost + reserve) {
            return { type: 'BUY_PROPERTY' };
          } else {
            return { type: 'DECLINE_BUY_PROPERTY' };
          }
        }
      }
      return { type: 'END_TURN' };
    }

    // Turn End Phase
    if (state.phase === 'turn_end') {
      // Check for house building opportunities if medium/hard
      if (this.difficulty !== 'easy' && player.money > 300) {
        for (const [idxStr, prop] of Object.entries(state.properties)) {
          const idx = Number(idxStr);
          const field = METROVILLE_FIELDS[idx];
          if (prop.ownerId === playerId && field.type === 'property' && prop.houses < 5 && field.houseCost && player.money >= field.houseCost + 200) {
            if (field.district) {
              const districtFields = DISTRICT_MAP[field.district] || [];
              const ownsAll = districtFields.every(fidx => state.properties[fidx]?.ownerId === playerId);
              if (ownsAll) {
                const buildAction: MetrovilleAction = { type: 'BUILD_HOUSE', propertyIndex: idx };
                if (MetrovilleModule.validateAction(state, buildAction, playerId).valid) {
                  return buildAction;
                }
              }
            }
          }
        }
      }
      const tradeOffer = makeBotTradeOffer(state, playerId, this.difficulty);
      if (tradeOffer) return tradeOffer;
      return { type: 'END_TURN' };
    }

    // Auction Phase
    if (state.phase === 'auction' && state.auction) {
      const field = METROVILLE_FIELDS[state.auction.propertyIndex];
      if (!field?.cost) return { type: 'PASS_AUCTION' };

      let valueMultiplier = 1.25;
      if (field.district) {
        const districtFields = DISTRICT_MAP[field.district];
        const ownedCount = districtFields.filter(index => state.properties[index]?.ownerId === playerId).length;
        if (ownedCount === districtFields.length - 1) valueMultiplier = 1.8;
        else if (ownedCount > 0) valueMultiplier = 1.45;
      } else if (field.type === 'station' || field.type === 'utility') {
        const collection = DISTRICT_MAP[field.type];
        const ownedCount = collection.filter(index => state.properties[index]?.ownerId === playerId).length;
        valueMultiplier += Math.min(0.25, ownedCount * 0.08);
      }

      const propertyLimit = Math.floor(field.cost * valueMultiplier / 10) * 10;
      const reserve = this.difficulty === 'hard' ? 200 : 100;
      const affordableLimit = Math.max(0, player.money - reserve);
      const maxBid = Math.min(propertyLimit, affordableLimit);
      const nextBid = state.auction.highestBid + 10;
      if (nextBid <= maxBid) return { type: 'BID_AUCTION', bidAmount: nextBid };
      return { type: 'PASS_AUCTION' };
    }

    return { type: 'END_TURN' };
  }
}

export const MetrovilleModule: GameModule<MetrovilleState, MetrovilleAction, MetrovilleConfigInput> = {
  manifest: MetrovilleManifest,

  createInitialState(config, players, seed): MetrovilleState {
    const initialSeed = seed || 'metroville-default';
    const rng = createRNG(initialSeed);

    const preset = config.preset || 'standard';
    const defaultStartingMoney = preset === 'blitz' ? 1000 : preset === 'classic_light' ? 1200 : 1500;
    const startingMoney = config.startingMoney ?? defaultStartingMoney;
    const configuredTaxMultiplier = config.taxMultiplier ?? METROVILLE_RULE_DEFAULTS.taxMultiplier;
    const mechanics: MetrovilleMechanics = {
      ...METROVILLE_PRESET_MECHANICS[preset],
      ...config.mechanics
    };

    const metrovillePlayers: MetrovillePlayer[] = players.map(p => ({
      ...p,
      money: startingMoney,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      bankrupt: false
    }));

    const properties: Record<number, PropertyState> = {};
    METROVILLE_FIELDS.forEach(f => {
      if (f.type === 'property' || f.type === 'station' || f.type === 'utility') {
        properties[f.index] = {
          ownerId: null,
          houses: 0,
          isMortgaged: false
        };
      }
    });

    const chanceDeck = shuffleArray(EXPRESS_CARDS.map(c => c.id), rng);
    const communityDeck = shuffleArray(STADTRAT_CARDS.map(c => c.id), rng);

    const state: MetrovilleState = {
      config: {
        preset,
        startingMoney,
        turnLimit: config.turnLimit ?? (preset === 'blitz' ? 40 : undefined),
        cityParkJackpotCap: Math.max(0, Math.floor(config.cityParkJackpotCap ?? METROVILLE_RULE_DEFAULTS.cityParkJackpotCap)),
        lowestWealthBonusAmount: Math.max(0, Math.floor(config.lowestWealthBonusAmount ?? METROVILLE_RULE_DEFAULTS.lowestWealthBonusAmount)),
        leaseDurationRounds: Math.max(1, Math.floor(config.leaseDurationRounds ?? METROVILLE_RULE_DEFAULTS.leaseDurationRounds)),
        goPassSalary: Math.max(0, Math.floor(config.goPassSalary ?? METROVILLE_RULE_DEFAULTS.goPassSalary)),
        taxMultiplier: Number.isFinite(configuredTaxMultiplier)
          ? Math.max(0, configuredTaxMultiplier)
          : METROVILLE_RULE_DEFAULTS.taxMultiplier,
        mechanics
      },
      seed: initialSeed,
      randomIndex: 0,
      turnCount: 0,
      roundCount: 0,
      playersActedThisRound: [],
      tradeSequence: 0,
      players: metrovillePlayers,
      playerOrder: metrovillePlayers.map(p => p.id),
      currentTurnPlayerId: metrovillePlayers[0]?.id || '',
      lastRollerId: null,
      dice: [1, 1],
      doublesRolledCount: 0,
      hasRolled: false,
      botTradeOfferRounds: {},
      phase: 'roll',
      properties,
      cityParkJackpot: 0,
      leases: {},
      chanceDeck,
      communityDeck,
      lastDrawnCard: null,
      pendingCard: null,
      auction: null,
      pendingTrade: null,
      winnerId: null,
      log: ['Willkommen in MetroVille! Das Spiel beginnt.']
    };

    // Blitz mode gives 3 random properties to each player initially
    if (preset === 'blitz') {
      const buyableIndices = Object.keys(properties).map(Number);
      const shuffledBuyables = shuffleArray(buyableIndices, rng);
      let assignIdx = 0;
      metrovillePlayers.forEach(p => {
        for (let i = 0; i < 3 && assignIdx < shuffledBuyables.length; i++) {
          const propIndex = shuffledBuyables[assignIdx++];
          properties[propIndex].ownerId = p.id;
        }
      });
    }

    return state;
  },

  validateAction(state, action, playerId): ValidationResult {
    if (state.phase === 'gameover' || state.winnerId) {
      return { valid: false, error: 'Spiel ist beendet' };
    }

    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, error: 'Ungültiger oder bankrotter Spieler' };
    }
    if (player.bankrupt && !(action.type === 'END_TURN' && state.phase === 'turn_end' && state.currentTurnPlayerId === playerId)) {
      return { valid: false, error: 'Ungültiger oder bankrotter Spieler' };
    }

    if (action.type === 'BID_AUCTION' || action.type === 'PASS_AUCTION') {
      if (state.phase !== 'auction' || !state.auction) {
        return { valid: false, error: 'Keine Auktion aktiv' };
      }
      const expectedBidderId = state.auction.activePlayerIds[state.auction.currentBidderIndex];
      if (expectedBidderId !== playerId) {
        return { valid: false, error: 'Du bist nicht an der Reihe beim Bieten' };
      }
      if (action.type === 'BID_AUCTION') {
        if (!Number.isInteger(action.bidAmount) || action.bidAmount < 10) {
          return { valid: false, error: 'Mindestgebot beträgt 10 Taler' };
        }
        if (action.bidAmount <= state.auction.highestBid) {
          return { valid: false, error: 'Gebot muss höher als das aktuelle Höchstgebot sein' };
        }
        if (action.bidAmount > player.money) {
          return { valid: false, error: 'Nicht genug Taler für dieses Gebot' };
        }
      }
      return { valid: true };
    }

    if (action.type === 'ACCEPT_TRADE' || action.type === 'DECLINE_TRADE') {
      if (!state.pendingTrade || state.pendingTrade.toPlayerId !== playerId || state.pendingTrade.id !== action.tradeId) {
        return { valid: false, error: 'Kein Angebot für dich vorhanden' };
      }
      if (action.type === 'ACCEPT_TRADE') {
        const acceptanceError = tradeAcceptanceError(state, state.pendingTrade, playerId);
        if (acceptanceError) return { valid: false, error: acceptanceError };
      }
      return { valid: true };
    }

    if (action.type === 'OFFER_TRADE') {
      const offer = action.offer;
      const target = state.players.find(candidate => candidate.id === offer.toPlayerId);
      const offeredProperties = [...new Set(offer.offeredPropertyIndices)];
      const requestedProperties = [...new Set(offer.requestedPropertyIndices)];
      const offeredLeases = offer.offeredLeasePropertyIndices || [];
      const requestedLeases = offer.requestedLeasePropertyIndices || [];
      if (state.pendingTrade) return { valid: false, error: 'Es ist bereits ein Angebot offen' };
      if (state.phase !== 'turn_end' || offer.fromPlayerId !== playerId || !target || target.bankrupt || target.id === playerId) {
        return { valid: false, error: 'Handel in dieser Situation nicht möglich' };
      }
      if (player.isBot && !state.config.mechanics.botTrading) {
        return { valid: false, error: 'Bot-Handel ist deaktiviert' };
      }
      if (player.isBot && state.botTradeOfferRounds[playerId] === state.roundCount) {
        return { valid: false, error: 'Der Bot hat in dieser Runde bereits ein Angebot gemacht' };
      }
      if (offer.offeredMoney < 0 || offer.requestedMoney < 0 || offer.offeredMoney > player.money) {
        return { valid: false, error: 'Ungültiger Geldbetrag im Angebot' };
      }
      if (offeredProperties.length !== offer.offeredPropertyIndices.length || requestedProperties.length !== offer.requestedPropertyIndices.length) {
        return { valid: false, error: 'Grundstücke dürfen nicht doppelt angeboten werden' };
      }
      if (new Set(offeredLeases).size !== offeredLeases.length || new Set(requestedLeases).size !== requestedLeases.length
        || !offeredLeases.every(index => offeredProperties.includes(index))
        || !requestedLeases.every(index => requestedProperties.includes(index))) {
        return { valid: false, error: 'Pacht muss zu einem angebotenen Grundstück gehören' };
      }
      if ((offeredLeases.length > 0 || requestedLeases.length > 0) && !state.config.mechanics.propertyLeases) {
        return { valid: false, error: 'Pacht ist in diesem Preset deaktiviert' };
      }
      if (!offeredProperties.every(index => state.properties[index]?.ownerId === playerId)) {
        return { valid: false, error: 'Du besitzt nicht alle angebotenen Grundstücke' };
      }
      if (!requestedProperties.every(index => state.properties[index]?.ownerId === target.id)) {
        return { valid: false, error: 'Der Zielspieler besitzt nicht alle angeforderten Grundstücke' };
      }
      if ([...offeredLeases, ...requestedLeases].some(index => {
        const field = METROVILLE_FIELDS[index];
        return !field?.cost || state.properties[index]?.isMortgaged || state.leases[index];
      })) {
        return { valid: false, error: 'Dieses Grundstück kann nicht verpachtet werden' };
      }
      if (offer.offeredMoney === 0 && offeredProperties.length === 0 && offer.requestedMoney === 0 && requestedProperties.length === 0) {
        return { valid: false, error: 'Leere Angebote sind nicht erlaubt' };
      }
      return { valid: true };
    }

    if (action.type === 'DECLARE_BANKRUPTCY') {
      if (state.phase !== 'turn_end' || player.money >= 0) {
        return { valid: false, error: 'Bankrott kann jetzt nicht erklärt werden' };
      }
      return { valid: true };
    }

    if (action.type === 'DISMISS_CARD') {
      if (state.phase !== 'card_reveal' || !state.pendingCard) {
        return { valid: false, error: 'Keine Karte zum Bestätigen' };
      }
      if (state.currentTurnPlayerId !== playerId) {
        return { valid: false, error: 'Du bist nicht am Zug' };
      }
      return { valid: true };
    }

    if (state.phase === 'card_reveal') {
      return { valid: false, error: 'Bestätige zuerst die gezogene Karte' };
    }

    // Default turn-based actions require current turn
    if (state.currentTurnPlayerId !== playerId) {
      return { valid: false, error: 'Du bist nicht am Zug' };
    }

    if (action.type === 'ROLL_DICE') {
      if (state.phase !== 'roll') {
        return { valid: false, error: 'Würfeln in dieser Phase nicht erlaubt' };
      }
      return { valid: true };
    }

    if (action.type === 'PAY_JAIL_FINE') {
      if (!player.inJail) return { valid: false, error: 'Du bist nicht in der Sicherheitszone' };
      if (player.money < 50) return { valid: false, error: 'Nicht genug Taler (50 erforderlich)' };
      return { valid: true };
    }

    if (action.type === 'USE_JAIL_CARD') {
      if (!player.inJail) return { valid: false, error: 'Du bist nicht in der Sicherheitszone' };
      if (player.getOutOfJailCards <= 0) return { valid: false, error: 'Keine Freikarte vorhanden' };
      return { valid: true };
    }

    if (action.type === 'BUY_PROPERTY') {
      if (state.phase !== 'tile_action') return { valid: false, error: 'Kauf jetzt nicht möglich' };
      const field = METROVILLE_FIELDS[player.position];
      const prop = state.properties[player.position];
      if (!field || !prop || prop.ownerId !== null || !field.cost) {
        return { valid: false, error: 'Grundstück nicht erwerbbar' };
      }
      if (player.money < field.cost) {
        return { valid: false, error: 'Nicht genug Taler zum Kauf' };
      }
      return { valid: true };
    }

    if (action.type === 'DECLINE_BUY_PROPERTY') {
      if (state.phase !== 'tile_action') return { valid: false, error: 'Nicht in Kaufphase' };
      return { valid: true };
    }

    if (action.type === 'END_TURN') {
      if (state.phase !== 'turn_end') return { valid: false, error: 'Zug kann jetzt nicht beendet werden' };
      return { valid: true };
    }

    if (action.type === 'BUILD_HOUSE') {
      const field = METROVILLE_FIELDS[action.propertyIndex];
      const prop = state.properties[action.propertyIndex];
      if (!field || !prop || prop.ownerId !== playerId || field.type !== 'property') {
        return { valid: false, error: 'Nicht dein bebaubares Grundstück' };
      }
      if (state.leases[action.propertyIndex]) return { valid: false, error: 'Während einer Pacht darf nicht gebaut werden' };
      if (prop.houses >= 5) return { valid: false, error: 'Bereits maximal ausgebaut' };
      if (!field.houseCost || player.money < field.houseCost) {
        return { valid: false, error: 'Nicht genug Taler für den Ausbau' };
      }
      // Quartier-Besitz prüfen
      if (field.district) {
        const districtFields = DISTRICT_MAP[field.district] || [];
        const ownsAll = districtFields.every(fidx => state.properties[fidx]?.ownerId === playerId);
        if (!ownsAll) return { valid: false, error: 'Du musst das gesamte Quartier besitzen' };
        const lowestHouseCount = Math.min(...districtFields.map(fidx => state.properties[fidx]?.houses || 0));
        if (prop.houses > lowestHouseCount) {
          return { valid: false, error: 'Gebäude müssen gleichmäßig errichtet werden' };
        }
      }
      return { valid: true };
    }

    if (action.type === 'SELL_HOUSE') {
      const field = METROVILLE_FIELDS[action.propertyIndex];
      const prop = state.properties[action.propertyIndex];
      if (!field || !prop || prop.ownerId !== playerId || field.type !== 'property') {
        return { valid: false, error: 'Nicht dein bebaubares Grundstück' };
      }
      if (state.leases[action.propertyIndex]) return { valid: false, error: 'Während einer Pacht darf nicht abgerissen werden' };
      if (prop.houses <= 0 || !field.houseCost) {
        return { valid: false, error: 'Kein Gebäude zum Verkauf vorhanden' };
      }
      if (field.district) {
        const districtFields = DISTRICT_MAP[field.district] || [];
        const highestHouseCount = Math.max(...districtFields.map(fidx => state.properties[fidx]?.houses || 0));
        if (prop.houses < highestHouseCount) {
          return { valid: false, error: 'Gebäude müssen gleichmäßig verkauft werden' };
        }
      }
      return { valid: true };
    }

    if (action.type === 'MORTGAGE') {
      const prop = state.properties[action.propertyIndex];
      if (!prop || prop.ownerId !== playerId) return { valid: false, error: 'Nicht dein Grundstück' };
      if (state.leases[action.propertyIndex]) return { valid: false, error: 'Während einer Pacht darf nicht beliehen werden' };
      if (prop.isMortgaged) return { valid: false, error: 'Bereits beliehen' };
      if (prop.houses > 0) return { valid: false, error: 'Erst Gebäude verkaufen' };
      return { valid: true };
    }

    if (action.type === 'UNMORTGAGE') {
      const field = METROVILLE_FIELDS[action.propertyIndex];
      const prop = state.properties[action.propertyIndex];
      if (!prop || prop.ownerId !== playerId || !prop.isMortgaged) return { valid: false, error: 'Nicht beliehen' };
      const cost = Math.round((field.cost || 100) * 0.55);
      if (player.money < cost) return { valid: false, error: 'Nicht genug Taler' };
      return { valid: true };
    }

    return { valid: false, error: 'Aktion in dieser Etappe nicht verfügbar' };
  },

  applyAction(state, action): MetrovilleState {
    const s = {
      ...state,
      players: state.players.map(p => ({ ...p })),
      playersActedThisRound: [...state.playersActedThisRound],
      botTradeOfferRounds: { ...state.botTradeOfferRounds },
      properties: Object.fromEntries(
        Object.entries(state.properties).map(([index, property]) => [index, { ...property }])
      ),
      leases: Object.fromEntries(Object.entries(state.leases).map(([index, lease]) => [index, { ...lease }])),
      auction: state.auction
        ? { ...state.auction, activePlayerIds: [...state.auction.activePlayerIds] }
        : null,
      pendingTrade: state.pendingTrade
        ? {
            ...state.pendingTrade,
            offeredPropertyIndices: [...state.pendingTrade.offeredPropertyIndices],
            offeredLeasePropertyIndices: [...(state.pendingTrade.offeredLeasePropertyIndices || [])],
            requestedPropertyIndices: [...state.pendingTrade.requestedPropertyIndices],
            requestedLeasePropertyIndices: [...(state.pendingTrade.requestedLeasePropertyIndices || [])]
          }
        : null,
      log: [...state.log]
    };

    const player = s.players.find(p => p.id === s.currentTurnPlayerId);
    if (!player) return s;

    // ROLL DICE
    if (action.type === 'ROLL_DICE') {
      const diceRng = createRNG(`${s.seed}:${s.randomIndex}`);
      const d1 = Math.floor(diceRng() * 6) + 1;
      const d2 = Math.floor(diceRng() * 6) + 1;
      s.randomIndex++;
      s.lastRollerId = player.id;
      s.dice = [d1, d2];
      s.hasRolled = true;
      const isDoubles = d1 === d2;

      s.log.push(`${player.name} würfelt [${d1}, ${d2}] (Summe: ${d1 + d2}).`);

      if (player.inJail) {
        if (isDoubles) {
          player.inJail = false;
          player.jailTurns = 0;
          s.log.push(`🎉 Pasch gewürfelt! ${player.name} verlässt die Sicherheitszone.`);
          movePlayer(s, player, d1 + d2);
        } else {
          player.jailTurns++;
          if (player.jailTurns >= 3) {
            player.money -= 50;
            player.inJail = false;
            player.jailTurns = 0;
            s.log.push(`${player.name} zahlt nach 3 Fehlversuchen 50 Taler und verlässt die Sicherheitszone.`);
            movePlayer(s, player, d1 + d2);
          } else {
            s.phase = 'turn_end';
            return s;
          }
        }
      } else {
        if (isDoubles) {
          s.doublesRolledCount++;
          if (s.doublesRolledCount >= 3) {
            player.position = 10;
            player.inJail = true;
            player.jailTurns = 0;
            s.phase = 'turn_end';
            s.log.push(`⚠️ 3x Pasch! ${player.name} muss sofort in die Sicherheitszone.`);
            return s;
          }
        } else {
          s.doublesRolledCount = 0;
        }

        movePlayer(s, player, d1 + d2);
      }
      return s;
    }

    // PAY JAIL FINE
    if (action.type === 'PAY_JAIL_FINE') {
      player.money -= 50;
      player.inJail = false;
      player.jailTurns = 0;
      s.phase = 'roll';
      s.hasRolled = false;
      s.log.push(`${player.name} zahlt 50 Taler und verlässt die Sicherheitszone.`);
      return s;
    }

    // USE JAIL CARD
    if (action.type === 'USE_JAIL_CARD') {
      player.getOutOfJailCards--;
      player.inJail = false;
      player.jailTurns = 0;
      s.phase = 'roll';
      s.hasRolled = false;
      s.log.push(`${player.name} verwendet eine Freikarte und verlässt die Sicherheitszone.`);
      return s;
    }

    // BUY PROPERTY
    if (action.type === 'BUY_PROPERTY') {
      const field = METROVILLE_FIELDS[player.position];
      const prop = s.properties[player.position];
      if (field && prop && field.cost) {
        player.money -= field.cost;
        prop.ownerId = player.id;
        s.log.push(`🏢 ${player.name} kauft ${field.name} für ${field.cost} Taler.`);
      }
      s.phase = 'turn_end';
      return s;
    }

    // DECLINE PROPERTY (Starts auction in Standard mode)
    if (action.type === 'DECLINE_BUY_PROPERTY') {
      const field = METROVILLE_FIELDS[player.position];
      if (s.config.preset === 'classic_light') {
        s.log.push(`${player.name} verzichtet auf den Kauf von ${field.name}.`);
        s.phase = 'turn_end';
      } else {
        // Start auction
        const eligible = s.players.filter(p => !p.bankrupt).map(p => p.id);
        s.auction = {
          propertyIndex: player.position,
          initiatorId: player.id,
          highestBid: 0,
          highestBidderId: null,
          activePlayerIds: eligible,
          currentBidderIndex: 0
        };
        s.phase = 'auction';
        s.log.push(`📢 Versteigerung für ${field.name} gestartet! Mindestgebot: 10 Taler.`);
      }
      return s;
    }

    // AUCTION: BID
    if (action.type === 'BID_AUCTION' && s.auction) {
      const bidderId = s.auction.activePlayerIds[s.auction.currentBidderIndex];
      const bidder = s.players.find(p => p.id === bidderId);
      s.auction.highestBid = action.bidAmount;
      s.auction.highestBidderId = bidderId;
      s.log.push(`💰 ${bidder?.name} bietet ${action.bidAmount} Taler.`);
      advanceAuction(s);
      return s;
    }

    // AUCTION: PASS
    if (action.type === 'PASS_AUCTION' && s.auction) {
      const passingId = s.auction.activePlayerIds[s.auction.currentBidderIndex];
      const passingPlayer = s.players.find(p => p.id === passingId);
      s.log.push(`✋ ${passingPlayer?.name} passt bei der Versteigerung.`);
      s.auction.activePlayerIds.splice(s.auction.currentBidderIndex, 1);
      if (s.auction.activePlayerIds.length === 0 || (s.auction.activePlayerIds.length === 1 && s.auction.highestBidderId)) {
        finishAuction(s);
      } else {
        if (s.auction.currentBidderIndex >= s.auction.activePlayerIds.length) {
          s.auction.currentBidderIndex = 0;
        }
      }
      return s;
    }

    // BUILD HOUSE
    if (action.type === 'BUILD_HOUSE') {
      const field = METROVILLE_FIELDS[action.propertyIndex];
      const prop = s.properties[action.propertyIndex];
      if (field && prop && field.houseCost) {
        player.money -= field.houseCost;
        prop.houses++;
        const typeStr = prop.houses === 5 ? 'Wolkenkratzer' : `${prop.houses}. Wohnblock`;
        s.log.push(`🏗️ ${player.name} errichtet ${typeStr} auf ${field.name}.`);
      }
      return s;
    }

    // SELL HOUSE
    if (action.type === 'SELL_HOUSE') {
      const field = METROVILLE_FIELDS[action.propertyIndex];
      const prop = s.properties[action.propertyIndex];
      if (field && prop && field.houseCost && prop.houses > 0) {
        prop.houses--;
        const refund = Math.floor(field.houseCost / 2);
        player.money += refund;
        s.log.push(`🏗️ ${player.name} verkauft ein Gebäude auf ${field.name} für ${refund} Taler.`);
      }
      return s;
    }

    // MORTGAGE
    if (action.type === 'MORTGAGE') {
      const field = METROVILLE_FIELDS[action.propertyIndex];
      const prop = s.properties[action.propertyIndex];
      if (field && prop && field.cost) {
        prop.isMortgaged = true;
        const val = Math.round(field.cost * 0.5);
        player.money += val;
        s.log.push(`🏦 ${player.name} beleiht ${field.name} für ${val} Taler.`);
      }
      return s;
    }

    // UNMORTGAGE
    if (action.type === 'UNMORTGAGE') {
      const field = METROVILLE_FIELDS[action.propertyIndex];
      const prop = s.properties[action.propertyIndex];
      if (field && prop && field.cost) {
        const cost = Math.round(field.cost * 0.55);
        player.money -= cost;
        prop.isMortgaged = false;
        s.log.push(`✨ ${player.name} löst Hypothek auf ${field.name} für ${cost} Taler ab.`);
      }
      return s;
    }

    // OFFER TRADE
    if (action.type === 'OFFER_TRADE') {
      s.tradeSequence++;
      s.pendingTrade = {
        id: `trade-${s.tradeSequence}`,
        ...action.offer,
        offeredLeasePropertyIndices: [...(action.offer.offeredLeasePropertyIndices || [])],
        requestedLeasePropertyIndices: [...(action.offer.requestedLeasePropertyIndices || [])]
      };
      const offerer = s.players.find(candidate => candidate.id === action.offer.fromPlayerId);
      if (offerer?.isBot) {
        s.botTradeOfferRounds = {
          ...s.botTradeOfferRounds,
          [offerer.id]: s.roundCount
        };
      }
      const target = s.players.find(candidate => candidate.id === action.offer.toPlayerId);
      s.log.push(`${player.name} bietet ${target?.name || 'einem Mitspieler'} einen Handel an.`);
      return s;
    }

    // ACCEPT TRADE
    if (action.type === 'ACCEPT_TRADE' && s.pendingTrade) {
      const trade = s.pendingTrade;
      const offerer = s.players.find(candidate => candidate.id === trade.fromPlayerId);
      const recipient = s.players.find(candidate => candidate.id === trade.toPlayerId);
      if (offerer && recipient) {
        const recipientTradeValue = tradeAssetValueForPlayer(s, trade, recipient.id);
        offerer.money -= trade.offeredMoney;
        recipient.money += trade.offeredMoney;
        recipient.money -= trade.requestedMoney;
        offerer.money += trade.requestedMoney;
        const offeredLeaseIndices = trade.offeredLeasePropertyIndices || [];
        const requestedLeaseIndices = trade.requestedLeasePropertyIndices || [];
        trade.offeredPropertyIndices
          .filter(index => !offeredLeaseIndices.includes(index))
          .forEach(index => { s.properties[index].ownerId = recipient.id; });
        trade.requestedPropertyIndices
          .filter(index => !requestedLeaseIndices.includes(index))
          .forEach(index => { s.properties[index].ownerId = offerer.id; });
        offeredLeaseIndices.forEach(index => {
          s.leases[index] = {
            propertyIndex: index,
            ownerId: offerer.id,
            tenantId: recipient.id,
            expiresAtRound: s.roundCount + s.config.leaseDurationRounds
          };
        });
        requestedLeaseIndices.forEach(index => {
          s.leases[index] = {
            propertyIndex: index,
            ownerId: recipient.id,
            tenantId: offerer.id,
            expiresAtRound: s.roundCount + s.config.leaseDurationRounds
          };
        });
        s.log.push(
          `${recipient.name} nimmt den Handel mit ${offerer.name} an (geschätzter Gegenwert: ${recipientTradeValue >= 0 ? '+' : ''}${recipientTradeValue} Taler).`
        );
        [...offeredLeaseIndices, ...requestedLeaseIndices].forEach(index => {
          s.log.push(`${METROVILLE_FIELDS[index].name} wird für ${s.config.leaseDurationRounds} Runden verpachtet.`);
        });
      }
      s.pendingTrade = null;
      return s;
    }

    // DECLINE TRADE
    if (action.type === 'DECLINE_TRADE' && s.pendingTrade) {
      const trade = s.pendingTrade;
      const recipient = s.players.find(candidate => candidate.id === trade.toPlayerId);
      const recipientTradeValue = recipient ? tradeAssetValueForPlayer(s, trade, recipient.id) : 0;
      const acceptanceError = recipient ? tradeAcceptanceError(s, trade, recipient.id) : null;
      const leaseOffer = (trade.offeredLeasePropertyIndices?.length || 0) > 0
        || (trade.requestedLeasePropertyIndices?.length || 0) > 0;
      const reason = acceptanceError
        ? `Angebot nicht ausführbar: ${acceptanceError}`
        : leaseOffer
          ? 'Bots handeln keine Pacht'
          : `geschätzter Gegenwert: ${recipientTradeValue >= 0 ? '+' : ''}${recipientTradeValue} Taler`;
      s.log.push(
        `${recipient?.name || 'Der Zielspieler'} lehnt das Handelsangebot ab (${reason}).`
      );
      s.pendingTrade = null;
      return s;
    }

    // DECLARE BANKRUPTCY
    if (action.type === 'DECLARE_BANKRUPTCY') {
      checkBankruptcy(s, player);
      return s;
    }

    // DISMISS CARD (apply effect after reveal)
    if (action.type === 'DISMISS_CARD' && s.pendingCard) {
      const card = ALL_CARDS_MAP[s.pendingCard.cardId];
      if (card) {
        card.action(s, player.id);
        checkBankruptcy(s, player);
      }
      s.pendingCard = null;
      s.phase = 'turn_end';
      return s;
    }

    // END TURN
    if (action.type === 'END_TURN') {
      // Check turn limit for Blitz mode
      s.turnCount++;
      if (s.config.turnLimit && s.turnCount >= s.config.turnLimit) {
        s.phase = 'gameover';
        const best = [...s.players].sort((a, b) => b.money - a.money)[0];
        s.winnerId = best.id;
        s.winReason = `Spielzuglimit (${s.config.turnLimit}) erreicht – Höchstes Vermögen!`;
        return s;
      }

      // If doubles rolled and not in jail, player goes again
      if (s.doublesRolledCount > 0 && !player.inJail && !player.bankrupt) {
        s.phase = 'roll';
        s.hasRolled = false;
        s.log.push(`🎲 Pasch! ${player.name} darf noch einmal würfeln.`);
        return s;
      }

      // Next player
      const activePlayers = s.playerOrder.filter(pid => {
        const p = s.players.find(pl => pl.id === pid);
        return p && !p.bankrupt;
      });

      const actedThisRound = new Set(s.playersActedThisRound);
      actedThisRound.add(player.id);
      if (activePlayers.every(playerId => actedThisRound.has(playerId))) {
        s.roundCount++;
        s.playersActedThisRound = [];
        expireLeases(s);
      } else {
        s.playersActedThisRound = [...actedThisRound];
      }

      if (activePlayers.length <= 1) {
        s.phase = 'gameover';
        s.winnerId = activePlayers[0] || null;
        s.winReason = 'Alle anderen Spieler sind bankrott!';
        return s;
      }

      const orderIndex = s.playerOrder.indexOf(s.currentTurnPlayerId);
      const nextPlayerId = s.playerOrder
        .map((_, offset) => s.playerOrder[(orderIndex + offset + 1) % s.playerOrder.length])
        .find(playerId => activePlayers.includes(playerId));
      s.currentTurnPlayerId = nextPlayerId || activePlayers[0];
      s.phase = 'roll';
      s.hasRolled = false;
      s.doublesRolledCount = 0;
      s.lastDrawnCard = null;

      const nextPlayer = s.players.find(p => p.id === s.currentTurnPlayerId);
      s.log.push(`👉 ${nextPlayer?.name} ist am Zug.`);
      return s;
    }

    return s;
  },

  getPlayerView(state, _playerId) {
    return state;
  },

  isGameOver(state): boolean {
    return state.phase === 'gameover' || state.winnerId !== null;
  },

  computeResult(state): GameResult {
    if (state.winnerId) {
      const winner = state.players.find(p => p.id === state.winnerId);
      return {
        winnerId: state.winnerId,
        reason: state.winReason || `${winner?.name} gewinnt!`
      };
    }
    return {};
  },

  createBot(difficulty: BotDifficulty = 'medium') {
    return new MetrovilleBot(difficulty);
  }
};

function movePlayer(state: MetrovilleState, player: MetrovillePlayer, steps: number) {
  const oldPos = player.position;
  player.position = (oldPos + steps) % 40;

  // Passed Stadttor
  if (player.position < oldPos && steps > 0) {
    grantGoPassSalary(state, player);
  }

  const field = METROVILLE_FIELDS[player.position];
  if (player.position === 20 && state.config.mechanics.cityParkJackpot && state.cityParkJackpot > 0) {
    const winnings = state.cityParkJackpot;
    state.cityParkJackpot = 0;
    player.money += winnings;
    state.log.push(`${player.name} erhält ${winnings} Taler aus dem Stadtpark-Jackpot.`);
  }
  if (field.type === 'station') {
    state.log.push(`${player.name} zieht in ${field.name} ein.`);
  } else {
    state.log.push(`${player.name} landet auf [${field.index}] ${field.name}.`);
  }

  // Quarantäne-Befehl (Go to jail)
  if (player.position === 30) {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    state.phase = 'turn_end';
    state.log.push(`🚨 Quarantäne-Befehl! ${player.name} wird sofort in die Sicherheitszone verlegt.`);
    return;
  }

  // Taxes
  if (field.type === 'tax' && field.taxAmount) {
    const taxAmount = Math.round(field.taxAmount * state.config.taxMultiplier);
    player.money -= taxAmount;
    addToCityParkJackpot(state, taxAmount);
    state.log.push(`💸 ${player.name} zahlt ${taxAmount} Taler ${field.name}.`);
    checkBankruptcy(state, player);
    state.phase = 'turn_end';
    return;
  }

  // Cards
    if (field.type === 'card') {
    const isChance = field.name === 'Chance' || field.name === 'Expresskurier';
    const deck = isChance ? state.chanceDeck : state.communityDeck;
    if (deck.length === 0) {
      deck.push(...(isChance ? EXPRESS_CARDS : STADTRAT_CARDS).map(c => c.id));
    }
    const cardId = deck.shift()!;
    const card = ALL_CARDS_MAP[cardId];
    if (card) {
      state.lastDrawnCard = { deck: card.deck, title: card.title, text: card.text };
      state.pendingCard = { cardId, deck: card.deck, title: card.title, text: card.text };
      state.log.push(`🎴 ${isChance ? 'Chance' : 'Gemeinschaft'}: "${card.title}" - ${card.text}`);
    }
    state.phase = 'card_reveal';
    return;
  }

  // Properties / Stations / Utilities
  if (field.type === 'property' || field.type === 'station' || field.type === 'utility') {
    const prop = state.properties[player.position];
    if (!prop.ownerId) {
      state.phase = 'tile_action';
    } else if (prop.ownerId !== player.id && state.leases[player.position]?.tenantId !== player.id) {
      const rent = calculateRent(player.position, state);
      if (rent > 0) {
        player.money -= rent;
        const rentRecipientId = state.leases[player.position]?.tenantId || prop.ownerId;
        const owner = state.players.find(p => p.id === rentRecipientId);
        if (owner) owner.money += rent;
        state.log.push(`🏷️ ${player.name} zahlt ${rent} Taler Miete an ${owner?.name}.`);
        checkBankruptcy(state, player, owner);
      }
      state.phase = 'turn_end';
    } else {
      state.phase = 'turn_end';
    }
    return;
  }

  state.phase = 'turn_end';
}

function checkBankruptcy(state: MetrovilleState, player: MetrovillePlayer, creditor?: MetrovillePlayer) {
  if (player.money >= 0) return;

  // Auto-mortgage properties to recover
  for (const [idxStr, prop] of Object.entries(state.properties)) {
    if (prop.ownerId === player.id && !prop.isMortgaged && prop.houses === 0 && !state.leases[Number(idxStr)]) {
      const f = METROVILLE_FIELDS[Number(idxStr)];
      if (f.cost) {
        prop.isMortgaged = true;
        const mortgageVal = Math.round(f.cost * 0.5);
        player.money += mortgageVal;
        state.log.push(`🏦 Notfall: ${player.name} beleiht ${f.name} (+${mortgageVal} Taler).`);
        if (player.money >= 0) return;
      }
    }
  }

  if (player.money < 0) {
    player.bankrupt = true;
    state.log.push(`💥 BANKROTT! ${player.name} scheidet aus dem Spiel aus.`);
    Object.entries(state.leases).forEach(([index, lease]) => {
      if (lease.tenantId === player.id || lease.ownerId === player.id) {
        delete state.leases[Number(index)];
        state.log.push(`Die Pacht für ${METROVILLE_FIELDS[Number(index)].name} endet wegen Bankrotts.`);
      }
    });
    // Transfer or reset properties
    Object.values(state.properties).forEach(prop => {
      if (prop.ownerId === player.id) {
        prop.ownerId = creditor ? creditor.id : null;
        prop.houses = 0;
      }
    });

    const alive = state.players.filter(p => !p.bankrupt);
    if (alive.length === 1) {
      state.phase = 'gameover';
      state.winnerId = alive[0].id;
      state.winReason = 'Alle Kontrahenten sind bankrott!';
    }
  }
}

function expireLeases(state: MetrovilleState) {
  Object.entries(state.leases).forEach(([index, lease]) => {
    if (lease.expiresAtRound <= state.roundCount) {
      delete state.leases[Number(index)];
      state.log.push(`Die Pacht für ${METROVILLE_FIELDS[Number(index)].name} endet; das Grundstück fällt zurück.`);
    }
  });
}

function advanceAuction(state: MetrovilleState) {
  if (!state.auction) return;
  state.auction.currentBidderIndex = (state.auction.currentBidderIndex + 1) % state.auction.activePlayerIds.length;
}

function finishAuction(state: MetrovilleState) {
  const auction = state.auction;
  if (!auction) return;
  const prop = state.properties[auction.propertyIndex];
  const field = METROVILLE_FIELDS[auction.propertyIndex];

  if (auction.highestBidderId && prop) {
    const winner = state.players.find(p => p.id === auction.highestBidderId);
    if (winner) {
      winner.money -= auction.highestBid;
      prop.ownerId = winner.id;
      state.log.push(`🏆 ${winner.name} ersteigert ${field.name} für ${auction.highestBid} Taler!`);
    }
  } else {
    state.log.push(`Versteigerung für ${field.name} ohne Gebote beendet.`);
  }

  state.auction = null;
  state.currentTurnPlayerId = auction.initiatorId;
  state.phase = 'turn_end';
}
