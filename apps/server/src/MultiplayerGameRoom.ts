import colyseus from 'colyseus';
import type { Client } from 'colyseus';
const { Room } = colyseus;
import { GameRoomState, PlayerSchema } from './schema/GameRoomState.js';
import { generateRoomCode, type GameModule, type Player } from '@metroville/game-sdk';
import { TicTacToeModule } from '@metroville/game-tictactoe';

const GAME_MODULES: Record<string, GameModule<any, any>> = {
  [TicTacToeModule.manifest.id]: TicTacToeModule
};

const COLOR_PALETTE = ['#C84B2F', '#1D7A72', '#D4930A', '#3B7FC4', '#8E44AD', '#27AE60'];

export class MultiplayerGameRoom extends Room<GameRoomState> {
  maxClients = 8;
  private gameModule: GameModule<any, any> | null = null;
  private runtimeGameState: any = null;
  private botInstances: Map<string, any> = new Map();

  onCreate(options: any) {
    this.setState(new GameRoomState());

    const roomCode = options.roomCode || generateRoomCode();
    this.state.roomCode = roomCode;
    this.state.gameId = options.gameId || 'tictactoe';
    this.state.seed = 'seed-' + Math.random().toString(36).substring(2, 9);
    this.roomId = roomCode;

    this.gameModule = GAME_MODULES[this.state.gameId] || TicTacToeModule;

    console.log(`[Room ${roomCode}] Created with game ${this.state.gameId}`);

    // Message Handlers
    this.onMessage('SET_READY', (client, message: { ready: boolean }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = !!message.ready;
      }
    });

    this.onMessage('ADD_BOT', (client) => {
      const host = this.state.players.get(client.sessionId);
      if (!host || !host.isHost || this.state.status !== 'lobby') return;

      const botId = 'bot-' + Math.random().toString(36).substring(2, 7);
      const botPlayer = new PlayerSchema();
      botPlayer.id = botId;
      botPlayer.name = `MetroBot ${this.state.players.size + 1}`;
      botPlayer.color = COLOR_PALETTE[this.state.players.size % COLOR_PALETTE.length];
      botPlayer.isBot = true;
      botPlayer.isReady = true;
      botPlayer.isConnected = true;

      this.state.players.set(botId, botPlayer);
      this.state.playerOrder.push(botId);

      if (this.gameModule && this.gameModule.createBot) {
        this.botInstances.set(botId, this.gameModule.createBot('medium'));
      }
    });

    this.onMessage('KICK_PLAYER', (client, message: { targetId: string }) => {
      const host = this.state.players.get(client.sessionId);
      if (!host || !host.isHost || this.state.status !== 'lobby') return;

      const target = this.state.players.get(message.targetId);
      if (target && !target.isHost) {
        if (target.isBot) {
          this.state.players.delete(message.targetId);
          const idx = this.state.playerOrder.indexOf(message.targetId);
          if (idx !== -1) this.state.playerOrder.splice(idx, 1);
          this.botInstances.delete(message.targetId);
        } else {
          const targetClient = this.clients.find(c => c.sessionId === message.targetId);
          if (targetClient) {
            targetClient.leave();
          }
        }
      }
    });

    this.onMessage('START_GAME', (client) => {
      const host = this.state.players.get(client.sessionId);
      if (!host || !host.isHost) return;
      if (this.state.players.size < (this.gameModule?.manifest.minPlayers || 2)) return;

      this.startGame();
    });

