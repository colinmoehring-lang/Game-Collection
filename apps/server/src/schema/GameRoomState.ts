import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type('string') color: string = '#C84B2F';
  @type('string') sessionToken: string = '';
  @type('boolean') isHost: boolean = false;
  @type('boolean') isReady: boolean = false;
  @type('boolean') isConnected: boolean = true;
  @type('boolean') isBot: boolean = false;
}

export class GameRoomState extends Schema {
  @type('string') roomCode: string = '';
  @type('string') gameId: string = 'tictactoe';
  @type('string') gamePreset: string = 'standard';
  @type('string') status: string = 'lobby'; // 'lobby' | 'playing' | 'gameover'
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type(['string']) playerOrder = new ArraySchema<string>();
  @type('string') currentTurnPlayerId: string = '';
  @type('string') gameStateJson: string = '{}'; // Synchronized JSON representation of GameModule state
  @type('string') winnerId: string = '';
  @type('string') winReason: string = '';
  @type('string') seed: string = '';
}
