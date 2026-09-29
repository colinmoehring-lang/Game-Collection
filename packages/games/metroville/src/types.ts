import type { Player } from '@metroville/game-sdk';

export type DistrictType =
  | 'altstadt'       // Brown/Teal
  | 'zentrum'        // Light Blue / Mustard
  | 'neonviertel'    // Pink / Terracotta
  | 'hafenviertel'   // Orange / Sky
  | 'polardistrikt'  // Amber
  | 'weltraumring'   // Purple
  | 'station'        // Bahnhöfe
  | 'utility'        // Atomreaktor / Satellit
  | 'special';       // Los, Gefängnis, Park, Steuern, Karten

export type FieldType = 'property' | 'station' | 'utility' | 'corner' | 'tax' | 'card';

export interface FieldDefinition {
  index: number;
  name: string;
  type: FieldType;
  district?: DistrictType;
  color?: string;
  cost?: number;
  baseRent?: number;
  rents?: number[]; // [base, 1 block, 2 blocks, 3 blocks, 4 blocks, skyscraper]
  houseCost?: number;
  taxAmount?: number;
}

export interface MetrovillePlayer extends Player {
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  bankrupt: boolean;
}

export interface PropertyState {
  ownerId: string | null;
  houses: number; // 0-4 = Wohnblöcke, 5 = Wolkenkratzer
  isMortgaged: boolean;
}

export type MetrovillePreset = 'blitz' | 'standard' | 'classic_light';

export interface MetrovilleConfig {
  preset: MetrovillePreset;
  startingMoney: number;
  goPassSalary: number;
  turnLimit?: number;
}

export interface CardDefinition {
  id: string;
  deck: 'express' | 'stadtrat';
  title: string;
  text: string;
  action: (state: MetrovilleState, playerId: string) => void;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeredMoney: number;
  offeredPropertyIndices: number[];
  requestedMoney: number;
  requestedPropertyIndices: number[];
}

export interface AuctionState {
  propertyIndex: number;
  highestBid: number;
  highestBidderId: string | null;
  activePlayerIds: string[];
  currentBidderIndex: number;
}

export interface MetrovilleState {
  config: MetrovilleConfig;
  seed: string;
  randomIndex: number;
  turnCount: number;
  players: MetrovillePlayer[];
  playerOrder: string[];
  currentTurnPlayerId: string;
  dice: [number, number];
  doublesRolledCount: number;
  hasRolled: boolean;
  phase: 'roll' | 'tile_action' | 'turn_end' | 'auction' | 'gameover';
  properties: Record<number, PropertyState>;
  expressDeck: string[]; // Card IDs
  stadtratDeck: string[];
  lastDrawnCard: { deck: 'express' | 'stadtrat'; title: string; text: string } | null;
  auction: AuctionState | null;
  pendingTrade: TradeOffer | null;
  winnerId: string | null;
  winReason?: string;
  log: string[];
}

export type MetrovilleAction =
  | { type: 'ROLL_DICE' }
  | { type: 'BUY_PROPERTY' }
  | { type: 'DECLINE_BUY_PROPERTY' }
  | { type: 'END_TURN' }
  | { type: 'PAY_JAIL_FINE' }
  | { type: 'USE_JAIL_CARD' }
  | { type: 'BUILD_HOUSE'; propertyIndex: number }
  | { type: 'SELL_HOUSE'; propertyIndex: number }
  | { type: 'MORTGAGE'; propertyIndex: number }
  | { type: 'UNMORTGAGE'; propertyIndex: number }
  | { type: 'BID_AUCTION'; bidAmount: number }
  | { type: 'PASS_AUCTION' }
  | { type: 'OFFER_TRADE'; offer: Omit<TradeOffer, 'id'> }
  | { type: 'ACCEPT_TRADE'; tradeId: string }
  | { type: 'DECLINE_TRADE'; tradeId: string }
  | { type: 'DECLARE_BANKRUPTCY' };