    this.onMessage('GAME_ACTION', (client, action: any) => {
      if (this.state.status !== 'playing' || !this.gameModule) return;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      this.executeAction(action, player.id);
    });
  }

  onJoin(client: Client, options: any) {
    console.log(`[Room ${this.state.roomCode}] Client joined: ${client.sessionId}`);

    // Reconnect check
    let existingPlayer: PlayerSchema | undefined;
    if (options.sessionToken) {
      for (const [, p] of this.state.players.entries()) {
        if (p.sessionToken === options.sessionToken) {
          existingPlayer = p;
          break;
        }
      }
    }

    if (existingPlayer) {
      existingPlayer.isConnected = true;
      existingPlayer.id = client.sessionId;
      // Remap sessionId in players Map
      this.state.players.set(client.sessionId, existingPlayer);
      return;
    }

    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = options.name || `Spieler ${this.state.players.size + 1}`;
    player.color = COLOR_PALETTE[this.state.players.size % COLOR_PALETTE.length];
    player.sessionToken = options.sessionToken || ('tok-' + Math.random().toString(36).substring(2, 9));
    player.isHost = this.state.players.size === 0;
    player.isReady = player.isHost; // Host starts ready
    player.isConnected = true;

    this.state.players.set(client.sessionId, player);
    this.state.playerOrder.push(client.sessionId);
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (this.state.status === 'lobby') {
      this.state.players.delete(client.sessionId);
      const idx = this.state.playerOrder.indexOf(client.sessionId);
      if (idx !== -1) this.state.playerOrder.splice(idx, 1);

      // Reassign host if host left
      if (player.isHost && this.state.playerOrder.length > 0) {
        const nextHost = this.state.players.get(this.state.playerOrder[0]);
        if (nextHost) nextHost.isHost = true;
      }
      return;
    }

    // During active game: allow reconnect with 20s grace period
    player.isConnected = false;
    try {
      if (consented) {
        throw new Error('Consented leave');
      }
      await this.allowReconnection(client, 20);
      player.isConnected = true;
    } catch {
      // Reconnect failed or player left on purpose
      console.log(`[Room ${this.state.roomCode}] Reconnect expired for ${player.name}`);
      player.isConnected = false;
    }
  }

  private startGame() {
    if (!this.gameModule) return;

    const playersArray: Player[] = (this.state.playerOrder as unknown as string[]).map((pid: string) => {
      const p = this.state.players.get(pid)!;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        isBot: p.isBot
      };
    });

    this.runtimeGameState = this.gameModule.createInitialState({}, playersArray, this.state.seed);
    this.state.status = 'playing';
    this.state.gameStateJson = JSON.stringify(this.runtimeGameState);

    if (this.state.gameId === 'tictactoe') {
      const turnSymbol = this.runtimeGameState.currentTurn;
      const turnPlayer = this.runtimeGameState.players[turnSymbol];
      this.state.currentTurnPlayerId = turnPlayer ? turnPlayer.id : '';
    }

    this.triggerBotTurnIfNeeded();
  }

  private executeAction(action: any, playerId: string) {
    if (!this.gameModule || !this.runtimeGameState) return;

    const validation = this.gameModule.validateAction(this.runtimeGameState, action, playerId);
    if (!validation.valid) {
      console.warn(`[Room ${this.state.roomCode}] Action invalid: ${validation.error}`);
      return;
    }

    this.runtimeGameState = this.gameModule.applyAction(this.runtimeGameState, action);
    this.state.gameStateJson = JSON.stringify(this.runtimeGameState);

    if (this.gameModule.isGameOver(this.runtimeGameState)) {
      this.state.status = 'gameover';
      const result = this.gameModule.computeResult(this.runtimeGameState);
      this.state.winnerId = result.winnerId || '';
      this.state.winReason = result.reason || '';
      return;
    }

    if (this.state.gameId === 'tictactoe') {
      const turnSymbol = this.runtimeGameState.currentTurn;
      const turnPlayer = this.runtimeGameState.players[turnSymbol];
      this.state.currentTurnPlayerId = turnPlayer ? turnPlayer.id : '';
    }

    this.triggerBotTurnIfNeeded();
  }

  private async triggerBotTurnIfNeeded() {
    if (this.state.status !== 'playing' || !this.state.currentTurnPlayerId) return;

    const botInstance = this.botInstances.get(this.state.currentTurnPlayerId);
    if (botInstance) {
      setTimeout(async () => {
        if (this.state.status !== 'playing') return;
        const botAction = await botInstance.chooseAction(this.runtimeGameState, this.state.currentTurnPlayerId);
        if (botAction) {
          this.executeAction(botAction, this.state.currentTurnPlayerId);
        }
      }, 500);
    }
  }
}
